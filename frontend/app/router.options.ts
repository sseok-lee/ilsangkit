import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  routes: (_routes) => {
    const validCategories = 'toilet|trash|wifi|clothes|kiosk|parking|aed|library'
    const validCities = 'seoul|busan|daegu|incheon|gwangju|daejeon|ulsan|sejong|gyeonggi|gangwon|chungbuk|chungnam|jeonbuk|jeonnam|gyeongbuk|gyeongnam|jeju'

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
