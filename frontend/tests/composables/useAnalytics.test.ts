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

  it('useAnalytics()가 모든 트래킹 함수를 반환한다', () => {
    const analytics = useAnalytics()
    expect(typeof analytics.trackSearch).toBe('function')
    expect(typeof analytics.trackFacilityView).toBe('function')
    expect(typeof analytics.trackDirectionsClick).toBe('function')
    expect(typeof analytics.trackPhoneClick).toBe('function')
    expect(typeof analytics.trackShareClick).toBe('function')
    expect(typeof analytics.trackBuildingView).toBe('function')
    expect(typeof analytics.trackReviewSubmit).toBe('function')
    expect(Object.keys(analytics)).toHaveLength(7)
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
    trackDirectionsClick({ facilityId: '123', category: 'hospital', provider: 'kakao' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'directions_clicked', {
      facility_id: '123',
      category: 'hospital',
      provider: 'kakao',
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

  it('trackShareClick → gtag share_clicked 이벤트 호출', () => {
    const { trackShareClick } = useAnalytics()
    trackShareClick({ contentType: 'facility', contentId: '123', method: 'native' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'share_clicked', {
      content_type: 'facility',
      content_id: '123',
      method: 'native',
    })
  })

  it('trackBuildingView → gtag building_viewed 이벤트 호출', () => {
    const { trackBuildingView } = useAnalytics()
    trackBuildingView({ propertyType: 'apt', buildingName: '래미안', city: '서울특별시', district: '강남구' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'building_viewed', {
      property_type: 'apt',
      building_name: '래미안',
      city: '서울특별시',
      district: '강남구',
    })
  })

  it('trackReviewSubmit → gtag review_submitted 이벤트 호출', () => {
    const { trackReviewSubmit } = useAnalytics()
    trackReviewSubmit({ facilityId: '123', category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'review_submitted', {
      facility_id: '123',
      category: 'hospital',
    })
  })

  it('window.gtag 미정의(SSR) 시 에러 없이 no-op', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('gtag', undefined)
    const { trackSearch } = useAnalytics()
    expect(() => trackSearch({ keyword: '병원' })).not.toThrow()
  })

  it('window.gtag 미로드(GA_ID 없음) 시 graceful skip', () => {
    vi.unstubAllGlobals()
    const { trackFacilityView } = useAnalytics()
    expect(() =>
      trackFacilityView({ facilityId: '123', category: 'hospital', name: '서울병원' })
    ).not.toThrow()
    expect(mockGtag).not.toHaveBeenCalled()
  })
})
