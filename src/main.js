import { BrowserProvider } from 'ethers'
import { defaultNetworkId, explorerUrl, isSupportedEvmChain, networks, safeRpcUrl } from './networks.js'
import { deployEvmToken, formatEvmFee, prepareEvmDeployment } from './evm.js'
import { connectSolanaWallet, deploySolanaToken, getSolanaWallet, prepareSolanaDeployment } from './solana.js'
import { createMetadata, validateLogoFile, validateTokenForm } from './validation.js'
import './style.css'

const state = {
  networkId: defaultNetworkId,
  evmProvider: null,
  evmAccount: null,
  solanaWallet: null,
  solanaAccount: null,
  logoFile: null,
  logoObjectUrl: null,
  draft: null,
  artifact: null,
  pendingHash: null,
}

const element = (id) => document.getElementById(id)
const form = element('token-form')
const networkSelect = element('network-select')
const statusMessage = element('status-message')

function clearSolanaMintSigner(draft) {
  if (draft?.family !== 'solana' || !draft.mintSigner) return
  draft.mintSigner.secretKey.fill(0)
  draft.mintSigner = null
}

function getNetwork() {
  return networks[state.networkId]
}

function setStatus(message, type = 'info') {
  statusMessage.textContent = message
  statusMessage.dataset.type = type
  statusMessage.classList.toggle('visible', Boolean(message))
}

function clearStatus() {
  setStatus('')
}

function setBusy(busy) {
  for (const button of [element('wallet-button'), element('review-button'), element('switch-network'), element('confirm-deploy')]) {
    if (button) button.disabled = busy
  }
  element('review-button').textContent = busy ? 'Working…' : 'Review transaction'
}

function valuesFromForm() {
  return {
    name: element('token-name').value,
    symbol: element('token-symbol').value,
    decimals: element('token-decimals').value,
    supply: element('token-supply').value,
    logoFile: state.logoFile,
    logoUrl: element('logo-url').value.trim(),
    metadataUrl: element('metadata-url').value.trim(),
  }
}

function isWalletConnected(network = getNetwork()) {
  return network.family === 'evm' ? Boolean(state.evmProvider && state.evmAccount) : Boolean(state.solanaWallet && state.solanaAccount)
}

function currentAccount(network = getNetwork()) {
  return network.family === 'evm' ? state.evmAccount : state.solanaAccount?.toBase58() ?? null
}

function isNetworkReady(network = getNetwork()) {
  if (network.family === 'solana') return isWalletConnected(network)
  return Boolean(state.evmProvider && isSupportedEvmChain(network, state.evmChainId))
}

function showNetworkInfo() {
  const network = getNetwork()
  const options = Object.values(networks)
    .map((item) => `<option value="${item.id}" ${item.id === state.networkId ? 'selected' : ''}>${item.name}${item.testnet ? ' · testnet' : ' · mainnet'}</option>`)
    .join('')
  networkSelect.innerHTML = `${options}<option value="btcs-l2" disabled>BTCS L2 · under development</option>`
  const testnetNote = network.testnet
    ? 'Test network selected. Use test funds only; explorers and RPC services may be rate-limited.'
    : 'Mainnet selected. Deployment is irreversible and wallet network fees use real funds.'
  element('network-note').textContent = network.family === 'solana'
    ? `${testnetNote} Select your Solana RPC endpoint below if the public default is unavailable.`
    : `${testnetNote} Your EVM wallet must be on this exact chain before review.`
  element('rpc-control').classList.toggle('hidden', network.family !== 'solana')
  element('solana-rpc').value = network.rpcUrl
  element('solana-rpc').placeholder = network.rpcUrl
  document.querySelectorAll('.solana-only').forEach((node) => node.classList.toggle('hidden', network.family !== 'solana'))
  element('token-decimals').max = network.family === 'solana' ? '9' : '18'
  element('token-decimals').value = network.family === 'solana' && Number(element('token-decimals').value) > 9 ? '9' : element('token-decimals').value
  element('decimals-hint').textContent = network.family === 'solana' ? '(0–9 for this flow)' : '(0–18)'
  element('wallet-button').textContent = network.family === 'evm' ? 'Connect EVM wallet' : 'Connect Solana wallet'
  element('network-control').classList.toggle('hidden', network.family !== 'evm' || !state.evmProvider || isNetworkReady(network))
  element('switch-network').textContent = `Switch to ${network.name}`
  element('review-title').textContent = 'Review before signing'
  element('review-empty').classList.remove('hidden')
  element('review-data').classList.add('hidden')
  element('confirm-deploy').classList.add('hidden')
  element('deployment-result').classList.add('hidden')
  clearSolanaMintSigner(state.draft)
  state.draft = null
  updateWalletInfo()
}

