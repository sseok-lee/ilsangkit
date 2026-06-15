<template>
  <div class="flex flex-col gap-3">
    <MobileDetailHeader
      :title="displayName"
      :eyebrow="`${rental.rentalType}${rental.houseType ? ` · ${rental.houseType}` : ''}`"
      :stats="mobileHeaderStats"
      :hide-directions="!hasCoords"
      :kakao-map-url="kakaoMapUrl"
      :naver-map-url="naverMapUrl"
      @share="handleShare"
      @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
    />

    <PublicRentalDetailHeader :rental="rental" />

    <!-- T1: 가격 카드 + 스펙 그리드 (이 URL 고유 핵심 데이터) -->
    <PublicRentalPriceCard :rental="rental" class="order-2 md:order-2" />

    <PublicRentalSpecGrid :rental="rental" class="order-3 md:order-3" />

    <!-- Ad①: T1 직후 고가시성 (청약 패턴 1번) -->
    <AdBanner class="order-4 md:order-4" />

    <!-- T2: 위치·로드뷰 -->
    <SectionBlock heading="위치" :subtext="locationSubtext" class="order-5 md:order-5">
      <div v-if="hasCoords" class="rounded-xl border border-line overflow-hidden h-[300px] md:h-[360px]">
        <ClientOnly>
          <FacilityMap
            :center="{ lat: rental.lat as number, lng: rental.lng as number }"
            :facilities="markerFacility"
            :level="3"
          />
        </ClientOnly>
      </div>
      <div v-else class="rounded-xl bg-background-light p-8 text-center">
        <p class="text-muted text-sm">이 단지는 좌표 정보가 등록되지 않아 지도를 표시할 수 없습니다.</p>
        <p class="mt-1 text-faint text-xs">{{ rental.complexName }}</p>
      </div>
    </SectionBlock>

    <!-- T3: 교육형 콘텐츠 (공유 템플릿) — 임대유형 가이드 → 광고② → 자격 → 신청 -->
    <PublicRentalRentalTypeGuide :rental-type="rental.rentalType" class="order-6 md:order-6" />

    <!-- Ad②: 교육형 T3 콘텐츠 사이로 이동 (위치 직후 → 한 칸 뒤, 청약 패턴 2번) -->
    <AdBanner class="order-7 md:order-7" />

    <PublicRentalEligibility class="order-8 md:order-8" />

    <PublicRentalApplyGuide class="order-9 md:order-9" />

    <!-- T4: 관련·탐색 — 주변 생활시설 → 인근 단지 → 형제(같은 단지) -->
    <SectionBlock heading="주변 생활시설" subtext="단지 반경 1km 이내의 학교·병원·약국·공원 등을 확인하세요." class="order-10 md:order-10">
      <NearbyFacilities v-if="hasCoords" :lat="rental.lat as number" :lng="rental.lng as number" />
      <div v-else class="rounded-xl bg-background-light p-6 text-center text-muted text-sm">
        좌표 정보가 등록되어 있지 않아 주변 생활시설을 표시할 수 없습니다. 단지 주소를 참고하여 직접 확인해 주세요.
      </div>
    </SectionBlock>

    <PublicRentalNearbyComplexes
      :complexes="nearby"
      :city="rental.city"
      :district="rental.district"
      class="order-10 md:order-10"
    />

    <PublicRentalSiblings :siblings="siblings" class="order-10 md:order-10" />

    <!-- T5: FAQ (FAQPage JSON-LD는 라우트 페이지 setFAQSchema에서 발행) -->
    <PublicRentalFAQ class="order-11 md:order-11" />

    <!-- Ad③: 본문 마무리 (청약 패턴 3번) -->
    <AdBanner class="order-11 md:order-11" />

    <!-- T6: 데이터 출처 — 멀티루트 가능성 → wrapper div에 order (spec §3.3·④) -->
    <div class="order-12 md:order-12">
      <DataSourceSection domain="public-rental" :last-sync-date="lastSyncDate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import type { FacilitySearchItem } from '~/types'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'
