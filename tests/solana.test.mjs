import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { Keypair, PublicKey } from '@solana/web3.js'

import { deploySolanaToken, prepareSolanaDeployment } from '../src/solana.js'
import { networks } from '../src/networks.js'

async function createRpcFixture(genesisHash) {
  const blockhash = Keypair.generate().publicKey.toBase58()
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const call = JSON.parse(Buffer.concat(chunks).toString())
    const resultByMethod = {
      getGenesisHash: genesisHash,
      getLatestBlockhash: { context: { slot: 8 }, value: { blockhash, lastValidBlockHeight: 200 } },
      getMinimumBalanceForRentExemption: 2_000_000,
      getFeeForMessage: { context: { slot: 8 }, value: 5_000 },
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: resultByMethod[call.method] }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

test('Solana preparation checks cluster identity and creates real SPL + metadata instructions', async () => {
  const rpc = await createRpcFixture(networks['solana-devnet'].genesisHash)
  try {
    const draft = await prepareSolanaDeployment({
      network: networks['solana-devnet'],
      rpcUrl: rpc.url,
      account: Keypair.generate().publicKey.toBase58(),
      values: {
        name: 'Silver Sol',
        symbol: 'SSOL',
        decimals: '6',
        supply: '5000',
        logoUrl: 'https://assets.example/silver-sol.png',
        metadataUrl: 'https://assets.example/silver-sol.json',
      },
    })
    assert.equal(draft.transaction.instructions.length, 5)
    assert.equal(draft.feeLamports, 5_000)
    assert.equal(draft.rentLamports, 4_000_000)
    assert.equal(draft.mintAddress, new PublicKey(draft.mintSigner.publicKey).toBase58())
    const [createMint, initializeMint, createTokenAccount, mintTo] = draft.transaction.instructions
    assert.equal(createMint.programId.toBase58(), '11111111111111111111111111111111')
    assert.equal(initializeMint.programId.toBase58(), 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    assert.equal(initializeMint.data.length, 67)
    assert.equal(initializeMint.data[0], 0)
    assert.equal(initializeMint.data[1], 6)
    assert.deepEqual(
      [...initializeMint.data.slice(2, 34)],
      [...draft.account.toBytes()],
    )
    assert.ok(initializeMint.data.slice(34).every((byte) => byte === 0))
    assert.equal(createTokenAccount.programId.toBase58(), 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    assert.equal(createTokenAccount.data.length, 0)
    assert.equal(mintTo.data[0], 7)
    assert.equal(new DataView(mintTo.data.buffer, mintTo.data.byteOffset).getBigUint64(1, true), 5_000_000_000n)
    const metadataInstruction = draft.transaction.instructions.at(-1)
    assert.equal(metadataInstruction.programId.toBase58(), 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    assert.equal(metadataInstruction.keys.length, 7)
    assert.equal(metadataInstruction.data[0], 33)
    assert.equal(metadataInstruction.keys[0].isWritable, true)
    assert.equal(metadataInstruction.keys[1].pubkey.toBase58(), draft.mintAddress)
    assert.equal(metadataInstruction.keys[2].isSigner, true)
    assert.equal(metadataInstruction.keys[3].isWritable, true)
    let offset = 1
    const readString = () => {
      const length = new DataView(
        metadataInstruction.data.buffer,
        metadataInstruction.data.byteOffset + offset,
        4,
      ).getUint32(0, true)
      offset += 4
      const value = new TextDecoder().decode(metadataInstruction.data.slice(offset, offset + length))
      offset += length
      return value
    }
    assert.equal(readString(), 'Silver Sol')
    assert.equal(readString(), 'SSOL')
    assert.equal(readString(), 'https://assets.example/silver-sol.json')
    assert.deepEqual([...metadataInstruction.data.slice(offset)], [0, 0, 0, 0, 0, 0, 0])

    await assert.rejects(
      prepareSolanaDeployment({
        network: networks['solana'],
        rpcUrl: rpc.url,
        account: draft.account.toBase58(),
        values: { name: 'Wrong Cluster', symbol: 'BAD', decimals: '6', supply: '1', metadataUrl: 'https://assets.example/a.json' },
      }),
      /not Solana Mainnet/,
    )
  } finally {
    await new Promise((resolve, reject) => rpc.server.close((error) => error ? reject(error) : resolve()))
  }
})

test('Solana deployment delegates signing to wallet and clears temporary mint secret', async () => {
  const rpc = await createRpcFixture(networks['solana-devnet'].genesisHash)
  const walletKeypair = Keypair.generate()
  try {
    const draft = await prepareSolanaDeployment({
      network: networks['solana-devnet'],
      rpcUrl: rpc.url,
      account: walletKeypair.publicKey.toBase58(),
      values: {
        name: 'Wallet Signed',
        symbol: 'WS',
        decimals: '0',
        supply: '1',
        logoUrl: 'https://assets.example/ws.png',
        metadataUrl: 'https://assets.example/ws.json',
      },
    })
    const mintSecret = draft.mintSigner.secretKey
    const signature = 'solana-signature-fixture'
    draft.connection.sendRawTransaction = async (raw) => {
      assert.ok(raw.length > 0)
      return signature
    }
    draft.connection.confirmTransaction = async () => ({ value: { err: null } })
    let walletApproved = false
    const result = await deploySolanaToken({
      wallet: {
        publicKey: walletKeypair.publicKey,
        async signTransaction(transaction) {
          walletApproved = true
          transaction.partialSign(walletKeypair)
          return transaction
        },
      },
      network: networks['solana-devnet'],
      draft,
      onSubmitted() {},
    })
    assert.equal(walletApproved, true)
    assert.equal(result.transactionHash, signature)
    assert.ok(mintSecret.every((byte) => byte === 0))
    assert.equal(draft.mintSigner, null)
  } finally {
    await new Promise((resolve, reject) => rpc.server.close((error) => error ? reject(error) : resolve()))
  }
})
