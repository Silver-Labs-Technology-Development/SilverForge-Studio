import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Interface } from 'ethers'
import { Hardfork, Mainnet, createCustomCommon } from '@ethereumjs/common'
import { createLegacyTx } from '@ethereumjs/tx'
import { bytesToHex, createAccount, createAddressFromPrivateKey, createContractAddress, hexToBytes } from '@ethereumjs/util'
import { createVM, runTx } from '@ethereumjs/vm'

import { compileToken } from '../scripts/compile-contract.mjs'

test('compiled fixed-supply token deploys and exposes ERC-20 behavior in an isolated EVM', async () => {
  const artifact = await compileToken()
  const abiNames = artifact.abi.filter((item) => item.type === 'function').map((item) => item.name)
  assert.ok(abiNames.includes('transfer'))
  assert.ok(abiNames.includes('approve'))
  assert.ok(!abiNames.includes('mint'))
  assert.ok(!abiNames.includes('owner'))

  const common = createCustomCommon({ chainId: 11155111 }, Mainnet, { hardfork: Hardfork.Shanghai })
  const vm = await createVM({ common, activatePrecompiles: true })
  const privateKey = new Uint8Array(32).fill(17)
  const sender = createAddressFromPrivateKey(privateKey)
  await vm.stateManager.putAccount(sender, createAccount({ balance: 10n ** 20n }))
  const contract = new Interface(artifact.abi)
  const values = {
    name: 'SilverForge Test',
    symbol: 'SFT',
    decimals: 6,
    supply: 250_000n * 10n ** 6n,
  }
  const tx = createLegacyTx({
    nonce: 0n,
    gasLimit: 8_000_000n,
    gasPrice: 2_000_000_000n,
    value: 0n,
    data: hexToBytes(`${artifact.bytecode}${contract.encodeDeploy([
      values.name,
      values.symbol,
      values.decimals,
      values.supply,
    ]).slice(2)}`),
  }, { common }).sign(privateKey)
  const execution = await runTx(vm, { tx, skipBlockGasLimitValidation: true })
  assert.equal(execution.receipt.status, 1, execution.execResult.exceptionError?.error)

  const address = createContractAddress(sender, 0n)
  assert.ok((await vm.stateManager.getCode(address)).length > 0)
  const call = async (method, args = []) => {
    const result = await vm.evm.runCall({
      to: address,
      caller: sender,
      origin: sender,
      data: hexToBytes(contract.encodeFunctionData(method, args)),
      gasLimit: 1_000_000n,
      isStatic: true,
    })
    assert.equal(result.execResult.exceptionError, undefined)
    return contract.decodeFunctionResult(method, bytesToHex(result.execResult.returnValue))
  }
  assert.equal((await call('name'))[0], values.name)
  assert.equal((await call('symbol'))[0], values.symbol)
  assert.equal((await call('decimals'))[0], 6n)
  assert.equal((await call('totalSupply'))[0], values.supply)
  assert.equal((await call('balanceOf', [bytesToHex(sender.bytes)]))[0], values.supply)

  const recipient = createAddressFromPrivateKey(new Uint8Array(32).fill(18))
  const transferAmount = 123n
  const senderState = await vm.stateManager.getAccount(sender)
  const transferTx = createLegacyTx({
    nonce: senderState.nonce,
    gasLimit: 100_000n,
    gasPrice: 2_000_000_000n,
    to: address,
    value: 0n,
    data: hexToBytes(contract.encodeFunctionData('transfer', [
      bytesToHex(recipient.bytes),
      transferAmount,
    ])),
  }, { common }).sign(privateKey)
  const transfer = await runTx(vm, { tx: transferTx, skipBlockGasLimitValidation: true })
  assert.equal(transfer.receipt.status, 1, transfer.execResult.exceptionError?.error)
  const balanceOf = async (account) => (await call('balanceOf', [bytesToHex(account.bytes)]))[0]
  assert.equal(await balanceOf(sender), values.supply - transferAmount)
  assert.equal(await balanceOf(recipient), transferAmount)
})