import PublicRentalDetailHeader from '~/components/subscription/PublicRentalDetailHeader.vue'
import PublicRentalPriceCard from '~/components/subscription/PublicRentalPriceCard.vue'
import PublicRentalSpecGrid from '~/components/subscription/PublicRentalSpecGrid.vue'
import PublicRentalSiblings from '~/components/subscription/PublicRentalSiblings.vue'
import PublicRentalRentalTypeGuide from '~/components/subscription/PublicRentalRentalTypeGuide.vue'
import PublicRentalEligibility from '~/components/subscription/PublicRentalEligibility.vue'
import PublicRentalApplyGuide from '~/components/subscription/PublicRentalApplyGuide.vue'
import PublicRentalFAQ from '~/components/subscription/PublicRentalFAQ.vue'
import PublicRentalNearbyComplexes from '~/components/subscription/PublicRentalNearbyComplexes.vue'
import { fmtDeposit, fmtRent, fmtArea, fmtCount, isJeonseRental } from '~/utils/publicRentalMeta'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const props = defineProps<{
  rental: PublicRentalComplex
  siblings: PublicRentalComplex[]
  nearby: PublicRentalComplex[]
  lastSyncDate?: string | null
}>()

const hasCoords = computed(
  () =>
    props.rental.lat !== null &&
    props.rental.lat !== undefined &&
    props.rental.lng !== null &&
    props.rental.lng !== undefined,
)

const locationSubtext = computed(() => `${props.rental.city} ${props.rental.district} · ${props.rental.complexName}`)

const markerFacility = computed<FacilitySearchItem[]>(() => {
  if (!hasCoords.value) return []
  return [
    {
      id: `public-rental-${props.rental.id}`,
      name: props.rental.complexNameKor || props.rental.complexName,
      // 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)
      category: 'toilet' as const,
      address: props.rental.complexName,
      roadAddress: null,
      lat: props.rental.lat as number,
      lng: props.rental.lng as number,
      city: props.rental.city,
      district: props.rental.district,
    },
  ]
})

const isJeonse = computed(() => isJeonseRental(props.rental.monthlyRent))

const displayName = computed(() =>
  props.rental.complexNameKor && props.rental.complexNameKor.trim()
    ? props.rental.complexNameKor
    : `${props.rental.city} ${props.rental.district} ${props.rental.rentalType}`,
)

// 모바일 헤더 stat 칩 (보증금 → 월세 → 전용 → 세대), '정보없음' 필터 후 최대 4개
const mobileHeaderStats = computed(() => {
  const NO = '정보없음'
  const raw = [
    { label: isJeonse.value ? '전세보증금' : '보증금', value: fmtDeposit(props.rental.depositAmount), color: 'text-primary' },
    { label: '월세', value: fmtRent(props.rental.monthlyRent, isJeonse.value) },
    { label: '전용', value: fmtArea(props.rental.exclusiveArea) },
    { label: '세대', value: fmtCount(props.rental.householdCount, '세대') },
  ]
  return raw.filter((s) => s.value !== NO).slice(0, 4)
})

// 길찾기 URL (좌표 있을 때만)
const kakaoMapUrl = computed(() =>
  hasCoords.value
    ? `https://map.kakao.com/link/to/${encodeURIComponent(displayName.value)},${props.rental.lat},${props.rental.lng}`
    : '',
)
const naverMapUrl = computed(() =>
  hasCoords.value
    ? `https://map.naver.com/v5/directions/-/${props.rental.lng},${props.rental.lat},${encodeURIComponent(displayName.value)}/-/walk`
    : '',
)

function openNavigation(url: string) {
  if (!import.meta.client || !url) return
  window.open(url, '_blank')
}

async function handleShare() {
  if (!import.meta.client) return
  const shareData = {
    title: displayName.value,
    text: `${displayName.value} ${props.rental.rentalType} 공공임대`,
    url: window.location.href,
  }
  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
  } catch {
    /* 사용자 취소/미지원 — 무시 */
  }
}
</script>
