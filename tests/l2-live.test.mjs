import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers'

import { compileToken } from '../scripts/compile-contract.mjs'
import { LOCAL_PRIORITY_FEE_PER_GAS, mineLocalBlock, readEvmFeeData } from '../src/evm.js'
import { networks } from '../src/networks.js'

const LOCAL = networks['btcs-l2-local']
const SEPOLIA = networks['ethereum-sepolia']
const RPC_URL = process.env.BTCS_L2_RPC_URL
const DEV_KEY = process.env.BTCS_L2_DEV_PRIVATE_KEY

test('local fee data is derived from the latest base fee, not eth_gasPrice', async () => {
  const calls = []
  const provider = {
    async send(method, params) {
      calls.push({ method, params })
      if (method === 'eth_getBlockByNumber') {
        return { baseFeePerGas: '0x3b9aca00' }
      }
      throw new Error(method)
    },
  }
  const fees = await readEvmFeeData(provider, LOCAL)
  assert.equal(fees.maxPriorityFeePerGas, LOCAL_PRIORITY_FEE_PER_GAS)
  assert.equal(fees.maxFeePerGas, 3_000_000_000n)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'eth_getBlockByNumber')
})

test('local fee data fails loudly when the node reports no base fee', async () => {
  await assert.rejects(
    () => readEvmFeeData({ send: async () => ({}) }, LOCAL),
    /did not return a base fee/,
  )
})

test('public networks keep using the wallet provider fee data', async () => {
  let called = false
  const provider = {
    async getFeeData() {
      called = true
      return { maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, gasPrice: 1n }
    },
  }
  const fees = await readEvmFeeData(provider, SEPOLIA)
  assert.equal(called, true)
  assert.equal(fees.maxFeePerGas, 1n)
})

test('only the local profile mines a development block', async () => {
  let mined = 0
  const provider = {
    async send(method) {
      mined += 1
      assert.equal(method, 'btcs_dev_mine')
      return { number: '0x1' }
    },
  }
  assert.equal(await mineLocalBlock(provider, SEPOLIA), null)
  assert.equal(mined, 0)
  assert.deepEqual(await mineLocalBlock(provider, LOCAL), { number: '0x1' })
  assert.equal(mined, 1)
})

test(
  'live: deploys the compiled token to a real local BTCS L2 node',
  { skip: !RPC_URL || !DEV_KEY },
  async () => {
    const provider = new JsonRpcProvider(RPC_URL, Number(LOCAL.chainId), { staticNetwork: true })
    const clientVersion = await provider.send('web3_clientVersion', [])
    assert.ok(clientVersion.startsWith(LOCAL.clientVersionPrefix), clientVersion)

    const artifact = await compileToken()
    const signer = new Wallet(DEV_KEY, provider)
    const fees = await readEvmFeeData(provider, LOCAL)
    const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer)
    // The node rejects the `pending` block tag, which ethers uses by default
    // when resolving a nonce. Pass an explicit nonce from `latest`.
    const nonce = await provider.send('eth_getTransactionCount', [await signer.getAddress(), 'latest'])
    const contract = await factory.deploy('SilverForge Live', 'SFL', 6, 250_000n * 10n ** 6n, {
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      nonce: Number(nonce),
    })
    const tx = contract.deploymentTransaction()
    await mineLocalBlock(provider, LOCAL)
    const receipt = await tx.wait()
    assert.equal(receipt.status, 1)

    const deployed = new Contract(await contract.getAddress(), artifact.abi, provider)
    assert.equal(await deployed.name(), 'SilverForge Live')
    assert.equal(await deployed.symbol(), 'SFL')
    assert.equal(await deployed.decimals(), 6n)
    assert.equal(await deployed.totalSupply(), 250_000n * 10n ** 6n)
    assert.equal(await deployed.balanceOf(await signer.getAddress()), 250_000n * 10n ** 6n)

    const code = await provider.getCode(await contract.getAddress())
    assert.ok(code.length > 2)
  },
)
