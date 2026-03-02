import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAnalytics } from '~/composables/useAnalytics'

describe('useAnalytics', () => {
  let mockGtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('useAnalytics()가 4개 함수를 반환한다', () => {
    const analytics = useAnalytics()
    expect(typeof analytics.trackSearch).toBe('function')
    expect(typeof analytics.trackFacilityView).toBe('function')
    expect(typeof analytics.trackDirectionsClick).toBe('function')
    expect(typeof analytics.trackPhoneClick).toBe('function')
  })

  it('trackSearch → gtag search_executed 이벤트 호출', () => {
    const { trackSearch } = useAnalytics()
    trackSearch({ keyword: '병원', category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'search_executed', {
      search_term: '병원',
      category: 'hospital',
    })
  })

  it('trackFacilityView → gtag facility_detail_viewed 이벤트 호출', () => {
    const { trackFacilityView } = useAnalytics()
    trackFacilityView({ facilityId: '123', category: 'hospital', name: '서울병원' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'facility_detail_viewed', {
      facility_id: '123',
      category: 'hospital',
      facility_name: '서울병원',
    })
  })

  it('trackDirectionsClick → gtag directions_clicked 이벤트 호출', () => {
    const { trackDirectionsClick } = useAnalytics()
    trackDirectionsClick({ facilityId: '123', category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'directions_clicked', {
      facility_id: '123',
      category: 'hospital',
    })
  })

  it('trackPhoneClick → gtag phone_clicked 이벤트 호출', () => {
    const { trackPhoneClick } = useAnalytics()
    trackPhoneClick({ facilityId: '123', category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'phone_clicked', {
      facility_id: '123',
      category: 'hospital',
    })
  })

  it('window.gtag 미정의(SSR) 시 에러 없이 no-op', () => {
    vi.unstubAllGlobals()
    // gtag를 undefined로 설정하여 SSR 환경 시뮬레이션
    vi.stubGlobal('gtag', undefined)
    const { trackSearch } = useAnalytics()
    expect(() => trackSearch({ keyword: '병원' })).not.toThrow()
  })

  it('window.gtag 미로드(GA_ID 없음) 시 graceful skip', () => {
    vi.unstubAllGlobals()
    // gtag 없는 상태
    const { trackFacilityView } = useAnalytics()
    expect(() =>
      trackFacilityView({ facilityId: '123', category: 'hospital', name: '서울병원' })
    ).not.toThrow()
    // mockGtag는 이미 unstub되었으므로 호출되지 않아야 함
    expect(mockGtag).not.toHaveBeenCalled()
  })
})
