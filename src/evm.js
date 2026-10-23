import { ContractFactory, formatEther } from 'ethers'
import { explorerUrl, isSupportedEvmChain } from './networks.js'
import { parseWholeTokenSupply } from './validation.js'

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
    provider.getFeeData(),
  ])
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
  if (gasPrice === null) throw new Error('The wallet provider did not return a usable gas price.')
  return {
    family: 'evm',
    account,
    networkId: network.id,
    gasLimit,
    gasPrice,
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
  const contract = await factory.deploy(
    draft.values.name.trim(),
    draft.values.symbol.trim(),
    draft.decimals,
    draft.supply,
  )
  const tx = contract.deploymentTransaction()
  if (!tx) throw new Error('Wallet did not return the deployment transaction.')
  onSubmitted(tx.hash)
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
