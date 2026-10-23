export const networks = {
  ethereum: {
    id: 'ethereum',
    family: 'evm',
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    testnet: false,
    chainName: 'Ethereum Mainnet',
  },
  'ethereum-sepolia': {
    id: 'ethereum-sepolia',
    family: 'evm',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    symbol: 'ETH',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    testnet: true,
    chainName: 'Sepolia',
  },
  bsc: {
    id: 'bsc',
    family: 'evm',
    name: 'BNB Smart Chain',
    chainId: 56,
    symbol: 'BNB',
    rpcUrl: 'https://bsc-rpc.publicnode.com',
    explorer: 'https://bscscan.com',
    testnet: false,
    chainName: 'BNB Smart Chain',
  },
  'bsc-testnet': {
    id: 'bsc-testnet',
    family: 'evm',
    name: 'BNB Smart Chain Testnet',
    chainId: 97,
    symbol: 'tBNB',
    rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    explorer: 'https://testnet.bscscan.com',
    testnet: true,
    chainName: 'BNB Smart Chain Testnet',
  },
  'btcs-l2-local': {
    id: 'btcs-l2-local',
    family: 'evm',
    name: 'BTCS L2 Local',
    chainId: 31337,
    symbol: 'BTCS',
    rpcUrl: 'http://127.0.0.1:8545',
    explorer: null,
    testnet: true,
    localDevelopment: true,
    clientVersionPrefix: 'BTCSL2/',
    chainName: 'BTCS L2 Local Development',
  },
  solana: {
    id: 'solana',
    family: 'solana',
    name: 'Solana Mainnet',
    symbol: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://explorer.solana.com',
    cluster: 'mainnet-beta',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    testnet: false,
  },
  'solana-devnet': {
    id: 'solana-devnet',
    family: 'solana',
    name: 'Solana Devnet',
    symbol: 'SOL',
    rpcUrl: 'https://api.devnet.solana.com',
    explorer: 'https://explorer.solana.com',
    cluster: 'devnet',
    genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    testnet: true,
  },
}

export const defaultNetworkId = 'ethereum-sepolia'

export function isSupportedEvmChain(network, chainId) {
  return network?.family === 'evm' && Number(chainId) === network.chainId
}

export function explorerUrl(network, kind, value) {
  if (!network || !value || !['address', 'tx'].includes(kind)) return null
  if (network.family === 'solana') {
    const cluster = network.cluster === 'mainnet-beta' ? '' : `?cluster=${encodeURIComponent(network.cluster)}`
    return `${network.explorer}/${kind}/${encodeURIComponent(value)}${cluster}`
  }
  if (!network.explorer) return null
  return `${network.explorer}/${kind}/${encodeURIComponent(value)}`
}

export function safeRpcUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}
