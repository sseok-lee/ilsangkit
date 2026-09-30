import { describe, expect, it } from 'vitest'
import {
  cleanScheduleFromRoute,
  consumeLegacyTrashFromFragment,
  legacyFromFragmentHash,
  parseLegacySchedule,
  readTrashReturnContext,
  sanitizeLegacyTrashFrom,
  sanitizeTrustedTrashReturn,
  storeTrashReturnStateForTarget,
  trashReturnStateFromRoute,
} from '~/utils/trashReturnContext'

describe('trashReturnContext', () => {
  it('parses only safe positive schedule ids', () => {
    expect(parseLegacySchedule('6567')).toBe(6567)
    expect(parseLegacySchedule('0')).toBeNull()
    expect(parseLegacySchedule('1.2')).toBeNull()
    expect(parseLegacySchedule('abc')).toBeNull()
  })

  it('keeps legacy fragment input limited to trash list paths and allowed query keys', () => {
    expect(sanitizeLegacyTrashFrom('/trash?city=서울특별시&district=강남구&schedule=6567&bad=x')).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC')
    expect(sanitizeLegacyTrashFrom('/seoul/gangnam/trash?coverage=unresolved&page=2')).toBe('/seoul/gangnam/trash?coverage=unresolved&page=2')
    expect(sanitizeLegacyTrashFrom('/facilities?category=trash')).toBeNull()
    expect(sanitizeLegacyTrashFrom('https://evil.example/trash?city=서울특별시')).toBeNull()
  })

  it('allows trusted normal navigation from known browse/search routes only through router state', () => {
    expect(sanitizeTrustedTrashReturn('/facilities?city=seoul&district=gangnam&category=trash&q=검증')).toContain('/facilities?')
    expect(sanitizeTrustedTrashReturn('/search?q=검증&category=trash')).toContain('/search?')
    expect(sanitizeTrustedTrashReturn('/trash/areas/101?coverage=unresolved&schedule=901')).toBe('/trash/areas/101?coverage=unresolved')
    expect(sanitizeTrustedTrashReturn('/parking/parking-lifestyle-21')).toBeNull()
  })

  it('stores scroll position in trusted route state for source returns', () => {
    window.scrollTo(0, 720)

    const state = trashReturnStateFromRoute({
      path: '/trash/areas/101',
      fullPath: '/trash/areas/101?coverage=unresolved',
    } as never, '동별 안내로 돌아가기', 901)

    expect(state.ilsangkitTrashReturn).toEqual({
      sourceId: 901,
      context: {
        href: '/trash/areas/101?coverage=unresolved',
        label: '동별 안내로 돌아가기',
        scrollY: 720,
      },
    })
  })


  it('consumes bounded session return state for trash detail targets once', () => {
    const state = {
      ilsangkitTrashReturn: {
        sourceId: null,
        context: {
          href: '/trash?city=서울특별시&district=강남구&page=2',
          label: '목록으로 돌아가기',
          scrollY: 480,
        },
      },
    }

    storeTrashReturnStateForTarget('/trash/areas/101', state)
    window.history.replaceState({ back: '/trash?city=서울특별시&district=강남구&page=2' }, '', '/trash/areas/101')

    expect(readTrashReturnContext(null)).toEqual({
      href: '/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&page=2',
      label: '목록으로 돌아가기',
      scrollY: 480,
    })
    expect(readTrashReturnContext(null)).toEqual({
      href: '/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&page=2',
      label: '목록으로 돌아가기',
    })
  })


  it('refuses stored session return state without matching router back proof', () => {
    const state = {
      ilsangkitTrashReturn: {
        sourceId: null,
        context: { href: '/trash?page=2', label: '목록으로 돌아가기', scrollY: 480 },
      },
    }

    storeTrashReturnStateForTarget('/trash/areas/101', state)
    window.history.replaceState({ back: '/search?q=trash' }, '', '/trash/areas/101')

    expect(readTrashReturnContext(null)).toEqual({
      href: '/search?q=trash',
      label: '목록으로 돌아가기',
    })
  })

  it('refuses session return state for non-trash detail targets', () => {
    const state = {
      ilsangkitTrashReturn: {
        sourceId: null,
        context: { href: '/trash', label: '목록으로 돌아가기', scrollY: 12 },
      },
    }

    storeTrashReturnStateForTarget('/parking/101', state)
    window.history.replaceState({}, '', '/parking/101')

    expect(readTrashReturnContext(null)).toBeNull()
  })

  it('strips schedule before building a legacy return URL', () => {
    expect(cleanScheduleFromRoute({
      path: '/trash',
      query: { city: '서울특별시', district: '강남구', schedule: '6567' },
    } as never)).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC')
  })

  it('decodes #from only after the same trash allowlist', () => {
    expect(legacyFromFragmentHash(`#from=${encodeURIComponent('/trash?city=서울특별시&schedule=1')}`)).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C')
    expect(legacyFromFragmentHash(`#from=${encodeURIComponent('/facilities?category=trash')}`)).toBeNull()
  })


  it('uses trusted router back state when a source page is reached by normal navigation', () => {
    window.history.replaceState({ back: '/trash/areas/101?coverage=unresolved&schedule=901' }, '', '/trash/901')

    expect(readTrashReturnContext(901)).toEqual({
      href: '/trash/areas/101?coverage=unresolved',
      label: '동별 안내로 돌아가기',
    })
  })

  it('does not use router back state while an untrusted fragment is present', () => {
    window.history.replaceState({ back: '/trash/areas/101' }, '', `/trash/901#from=${encodeURIComponent('/facilities?category=trash')}`)

    expect(readTrashReturnContext(901)).toBeNull()
  })


  it('does not reuse stored session return state after an untrusted legacy fragment', () => {
    storeTrashReturnStateForTarget('/trash/901', {
      ilsangkitTrashReturn: {
        sourceId: 901,
        context: { href: '/trash/areas/101', label: '동별 안내로 돌아가기', scrollY: 300 },
      },
    })
    window.history.replaceState({}, '', `/trash/901#from=${encodeURIComponent('https://evil.test/trash')}`)

    expect(consumeLegacyTrashFromFragment(901, '목록으로 돌아가기')).toBeNull()
    expect(readTrashReturnContext(901)).toBeNull()
  })

  it('strips untrusted legacy fragments without storing a return context', () => {
    window.history.replaceState({}, '', `/trash/901#from=${encodeURIComponent('https://evil.test/trash')}`)

    expect(consumeLegacyTrashFromFragment(901, '목록으로 돌아가기')).toBeNull()
    expect(window.location.hash).toBe('')
    expect(readTrashReturnContext(901)).toBeNull()
  })
})
