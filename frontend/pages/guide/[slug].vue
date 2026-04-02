<template>
  <div class="bg-background-light min-h-screen">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 text-sm">가이드를 불러오는 중...</p>
      </div>
    </div>

    <!-- Article -->
    <article v-else-if="guide" class="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <NuxtLink to="/" class="hover:text-primary transition-colors">홈</NuxtLink>
        <span>/</span>
        <NuxtLink to="/guide" class="hover:text-primary transition-colors">가이드</NuxtLink>
        <span>/</span>
        <span class="text-slate-900 font-medium truncate">{{ guide.title }}</span>
      </nav>

      <!-- Category Tag -->
      <span class="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-4">
        {{ categoryLabel }}
      </span>

      <!-- Title -->
      <h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-4 leading-tight">
        {{ guide.title }}
      </h1>

      <!-- Meta -->
      <div class="flex items-center gap-4 text-sm text-slate-500 mb-6 pb-6 border-b border-slate-200">
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">edit_note</span>
          일상킷 편집팀
        </span>
        <time :datetime="guide.createdAt">{{ formatDate(guide.createdAt) }}</time>
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">visibility</span>
          {{ guide.viewCount.toLocaleString() }}
        </span>
      </div>

      <!-- Thumbnail -->
      <div v-if="guide.thumbnailUrl" class="mb-8 rounded-xl overflow-hidden">
        <img
          :src="`${config.public.apiBase}${guide.thumbnailUrl}`"
          :alt="guide.title"
          width="800"
          height="450"
          class="w-full aspect-video object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 800px"
        />
      </div>

      <!-- Markdown Content -->
      <div
        class="
          prose prose-slate max-w-none
          prose-headings:font-bold
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200
          prose-h3:text-lg prose-h3:mt-6
          prose-p:leading-relaxed prose-p:text-slate-700
          prose-li:leading-relaxed
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-900
          prose-ul:my-4 prose-ol:my-4
        "
        v-html="renderedContent"
      ></div>

      <!-- Keywords -->
      <div v-if="guide.keywords" class="mt-8 pt-6 border-t border-slate-200">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="keyword in keywordList"
            :key="keyword"
            class="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
          >
            #{{ keyword }}
          </span>
        </div>
      </div>

      <!-- AI 작성 안내 -->
      <div class="mt-8 border-l-4 border-slate-300 bg-slate-50 rounded-r-lg p-4">
        <p class="text-xs font-semibold text-slate-500 mb-1">AI 작성 안내</p>
        <p class="text-xs text-slate-500 leading-relaxed">
          본 콘텐츠는 인공지능(AI) 기술을 활용하여 정보를 정리 및 요약한 글입니다.
          내용의 정확성을 보증하지 않으며, 투자나 법적 판단의 근거로 활용하기에는
          적합하지 않을 수 있습니다. 정확한 정보는 관련 기관의 공식 자료를 확인해
          주시기 바랍니다.
        </p>
      </div>

      <!-- 관련 정보 -->
      <nav data-testid="guide-related-categories" class="mt-8 pt-6 border-t border-slate-200">
        <h2 class="text-base font-bold text-slate-900 mb-3">관련 정보</h2>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="cat in relatedGuideCategories"
            :key="cat"
            :to="`/${cat}`"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            {{ CATEGORY_META[cat as FacilityCategory]?.label || cat }}
          </NuxtLink>
        </div>
      </nav>

      <!-- Back to list -->
      <div class="mt-8">
        <NuxtLink
          to="/guide"
          class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          목록으로 돌아가기
        </NuxtLink>
      </div>
    </article>

    <!-- Not Found -->
    <div v-else class="py-20 text-center">
      <span class="material-symbols-outlined text-[48px] text-slate-300 mb-4 block">error</span>
      <p class="text-slate-600 font-medium">가이드를 찾을 수 없습니다</p>
      <NuxtLink
        to="/guide"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors mt-4"
      >
        가이드 목록 보기
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { useGuides } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import { REAL_ESTATE_META } from '~/utils/realEstateMeta'
import { SITE_URL, RELATED_CATEGORIES } from '~/utils/seoConstants'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const config = useRuntimeConfig()
const { fetchGuideBySlug } = useGuides()
const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setFAQSchema, setHowToSchema } = useStructuredData()

// SSR 호환: useAsyncData로 가이드 데이터 가져오기 (서버에서도 실행)
const { data: guide, status } = await useAsyncData(
  `guide-${slug.value}`,
  () => fetchGuideBySlug(slug.value),
)

// 가이드를 찾을 수 없으면 404 반환 (SSR에서 HTTP 404 상태 코드 전송)
if (!guide.value) {
  throw createError({ statusCode: 404, statusMessage: '가이드를 찾을 수 없습니다' })
}

const loading = computed(() => status.value === 'pending')

const categoryLabel = computed(() => {
  if (!guide.value) return ''
  const category = guide.value.category
  const facilityLabel = CATEGORY_META[category as FacilityCategory]?.label
  if (facilityLabel) return facilityLabel
  const camelKey = category.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
  return REAL_ESTATE_META[camelKey as keyof typeof REAL_ESTATE_META]?.label ?? category
})

const renderedContent = computed(() => {
  if (!guide.value?.content) return ''
  const rawHtml = marked(guide.value.content) as string
  return DOMPurify.sanitize(rawHtml)
})

const keywordList = computed(() => {
  if (!guide.value?.keywords) return []
  return guide.value.keywords.split(',').map(k => k.trim()).filter(Boolean)
})

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
  const guideYear = new Date(guide.value.updatedAt || guide.value.createdAt).getFullYear()
  setMeta({
    title: `${guide.value.title} [${guideYear}년]`,
    description: guide.value.summary,
    path: `/guide/${guide.value.slug}`,
    type: 'article',
    image: guide.value.thumbnailUrl ? `${config.public.apiBase}${guide.value.thumbnailUrl}` : undefined,
  })

  useHead({
    meta: [
      { property: 'article:published_time', content: guide.value.createdAt },
      { property: 'article:modified_time', content: guide.value.updatedAt || guide.value.createdAt },
    ],
  })

  // Breadcrumb
  setBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '생활 가이드', url: '/guide' },
    { name: guide.value.title, url: `/guide/${guide.value.slug}` },
  ])

  // Article JSON-LD (publisher.logo 포함)
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.value.title,
          description: guide.value.summary,
          image: guide.value.thumbnailUrl ? `${config.public.apiBase}${guide.value.thumbnailUrl}` : undefined,
          datePublished: guide.value.createdAt,
          dateModified: guide.value.updatedAt,
          url: `${SITE_URL}/guide/${guide.value.slug}`,
          author: {
            '@type': 'Organization',
            name: '일상킷 편집팀',
            url: `${SITE_URL}/about`,
          },
          publisher: {
            '@type': 'Organization',
            name: '일상킷',
            url: SITE_URL,
            logo: {
              '@type': 'ImageObject',
              url: `${SITE_URL}/icons/logo.webp`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/guide/${guide.value.slug}`,
          },
        }),
      },
    ],
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
