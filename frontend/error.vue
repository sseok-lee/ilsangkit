<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <Head>
      <Title>{{ statusCode === 404 ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다' }} - 일상킷</Title>
      <Meta name="description" :content="description" />
      <Meta name="robots" content="noindex, nofollow" />
      <Meta property="og:title" :content="`${title} - 일상킷`" />
      <Meta property="og:description" :content="description" />
    </Head>

    <div class="max-w-lg w-full text-center">
      <p class="text-8xl font-bold text-blue-500 mb-4">{{ statusCode }}</p>
      <h1 class="text-2xl font-bold text-gray-900 mb-3">{{ title }}</h1>
      <p class="text-gray-500 mb-8">{{ description }}</p>

      <a
        href="/"
        class="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        홈으로 돌아가기
      </a>

      <!-- 404일 때 카테고리 바로가기 -->
      <div v-if="statusCode === 404" class="mt-12">
        <p class="text-sm text-gray-500 mb-4">찾으시는 정보가 있으신가요?</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <a
            v-for="cat in categories"
            :key="cat.slug"
            :href="`/${cat.slug}`"
            class="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all text-center text-sm font-medium text-gray-700"
          >
            {{ cat.label }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string }
}>()

const statusCode = props.error?.statusCode ?? 500
const title = statusCode === 404 ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'
const description = statusCode === 404
  ? '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.'
  : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

// 카테고리 바로가기 (inline으로 정의 - SSR 안전)
const categories = [
  { slug: 'toilet', label: '공공화장실' },
  { slug: 'wifi', label: '무료 와이파이' },
  { slug: 'parking', label: '공영주차장' },
  { slug: 'hospital', label: '병원' },
  { slug: 'pharmacy', label: '약국' },
  { slug: 'aed', label: '자동심장충격기' },
]
</script>
