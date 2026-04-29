import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useRegionStore } from '~/stores/region'

const STORAGE_KEY = 'ilsangkit_user_region'

function createMemoryStorage(): Storage {
  let data: Record<string, string> = {}
  return {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v)
    },
    removeItem: (k: string) => {
      delete data[k]
    },
    clear: () => {
      data = {}
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  } as Storage
}

describe('region store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  })

  it('기본 상태에서 isSet=false, radiusMeters=5000', () => {
    const store = useRegionStore()
    expect(store.citySlug).toBeNull()
    expect(store.districtSlug).toBeNull()
    expect(store.dong).toBeNull()
    expect(store.isSet).toBe(false)
    expect(store.radiusMeters).toBe(5000)
    expect(store.label).toBe('')
  })

  it('setRegion 호출 시 상태 업데이트 + localStorage 저장', () => {
    const store = useRegionStore()
    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo' })

    expect(store.citySlug).toBe('seoul')
    expect(store.districtSlug).toBe('mapo')
    expect(store.dong).toBeNull()
    expect(store.isSet).toBe(true)
    expect(store.setAt).toBeGreaterThan(0)

    const raw = window.localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.citySlug).toBe('seoul')
    expect(parsed.districtSlug).toBe('mapo')
  })

  it('dong 설정 시 radiusMeters=1500, label에 동 포함', () => {
    const store = useRegionStore()
    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo', dong: '상암동' })

    expect(store.dong).toBe('상암동')
    expect(store.radiusMeters).toBe(1500)
    expect(store.label).toBe('mapo 상암동')
  })

  it('hydrateFromStorage가 localStorage에서 복원', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        citySlug: 'seoul',
        districtSlug: 'mapo',
        dong: '상암동',
        setAt: 1700000000000,
      })
    )

    const store = useRegionStore()
    store.hydrateFromStorage()

    expect(store.citySlug).toBe('seoul')
    expect(store.districtSlug).toBe('mapo')
    expect(store.dong).toBe('상암동')
    expect(store.setAt).toBe(1700000000000)
  })

  it('손상된 localStorage 값은 안전하게 무시', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json')

    const store = useRegionStore()
    store.hydrateFromStorage()

    expect(store.citySlug).toBeNull()
    expect(store.isSet).toBe(false)
  })

  it('clearRegion이 상태와 localStorage 모두 초기화', () => {
    const store = useRegionStore()
    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo', dong: '상암동' })

    store.clearRegion()

    expect(store.citySlug).toBeNull()
    expect(store.districtSlug).toBeNull()
    expect(store.dong).toBeNull()
    expect(store.isSet).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('dong 없이 setRegion 호출하면 dong이 null로 초기화', () => {
    const store = useRegionStore()
    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo', dong: '상암동' })
    expect(store.dong).toBe('상암동')

    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo' })
    expect(store.dong).toBeNull()
    expect(store.radiusMeters).toBe(5000)
  })
})
