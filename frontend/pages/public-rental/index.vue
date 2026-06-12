<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-background-light to-background-light border-b border-line">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-strong">공공임대 매물</h1>
        <p class="mt-2 text-muted text-sm">LH·SH 등 공공기관이 운영하는 수시모집 매물 카탈로그입니다. 청약통장 없이 자격만 맞으면 신청할 수 있습니다.</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <PublicRentalFilterTabs />

      <PublicRentalListView />

      <DataSourceSection domain="public-rental" />
      <p class="-mt-3 px-1 text-xs text-muted leading-relaxed">
        공공임대 매물 정보는 각 공급기관(LH, SH 등)의 공고를 가공한 자료입니다.
        최신 모집 일정과 자격 조건은 반드시 해당 기관 공고문을 확인하세요.
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL } from '~/utils/seoConstants'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import PublicRentalFilterTabs from '~/components/publicRental/PublicRentalFilterTabs.vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'

const { setMeta } = useFacilityMeta()

setMeta({
  title: '공공임대 매물',
  description: 'LH·SH 등 공공기관이 운영하는 매입임대·전세임대 매물 정보를 한눈에 비교하세요. 청약통장 없이 자격만 맞으면 수시 신청할 수 있는 공공 직접 공급 매물입니다.',
  path: '/public-rental',
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '공공임대', url: `${SITE_URL}/public-rental` },
])

setItemListSchema([
  { name: '모집공고', url: '/public-rental/announcements' },
  { name: '매입임대', url: '/public-rental/buy-lease' },
  { name: '전세임대', url: '/public-rental/charter' },
])
</script>