function updateWalletInfo() {
  const network = getNetwork()
  if (network.family === 'evm' && state.evmAccount) {
    element('wallet-state').textContent = `${state.evmAccount.slice(0, 6)}…${state.evmAccount.slice(-4)}`
    element('wallet-detail').textContent = isNetworkReady(network) ? `${network.name} connected` : `Connected, but not on ${network.name}.`
    element('network-control').classList.toggle('hidden', isNetworkReady(network))
  } else if (network.family === 'solana' && state.solanaAccount) {
    const address = state.solanaAccount.toBase58()
    element('wallet-state').textContent = `${address.slice(0, 6)}…${address.slice(-4)}`
    element('wallet-detail').textContent = `${network.name} · wallet connected`
    element('network-control').classList.add('hidden')
  } else {
    element('wallet-state').textContent = 'Wallet not connected'
    element('wallet-detail').textContent = network.family === 'evm'
      ? 'Compatible EVM wallet required; keys stay in your wallet.'
      : 'Compatible Solana wallet required; keys stay in your wallet.'
    element('network-control').classList.toggle('hidden', network.family !== 'evm' || !state.evmProvider)
  }
}

function clearDraft() {
  clearSolanaMintSigner(state.draft)
  state.draft = null
  element('review-data').classList.add('hidden')
  element('review-empty').classList.remove('hidden')
  element('confirm-deploy').classList.add('hidden')
  element('deployment-result').classList.add('hidden')
  clearStatus()
}

function renderReview({ draft, cost, authority }) {
  element('review-empty').classList.add('hidden')
  element('review-data').classList.remove('hidden')
  element('review-title').textContent = 'Ready for your review'
  element('review-token').textContent = `${draft.values.name.trim()} (${draft.values.symbol.trim()})`
  element('review-network').textContent = getNetwork().name
  element('review-supply').textContent = `${draft.values.supply} whole tokens · ${draft.decimals} decimals`
  element('review-owner').textContent = authority
  element('review-cost').textContent = cost
  element('confirm-deploy').textContent = 'Confirm and deploy'
  element('confirm-deploy').classList.remove('hidden')
  if (draft.family === 'solana') {
    element('review-owner').textContent = `${authority} · mint ${draft.mintAddress}`
  }
}

function renderResult(network, result) {
  const container = element('deployment-result')
  container.replaceChildren()
  const heading = document.createElement('strong')
  heading.textContent = 'Deployment confirmed'
  const addressLabel = document.createElement('span')
  addressLabel.textContent = 'Token address / mint'
  const addressLink = document.createElement('a')
  addressLink.href = result.addressUrl
  addressLink.target = '_blank'
  addressLink.rel = 'noopener noreferrer'
  addressLink.textContent = result.address
  const txLabel = document.createElement('span')
  txLabel.textContent = 'Transaction'
  const txLink = document.createElement('a')
  txLink.href = result.transactionUrl
  txLink.target = '_blank'
  txLink.rel = 'noopener noreferrer'
  txLink.textContent = result.transactionHash
  container.append(heading, addressLabel, addressLink, txLabel, txLink)
  if (result.blockNumber !== undefined) {
    const block = document.createElement('span')
    block.textContent = `Confirmed in block ${result.blockNumber}`
    container.append(block)
  }
  container.classList.remove('hidden')
  element('review-title').textContent = 'Deployment complete'
}

