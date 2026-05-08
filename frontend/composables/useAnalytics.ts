import { ANALYTICS_EVENTS } from '~/utils/analyticsConstants'

function track(eventName: string, params: Record<string, string | number | boolean | undefined>) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', eventName, params)
}

function trackSearch(params: { keyword?: string; category?: string }) {
  track(ANALYTICS_EVENTS.SEARCH, {
    search_term: params.keyword,
    category: params.category,
  })
}

function trackFacilityView(params: { facilityId: string; category: string; name: string }) {
  track(ANALYTICS_EVENTS.FACILITY_VIEW, {
    facility_id: params.facilityId,
    category: params.category,
    facility_name: params.name,
  })
}

function trackDirectionsClick(params: { facilityId: string; category: string; provider?: string }) {
  track(ANALYTICS_EVENTS.DIRECTIONS, {
    facility_id: params.facilityId,
    category: params.category,
    provider: params.provider,
  })
}

function trackPhoneClick(params: { facilityId: string; category: string }) {
  track(ANALYTICS_EVENTS.PHONE, {
    facility_id: params.facilityId,
    category: params.category,
  })
}

function trackShareClick(params: { contentType: string; contentId: string; method?: string }) {
  track(ANALYTICS_EVENTS.SHARE, {
    content_type: params.contentType,
    content_id: params.contentId,
    method: params.method,
  })
}

function trackBuildingView(params: { propertyType: string; buildingName: string; city?: string; district?: string }) {
  track(ANALYTICS_EVENTS.BUILDING_VIEW, {
    property_type: params.propertyType,
    building_name: params.buildingName,
    city: params.city,
    district: params.district,
  })
}

function trackCategoryPageView(params: { category: string }) {
  track(ANALYTICS_EVENTS.CATEGORY_PAGE_VIEW, { category: params.category })
}

function trackRegionPageView(params: { city: string; district?: string }) {
  track(ANALYTICS_EVENTS.REGION_PAGE_VIEW, { city: params.city, district: params.district })
}

function trackSearchNoResults(params: { keyword: string; category?: string }) {
  track(ANALYTICS_EVENTS.SEARCH_NO_RESULTS, { search_term: params.keyword, category: params.category })
}

function trackSearchResultsView(params: { keyword: string; resultCount: number; category?: string }) {
  track(ANALYTICS_EVENTS.SEARCH_RESULTS_VIEW, {
    search_term: params.keyword,
    result_count: params.resultCount,
    category: params.category,
  })
}

function trackSearchResultClick(params: { keyword: string; position: number; resultType: string; resultId?: string }) {
  track(ANALYTICS_EVENTS.SEARCH_RESULT_CLICK, {
    search_term: params.keyword,
    position: params.position,
    result_type: params.resultType,
    result_id: params.resultId,
  })
}

function trackSubscriptionListView(params: { listType: string }) {
  track(ANALYTICS_EVENTS.SUBSCRIPTION_LIST_VIEW, { list_type: params.listType })
}

function trackSubscriptionView(params: { subscriptionId: string | number; houseName?: string; subscriptionType?: string }) {
  track(ANALYTICS_EVENTS.SUBSCRIPTION_VIEW, {
    subscription_id: String(params.subscriptionId),
    house_name: params.houseName,
    subscription_type: params.subscriptionType,
  })
}

function trackSubscriptionApplyClick(params: { subscriptionId: string | number; provider?: string }) {
  track(ANALYTICS_EVENTS.SUBSCRIPTION_APPLY_CLICK, {
    subscription_id: String(params.subscriptionId),
    provider: params.provider,
  })
}

function trackGuideListView() {
  track(ANALYTICS_EVENTS.GUIDE_LIST_VIEW, {})
}

function trackGuideView(params: { slug: string; category?: string; title?: string }) {
  track(ANALYTICS_EVENTS.GUIDE_VIEW, {
    slug: params.slug,
    category: params.category,
    title: params.title,
  })
}

function trackOutboundClick(params: { url: string; linkType: string; placement?: string }) {
  track(ANALYTICS_EVENTS.OUTBOUND_CLICK, {
    outbound_url: params.url,
    link_type: params.linkType,
    placement: params.placement,
  })
}

export function useAnalytics() {
  return {
    trackSearch,
    trackSearchNoResults,
    trackSearchResultsView,
    trackSearchResultClick,
    trackCategoryPageView,
    trackRegionPageView,
    trackFacilityView,
    trackDirectionsClick,
    trackPhoneClick,
    trackShareClick,
    trackBuildingView,
    trackSubscriptionListView,
    trackSubscriptionView,
    trackSubscriptionApplyClick,
    trackGuideListView,
    trackGuideView,
    trackOutboundClick,
  }
}
