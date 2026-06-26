export interface NearbyStation {
  id: string
  name: string
  nameSlug: string
  line: string
  distance: number
  type: 'subway'
}

export async function fetchTransitNearby(
  apiBase: string,
  lat: number,
  lng: number,
  radius = 2000,
): Promise<NearbyStation[]> {
  try {
    const res = await $fetch<{ success: boolean; data: { stations: NearbyStation[] } }>(
      `${apiBase}/api/transit/nearby`,
      { query: { lat, lng, radius } },
    )
    return res?.data?.stations ?? []
  } catch {
    return []
  }
}
