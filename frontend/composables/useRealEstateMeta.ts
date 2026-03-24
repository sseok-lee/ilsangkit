// @TASK Phase7-2 - 부동산 SEO 메타 composable

import type { RealEstateCategory, RealEstateType } from '~/types/realEstate'
import { slugToCategory } from '~/types/realEstate'
import { REAL_ESTATE_META, REAL_ESTATE_DESCRIPTIONS } from '~/utils/realEstateMeta'
import { SITE_URL } from '~/utils/seoConstants'

export function useRealEstateMeta() {
  function setRealEstateListMeta(type: RealEstateType, city?: string, district?: string) {
    const category = slugToCategory(type)
    const meta = REAL_ESTATE_META[category]
    const description = REAL_ESTATE_DESCRIPTIONS[category]
    const baseCategory = type.split('-')[0] // apt, villa, offitel

    const locationPrefix = city && district ? `${city} ${district}` : city || ''
    const title = locationPrefix
      ? `${locationPrefix} ${meta.label} 실거래가 | 일상킷`
      : `${meta.label} 실거래가 | 일상킷`

    const ogImage = `${SITE_URL}/og?category=${baseCategory}&title=${encodeURIComponent(title)}`

    useHead({
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
      ],
    })

    useSeoMeta({
      ogImage,
      ogUrl: `${SITE_URL}/real-estate/${type}`,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterImage: ogImage,
    })
  }

  function setRealEstateDetailMeta(
    type: RealEstateType,
    buildingName: string,
    city: string,
    district: string
  ) {
    const category = slugToCategory(type)
    const meta = REAL_ESTATE_META[category]
    const baseCategory = type.split('-')[0]

    const title = `${buildingName} ${meta.label} 실거래가 - ${city} ${district} | 일상킷`
    const description = `${city} ${district} ${buildingName}의 ${meta.label} 실거래가 정보입니다. 최신 거래 내역과 시세 추이를 확인하세요.`
    const ogImage = `${SITE_URL}/og?category=${baseCategory}&title=${encodeURIComponent(buildingName)}`
    const ogUrl = `${SITE_URL}/real-estate/${type}/${encodeURIComponent(buildingName)}`

    useHead({
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
      ],
    })

    useSeoMeta({
      ogImage,
      ogUrl,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterImage: ogImage,
    })
  }

  function getRealEstateJsonLd(
    category: RealEstateCategory,
    buildingName?: string,
    city?: string,
    district?: string
  ) {
    const meta = REAL_ESTATE_META[category]

    return {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: buildingName
        ? `${buildingName} ${meta.label} 실거래가`
        : `${meta.label} 실거래가`,
      description: REAL_ESTATE_DESCRIPTIONS[category],
      creator: {
        '@type': 'Organization',
        name: '국토교통부',
      },
      spatialCoverage: city && district ? `${city} ${district}` : '대한민국',
    }
  }

  return {
    setRealEstateListMeta,
    setRealEstateDetailMeta,
    getRealEstateJsonLd,
  }
}
