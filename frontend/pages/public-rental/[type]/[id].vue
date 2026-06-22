<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

      <PublicRentalDetailView
        v-if="rental"
        :rental="rental"
        :siblings="siblings"
        :nearby="nearby"
        :last-sync-date="rental.updatedAt ? formatKstDate(rental.updatedAt) : null"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { SITE_URL } from '~/utils/seoConstants'
import { LH_RENTAL_TYPES, type LhRentalTypeKey } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useApiBase } from '~/composables/useApiBase'
import { fmtDeposit, fmtRent, isJeonseRental, rentalTypeToSlug } from '~/utils/publicRentalMeta'
import { formatKstDate } from '~/utils/formatters'
import { PUBLIC_RENTAL_FAQ } from '~/utils/publicRentalContent'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PublicRentalDetailView from '~/components/subscription/PublicRentalDetailView.vue'
import type { PublicRentalComplex } from '~/types/publicRental'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

const route = useRoute()
const typeParam = route.params.type as string
const idParam = Number(route.params.id)

const typeMeta = LH_RENTAL_TYPES[typeParam as LhRentalTypeKey]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 공공임대 카테고리입니다' })
}

if (!Number.isFinite(idParam) || idParam <= 0) {
  throw createError({ statusCode: 404, statusMessage: '올바르지 않은 매물 ID입니다' })
}

const apiBase = useApiBase()

const { data } = await useAsyncData(
  `public-rental-detail-${typeParam}-${idParam}`,
  async () => {
    const detailRes = await $fetch<ApiEnvelope<PublicRentalComplex>>(
      `${apiBase}/api/public-rental/${idParam}`,
    ).catch(() => null)

    if (!detailRes || !detailRes.success || !detailRes.data) {
      return null
    }

    const [siblingsRes, nearbyRes] = await Promise.all([
      $fetch<ApiEnvelope<PublicRentalComplex[]>>(
        `${apiBase}/api/public-rental/${idParam}/siblings`,
      ).catch(() => ({ success: false, data: [] as PublicRentalComplex[] })),
      $fetch<ApiEnvelope<PublicRentalComplex[]>>(
        `${apiBase}/api/public-rental/${idParam}/nearby`,
      ).catch(() => ({ success: false, data: [] as PublicRentalComplex[] })),
    ])

    return {
      rental: detailRes.data,
      siblings: siblingsRes.success ? siblingsRes.data : [],
      nearby: nearbyRes.success ? nearbyRes.data : [],
    }
  },
)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 공공임대 매물입니다' })
}

const rental = computed(() => data.value?.rental ?? null)
const siblings = computed(() => data.value?.siblings ?? [])
const nearby = computed(() => data.value?.nearby ?? [])

const canonicalSlug = computed<LhRentalTypeKey>(() => {
  const r = rental.value
  if (!r) return typeParam as LhRentalTypeKey
  return rentalTypeToSlug(r.rentalType) ?? (typeParam as LhRentalTypeKey)
})

const canonicalUrl = computed(() => {
  if (!rental.value) return `${SITE_URL}/public-rental`
  return `${SITE_URL}/public-rental/${canonicalSlug.value}/${rental.value.id}`
})

const displayName = computed(() => {
  const r = rental.value
  if (!r) return ''
  return r.complexNameKor && r.complexNameKor.trim()
    ? r.complexNameKor
    : `${r.city} ${r.district} ${r.rentalType}`
})

const cityShort = computed(() => {
  if (!rental.value) return ''
  return rental.value.city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
})

const seoDescription = computed(() => {
  const r = rental.value
  if (!r) return typeMeta.description
  const isJeonse = isJeonseRental(r.monthlyRent)
  const depositText = fmtDeposit(r.depositAmount)
  const rentText = fmtRent(r.monthlyRent, isJeonse)
  const region = `${cityShort.value} ${r.district}`.trim()
  const houseTypePart = r.houseType ? ` ${r.houseType}` : ''
  const areaPart = r.exclusiveArea ? ` 전용 ${r.exclusiveArea}㎡` : ''
  if (isJeonse) {
    return `${region} ${displayName.value} ${r.rentalType}${houseTypePart}${areaPart} 매물. 전세보증금 ${depositText}. 청약통장 없이 자격만 맞으면 신청할 수 있는 LH·SH 공공임대입니다.`
  }
  return `${region} ${displayName.value} ${r.rentalType}${houseTypePart}${areaPart} 매물. 보증금 ${depositText}, 월 임대료 ${rentText}. 청약통장 없이 자격만 맞으면 신청할 수 있는 LH·SH 공공임대입니다.`
})

const ogImageUrl = computed(() => {
  const r = rental.value
  if (!r?.lat || !r?.lng) return null
  return `${SITE_URL}/og-map?lat=${r.lat}&lng=${r.lng}&label=${encodeURIComponent(displayName.value)}&category=public-rental&title=${encodeURIComponent(displayName.value)}`
})
const hasMapImage = computed(() => ogImageUrl.value !== null)

const { setMeta } = useFacilityMeta()

function applyDetailMeta() {
  setMeta({
    title: `${displayName.value} ${rental.value?.rentalType ?? ''}`.trim(),
    description: seoDescription.value,
    path: `/public-rental/${typeParam}/${idParam}`,
    canonical: canonicalUrl.value,
    image: hasMapImage.value ? (ogImageUrl.value ?? undefined) : undefined,
    imageWidth: hasMapImage.value ? 1024 : undefined,
    imageHeight: hasMapImage.value ? 536 : undefined,
  })
}

applyDetailMeta()

watch([displayName, seoDescription, canonicalUrl, hasMapImage], () => {
  applyDetailMeta()
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '공공임대', href: '/public-rental', current: false },
  { label: typeMeta.label, href: `/public-rental/${canonicalSlug.value}`, current: false },
  { label: displayName.value, href: canonicalUrl.value, current: true },
])

const { setBreadcrumbSchema, setFAQSchema, setDetailProvenance } = useStructuredData()

setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '공공임대', url: `${SITE_URL}/public-rental` },
  { name: typeMeta.label, url: `${SITE_URL}/public-rental/${canonicalSlug.value}` },
  { name: displayName.value, url: canonicalUrl.value },
])

setFAQSchema(PUBLIC_RENTAL_FAQ)

setDetailProvenance({
  domain: 'public-rental',
  path: `/public-rental/${typeParam}/${idParam}`,
  description: `${rental.value?.complexNameKor ?? '공공임대'} 공급 정보 (LH·SH 공공데이터 기반)`,
  updatedAt: rental.value?.updatedAt ?? null,
})
</script>
