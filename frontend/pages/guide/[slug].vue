<template>
  <div class="bg-background-light min-h-screen">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-muted text-sm">{{ UI_MESSAGES.loading }}</p>
      </div>
    </div>

    <!-- Article -->
    <article v-else-if="guide" class="max-w-3xl mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- 히어로 카드 (썸네일 + eyebrow + title + meta) -->
      <section class="bg-white border border-line rounded-xl shadow-card overflow-hidden">
        <div v-if="guide.thumbnailUrl" class="w-full aspect-video bg-background-light">
          <img
            :src="`${publicApiBase}${guide.thumbnailUrl}`"
            :alt="guide.title"
            width="800"
            height="450"
            class="w-full h-full object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 800px"
          />
        </div>
        <div class="p-4 md:p-5">
          <span class="inline-flex mb-2 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-black">
            {{ categoryLabel }}
          </span>
          <h1 class="text-2xl md:text-[32px] leading-tight font-bold text-strong mb-2">
            {{ guide.title }}
          </h1>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span class="inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit_note</span>
              {{ CONTENT_AUTHOR }}
            </span>
            <span class="inline-flex items-center gap-1 font-semibold text-success">
              <span aria-hidden="true">✓</span> 공공데이터 원문 대조 검수
            </span>
            <time :datetime="guide.publishedAt">{{ formatDate(guide.publishedAt) }}</time>
            <span v-if="guide.viewCount >= VIEW_COUNT_DISPLAY_MIN" class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              {{ guide.viewCount.toLocaleString() }}
            </span>
          </div>
        </div>
      </section>

      <!-- "본문" SectionBlock -->
      <SectionBlock>
        <div
          class="
            prose prose-slate max-w-none
            prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-7 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-line-2
            prose-h3:text-lg prose-h3:mt-5
            prose-p:leading-relaxed prose-p:text-ink
            prose-li:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-strong
            prose-ul:my-3 prose-ol:my-3
          "
          v-html="contentParts[0]"
        ></div>

        <!-- AdBanner: 본문 덩어리 사이 1회 -->
        <AdBanner v-if="contentParts[1]" class="my-4" />

        <div
          v-if="contentParts[1]"
          class="
            prose prose-slate max-w-none
            prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-7 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-line-2
            prose-h3:text-lg prose-h3:mt-5
            prose-p:leading-relaxed prose-p:text-ink
            prose-li:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-strong
            prose-ul:my-3 prose-ol:my-3
          "
          v-html="contentParts[1]"
        ></div>

        <!-- 키워드 -->
        <div v-if="guide.keywords" class="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
          <span
            v-for="keyword in keywordList"
            :key="keyword"
            class="px-3 py-1 bg-slate-100 text-muted text-xs rounded-full"
          >
            #{{ keyword }}
          </span>
        </div>
      </SectionBlock>

      <!-- AdBanner: 본문 이후 1회 -->
      <AdBanner />

      <!-- "관련 정보" SectionBlock -->
      <SectionBlock heading="관련 정보" subtext="같은 주제의 가이드와 바로가기 링크를 확인하세요.">
        <RelatedGuides
          v-if="guide.category"
          :category="guide.category"
          :exclude-slug="guide.slug"
        />

        <nav data-testid="guide-related-categories" class="mt-4 pt-4 border-t border-line">
          <p class="text-sm font-semibold text-ink mb-3">바로가기</p>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="cat in relatedGuideCategories"
              :key="cat"
              :to="`/${cat}`"
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-background-light border border-line-2 text-ink rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
            >
              {{ CATEGORY_META[cat as FacilityCategory]?.label || cat }}
            </NuxtLink>
          </div>
        </nav>
      </SectionBlock>

      <!-- AI 작성 안내 -->
      <div class="bg-background-light rounded-lg p-4">
        <p class="text-xs font-semibold text-muted mb-1">AI 작성 안내</p>
        <p class="text-xs text-muted leading-relaxed">
          본 콘텐츠는 인공지능(AI) 기술을 활용하여 정보를 정리 및 요약한 글입니다.
          내용의 정확성을 보증하지 않으며, 투자나 법적 판단의 근거로 활용하기에는
          적합하지 않을 수 있습니다. 정확한 정보는 관련 기관의 공식 자료를 확인해
          주시기 바랍니다.
        </p>
      </div>

      <!-- Back to list -->
      <div>
        <NuxtLink
          to="/guide"
          class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 text-ink rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          목록으로 돌아가기
        </NuxtLink>
      </div>
    </article>

    <!-- fail-open: 일시 장애(503)면 guide 가 null 이다. 빈 본문 대신 재시도 안내를 그린다. -->
    <div v-else class="max-w-3xl mx-auto px-4 md:px-6 py-20 text-center">
      <p class="text-muted font-medium">가이드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <NuxtLink to="/guide" class="mt-4 inline-block text-primary hover:text-primary/80 font-medium text-sm">
        가이드 목록으로
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { marked } from 'marked'
import { UI_MESSAGES } from '~/utils/uiMessages'
import DOMPurify from 'isomorphic-dompurify'
import { useGuides } from '~/composables/useGuides'
import { useArticles } from '~/composables/useArticles'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useAnalytics } from '~/composables/useAnalytics'
import { CATEGORY_META } from '~/types/facility'
import { getContentCategoryLabel } from '~/utils/contentCategoryLabel'
import { SITE_URL, RELATED_CATEGORIES, CONTENT_AUTHOR, VIEW_COUNT_DISPLAY_MIN } from '~/utils/seoConstants'
import type { FacilityCategory } from '~/types/facility'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const config = useRuntimeConfig()
// Image/OG URLs must use the public base (not loopback) so browsers and crawlers can access them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchGuideBySlug } = useGuides()
const { fetchArticleBySlug } = useArticles()
const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setArticleSchema, setFAQSchema, setHowToSchema } = useStructuredData()

