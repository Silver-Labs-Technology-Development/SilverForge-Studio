import assert from 'node:assert/strict'
import { test } from 'node:test'

import { networks, explorerUrl, isSupportedEvmChain, safeRpcUrl } from '../src/networks.js'
import { createMetadata, parseWholeTokenSupply, validateLogoFile, validateTokenForm } from '../src/validation.js'

const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], 'logo.png', { type: 'image/png' })

test('form validation requires logo, valid supply, and Solana public metadata URLs', () => {
  const values = { name: 'Silver Test', symbol: 'SLVT', decimals: '9', supply: '1000', logoFile: png, logoUrl: 'https://assets.example/logo.png', metadataUrl: 'https://assets.example/metadata.json' }
  assert.deepEqual(validateTokenForm(values, networks['solana-devnet']), [])
  assert.ok(validateTokenForm({ ...values, logoFile: null }, networks.ethereum).some((error) => error.includes('logo')))
  assert.ok(validateTokenForm({ ...values, metadataUrl: 'http://assets.example/metadata.json' }, networks['solana-devnet']).some((error) => error.includes('HTTPS metadata')))
  assert.ok(validateTokenForm({ ...values, supply: '1.5' }, networks.ethereum).some((error) => error.includes('whole number')))
})

test('token supply uses exact atomic units and rejects uint256 overflow', () => {
  assert.equal(parseWholeTokenSupply('123456789', 18), 123456789000000000000000000n)
  assert.equal(parseWholeTokenSupply('7', 0), 7n)
  assert.throws(() => parseWholeTokenSupply('0', 18), /positive whole number/)
  assert.throws(() => parseWholeTokenSupply('1'.repeat(80), 18), /limit/)
})

test('logo validation checks actual file signature and metadata contains only public URLs', async () => {
  assert.equal(await validateLogoFile(png), true)
  const mislabeled = new File([new Uint8Array([0, 1, 2, 3])], 'logo.png', { type: 'image/png' })
  await assert.rejects(validateLogoFile(mislabeled), /does not match/)
  assert.deepEqual(createMetadata({ name: ' Silver Test ', symbol: ' SLVT ', logoUrl: 'https://assets.example/logo.png', logoFile: png }), {
    name: 'Silver Test',
    symbol: 'SLVT',
    description: '',
    image: 'https://assets.example/logo.png',
    external_url: '',
    properties: { category: 'image', files: [{ uri: 'https://assets.example/logo.png', type: 'image/png' }] },
  })
})

test('network identity and explorer links remain chain-specific', () => {
  assert.equal(isSupportedEvmChain(networks.ethereum, 1n), true)
  assert.equal(isSupportedEvmChain(networks.bsc, 1n), false)
  assert.equal(explorerUrl(networks['solana-devnet'], 'address', 'Mint111'), 'https://explorer.solana.com/address/Mint111?cluster=devnet')
  assert.equal(explorerUrl(networks.bsc, 'tx', '0xabc'), 'https://bscscan.com/tx/0xabc')
  assert.equal(safeRpcUrl('https://rpc.example/'), true)
  assert.equal(safeRpcUrl('http://rpc.example/'), false)
})
