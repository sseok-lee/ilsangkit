<template>
  <div class="flex flex-col gap-3">
    <SectionBlock heading="LH 매입/전세임대" subtext="청약통장 없이도 자격만 맞으면 신청할 수 있는 LH 직접 공급 매물입니다.">
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ total.toLocaleString() }}건
        </span>
      </template>

      <!-- 지역 필터 -->
      <RegionCascadingDropdown
        v-model:city="currentCity"
        v-model:district="selectedDistrict"
        city-value-mode="slug"
        class="mb-3"
      />

      <LoadingSkeleton v-if="loading" variant="card" />

      <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
        <p class="text-red-700 font-semibold">{{ UI_MESSAGES.fetchError }}</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="reload"
        >
          다시 시도
        </button>
      </div>

      <div v-else-if="items.length === 0" class="rounded-xl bg-background-light p-12 text-center">
        <p class="text-ink font-medium">{{ emptyFiltered('매물') }}</p>
        <p class="text-muted text-sm mt-1">지역 필터를 다른 값으로 바꿔보세요</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PublicRentalCard
          v-for="rental in items"
          :key="rental.id"
          :rental="rental"
        />
      </div>

      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @page-change="goToPage"
      />
    </SectionBlock>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePublicRental } from '~/composables/usePublicRental'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'
import type { PublicRentalComplex, PublicRentalType } from '~/types/publicRental'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'

const props = defineProps<{
  rentalTypeCode?: PublicRentalType
}>()

const { getList } = usePublicRental()

// 로컬 상태 (SubscriptionListView SSR 패턴과 정렬)
const items = ref<PublicRentalComplex[]>([])
const total = ref(0)
const totalPages = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)

const currentCity = ref<string>('')
const selectedDistrict = ref<string>('')
const page = ref(1)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await getList({
      city: currentCity.value || undefined,
      district: selectedDistrict.value || undefined,
      rentalType: props.rentalTypeCode,
      page: page.value,
      limit: 18,
    })
    items.value = data.items
    total.value = data.pagination.total
    totalPages.value = data.pagination.totalPages
    currentPage.value = data.pagination.page
  } catch (err) {
    error.value = err instanceof Error ? err.message : '공공임대 목록 조회에 실패했습니다.'
    items.value = []
    total.value = 0
    totalPages.value = 0
  } finally {
    loading.value = false
  }
}

// 템플릿의 "다시 시도" 버튼이 호출
const reload = (): Promise<void> => load()

function goToPage(p: number) {
  page.value = p
  void load()
}

watch([currentCity, selectedDistrict, () => props.rentalTypeCode], () => {
  page.value = 1
  void load()
})

// SSR: 초기 목록을 서버에서 패칭해 HTML에 포함
const route = useRoute()
const { data: ssrData } = await useAsyncData(
  `public-rental-${route.path}-${props.rentalTypeCode ?? 'all'}`,
  () => getList({ rentalType: props.rentalTypeCode, page: 1, limit: 18 }),
)
if (ssrData.value) {
  items.value = ssrData.value.items
  total.value = ssrData.value.pagination.total
  totalPages.value = ssrData.value.pagination.totalPages
  currentPage.value = ssrData.value.pagination.page
}
</script>
