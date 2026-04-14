<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- 브레드크럼 -->
      <nav class="flex items-center gap-1 text-sm text-slate-500 mb-6">
        <NuxtLink to="/" class="hover:text-primary">홈</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <NuxtLink :to="`/${citySlug}`" class="hover:text-primary">{{ cityName }}</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <NuxtLink :to="`/${citySlug}/${districtSlug}`" class="hover:text-primary">{{ districtName }}</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-800">부동산 실거래가</span>
      </nav>

      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
          {{ districtName }} 부동산 실거래가
        </h1>
        <p class="mt-2 text-slate-500 text-sm">
          {{ cityName }} {{ districtName }}의 아파트·빌라·오피스텔 실거래가를 확인하세요.
        </p>
      </div>

      <!-- Ad: 헤딩 후 -->
      <AdBanner class="my-4 mb-10" />

      <!-- 유형별 링크 -->
      <section class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4">유형별 실거래가 조회</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NuxtLink
            v-for="type in propertyTypes"
            :key="type.slug"
            :to="`/real-estate/${type.slug}`"
            class="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <img :src="`/icons/category/${type.slug}.webp?v2`" :alt="type.label" class="w-7 h-7" width="28" height="28" />
              </div>
              <h3 class="font-bold text-slate-900">{{ type.label }}</h3>
            </div>
            <p class="text-sm text-slate-500">{{ type.description }}</p>
          </NuxtLink>
        </div>
      </section>

      <!-- 주변 생활시설 -->
      <section class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4">{{ districtName }} 주변 생활시설</h2>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="cat in facilityCategories"
            :key="cat.slug"
            :to="`/${citySlug}/${districtSlug}/${cat.slug}`"
            class="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-full text-sm transition-colors"
          >
            {{ cat.label }}
          </NuxtLink>
        </div>
      </section>

      <!-- FAQ -->
      <section>
        <h2 class="text-lg font-bold text-slate-900 mb-4">자주 묻는 질문</h2>
        <div class="space-y-1">
          <details
            v-for="(faq, i) in faqs"
            :key="i"
            class="rounded-xl bg-white border border-slate-200 overflow-hidden"
          >
            <summary class="flex items-center justify-between px-5 py-4 cursor-pointer text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors list-none">
              {{ faq.question }}
              <span class="material-symbols-outlined text-slate-500 text-lg flex-shrink-0 ml-3">expand_more</span>
            </summary>
            <p class="px-5 pb-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">{{ faq.answer }}</p>
          </details>
        </div>
      </section>

      <!-- Ad: 페이지 끝 -->
      <AdBanner class="my-4 mt-10" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'

const route = useRoute()
const citySlug = computed(() => route.params.city as string)
const districtSlug = computed(() => route.params.district as string)

// city slug 유효성 검사
if (!CITY_SLUG_MAP[citySlug.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// 지역 이름 해석
const { loadRegions, syncFromHydration, getCityName, getDistrictName, getDistrictsByCity } = useRegions()

const { data: regionsData } = await useAsyncData(
  `hub-regions-${citySlug.value}`,
  () => loadRegions()
)
syncFromHydration(regionsData)

// district slug 유효성 검사
const validDistricts = getDistrictsByCity(citySlug.value)
if (validDistricts.length === 0 || !validDistricts.some(d => d.slug === districtSlug.value)) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

const cityName = computed(() => getCityName(citySlug.value))
const districtName = computed(() => getDistrictName(citySlug.value, districtSlug.value))

// 부동산 유형
const propertyTypes = [
  { slug: 'apt-sale', label: '아파트 매매', description: '아파트 실거래 매매가 조회' },
  { slug: 'apt-rent', label: '아파트 전월세', description: '아파트 전세·월세 실거래가 조회' },
  { slug: 'villa-sale', label: '빌라 매매', description: '연립·다세대 실거래 매매가 조회' },
  { slug: 'villa-rent', label: '빌라 전월세', description: '연립·다세대 전세·월세 실거래가 조회' },
  { slug: 'offitel-sale', label: '오피스텔 매매', description: '오피스텔 실거래 매매가 조회' },
  { slug: 'offitel-rent', label: '오피스텔 전월세', description: '오피스텔 전세·월세 실거래가 조회' },
]

// 주변 생활시설 (상위 5개)
const facilityCategories = [
  { slug: 'hospital', label: '병원' },
  { slug: 'school', label: '학교' },
  { slug: 'park', label: '공원' },
  { slug: 'pharmacy', label: '약국' },
  { slug: 'library', label: '도서관' },
]

// FAQ
const faqs = [
  {
    question: `${districtName.value} 아파트 실거래가는 어디서 확인하나요?`,
    answer: `일상킷에서 ${cityName.value} ${districtName.value} 아파트 실거래가를 국토교통부 공식 데이터 기반으로 제공합니다. 위의 '아파트 매매' 또는 '아파트 전월세' 링크를 통해 확인하실 수 있습니다.`,
  },
  {
    question: '실거래가와 호가(매물가)는 어떻게 다른가요?',
    answer: '실거래가는 실제로 계약이 완료된 금액으로 국토교통부에 신고된 공식 데이터입니다. 호가는 매도자가 희망하는 가격으로 실제 거래가와 차이가 있을 수 있습니다.',
  },
  {
    question: '전세와 월세 중 어느 쪽이 유리한가요?',
    answer: '전세는 목돈이 필요하지만 월 임대료 부담이 없고, 월세는 보증금이 적은 대신 매월 임대료를 납부합니다. 금리 수준, 자금 상황, 거주 기간 등을 종합적으로 고려해 선택하는 것이 좋습니다.',
  },
  {
    question: '부동산 실거래가 데이터는 얼마나 자주 업데이트되나요?',
    answer: '국토교통부 실거래가 공개시스템을 통해 매월 업데이트됩니다. 계약 체결 후 30일 이내에 신고된 데이터가 반영됩니다.',
  },
  {
    question: `${districtName.value} 빌라·오피스텔 실거래가도 확인할 수 있나요?`,
    answer: `네, 일상킷에서 ${districtName.value} 빌라(연립·다세대)와 오피스텔의 매매 및 전월세 실거래가를 모두 확인할 수 있습니다. 위의 유형별 링크를 이용하세요.`,
  },
]

// SEO 메타
const canonicalUrl = `${SITE_URL}/${citySlug.value}/${districtSlug.value}/real-estate`
useHead(() => {
  const title = `${districtName.value} 부동산 실거래가 - 일상킷`
  const description = `${cityName.value} ${districtName.value} 아파트·빌라·오피스텔 매매·전세·월세 실거래가를 확인하세요. 국토교통부 공식 데이터 기반으로 최신 거래 정보를 제공합니다.`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: 'website' },
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
  }
})

// JSON-LD 구조화 데이터
const { setBreadcrumbSchema } = useStructuredData()

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${citySlug.value}` },
  { name: districtName.value, url: `/${citySlug.value}/${districtSlug.value}` },
  { name: '부동산 실거래가', url: `/${citySlug.value}/${districtSlug.value}/real-estate` },
])
</script>
