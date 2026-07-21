import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  routes: (_routes) => {
    const validCategories = 'toilet|trash|wifi|clothes|parking|aed|library|hospital|pharmacy|park|school|market|childcare|ev-charger|sports'
    // ⚠️ shared/regionSlugs.ts CITY_SLUGS 값과 동기 유지 필수(드리프트 시 route 미매칭→404).
    // 2026-07 전남광주통합특별시 정규화: jeonnamgwangju 추가(gwangju/jeonnam는 301 전 유지).
    const validCities = 'seoul|busan|daegu|incheon|gwangju|daejeon|ulsan|sejong|gyeonggi|gangwon|chungbuk|chungnam|jeonbuk|jeonnam|jeonnamgwangju|gyeongbuk|gyeongnam|jeju'

    // [category]/index — /toilet, /wifi 등
    const categoryIndexRoute = _routes.find((r) => r.name === 'category')
    if (categoryIndexRoute) {
      categoryIndexRoute.path = `/:category(${validCategories})`
    }

    // [category]/[id] — /toilet/abc123
    const categoryIdRoute = _routes.find((r) => r.name === 'category-id')
    if (categoryIdRoute) {
      categoryIdRoute.path = `/:category(${validCategories})/:id()`
    }

    // [city] — /seoul, /busan 등
    const cityRoute = _routes.find((r) => r.name === 'city')
    if (cityRoute) {
      cityRoute.path = `/:city(${validCities})`
    }

    // [city]-[district] — /seoul/gangnam
    const cityDistrictRoute = _routes.find((r) => r.name === 'city-district')
    if (cityDistrictRoute) {
      cityDistrictRoute.path = `/:city(${validCities})/:district()`
    }

    // [city]-[district]-[category] — /seoul/gangnam/toilet
    const cityDistrictCategoryRoute = _routes.find((r) => r.name === 'city-district-category')
    if (cityDistrictCategoryRoute) {
      cityDistrictCategoryRoute.path = `/:city(${validCities})/:district()/:category(${validCategories})`
    }

    return _routes
  },
}
