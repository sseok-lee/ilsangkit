<template>
  <footer class="bg-gray-50 border-t border-gray-200 py-6 md:py-8">
    <div class="container mx-auto px-4">
      <!-- Main grid: 3 columns -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
        <!-- Categories section -->
        <div data-testid="footer-categories">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">서비스</h3>
          <ul class="space-y-1">
            <li v-for="[category, meta] in categoryEntries" :key="category">
              <NuxtLink
                :to="`/${category}`"
                class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm"
              >
                {{ meta.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Regions section -->
        <div data-testid="footer-regions">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">주요 지역</h3>
          <ul class="space-y-1">
            <li v-for="city in majorCities" :key="city.slug">
              <NuxtLink
                :to="`/${city.slug}`"
                class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm"
              >
                {{ city.name }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Info section -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-3">정보</h3>
          <nav class="flex flex-col space-y-1" aria-label="푸터 네비게이션">
            <NuxtLink
              to="/about"
              class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center"
            >
              소개
            </NuxtLink>
            <NuxtLink
              to="/privacy"
              class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center"
            >
              개인정보처리방침
            </NuxtLink>
            <NuxtLink
              to="/terms"
              class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center"
            >
              이용약관
            </NuxtLink>
            <NuxtLink
              to="/contact"
              class="text-gray-500 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center"
            >
              문의
            </NuxtLink>
          </nav>
        </div>
      </div>

      <!-- Footer Links (legacy, kept for existing tests) -->
      <div class="mb-4 md:mb-6 flex flex-wrap justify-center gap-2 md:gap-4" data-testid="footer-links">
        <nav class="contents" aria-label="푸터 하단 네비게이션">
          <NuxtLink
            to="/about"
            class="text-gray-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            소개
          </NuxtLink>
          <NuxtLink
            to="/privacy"
            class="text-gray-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            개인정보처리방침
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-gray-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            이용약관
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="text-gray-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            문의
          </NuxtLink>
        </nav>
      </div>

      <!-- Copyright -->
      <div class="text-center">
        <p class="text-xs md:text-sm text-gray-600">
          © {{ currentYear }} 일상킷. All rights reserved.
        </p>
        <p class="text-xs text-gray-400 mt-1">
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 공공데이터포털 열기"
            class="hover:text-gray-500 transition-colors"
          >공공데이터포털(data.go.kr)</a> 제공 공공데이터 활용 | 공공누리 제1유형
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

const currentYear = computed(() => new Date().getFullYear())

const categoryEntries = Object.entries(CATEGORY_META) as [FacilityCategory, typeof CATEGORY_META[FacilityCategory]][]

const majorCities = [
  { slug: 'seoul', name: '서울특별시' },
  { slug: 'busan', name: '부산광역시' },
  { slug: 'incheon', name: '인천광역시' },
  { slug: 'daegu', name: '대구광역시' },
  { slug: 'gwangju', name: '광주광역시' },
]
</script>
