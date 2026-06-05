// frontend/utils/auctionHead.ts
import type { AuctionItem } from '~/types/auction'
import { isAuctionItemIndexable } from '~/types/auction'
import { buildAuctionItemTitle, buildAuctionItemDescription, buildAuctionRegionTitle, buildAuctionRegionDescription } from '~/utils/auctionMeta'

type Head = { title: string; meta: Array<Record<string, string>>; link?: Array<Record<string, string>> }

export function computeAuctionItemHead(item: AuctionItem, selfUrl: string): Head {
  const title = buildAuctionItemTitle(item)
  const description = buildAuctionItemDescription(item)
  const noindex = !isAuctionItemIndexable(item)
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl },
    { property: 'og:type', content: 'website' },
  ]
  if (noindex) meta.push({ name: 'robots', content: 'noindex, follow' })
  return noindex ? { title, meta } : { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
}

export function computeAuctionRegionHead(
  o: { city: string; district: string; isIndexable: boolean; avgBidRate: number | null; activeCount: number },
  selfUrl: string
): Head {
  const title = buildAuctionRegionTitle({ city: o.city, district: o.district })
  const description = buildAuctionRegionDescription({ city: o.city, district: o.district, avgBidRate: o.avgBidRate, activeCount: o.activeCount })
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl },
  ]
  if (!o.isIndexable) meta.push({ name: 'robots', content: 'noindex, follow' })
  return o.isIndexable ? { title, meta, link: [{ rel: 'canonical', href: selfUrl }] } : { title, meta }
}

export function buildAuctionListTitle(usage: string): string {
  const map: Record<string, string> = { residential: '아파트·주거용', land: '토지', commercial: '상가·업무', industrial: '공장·창고' }
  return usage && map[usage] ? `${map[usage]} 공매 물건 | 일상킷` : '부동산 공매 물건 | 일상킷'
}
