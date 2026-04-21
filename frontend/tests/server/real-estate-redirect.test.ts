import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bjdCache,
  resolveBjdCode,
  type BjdLookupResult,
} from '../../server/middleware/real-estate-redirect'

describe('bjdCache (TtlLRU)', () => {
  beforeEach(() => bjdCache.clear())

  it('caches and returns stored entries', () => {
    bjdCache.set('11680', { cityFullName: '서울특별시', districtName: '강남구' })
    expect(bjdCache.get('11680')).toEqual({
      cityFullName: '서울특별시',
      districtName: '강남구',
    })
  })

  it('returns undefined for missing keys', () => {
    expect(bjdCache.get('99999')).toBeUndefined()
  })

  it('re-inserting a key touches its LRU position', () => {
    bjdCache.set('a', { cityFullName: '서울특별시', districtName: '강남구' })
    bjdCache.set('b', { cityFullName: '서울특별시', districtName: '송파구' })
    bjdCache.get('a') // touch a
    // 두 항목 모두 여전히 조회 가능해야 한다
    expect(bjdCache.get('a')).toBeDefined()
    expect(bjdCache.get('b')).toBeDefined()
  })
})

describe('resolveBjdCode', () => {
  beforeEach(() => bjdCache.clear())

  it('calls the fetcher and caches successful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      data: { city: '서울특별시', district: '강남구' },
    })
    const result = (await resolveBjdCode('11680', fetcher, 'http://api')) as BjdLookupResult
    expect(result.cityFullName).toBe('서울특별시')
    expect(result.districtName).toBe('강남구')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // 두 번째 호출은 캐시에서 반환
    const cached = await resolveBjdCode('11680', fetcher, 'http://api')
    expect(cached).toEqual(result)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns null when fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network'))
    const result = await resolveBjdCode('11680', fetcher, 'http://api')
    expect(result).toBeNull()
  })

  it('returns null when response lacks city/district', async () => {
    const fetcher = vi.fn().mockResolvedValue({ success: false })
    const result = await resolveBjdCode('11680', fetcher, 'http://api')
    expect(result).toBeNull()
  })

  it('returns null when bjdCode is empty', async () => {
    const fetcher = vi.fn()
    const result = await resolveBjdCode('', fetcher, 'http://api')
    expect(result).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('encodes bjdCode safely into the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      data: { city: '서울특별시', district: '강남구' },
    })
    await resolveBjdCode('11680  ', fetcher, 'http://api')
    const calledWith = fetcher.mock.calls[0][0] as string
    expect(calledWith).toContain('bjdCode=11680%20%20')
  })
})
