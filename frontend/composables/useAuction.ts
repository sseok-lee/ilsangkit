import type {
  AuctionItemsResult, AuctionItemDetailResult, AuctionRegionDetailResult,
  AuctionCityDetailResult, AuctionHubSummary, AuctionAreaSummary,
} from '~/types/auction'
import { useApiBase } from '~/composables/useApiBase'

export function useAuction() {
  const apiBase = useApiBase()
  const q = (obj: Record<string, unknown>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') p.set(k, String(v))
    return p.toString()
  }
  async function getItems(params: { city?: string; district?: string; usage?: string; status?: string; sort?: string; page?: number; limit?: number }): Promise<AuctionItemsResult> {
    const res = await $fetch<{ success: boolean; data: AuctionItemsResult }>(`${apiBase}/api/auction/items?${q(params)}`)
    return res.data
  }
  async function getItemDetail(cltrMngNo: string): Promise<AuctionItemDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionItemDetailResult }>(`${apiBase}/api/auction/item/${encodeURIComponent(cltrMngNo)}`)
    return res.data
  }
  async function getRegionDetail(bjdCode: string): Promise<AuctionRegionDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionRegionDetailResult }>(`${apiBase}/api/auction/region?${q({ bjdCode })}`)
    return res.data
  }
  async function getCityDetail(city: string): Promise<AuctionCityDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionCityDetailResult }>(`${apiBase}/api/auction/city?${q({ city })}`)
    return res.data
  }
  async function getHubSummary(): Promise<AuctionHubSummary> {
    const res = await $fetch<{ success: boolean; data: AuctionHubSummary }>(`${apiBase}/api/auction/hub-summary`)
    return res.data
  }
  async function getRanking(params: { usage?: string; order?: string; limit?: number }): Promise<AuctionAreaSummary[]> {
    const res = await $fetch<{ success: boolean; data: AuctionAreaSummary[] }>(`${apiBase}/api/auction/ranking?${q(params)}`)
    return res.data
  }
  async function getRegions(params: { city?: string; onlyIndexable?: boolean }): Promise<{ items: AuctionAreaSummary[] }> {
    const res = await $fetch<{ success: boolean; data: { items: AuctionAreaSummary[] } }>(`${apiBase}/api/auction/regions?${q(params)}`)
    return res.data
  }
  return { getItems, getItemDetail, getRegionDetail, getCityDetail, getHubSummary, getRanking, getRegions }
}
