import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import solc from 'solc'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function compileToken() {
  const sourcePath = resolve(projectRoot, 'contracts/SilverForgeERC20.sol')
  const source = await readFile(sourcePath, 'utf8')
  const input = {
    language: 'Solidity',
    sources: { 'SilverForgeERC20.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'shanghai',
      metadata: { bytecodeHash: 'none' },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
        },
      },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import(importPath) {
      if (!importPath.startsWith('@openzeppelin/contracts/')) {
        return { error: `Import is not allowed: ${importPath}` }
      }
      try {
        return {
          contents: readFileSync(resolve(projectRoot, 'node_modules', importPath), 'utf8'),
        }
      } catch (error) {
        return { error: `Unable to load ${importPath}: ${error.message}` }
      }
    },
  }))
  const errors = (output.errors ?? []).filter((entry) => entry.severity === 'error')
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join('\n'))
  const contract = output.contracts?.['SilverForgeERC20.sol']?.SilverForgeERC20
  if (!contract?.evm?.bytecode?.object) throw new Error('Solidity compiler produced no deployable bytecode')
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` }
}

export async function writeTokenArtifact() {
  const artifact = await compileToken()
  const outputPath = resolve(projectRoot, 'public/contracts/SilverForgeERC20.json')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeTokenArtifact()
  process.stdout.write('Compiled SilverForgeERC20 and wrote the static deployment artifact.\n')
}
