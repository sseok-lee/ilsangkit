import type { SubwayStation } from '~/types/subway'

const SITE_NAME = '일상킷'

export function buildSubwayTitle(station: SubwayStation): string {
  return `${station.name}역 (${station.line}) | ${SITE_NAME}`
}

export function buildSubwayDescription(station: SubwayStation): string {
  const parts: string[] = []
  parts.push(`${station.name}역 ${station.line} 정보`)

  if (station.transferLines.length > 0) {
    parts.push(`환승: ${station.transferLines.join(', ')}`)
  }

  if (station.city && station.district) {
    parts.push(`${station.city} ${station.district}`)
  }

  if (station.operator) {
    parts.push(`운영기관: ${station.operator}`)
  }

  return parts.join(' · ')
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
