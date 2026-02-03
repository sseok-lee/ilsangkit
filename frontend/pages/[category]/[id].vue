<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col text-[#0d131c] dark:text-white">
    <!-- Mobile Header -->
    <header
      class="flex items-center justify-between px-4 py-3 bg-white dark:bg-background-dark sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 md:hidden"
    >
      <button
        class="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-slate-800 dark:text-white"
        @click="router.back()"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <NuxtLink to="/" class="flex items-center gap-2">
        <div class="size-6 bg-primary rounded-lg flex items-center justify-center text-white">
          <span class="material-symbols-outlined text-[16px]">location_on</span>
        </div>
        <h2 class="text-slate-900 dark:text-white text-lg font-bold tracking-tight">일상킷</h2>
      </NuxtLink>
      <div class="w-10"></div>
    </header>

    <!-- Desktop Header -->
    <header
      class="hidden md:flex sticky top-0 z-50 w-full bg-white dark:bg-[#1a2634] border-b border-[#e7ecf4] dark:border-gray-800"
    >
      <div class="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between w-full">
        <div class="flex items-center gap-8">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="size-8 text-primary">
              <span class="material-symbols-outlined text-[32px]">location_on</span>
            </div>
            <h2 class="text-[#0d131c] dark:text-white text-xl font-bold tracking-tight">일상킷</h2>
          </NuxtLink>
          <!-- Desktop Nav Links -->
          <nav class="hidden md:flex items-center gap-8">
            <NuxtLink to="/search" class="text-[#0d131c] dark:text-gray-200 text-sm font-medium hover:text-primary transition-colors">
              시설 검색
            </NuxtLink>
            <NuxtLink to="/search?useLocation=true" class="text-[#0d131c] dark:text-gray-200 text-sm font-medium hover:text-primary transition-colors">
              내 주변
            </NuxtLink>
          </nav>
        </div>
        <!-- Search (Desktop) -->
        <div class="flex items-center gap-4 flex-1 justify-end max-w-lg">
          <div class="hidden sm:flex relative w-full max-w-xs h-10 group bg-[#e7ecf4] dark:bg-gray-800 rounded-xl overflow-hidden focus-within:ring-2 ring-primary/20 transition-all">
            <div class="flex items-center justify-center pl-3 text-[#48699d] dark:text-gray-400">
              <span class="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input class="w-full bg-transparent border-none text-sm text-[#0d131c] dark:text-white placeholder-[#48699d] dark:placeholder-gray-500 focus:ring-0 h-full px-3" placeholder="시설 검색..."/>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-lg mx-auto px-4 py-20 text-center">
        <span class="material-symbols-outlined text-[64px] text-red-500 mb-4">error</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">시설 정보를 불러올 수 없습니다</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error.message }}</p>
        <button
          class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          @click="router.back()"
        >
          돌아가기
        </button>
      </div>

      <!-- Facility Detail -->
      <template v-else-if="facility">
        <!-- Mobile: Map at top -->
        <div class="md:hidden relative h-[180px] w-full bg-gray-200 dark:bg-gray-800">
          <ClientOnly>
            <FacilityMap
              :center="{ lat: facility.lat, lng: facility.lng }"
              :facilities="[facility]"
              :level="3"
              class="w-full h-full"
            />
          </ClientOnly>

          <!-- Back Button Overlay -->
          <div class="absolute top-4 left-4 z-20 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="router.back()">
            <span class="material-symbols-outlined text-[#111518]">arrow_back</span>
          </div>

          <!-- Map Marker Overlay -->
          <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[80%] flex flex-col items-center pointer-events-none">
            <span class="material-symbols-outlined filled text-5xl text-primary drop-shadow-md">location_on</span>
          </div>

          <!-- Gradient Overlay at bottom -->
          <div class="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background-light to-transparent dark:from-background-dark"></div>
        </div>

        <!-- Mobile: Title Section -->
        <div class="md:hidden px-4 pt-2 pb-4 bg-background-light dark:bg-background-dark">
          <div class="flex flex-col gap-2">
            <h1 class="text-[26px] font-bold leading-tight text-slate-900 dark:text-white">{{ facility.name }}</h1>
            <div class="flex items-center">
              <span class="inline-flex items-center rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {{ categoryMeta.icon }} {{ categoryMeta.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Desktop: Two Column Layout -->
        <div class="hidden md:block max-w-[1280px] mx-auto px-6 py-8">
          <!-- Breadcrumbs -->
          <nav class="flex flex-wrap gap-2 mb-6 items-center text-sm">
            <NuxtLink to="/" class="text-[#48699d] dark:text-gray-400 font-medium hover:text-primary transition-colors">
              홈
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <NuxtLink
              :to="`/search?keyword=${facility.city}`"
              class="text-[#48699d] dark:text-gray-400 font-medium hover:text-primary transition-colors"
            >
              {{ facility.city }}
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <span class="text-[#0d131c] dark:text-white font-semibold">{{ facility.district }}</span>
          </nav>

          <div class="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 items-start">
            <!-- Left Column: Details -->
            <div class="flex flex-col gap-8 w-full">
              <!-- Page Heading & Badges -->
              <div class="flex flex-col gap-3 pt-2">
                <div class="flex items-start justify-between">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-900/40 dark:text-purple-300">
                    <span class="material-symbols-outlined text-[14px]">{{ categoryMeta.icon === '🚻' ? 'wc' : 'place' }}</span> {{ categoryMeta.label }}
                  </span>
                  <div class="flex gap-2">
                    <button class="text-[#60708a] hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" @click="handleShare">
                      <span class="material-symbols-outlined">share</span>
                    </button>
                  </div>
                </div>
                <h1 class="text-[#111418] dark:text-white text-3xl font-bold leading-tight tracking-tight">
                  {{ facility.name }}
                </h1>
              </div>

              <!-- Basic Info Card -->
              <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center justify-between">
                  <h3 class="text-[#111418] dark:text-white text-lg font-bold">기본정보</h3>
                </div>
                <div class="p-5 flex flex-col gap-4">
                  <!-- Address -->
                  <div class="flex gap-4 items-start">
                    <div class="mt-0.5 text-[#60708a] dark:text-gray-400">
                      <span class="material-symbols-outlined">location_on</span>
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                      <p class="text-[#111418] dark:text-white text-base font-medium">
                        {{ facility.roadAddress || facility.address }}
                      </p>
                    </div>
                    <button class="ml-auto text-primary text-sm font-medium hover:underline whitespace-nowrap" @click="copyAddress">복사</button>
                  </div>

                  <div class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

                  <!-- Operating Hours -->
                  <div v-if="facility.details?.operatingHours || isOpen24Hours" class="flex gap-4 items-start">
                    <div class="mt-0.5 text-[#60708a] dark:text-gray-400">
                      <span class="material-symbols-outlined">schedule</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class="text-[#111418] dark:text-white text-base font-medium">{{ facility.details?.operatingHours || '24시간 운영' }}</p>
                        <span v-if="isOpen24Hours" class="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800">
                          <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          운영중
                        </span>
                      </div>
                    </div>
                  </div>

                  <div v-if="facility.details?.phone" class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

                  <!-- Phone -->
                  <div v-if="facility.details?.phone" class="flex gap-4 items-center">
                    <div class="text-[#60708a] dark:text-gray-400">
                      <span class="material-symbols-outlined">call</span>
                    </div>
                    <p class="text-[#111418] dark:text-white text-base font-medium">{{ facility.details.phone }}</p>
                  </div>
                </div>
              </div>

              <!-- Facility Status Card -->
              <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
                  <h3 class="text-[#111418] dark:text-white text-lg font-bold">시설현황</h3>
                </div>
                <div class="p-5">
                  <div class="grid grid-cols-2 gap-4">
                    <!-- Toilet Stalls (if applicable) -->
                    <template v-if="facility.category === 'toilet'">
                      <div v-if="facility.details?.maleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30">
                            <span class="material-symbols-outlined">man</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">남자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418] dark:text-white">{{ facility.details.maleToilets }}칸</span>
                      </div>
                      <div v-if="facility.details?.femaleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-pink-50 text-pink-600 rounded-full dark:bg-pink-900/30">
                            <span class="material-symbols-outlined">woman</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">여자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418] dark:text-white">{{ facility.details.femaleToilets }}칸</span>
                      </div>
                    </template>

                    <!-- Feature Cards -->
                    <div
                      v-for="amenity in facilityAmenities"
                      :key="amenity"
                      class="bg-white dark:bg-[#1a2630] border border-[#e5e7eb] dark:border-gray-700 rounded-lg p-3 flex flex-col items-center justify-center gap-2 text-center"
                    >
                      <span class="material-symbols-outlined text-primary text-3xl">{{ getAmenityIcon(amenity) }}</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ amenity }}</span>
                      <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full dark:bg-green-900/40 dark:text-green-400">설치됨</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Location Guide Card -->
              <div v-if="facility.city || facility.district" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
                  <h3 class="text-[#111418] dark:text-white text-lg font-bold">위치안내</h3>
                </div>
                <div class="p-5">
                  <div class="flex gap-3">
                    <span class="material-symbols-outlined text-primary shrink-0">info</span>
                    <p class="text-[#4b5563] dark:text-slate-300 text-sm leading-relaxed">
                      {{ facility.district || facility.city }} 지역에 위치해 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Map & Actions (Desktop) -->
            <div class="lg:sticky lg:top-24 w-full flex flex-col">
              <!-- Map Container -->
              <div class="relative w-full aspect-square bg-[#e5e7eb] dark:bg-gray-700 h-full rounded-xl overflow-hidden shadow-md">
                <ClientOnly>
                  <FacilityMap
                    :center="{ lat: facility.lat, lng: facility.lng }"
                    :facilities="[facility]"
                    :level="3"
                    class="w-full h-full opacity-80"
                  />
                </ClientOnly>

                <!-- Custom Marker -->
                <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center group cursor-pointer">
                  <!-- Tooltip -->
                  <div class="mb-2 bg-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 flex flex-col items-center whitespace-nowrap animate-bounce dark:bg-gray-900 dark:border-gray-700">
                    <span class="text-sm font-bold text-gray-900 dark:text-white">{{ facility.name }}</span>
                    <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-100 transform rotate-45 dark:bg-gray-900 dark:border-gray-700"></div>
                  </div>
                  <!-- Pin Icon -->
                  <div class="relative">
                    <div class="w-12 h-12 bg-primary rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white z-20 relative dark:border-gray-800">
                      <span class="material-symbols-outlined text-[24px]">wc</span>
                    </div>
                    <!-- Ripple Effect -->
                    <div class="absolute top-0 left-0 w-12 h-12 bg-primary rounded-full opacity-30 animate-ping"></div>
                  </div>
                </div>

                <!-- Map Controls -->
                <div class="absolute top-4 right-4 flex flex-col gap-2 z-10">
                  <button aria-label="My Location" class="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-gray-700 hover:text-primary transition-colors border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                    <span class="material-symbols-outlined">my_location</span>
                  </button>
                  <div class="flex flex-col bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                    <button aria-label="Zoom In" class="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 border-b border-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 dark:border-gray-700">
                      <span class="material-symbols-outlined">add</span>
                    </button>
                    <button aria-label="Zoom Out" class="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                      <span class="material-symbols-outlined">remove</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Action Buttons (Desktop Sticky Bottom) -->
              <div class="mt-4 p-4 bg-white border-t border-[#e5e7eb] flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-xl dark:bg-[#1a2630] dark:border-gray-800">
                <button
                  class="flex-1 h-12 rounded-xl bg-[#f0f2f5] text-[#111418] font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined">share</span>
                  공유하기
                </button>
                <a
                  :href="kakaoMapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex-[2] h-12 rounded-xl bg-primary text-white font-bold text-base hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  <span class="material-symbols-outlined">directions</span>
                  길찾기
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: Info Section -->
        <div class="md:hidden px-4 flex flex-col gap-4">
          <!-- Address Card -->
          <div class="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-gray-900/5 dark:bg-[#1a2630] dark:ring-white/10">
            <div class="flex items-center gap-3 overflow-hidden">
              <span class="material-symbols-outlined shrink-0 text-gray-400">map</span>
              <p class="truncate text-base font-medium text-slate-700 dark:text-slate-200">{{ facility.roadAddress || facility.address }}</p>
            </div>
            <button class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700" @click="copyAddress">
              <span class="material-symbols-outlined text-[20px]">content_copy</span>
            </button>
          </div>

          <!-- Operating Info Card -->
          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-[#1a2630] dark:ring-white/10">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-400">schedule</span>
                <span class="text-base font-bold text-slate-900 dark:text-white">운영 정보</span>
              </div>
              <span v-if="isOpen24Hours" class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                24시간 운영
              </span>
            </div>
            <div v-if="facility.details?.phone" class="flex items-center gap-3 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
              <span class="material-symbols-outlined text-slate-400">call</span>
              <a class="text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:text-blue-600 dark:text-blue-400" :href="`tel:${facility.details.phone}`">{{ facility.details.phone }}</a>
            </div>
          </div>

          <!-- Facility Info Card -->
          <div class="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-[#1a2630] dark:ring-white/10">
            <div class="mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-slate-400">wc</span>
              <span class="text-base font-bold text-slate-900 dark:text-white">시설 정보</span>
            </div>

            <!-- Toilet Count Grid -->
            <div v-if="facility.category === 'toilet' && (facility.details?.femaleToilets || facility.details?.maleToilets)" class="mb-5 grid grid-cols-2 gap-3">
              <div class="flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 py-3 dark:bg-[#23303b]">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400">여자 화장실</span>
                <span class="text-lg font-bold text-slate-900 dark:text-white">{{ facility.details?.femaleToilets || 0 }}칸</span>
              </div>
              <div class="flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 py-3 dark:bg-[#23303b]">
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400">남자 화장실</span>
                <span class="text-lg font-bold text-slate-900 dark:text-white">{{ facility.details?.maleToilets || 0 }}칸</span>
              </div>
            </div>

            <!-- Feature Badges -->
            <div v-if="facilityAmenities.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="amenity in facilityAmenities"
                :key="amenity"
                class="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-[#23303b] dark:text-slate-200"
              >
                {{ amenity }} <span class="text-green-500 text-[10px] dark:text-green-400">✅</span>
              </span>
            </div>
          </div>

          <!-- Location Guide Card -->
          <div v-if="facility.city || facility.district" class="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-[#1a2630] dark:ring-white/10">
            <div class="flex items-start gap-4">
              <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
                <span class="material-symbols-outlined text-primary">directions_subway</span>
              </div>
              <div class="flex flex-col pt-0.5">
                <span class="text-sm font-bold text-slate-900 dark:text-white">찾아오시는 길</span>
                <p class="mt-1 text-sm font-medium leading-snug text-slate-600 dark:text-slate-300">
                  {{ facility.district || facility.city }} 지역
                </p>
              </div>
            </div>
          </div>

          <div class="h-8"></div>
        </div>

        <!-- Mobile: Sticky Bottom CTA -->
        <div class="md:hidden fixed bottom-0 left-0 z-50 w-full bg-white/95 px-4 pb-8 pt-4 shadow-[0_-4px_16px_-1px_rgba(0,0,0,0.05)] backdrop-blur-sm dark:bg-[#101b22]/95 dark:border-t dark:border-gray-800">
          <a
            :href="kakaoMapUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b82f6] py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-[20px]">near_me</span>
            길찾기
          </a>
        </div>

        <!-- Bottom padding for mobile CTA -->
        <div class="md:hidden h-24"></div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityDetail } from '~/composables/useFacilityDetail'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import FacilityMap from '~/components/map/FacilityMap.vue'
