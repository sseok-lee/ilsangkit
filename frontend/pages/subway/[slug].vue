<template>
  <div class="min-h-screen bg-slate-50">
    <div v-if="pending" class="container mx-auto px-4 py-16">
      <div class="flex items-center justify-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
      </div>
    </div>

    <div v-else-if="station" class="container mx-auto px-4 py-8 max-w-4xl">
      <!-- Header -->
      <header class="mb-6">
        <NuxtLink to="/" class="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-3">
          <span class="material-symbols-outlined text-base mr-1">arrow_back</span>
          홈으로
        </NuxtLink>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-3xl sm:text-4xl font-bold text-slate-900">{{ station.name }}역</h1>
          <span
            class="text-sm font-bold px-3 py-1 rounded-full text-white"
            :style="{ backgroundColor: lineColor(station.line) }"
          >
            {{ station.line }}
          </span>
        </div>
        <p v-if="station.city || station.district" class="mt-2 text-slate-600">
          {{ [station.city, station.district].filter(Boolean).join(' ') }}
        </p>
      </header>

      <!-- Info card -->
      <section class="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
          <div v-if="station.transferLines.length > 0">
            <dt class="text-xs font-medium text-slate-500 mb-1">환승 노선</dt>
            <dd class="flex flex-wrap gap-2">
              <span
                v-for="transfer in station.transferLines"
                :key="transfer"
                class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                :style="{ backgroundColor: lineColor(transfer) }"
              >
                {{ transfer }}
              </span>
            </dd>
          </div>

          <div v-if="station.operator">
            <dt class="text-xs font-medium text-slate-500 mb-1">운영기관</dt>
            <dd class="text-sm text-slate-900">{{ station.operator }}</dd>
          </div>

          <div v-if="station.roadAddress" class="sm:col-span-2">
            <dt class="text-xs font-medium text-slate-500 mb-1">주소</dt>
            <dd class="text-sm text-slate-900">{{ station.roadAddress }}</dd>
          </div>

          <div v-if="station.phoneNumber">
            <dt class="text-xs font-medium text-slate-500 mb-1">전화번호</dt>
            <dd class="text-sm text-slate-900">{{ station.phoneNumber }}</dd>
          </div>

          <div v-if="station.dataDate">
            <dt class="text-xs font-medium text-slate-500 mb-1">데이터기준일</dt>
            <dd class="text-sm text-slate-700">{{ station.dataDate }}</dd>
          </div>
        </dl>
      </section>

      <!-- Map -->
      <section class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100">
          <h2 class="text-base font-semibold text-slate-900">위치</h2>
        </div>
        <div ref="mapContainer" class="w-full h-80"></div>
      </section>

      <!-- Data source -->
      <p class="mt-6 text-xs text-slate-400">
        데이터 출처: 국토교통부 전국도시철도역사정보표준데이터
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { lineColor } from '~/utils/subwayLineColors'
import { useSubwayStation } from '~/composables/useSubwayStation'
import { buildSubwayDescription, buildSubwayJsonLd, buildSubwayTitle } from '~/utils/subwayMeta'
import { useKakaoMap } from '~/composables/useKakaoMap'
import { SITE_URL } from '~/utils/seoConstants'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data, error, pending } = await useSubwayStation(slug.value)

if (error.value || !data.value?.data) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Station not found',
    fatal: true,
  })
}

const station = computed(() => data.value!.data)

const subwayOgImage = computed(() => {
  const s = station.value
  if (!s?.lat || !s?.lng) return undefined
  const stationLabel = s.name.endsWith('역') ? s.name : `${s.name}역`
  return `${SITE_URL}/og-map?lat=${s.lat}&lng=${s.lng}&label=${encodeURIComponent(stationLabel)}&category=area&title=${encodeURIComponent(s.name)}`
})

useSeoMeta({
  title: () => buildSubwayTitle(station.value),
  description: () => buildSubwayDescription(station.value),
  robots: 'noindex, nofollow',
  ogTitle: () => buildSubwayTitle(station.value),
  ogDescription: () => buildSubwayDescription(station.value),
  ogImage: () => subwayOgImage.value,
  ogImageWidth: 1024,
  ogImageHeight: 536,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterImage: () => subwayOgImage.value,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(buildSubwayJsonLd(station.value))),
    },
  ],
})

const mapContainer = ref<HTMLElement | null>(null)
const { initMap } = useKakaoMap()

async function renderMap() {
  if (!import.meta.client) return
  if (!mapContainer.value || !station.value) return
  try {
    await initMap(mapContainer.value, {
      center: { lat: station.value.lat, lng: station.value.lng },
      level: 3,
    })
  } catch {
    // 지도 로드 실패는 무시 — 페이지는 콘텐츠가 우선
  }
}

onMounted(() => {
  void renderMap()
})

watch(station, () => {
  void renderMap()
})
</script>
