<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col text-[#0d131c] dark:text-white">
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
        <div class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200 dark:bg-gray-800">
          <ClientOnly>
            <FacilityMap
              :center="{ lat: facility.lat, lng: facility.lng }"
              :facilities="[facility]"
              :level="3"
              class="w-full h-full"
            />
          </ClientOnly>

          <!-- Back Button & Name Overlay -->
          <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div class="flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="router.back()">
              <span class="material-symbols-outlined text-[#111518]">arrow_back</span>
            </div>
            <span class="max-w-[calc(100vw-100px)] truncate rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-[#111518] shadow-sm backdrop-blur-sm">{{ facility.name }}</span>
          </div>

          <!-- Gradient Overlay at bottom -->
          <div class="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background-light to-transparent dark:from-background-dark"></div>

          <!-- Map expand button -->
          <button
            class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white dark:hover:bg-slate-800 transition-colors"
            @click="isMapExpanded = true"
          >
            <span class="material-symbols-outlined text-[16px]">open_in_full</span>
            지도 크게 보기
          </button>

          <!-- Directions Button (Mobile) -->
          <a
            :href="`https://map.kakao.com/link/to/${encodeURIComponent(facility.name)},${facility.lat},${facility.lng}`"
            target="_blank"
            rel="noopener noreferrer"
            class="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">directions</span>
            길찾기
          </a>
        </div>

        <!-- Fullscreen Map Overlay (Mobile) -->
        <Teleport to="body">
          <Transition
            enter-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="isMapExpanded && facility"
              class="md:hidden fixed inset-0 z-[60] bg-background-light dark:bg-background-dark"
            >
              <!-- Header -->
              <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 dark:from-slate-900/80 to-transparent">
                <button
                  class="flex size-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 shadow-sm backdrop-blur-sm"
                  @click="isMapExpanded = false"
                >
                  <span class="material-symbols-outlined text-slate-700 dark:text-slate-200">close</span>
                </button>
                <span class="text-sm font-bold text-slate-900 dark:text-white bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ facility.name }}</span>
                <a
                  :href="`https://map.kakao.com/link/to/${encodeURIComponent(facility.name)},${facility.lat},${facility.lng}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex size-10 items-center justify-center rounded-full bg-primary text-white shadow-sm"
                >
                  <span class="material-symbols-outlined text-[20px]">directions</span>
                </a>
              </div>
              <!-- Full screen map -->
              <ClientOnly>
                <FacilityMap
                  :center="{ lat: facility.lat, lng: facility.lng }"
                  :facilities="[facility]"
                  :level="3"
                  class="w-full h-full"
                />
              </ClientOnly>
            </div>
          </Transition>
        </Teleport>

        <!-- Desktop: Two Column Layout -->
        <div class="hidden md:block max-w-[1280px] mx-auto px-6 py-8">
          <!-- Breadcrumbs -->
          <nav class="flex flex-wrap gap-2 mb-6 items-center text-sm">
            <NuxtLink to="/" class="text-[#48699d] dark:text-gray-400 font-medium hover:text-primary transition-colors">
              홈
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <NuxtLink
              :to="getCityHubPath(facility.city)"
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
                    <span class="material-symbols-outlined text-[14px]">place</span> {{ categoryMeta.label }}
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
                  <h2 class="text-[#111418] dark:text-white text-lg font-bold">기본정보</h2>
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

                  <div v-if="details?.operatingHours || isOpen24Hours || details?.phoneNumber" class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

                  <!-- Operating Hours -->
                  <div v-if="details?.operatingHours || isOpen24Hours" class="flex gap-4 items-start">
                    <div class="mt-0.5 text-[#60708a] dark:text-gray-400">
                      <span class="material-symbols-outlined">schedule</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class="text-[#111418] dark:text-white text-base font-medium">{{ details?.operatingHours || '24시간 운영' }}</p>
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

                  <div v-if="details?.phoneNumber && (details?.operatingHours || isOpen24Hours)" class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

                  <!-- Phone -->
                  <div v-if="details?.phoneNumber" class="flex gap-4 items-center">
                    <div class="text-[#60708a] dark:text-gray-400">
                      <span class="material-symbols-outlined">call</span>
                    </div>
                    <a :href="`tel:${details?.phoneNumber}`" class="text-primary text-base font-medium hover:underline">{{ details?.phoneNumber }}</a>
                  </div>
                </div>
              </div>

              <!-- Facility Status Card -->
              <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
                  <h2 class="text-[#111418] dark:text-white text-lg font-bold">시설현황</h2>
                </div>
                <div class="p-5">
                  <div v-if="hasGridContent" class="grid grid-cols-2 gap-4">
                    <!-- Toilet Stalls (if applicable) -->
                    <template v-if="facility.category === 'toilet'">
                      <div v-if="details?.maleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30">
                            <span class="material-symbols-outlined">man</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">남자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.maleToilets }}칸</span>
                      </div>
                      <div v-if="details?.femaleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-pink-50 text-pink-600 rounded-full dark:bg-pink-900/30">
                            <span class="material-symbols-outlined">woman</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">여자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.femaleToilets }}칸</span>
                      </div>
                      <div v-if="details?.maleUrinals" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30">
                            <span class="material-symbols-outlined">man</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">남성용 소변기</span>
                        </div>
                        <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.maleUrinals }}개</span>
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

                  <!-- Toilet Extra Details -->
                  <template v-if="facility.category === 'toilet'">
                    <div v-if="details?.openTime || details?.managingOrg || details?.facilityType || details?.ownershipType || details?.installDate" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.facilityType" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">시설유형</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.facilityType }}</span>
                      </div>
                      <div v-if="details?.openTime" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">개방시간</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.openTime }}</span>
                      </div>
                      <div v-if="details?.managingOrg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managingOrg }}</span>
                      </div>
                      <div v-if="details?.ownershipType" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">소유구분</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.ownershipType }}</span>
                      </div>
                      <div v-if="details?.installDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치일</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installDate }}</span>
                      </div>
                    </div>

                    <!-- Toilet Accessibility Details -->
                    <div v-if="toiletAccessibilityDetails.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">접근성 상세</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div
                          v-for="item in toiletAccessibilityDetails"
                          :key="item.label"
                          class="bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700"
                        >
                          <span class="text-sm text-[#4b5563] dark:text-slate-300">{{ item.label }}</span>
                          <span class="text-sm font-bold text-[#111418] dark:text-white">{{ item.value }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Emergency Bell / Diaper Changing Location -->
                    <div v-if="details?.emergencyBellLocation || details?.diaperChangingLocation" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">편의시설 위치</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.emergencyBellLocation" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">비상벨 위치</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.emergencyBellLocation }}</span>
                        </div>
                        <div v-if="details?.diaperChangingLocation" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">기저귀교환대 위치</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.diaperChangingLocation }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Wifi Details -->
                  <template v-if="facility.category === 'wifi'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.ssid" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">SSID</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.ssid }}</span>
                      </div>
                      <div v-if="details?.installLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 장소</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installLocation }}</span>
                      </div>
                      <div v-if="details?.installLocationDetail && details?.installLocationDetail !== details?.installLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 장소 상세</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installLocationDetail }}</span>
                      </div>
                      <div v-if="details?.serviceProvider" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">서비스 제공사</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.serviceProvider }}</span>
                      </div>
                      <div v-if="details?.installDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치일</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installDate }}</span>
                      </div>
                      <div v-if="details?.managementAgency" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managementAgency }}</span>
                      </div>
                      <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">연락처</span>
                        <a :href="`tel:${details?.phoneNumber}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phoneNumber }}</a>
                      </div>
                    </div>
                  </template>

                  <!-- Clothes Details -->
                  <template v-if="facility.category === 'clothes'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.detailLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">상세 위치</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detailLocation }}</span>
                      </div>
                      <div v-if="details?.managementAgency" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managementAgency }}</span>
                      </div>
                      <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">연락처</span>
                        <a :href="`tel:${details?.phoneNumber}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phoneNumber }}</a>
                      </div>
                    </div>
                  </template>

                  <!-- Kiosk Details -->
                  <template v-if="facility.category === 'kiosk'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.detailLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 위치</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detailLocation }}</span>
                      </div>
                      <div v-if="details?.installPosition && details?.installPosition !== details?.detailLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">건물 내 위치</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installPosition }}</span>
                      </div>
                      <div v-if="details?.operationAgency" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">운영기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operationAgency }}</span>
                      </div>
                      <div v-if="details?.weekdayOperatingHours" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">평일 운영시간</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.weekdayOperatingHours }}</span>
                      </div>
                      <div v-if="details?.saturdayOperatingHours" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">토요일 운영시간</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.saturdayOperatingHours }}</span>
                      </div>
                      <div v-if="details?.holidayOperatingHours" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">공휴일 운영시간</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.holidayOperatingHours }}</span>
                      </div>
                    </div>

                    <!-- Kiosk Accessibility -->
                    <div v-if="details?.blindKeypad !== undefined || details?.voiceGuide !== undefined || details?.brailleOutput !== undefined || details?.wheelchairAccessible !== undefined" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">접근성</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div v-if="details?.blindKeypad !== undefined" class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-base" :class="details?.blindKeypad ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.blindKeypad ? 'check_circle' : 'cancel' }}</span>
                          <span class="text-sm text-[#4b5563] dark:text-slate-300">시각장애인 키패드</span>
                        </div>
                        <div v-if="details?.voiceGuide !== undefined" class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-base" :class="details?.voiceGuide ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.voiceGuide ? 'check_circle' : 'cancel' }}</span>
                          <span class="text-sm text-[#4b5563] dark:text-slate-300">음성 안내</span>
                        </div>
                        <div v-if="details?.brailleOutput !== undefined" class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-base" :class="details?.brailleOutput ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.brailleOutput ? 'check_circle' : 'cancel' }}</span>
                          <span class="text-sm text-[#4b5563] dark:text-slate-300">점자 출력</span>
                        </div>
                        <div v-if="details?.wheelchairAccessible !== undefined" class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-base" :class="details?.wheelchairAccessible ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.wheelchairAccessible ? 'check_circle' : 'cancel' }}</span>
                          <span class="text-sm text-[#4b5563] dark:text-slate-300">휠체어 접근</span>
                        </div>
                      </div>
                    </div>

                    <!-- Kiosk Available Documents -->
                    <div v-if="details?.availableDocuments?.length" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">발급 가능 민원</h3>
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="doc in details?.availableDocuments"
                          :key="doc"
                          class="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
                        >
                          {{ doc }}
                        </span>
                      </div>
                    </div>
                  </template>

                  <!-- Parking Details -->
                  <template v-if="facility.category === 'parking'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '']">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">요금 정보</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.feeType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">요금구분</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.feeType }}</span>
                        </div>
                        <div v-if="details?.baseFee != null && details?.baseTime != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">기본요금</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.baseFee }}원 / {{ details?.baseTime }}분</span>
                        </div>
                        <div v-if="details?.additionalFee != null && details?.additionalTime != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">추가요금</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.additionalFee }}원 / {{ details?.additionalTime }}분</span>
                        </div>
                        <div v-if="details?.dailyMaxFee != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">일 최대요금</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.dailyMaxFee }}원</span>
                        </div>
                        <div v-if="details?.dailyMaxFeeHours" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">일최대요금 적용시간</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.dailyMaxFeeHours }}</span>
                        </div>
                        <div v-if="details?.monthlyFee != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">월정기권</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.monthlyFee }}원</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">기본 정보</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.parkingType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">주차 구분</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.parkingType }}</span>
                        </div>
                        <div v-if="details?.lotType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">주차장 유형</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.lotType }}</span>
                        </div>
                        <div v-if="details?.capacity" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">주차면수</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.capacity }}면</span>
                        </div>
                        <div v-if="details?.operatingHours" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">운영시간</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingHours }}</span>
                        </div>
                        <div v-if="details?.operatingDays" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">운영요일</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingDays }}</span>
                        </div>
                        <div v-if="details?.paymentMethod" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">결제방법</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.paymentMethod }}</span>
                        </div>
                        <div v-if="details?.phone" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                          <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                        </div>
                        <div v-if="details?.managingOrg" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managingOrg }}</span>
                        </div>
                        <div v-if="details?.hasDisabledParking !== undefined" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">장애인 주차구역</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.hasDisabledParking ? '있음' : '없음' }}</span>
                        </div>
                        <div v-if="details?.alternateParking" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">부제 운영</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.alternateParking }}</span>
                        </div>
                        <div v-if="details?.remarks" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">특기사항</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.remarks }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Library Details -->
                  <template v-if="facility.category === 'library'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.libraryType" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">도서관유형</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.libraryType }}</span>
                      </div>
                      <div v-if="details?.operatingOrg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">운영기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingOrg }}</span>
                      </div>
                      <div v-if="details?.closedDays" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">휴관일</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.closedDays }}</span>
                      </div>
                      <div v-if="details?.seatCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">좌석수</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.seatCount.toLocaleString() }}석</span>
                      </div>
                      <div v-if="details?.bookCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">장서수</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.bookCount.toLocaleString() }}권</span>
                      </div>
                      <div v-if="details?.serialCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">연속간행물</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.serialCount.toLocaleString() }}종</span>
                      </div>
                      <div v-if="details?.nonBookCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">비도서 자료</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.nonBookCount.toLocaleString() }}점</span>
                      </div>
                      <div v-if="details?.loanableBooks" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">대출가능 권수</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.loanableBooks }}권</span>
                      </div>
                      <div v-if="details?.loanableDays" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">대출가능 일수</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.loanableDays }}일</span>
                      </div>
                    </div>

                    <!-- Library Operating Hours -->
                    <div v-if="details?.weekdayOpenTime || details?.saturdayOpenTime || details?.holidayOpenTime" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.weekdayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">평일</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.weekdayOpenTime }} ~ {{ details?.weekdayCloseTime }}</span>
                        </div>
                        <div v-if="details?.saturdayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">토요일</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.saturdayOpenTime }} ~ {{ details?.saturdayCloseTime }}</span>
                        </div>
                        <div v-if="details?.holidayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">공휴일</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.holidayOpenTime }} ~ {{ details?.holidayCloseTime }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Library Homepage -->
                    <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">홈페이지</span>
                        <a :href="details?.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">바로가기</a>
                      </div>
                    </div>

                    <!-- Library Facility Size -->
                    <div v-if="details?.lotArea || details?.buildingArea" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">시설 규모</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.lotArea" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">부지면적</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.lotArea }}㎡</span>
                        </div>
                        <div v-if="details?.buildingArea" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">건물면적</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.buildingArea }}㎡</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- AED Details -->
                  <template v-if="facility.category === 'aed'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.buildPlace" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치위치</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.buildPlace }}</span>
                      </div>
                      <div v-if="details?.org" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">설치기관</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.org }}</span>
                      </div>
                      <div v-if="details?.clerkTel" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                        <a :href="`tel:${details?.clerkTel}`" class="text-sm font-medium text-primary hover:underline">{{ details?.clerkTel }}</a>
                      </div>
                      <div v-if="details?.mfg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">제조사</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mfg }}</span>
                      </div>
                      <div v-if="details?.model" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">모델명</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.model }}</span>
                      </div>
                    </div>

                    <!-- AED Operating Hours -->
                    <div v-if="aedOperatingHours.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                      <div class="flex flex-col gap-3">
                        <div
                          v-for="item in aedOperatingHours"
                          :key="item.day"
                          class="flex items-center justify-between"
                        >
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">{{ item.day }}</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ item.time }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Hospital Details -->
                  <template v-if="facility.category === 'hospital'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.clCdNm" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">종별</span>
                        <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">{{ details?.clCdNm }}</span>
                      </div>
                      <div v-if="details?.phone" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                        <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                      </div>
                      <div v-if="details?.homepage" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">홈페이지</span>
                        <a :href="details?.homepage" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ details?.homepage }}</a>
                      </div>
                      <div v-if="details?.estbDd" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">개설일자</span>
                        <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.estbDd }}</span>
                      </div>
                    </div>

                    <!-- Hospital Staff Info -->
                    <div v-if="details?.drTotCnt" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">의료진 현황</h3>
                      <div class="flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">의사 총수</span>
                          <span class="text-sm font-bold text-[#111418] dark:text-white">{{ details?.drTotCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptSdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">의과 전문의</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mdeptSdrCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptGdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">의과 일반의</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mdeptGdrCnt }}명</span>
                        </div>
                        <div v-if="details?.detySdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">치과 전문의</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detySdrCnt }}명</span>
                        </div>
                        <div v-if="details?.cmdcSdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">한방 전문의</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.cmdcSdrCnt }}명</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Pharmacy Details -->
                  <template v-if="facility.category === 'pharmacy'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.phone" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                        <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                      </div>
                      <div v-if="details?.dutyTel3" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563] dark:text-slate-400">응급전화</span>
                        <a :href="`tel:${details?.dutyTel3}`" class="text-sm font-medium text-primary hover:underline">{{ details?.dutyTel3 }}</a>
                      </div>
                    </div>

                    <!-- Pharmacy Operating Hours -->
                    <div v-if="pharmacyOperatingHours.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                      <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                      <div class="flex flex-col gap-3">
                        <div
                          v-for="item in pharmacyOperatingHours"
                          :key="item.day"
                          class="flex items-center justify-between"
                        >
                          <span class="text-sm text-[#4b5563] dark:text-slate-400">{{ item.day }}</span>
                          <span class="text-sm font-medium text-[#111418] dark:text-white">{{ item.time }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Review Section (Desktop Left Column) -->
              <ClientOnly>
                <ReviewSection :category="category" :facility-id="id" />
              </ClientOnly>

              <!-- Location Guide Card -->
              <div v-if="facility.city || facility.district" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
                  <h2 class="text-[#111418] dark:text-white text-lg font-bold">위치안내</h2>
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

              <!-- Nearby Facilities -->
              <div v-if="nearbyLoading || nearbyFiltered.length > 0" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[20px]">near_me</span>
                  <h2 class="text-[#111418] dark:text-white text-lg font-bold">주변 {{ categoryMeta.label }}</h2>
                </div>
                <div class="p-4 flex flex-col gap-3">
                  <template v-if="nearbyLoading">
                    <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 h-[72px]"></div>
                  </template>
                  <template v-else>
                    <FacilityCard
                      v-for="item in nearbyFiltered"
                      :key="item.id"
                      :facility="item"
                      highlight-distance
                    />
                  </template>
                </div>
              </div>

              <!-- Cross-Category Nearby Facilities -->
              <template v-if="crossLoading">
                <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                  <div class="p-4 flex flex-col gap-3">
                    <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 h-[72px]"></div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-for="group in crossFacilitiesGrouped" :key="group.category"
                     class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                  <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">{{ group.meta.icon }}</span>
                    <h2 class="text-[#111418] dark:text-white text-lg font-bold">주변 {{ group.meta.label }}</h2>
                  </div>
                  <div class="p-4 flex flex-col gap-3">
                    <FacilityCard
                      v-for="item in group.items"
                      :key="item.id"
                      :facility="item"
                      highlight-distance
                    />
                  </div>
                </div>
              </template>

              <!-- Data Info Card -->
              <div v-if="dataDate || dataPortalUrl" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#60708a] dark:text-gray-400 text-[20px]">description</span>
                  <h2 class="text-[#111418] dark:text-white text-lg font-bold">데이터 정보</h2>
                </div>
                <div class="p-5 flex flex-col gap-3">
                  <div v-if="dataDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">데이터 기준일</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ dataDate }}</span>
                  </div>
                  <div v-if="dataPortalUrl" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">출처</span>
                    <a :href="dataPortalUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">공공데이터포털</a>
                  </div>
                  <div class="mt-1 flex items-start gap-1.5 text-xs text-[#9ca3af] dark:text-slate-500">
                    <span class="material-symbols-outlined text-[14px] mt-px">info</span>
                    <span>공공데이터포털 기준 정보입니다</span>
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

                <!-- Map Controls -->
                <div class="absolute top-4 right-4 flex flex-col gap-2 z-10">
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
                <div class="relative flex-[2]">
                  <button
                    class="w-full h-12 rounded-xl bg-primary text-white font-bold text-base hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                    @click="showNavDropdown = !showNavDropdown"
                  >
                    <span class="material-symbols-outlined">directions</span>
                    길찾기
                    <span class="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                  <div v-if="showNavDropdown" class="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#1a2630] rounded-xl shadow-lg border border-[#e5e7eb] dark:border-gray-700 overflow-hidden z-20">
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                      <span class="text-base">🗺️</span> 카카오맵으로 길찾기
                    </button>
                    <div class="h-px bg-[#f0f2f5] dark:bg-gray-700"></div>
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                      <span class="text-base">🧭</span> 네이버맵으로 길찾기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: Info Section (Desktop-style cards) -->
        <div class="md:hidden px-4 flex flex-col gap-6 pt-4">
          <!-- Page Heading & Badges -->
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-900/40 dark:text-purple-300">
                <span class="material-symbols-outlined text-[14px]">place</span> {{ categoryMeta.label }}
              </span>
              <button class="text-[#60708a] hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" @click="handleShare">
                <span class="material-symbols-outlined">share</span>
              </button>
            </div>
            <h1 class="text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight">
              {{ facility.name }}
            </h1>
          </div>

          <!-- Basic Info Card -->
          <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center justify-between">
              <h2 class="text-[#111418] dark:text-white text-lg font-bold">기본정보</h2>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <!-- Address -->
              <div class="flex gap-4 items-start">
                <div class="mt-0.5 text-[#60708a] dark:text-gray-400">
                  <span class="material-symbols-outlined">location_on</span>
                </div>
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <p class="text-[#111418] dark:text-white text-base font-medium break-words">
                    {{ facility.roadAddress || facility.address }}
                  </p>
                </div>
                <button class="ml-auto text-primary text-sm font-medium hover:underline whitespace-nowrap shrink-0" @click="copyAddress">복사</button>
              </div>

              <div v-if="details?.operatingHours || isOpen24Hours || details?.phoneNumber" class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

              <!-- Operating Hours -->
              <div v-if="details?.operatingHours || isOpen24Hours" class="flex gap-4 items-start">
                <div class="mt-0.5 text-[#60708a] dark:text-gray-400">
                  <span class="material-symbols-outlined">schedule</span>
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-[#111418] dark:text-white text-base font-medium">{{ details?.operatingHours || '24시간 운영' }}</p>
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

              <div v-if="details?.phoneNumber && (details?.operatingHours || isOpen24Hours)" class="h-px bg-[#f0f2f5] dark:bg-gray-700 w-full"></div>

              <!-- Phone -->
              <div v-if="details?.phoneNumber" class="flex gap-4 items-center">
                <div class="text-[#60708a] dark:text-gray-400">
                  <span class="material-symbols-outlined">call</span>
                </div>
                <a :href="`tel:${details?.phoneNumber}`" class="text-primary text-base font-medium hover:underline">{{ details?.phoneNumber }}</a>
              </div>
            </div>
          </div>

          <!-- Facility Status Card -->
          <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
              <h2 class="text-[#111418] dark:text-white text-lg font-bold">시설현황</h2>
            </div>
            <div class="p-5">
              <div v-if="hasGridContent" class="grid grid-cols-2 gap-4">
                <!-- Toilet Stalls -->
                <template v-if="facility.category === 'toilet'">
                  <div v-if="details?.maleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30">
                        <span class="material-symbols-outlined">man</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">남자 화장실</span>
                    </div>
                    <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.maleToilets }}칸</span>
                  </div>
                  <div v-if="details?.femaleToilets" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-pink-50 text-pink-600 rounded-full dark:bg-pink-900/30">
                        <span class="material-symbols-outlined">woman</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">여자 화장실</span>
                    </div>
                    <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.femaleToilets }}칸</span>
                  </div>
                  <div v-if="details?.maleUrinals" class="col-span-2 bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30">
                        <span class="material-symbols-outlined">man</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563] dark:text-slate-300">남성용 소변기</span>
                    </div>
                    <span class="text-base font-bold text-[#111418] dark:text-white">{{ details?.maleUrinals }}개</span>
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

              <!-- Toilet Extra Details -->
              <template v-if="facility.category === 'toilet'">
                <div v-if="details?.openTime || details?.managingOrg || details?.facilityType || details?.ownershipType || details?.installDate" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.openTime" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">개방시간</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.openTime }}</span>
                  </div>
                  <div v-if="details?.managingOrg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managingOrg }}</span>
                  </div>
                  <div v-if="details?.facilityType" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">시설유형</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.facilityType }}</span>
                  </div>
                  <div v-if="details?.ownershipType" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">소유구분</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.ownershipType }}</span>
                  </div>
                  <div v-if="details?.installDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치일</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installDate }}</span>
                  </div>
                </div>

                <!-- Toilet Accessibility Details -->
                <div v-if="toiletAccessibilityDetails.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">접근성 상세</h3>
                  <div class="grid grid-cols-2 gap-3">
                    <div
                      v-for="item in toiletAccessibilityDetails"
                      :key="item.label"
                      class="bg-[#f9fafb] dark:bg-[#23303b] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5] dark:border-gray-700"
                    >
                      <span class="text-sm text-[#4b5563] dark:text-slate-300">{{ item.label }}</span>
                      <span class="text-sm font-bold text-[#111418] dark:text-white">{{ item.value }}</span>
                    </div>
                  </div>
                </div>

                <!-- Emergency Bell / Diaper Changing Location -->
                <div v-if="details?.emergencyBellLocation || details?.diaperChangingLocation" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">편의시설 위치</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.emergencyBellLocation" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">비상벨 위치</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.emergencyBellLocation }}</span>
                    </div>
                    <div v-if="details?.diaperChangingLocation" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">기저귀교환대 위치</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.diaperChangingLocation }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Wifi Details -->
              <template v-if="facility.category === 'wifi'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.ssid" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">SSID</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.ssid }}</span>
                  </div>
                  <div v-if="details?.installLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 장소</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installLocation }}</span>
                  </div>
                  <div v-if="details?.serviceProvider" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">서비스 제공사</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.serviceProvider }}</span>
                  </div>
                  <div v-if="details?.installDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치일</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installDate }}</span>
                  </div>
                  <div v-if="details?.managementAgency" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managementAgency }}</span>
                  </div>
                  <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">연락처</span>
                    <a :href="`tel:${details?.phoneNumber}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phoneNumber }}</a>
                  </div>
                  <div v-if="details?.installLocationDetail && details?.installLocationDetail !== details?.installLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 장소 상세</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installLocationDetail }}</span>
                  </div>
                </div>
              </template>

              <!-- Clothes Details -->
              <template v-if="facility.category === 'clothes'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.detailLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">상세 위치</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detailLocation }}</span>
                  </div>
                  <div v-if="details?.managementAgency" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managementAgency }}</span>
                  </div>
                  <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">연락처</span>
                    <a :href="`tel:${details?.phoneNumber}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phoneNumber }}</a>
                  </div>
                </div>
              </template>

              <!-- Kiosk Details -->
              <template v-if="facility.category === 'kiosk'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.detailLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치 위치</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detailLocation }}</span>
                  </div>
                  <div v-if="details?.installPosition && details?.installPosition !== details?.detailLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">건물 내 위치</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.installPosition }}</span>
                  </div>
                  <div v-if="details?.operationAgency" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">운영기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operationAgency }}</span>
                  </div>
                  <div v-if="details?.weekdayOperatingHours" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">평일 운영시간</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.weekdayOperatingHours }}</span>
                  </div>
                  <div v-if="details?.saturdayOperatingHours" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">토요일 운영시간</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.saturdayOperatingHours }}</span>
                  </div>
                  <div v-if="details?.holidayOperatingHours" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">공휴일 운영시간</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.holidayOperatingHours }}</span>
                  </div>
                </div>

                <!-- Kiosk Accessibility -->
                <div v-if="details?.blindKeypad !== undefined || details?.voiceGuide !== undefined || details?.brailleOutput !== undefined || details?.wheelchairAccessible !== undefined" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">접근성</h3>
                  <div class="grid grid-cols-2 gap-3">
                    <div v-if="details?.blindKeypad !== undefined" class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-base" :class="details?.blindKeypad ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.blindKeypad ? 'check_circle' : 'cancel' }}</span>
                      <span class="text-sm text-[#4b5563] dark:text-slate-300">시각장애인 키패드</span>
                    </div>
                    <div v-if="details?.voiceGuide !== undefined" class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-base" :class="details?.voiceGuide ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.voiceGuide ? 'check_circle' : 'cancel' }}</span>
                      <span class="text-sm text-[#4b5563] dark:text-slate-300">음성 안내</span>
                    </div>
                    <div v-if="details?.brailleOutput !== undefined" class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-base" :class="details?.brailleOutput ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.brailleOutput ? 'check_circle' : 'cancel' }}</span>
                      <span class="text-sm text-[#4b5563] dark:text-slate-300">점자 출력</span>
                    </div>
                    <div v-if="details?.wheelchairAccessible !== undefined" class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-base" :class="details?.wheelchairAccessible ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'">{{ details?.wheelchairAccessible ? 'check_circle' : 'cancel' }}</span>
                      <span class="text-sm text-[#4b5563] dark:text-slate-300">휠체어 접근</span>
                    </div>
                  </div>
                </div>

                <!-- Kiosk Available Documents -->
                <div v-if="details?.availableDocuments?.length" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">발급 가능 민원</h3>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="doc in details?.availableDocuments"
                      :key="doc"
                      class="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
                    >
                      {{ doc }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Parking Details -->
              <template v-if="facility.category === 'parking'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '']">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">요금 정보</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.feeType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">요금구분</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.feeType }}</span>
                    </div>
                    <div v-if="details?.baseFee != null && details?.baseTime != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">기본요금</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.baseFee }}원 / {{ details?.baseTime }}분</span>
                    </div>
                    <div v-if="details?.additionalFee != null && details?.additionalTime != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">추가요금</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.additionalFee }}원 / {{ details?.additionalTime }}분</span>
                    </div>
                    <div v-if="details?.dailyMaxFee != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">일 최대요금</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.dailyMaxFee }}원</span>
                    </div>
                    <div v-if="details?.dailyMaxFeeHours" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">일최대요금 적용시간</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.dailyMaxFeeHours }}</span>
                    </div>
                    <div v-if="details?.monthlyFee != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">월정기권</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.monthlyFee }}원</span>
                    </div>
                  </div>
                </div>

                <div class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">기본 정보</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.parkingType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">주차 구분</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.parkingType }}</span>
                    </div>
                    <div v-if="details?.lotType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">주차장 유형</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.lotType }}</span>
                    </div>
                    <div v-if="details?.capacity" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">주차면수</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.capacity }}면</span>
                    </div>
                    <div v-if="details?.operatingHours" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">운영시간</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingHours }}</span>
                    </div>
                    <div v-if="details?.operatingDays" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">운영요일</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingDays }}</span>
                    </div>
                    <div v-if="details?.paymentMethod" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">결제방법</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.paymentMethod }}</span>
                    </div>
                    <div v-if="details?.phone" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                      <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                    </div>
                    <div v-if="details?.managingOrg" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">관리기관</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.managingOrg }}</span>
                    </div>
                    <div v-if="details?.hasDisabledParking !== undefined" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">장애인 주차구역</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.hasDisabledParking ? '있음' : '없음' }}</span>
                    </div>
                    <div v-if="details?.alternateParking" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">부제 운영</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.alternateParking }}</span>
                    </div>
                    <div v-if="details?.remarks" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">특기사항</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.remarks }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Library Details -->
              <template v-if="facility.category === 'library'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.libraryType" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">도서관유형</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.libraryType }}</span>
                  </div>
                  <div v-if="details?.operatingOrg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">운영기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.operatingOrg }}</span>
                  </div>
                  <div v-if="details?.closedDays" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">휴관일</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.closedDays }}</span>
                  </div>
                  <div v-if="details?.seatCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">좌석수</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.seatCount.toLocaleString() }}석</span>
                  </div>
                  <div v-if="details?.bookCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">장서수</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.bookCount.toLocaleString() }}권</span>
                  </div>
                  <div v-if="details?.serialCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">연속간행물</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.serialCount.toLocaleString() }}종</span>
                  </div>
                  <div v-if="details?.nonBookCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">비도서 자료</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.nonBookCount.toLocaleString() }}점</span>
                  </div>
                  <div v-if="details?.loanableBooks" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">대출가능 권수</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.loanableBooks }}권</span>
                  </div>
                  <div v-if="details?.loanableDays" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">대출가능 일수</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.loanableDays }}일</span>
                  </div>
                </div>

                <!-- Library Operating Hours -->
                <div v-if="details?.weekdayOpenTime || details?.saturdayOpenTime || details?.holidayOpenTime" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.weekdayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">평일</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.weekdayOpenTime }} ~ {{ details?.weekdayCloseTime }}</span>
                    </div>
                    <div v-if="details?.saturdayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">토요일</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.saturdayOpenTime }} ~ {{ details?.saturdayCloseTime }}</span>
                    </div>
                    <div v-if="details?.holidayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">공휴일</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.holidayOpenTime }} ~ {{ details?.holidayCloseTime }}</span>
                    </div>
                  </div>
                </div>

                <!-- Library Homepage -->
                <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">홈페이지</span>
                    <a :href="details?.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">바로가기</a>
                  </div>
                </div>

                <!-- Library Facility Size -->
                <div v-if="details?.lotArea || details?.buildingArea" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">시설 규모</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.lotArea" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">부지면적</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.lotArea }}㎡</span>
                    </div>
                    <div v-if="details?.buildingArea" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">건물면적</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.buildingArea }}㎡</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- AED Details -->
              <template v-if="facility.category === 'aed'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.buildPlace" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치위치</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.buildPlace }}</span>
                  </div>
                  <div v-if="details?.org" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">설치기관</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.org }}</span>
                  </div>
                  <div v-if="details?.clerkTel" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                    <a :href="`tel:${details?.clerkTel}`" class="text-sm font-medium text-primary hover:underline">{{ details?.clerkTel }}</a>
                  </div>
                  <div v-if="details?.mfg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">제조사</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mfg }}</span>
                  </div>
                  <div v-if="details?.model" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">모델명</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.model }}</span>
                  </div>
                </div>

                <!-- AED Operating Hours -->
                <div v-if="aedOperatingHours.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                  <div class="flex flex-col gap-3">
                    <div
                      v-for="item in aedOperatingHours"
                      :key="item.day"
                      class="flex items-center justify-between"
                    >
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">{{ item.day }}</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ item.time }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Hospital Details -->
              <template v-if="facility.category === 'hospital'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.clCdNm" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">종별</span>
                    <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">{{ details?.clCdNm }}</span>
                  </div>
                  <div v-if="details?.phone" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                    <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                  </div>
                  <div v-if="details?.homepage" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">홈페이지</span>
                    <a :href="details?.homepage" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ details?.homepage }}</a>
                  </div>
                  <div v-if="details?.estbDd" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">개설일자</span>
                    <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.estbDd }}</span>
                  </div>
                </div>

                <!-- Hospital Staff Info -->
                <div v-if="details?.drTotCnt" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">의료진 현황</h3>
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">의사 총수</span>
                      <span class="text-sm font-bold text-[#111418] dark:text-white">{{ details?.drTotCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptSdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">의과 전문의</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mdeptSdrCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptGdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">의과 일반의</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.mdeptGdrCnt }}명</span>
                    </div>
                    <div v-if="details?.detySdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">치과 전문의</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.detySdrCnt }}명</span>
                    </div>
                    <div v-if="details?.cmdcSdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">한방 전문의</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ details?.cmdcSdrCnt }}명</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Pharmacy Details -->
              <template v-if="facility.category === 'pharmacy'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.phone" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">전화번호</span>
                    <a :href="`tel:${details?.phone}`" class="text-sm font-medium text-primary hover:underline">{{ details?.phone }}</a>
                  </div>
                  <div v-if="details?.dutyTel3" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563] dark:text-slate-400">응급전화</span>
                    <a :href="`tel:${details?.dutyTel3}`" class="text-sm font-medium text-primary hover:underline">{{ details?.dutyTel3 }}</a>
                  </div>
                </div>

                <!-- Pharmacy Operating Hours -->
                <div v-if="pharmacyOperatingHours.length > 0" class="mt-5 border-t border-[#f0f2f5] dark:border-gray-700 pt-5">
                  <h3 class="text-sm font-bold text-[#111418] dark:text-white mb-3">운영시간</h3>
                  <div class="flex flex-col gap-3">
                    <div
                      v-for="item in pharmacyOperatingHours"
                      :key="item.day"
                      class="flex items-center justify-between"
                    >
                      <span class="text-sm text-[#4b5563] dark:text-slate-400">{{ item.day }}</span>
                      <span class="text-sm font-medium text-[#111418] dark:text-white">{{ item.time }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Review Section (Mobile) -->
          <ClientOnly>
            <ReviewSection :category="category" :facility-id="id" />
          </ClientOnly>

          <!-- Location Guide Card -->
          <div v-if="facility.city || facility.district" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700">
              <h2 class="text-[#111418] dark:text-white text-lg font-bold">위치안내</h2>
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

          <!-- Nearby Facilities -->
          <div v-if="nearbyLoading || nearbyFiltered.length > 0" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">near_me</span>
              <h2 class="text-[#111418] dark:text-white text-lg font-bold">주변 {{ categoryMeta.label }}</h2>
            </div>
            <div class="p-4 flex flex-col gap-3">
              <template v-if="nearbyLoading">
                <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 h-[72px]"></div>
              </template>
              <template v-else>
                <FacilityCard
                  v-for="item in nearbyFiltered"
                  :key="item.id"
                  :facility="item"
                />
              </template>
            </div>
          </div>

          <!-- Cross-Category Nearby Facilities (Mobile) -->
          <template v-if="crossLoading">
            <div class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
              <div class="p-4 flex flex-col gap-3">
                <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 h-[72px]"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="group in crossFacilitiesGrouped" :key="group.category"
                 class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
              <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
                <span class="material-symbols-outlined text-base">{{ group.meta.icon }}</span>
                <h2 class="text-[#111418] dark:text-white text-lg font-bold">주변 {{ group.meta.label }}</h2>
              </div>
              <div class="p-4 flex flex-col gap-3">
                <FacilityCard
                  v-for="item in group.items"
                  :key="item.id"
                  :facility="item"
                  highlight-distance
                />
              </div>
            </div>
          </template>

          <!-- Data Info Card -->
          <div v-if="dataDate || dataPortalUrl" class="bg-white dark:bg-[#1a2630] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-gray-800 overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] dark:border-gray-700 flex items-center gap-2">
              <span class="material-symbols-outlined text-[#60708a] dark:text-gray-400 text-[20px]">description</span>
              <h2 class="text-[#111418] dark:text-white text-lg font-bold">데이터 정보</h2>
            </div>
            <div class="p-5 flex flex-col gap-3">
              <div v-if="dataDate" class="flex items-center justify-between">
                <span class="text-sm text-[#4b5563] dark:text-slate-400">데이터 기준일</span>
                <span class="text-sm font-medium text-[#111418] dark:text-white">{{ dataDate }}</span>
              </div>
              <div v-if="dataPortalUrl" class="flex items-center justify-between">
                <span class="text-sm text-[#4b5563] dark:text-slate-400">출처</span>
                <a :href="dataPortalUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">공공데이터포털</a>
              </div>
              <div class="mt-1 flex items-start gap-1.5 text-xs text-[#9ca3af] dark:text-slate-500">
                <span class="material-symbols-outlined text-[14px] mt-px">info</span>
                <span>공공데이터포털 기준 정보입니다</span>
              </div>
            </div>
          </div>

          <div class="h-8"></div>
        </div>

        <!-- Mobile: Sticky Bottom CTA -->
        <div class="md:hidden fixed bottom-0 left-0 z-50 w-full bg-white/95 px-4 pb-8 pt-4 shadow-[0_-4px_16px_-1px_rgba(0,0,0,0.05)] backdrop-blur-sm dark:bg-[#101b22]/95 dark:border-t dark:border-gray-800">
          <div class="flex gap-3">
            <button
              class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#f0f2f5] py-4 text-base font-bold text-[#111418] transition hover:bg-gray-200 active:scale-[0.98] dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              @click="openNavigation(naverMapUrl)"
            >
              <span class="text-base">🧭</span>
              네이버맵
            </button>
            <button
              class="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#3b82f6] py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-[0.98]"
              @click="openNavigation(kakaoMapUrl)"
            >
              <span class="material-symbols-outlined text-[20px]">near_me</span>
              카카오맵 길찾기
            </button>
          </div>
        </div>

        <!-- Bottom padding for mobile CTA -->
        <div class="md:hidden h-24"></div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({})

import { computed, defineAsyncComponent, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_DATA_PORTAL_URL } from '~/types/facility'
import { CITY_NAME_TO_SLUG } from '~/composables/useRegions'
import type { FacilityCategory, FacilityDetail, FacilityDetailsAll } from '~/types/facility'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { setFacilityDetailMeta } = useFacilityMeta()
const { setFacilitySchema, setBreadcrumbSchema } = useStructuredData()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

// 도시명(한글) → 도시 허브 페이지 경로
function getCityHubPath(cityName: string): string {
  const slug = CITY_NAME_TO_SLUG[cityName]
  return slug ? `/${slug}` : `/search?keyword=${encodeURIComponent(cityName)}`
}

// SSR: useAsyncData로 서버에서 데이터 fetch
const { data: facilityResponse, status, error: fetchError } = await useAsyncData(
  `facility-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: FacilityDetail }>(
    `${apiBase}/api/facilities/${category.value}/${id.value}`
  )
)
// Soft 404 방지: 시설 데이터가 없으면 404 에러 반환
if (status.value === 'success' && !facilityResponse.value?.data) {
  throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
}

const facility = computed(() => facilityResponse.value?.data ?? null)
const loading = computed(() => status.value === 'pending')
const error = computed(() => fetchError.value ? { message: '시설 정보를 불러올 수 없습니다' } : null)

// 템플릿용 타입 안전 details 접근 (v-if 카테고리 가드로 런타임 보호)
const details = computed(() => facility.value?.details as FacilityDetailsAll | undefined)

// SSR에서 메타태그 및 JSON-LD 설정
watchEffect(() => {
  if (facility.value) {
    setFacilityDetailMeta(facility.value)
    setFacilitySchema(facility.value)
    const categoryName = CATEGORY_META[facility.value.category]?.label || facility.value.category
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: categoryName, url: `/${facility.value.category}` },
      { name: facility.value.name, url: `/${facility.value.category}/${facility.value.id}` },
    ])
  }
})

// Category metadata
const categoryMeta = computed(() => CATEGORY_META[category.value] || { label: category.value, icon: '📍' })

// Check if 24 hours
const isOpen24Hours = computed(() => {
  if (!facility.value?.details) return false
  const det = facility.value.details as FacilityDetailsAll & Record<string, unknown>
  return det.operatingHours === '24시간' || det.is24Hour
})

// Generate map URLs (길찾기)
const kakaoMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
})

const naverMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.naver.com/v5/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/walk`
})