import FacilityFeatureCard from '~/components/facility/FacilityFeatureCard.vue'

const route = useRoute()
const router = useRouter()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

const { loading, error, facility, fetchDetail } = useFacilityDetail()

// Fetch facility detail on mount
onMounted(async () => {
  await fetchDetail(category.value, id.value)
})

// Category metadata
const categoryMeta = computed(() => CATEGORY_META[category.value] || { label: category.value, icon: '📍' })

// Check if 24 hours
const isOpen24Hours = computed(() => {
  if (!facility.value?.details) return false
  return facility.value.details.operatingHours === '24시간' || facility.value.details.is24Hour
})

// Generate map URL
const kakaoMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
})

// Format distance
const formatDistance = (distance: number): string => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}

// Facility features for cards (using Material Icons)
const facilityFeatures = computed(() => {
  if (!facility.value?.details) return []

  const features: Array<{ icon: string; label: string; value: string; color: string; materialIcon?: string }> = []
  const details = facility.value.details

  // Toilet specific
  if (facility.value.category === 'toilet') {
    if (details.femaleToilets !== undefined) {
      features.push({ icon: '♀', label: '여성용', value: `${details.femaleToilets}개`, color: 'pink', materialIcon: 'woman' })
    }
    if (details.maleToilets !== undefined) {
      features.push({ icon: '♂', label: '남성용', value: `${details.maleToilets}개`, color: 'blue', materialIcon: 'man' })
    }
    if (details.hasDisabledToilet) {
      features.push({ icon: '♿', label: '장애인 화장실', value: '있음', color: 'purple', materialIcon: 'accessible' })
    }
  }

  // Kiosk specific
  if (facility.value.category === 'kiosk') {
    if (details.weekdayOperatingHours) {
      features.push({ icon: '🕐', label: '평일', value: details.weekdayOperatingHours, color: 'indigo', materialIcon: 'schedule' })
    }
    if (details.saturdayOperatingHours) {
      features.push({ icon: '🕐', label: '토요일', value: details.saturdayOperatingHours, color: 'purple', materialIcon: 'schedule' })
    }
  }

  // Wifi specific
  if (facility.value.category === 'wifi') {
    if (details.ssid) {
      features.push({ icon: '📶', label: 'SSID', value: details.ssid, color: 'green', materialIcon: 'wifi' })
    }
  }

  return features
})