// SSR 호환: useAsyncData로 가이드 데이터 가져오기 (서버에서도 실행)
const { data: guide, status, error: guideError } = await useAsyncData(
  `guide-${slug.value}`,
  () => fetchGuideBySlug(slug.value),
)

// 확정 부재(백엔드 404/422 또는 에러 없이 빈 응답)만 하드 404.
// 일시 장애(5xx·네트워크·타임아웃)는 fail-open — 503 + no-store 로만 표시한다.
//
// fetchGuideBySlug 는 $fetch 예외를 삼키지 않으므로 실패가 전부 guideError 로 올라오는데,
// 기존엔 error ref 를 구조분해조차 하지 않고 `!guide.value` 만 봤다. 그 결과 백엔드 5xx 와
// "없는 slug" 가 구분되지 않아, 잠깐의 장애가 살아있는 가이드 URL 을 하드 404 로 굳혔다
// (2026-09-04 네이버 진단 "접근 불가" 523건). 정책은 #467 / #674 / land [dong].vue 와 동일.
const guideErrStatus = guideError.value?.statusCode
const guideTransientFailure = !!guideError.value && guideErrStatus !== 404 && guideErrStatus !== 422
const guideConfirmedMissing = !guideTransientFailure && !guide.value
if (guideTransientFailure) {
  if (import.meta.server) markDegradedResponse()
} else if (guideConfirmedMissing) {
  // 이전된 news 가이드: 같은 slug의 published Article이 있으면 /article로 영구(301) 이동.
  // ⚠️ 이 조회가 "실패"한 것과 "없다"고 확인된 것은 다르다. 실패를 부재로 뭉개면
  //    301 로 살려야 할 URL 이 404 로 굳는다 — 그래서 상태코드를 보고 갈라낸다.
  const migrated = await fetchArticleBySlug(slug.value).catch((err: { statusCode?: number }) => {
    const s = err?.statusCode
    return (s === 404 || s === 422) ? null : { transientFailure: true as const }
  })
  if (migrated && 'transientFailure' in migrated) {
    if (import.meta.server) markDegradedResponse()
  } else if (migrated) {
    await navigateTo(`/article/${slug.value}`, { redirectCode: 301, replace: true })
  } else {
    throw createError({ statusCode: 404, statusMessage: '가이드를 찾을 수 없습니다' })
  }
}

const { trackGuideView } = useAnalytics()
onMounted(() => {
  if (!guide.value) return
  trackGuideView({ slug: slug.value, category: guide.value.category, title: guide.value.title })
})

const loading = computed(() => status.value === 'pending')

const categoryLabel = computed(() => {
  if (!guide.value) return ''
  return getContentCategoryLabel(guide.value.category)
})

const renderedContent = computed(() => {
  if (!guide.value?.content) return ''
  const rawHtml = marked(guide.value.content) as string
  return DOMPurify.sanitize(rawHtml)
})

