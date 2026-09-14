let staticOgImage: Buffer | undefined

function storageValueToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') return Buffer.from(value, 'binary')
  throw new Error('og-map fallback asset is unavailable')
}

export async function readStaticOgFallbackPng(): Promise<Buffer> {
  if (staticOgImage) return staticOgImage
  staticOgImage = storageValueToBuffer(
    await useStorage('assets:og-map-fallback').getItemRaw('og-image.png'),
  )
  return staticOgImage
}
