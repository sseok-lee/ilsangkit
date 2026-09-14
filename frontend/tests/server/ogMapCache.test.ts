import { describe, expect, it, beforeEach } from 'vitest'
import {
  OG_MAP_SUCCESS_CACHE_MAX_BYTES,
  clearOgMapCache,
  getCachedOgMapImage,
  setCachedOgMapImage,
} from '../../server/utils/ogMapCache'

describe('ogMapCache', () => {
  beforeEach(() => {
    clearOgMapCache()
  })

  it('does not cache entries larger than the byte budget', () => {
    setCachedOgMapImage('too-large', {
      body: Buffer.alloc(OG_MAP_SUCCESS_CACHE_MAX_BYTES + 1),
      contentType: 'image/jpeg',
    })

    expect(getCachedOgMapImage('too-large')).toBeUndefined()
  })

  it('evicts oldest entries to stay within the byte budget', () => {
    setCachedOgMapImage('oldest', {
      body: Buffer.alloc(OG_MAP_SUCCESS_CACHE_MAX_BYTES - 10),
      contentType: 'image/jpeg',
    })
    setCachedOgMapImage('newest', {
      body: Buffer.alloc(20),
      contentType: 'image/jpeg',
    })

    expect(getCachedOgMapImage('oldest')).toBeUndefined()
    expect(getCachedOgMapImage('newest')).toBeTruthy()
  })
})