// Facility amenities checklist
const facilityAmenities = computed(() => {
  if (!facility.value?.details) return []

  const amenities: string[] = []
  const details = facility.value.details

  // Toilet amenities
  if (details.hasDisabledToilet) amenities.push('장애인 화장실')
  if (details.hasDiaperChangingTable) amenities.push('기저귀 교환대')
  if (details.hasEmergencyBell) amenities.push('비상벨')
  if (details.hasCCTV) amenities.push('CCTV')
  if (details.hasChildToilet) amenities.push('어린이 화장실')

  // Kiosk amenities
  if (details.hasDisabledAccess) amenities.push('장애인 편의시설')

  return amenities
})

// Get amenity icon
const getAmenityIcon = (amenity: string): string => {
  const iconMap: Record<string, string> = {
    '장애인 화장실': 'accessible',
    '장애인 편의시설': 'accessible',
    '기저귀 교환대': 'baby_changing_station',
    '비상벨': 'emergency',
    'CCTV': 'videocam',
    '어린이 화장실': 'child_care',
  }
  return iconMap[amenity] || 'check_circle'
}

// Actions
const copyAddress = async () => {
  if (!facility.value) return
  const address = facility.value.roadAddress || facility.value.address
  try {
    await navigator.clipboard.writeText(address)
    alert('주소가 복사되었습니다.')
  } catch (err) {
    console.error('주소 복사 실패:', err)
  }
}

const handleShare = async () => {
  if (!facility.value) return

  const shareData = {
    title: facility.value.name,
    text: `${facility.value.name} - ${facility.value.roadAddress || facility.value.address}`,
    url: window.location.href,
  }

  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
