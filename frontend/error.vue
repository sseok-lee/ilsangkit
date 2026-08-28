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

        <!-- 410 은 폐업·폐원한 시설이므로 같은 카테고리 목록이 홈보다 유용한 다음 행동이다.
             그때만 CTA 순서를 바꾸고, 나머지 상태에서는 기존대로 홈이 primary 다. -->
        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            v-if="copy.categoryCta"
            :href="copy.categoryCta.href"
            class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">grid_view</span>
            {{ copy.categoryCta.label }}
          </a>
          <a
            href="/"
            :class="copy.categoryCta
              ? 'inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-primary/30 hover:shadow-md transition-all font-medium'
              : 'inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium shadow-sm'"
          >
            <span class="material-symbols-outlined text-[20px]">home</span>
            홈으로 돌아가기
          </a>
        </div>

        <!-- 영구 응답(404·410)일 때만 탈출구를 띄운다. 5xx 는 재시도가 정답이라 제외. -->
        <div v-if="copy.showRecovery" class="mt-12">
          <p class="text-sm text-slate-500 mb-5">찾으시는 정보가 있으신가요?</p>

          <!-- 재검색 -->
          <form class="mb-8 text-left" @submit.prevent="onSearch">
            <div class="relative">
              <span
                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]"
                aria-hidden="true"
              >search</span>
              <input
                v-model="searchQuery"
                type="search"
                inputmode="search"
                enterkeyhint="search"
                aria-label="사이트 검색"
                :placeholder="searchPlaceholder"
                class="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <button
                type="submit"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
              >
                검색
              </button>
            </div>
          </form>

          <!-- 부동산 -->
          <div class="mb-4">
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">부동산</h2>
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
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">생활시설</h2>
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
import { ref } from 'vue'
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import { resolveErrorPageCopy, errorPagePath, facilityCategoryFromPath } from '~/utils/errorPageCopy'
import { resolveSearchScope, buildSearchDestination, scopePlaceholder } from '~/utils/searchScope'

const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string; url?: string }
}>()

const statusCode = props.error?.statusCode ?? 500

// 에러가 난 경로. error.url 이 1순위이고 useRoute() 는 fallback —
// 근거는 errorPagePath 주석 참조. useRoute() 는 error.vue 가 라우터 밖에서
// 렌더될 수 있어 try/catch 로 감싼다(에러 페이지가 스스로 던지면 안 된다).
let routePath: string | undefined
try {
  routePath = useRoute()?.path
} catch {
  routePath = undefined
}
const errorPath = errorPagePath(props.error, routePath)

// 410 문구를 위한 카테고리. 검색 목적지 스코프는 별도 규칙(subway 제외)이라 분리한다.
const goneCategory = facilityCategoryFromPath(errorPath)
const copy = resolveErrorPageCopy({ statusCode, facilityCategory: goneCategory })

const title = copy.title
const description = copy.description

// 재검색 목적지는 경로 컨텍스트를 따른다 — `/search` 는 부동산 전용이므로
// 시설 상세에서 온 사용자를 거기로 보내면 검색이 빈손으로 끝난다(#617 스코프 규칙).
const searchScope = resolveSearchScope({ path: errorPath })
const searchPlaceholder = scopePlaceholder(searchScope)

// 재검색: 에러 상태를 해제하며 스코프에 맞는 결과로 이동
const searchQuery = ref('')
function onSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  clearError({ redirect: buildSearchDestination(searchScope, q) })
}

const realEstateLinks = [
  { slug: '/real-estate/apt-sale', label: '아파트' },
  { slug: '/real-estate/villa-sale', label: '빌라' },
  { slug: '/real-estate/offitel-sale', label: '오피스텔' },
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
