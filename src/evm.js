import { ContractFactory, formatEther } from 'ethers'
import { explorerUrl, isSupportedEvmChain } from './networks.js'
import { parseWholeTokenSupply } from './validation.js'

// The local BTCS L2 node does not implement eth_gasPrice, eth_feeHistory, or
// eth_maxPriorityFeePerGas, and its development sequencer only includes
// transactions when a block is produced. Both facts are handled explicitly for
// the `localDevelopment` profile instead of falling back to a mock.
export const LOCAL_PRIORITY_FEE_PER_GAS = 1_000_000_000n

export async function verifyEvmNetworkIdentity(provider, network) {
  if (!network.localDevelopment) return

  const [networkVersion, clientVersion] = await Promise.all([
    provider.send('net_version', []),
    provider.send('web3_clientVersion', []),
  ])
  if (networkVersion !== String(network.chainId) ||
      typeof clientVersion !== 'string' ||
      !clientVersion.startsWith(network.clientVersionPrefix)) {
    throw new Error(
      `The RPC endpoint is not the expected BTCS L2 local node (chain ${network.chainId}, client ${network.clientVersionPrefix}). No transaction was prepared or sent.`,
    )
  }
}

/** Fee data that does not require the RPC methods the local node lacks. */
export async function readEvmFeeData(provider, network) {
  if (!network.localDevelopment) return provider.getFeeData()
  const block = await provider.send('eth_getBlockByNumber', ['latest', false])
  if (!block || typeof block.baseFeePerGas !== 'string') {
    throw new Error('The local BTCS L2 node did not return a base fee; EIP-1559 fees cannot be prepared.')
  }
  const baseFee = BigInt(block.baseFeePerGas)
  return {
    maxPriorityFeePerGas: LOCAL_PRIORITY_FEE_PER_GAS,
    maxFeePerGas: baseFee * 2n + LOCAL_PRIORITY_FEE_PER_GAS,
    gasPrice: baseFee,
  }
}

/**
 * On the local development sequencer a submitted transaction stays pending
 * until a block is produced. This is a real node operation, not a simulation.
 */
export async function mineLocalBlock(provider, network) {
  if (!network.localDevelopment) return null
  return provider.send('btcs_dev_mine', [])
}

export async function prepareEvmDeployment({ provider, network, values, account, artifact }) {
  const chain = await provider.getNetwork()
  if (!isSupportedEvmChain(network, chain.chainId)) {
    throw new Error(`Connected wallet is on chain ${chain.chainId}; switch to ${network.name} before reviewing.`)
  }
  await verifyEvmNetworkIdentity(provider, network)
  const signer = await provider.getSigner()
  const signerAddress = await signer.getAddress()
  if (signerAddress.toLowerCase() !== account.toLowerCase()) {
    throw new Error('The connected wallet account changed. Reconnect and review again.')
  }
  const decimals = Number(values.decimals)
  const supply = parseWholeTokenSupply(values.supply, decimals)
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer)
  const transaction = await factory.getDeployTransaction(
    values.name.trim(),
    values.symbol.trim(),
    decimals,
    supply,
  )
  const [gasLimit, feeData] = await Promise.all([
    provider.estimateGas({ ...transaction, from: account }),
    readEvmFeeData(provider, network),
  ])
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
  if (gasPrice === null || gasPrice === undefined) {
    throw new Error('The wallet provider did not return a usable gas price.')
  }
  return {
    family: 'evm',
    account,
    networkId: network.id,
    localDevelopment: Boolean(network.localDevelopment),
    gasLimit,
    gasPrice,
    maxFeePerGas: feeData.maxFeePerGas ?? gasPrice,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? null,
    expectedFee: gasLimit * gasPrice,
    supply,
    decimals,
    values,
  }
}

export async function deployEvmToken({ provider, network, draft, artifact, onSubmitted }) {
  const chain = await provider.getNetwork()
  if (!isSupportedEvmChain(network, chain.chainId)) {
    throw new Error(`Wallet network changed. Select ${network.name} and review again.`)
  }
  await verifyEvmNetworkIdentity(provider, network)
  const signer = await provider.getSigner()
  const signerAddress = await signer.getAddress()
  if (signerAddress.toLowerCase() !== draft.account.toLowerCase()) {
    throw new Error('Wallet account changed after review. Reconnect and review again.')
  }
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer)
  const overrides = {
    gasLimit: draft.gasLimit,
    maxFeePerGas: draft.maxFeePerGas,
  }
  if (draft.maxPriorityFeePerGas !== null && draft.maxPriorityFeePerGas !== undefined) {
    overrides.maxPriorityFeePerGas = draft.maxPriorityFeePerGas
  }
  const contract = await factory.deploy(
    draft.values.name.trim(),
    draft.values.symbol.trim(),
    draft.decimals,
    draft.supply,
    overrides,
  )
  const tx = contract.deploymentTransaction()
  if (!tx) throw new Error('Wallet did not return the deployment transaction.')
  onSubmitted(tx.hash)
  await mineLocalBlock(provider, network)
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) {
    const error = new Error('The deployment transaction was not confirmed successfully.')
    error.transactionHash = tx.hash
    throw error
  }
  const address = await contract.getAddress()
  return {
    address,
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber,
    addressUrl: explorerUrl(network, 'address', address),
    transactionUrl: explorerUrl(network, 'tx', tx.hash),
  }
}

export function formatEvmFee(amount, symbol) {
  const [whole, fractional = ''] = formatEther(amount).split('.')
  const rounded = fractional.padEnd(6, '0').slice(0, 6)
  return `${whole}.${rounded} ${symbol}`
}
