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

function trackReviewSubmit(params: { facilityId: string; category: string }) {
  track(ANALYTICS_EVENTS.REVIEW_SUBMIT, {
    facility_id: params.facilityId,
    category: params.category,
  })
}

export function useAnalytics() {
  return {
    trackSearch,
    trackFacilityView,
    trackDirectionsClick,
    trackPhoneClick,
    trackShareClick,
    trackBuildingView,
    trackReviewSubmit,
  }
}
