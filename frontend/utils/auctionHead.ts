// frontend/utils/auctionHead.ts
import type { AuctionItem } from '~/types/auction'
import { isAuctionItemIndexable } from '~/types/auction'
import { buildAuctionItemTitle, buildAuctionItemDescription, buildAuctionRegionTitle, buildAuctionRegionDescription } from '~/utils/auctionMeta'
import { SITE_URL } from '~/utils/seoConstants'

type Head = { title: string; meta: Array<Record<string, string>>; link?: Array<Record<string, string>> }

/** og:image + twitter 카드 메타 세트 (네이버/카카오 썸네일). 색인 분기에서만 사용. */
function ogImageMeta(url: string, width: string, height: string, title: string, description: string): Array<Record<string, string>> {
  return [
    { property: 'og:image', content: url },
    { property: 'og:image:width', content: width },
    { property: 'og:image:height', content: height },
    { property: 'og:image:alt', content: title },
    { property: 'og:site_name', content: '일상킷' },
    { property: 'og:locale', content: 'ko_KR' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: url },
  ]
}

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
  if (noindex) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
    return { title, meta }
  }
  // 색인 페이지: 좌표 있으면 네이버 Static Map(/og-map), 없으면 정적 PNG.
  const ogImage = (item.lat && item.lng)
    ? `${SITE_URL}/og-map?lat=${item.lat}&lng=${item.lng}&label=${encodeURIComponent(title)}&category=auction&title=${encodeURIComponent(title)}`
    : `${SITE_URL}/og-image.png`
  const [w, h] = (item.lat && item.lng) ? ['1024', '536'] : ['1200', '630']
  meta.push(...ogImageMeta(ogImage, w, h, title, description))
  return { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
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
  if (o.isIndexable) {
    meta.push({ property: 'og:type', content: 'website' })
    meta.push(...ogImageMeta(`${SITE_URL}/og-image.png`, '1200', '630', title, description))
    return { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
  }
  meta.push({ name: 'robots', content: 'noindex, follow' })
  return { title, meta }
}

export function computeAuctionCityHead(
  o: { city: string; anyIndexable: boolean },
  selfUrl: string
): Head {
  const title = `${o.city} 공매 물건·낙찰가율 | 일상킷`
  const description = `${o.city} 구·군별 부동산 공매 물건과 낙찰가율 통계를 확인하세요. 온비드 공식 데이터 기반.`
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:url', content: selfUrl },
  ]
  if (o.anyIndexable) {
    meta.push({ property: 'og:type', content: 'website' })
    meta.push(...ogImageMeta(`${SITE_URL}/og-image.png`, '1200', '630', title, description))
    return { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
  }
  meta.push({ name: 'robots', content: 'noindex, follow' })
  return { title, meta }
}

export function buildAuctionListTitle(usage: string): string {
  const map: Record<string, string> = { residential: '아파트·주거용', land: '토지', commercial: '상가·업무', industrial: '공장·창고', complex: '복합', etc: '기타' }
  return usage && map[usage] ? `${map[usage]} 공매 물건 | 일상킷` : '부동산 공매 물건 | 일상킷'
}
