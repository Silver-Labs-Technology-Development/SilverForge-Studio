export const MAX_LOGO_BYTES = 5 * 1024 * 1024

export function validateTokenForm(values, network) {
  const errors = []
  const name = values.name.trim()
  const symbol = values.symbol.trim()
  if (!name || name.length > 64) errors.push('Name must contain 1–64 characters.')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,9}$/.test(symbol)) {
    errors.push('Symbol must be 1–10 letters, numbers, dots, underscores or hyphens.')
  }
  const decimals = Number(values.decimals)
  const maxDecimals = network?.family === 'solana' ? 9 : 18
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > maxDecimals) {
    errors.push(`Decimals must be a whole number from 0 to ${maxDecimals}.`)
  }
  if (!/^[1-9]\d*$/.test(values.supply)) errors.push('Initial supply must be a positive whole number.')
  if (!values.logoFile) errors.push('Choose a token logo before continuing.')

  if (network?.family === 'solana') {
    if (new TextEncoder().encode(name).length > 32) errors.push('Solana token names must be at most 32 UTF-8 bytes.')
    if (new TextEncoder().encode(symbol).length > 10) errors.push('Solana token symbols must be at most 10 UTF-8 bytes.')
    if (!isPublicHttpsUrl(values.logoUrl)) errors.push('Solana metadata requires a public HTTPS logo URL.')
    if (!isPublicHttpsUrl(values.metadataUrl)) errors.push('Solana metadata requires a public HTTPS metadata JSON URL.')
    if (new TextEncoder().encode(values.metadataUrl.trim()).length > 200) {
      errors.push('The Solana metadata URL must be no more than 200 UTF-8 bytes.')
    }
  } else if (network?.family === 'evm' && !Number.isInteger(network.chainId)) {
    errors.push('Choose a supported EVM network.')
  } else if (network?.family === 'evm' && values.logoUrl && !isPublicHttpsUrl(values.logoUrl)) {
    errors.push('Public logo URL must use HTTPS.')
  }
  return errors
}

export function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export async function validateLogoFile(file) {
  if (!file) throw new Error('Choose a token logo before continuing.')
  if (file.size > MAX_LOGO_BYTES) throw new Error('Logo must be 5 MB or smaller.')
  const signatures = {
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
  }
  const signature = signatures[file.type]
  if (!signature) throw new Error('Logo must be a PNG, JPEG or WebP image.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!signature.every((byte, index) => bytes[index] === byte)) {
    throw new Error('The selected file content does not match its image type.')
  }
  if (file.type === 'image/webp' && String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') {
    throw new Error('The selected file is not a valid WebP image.')
  }
  return true
}

export function parseWholeTokenSupply(supply, decimals) {
  if (!/^[1-9]\d*$/.test(supply)) throw new Error('Initial supply must be a positive whole number.')
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('Token decimals must be between 0 and 18.')
  }
  const amount = BigInt(supply) * (10n ** BigInt(decimals))
  if (amount >= 2n ** 256n) throw new Error('Initial supply exceeds the supported token limit.')
  return amount
}

export function createMetadata(values) {
  return {
    name: values.name.trim(),
    symbol: values.symbol.trim(),
    description: values.description?.trim() ?? '',
    image: values.logoUrl.trim(),
    external_url: '',
    properties: { category: 'image', files: [{ uri: values.logoUrl.trim(), type: values.logoFile?.type ?? 'image/png' }] },
  }
}
