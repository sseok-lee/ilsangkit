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
    <article v-else-if="article" class="max-w-3xl mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- 히어로 카드 (썸네일 + eyebrow + title + meta) -->
      <section class="bg-white border border-line rounded-xl shadow-card overflow-hidden">
        <div v-if="article.thumbnailUrl" class="w-full aspect-video bg-background-light">
          <img
            :src="`${publicApiBase}${article.thumbnailUrl}`"
            :alt="article.title"
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
            {{ article.title }}
          </h1>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span class="inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit_note</span>
              {{ CONTENT_AUTHOR }}
            </span>
            <span class="inline-flex items-center gap-1 font-semibold text-success">
              <span aria-hidden="true">✓</span> 공공데이터 원문 대조 검수
            </span>
            <time :datetime="displayPublishedAt">{{ formatDate(displayPublishedAt) }}</time>
            <span v-if="article.viewCount >= VIEW_COUNT_DISPLAY_MIN" class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              {{ article.viewCount.toLocaleString() }}
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
        <div v-if="article.keywords" class="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
          <span
            v-for="keyword in keywordList"
            :key="keyword"
            class="px-3 py-1 bg-slate-100 text-muted text-xs rounded-full"
          >
            #{{ keyword }}
          </span>
        </div>
      </SectionBlock>

      <!-- AdBanner: 본문 이후 1회 (항상-렌더 SectionBlock 뒤에 앵커 — 조건부 블록에 인접시키지 않음) -->
      <AdBanner />

      <!-- 출처: 비어있으면 렌더하지 않음(광고 옆 빈 블록 회귀 방지) -->
      <section
        v-if="article.sources && article.sources.length"
        data-testid="article-sources"
        class="bg-white border border-line rounded-xl shadow-card p-4 md:p-5"
      >
        <p class="text-sm font-semibold text-ink mb-3">출처</p>
        <ul class="flex flex-col gap-2">
          <li v-for="source in article.sources" :key="source.url">
            <a
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="text-primary text-sm hover:underline break-all"
            >
              {{ source.title }}
            </a>
          </li>
        </ul>
      </section>

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
          to="/article"
          class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 text-ink rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          목록으로 돌아가기
        </NuxtLink>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useArticles } from '~/composables/useArticles'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import { REAL_ESTATE_META } from '~/utils/realEstateMeta'
import { SITE_URL, CONTENT_AUTHOR, VIEW_COUNT_DISPLAY_MIN } from '~/utils/seoConstants'
import type { FacilityCategory } from '~/types/facility'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const config = useRuntimeConfig()
// Image/OG URLs must use the public base (not loopback) so browsers and crawlers can access them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchArticleBySlug } = useArticles()
const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setArticleSchema } = useStructuredData()

// SSR 호환: useAsyncData로 article 데이터 가져오기 (서버에서도 실행)
const { data: article, status } = await useAsyncData(
  `article-${slug.value}`,
  () => fetchArticleBySlug(slug.value),
)

// article을 찾을 수 없으면(미발행 포함) 404 반환 (SSR에서 HTTP 404 상태 코드 전송)
if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: '오늘의 이슈를 찾을 수 없습니다' })
}

const loading = computed(() => status.value === 'pending')

const categoryLabel = computed(() => {
  if (!article.value) return ''
  const category = article.value.category
  const facilityLabel = CATEGORY_META[category as FacilityCategory]?.label
  if (facilityLabel) return facilityLabel
  const camelKey = category.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
  return REAL_ESTATE_META[camelKey as keyof typeof REAL_ESTATE_META]?.label ?? category
})

const renderedContent = computed(() => {
  if (!article.value?.content) return ''
  const rawHtml = marked(article.value.content) as string
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
  if (!article.value?.keywords) return []
  return article.value.keywords.split(',').map(k => k.trim()).filter(Boolean)
})

// publishedAt은 published 상태에서 항상 채워지지만(발행 시 1회 부여), 타입상 nullable이라
// 방어적으로 createdAt을 폴백으로 둔다.
const displayPublishedAt = computed(() => article.value?.publishedAt ?? article.value?.createdAt ?? '')

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '오늘의 이슈', href: '/article', current: false },
  { label: article.value?.title ?? '', current: true },
])

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// SEO meta
if (article.value) {
  const canonicalPath = `/article/${article.value.slug}`
  const publishedAtStr = article.value.publishedAt ?? article.value.createdAt

  // dateModified 가드: updatedAt이 publishedAt과 사실상 같으면(60초 이내) 생략한다.
  // 이 사이트는 과거 가짜 freshness(무조건 dateModified 노출) 문제를 겪었다 — 의미 없는
  // 갱신을 "최신 수정"으로 신고하지 않도록 유의미한 차이(>60s)가 있을 때만 포함한다.
  const modified = (new Date(article.value.updatedAt).getTime() - new Date(publishedAtStr).getTime() > 60_000)
    ? article.value.updatedAt
    : undefined

  setMeta({
    title: `${article.value.title} | 오늘의 이슈`,
    description: article.value.summary,
    // path가 자기 자신(/article/{slug})을 가리키므로 setMeta의 canonical 기본값도
    // 자기-canonical이 된다 — 원본 콘텐츠 출처(가이드 등)로 잘못 향하지 않도록.
    path: canonicalPath,
    type: 'article',
    image: `${SITE_URL}/og-image.png`,
  })

  useHead({
    meta: [
      { property: 'article:published_time', content: publishedAtStr },
      { property: 'article:modified_time', content: modified || publishedAtStr },
    ],
  })

  // Breadcrumb
  setBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '오늘의 이슈', url: '/article' },
    { name: article.value.title, url: canonicalPath },
  ])

  // Article JSON-LD (NewsArticle이 아닌 Article — setArticleSchema가 @type:'Article' 방출)
  setArticleSchema({
    headline: article.value.title,
    description: article.value.summary,
    datePublished: publishedAtStr,
    dateModified: modified,
    url: canonicalPath,
    image: article.value.thumbnailUrl ? `${publicApiBase}${article.value.thumbnailUrl}` : undefined,
  })
}
</script>