// 본문을 3번째 <h2> 기준으로 분할하여 중간 광고 삽입
const contentParts = computed<[string, string?]>(() => {
  const html = renderedContent.value
  if (!html) return ['']
  const h2Regex = /<h2[\s>]/gi
  let match: RegExpExecArray | null
  let count = 0
  while ((match = h2Regex.exec(html)) !== null) {
    count++
    if (count === 3) {
      return [html.slice(0, match.index), html.slice(match.index)]
    }
  }
  return [html]
})

const keywordList = computed(() => {
  if (!guide.value?.keywords) return []
  return guide.value.keywords.split(',').map(k => k.trim()).filter(Boolean)
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '생활 가이드', href: '/guide', current: false },
  { label: guide.value?.title ?? '', current: true },
])

// 가이드 카테고리 기반 관련 카테고리 링크
const DEFAULT_RELATED_CATEGORIES = ['hospital', 'school', 'park']

const relatedGuideCategories = computed(() => {
  if (!guide.value) return DEFAULT_RELATED_CATEGORIES
  const cat = guide.value.category
  const related = RELATED_CATEGORIES[cat]
  if (!related || related.length === 0) return DEFAULT_RELATED_CATEGORIES
  return related.filter(c => c !== cat)
})

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// SEO meta
if (guide.value) {
  setMeta({
    title: `${guide.value.title} | ${categoryLabel.value} 이용 가이드`,
    description: guide.value.summary,
    path: `/guide/${guide.value.slug}`,
    type: 'article',
    // 가이드 썸네일은 800x630이 아닌 800x800(1:1) webp라 1200x630 선언과 불일치 + 네이버 webp 썸네일 미지원.
    // 1.91:1 PNG 카드(정적 기본 OG)로 대체해 선언 치수와 일치시키고 네이버/카카오 썸네일을 보장한다.
    // (장기: generateGuide.ts에서 가이드별 1200x630 PNG OG 변형을 생성해 교체)
    image: `${SITE_URL}/og-image.png`,
  })

  useHead({
    meta: [
      { property: 'article:published_time', content: guide.value.publishedAt || guide.value.createdAt },
      { property: 'article:modified_time', content: guide.value.updatedAt || guide.value.createdAt },
    ],
  })

  // Breadcrumb
  setBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '생활 가이드', url: '/guide' },
    { name: guide.value.title, url: `/guide/${guide.value.slug}` },
  ])

  // Article JSON-LD
  setArticleSchema({
    headline: guide.value.title,
    description: guide.value.summary,
    datePublished: guide.value.publishedAt || guide.value.createdAt,
    dateModified: guide.value.updatedAt || undefined,
    url: `/guide/${guide.value.slug}`,
    image: guide.value.thumbnailUrl ? `${publicApiBase}${guide.value.thumbnailUrl}` : undefined,
  })

  // FAQ JSON-LD: "자주 묻는 질문" 섹션에서 Q/A 추출
  const articleType = guide.value.articleType ?? 'news'
  const content = guide.value.content ?? ''

  if (articleType === 'howto' || articleType === 'guide') {
    const faqMatch = content.match(/## 자주 묻는 질문[\s\S]*?(?=\n## |$)/)
    if (faqMatch) {
      const faqBlock = faqMatch[0]
      const faqs: Array<{ question: string; answer: string }> = []
      const qaPairs = faqBlock.matchAll(/\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([\s\S]*?)(?=\n\*\*Q\.|$)/g)
      for (const match of qaPairs) {
        faqs.push({ question: match[1].trim(), answer: match[2].trim() })
      }
      if (faqs.length > 0) {
        setFAQSchema(faqs)
      }
    }
  }

  // HowTo JSON-LD: "단계별 방법" 섹션에서 steps 추출
  if (articleType === 'howto') {
    const stepsMatch = content.match(/## 단계별 방법[\s\S]*?(?=\n## |$)/)
    if (stepsMatch) {
      const stepsBlock = stepsMatch[0]
      const steps: Array<{ name: string; text: string }> = []
      const stepItems = stepsBlock.matchAll(/\d+\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\d+\.\s*\*\*|$)/g)
      for (const match of stepItems) {
        steps.push({ name: match[1].trim(), text: match[2].trim() })
      }
      if (steps.length > 0) {
        setHowToSchema({
          name: guide.value.title,
          description: guide.value.summary,
          steps,
          url: `/guide/${guide.value.slug}`,
        })
      }
    }
  }
}
</script>
