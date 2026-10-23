import nacl from 'tweetnacl'
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { explorerUrl, safeRpcUrl } from './networks.js'

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const MINT_SIZE = 82
const ACCOUNT_SIZE = 165

function initializeMintInstruction(mint, decimals, authority) {
  const data = new Uint8Array(67)
  data[0] = 0
  data[1] = decimals
  data.set(authority.toBytes(), 2)
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  })
}

function createAssociatedTokenAccountInstruction(payer, associatedToken, owner, mint) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: new Uint8Array(),
  })
}

function mintToInstruction(mint, destination, authority, amount) {
  const data = new Uint8Array(9)
  data[0] = 7
  new DataView(data.buffer).setBigUint64(1, amount, true)
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  })
}

function metadataInstruction({ metadata, mint, owner, name, symbol, uri }) {
  const encoder = new TextEncoder()
  const stringField = (value) => {
    const encoded = encoder.encode(value)
    const length = new Uint8Array(4)
    new DataView(length.buffer).setUint32(0, encoded.length, true)
    return [length, encoded]
  }
  const data = new Uint8Array([
    33,
    ...stringField(name).flatMap((part) => [...part]),
    ...stringField(symbol).flatMap((part) => [...part]),
    ...stringField(uri).flatMap((part) => [...part]),
    0, 0,
    0,
    0,
    0,
    0,
    0,
  ])
  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function getSolanaWallet() {
  return window.phantom?.solana ?? window.solflare ?? window.solana ?? null
}

export async function connectSolanaWallet(wallet) {
  if (!wallet?.connect || !wallet?.signTransaction || !wallet?.publicKey) {
    throw new Error('Install a Solana wallet that supports connect and transaction signing (for example, Phantom).')
  }
  await wallet.connect()
  const publicKey = wallet.publicKey
  if (!publicKey) throw new Error('The Solana wallet did not return a public account.')
  return new PublicKey(publicKey.toString())
}

export async function prepareSolanaDeployment({ network, rpcUrl, values, account }) {
  if (!safeRpcUrl(rpcUrl)) throw new Error('Use an HTTPS RPC URL or a loopback development URL.')
  const connection = new Connection(rpcUrl, 'confirmed')
  const genesisHash = await connection.getGenesisHash()
  if (genesisHash !== network.genesisHash) {
    throw new Error(`The selected RPC endpoint is not ${network.name}. Choose an endpoint for the selected cluster.`)
  }
  const decimals = Number(values.decimals)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('SPL token decimals must be between 0 and 9 in this preview.')
  }
  const wholeSupply = BigInt(values.supply)
  if (wholeSupply <= 0n) throw new Error('Initial supply must be greater than zero.')
  const atomicSupply = wholeSupply * 10n ** BigInt(decimals)
  if (atomicSupply > 2n ** 64n - 1n) throw new Error('SPL token supply exceeds the supported u64 limit.')

  const owner = new PublicKey(account)
  const mintSigner = nacl.sign.keyPair()
  const mintPublicKey = new PublicKey(mintSigner.publicKey)
  const [tokenAccount] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mintPublicKey.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBytes(),
      mintPublicKey.toBytes(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )
  const [blockhash, mintRent, accountRent] = await Promise.all([
    connection.getLatestBlockhash('confirmed'),
    connection.getMinimumBalanceForRentExemption(MINT_SIZE),
    connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE),
  ])
  const transaction = new Transaction({
    feePayer: owner,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  }).add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mintPublicKey,
      lamports: mintRent,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    initializeMintInstruction(mintPublicKey, decimals, owner),
    createAssociatedTokenAccountInstruction(owner, tokenAccount, owner, mintPublicKey),
    mintToInstruction(mintPublicKey, tokenAccount, owner, atomicSupply),
    metadataInstruction({
      metadata,
      mint: mintPublicKey,
      owner,
      name: values.name.trim(),
      symbol: values.symbol.trim(),
      uri: values.metadataUrl.trim(),
    }),
  )
  let fee
  try {
    fee = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed')
  } catch (error) {
    mintSigner.secretKey.fill(0)
    throw error
  }
  if (fee.value === null) {
    mintSigner.secretKey.fill(0)
    throw new Error('Could not estimate the Solana transaction fee.')
  }
  return {
    family: 'solana',
    networkId: network.id,
    connection,
    account: owner,
    mintSigner,
    tokenAccount,
    transaction,
    blockhash,
    decimals,
    atomicSupply,
    feeLamports: fee.value,
    rentLamports: mintRent + accountRent,
    mintAddress: mintPublicKey.toBase58(),
    metadataAddress: metadata.toBase58(),
    values,
  }
}

export async function deploySolanaToken({ wallet, network, draft, onSubmitted }) {
  const clearMintSecret = () => {
    if (!draft.mintSigner) return
    draft.mintSigner.secretKey.fill(0)
    draft.mintSigner = null
  }
  const currentAccount = wallet?.publicKey?.toString()
  if (!currentAccount || currentAccount !== draft.account.toBase58()) {
    clearMintSecret()
    throw new Error('Solana wallet account changed after review. Reconnect and review again.')
  }
  let signature
  try {
    draft.transaction.partialSign({
      publicKey: new PublicKey(draft.mintSigner.publicKey),
      secretKey: draft.mintSigner.secretKey,
    })
    const signed = await wallet.signTransaction(draft.transaction)
    clearMintSecret()
    signature = await draft.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })
    onSubmitted(signature)
    const confirmation = await draft.connection.confirmTransaction(
      { signature, ...draft.blockhash },
      'confirmed',
    )
    if (confirmation.value.err) {
      const error = new Error('The Solana transaction was confirmed with an error.')
      error.transactionHash = signature
      throw error
    }
    return {
      address: draft.mintAddress,
      transactionHash: signature,
      addressUrl: explorerUrl(network, 'address', draft.mintAddress),
      transactionUrl: explorerUrl(network, 'tx', signature),
    }
  } catch (error) {
    clearMintSecret()
    if (signature && !error.transactionHash) error.transactionHash = signature
    throw error
  }
}
