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

function trackDirectionsClick(params: { facilityId: string; category: string }) {
  track(ANALYTICS_EVENTS.DIRECTIONS, {
    facility_id: params.facilityId,
    category: params.category,
  })
}

function trackPhoneClick(params: { facilityId: string; category: string }) {
  track(ANALYTICS_EVENTS.PHONE, {
    facility_id: params.facilityId,
    category: params.category,
  })
}

export function useAnalytics() {
  return { trackSearch, trackFacilityView, trackDirectionsClick, trackPhoneClick }
}
