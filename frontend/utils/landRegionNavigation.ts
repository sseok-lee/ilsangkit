import type { LandRegionListResult } from '~/types/land'

/** Region pickers search the complete candidate set, never only the first page. */
export async function loadLandRegions(getPage: (page: number) => Promise<LandRegionListResult>): Promise<LandRegionListResult> {
  const first = await getPage(1)
  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page++) {
    items.push(...(await getPage(page)).items)
  }
  return { ...first, items }
}

export function landRegionHref(citySlug: string, districtSlug?: string): string {
  return `/real-estate/land/${encodeURIComponent(citySlug)}${districtSlug ? `/${encodeURIComponent(districtSlug)}` : ''}`
}
