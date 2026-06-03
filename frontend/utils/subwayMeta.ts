import type { SubwayStation } from '~/types/subway'

const SITE_NAME = '일상킷'

export function buildSubwayTitle(station: SubwayStation): string {
  return `${station.name}역 (${station.line}) | ${SITE_NAME}`
}

/** 시/도 풀네임을 압축형으로 (서울특별시 → 서울). 도시명 압축 일관성(R2). */
function compactCityName(city: string): string {
  return String(city).replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
}

export function buildSubwayDescription(station: SubwayStation): string {
  const stationName = station.name.endsWith('역') ? station.name : `${station.name}역`
  const cityCompact = station.city ? compactCityName(station.city) : ''
  const region = [cityCompact, station.district].filter(Boolean).join(' ')

  // 개요 문장
  const regionPart = region ? `${region}의 ` : ''
  let desc = `${stationName}(${station.line})은(는) ${regionPart}지하철역입니다.`

  // 환승 정보
  if (station.transferLines && station.transferLines.length > 0) {
    const transferStr = station.transferLines.join(', ')
    desc += ` ${transferStr} 환승이 가능하며,`
  }

  // CTA
  desc += ' 위치·노선·환승 정보를 확인하세요.'

  return desc
}

interface PlaceJsonLd {
  '@context': string
  '@type': string
  name: string
  address?: {
    '@type': string
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    addressCountry: string
  }
  geo: {
    '@type': string
    latitude: number
    longitude: number
  }
  publicAccess: boolean
  isAccessibleForFree: boolean
  containedInPlace?: {
    '@type': string
    name: string
  }
}

export function buildSubwayJsonLd(station: SubwayStation): PlaceJsonLd {
  const jsonLd: PlaceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TrainStation',
    name: `${station.name}역`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.lat,
      longitude: station.lng,
    },
    publicAccess: true,
    isAccessibleForFree: true,
  }

  if (station.roadAddress || station.city) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
    }
    if (station.roadAddress) jsonLd.address.streetAddress = station.roadAddress
    if (station.district) jsonLd.address.addressLocality = station.district
    if (station.city) jsonLd.address.addressRegion = station.city
  }

  if (station.operator) {
    jsonLd.containedInPlace = {
      '@type': 'Organization',
      name: station.operator,
    }
  }

  return jsonLd
}
