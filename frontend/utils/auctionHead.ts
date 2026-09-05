// frontend/utils/auctionHead.ts
import type { AuctionItem } from '~/types/auction'
import { isAuctionItemIndexable } from '~/types/auction'
import { buildAuctionItemTitle, buildAuctionItemDescription, buildAuctionRegionTitle, buildAuctionRegionDescription } from '~/utils/auctionMeta'
import { OG_MAP_WIDTH, OG_MAP_HEIGHT } from '~/utils/ogMapSpec'
import { buildOgMapImageUrl, staticOgImageUrl } from '~/utils/ogImageUrl'

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
  // 조립은 공용 빌더 한곳에서만 한다 — 예전엔 물건명을 label 과 title 에 두 번, 자르지도 않고
  // 실었다(라우트는 title 을 읽지 않는다). 프로덕션 형태의 공매 og-map URL 이 실측 2,004자였다.
  const ogImage = buildOgMapImageUrl({ lat: item.lat, lng: item.lng, label: title, category: 'auction' })
  // og-map 규격은 라우트와 같은 상수를 쓴다(ogMapSpec). 정적 PNG 로 떨어지면 1200x630.
  const [w, h] = ogImage === staticOgImageUrl()
    ? ['1200', '630']
    : [String(OG_MAP_WIDTH), String(OG_MAP_HEIGHT)]
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
    meta.push(...ogImageMeta(staticOgImageUrl(), '1200', '630', title, description))
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
    meta.push(...ogImageMeta(staticOgImageUrl(), '1200', '630', title, description))
    return { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
  }
  meta.push({ name: 'robots', content: 'noindex, follow' })
  return { title, meta }
}

const LIST_USAGE_LABEL: Record<string, string> = {
  residential: '아파트·주거용',
  land: '토지',
  commercial: '상가·업무',
  industrial: '공장·창고',
  complex: '복합',
  etc: '기타',
}

/**
 * 목록 페이지의 화면 제목(H1). 사이트명 suffix 를 붙이지 않는다.
 * ⚠️ PageHero 등 화면 제목엔 반드시 이 쪽을 쓸 것 —
 *    buildAuctionListTitle 을 H1 에 재사용하면 "… | 일상킷" 이 그대로 노출된다.
 */
export function buildAuctionListHeading(usage: string): string {
  const label = usage ? LIST_USAGE_LABEL[usage] : undefined
  return label ? `${label} 공매 물건` : '부동산 공매 물건'
}

/** 목록 페이지의 <title>. 헤딩에 사이트명을 붙인 형태. */
export function buildAuctionListTitle(usage: string): string {
  return `${buildAuctionListHeading(usage)} | 일상킷`
}
