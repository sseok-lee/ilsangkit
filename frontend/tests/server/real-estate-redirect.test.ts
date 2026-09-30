import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bjdCache,
  resolveBjdCode,
  resolveIncheonReorgRedirect,
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
    const result = (await resolveBjdCode('11680', fetcher)) as BjdLookupResult
    expect(result.cityFullName).toBe('서울특별시')
    expect(result.districtName).toBe('강남구')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // 두 번째 호출은 캐시에서 반환
    const cached = await resolveBjdCode('11680', fetcher)
    expect(cached).toEqual(result)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns null when fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network'))
    const result = await resolveBjdCode('11680', fetcher)
    expect(result).toBeNull()
  })

  it('returns null when response lacks city/district', async () => {
    const fetcher = vi.fn().mockResolvedValue({ success: false })
    const result = await resolveBjdCode('11680', fetcher)
    expect(result).toBeNull()
  })

  it('returns null when bjdCode is empty', async () => {
    const fetcher = vi.fn()
    const result = await resolveBjdCode('', fetcher)
    expect(result).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('encodes bjdCode safely into the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      data: { city: '서울특별시', district: '강남구' },
    })
    await resolveBjdCode('11680  ', fetcher)
    const calledWith = fetcher.mock.calls[0][0] as string
    expect(calledWith).toContain('bjdCode=11680%20%20')
  })
})


describe('resolveIncheonReorgRedirect canonical URL preservation', () => {
  it('uses preserved resolver canonicalPath before constructing an explicit buildingKey URL', async () => {
    const canonical = '/real-estate/apt-sale/incheon/geomdan/%EA%B2%80%EB%8B%A8%EC%95%84%ED%8C%8C%ED%8A%B8/readable-address'
    const fetcher = vi.fn(async (path: string) => {
      if (path.startsWith('/api/real-estate/resolve-url')) {
        return { success: true, data: { mode: 'preserved', canonicalPath: canonical, redirect: true } }
      }
      throw new Error(`unexpected fetch: ${path}`)
    })

    await expect(resolveIncheonReorgRedirect(
      `/real-estate/apt-sale/incheon/seo/%EA%B2%80%EB%8B%A8%EC%95%84%ED%8C%8C%ED%8A%B8/${'a'.repeat(64)}`,
      fetcher,
    )).resolves.toEqual({ redirect: canonical })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain('/api/real-estate/resolve-url')
  })

  it('does not treat a readable suffix as an internal buildingKey', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.startsWith('/api/real-estate/resolve-url')) {
        return { success: true, data: { mode: 'keyed', canonicalPath: null } }
      }
      if (path.startsWith('/api/real-estate/apt-sale/complexes')) {
        return { success: true, data: { items: [{ district: '검단구', buildingName: '검단아파트' }] } }
      }
      throw new Error(`unexpected fetch: ${path}`)
    })

    await expect(resolveIncheonReorgRedirect(
      '/real-estate/apt-sale/incheon/seo/%EA%B2%80%EB%8B%A8%EC%95%84%ED%8C%8C%ED%8A%B8/readable-address',
      fetcher,
    )).resolves.toEqual({ notFound: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps a registry-owned canonical even when its district is a legacy slug', async () => {
    const path = '/real-estate/apt-sale/incheon/seo/owner'
    const fetcher = vi.fn().mockResolvedValue({
      success: true, data: { mode: 'preserved', canonicalPath: path, redirect: false },
    })
    await expect(resolveIncheonReorgRedirect(path, fetcher)).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([404, 503])('leaves resolver %s to detail handling without guessing by name', async (statusCode) => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.startsWith('/api/real-estate/resolve-url')) throw { statusCode }
      return { success: true, data: { items: [{ district: '검단구', buildingName: 'owner' }] } }
    })
    await expect(resolveIncheonReorgRedirect('/real-estate/apt-sale/incheon/seo/owner', fetcher)).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