const showNavDropdown = ref(false)
const openNavigation = (url: string) => {
  window.open(url, '_blank')
  showNavDropdown.value = false
}

const isMapExpanded = ref(false)
watch(isMapExpanded, (expanded) => {
  if (import.meta.client) {
    document.body.style.overflow = expanded ? 'hidden' : ''
  }
})

// 다양한 형식의 날짜 문자열을 "YYYY-MM-DD"로 정규화
function formatDataDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{8}/.test(raw)) return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return raw
}

// Data info card
const dataDate = computed(() => {
  if (!facility.value?.details) return null
  const raw = (facility.value.details as { dataDate?: string | null }).dataDate
  if (!raw) return null
  return formatDataDate(raw)
})

const dataPortalUrl = computed(() => {
  if (!facility.value) return null
  return CATEGORY_DATA_PORTAL_URL[facility.value.category] ?? null
})

// Format distance
const formatDistance = (distance: number): string => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}

// AED operating hours
const formatAedTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).padStart(4, '0')
  const e = String(end).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
}

const aedOperatingHours = computed(() => {
  if (facility.value?.category !== 'aed' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').AedDetails
  const days = [
    { day: '월요일', start: d.monSttTme, end: d.monEndTme },
    { day: '화요일', start: d.tueSttTme, end: d.tueEndTme },
    { day: '수요일', start: d.wedSttTme, end: d.wedEndTme },
    { day: '목요일', start: d.thuSttTme, end: d.thuEndTme },
    { day: '금요일', start: d.friSttTme, end: d.friEndTme },
    { day: '토요일', start: d.satSttTme, end: d.satEndTme },
    { day: '일요일', start: d.sunSttTme, end: d.sunEndTme },
    { day: '공휴일', start: d.holSttTme, end: d.holEndTme },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatAedTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})

// Pharmacy operating hours
const formatPharmacyTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).padStart(4, '0')
  const e = String(end).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
}

