<template>
  <div class="bg-background-light dark:bg-background-dark min-h-screen">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">가이드를 불러오는 중...</p>
      </div>
    </div>

    <!-- Article -->
    <article v-else-if="guide" class="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
        <NuxtLink to="/" class="hover:text-primary transition-colors">홈</NuxtLink>
        <span>/</span>
        <NuxtLink to="/guide" class="hover:text-primary transition-colors">가이드</NuxtLink>
        <span>/</span>
        <span class="text-slate-900 dark:text-white font-medium truncate">{{ guide.title }}</span>
      </nav>

      <!-- Category Tag -->
      <span class="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-4">
        {{ categoryLabel }}
      </span>

      <!-- Title -->
      <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
        {{ guide.title }}
      </h1>

      <!-- Meta -->
      <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <time :datetime="guide.createdAt">{{ formatDate(guide.createdAt) }}</time>
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">visibility</span>
          {{ guide.viewCount.toLocaleString() }}
        </span>
      </div>

      <!-- Thumbnail -->
      <div v-if="guide.thumbnailUrl" class="mb-8 rounded-xl overflow-hidden">
        <img
          :src="guide.thumbnailUrl"
          :alt="guide.title"
          class="w-full aspect-video object-cover"
        />
      </div>

      <!-- Markdown Content -->
      <div
        class="
          prose prose-slate dark:prose-invert max-w-none
          prose-headings:font-bold
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700
          prose-h3:text-lg prose-h3:mt-6
          prose-p:leading-relaxed prose-p:text-slate-700 dark:prose-p:text-slate-300
          prose-li:leading-relaxed
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-900 dark:prose-strong:text-white
          prose-ul:my-4 prose-ol:my-4
        "
        v-html="renderedContent"
      ></div>

      <!-- Keywords -->
      <div v-if="guide.keywords" class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="keyword in keywordList"
            :key="keyword"
            class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-full"
          >
            #{{ keyword }}
          </span>
        </div>
      </div>

      <!-- Back to list -->
      <div class="mt-8">
        <NuxtLink
          to="/guide"
          class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          목록으로 돌아가기
        </NuxtLink>
      </div>
    </article>

    <!-- Not Found -->
    <div v-else class="py-20 text-center">
      <span class="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4 block">error</span>
      <p class="text-slate-600 dark:text-slate-400 font-medium">가이드를 찾을 수 없습니다</p>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import { useGuides } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import { SITE_URL } from '~/utils/seoConstants'
import type { GuideDetail } from '~/composables/useGuides'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { fetchGuideBySlug } = useGuides()
const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema } = useStructuredData()

const guide = ref<GuideDetail | null>(null)
const loading = ref(true)

const categoryLabel = computed(() => {
  if (!guide.value) return ''
  return CATEGORY_META[guide.value.category as FacilityCategory]?.label ?? guide.value.category
})

const renderedContent = computed(() => {
  if (!guide.value?.content) return ''
  return marked(guide.value.content) as string
})

const keywordList = computed(() => {
  if (!guide.value?.keywords) return []
  return guide.value.keywords.split(',').map(k => k.trim()).filter(Boolean)
})

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    guide.value = await fetchGuideBySlug(slug.value)

    // SEO meta
    setMeta({
      title: guide.value.title,
      description: guide.value.summary,
      path: `/guide/${guide.value.slug}`,
      type: 'article',
      image: guide.value.thumbnailUrl || undefined,
    })

    // Breadcrumb
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: '생활 가이드', url: '/guide' },
      { name: guide.value.title, url: `/guide/${guide.value.slug}` },
    ])

    // Article JSON-LD
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: guide.value.title,
            description: guide.value.summary,
            image: guide.value.thumbnailUrl || undefined,
            datePublished: guide.value.createdAt,
            dateModified: guide.value.updatedAt,
            url: `${SITE_URL}/guide/${guide.value.slug}`,
            publisher: {
              '@type': 'Organization',
              name: '일상킷',
              url: SITE_URL,
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/guide/${guide.value.slug}`,
            },
          }),
        },
      ],
    })
  } catch {
    guide.value = null
  } finally {
    loading.value = false
  }
})
</script>
