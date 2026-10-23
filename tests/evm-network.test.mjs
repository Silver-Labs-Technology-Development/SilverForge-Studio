import assert from 'node:assert/strict'
import { test } from 'node:test'

import { prepareEvmDeployment, verifyEvmNetworkIdentity } from '../src/evm.js'
import { networks } from '../src/networks.js'

test('BTCS L2 identity requires both expected network and client identifiers', async () => {
  const calls = []
  const provider = {
    async send(method, params) {
      calls.push([method, params])
      return method === 'net_version' ? '31337' : 'BTCSL2/0.1.0'
    },
  }

  await verifyEvmNetworkIdentity(provider, networks['btcs-l2-local'])

  assert.deepEqual(calls, [
    ['net_version', []],
    ['web3_clientVersion', []],
  ])
})

test('chain ID 31337 without the BTCS L2 client identity is rejected before transaction preparation', async () => {
  let signerRequested = false
  const provider = {
    async getNetwork() {
      return { chainId: 31337n }
    },
    async send(method) {
      return method === 'net_version' ? '31337' : 'anvil/v1.0.0'
    },
    async getSigner() {
      signerRequested = true
      throw new Error('Signer must not be requested')
    },
  }

  await assert.rejects(
    prepareEvmDeployment({
      provider,
      network: networks['btcs-l2-local'],
      values: { name: 'Local Test', symbol: 'LT', decimals: '18', supply: '1' },
      account: '0x0000000000000000000000000000000000000001',
      artifact: {},
    }),
    /not the expected BTCS L2 local node/,
  )
  assert.equal(signerRequested, false)
})

test('the BTCS L2 client banner does not override a different network ID', async () => {
  await assert.rejects(
    verifyEvmNetworkIdentity({
      async send(method) {
        return method === 'net_version' ? '1' : 'BTCSL2/0.1.0'
      },
    }, networks['btcs-l2-local']),
    /not the expected BTCS L2 local node/,
  )
})

test('BTCS L2 identity RPC failures do not fall through to allow deployment', async () => {
  await assert.rejects(
    verifyEvmNetworkIdentity({
      async send() {
        throw new Error('RPC unavailable')
      },
    }, networks['btcs-l2-local']),
    /RPC unavailable/,
  )
})

test('public EVM networks do not request a BTCS-specific client banner', async () => {
  let called = false
  await verifyEvmNetworkIdentity({
    async send() {
      called = true
    },
  }, networks['ethereum-sepolia'])
  assert.equal(called, false)
})
