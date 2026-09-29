(function () {
  function isWasteApiCacheUrl(rawUrl) {
    try {
      var url = new URL(rawUrl, self.location && self.location.origin ? self.location.origin : 'https://ilsangkit.co.kr')
      if (!url.pathname.startsWith('/api/')) return false
      if (/^\/api\/(?:waste-areas|waste-schedules)(?:\/|$)/.test(url.pathname)) return true
      if (/^\/api\/facilities\/trash(?:\/|$)/.test(url.pathname)) return true
      if (/^\/api\/facilities\/(?:browse|search|all)(?:\/|$)/.test(url.pathname)) {
        var category = url.searchParams.get('category')
        return category === null || category === '' || category === 'trash'
      }
      var regionMatch = url.pathname.match(/^\/api\/facilities\/region\/[^/]+\/[^/]+(?:\/([^/]+))?\/?$/)
      if (regionMatch) {
        var regionCategory = regionMatch[1]
        return regionCategory === undefined || regionCategory === '' || regionCategory === 'trash'
      }
      return false
    } catch (_err) {
      return false
    }
  }

  self.__ilsangkitIsWasteApiCacheUrl = isWasteApiCacheUrl

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.open('api-cache').then(function (cache) {
        return cache.keys().then(function (requests) {
          return Promise.all(requests.map(function (request) {
            return isWasteApiCacheUrl(request.url) ? cache.delete(request) : Promise.resolve(false)
          }))
        })
      })
    )
  })
}())
