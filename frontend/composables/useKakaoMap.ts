import type { FacilitySearchItem } from '~/types/api'

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap
        Marker: new (options: KakaoMarkerOptions) => KakaoMarker
        InfoWindow: new (options: KakaoInfoWindowOptions) => KakaoInfoWindow
        CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay
        event: {
          addListener: (target: unknown, type: string, callback: () => void) => void
        }
      }
    }
  }
}

interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

interface KakaoMapOptions {
  center: KakaoLatLng
  level: number
}

interface KakaoMap {
  getCenter(): KakaoLatLng
  setCenter(latlng: KakaoLatLng): void
  panTo(latlng: KakaoLatLng): void
  setLevel(level: number): void
}

interface KakaoMarkerOptions {
  map?: KakaoMap
  position: KakaoLatLng
  title?: string
}

interface KakaoMarker {
  setMap(map: KakaoMap | null): void
}

interface KakaoInfoWindowOptions {
  content: string
}

interface KakaoInfoWindow {
  open(map: KakaoMap, marker: KakaoMarker): void
  close(): void
}

interface KakaoCustomOverlayOptions {
  map?: KakaoMap
  position: KakaoLatLng
  content: string | HTMLElement
  yAnchor?: number
}

interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
}

interface MapInitOptions {
  center: { lat: number; lng: number }
  level?: number
}

interface MarkerOptions {
  color?: string
  onClick?: (facility: FacilitySearchItem) => void
}

export function useKakaoMap() {
  const config = useRuntimeConfig()
  const map = ref<KakaoMap | null>(null)
  const markers = ref<KakaoMarker[]>([])
  const overlays = ref<KakaoCustomOverlay[]>([])
  const isLoaded = ref(false)

  // Load Kakao Maps SDK
  async function loadKakaoMaps(): Promise<void> {
    if (isLoaded.value) return

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.kakao && window.kakao.maps) {
        isLoaded.value = true
        resolve()
        return
      }

      // Load script
      const script = document.createElement('script')
      const apiKey = config.public.kakaoMapKey || ''
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`
      script.async = true

      script.onload = () => {
        window.kakao.maps.load(() => {
          isLoaded.value = true
          resolve()
        })
      }

      script.onerror = () => {
        reject(new Error('Failed to load Kakao Maps SDK'))
      }

      document.head.appendChild(script)
    })
  }

  // Initialize map
  async function initMap(container: HTMLElement, options: MapInitOptions): Promise<void> {
    await loadKakaoMaps()

    const { center, level = 15 } = options
    const latLng = new window.kakao.maps.LatLng(center.lat, center.lng)

    map.value = new window.kakao.maps.Map(container, {
      center: latLng,
      level
    })
  }

  // Set map center
  function setCenter(lat: number, lng: number): void {
    if (!map.value) return
    const latLng = new window.kakao.maps.LatLng(lat, lng)
    map.value.setCenter(latLng)
  }

  // Pan to position
  function panTo(lat: number, lng: number): void {
    if (!map.value) return
    const latLng = new window.kakao.maps.LatLng(lat, lng)
    map.value.panTo(latLng)
  }

  // Clear all markers
  function clearMarkers(): void {
    markers.value.forEach(marker => marker.setMap(null))
    markers.value = []

    overlays.value.forEach(overlay => overlay.setMap(null))
    overlays.value = []
  }

  // Add markers to map
  function addMarkers(facilities: FacilitySearchItem[], options: MarkerOptions = {}): void {
    if (!map.value) return

    const { color = '#3b82f6', onClick } = options

    facilities.forEach(facility => {
      const position = new window.kakao.maps.LatLng(facility.lat, facility.lng)

      // Create marker
      const marker = new window.kakao.maps.Marker({
        map: map.value!,
        position,
        title: facility.name
      })

      markers.value.push(marker)

      // Create custom overlay for marker content
      const overlayContent = document.createElement('div')
      overlayContent.className = 'kakao-marker-overlay'
      overlayContent.innerHTML = `
        <div class="px-2 py-1 rounded-full text-white text-xs font-medium shadow-md cursor-pointer" style="background-color: ${color};">
          ${facility.name.substring(0, 10)}${facility.name.length > 10 ? '...' : ''}
        </div>
      `

      if (onClick) {
        overlayContent.addEventListener('click', () => onClick(facility))
        window.kakao.maps.event.addListener(marker, 'click', () => onClick(facility))
      }

      const overlay = new window.kakao.maps.CustomOverlay({
        map: map.value!,
        position,
        content: overlayContent,
        yAnchor: 2.5
      })

      overlays.value.push(overlay)
    })
  }

  return {
    map: readonly(map),
    isLoaded: readonly(isLoaded),
    initMap,
    setCenter,
    panTo,
    clearMarkers,
    addMarkers
  }
}
