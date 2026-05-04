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
    expect(typeof analytics.trackSearchNoResults).toBe('function')
    expect(typeof analytics.trackSearchResultsView).toBe('function')
    expect(typeof analytics.trackSearchResultClick).toBe('function')
    expect(typeof analytics.trackCategoryPageView).toBe('function')
    expect(typeof analytics.trackRegionPageView).toBe('function')
    expect(typeof analytics.trackFacilityView).toBe('function')
    expect(typeof analytics.trackDirectionsClick).toBe('function')
    expect(typeof analytics.trackPhoneClick).toBe('function')
    expect(typeof analytics.trackShareClick).toBe('function')
    expect(typeof analytics.trackBuildingView).toBe('function')
    expect(typeof analytics.trackReviewSubmit).toBe('function')
    expect(typeof analytics.trackSubscriptionListView).toBe('function')
    expect(typeof analytics.trackSubscriptionView).toBe('function')
    expect(typeof analytics.trackSubscriptionApplyClick).toBe('function')
    expect(typeof analytics.trackGuideListView).toBe('function')
    expect(typeof analytics.trackGuideView).toBe('function')
    expect(typeof analytics.trackOutboundClick).toBe('function')
    expect(Object.keys(analytics)).toHaveLength(18)
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

  it('trackSearchNoResults → gtag search_no_results 이벤트 호출', () => {
    const { trackSearchNoResults } = useAnalytics()
    trackSearchNoResults({ keyword: '없는시설', category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'search_no_results', {
      search_term: '없는시설',
      category: 'hospital',
    })
  })

  it('trackCategoryPageView → gtag category_page_viewed 이벤트 호출', () => {
    const { trackCategoryPageView } = useAnalytics()
    trackCategoryPageView({ category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'category_page_viewed', {
      category: 'hospital',
    })
  })

  it('trackRegionPageView → gtag region_page_viewed 이벤트 호출 (city+district)', () => {
    const { trackRegionPageView } = useAnalytics()
    trackRegionPageView({ city: 'seoul', district: 'gangnam-gu' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'region_page_viewed', {
      city: 'seoul',
      district: 'gangnam-gu',
    })
  })

  it('trackRegionPageView → district 없이 city만으로 호출 가능', () => {
    const { trackRegionPageView } = useAnalytics()
    trackRegionPageView({ city: 'seoul' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'region_page_viewed', {
      city: 'seoul',
      district: undefined,
    })
  })

  it('trackSearchResultsView → gtag search_results_viewed 이벤트 호출', () => {
    const { trackSearchResultsView } = useAnalytics()
    trackSearchResultsView({ keyword: '병원', resultCount: 12, category: 'hospital' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'search_results_viewed', {
      search_term: '병원',
      result_count: 12,
      category: 'hospital',
    })
  })

  it('trackSubscriptionListView → gtag subscription_list_viewed 이벤트 호출', () => {
    const { trackSubscriptionListView } = useAnalytics()
    trackSubscriptionListView({ listType: 'hub' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'subscription_list_viewed', { list_type: 'hub' })
  })

  it('trackSubscriptionView → gtag subscription_detail_viewed 이벤트 호출', () => {
    const { trackSubscriptionView } = useAnalytics()
    trackSubscriptionView({ subscriptionId: 42, houseName: '래미안', subscriptionType: 'sale' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'subscription_detail_viewed', {
      subscription_id: '42',
      house_name: '래미안',
      subscription_type: 'sale',
    })
  })

  it('trackGuideView → gtag guide_detail_viewed 이벤트 호출', () => {
    const { trackGuideView } = useAnalytics()
    trackGuideView({ slug: 'apt-sale-xxx', category: 'apt-sale', title: '제목' })
    expect(mockGtag).toHaveBeenCalledWith('event', 'guide_detail_viewed', {
      slug: 'apt-sale-xxx',
      category: 'apt-sale',
      title: '제목',
    })
  })

  it('trackGuideListView → gtag guide_list_viewed 이벤트 호출 (params 비움)', () => {
    const { trackGuideListView } = useAnalytics()
    trackGuideListView()
    expect(mockGtag).toHaveBeenCalledWith('event', 'guide_list_viewed', {})
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