const pharmacyOperatingHours = computed(() => {
  if (facility.value?.category !== 'pharmacy' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').PharmacyDetails
  const days = [
    { day: '월요일', start: d.dutyTime1s, end: d.dutyTime1c },
    { day: '화요일', start: d.dutyTime2s, end: d.dutyTime2c },
    { day: '수요일', start: d.dutyTime3s, end: d.dutyTime3c },
    { day: '목요일', start: d.dutyTime4s, end: d.dutyTime4c },
    { day: '금요일', start: d.dutyTime5s, end: d.dutyTime5c },
    { day: '토요일', start: d.dutyTime6s, end: d.dutyTime6c },
    { day: '일요일', start: d.dutyTime7s, end: d.dutyTime7c },
    { day: '공휴일', start: d.dutyTime8s, end: d.dutyTime8c },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatPharmacyTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})

// Toilet accessibility details (disabled/child toilet counts)
const toiletAccessibilityDetails = computed(() => {
  if (facility.value?.category !== 'toilet' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').ToiletDetails
  const items: Array<{ label: string; value: string }> = []
  if (d.maleDisabledToilets) items.push({ label: '남성 장애인 대변기', value: `${d.maleDisabledToilets}개` })
  if (d.maleDisabledUrinals) items.push({ label: '남성 장애인 소변기', value: `${d.maleDisabledUrinals}개` })
  if (d.femaleDisabledToilets) items.push({ label: '여성 장애인 대변기', value: `${d.femaleDisabledToilets}개` })
  if (d.maleChildToilets) items.push({ label: '남성 어린이 대변기', value: `${d.maleChildToilets}개` })
  if (d.maleChildUrinals) items.push({ label: '남성 어린이 소변기', value: `${d.maleChildUrinals}개` })
  if (d.femaleChildToilets) items.push({ label: '여성 어린이 대변기', value: `${d.femaleChildToilets}개` })
  return items
})

// Facility features for cards (using Material Icons)
const facilityFeatures = computed(() => {
  if (!facility.value?.details) return []

  const features: Array<{ icon: string; label: string; value: string; color: string; materialIcon?: string }> = []
  const d = facility.value.details as FacilityDetailsAll

  // Toilet specific
  if (facility.value.category === 'toilet') {
    if (d.femaleToilets !== undefined) {
      features.push({ icon: '♀', label: '여성용', value: `${d.femaleToilets}개`, color: 'pink', materialIcon: 'woman' })
    }
    if (d.maleToilets !== undefined) {
      features.push({ icon: '♂', label: '남성용', value: `${d.maleToilets}개`, color: 'blue', materialIcon: 'man' })
    }
    if (d.hasDisabledToilet) {
      features.push({ icon: '♿', label: '장애인 화장실', value: '있음', color: 'purple', materialIcon: 'accessible' })
    }
  }

  // Kiosk specific
  if (facility.value.category === 'kiosk') {
    if (d.weekdayOperatingHours) {
      features.push({ icon: '🕐', label: '평일', value: d.weekdayOperatingHours, color: 'indigo', materialIcon: 'schedule' })
    }
    if (d.saturdayOperatingHours) {
      features.push({ icon: '🕐', label: '토요일', value: d.saturdayOperatingHours, color: 'purple', materialIcon: 'schedule' })
    }
  }

  // Wifi specific
  if (facility.value.category === 'wifi') {
    if (d.ssid) {
      features.push({ icon: '📶', label: 'SSID', value: d.ssid, color: 'green', materialIcon: 'wifi' })
    }
  }

  return features
})

// Check if the grid area has visible content (toilet stalls or amenity cards)
const hasGridContent = computed(() => {
  if (!facility.value?.details) return false
  if (facility.value.category === 'toilet') return true
  if (facility.value.category === 'hospital' || facility.value.category === 'pharmacy') return false
  return facilityAmenities.value.length > 0
})

// Facility amenities checklist
const facilityAmenities = computed(() => {
  if (!facility.value?.details) return []

  const amenities: string[] = []
  const d = facility.value.details as FacilityDetailsAll

  // Toilet amenities
  if (d.hasDisabledToilet) amenities.push('장애인 화장실')
  if (d.hasDiaperChangingTable) amenities.push('기저귀 교환대')
  if (d.hasEmergencyBell) amenities.push('비상벨')
  if (d.hasCCTV) amenities.push('CCTV')
  if ((d as any).hasChildToilet) amenities.push('어린이 화장실')

  // Kiosk amenities
  if ((d as any).hasDisabledAccess) amenities.push('장애인 편의시설')

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
  const address = facility.value.roadAddress || facility.value.address || ''
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

// 주변 시설
const { search: searchNearby, facilities: nearbyFacilities, loading: nearbyLoading, searchNearbyCross, crossFacilities, crossLoading } = useFacilitySearch()

watch(() => facility.value, async (f) => {
  if (!f?.lat || !f?.lng) return
  await Promise.all([
    searchNearby({
      lat: f.lat,
      lng: f.lng,
      category: f.category,
      radius: 1000,
      page: 1,
      limit: 5,
    }),
    searchNearbyCross(f.category, f.id),
  ])
}, { immediate: true })

const nearbyFiltered = computed(() =>
  (nearbyFacilities.value ?? []).filter(f => f.id !== facility.value?.id).slice(0, 4)
)

const crossFacilitiesGrouped = computed(() => {
  const items = crossFacilities?.value ?? []
  if (items.length === 0) return []

  const grouped = new Map<string, Array<(typeof items)[number]>>()
  for (const item of items) {
    const list = grouped.get(item.category) ?? []
    list.push(item)
    grouped.set(item.category, list)
  }

  return Array.from(grouped.entries()).map(([cat, facilities]) => ({
    category: cat as FacilityCategory,
    meta: CATEGORY_META[cat as FacilityCategory],
    items: facilities,
  }))
})

</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
