<template>
  <div class="min-h-screen flex flex-col bg-background-light">
    <Head>
      <Title>{{ title }} - 일상킷</Title>
      <Meta name="description" :content="description" />
      <Meta name="robots" content="noindex, nofollow" />
      <Meta property="og:title" :content="`${title} - 일상킷`" />
      <Meta property="og:description" :content="description" />
    </Head>

    <!-- Header -->
    <AppHeader />

    <!-- Main -->
    <main class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="max-w-xl w-full text-center">
        <p class="text-7xl md:text-8xl font-black text-primary/20 mb-2">{{ statusCode }}</p>
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-3">{{ title }}</h1>
        <p class="text-slate-500 mb-8">{{ description }}</p>

        <a
          href="/"
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium shadow-sm"
        >
          <span class="material-symbols-outlined text-[20px]">home</span>
          홈으로 돌아가기
        </a>

        <!-- 404일 때 바로가기 -->
        <div v-if="statusCode === 404" class="mt-12">
          <p class="text-sm text-slate-500 mb-5">찾으시는 정보가 있으신가요?</p>

          <!-- 부동산 -->
          <div class="mb-4">
            <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">부동산</h2>
            <div class="grid grid-cols-3 gap-2">
              <a
                v-for="re in realEstateLinks"
                :key="re.slug"
                :href="re.slug"
                class="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-primary/30 transition-all text-center text-sm font-medium text-slate-700"
              >
                {{ re.label }}
              </a>
            </div>
          </div>

          <!-- 생활시설 -->
          <div>
            <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">생활시설</h2>
            <div class="grid grid-cols-3 gap-2">
              <a
                v-for="cat in facilityLinks"
                :key="cat.slug"
                :href="`/${cat.slug}`"
                class="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-primary/30 transition-all text-center text-sm font-medium text-slate-700"
              >
                {{ cat.label }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'

const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string }
}>()

const statusCode = props.error?.statusCode ?? 500
const title = statusCode === 404 ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'
const description = statusCode === 404
  ? '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.'
  : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

const realEstateLinks = [
  { slug: '/real-estate/apt', label: '아파트' },
  { slug: '/real-estate/villa', label: '빌라' },
  { slug: '/real-estate/offitel', label: '오피스텔' },
]

const facilityLinks = [
  { slug: 'hospital', label: '병원' },
  { slug: 'pharmacy', label: '약국' },
  { slug: 'school', label: '학교' },
  { slug: 'parking', label: '주차장' },
  { slug: 'park', label: '공원' },
  { slug: 'ev-charger', label: '전기차 충전소' },
]
</script>