async function loadArtifact() {
  if (state.artifact) return state.artifact
  const url = new URL(`${import.meta.env.BASE_URL}contracts/SilverForgeERC20.json`, window.location.href)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load the verified deployment artifact (HTTP ${response.status}).`)
  state.artifact = await response.json()
  if (!Array.isArray(state.artifact.abi) || !state.artifact.bytecode?.startsWith('0x')) {
    throw new Error('The compiled EVM token artifact is invalid.')
  }
  return state.artifact
}

async function connectEvmWallet() {
  if (!window.ethereum?.request) throw new Error('No injected EVM wallet was found. Install a compatible wallet extension.')
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts?.[0]) throw new Error('The wallet did not provide an account.')
  state.evmProvider = new BrowserProvider(window.ethereum)
  state.evmAccount = accounts[0]
  const chain = await state.evmProvider.getNetwork()
  state.evmChainId = Number(chain.chainId)
  window.ethereum.removeListener?.('chainChanged', onEvmChainChanged)
  window.ethereum.removeListener?.('accountsChanged', onEvmAccountsChanged)
  window.ethereum.on?.('chainChanged', onEvmChainChanged)
  window.ethereum.on?.('accountsChanged', onEvmAccountsChanged)
  updateWalletInfo()
  if (!isNetworkReady()) {
    element('network-control').classList.remove('hidden')
    setStatus(`Wallet connected. Switch it to ${getNetwork().name} before reviewing.`, 'warning')
  } else {
    setStatus('EVM wallet connected. SilverForge can request signatures only after you review a deployment.', 'success')
  }
}

async function onEvmChainChanged(chainIdHex) {
  state.evmChainId = Number.parseInt(chainIdHex, 16)
  clearDraft()
  updateWalletInfo()
  if (!isNetworkReady()) element('network-control').classList.remove('hidden')
}

function onEvmAccountsChanged(accounts) {
  state.evmAccount = accounts?.[0] ?? null
  clearDraft()
  updateWalletInfo()
}

async function switchEvmNetwork() {
  if (!window.ethereum?.request) throw new Error('Connect an EVM wallet first.')
  const network = getNetwork()
  if (network.family !== 'evm') throw new Error('Select an EVM network before switching.')
  const chainId = `0x${network.chainId.toString(16)}`
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (error) {
    if (error.code !== 4902) throw error
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: network.chainName,
        nativeCurrency: { name: network.symbol, symbol: network.symbol, decimals: 18 },
        rpcUrls: [network.rpcUrl],
        blockExplorerUrls: [network.explorer],
      }],
    })
  }
  const provider = new BrowserProvider(window.ethereum)
  const chain = await provider.getNetwork()
  state.evmProvider = provider
  state.evmChainId = Number(chain.chainId)
  clearDraft()
  updateWalletInfo()
  if (isNetworkReady()) setStatus(`Wallet switched to ${network.name}.`, 'success')
}

async function connectWallet() {
  clearStatus()
  setBusy(true)
  try {
    if (getNetwork().family === 'evm') await connectEvmWallet()
    else {
      const wallet = getSolanaWallet()
      const account = await connectSolanaWallet(wallet)
      state.solanaWallet = wallet
      state.solanaAccount = account
      updateWalletInfo()
      setStatus('Solana wallet connected. Account access is read-only until you explicitly approve a transaction.', 'success')
    }
  } catch (error) {
    setStatus(error.message || 'Wallet connection failed.', 'error')
  } finally {
    setBusy(false)
  }
}

async function prepareDeployment(event) {
  event.preventDefault()
  clearStatus()
  clearDraft()
  setBusy(true)
  try {
    const network = getNetwork()
    const values = valuesFromForm()
    const validationErrors = validateTokenForm(values, network)
    if (validationErrors.length) throw new Error(validationErrors.join(' '))
    await validateLogoFile(values.logoFile)
    if (!isWalletConnected(network)) throw new Error('Connect a compatible wallet before reviewing.')
    if (!isNetworkReady(network)) throw new Error(`Switch your wallet to ${network.name} before reviewing.`)

    const draft = network.family === 'evm'
      ? await prepareEvmDeployment({
        provider: state.evmProvider,
        network,
        values,
        account: state.evmAccount,
        artifact: await loadArtifact(),
      })
      : await prepareSolanaDeployment({
        network,
        rpcUrl: element('solana-rpc').value.trim(),
        values,
        account: state.solanaAccount.toBase58(),
      })
    state.draft = draft
    const cost = draft.family === 'evm'
      ? `up to ${formatEvmFee(draft.expectedFee, network.symbol)}`
      : `${(draft.feeLamports / 1e9).toFixed(6)} SOL network fee + ${(draft.rentLamports / 1e9).toFixed(6)} SOL rent`
    renderReview({ draft, cost, authority: currentAccount(network) })
    setStatus('Review the chain, token parameters and estimated cost. Confirming below will open your wallet.', 'info')
  } catch (error) {
    setStatus(error.message || 'Could not prepare the transaction review.', 'error')
  } finally {
    setBusy(false)
  }
}

async function confirmDeployment() {
  const draft = state.draft
  if (!draft) {
    setStatus('Review the transaction before confirming.', 'error')
    return
  }
  const network = getNetwork()
  if (draft.networkId !== network.id || !isNetworkReady(network)) {
    clearDraft()
    setStatus('Network or wallet changed after review. Prepare a new transaction review.', 'error')
    return
  }
  setBusy(true)
  element('review-title').textContent = 'Waiting for wallet approval'
  setStatus('Approve or reject the transaction in your wallet. SilverForge cannot sign it for you.', 'info')
  try {
    let result
    if (draft.family === 'evm') {
      result = await deployEvmToken({
        provider: state.evmProvider,
        network,
        draft,
        artifact: await loadArtifact(),
        onSubmitted(hash) {
          state.pendingHash = hash
          element('review-title').textContent = 'Transaction submitted'
          setStatus(`Transaction ${hash} was submitted. Waiting for chain confirmation…`, 'info')
        },
      })
    } else {
      result = await deploySolanaToken({
        wallet: state.solanaWallet,
        network,
        draft,
        onSubmitted(signature) {
          state.pendingHash = signature
          element('review-title').textContent = 'Transaction submitted'
          setStatus(`Transaction ${signature} was submitted. Waiting for chain confirmation…`, 'info')
        },
      })
    }
    renderResult(network, result)
    state.pendingHash = null
    setStatus('Deployment confirmed by the selected network. Verify the address in the explorer.', 'success')
  } catch (error) {
    const hash = error.transactionHash ?? state.pendingHash
    if (hash) {
      const resultPanel = element('deployment-result')
      resultPanel.replaceChildren()
      const label = document.createElement('strong')
      label.textContent = 'Transaction submitted; confirmation needs attention'
      const link = document.createElement('a')
      link.href = explorerUrl(network, 'tx', hash)
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = hash
      resultPanel.append(label, link)
      resultPanel.classList.remove('hidden')
      element('review-title').textContent = 'Confirmation pending or failed'
    } else {
      element('review-title').textContent = 'Deployment not completed'
    }
    setStatus(error.message || 'Deployment failed or was rejected by the wallet.', 'error')
  } finally {
    clearSolanaMintSigner(draft)
    state.draft = null
    state.pendingHash = null
    element('confirm-deploy').classList.add('hidden')
    setBusy(false)
  }
}

async function chooseLogo(event) {
  clearDraft()
  const file = event.target.files?.[0] ?? null
  if (!file) return
  try {
    await validateLogoFile(file)
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.naturalWidth > 4096 || image.naturalHeight > 4096) {
      URL.revokeObjectURL(url)
      throw new Error('Logo dimensions must not exceed 4096 × 4096 pixels.')
    }
    if (state.logoObjectUrl) URL.revokeObjectURL(state.logoObjectUrl)
    state.logoObjectUrl = url
    state.logoFile = file
    element('logo-preview').src = url
    element('logo-preview').classList.remove('hidden')
    element('upload-label').textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
    setStatus('Logo selected for this browser session. SilverForge does not upload or persist the image.', 'info')
  } catch (error) {
    state.logoFile = null
    event.target.value = ''
    setStatus(error.message || 'Could not read the selected logo.', 'error')
  }
}

async function downloadMetadata() {
  const values = valuesFromForm()
  if (!values.name.trim() || !values.symbol.trim()) {
    setStatus('Enter a token name and symbol before downloading metadata.', 'error')
    return
  }
  if (!values.logoFile) {
    setStatus('Choose a token logo before downloading metadata.', 'error')
    return
  }
  try {
    await validateLogoFile(values.logoFile)
    const metadata = createMetadata(values)
    const blob = new Blob([`${JSON.stringify(metadata, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${values.symbol.trim().toLowerCase()}-metadata.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus('Metadata JSON downloaded. Host it and the logo with a storage service you control, then paste the public URL into the form.', 'info')
  } catch (error) {
    setStatus(error.message || 'Could not generate metadata JSON.', 'error')
  }
}

function initialize() {
  networkSelect.innerHTML = Object.values(networks)
    .map((network) => `<option value="${network.id}">${network.name}${network.testnet ? ' · testnet' : ' · mainnet'}</option>`)
    .join('')
  networkSelect.value = defaultNetworkId
  element('solana-rpc').value = networks['solana-devnet'].rpcUrl
  showNetworkInfo()
  networkSelect.addEventListener('change', () => {
    state.networkId = networkSelect.value
    clearDraft()
    showNetworkInfo()
  })
  form.addEventListener('submit', prepareDeployment)
  form.addEventListener('input', (event) => {
    if (event.target.id !== 'logo-file') clearDraft()
  })
  element('logo-file').addEventListener('change', chooseLogo)
  element('wallet-button').addEventListener('click', connectWallet)
  element('switch-network').addEventListener('click', async () => {
    try {
      clearStatus()
      await switchEvmNetwork()
    } catch (error) {
      setStatus(error.message || 'Could not switch wallet network.', 'error')
    }
  })
  element('confirm-deploy').addEventListener('click', confirmDeployment)
  element('download-metadata').addEventListener('click', downloadMetadata)
}

initialize()
