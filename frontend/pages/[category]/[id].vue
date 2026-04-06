<template>
  <div class="min-h-screen bg-background-light flex flex-col text-[#0d131c]">
    <!-- Main Content -->
    <main class="flex-1 w-full">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p class="text-gray-600">로딩 중...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-lg mx-auto px-4 py-20 text-center">
        <span class="material-symbols-outlined text-[64px] text-red-500 mb-4">error</span>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">시설 정보를 불러올 수 없습니다</h2>
        <p class="text-gray-600 mb-6">{{ error.message }}</p>
        <div class="flex items-center justify-center gap-4">
          <NuxtLink
            :to="`/${category}`"
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {{ categoryMeta.label }} 목록으로
          </NuxtLink>
        </div>
      </div>

      <!-- Facility Detail -->
      <template v-else-if="facility">
        <!-- Mobile: Map at top -->
        <div class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
          <ClientOnly>
            <FacilityMap
              :center="{ lat: facility.lat, lng: facility.lng }"
              :facilities="[facility]"
              :level="3"
              class="w-full h-full !min-h-0 !rounded-none"
            />
          </ClientOnly>

          <!-- Back Button & Name Overlay -->
          <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div class="flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="handleBack">
              <span class="material-symbols-outlined text-[#111518]">arrow_back</span>
            </div>
            <span class="max-w-[calc(100vw-100px)] truncate rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-[#111518] shadow-sm backdrop-blur-sm">{{ facility.name }}</span>
          </div>

          <!-- Gradient Overlay at bottom -->
          <div class="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background-light to-transparent"></div>

          <!-- Map expand button -->
          <button
            class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
            @click="isMapExpanded = true"
          >
            <span class="material-symbols-outlined text-[16px]">open_in_full</span>
            지도 크게 보기
          </button>

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
              class="md:hidden fixed inset-0 z-[60] bg-background-light"
            >
              <!-- Header -->
              <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 to-transparent">
                <button
                  class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm"
                  @click="isMapExpanded = false"
                >
                  <span class="material-symbols-outlined text-slate-700">close</span>
                </button>
                <span class="text-sm font-bold text-slate-900 bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ facility.name }}</span>
                <a
                  :href="`https://map.kakao.com/link/to/${encodeURIComponent(facility.name)},${facility.lat},${facility.lng}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-sm"
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
        <div class="hidden md:block max-w-6xl mx-auto px-6 py-8">
          <!-- Breadcrumbs -->
          <nav class="flex flex-wrap gap-2 mb-6 items-center text-sm">
            <NuxtLink to="/" class="text-[#48699d] font-medium hover:text-primary transition-colors">
              홈
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <NuxtLink
              :to="`/${category}`"
              class="text-[#48699d] font-medium hover:text-primary transition-colors"
            >
              {{ categoryMeta.label }}
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <NuxtLink
              :to="getCityHubPath(facility.city)"
              class="text-[#48699d] font-medium hover:text-primary transition-colors"
            >
              {{ facility.city }}
            </NuxtLink>
            <span class="material-symbols-outlined text-[#94a3b8] text-[16px]">chevron_right</span>
            <span class="text-[#0d131c] font-semibold truncate max-w-[300px]">{{ facility.name }}</span>
          </nav>

          <div class="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 items-start">
            <!-- Left Column: Details -->
            <div class="flex flex-col gap-8 w-full">
              <!-- Page Heading & Badges -->
              <div class="flex flex-col gap-3 pt-2">
                <div class="flex items-start justify-between">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10">
                    <span class="material-symbols-outlined text-[14px]">place</span> {{ categoryMeta.label }}
                  </span>
                  <div class="flex gap-2">
                    <button class="text-[#60708a] hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100" aria-label="이 시설 공유하기" @click="handleShare">
                      <span class="material-symbols-outlined">share</span>
                    </button>
                  </div>
                </div>
                <h1 class="text-[#111418] text-3xl font-bold leading-tight tracking-tight">
                  {{ facility.name }}
                </h1>
                <p v-if="facilityIntro" class="text-sm text-[#4b5563] leading-relaxed">
                  {{ facilityIntro }}
                </p>
              </div>

              <!-- Basic Info Card -->
              <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center justify-between">
                  <h2 class="text-[#111418] text-lg font-bold">기본정보</h2>
                </div>
                <div class="p-5 flex flex-col gap-4">
                  <!-- Operating Status Banner -->
                  <ClientOnly>
                    <OperatingStatusBanner
                      v-if="facility.details"
                      :category="facility.category"
                      :details="facility.details as FacilityDetailsAll"
                    />
                  </ClientOnly>

                  <!-- Address -->
                  <div class="flex gap-4 items-start">
                    <div class="mt-0.5 text-[#60708a]">
                      <span class="material-symbols-outlined">location_on</span>
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                      <p class="text-[#111418] text-base font-medium">
                        {{ facility.roadAddress || facility.address }}
                      </p>
                    </div>
                    <button class="ml-auto text-primary text-sm font-medium hover:underline whitespace-nowrap" @click="copyAddress">복사</button>
                  </div>

                  <div v-if="details?.operatingHours || isOpen24Hours || facilityPhone" class="h-px bg-[#f0f2f5] w-full"></div>

                  <!-- Operating Hours -->
                  <div v-if="details?.operatingHours || isOpen24Hours" class="flex gap-4 items-start">
                    <div class="mt-0.5 text-[#60708a]">
                      <span class="material-symbols-outlined">schedule</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class="text-[#111418] text-base font-medium whitespace-pre-line">{{ details?.operatingHours ? formatOperatingHours(details.operatingHours) : '24시간 운영' }}</p>
                        <span v-if="isOpen24Hours" class="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          운영중
                        </span>
                      </div>
                    </div>
                  </div>

                  <div v-if="facilityPhone && (details?.operatingHours || isOpen24Hours)" class="h-px bg-[#f0f2f5] w-full"></div>

                  <!-- Phone (unified) -->
                  <div v-if="facilityPhone" class="flex gap-4 items-center">
                    <div class="text-[#60708a]">
                      <span class="material-symbols-outlined">call</span>
                    </div>
                    <a :href="`tel:${facilityPhone}`" class="text-primary text-base font-medium hover:underline" @click="facility && trackPhoneClick({ facilityId: facility.id, category: facility.category })">{{ facilityPhone }}</a>
                  </div>

                  <!-- Category-specific Basic Info -->

                  <!-- Toilet -->
                  <template v-if="facility.category === 'toilet' && (details?.facilityType || details?.openTime || details?.managingOrg || details?.installDate)">
                    <div class="h-px bg-[#f0f2f5] w-full"></div>
                    <div class="flex flex-col gap-3">
                      <div v-if="details?.facilityType" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">시설유형</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.facilityType }}</span>
                      </div>
                      <div v-if="details?.openTime" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">개방시간</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.openTime }}</span>
                      </div>
                      <div v-if="details?.managingOrg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관리기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.managingOrg }}</span>
                      </div>
                      <div v-if="details?.installDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치일</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.installDate }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- WiFi -->
                  <template v-if="facility.category === 'wifi' && (details?.managementAgency || details?.serviceProvider || details?.installDate)">
                    <div class="h-px bg-[#f0f2f5] w-full"></div>
                    <div class="flex flex-col gap-3">
                      <div v-if="details?.managementAgency" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관리기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.managementAgency }}</span>
                      </div>
                      <div v-if="details?.serviceProvider" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">서비스 제공사</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.serviceProvider }}</span>
                      </div>
                      <div v-if="details?.installDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치일</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.installDate }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Clothes -->
                  <template v-if="facility.category === 'clothes' && (details?.detailLocation || details?.providerName || details?.managementAgency)">
                    <div class="h-px bg-[#f0f2f5] w-full"></div>
                    <div class="flex flex-col gap-3">
                      <div v-if="details?.detailLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">상세 위치</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.detailLocation }}</span>
                      </div>
                      <div v-if="details?.providerName" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">운영기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.providerName }}</span>
                      </div>
                      <div v-if="details?.managementAgency" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관리기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.managementAgency }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Parking -->
                  <template v-if="facility.category === 'parking' && (details?.parkingType || details?.operatingDays || details?.managingOrg)">
                    <div class="h-px bg-[#f0f2f5] w-full"></div>
                    <div class="flex flex-col gap-3">
                      <div v-if="details?.parkingType" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">주차 구분</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.parkingType }}</span>
                      </div>
                      <div v-if="details?.operatingDays" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">운영요일</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.operatingDays }}</span>
                      </div>
                      <div v-if="details?.managingOrg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관리기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.managingOrg }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Library -->
                  <template v-if="facility.category === 'library'">
                    <template v-if="details?.libraryType || details?.operatingOrg || details?.closedDays">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.libraryType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">도서관유형</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.libraryType }}</span>
                        </div>
                        <div v-if="details?.operatingOrg" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">운영기관</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.operatingOrg }}</span>
                        </div>
                        <div v-if="details?.closedDays" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">휴관일</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.closedDays }}</span>
                        </div>
                      </div>
                    </template>
                    <template v-if="details?.weekdayOpenTime || details?.saturdayOpenTime || details?.holidayOpenTime">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.weekdayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">평일</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.weekdayOpenTime }} ~ {{ details?.weekdayCloseTime }}</span>
                        </div>
                        <div v-if="details?.saturdayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">토요일</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.saturdayOpenTime }} ~ {{ details?.saturdayCloseTime }}</span>
                        </div>
                        <div v-if="details?.holidayOpenTime" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">공휴일</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.holidayOpenTime }} ~ {{ details?.holidayCloseTime }}</span>
                        </div>
                      </div>
                    </template>
                    <template v-if="details?.homepageUrl">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">홈페이지</span>
                        <a :href="details?.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">바로가기</a>
                      </div>
                    </template>
                  </template>

                  <!-- AED -->
                  <template v-if="facility.category === 'aed'">
                    <template v-if="details?.org">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.org }}</span>
                      </div>
                    </template>
                    <template v-if="aedOperatingHours.length > 0">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-for="item in aedOperatingHours" :key="item.day" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                          <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                        </div>
                      </div>
                    </template>
                  </template>

                  <!-- Hospital -->
                  <template v-if="facility.category === 'hospital'">
                    <template v-if="details?.clCdNm || details?.homepage || details?.estbDd">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.clCdNm" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">종별</span>
                          <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">{{ details?.clCdNm }}</span>
                        </div>
                        <div v-if="details?.homepage" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">홈페이지</span>
                          <a :href="details?.homepage" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ details?.homepage }}</a>
                        </div>
                        <div v-if="details?.estbDd" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">개설일자</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.estbDd }}</span>
                        </div>
                      </div>
                    </template>
                    <template v-if="hospitalOperatingHours.length > 0">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-for="item in hospitalOperatingHours" :key="item.day" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                          <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                        </div>
                        <div v-if="details?.lunchWeek" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">점심(평일)</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details.lunchWeek }}</span>
                        </div>
                        <div v-if="details?.lunchSat" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">점심(토)</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details.lunchSat }}</span>
                        </div>
                      </div>
                      <p v-if="details?.noTrmtSun" class="text-xs text-[#6b7280]">
                        <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
                      </p>
                      <p v-if="details?.noTrmtHoli" class="text-xs text-[#6b7280]">
                        <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
                      </p>
                    </template>
                  </template>

                  <!-- Pharmacy -->
                  <template v-if="facility.category === 'pharmacy'">
                    <template v-if="details?.dutyTel3">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex gap-4 items-center">
                        <div class="text-[#60708a]">
                          <span class="material-symbols-outlined">emergency</span>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-xs text-[#4b5563]">응급전화</span>
                          <a :href="`tel:${details?.dutyTel3}`" class="text-primary text-base font-medium hover:underline">{{ details?.dutyTel3 }}</a>
                        </div>
                      </div>
                    </template>
                    <template v-if="pharmacyOperatingHours.length > 0">
                      <div class="h-px bg-[#f0f2f5] w-full"></div>
                      <div class="flex flex-col gap-3">
                        <div v-for="item in pharmacyOperatingHours" :key="item.day" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                          <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                        </div>
                      </div>
                    </template>
                  </template>
                </div>
              </div>


              <!-- Roadview Card (Desktop) -->
              <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5]">
                  <h2 class="text-[#111418] text-lg font-bold">로드뷰</h2>
                </div>
                <div class="p-5">
                  <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
                </div>
              </div>

              <!-- Facility Status Card -->
              <div v-if="hasFacilityStatus" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5]">
                  <h2 class="text-[#111418] text-lg font-bold">시설현황</h2>
                </div>
                <div class="p-5">
                  <div v-if="hasGridContent" class="grid grid-cols-2 gap-4">
                    <!-- Toilet Stalls (if applicable) -->
                    <template v-if="facility.category === 'toilet'">
                      <div v-if="details?.maleToilets" class="col-span-1 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                            <span class="material-symbols-outlined">man</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563]">남자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418]">{{ details?.maleToilets }}칸</span>
                      </div>
                      <div v-if="details?.femaleToilets" class="col-span-1 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-pink-50 text-pink-600 rounded-full">
                            <span class="material-symbols-outlined">woman</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563]">여자 화장실</span>
                        </div>
                        <span class="text-base font-bold text-[#111418]">{{ details?.femaleToilets }}칸</span>
                      </div>
                      <div v-if="details?.maleUrinals" class="col-span-1 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                            <span class="material-symbols-outlined">man</span>
                          </div>
                          <span class="text-sm font-medium text-[#4b5563]">남성용 소변기</span>
                        </div>
                        <span class="text-base font-bold text-[#111418]">{{ details?.maleUrinals }}개</span>
                      </div>
                    </template>

                    <!-- Feature Cards -->
                    <div
                      v-for="amenity in facilityAmenities"
                      :key="amenity"
                      class="bg-white border border-[#e5e7eb] rounded-lg p-3 flex flex-col items-center justify-center gap-2 text-center"
                    >
                      <span class="material-symbols-outlined text-primary text-3xl">{{ getAmenityIcon(amenity) }}</span>
                      <span class="text-sm font-medium text-[#111418]">{{ amenity }}</span>
                      <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">설치됨</span>
                    </div>
                  </div>

                  <!-- Toilet Extra Details -->
                  <template v-if="facility.category === 'toilet'">
                    <div v-if="details?.ownershipType" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">소유구분</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.ownershipType }}</span>
                      </div>
                    </div>

                    <!-- Toilet Accessibility Details -->
                    <div v-if="toiletAccessibilityDetails.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">접근성 상세</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div
                          v-for="item in toiletAccessibilityDetails"
                          :key="item.label"
                          class="bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]"
                        >
                          <span class="text-sm text-[#4b5563]">{{ item.label }}</span>
                          <span class="text-sm font-bold text-[#111418]">{{ item.value }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Emergency Bell / Diaper Changing Location -->
                    <div v-if="details?.emergencyBellLocation || details?.diaperChangingLocation" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">편의시설 위치</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.emergencyBellLocation" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">비상벨 위치</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.emergencyBellLocation }}</span>
                        </div>
                        <div v-if="details?.diaperChangingLocation" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">기저귀교환대 위치</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.diaperChangingLocation }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Wifi Details -->
                  <template v-if="facility.category === 'wifi'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.ssid" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">SSID</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.ssid }}</span>
                      </div>
                      <div v-if="details?.installLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치 장소</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.installLocation }}</span>
                      </div>
                      <div v-if="details?.installLocationDetail && details?.installLocationDetail !== details?.installLocation" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치 장소 상세</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.installLocationDetail }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Parking Details -->
                  <template v-if="facility.category === 'parking'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '']">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">요금 정보</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.feeType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">요금구분</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.feeType }}</span>
                        </div>
                        <div v-if="details?.baseFee != null && details?.baseTime != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">기본요금</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.baseFee }}원 / {{ details?.baseTime }}분</span>
                        </div>
                        <div v-if="details?.additionalFee != null && details?.additionalTime != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">추가요금</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.additionalFee }}원 / {{ details?.additionalTime }}분</span>
                        </div>
                        <div v-if="details?.dailyMaxFee != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">일 최대요금</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.dailyMaxFee }}원</span>
                        </div>
                        <div v-if="details?.dailyMaxFeeHours" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">일최대요금 적용시간</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.dailyMaxFeeHours }}</span>
                        </div>
                        <div v-if="details?.monthlyFee != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">월정기권</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.monthlyFee }}원</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">시설 정보</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.lotType" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">주차장 유형</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.lotType }}</span>
                        </div>
                        <div v-if="details?.capacity" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">주차면수</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.capacity }}면</span>
                        </div>
                        <div v-if="details?.paymentMethod" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">결제방법</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.paymentMethod }}</span>
                        </div>
                        <div v-if="details?.hasDisabledParking !== undefined" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">장애인 주차구역</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.hasDisabledParking ? '있음' : '없음' }}</span>
                        </div>
                        <div v-if="details?.alternateParking" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">부제 운영</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.alternateParking }}</span>
                        </div>
                        <div v-if="details?.remarks" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">특기사항</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.remarks }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Library Details -->
                  <template v-if="facility.category === 'library'">
                    <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.seatCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">좌석수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.seatCount.toLocaleString() }}석</span>
                      </div>
                      <div v-if="details?.bookCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">장서수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.bookCount.toLocaleString() }}권</span>
                      </div>
                      <div v-if="details?.serialCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">연속간행물</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.serialCount.toLocaleString() }}종</span>
                      </div>
                      <div v-if="details?.nonBookCount" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">비도서 자료</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.nonBookCount.toLocaleString() }}점</span>
                      </div>
                      <div v-if="details?.loanableBooks" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">대출가능 권수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.loanableBooks }}권</span>
                      </div>
                      <div v-if="details?.loanableDays" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">대출가능 일수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.loanableDays }}일</span>
                      </div>
                    </div>

                    <!-- Library Facility Size -->
                    <div v-if="details?.lotArea || details?.buildingArea" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">시설 규모</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.lotArea" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">부지면적</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.lotArea }}㎡</span>
                        </div>
                        <div v-if="details?.buildingArea" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">건물면적</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.buildingArea }}㎡</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- AED Details -->
                  <template v-if="facility.category === 'aed'">
                    <div v-if="details?.buildPlace || details?.mfg || details?.model" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                      <div v-if="details?.buildPlace" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설치위치</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.buildPlace }}</span>
                      </div>
                      <div v-if="details?.mfg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">제조사</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.mfg }}</span>
                      </div>
                      <div v-if="details?.model" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">모델명</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details?.model }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Park Details -->
                  <template v-if="facility.category === 'park'">
                    <div class="flex flex-col gap-3">
                      <div v-if="details?.parkType" class="grid grid-cols-2 gap-2">
                        <div class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">공원유형</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.parkType }}</span>
                        </div>
                      </div>
                      <div v-if="details?.area != null" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">면적</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.area.toLocaleString() }}㎡ (약 {{ Math.round(details.area * 0.3025).toLocaleString() }}평)</span>
                      </div>
                      <div v-if="details?.designatedDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">지정일</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.designatedDate }}</span>
                      </div>
                      <div v-if="details?.managingOrg" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관리기관</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.managingOrg }}</span>
                      </div>
                    </div>
                    <div v-if="parkHasFacilities" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">보유 시설</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.exerciseFacilities" class="flex items-start justify-between gap-4">
                          <span class="text-sm text-[#4b5563] shrink-0">운동시설</span>
                          <span class="text-sm font-medium text-[#111418] text-right">{{ details.exerciseFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                        </div>
                        <div v-if="details?.playFacilities" class="flex items-start justify-between gap-4">
                          <span class="text-sm text-[#4b5563] shrink-0">놀이시설</span>
                          <span class="text-sm font-medium text-[#111418] text-right">{{ details.playFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                        </div>
                        <div v-if="details?.convenienceFacilities" class="flex items-start justify-between gap-4">
                          <span class="text-sm text-[#4b5563] shrink-0">편의시설</span>
                          <span class="text-sm font-medium text-[#111418] text-right">{{ details.convenienceFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                        </div>
                        <div v-if="details?.cultureFacilities" class="flex items-start justify-between gap-4">
                          <span class="text-sm text-[#4b5563] shrink-0">교양시설</span>
                          <span class="text-sm font-medium text-[#111418] text-right">{{ details.cultureFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                        </div>
                        <div v-if="details?.otherFacilities" class="flex items-start justify-between gap-4">
                          <span class="text-sm text-[#4b5563] shrink-0">기타시설</span>
                          <span class="text-sm font-medium text-[#111418] text-right">{{ details.otherFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- School Details -->
                  <template v-if="facility.category === 'school'">
                    <div class="flex flex-col gap-3">
                      <div class="grid grid-cols-2 gap-2">
                        <div v-if="details?.schoolLevel" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">학교급</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.schoolLevel }}</span>
                        </div>
                        <div v-if="details?.foundationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">설립형태</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.foundationType }}</span>
                        </div>
                        <div v-if="details?.coeducationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">남녀공학</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.coeducationType }}</span>
                        </div>
                        <div v-if="details?.highSchoolType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">고교유형</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.highSchoolType }}</span>
                        </div>
                        <div v-if="details?.branchType?.includes('분교')" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">분교여부</span>
                          <span class="text-sm font-bold text-[#111418]">분교</span>
                        </div>
                      </div>
                      <div v-if="details?.foundedDate" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">설립일</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.foundedDate }}</span>
                      </div>
                      <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">연락처</span>
                        <a :href="`tel:${details.phoneNumber}`" class="text-sm font-medium text-blue-600 hover:underline">{{ details.phoneNumber }}</a>
                      </div>
                      <div v-if="details?.faxNumber" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">팩스</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.faxNumber }}</span>
                      </div>
                    </div>
                    <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-2">홈페이지</h3>
                      <a :href="schoolHomepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline break-all">{{ details.homepageUrl }}</a>
                    </div>
                    <div v-if="details?.sidoEduName || details?.localEduName" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">관할 교육청</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.sidoEduName" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">시도교육청</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details.sidoEduName }}</span>
                        </div>
                        <div v-if="details?.localEduName" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">교육지원청</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details.localEduName }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="schoolEnrollmentRows.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">학급 현황</h3>
                      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        <div v-for="row in schoolEnrollmentRows" :key="row.label" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2" :class="row.isTotal ? 'bg-indigo-50 col-span-full' : 'bg-[#f8f9fa]'">
                          <span class="text-xs text-[#4b5563]">{{ row.label }}</span>
                          <span class="text-sm font-bold" :class="row.isTotal ? 'text-indigo-600' : 'text-[#111418]'">{{ row.classCount }}반</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="schoolDepartments.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">계열 정보</h3>
                      <div class="flex flex-wrap gap-2">
                        <span v-for="dept in schoolDepartments" :key="dept" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800">{{ dept }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Market Details -->
                  <template v-if="facility.category === 'market'">
                    <div class="flex flex-col gap-3">
                      <div class="grid grid-cols-2 gap-2">
                        <div v-if="details?.marketType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">시장유형</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.marketType }}</span>
                        </div>
                        <div v-if="details?.openingCycle" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">개설주기</span>
                          <span class="text-sm font-bold text-[#111418]">{{ marketOpeningCycleLabel }}</span>
                        </div>
                      </div>
                      <div v-if="details?.storeCount != null" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">점포 수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.storeCount.toLocaleString() }}개</span>
                      </div>
                      <div v-if="details?.foundedYear != null" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">개설연도</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.foundedYear }}년</span>
                      </div>
                    </div>
                    <div v-if="marketProductTags.length" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">주요 판매품목</h3>
                      <div class="flex flex-wrap gap-1">
                        <span v-for="tag in marketProductTags" :key="tag" class="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs">{{ tag }}</span>
                      </div>
                    </div>
                    <div v-if="details?.hasPublicToilet != null || details?.hasParking != null" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">편의시설</h3>
                      <div class="grid grid-cols-2 gap-2">
                        <div v-if="details?.hasPublicToilet != null" class="flex items-center gap-1.5 text-sm text-gray-700">
                          <span :class="details.hasPublicToilet ? 'text-green-600' : 'text-gray-400'">{{ details.hasPublicToilet ? '✓' : '✗' }}</span>
                          <span>공중화장실</span>
                        </div>
                        <div v-if="details?.hasParking != null" class="flex items-center gap-1.5 text-sm text-gray-700">
                          <span :class="details.hasParking ? 'text-green-600' : 'text-gray-400'">{{ details.hasParking ? '✓' : '✗' }}</span>
                          <span>주차시설</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">홈페이지</span>
                        <a :href="details.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-primary font-medium underline">{{ details.homepageUrl }}</a>
                      </div>
                    </div>
                  </template>

                  <!-- Childcare Details -->
                  <template v-if="facility.category === 'childcare'">
                    <!-- 카드형 속성 + 휴지 알림 -->
                    <div class="grid grid-cols-2 gap-2">
                      <div v-if="details?.crtypename" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                        <span class="text-xs text-[#4b5563]">어린이집 유형</span>
                        <span class="text-sm font-bold text-[#111418]">{{ details.crtypename }}</span>
                      </div>
                      <div v-if="details?.crstatusname" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                        <span class="text-xs text-[#4b5563]">운영 상태</span>
                        <span class="text-sm font-bold text-[#111418]">{{ details.crstatusname }}</span>
                      </div>
                    </div>
                    <div v-if="details?.crpausebegindt && details?.crpauseenddt" class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      휴지 기간: {{ details.crpausebegindt }} ~ {{ details.crpauseenddt }}
                    </div>

                    <!-- 기본 정보 테이블 -->
                    <div class="mt-4">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">기본 정보</h3>
                      <table class="w-full text-sm">
                        <tbody class="divide-y divide-[#f0f2f5]">
                          <tr v-if="details?.crcnfmdt">
                            <td class="py-2.5 text-[#4b5563] w-28">인가일</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crcnfmdt }}</td>
                          </tr>
                          <tr v-if="details?.crrepname">
                            <td class="py-2.5 text-[#4b5563]">대표자</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crrepname }}</td>
                          </tr>
                          <tr v-if="details?.crtelno">
                            <td class="py-2.5 text-[#4b5563]">연락처</td>
                            <td class="py-2.5 text-right"><a :href="'tel:' + details.crtelno" class="font-medium text-blue-600 hover:underline">{{ details.crtelno }}</a></td>
                          </tr>
                          <tr v-if="details?.crfaxno">
                            <td class="py-2.5 text-[#4b5563]">팩스</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crfaxno }}</td>
                          </tr>
                          <tr v-if="details?.crcargbname">
                            <td class="py-2.5 text-[#4b5563]">통학차량</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crcargbname }}</td>
                          </tr>
                          <tr v-if="details?.crhome">
                            <td class="py-2.5 text-[#4b5563]">홈페이지</td>
                            <td class="py-2.5 text-right"><a :href="details.crhome" target="_blank" rel="noopener noreferrer" class="font-medium text-blue-600 hover:underline truncate inline-block max-w-[200px]">{{ details.crhome }}</a></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- 정원·현원 + 시설 정보 (2열 그리드) -->
                    <div class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">정원·시설 현황</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div v-if="details?.crcapat != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">정원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.crcapat }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                        <div v-if="details?.crchcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">현원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.crchcnt }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                        <div v-if="details?.nrtrroomcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">보육실</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.nrtrroomcnt }}<span class="text-xs font-normal text-[#4b5563]">개</span></p>
                        </div>
                        <div v-if="details?.cctvinstlcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">CCTV</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.cctvinstlcnt }}<span class="text-xs font-normal text-[#4b5563]">대</span></p>
                        </div>
                        <div v-if="details?.plgrdco != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">놀이터</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.plgrdco }}<span class="text-xs font-normal text-[#4b5563]">개</span></p>
                        </div>
                        <div v-if="details?.chcrtescnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">교직원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.chcrtescnt }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                      </div>
                      <div v-if="details?.crcapat != null && details?.crchcnt != null && details.crcapat > 0" class="mt-3">
                        <div class="flex items-center justify-between text-xs text-[#4b5563] mb-1">
                          <span>가용률</span>
                          <span class="font-medium">{{ childcareAvailabilityRate }}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="h-2 rounded-full transition-all" :class="childcareOccupancyPct >= 90 ? 'bg-red-400' : childcareOccupancyPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'" :style="{ width: Math.min(childcareOccupancyPct, 100) + '%' }" />
                        </div>
                      </div>
                    </div>

                    <!-- 반별 정원·현원 -->
                    <div v-if="childcareClassRows.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">연령별 반·아동 현황</h3>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="bg-[#f8f9fa]">
                              <th class="py-2 px-3 text-left text-[#4b5563] font-medium rounded-tl-lg">연령</th>
                              <th class="py-2 px-2 text-right text-[#4b5563] font-medium">반 수</th>
                              <th class="py-2 px-2 text-right text-[#4b5563] font-medium">아동 수</th>
                              <th class="py-2 px-3 text-right text-[#4b5563] font-medium rounded-tr-lg">반당 평균</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-[#f0f2f5]">
                            <tr v-for="row in childcareClassRows" :key="row.label" :class="row.label === '합계' ? 'bg-[#f8f9fa] font-semibold' : ''">
                              <td class="py-2 px-3 text-[#111418]">{{ row.label }}</td>
                              <td class="py-2 px-2 text-right text-[#4b5563]">{{ row.classes != null ? row.classes + '개' : '-' }}</td>
                              <td class="py-2 px-2 text-right text-[#4b5563]">{{ row.children != null ? row.children + '명' : '-' }}</td>
                              <td class="py-2 px-3 text-right text-[#4b5563]">{{ row.avg != null ? row.avg + '명' : '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- 직원 현황 -->
                    <div v-if="(details as any)?.emCntTot || childcareStaffRoles.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">직원 현황 <span v-if="(details as any)?.emCntTot" class="text-[#4b5563] font-normal">(총 {{ (details as any).emCntTot }}명)</span></h3>
                      <table class="w-full text-sm">
                        <tbody class="divide-y divide-[#f0f2f5]">
                          <tr v-for="role in childcareStaffRoles" :key="role.label">
                            <td class="py-2 text-[#4b5563]">{{ role.label }}</td>
                            <td class="py-2 text-[#111418] font-medium text-right">{{ role.cnt }}명</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- 교사 경력 분포 -->
                    <div v-if="childcareCareerItems.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">교사 경력 분포</h3>
                      <div class="flex flex-wrap gap-2">
                        <span v-for="item in childcareCareerItems" :key="item.label" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" :class="item.colorClass">
                          {{ item.label }} <span class="font-semibold">{{ item.cnt }}명</span>
                        </span>
                      </div>
                    </div>

                    <!-- 특이사항 -->
                    <div v-if="details?.crspec" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-2">특이사항</h3>
                      <p class="text-sm text-[#4b5563] bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg px-3 py-2">{{ details.crspec }}</p>
                    </div>

                    <!-- 데이터 기준일 -->
                    <div v-if="details?.datastdrdt" class="mt-4 pt-3 border-t border-[#f0f2f5]">
                      <p class="text-xs text-[#9ca3af]">데이터 기준일: {{ details.datastdrdt }}</p>
                    </div>
                  </template>

                  <!-- EvCharger Details -->
                  <template v-if="facility.category === 'ev-charger'">
                    <EvChargerDetail :details="details as any" />
                  </template>

                  <!-- Sports Details -->
                  <template v-if="facility.category === 'sports'">
                    <div class="flex flex-col gap-3">
                      <div class="grid grid-cols-2 gap-2">
                        <div v-if="details?.ftypeNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">시설유형</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.ftypeNm }}</span>
                        </div>
                        <div v-if="details?.faciGbNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">시설구분</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details.faciGbNm }}</span>
                        </div>
                        <div v-if="details?.nationYn === 'Y'" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                          <span class="text-xs text-[#4b5563]">국가대표시설</span>
                          <span class="text-sm font-bold text-[#111418]">Y</span>
                        </div>
                      </div>
                      <div v-if="details?.fcobNm" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">업종명</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.fcobNm }}</span>
                      </div>
                      <div v-if="details?.faciGfa" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">시설면적</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.faciGfa }}㎡</span>
                      </div>
                      <div v-if="details?.standCptPsnCnt != null" class="flex items-center justify-between">
                        <span class="text-sm text-[#4b5563]">관람석수</span>
                        <span class="text-sm font-medium text-[#111418]">{{ details.standCptPsnCnt.toLocaleString() }}석</span>
                      </div>
                    </div>
                  </template>

                  <!-- Hospital Details -->
                  <template v-if="facility.category === 'hospital'">
                    <!-- Hospital Staff Info -->
                    <div v-if="details?.drTotCnt" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">의료진 현황</h3>
                      <div class="flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">의사 총수</span>
                          <span class="text-sm font-bold text-[#111418]">{{ details?.drTotCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptSdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">의과 전문의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptSdrCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptGdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">의과 일반의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptGdrCnt }}명</span>
                        </div>
                        <div v-if="details?.detySdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">치과 전문의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.detySdrCnt }}명</span>
                        </div>
                        <div v-if="details?.cmdcSdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">한방 전문의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcSdrCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptIntnCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">의과 인턴</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptIntnCnt }}명</span>
                        </div>
                        <div v-if="details?.mdeptResdntCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">의과 레지던트</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptResdntCnt }}명</span>
                        </div>
                        <div v-if="details?.detyGdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">치과 일반의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.detyGdrCnt }}명</span>
                        </div>
                        <div v-if="details?.detyIntnCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">치과 인턴</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.detyIntnCnt }}명</span>
                        </div>
                        <div v-if="details?.detyResdntCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">치과 레지던트</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.detyResdntCnt }}명</span>
                        </div>
                        <div v-if="details?.cmdcGdrCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">한방 일반의</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcGdrCnt }}명</span>
                        </div>
                        <div v-if="details?.cmdcIntnCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">한방 인턴</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcIntnCnt }}명</span>
                        </div>
                        <div v-if="details?.cmdcResdntCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">한방 레지던트</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcResdntCnt }}명</span>
                        </div>
                        <div v-if="details?.pnursCnt" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">간호사</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details?.pnursCnt }}명</span>
                        </div>
                      </div>
                    </div>

                    <!-- Hospital Departments -->
                    <div v-if="details?.departments?.length" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">진료과목</h3>
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="dept in details.departments" :key="dept.dgsbjtCdNm"
                          class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
                          {{ dept.dgsbjtCdNm }}
                          <span v-if="dept.dgsbjtPrSdrCnt" class="ml-1 text-teal-500">({{ dept.dgsbjtPrSdrCnt }}명)</span>
                        </span>
                      </div>
                    </div>

                    <!-- Hospital Parking Info -->
                    <div v-if="details?.parkQty != null || details?.parkEtc" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">주차정보</h3>
                      <div class="flex flex-col gap-3">
                        <div v-if="details?.parkQty != null" class="flex items-center justify-between">
                          <span class="text-sm text-[#4b5563]">주차가능대수</span>
                          <span class="text-sm font-medium text-[#111418]">{{ details.parkQty }}대</span>
                        </div>
                        <p v-if="details?.parkEtc" class="text-sm text-[#4b5563]">{{ details.parkEtc }}</p>
                      </div>
                    </div>
                  </template>

                </div>
              </div>

              <!-- Nearby Facilities -->
              <div v-if="nearbyLoading || nearbyFiltered.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[20px]">near_me</span>
                  <h2 class="text-[#111418] text-lg font-bold">주변 {{ categoryMeta.label }}</h2>
                </div>
                <div class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <template v-if="nearbyLoading">
                    <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
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
                <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                  <div class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-for="group in crossFacilitiesGrouped" :key="group.category"
                     class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                  <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">{{ group.meta.icon }}</span>
                    <h2 class="text-[#111418] text-lg font-bold">주변 {{ group.meta.label }}</h2>
                  </div>
                  <div class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <FacilityCard
                      v-for="item in group.items"
                      :key="item.id"
                      :facility="item"
                      highlight-distance
                    />
                  </div>
                </div>
              </template>

              <!-- Review Section (Desktop Left Column) -->
              <ClientOnly>
                <ReviewSection v-if="id" :category="category" :facility-id="id" />
              </ClientOnly>

              <!-- 같은 지역 시설 링크 -->
              <nav v-if="regionLink" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[20px]">explore</span>
                  <h2 class="text-[#111418] text-lg font-bold">같은 지역 시설</h2>
                </div>
                <div class="p-5 flex flex-col gap-3">
                  <NuxtLink
                    :to="regionLink.href"
                    class="flex items-center gap-2 text-primary hover:text-blue-600 text-sm font-medium transition-colors"
                  >
                    <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                    {{ regionLink.label }}
                  </NuxtLink>
                  <NuxtLink
                    :to="regionLink.cityHref"
                    class="flex items-center gap-2 text-[#48699d] hover:text-primary text-sm font-medium transition-colors"
                  >
                    <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                    {{ regionLink.cityLabel }}
                  </NuxtLink>
                </div>
              </nav>

              <!-- 이 지역 다른 시설 (Desktop) -->
              <nav v-if="relatedCategories.length > 0" data-testid="related-categories" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[20px]">category</span>
                  <h2 class="text-[#111418] text-lg font-bold">이 지역 다른 시설</h2>
                </div>
                <div class="p-5 flex flex-wrap gap-2">
                  <NuxtLink
                    v-for="cat in relatedCategories"
                    :key="cat"
                    :to="regionLink && regionLink.href.endsWith(category) ? regionLink.href.replace(category, cat) : `/${cat}`"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
                  >
                    {{ CATEGORY_META[cat as FacilityCategory]?.label || cat }}
                  </NuxtLink>
                </div>
              </nav>

              <!-- 이용 팁 -->
              <div v-if="categoryTips.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#60708a] text-[20px]">lightbulb</span>
                  <h2 class="text-[#111418] text-lg font-bold">{{ categoryMeta.label }} 이용 팁</h2>
                </div>
                <ul class="p-5 flex flex-col gap-2.5">
                  <li v-for="(tip, i) in categoryTips" :key="i" class="flex items-start gap-2 text-sm text-[#4b5563] leading-relaxed">
                    <span class="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">check</span>
                    {{ tip }}
                  </li>
                </ul>
              </div>

              <!-- FAQ -->
              <div v-if="categoryFaqItems.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#60708a] text-[20px]">help</span>
                  <h2 class="text-[#111418] text-lg font-bold">자주 묻는 질문</h2>
                </div>
                <div class="p-5 flex flex-col gap-4">
                  <div v-for="(faq, i) in categoryFaqItems" :key="i">
                    <h3 class="text-sm font-bold text-[#111418] mb-1">Q. {{ faq.question }}</h3>
                    <p class="text-sm text-[#4b5563] leading-relaxed">{{ faq.answer }}</p>
                  </div>
                </div>
              </div>

              <!-- Data Info Card -->
              <div v-if="dataDate || lastSyncDate || dataPortalUrl" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
                <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#60708a] text-[20px]">description</span>
                  <h2 class="text-[#111418] text-lg font-bold">데이터 정보</h2>
                </div>
                <div class="p-5 flex flex-col gap-3">
                  <div v-if="dataDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">데이터 기준일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ dataDate }}</span>
                  </div>
                  <div v-if="lastSyncDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">최근 동기화</span>
                    <span class="text-sm font-medium text-[#111418]">{{ lastSyncDate }}</span>
                  </div>
                  <div v-if="dataPortalUrl" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">출처</span>
                    <a :href="dataPortalUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">공공데이터포털</a>
                  </div>
                  <div class="mt-1 flex items-start gap-1.5 text-xs text-[#9ca3af]">
                    <span class="material-symbols-outlined text-[14px] mt-px">info</span>
                    <span>공공데이터포털 기준 정보입니다</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Map & Actions (Desktop) -->
            <div class="lg:sticky lg:top-24 w-full flex flex-col">
              <!-- Map Container -->
              <div class="relative w-full aspect-square bg-[#e5e7eb] h-full rounded-xl overflow-hidden shadow-md min-h-[300px]" role="img" aria-label="시설 위치 지도">
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
                  <div class="flex flex-col bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
                    <button aria-label="Zoom In" class="w-11 h-11 flex items-center justify-center text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                      <span class="material-symbols-outlined">add</span>
                    </button>
                    <button aria-label="Zoom Out" class="w-11 h-11 flex items-center justify-center text-gray-700 hover:bg-gray-50">
                      <span class="material-symbols-outlined">remove</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Action Buttons (Desktop Sticky Bottom) -->
              <div class="mt-4 p-4 bg-white border-t border-[#e5e7eb] flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-xl#1a2630]">
                <button
                  class="flex-1 h-12 rounded-xl bg-[#f0f2f5] text-[#111418] font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
                  aria-label="이 시설 공유하기"
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
                  <div v-if="showNavDropdown" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-[#e5e7eb] overflow-hidden z-20">
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                      <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                    </button>
                    <div class="h-px bg-[#f0f2f5]"></div>
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                      <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: Info Section (Desktop-style cards) -->
        <div class="md:hidden px-4 flex flex-col gap-6 pt-4">
          <!-- Mobile Breadcrumb -->
          <Breadcrumb :items="breadcrumbItems" />

          <!-- Page Heading & Badges -->
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10">
                <span class="material-symbols-outlined text-[14px]">place</span> {{ categoryMeta.label }}
              </span>
              <button class="text-[#60708a] hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100" aria-label="이 시설 공유하기" @click="handleShare">
                <span class="material-symbols-outlined">share</span>
              </button>
            </div>
            <h2 class="text-[#111418] text-2xl font-bold leading-tight tracking-tight">
              {{ facility.name }}
            </h2>
            <p v-if="facilityIntro" class="text-sm text-[#4b5563] leading-relaxed">
              {{ facilityIntro }}
            </p>
          </div>

          <!-- Basic Info Card -->
          <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center justify-between">
              <h2 class="text-[#111418] text-lg font-bold">기본정보</h2>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <!-- Operating Status Banner -->
              <ClientOnly>
                <OperatingStatusBanner
                  v-if="facility.details"
                  :category="facility.category"
                  :details="facility.details as FacilityDetailsAll"
                />
              </ClientOnly>

              <!-- Address -->
              <div class="flex gap-4 items-start">
                <div class="mt-0.5 text-[#60708a]">
                  <span class="material-symbols-outlined">location_on</span>
                </div>
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <p class="text-[#111418] text-base font-medium break-words">
                    {{ facility.roadAddress || facility.address }}
                  </p>
                </div>
                <button class="ml-auto text-primary text-sm font-medium hover:underline whitespace-nowrap shrink-0" @click="copyAddress">복사</button>
              </div>

              <div v-if="details?.operatingHours || isOpen24Hours || facilityPhone" class="h-px bg-[#f0f2f5] w-full"></div>

              <!-- Operating Hours -->
              <div v-if="details?.operatingHours || isOpen24Hours" class="flex gap-4 items-start">
                <div class="mt-0.5 text-[#60708a]">
                  <span class="material-symbols-outlined">schedule</span>
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-[#111418] text-base font-medium whitespace-pre-line">{{ details?.operatingHours ? formatOperatingHours(details.operatingHours) : '24시간 운영' }}</p>
                    <span v-if="isOpen24Hours" class="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      운영중
                    </span>
                  </div>
                </div>
              </div>

              <div v-if="facilityPhone && (details?.operatingHours || isOpen24Hours)" class="h-px bg-[#f0f2f5] w-full"></div>

              <!-- Phone (unified) -->
              <div v-if="facilityPhone" class="flex gap-4 items-center">
                <div class="text-[#60708a]">
                  <span class="material-symbols-outlined">call</span>
                </div>
                <a :href="`tel:${facilityPhone}`" class="text-primary text-base font-medium hover:underline" @click="facility && trackPhoneClick({ facilityId: facility.id, category: facility.category })">{{ facilityPhone }}</a>
              </div>

              <!-- Category-specific Basic Info -->

              <!-- Toilet -->
              <template v-if="facility.category === 'toilet' && (details?.facilityType || details?.openTime || details?.managingOrg || details?.installDate)">
                <div class="h-px bg-[#f0f2f5] w-full"></div>
                <div class="flex flex-col gap-3">
                  <div v-if="details?.facilityType" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">시설유형</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.facilityType }}</span>
                  </div>
                  <div v-if="details?.openTime" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">개방시간</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.openTime }}</span>
                  </div>
                  <div v-if="details?.managingOrg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관리기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.managingOrg }}</span>
                  </div>
                  <div v-if="details?.installDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.installDate }}</span>
                  </div>
                </div>
              </template>

              <!-- WiFi -->
              <template v-if="facility.category === 'wifi' && (details?.managementAgency || details?.serviceProvider || details?.installDate)">
                <div class="h-px bg-[#f0f2f5] w-full"></div>
                <div class="flex flex-col gap-3">
                  <div v-if="details?.managementAgency" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관리기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.managementAgency }}</span>
                  </div>
                  <div v-if="details?.serviceProvider" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">서비스 제공사</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.serviceProvider }}</span>
                  </div>
                  <div v-if="details?.installDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.installDate }}</span>
                  </div>
                </div>
              </template>

              <!-- Clothes -->
              <template v-if="facility.category === 'clothes' && (details?.detailLocation || details?.providerName || details?.managementAgency)">
                <div class="h-px bg-[#f0f2f5] w-full"></div>
                <div class="flex flex-col gap-3">
                  <div v-if="details?.detailLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">상세 위치</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.detailLocation }}</span>
                  </div>
                  <div v-if="details?.providerName" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">운영기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.providerName }}</span>
                  </div>
                  <div v-if="details?.managementAgency" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관리기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.managementAgency }}</span>
                  </div>
                </div>
              </template>

              <!-- Parking -->
              <template v-if="facility.category === 'parking' && (details?.parkingType || details?.operatingDays || details?.managingOrg)">
                <div class="h-px bg-[#f0f2f5] w-full"></div>
                <div class="flex flex-col gap-3">
                  <div v-if="details?.parkingType" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">주차 구분</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.parkingType }}</span>
                  </div>
                  <div v-if="details?.operatingDays" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">운영요일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.operatingDays }}</span>
                  </div>
                  <div v-if="details?.managingOrg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관리기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.managingOrg }}</span>
                  </div>
                </div>
              </template>

              <!-- Library -->
              <template v-if="facility.category === 'library'">
                <template v-if="details?.libraryType || details?.operatingOrg || details?.closedDays">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.libraryType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">도서관유형</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.libraryType }}</span>
                    </div>
                    <div v-if="details?.operatingOrg" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">운영기관</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.operatingOrg }}</span>
                    </div>
                    <div v-if="details?.closedDays" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">휴관일</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.closedDays }}</span>
                    </div>
                  </div>
                </template>
                <template v-if="details?.weekdayOpenTime || details?.saturdayOpenTime || details?.holidayOpenTime">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.weekdayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">평일</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.weekdayOpenTime }} ~ {{ details?.weekdayCloseTime }}</span>
                    </div>
                    <div v-if="details?.saturdayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">토요일</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.saturdayOpenTime }} ~ {{ details?.saturdayCloseTime }}</span>
                    </div>
                    <div v-if="details?.holidayOpenTime" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">공휴일</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.holidayOpenTime }} ~ {{ details?.holidayCloseTime }}</span>
                    </div>
                  </div>
                </template>
                <template v-if="details?.homepageUrl">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">홈페이지</span>
                    <a :href="details?.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">바로가기</a>
                  </div>
                </template>
              </template>

              <!-- AED -->
              <template v-if="facility.category === 'aed'">
                <template v-if="details?.org">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.org }}</span>
                  </div>
                </template>
                <template v-if="aedOperatingHours.length > 0">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-for="item in aedOperatingHours" :key="item.day" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                      <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                    </div>
                  </div>
                </template>
              </template>

              <!-- Hospital -->
              <template v-if="facility.category === 'hospital'">
                <template v-if="details?.clCdNm || details?.homepage || details?.estbDd">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.clCdNm" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">종별</span>
                      <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">{{ details?.clCdNm }}</span>
                    </div>
                    <div v-if="details?.homepage" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">홈페이지</span>
                      <a :href="details?.homepage" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ details?.homepage }}</a>
                    </div>
                    <div v-if="details?.estbDd" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">개설일자</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.estbDd }}</span>
                    </div>
                  </div>
                </template>
                <template v-if="hospitalOperatingHours.length > 0">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-for="item in hospitalOperatingHours" :key="item.day" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                      <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                    </div>
                    <div v-if="details?.lunchWeek" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">점심(평일)</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details.lunchWeek }}</span>
                    </div>
                    <div v-if="details?.lunchSat" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">점심(토)</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details.lunchSat }}</span>
                    </div>
                  </div>
                  <p v-if="details?.noTrmtSun" class="text-xs text-[#6b7280]">
                    <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
                  </p>
                  <p v-if="details?.noTrmtHoli" class="text-xs text-[#6b7280]">
                    <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
                  </p>
                </template>
              </template>

              <!-- Pharmacy -->
              <template v-if="facility.category === 'pharmacy'">
                <template v-if="details?.dutyTel3">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex gap-4 items-center">
                    <div class="text-[#60708a]">
                      <span class="material-symbols-outlined">emergency</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-xs text-[#4b5563]">응급전화</span>
                      <a :href="`tel:${details?.dutyTel3}`" class="text-primary text-base font-medium hover:underline">{{ details?.dutyTel3 }}</a>
                    </div>
                  </div>
                </template>
                <template v-if="pharmacyOperatingHours.length > 0">
                  <div class="h-px bg-[#f0f2f5] w-full"></div>
                  <div class="flex flex-col gap-3">
                    <div v-for="item in pharmacyOperatingHours" :key="item.day" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">{{ item.day }}</span>
                      <span class="text-sm font-medium text-[#111418]">{{ item.time }}</span>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <!-- Roadview Card (Mobile) -->
          <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5]">
              <h2 class="text-[#111418] text-lg font-bold">로드뷰</h2>
            </div>
            <div class="p-5">
              <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
            </div>
          </div>

          <!-- Facility Status Card -->
          <div v-if="hasFacilityStatus" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5]">
              <h2 class="text-[#111418] text-lg font-bold">시설현황</h2>
            </div>
            <div class="p-5">
              <div v-if="hasGridContent" class="grid grid-cols-2 gap-4">
                <!-- Toilet Stalls -->
                <template v-if="facility.category === 'toilet'">
                  <div v-if="details?.maleToilets" class="col-span-2 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                        <span class="material-symbols-outlined">man</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563]">남자 화장실</span>
                    </div>
                    <span class="text-base font-bold text-[#111418]">{{ details?.maleToilets }}칸</span>
                  </div>
                  <div v-if="details?.femaleToilets" class="col-span-2 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-pink-50 text-pink-600 rounded-full">
                        <span class="material-symbols-outlined">woman</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563]">여자 화장실</span>
                    </div>
                    <span class="text-base font-bold text-[#111418]">{{ details?.femaleToilets }}칸</span>
                  </div>
                  <div v-if="details?.maleUrinals" class="col-span-2 bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                        <span class="material-symbols-outlined">man</span>
                      </div>
                      <span class="text-sm font-medium text-[#4b5563]">남성용 소변기</span>
                    </div>
                    <span class="text-base font-bold text-[#111418]">{{ details?.maleUrinals }}개</span>
                  </div>
                </template>

                <!-- Feature Cards -->
                <div
                  v-for="amenity in facilityAmenities"
                  :key="amenity"
                  class="bg-white border border-[#e5e7eb] rounded-lg p-3 flex flex-col items-center justify-center gap-2 text-center"
                >
                  <span class="material-symbols-outlined text-primary text-3xl">{{ getAmenityIcon(amenity) }}</span>
                  <span class="text-sm font-medium text-[#111418]">{{ amenity }}</span>
                  <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">설치됨</span>
                </div>
              </div>

              <!-- Toilet Extra Details -->
              <template v-if="facility.category === 'toilet'">
                <div v-if="details?.ownershipType" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">소유구분</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.ownershipType }}</span>
                  </div>
                </div>

                <!-- Toilet Accessibility Details -->
                <div v-if="toiletAccessibilityDetails.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">접근성 상세</h3>
                  <div class="grid grid-cols-2 gap-3">
                    <div
                      v-for="item in toiletAccessibilityDetails"
                      :key="item.label"
                      class="bg-[#f9fafb] rounded-lg p-3 flex items-center justify-between border border-[#f0f2f5]"
                    >
                      <span class="text-sm text-[#4b5563]">{{ item.label }}</span>
                      <span class="text-sm font-bold text-[#111418]">{{ item.value }}</span>
                    </div>
                  </div>
                </div>

                <!-- Emergency Bell / Diaper Changing Location -->
                <div v-if="details?.emergencyBellLocation || details?.diaperChangingLocation" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">편의시설 위치</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.emergencyBellLocation" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">비상벨 위치</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.emergencyBellLocation }}</span>
                    </div>
                    <div v-if="details?.diaperChangingLocation" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">기저귀교환대 위치</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.diaperChangingLocation }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Wifi Details -->
              <template v-if="facility.category === 'wifi'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.ssid" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">SSID</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.ssid }}</span>
                  </div>
                  <div v-if="details?.installLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치 장소</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.installLocation }}</span>
                  </div>
                  <div v-if="details?.installLocationDetail && details?.installLocationDetail !== details?.installLocation" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치 장소 상세</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.installLocationDetail }}</span>
                  </div>
                </div>
              </template>

              <!-- Parking Details -->
              <template v-if="facility.category === 'parking'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '']">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">요금 정보</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.feeType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">요금구분</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.feeType }}</span>
                    </div>
                    <div v-if="details?.baseFee != null && details?.baseTime != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">기본요금</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.baseFee }}원 / {{ details?.baseTime }}분</span>
                    </div>
                    <div v-if="details?.additionalFee != null && details?.additionalTime != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">추가요금</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.additionalFee }}원 / {{ details?.additionalTime }}분</span>
                    </div>
                    <div v-if="details?.dailyMaxFee != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">일 최대요금</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.dailyMaxFee }}원</span>
                    </div>
                    <div v-if="details?.dailyMaxFeeHours" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">일최대요금 적용시간</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.dailyMaxFeeHours }}</span>
                    </div>
                    <div v-if="details?.monthlyFee != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">월정기권</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.monthlyFee }}원</span>
                    </div>
                  </div>
                </div>

                <div class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">시설 정보</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.lotType" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">주차장 유형</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.lotType }}</span>
                    </div>
                    <div v-if="details?.capacity" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">주차면수</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.capacity }}면</span>
                    </div>
                    <div v-if="details?.paymentMethod" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">결제방법</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.paymentMethod }}</span>
                    </div>
                    <div v-if="details?.hasDisabledParking !== undefined" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">장애인 주차구역</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.hasDisabledParking ? '있음' : '없음' }}</span>
                    </div>
                    <div v-if="details?.alternateParking" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">부제 운영</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.alternateParking }}</span>
                    </div>
                    <div v-if="details?.remarks" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">특기사항</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.remarks }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Library Details -->
              <template v-if="facility.category === 'library'">
                <div :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.seatCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">좌석수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.seatCount.toLocaleString() }}석</span>
                  </div>
                  <div v-if="details?.bookCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">장서수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.bookCount.toLocaleString() }}권</span>
                  </div>
                  <div v-if="details?.serialCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">연속간행물</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.serialCount.toLocaleString() }}종</span>
                  </div>
                  <div v-if="details?.nonBookCount" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">비도서 자료</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.nonBookCount.toLocaleString() }}점</span>
                  </div>
                  <div v-if="details?.loanableBooks" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">대출가능 권수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.loanableBooks }}권</span>
                  </div>
                  <div v-if="details?.loanableDays" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">대출가능 일수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.loanableDays }}일</span>
                  </div>
                </div>

                <!-- Library Facility Size -->
                <div v-if="details?.lotArea || details?.buildingArea" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">시설 규모</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.lotArea" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">부지면적</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.lotArea }}㎡</span>
                    </div>
                    <div v-if="details?.buildingArea" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">건물면적</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.buildingArea }}㎡</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- AED Details -->
              <template v-if="facility.category === 'aed'">
                <div v-if="details?.buildPlace || details?.mfg || details?.model" :class="[hasGridContent ? 'mt-5 border-t border-[#f0f2f5] pt-5' : '', 'flex flex-col gap-3']">
                  <div v-if="details?.buildPlace" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설치위치</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.buildPlace }}</span>
                  </div>
                  <div v-if="details?.mfg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">제조사</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.mfg }}</span>
                  </div>
                  <div v-if="details?.model" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">모델명</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details?.model }}</span>
                  </div>
                </div>
              </template>

              <!-- Park Details (Mobile) -->
              <template v-if="facility.category === 'park'">
                <div class="flex flex-col gap-3">
                  <div v-if="details?.parkType" class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">공원유형</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.parkType }}</span>
                    </div>
                  </div>
                  <div v-if="details?.area != null" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">면적</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.area.toLocaleString() }}㎡ (약 {{ Math.round(details.area * 0.3025).toLocaleString() }}평)</span>
                  </div>
                  <div v-if="details?.designatedDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">지정일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.designatedDate }}</span>
                  </div>
                  <div v-if="details?.managingOrg" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관리기관</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.managingOrg }}</span>
                  </div>
                </div>
                <div v-if="parkHasFacilities" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">보유 시설</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.exerciseFacilities" class="flex items-start justify-between gap-4">
                      <span class="text-sm text-[#4b5563] shrink-0">운동시설</span>
                      <span class="text-sm font-medium text-[#111418] text-right">{{ details.exerciseFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                    </div>
                    <div v-if="details?.playFacilities" class="flex items-start justify-between gap-4">
                      <span class="text-sm text-[#4b5563] shrink-0">놀이시설</span>
                      <span class="text-sm font-medium text-[#111418] text-right">{{ details.playFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                    </div>
                    <div v-if="details?.convenienceFacilities" class="flex items-start justify-between gap-4">
                      <span class="text-sm text-[#4b5563] shrink-0">편의시설</span>
                      <span class="text-sm font-medium text-[#111418] text-right">{{ details.convenienceFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                    </div>
                    <div v-if="details?.cultureFacilities" class="flex items-start justify-between gap-4">
                      <span class="text-sm text-[#4b5563] shrink-0">교양시설</span>
                      <span class="text-sm font-medium text-[#111418] text-right">{{ details.cultureFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                    </div>
                    <div v-if="details?.otherFacilities" class="flex items-start justify-between gap-4">
                      <span class="text-sm text-[#4b5563] shrink-0">기타시설</span>
                      <span class="text-sm font-medium text-[#111418] text-right">{{ details.otherFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- School Details (Mobile) -->
              <template v-if="facility.category === 'school'">
                <div class="flex flex-col gap-3">
                  <div class="grid grid-cols-2 gap-2">
                    <div v-if="details?.schoolLevel" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">학교급</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.schoolLevel }}</span>
                    </div>
                    <div v-if="details?.foundationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">설립형태</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.foundationType }}</span>
                    </div>
                    <div v-if="details?.coeducationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">남녀공학</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.coeducationType }}</span>
                    </div>
                    <div v-if="details?.highSchoolType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">고교유형</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.highSchoolType }}</span>
                    </div>
                    <div v-if="details?.branchType?.includes('분교')" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">분교여부</span>
                      <span class="text-sm font-bold text-[#111418]">분교</span>
                    </div>
                  </div>
                  <div v-if="details?.foundedDate" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">설립일</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.foundedDate }}</span>
                  </div>
                  <div v-if="details?.phoneNumber" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">연락처</span>
                    <a :href="`tel:${details.phoneNumber}`" class="text-sm font-medium text-blue-600 hover:underline">{{ details.phoneNumber }}</a>
                  </div>
                  <div v-if="details?.faxNumber" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">팩스</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.faxNumber }}</span>
                  </div>
                </div>
                <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-2">홈페이지</h3>
                  <a :href="schoolHomepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline break-all">{{ details.homepageUrl }}</a>
                </div>
                <div v-if="details?.sidoEduName || details?.localEduName" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">관할 교육청</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.sidoEduName" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">시도교육청</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details.sidoEduName }}</span>
                    </div>
                    <div v-if="details?.localEduName" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">교육지원청</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details.localEduName }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="schoolEnrollmentRows.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">학급 현황</h3>
                  <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="border-b border-gray-200">
                          <th class="py-1.5 pr-3 text-left text-gray-500 font-medium">학년</th>
                          <th class="py-1.5 pl-2 text-right text-gray-500 font-medium">반 수</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        <tr v-for="row in schoolEnrollmentRows" :key="row.label" :class="row.isTotal ? 'bg-gray-50 font-semibold' : ''">
                          <td class="py-1.5 pr-3 font-medium text-gray-700">{{ row.label }}</td>
                          <td class="py-1.5 pl-2 text-right text-gray-600">{{ row.classCount != null ? row.classCount + '개' : '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div v-if="schoolDepartments.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">계열 정보</h3>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="dept in schoolDepartments" :key="dept" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800">{{ dept }}</span>
                  </div>
                </div>
              </template>

              <!-- Market Details (Mobile) -->
              <template v-if="facility.category === 'market'">
                <div class="flex flex-col gap-3">
                  <div class="grid grid-cols-2 gap-2">
                    <div v-if="details?.marketType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">시장유형</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.marketType }}</span>
                    </div>
                    <div v-if="details?.openingCycle" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">개설주기</span>
                      <span class="text-sm font-bold text-[#111418]">{{ marketOpeningCycleLabel }}</span>
                    </div>
                  </div>
                  <div v-if="details?.storeCount != null" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">점포 수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.storeCount.toLocaleString() }}개</span>
                  </div>
                  <div v-if="details?.foundedYear != null" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">개설연도</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.foundedYear }}년</span>
                  </div>
                </div>
                <div v-if="marketProductTags.length" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">주요 판매품목</h3>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="tag in marketProductTags" :key="tag" class="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs">{{ tag }}</span>
                  </div>
                </div>
                <div v-if="details?.hasPublicToilet != null || details?.hasParking != null" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">편의시설</h3>
                  <div class="grid grid-cols-2 gap-2">
                    <div v-if="details?.hasPublicToilet != null" class="flex items-center gap-1.5 text-sm text-gray-700">
                      <span :class="details.hasPublicToilet ? 'text-green-600' : 'text-gray-400'">{{ details.hasPublicToilet ? '✓' : '✗' }}</span>
                      <span>공중화장실</span>
                    </div>
                    <div v-if="details?.hasParking != null" class="flex items-center gap-1.5 text-sm text-gray-700">
                      <span :class="details.hasParking ? 'text-green-600' : 'text-gray-400'">{{ details.hasParking ? '✓' : '✗' }}</span>
                      <span>주차시설</span>
                    </div>
                  </div>
                </div>
                <div v-if="details?.homepageUrl" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">홈페이지</span>
                    <a :href="details.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-primary font-medium underline">{{ details.homepageUrl }}</a>
                  </div>
                </div>
              </template>

              <!-- Childcare Details (Mobile) -->
              <template v-if="facility.category === 'childcare'">
                    <!-- 카드형 속성 + 휴지 알림 -->
                    <div class="grid grid-cols-2 gap-2">
                      <div v-if="details?.crtypename" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                        <span class="text-xs text-[#4b5563]">어린이집 유형</span>
                        <span class="text-sm font-bold text-[#111418]">{{ details.crtypename }}</span>
                      </div>
                      <div v-if="details?.crstatusname" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                        <span class="text-xs text-[#4b5563]">운영 상태</span>
                        <span class="text-sm font-bold text-[#111418]">{{ details.crstatusname }}</span>
                      </div>
                    </div>
                    <div v-if="details?.crpausebegindt && details?.crpauseenddt" class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      휴지 기간: {{ details.crpausebegindt }} ~ {{ details.crpauseenddt }}
                    </div>

                    <!-- 기본 정보 테이블 -->
                    <div class="mt-4">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">기본 정보</h3>
                      <table class="w-full text-sm">
                        <tbody class="divide-y divide-[#f0f2f5]">
                          <tr v-if="details?.crcnfmdt">
                            <td class="py-2.5 text-[#4b5563] w-28">인가일</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crcnfmdt }}</td>
                          </tr>
                          <tr v-if="details?.crrepname">
                            <td class="py-2.5 text-[#4b5563]">대표자</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crrepname }}</td>
                          </tr>
                          <tr v-if="details?.crtelno">
                            <td class="py-2.5 text-[#4b5563]">연락처</td>
                            <td class="py-2.5 text-right"><a :href="'tel:' + details.crtelno" class="font-medium text-blue-600 hover:underline">{{ details.crtelno }}</a></td>
                          </tr>
                          <tr v-if="details?.crfaxno">
                            <td class="py-2.5 text-[#4b5563]">팩스</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crfaxno }}</td>
                          </tr>
                          <tr v-if="details?.crcargbname">
                            <td class="py-2.5 text-[#4b5563]">통학차량</td>
                            <td class="py-2.5 text-[#111418] font-medium text-right">{{ details.crcargbname }}</td>
                          </tr>
                          <tr v-if="details?.crhome">
                            <td class="py-2.5 text-[#4b5563]">홈페이지</td>
                            <td class="py-2.5 text-right"><a :href="details.crhome" target="_blank" rel="noopener noreferrer" class="font-medium text-blue-600 hover:underline truncate inline-block max-w-[200px]">{{ details.crhome }}</a></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- 정원·시설 현황 (2열 그리드) -->
                    <div class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">정원·시설 현황</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div v-if="details?.crcapat != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">정원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.crcapat }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                        <div v-if="details?.crchcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">현원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.crchcnt }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                        <div v-if="details?.nrtrroomcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">보육실</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.nrtrroomcnt }}<span class="text-xs font-normal text-[#4b5563]">개</span></p>
                        </div>
                        <div v-if="details?.cctvinstlcnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">CCTV</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.cctvinstlcnt }}<span class="text-xs font-normal text-[#4b5563]">대</span></p>
                        </div>
                        <div v-if="details?.plgrdco != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">놀이터</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.plgrdco }}<span class="text-xs font-normal text-[#4b5563]">개</span></p>
                        </div>
                        <div v-if="details?.chcrtescnt != null" class="bg-[#f8f9fa] rounded-lg p-3 text-center">
                          <p class="text-xs text-[#4b5563] mb-1">교직원</p>
                          <p class="text-lg font-bold text-[#111418]">{{ details.chcrtescnt }}<span class="text-xs font-normal text-[#4b5563]">명</span></p>
                        </div>
                      </div>
                      <div v-if="details?.crcapat != null && details?.crchcnt != null && details.crcapat > 0" class="mt-3">
                        <div class="flex items-center justify-between text-xs text-[#4b5563] mb-1">
                          <span>가용률</span>
                          <span class="font-medium">{{ childcareAvailabilityRate }}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="h-2 rounded-full transition-all" :class="childcareOccupancyPct >= 90 ? 'bg-red-400' : childcareOccupancyPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'" :style="{ width: Math.min(childcareOccupancyPct, 100) + '%' }" />
                        </div>
                      </div>
                    </div>

                    <!-- 반별 정원·현원 -->
                    <div v-if="childcareClassRows.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">연령별 반·아동 현황</h3>
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="bg-[#f8f9fa]">
                              <th class="py-2 px-3 text-left text-[#4b5563] font-medium rounded-tl-lg">연령</th>
                              <th class="py-2 px-2 text-right text-[#4b5563] font-medium">반 수</th>
                              <th class="py-2 px-2 text-right text-[#4b5563] font-medium">아동 수</th>
                              <th class="py-2 px-3 text-right text-[#4b5563] font-medium rounded-tr-lg">반당 평균</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-[#f0f2f5]">
                            <tr v-for="row in childcareClassRows" :key="row.label" :class="row.label === '합계' ? 'bg-[#f8f9fa] font-semibold' : ''">
                              <td class="py-2 px-3 text-[#111418]">{{ row.label }}</td>
                              <td class="py-2 px-2 text-right text-[#4b5563]">{{ row.classes != null ? row.classes + '개' : '-' }}</td>
                              <td class="py-2 px-2 text-right text-[#4b5563]">{{ row.children != null ? row.children + '명' : '-' }}</td>
                              <td class="py-2 px-3 text-right text-[#4b5563]">{{ row.avg != null ? row.avg + '명' : '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- 직원 현황 -->
                    <div v-if="(details as any)?.emCntTot || childcareStaffRoles.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">직원 현황 <span v-if="(details as any)?.emCntTot" class="text-[#4b5563] font-normal">(총 {{ (details as any).emCntTot }}명)</span></h3>
                      <table class="w-full text-sm">
                        <tbody class="divide-y divide-[#f0f2f5]">
                          <tr v-for="role in childcareStaffRoles" :key="role.label">
                            <td class="py-2 text-[#4b5563]">{{ role.label }}</td>
                            <td class="py-2 text-[#111418] font-medium text-right">{{ role.cnt }}명</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- 교사 경력 분포 -->
                    <div v-if="childcareCareerItems.length > 0" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-3">교사 경력 분포</h3>
                      <div class="flex flex-wrap gap-2">
                        <span v-for="item in childcareCareerItems" :key="item.label" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" :class="item.colorClass">
                          {{ item.label }} <span class="font-semibold">{{ item.cnt }}명</span>
                        </span>
                      </div>
                    </div>

                    <!-- 특이사항 -->
                    <div v-if="details?.crspec" class="mt-5 border-t border-[#f0f2f5] pt-5">
                      <h3 class="text-sm font-bold text-[#111418] mb-2">특이사항</h3>
                      <p class="text-sm text-[#4b5563] bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg px-3 py-2">{{ details.crspec }}</p>
                    </div>

                    <!-- 데이터 기준일 -->
                    <div v-if="details?.datastdrdt" class="mt-4 pt-3 border-t border-[#f0f2f5]">
                      <p class="text-xs text-[#9ca3af]">데이터 기준일: {{ details.datastdrdt }}</p>
                    </div>
              </template>

              <!-- EvCharger Details (Mobile) -->
              <template v-if="facility.category === 'ev-charger'">
                <EvChargerDetail :details="details as any" />
              </template>

              <!-- Sports Details (Mobile) -->
              <template v-if="facility.category === 'sports'">
                <div class="flex flex-col gap-3">
                  <div class="grid grid-cols-2 gap-2">
                    <div v-if="details?.ftypeNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">시설유형</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.ftypeNm }}</span>
                    </div>
                    <div v-if="details?.faciGbNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">시설구분</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details.faciGbNm }}</span>
                    </div>
                    <div v-if="details?.nationYn === 'Y'" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-[#f8f9fa]">
                      <span class="text-xs text-[#4b5563]">국가대표시설</span>
                      <span class="text-sm font-bold text-[#111418]">Y</span>
                    </div>
                  </div>
                  <div v-if="details?.fcobNm" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">업종명</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.fcobNm }}</span>
                  </div>
                  <div v-if="details?.faciGfa" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">시설면적</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.faciGfa }}㎡</span>
                  </div>
                  <div v-if="details?.standCptPsnCnt != null" class="flex items-center justify-between">
                    <span class="text-sm text-[#4b5563]">관람석수</span>
                    <span class="text-sm font-medium text-[#111418]">{{ details.standCptPsnCnt.toLocaleString() }}석</span>
                  </div>
                </div>
              </template>

              <!-- Hospital Details -->
              <template v-if="facility.category === 'hospital'">
                <!-- Hospital Staff Info -->
                <div v-if="details?.drTotCnt" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">의료진 현황</h3>
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">의사 총수</span>
                      <span class="text-sm font-bold text-[#111418]">{{ details?.drTotCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptSdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">의과 전문의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptSdrCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptGdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">의과 일반의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptGdrCnt }}명</span>
                    </div>
                    <div v-if="details?.detySdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">치과 전문의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.detySdrCnt }}명</span>
                    </div>
                    <div v-if="details?.cmdcSdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">한방 전문의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcSdrCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptIntnCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">의과 인턴</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptIntnCnt }}명</span>
                    </div>
                    <div v-if="details?.mdeptResdntCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">의과 레지던트</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.mdeptResdntCnt }}명</span>
                    </div>
                    <div v-if="details?.detyGdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">치과 일반의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.detyGdrCnt }}명</span>
                    </div>
                    <div v-if="details?.detyIntnCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">치과 인턴</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.detyIntnCnt }}명</span>
                    </div>
                    <div v-if="details?.detyResdntCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">치과 레지던트</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.detyResdntCnt }}명</span>
                    </div>
                    <div v-if="details?.cmdcGdrCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">한방 일반의</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcGdrCnt }}명</span>
                    </div>
                    <div v-if="details?.cmdcIntnCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">한방 인턴</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcIntnCnt }}명</span>
                    </div>
                    <div v-if="details?.cmdcResdntCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">한방 레지던트</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.cmdcResdntCnt }}명</span>
                    </div>
                    <div v-if="details?.pnursCnt" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">간호사</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details?.pnursCnt }}명</span>
                    </div>
                  </div>
                </div>

                <!-- Hospital Departments -->
                <div v-if="details?.departments?.length" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">진료과목</h3>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="dept in details.departments" :key="dept.dgsbjtCdNm"
                      class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
                      {{ dept.dgsbjtCdNm }}
                      <span v-if="dept.dgsbjtPrSdrCnt" class="ml-1 text-teal-500">({{ dept.dgsbjtPrSdrCnt }}명)</span>
                    </span>
                  </div>
                </div>

                <!-- Hospital Parking Info -->
                <div v-if="details?.parkQty != null || details?.parkEtc" class="mt-5 border-t border-[#f0f2f5] pt-5">
                  <h3 class="text-sm font-bold text-[#111418] mb-3">주차정보</h3>
                  <div class="flex flex-col gap-3">
                    <div v-if="details?.parkQty != null" class="flex items-center justify-between">
                      <span class="text-sm text-[#4b5563]">주차가능대수</span>
                      <span class="text-sm font-medium text-[#111418]">{{ details.parkQty }}대</span>
                    </div>
                    <p v-if="details?.parkEtc" class="text-sm text-[#4b5563]">{{ details.parkEtc }}</p>
                  </div>
                </div>
              </template>

            </div>
          </div>

          <!-- Nearby Facilities -->
          <div v-if="nearbyLoading || nearbyFiltered.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">near_me</span>
              <h2 class="text-[#111418] text-lg font-bold">주변 {{ categoryMeta.label }}</h2>
            </div>
            <div class="p-4 flex flex-col gap-3">
              <template v-if="nearbyLoading">
                <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
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
            <div class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
              <div class="p-4 flex flex-col gap-3">
                <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="group in crossFacilitiesGrouped" :key="group.category"
                 class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
              <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
                <span class="material-symbols-outlined text-base">{{ group.meta.icon }}</span>
                <h2 class="text-[#111418] text-lg font-bold">주변 {{ group.meta.label }}</h2>
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

          <!-- Review Section (Mobile) -->
          <ClientOnly>
            <ReviewSection v-if="id" :category="category" :facility-id="id" />
          </ClientOnly>

          <!-- 같은 지역 시설 링크 -->
          <nav v-if="regionLink" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">explore</span>
              <h2 class="text-[#111418] text-lg font-bold">같은 지역 시설</h2>
            </div>
            <div class="p-5 flex flex-col gap-3">
              <NuxtLink
                :to="regionLink.href"
                class="flex items-center gap-2 text-primary hover:text-blue-600 text-sm font-medium transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                {{ regionLink.label }}
              </NuxtLink>
              <NuxtLink
                :to="regionLink.cityHref"
                class="flex items-center gap-2 text-[#48699d] hover:text-primary text-sm font-medium transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                {{ regionLink.cityLabel }}
              </NuxtLink>
            </div>
          </nav>

          <!-- 이 지역 다른 시설 (Mobile) -->
          <nav v-if="relatedCategories.length > 0" data-testid="related-categories-mobile" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">category</span>
              <h2 class="text-[#111418] text-lg font-bold">이 지역 다른 시설</h2>
            </div>
            <div class="p-5 flex flex-wrap gap-2">
              <NuxtLink
                v-for="cat in relatedCategories"
                :key="cat"
                :to="regionLink && regionLink.href.endsWith(category) ? regionLink.href.replace(category, cat) : `/${cat}`"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
              >
                {{ CATEGORY_META[cat as FacilityCategory]?.label || cat }}
              </NuxtLink>
            </div>
          </nav>

          <!-- 이용 팁 (Mobile) -->
          <div v-if="categoryTips.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-[#60708a] text-[20px]">lightbulb</span>
              <h2 class="text-[#111418] text-lg font-bold">{{ categoryMeta.label }} 이용 팁</h2>
            </div>
            <ul class="p-5 flex flex-col gap-2.5">
              <li v-for="(tip, i) in categoryTips" :key="i" class="flex items-start gap-2 text-sm text-[#4b5563] leading-relaxed">
                <span class="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">check</span>
                {{ tip }}
              </li>
            </ul>
          </div>

          <!-- FAQ (Mobile) -->
          <div v-if="categoryFaqItems.length > 0" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-[#60708a] text-[20px]">help</span>
              <h2 class="text-[#111418] text-lg font-bold">자주 묻는 질문</h2>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div v-for="(faq, i) in categoryFaqItems" :key="i">
                <h3 class="text-sm font-bold text-[#111418] mb-1">Q. {{ faq.question }}</h3>
                <p class="text-sm text-[#4b5563] leading-relaxed">{{ faq.answer }}</p>
              </div>
            </div>
          </div>

          <!-- Data Info Card -->
          <div v-if="dataDate || lastSyncDate || dataPortalUrl" class="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#f0f2f5] flex items-center gap-2">
              <span class="material-symbols-outlined text-[#60708a] text-[20px]">description</span>
              <h2 class="text-[#111418] text-lg font-bold">데이터 정보</h2>
            </div>
            <div class="p-5 flex flex-col gap-3">
              <div v-if="dataDate" class="flex items-center justify-between">
                <span class="text-sm text-[#4b5563]">데이터 기준일</span>
                <span class="text-sm font-medium text-[#111418]">{{ dataDate }}</span>
              </div>
              <div v-if="lastSyncDate" class="flex items-center justify-between">
                <span class="text-sm text-[#4b5563]">최근 동기화</span>
                <span class="text-sm font-medium text-[#111418]">{{ lastSyncDate }}</span>
              </div>
              <div v-if="dataPortalUrl" class="flex items-center justify-between">
                <span class="text-sm text-[#4b5563]">출처</span>
                <a :href="dataPortalUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">공공데이터포털</a>
              </div>
              <div class="mt-1 flex items-start gap-1.5 text-xs text-[#9ca3af]">
                <span class="material-symbols-outlined text-[14px] mt-px">info</span>
                <span>공공데이터포털 기준 정보입니다</span>
              </div>
            </div>
          </div>

          <div class="h-8"></div>
        </div>

        <!-- Mobile: Sticky Bottom CTA -->
        <div class="md:hidden fixed bottom-0 left-0 z-50 w-full bg-white/95 px-4 pt-3 shadow-[0_-4px_16px_-1px_rgba(0,0,0,0.05)] backdrop-blur-sm" :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }">
          <div class="flex gap-3">
            <button
              class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#f0f2f5] py-3.5 text-base font-bold text-[#111418] border border-gray-200 transition hover:bg-gray-200 active:scale-[0.98]"
              aria-label="이 시설 공유하기"
              @click="handleShare"
            >
              <span class="material-symbols-outlined text-[20px]">share</span>
              공유하기
            </button>
            <div class="relative flex-[2]">
              <button
                class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-[0.98]"
                @click="showMobileNavDropdown = !showMobileNavDropdown"
              >
                <span class="material-symbols-outlined text-[20px]">directions</span>
                길찾기
                <span class="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
              <div v-if="showMobileNavDropdown" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-[#e5e7eb] overflow-hidden z-20">
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl); showMobileNavDropdown = false">
                  <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                </button>
                <div class="h-px bg-[#f0f2f5]"></div>
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-[#111418] hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl); showMobileNavDropdown = false">
                  <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                </button>
              </div>
            </div>
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

import { computed, defineAsyncComponent, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useStructuredData } from '~/composables/useStructuredData'
import { useAnalytics } from '~/composables/useAnalytics'
import { CATEGORY_META, CATEGORY_DATA_PORTAL_URL } from '~/types/facility'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import type { FacilityCategory, FacilityDetail, FacilityDetailsAll } from '~/types/facility'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import { generateDynamicTips } from '~/utils/dynamicTips'
import { formatOperatingHours } from '~/utils/formatOperatingHours'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const router = useRouter()
const { setFacilityDetailMeta } = useFacilityMeta()
import { buildFacilityIntro } from '~/composables/useFacilityMeta'
const { setFacilitySchema, setBreadcrumbSchema } = useStructuredData()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

// 도시명(한글) → 도시 허브 페이지 경로
function getCityHubPath(cityName: string): string {
  const shortCity = cityName.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const slug = CITY_NAME_TO_SLUG[cityName] || CITY_NAME_TO_SLUG[shortCity]
  return slug ? `/${slug}` : `/search?keyword=${encodeURIComponent(cityName)}`
}

// SSR: useAsyncData로 서버에서 데이터 fetch
// lazy: true → 클라이언트 네비게이션 시 즉시 페이지 전환 (SSR은 기존대로 서버에서 resolve)
const { data: facilityResponse, status, error: fetchError } = await useAsyncData(
  `facility-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: FacilityDetail }>(
    `/api/facilities/${category.value}/${id.value}`
  ),
  { lazy: true }
)
// fetch 에러 처리: SSR에서는 즉시, 클라이언트에서는 watch로 처리
if (import.meta.server && fetchError.value) {
  const errStatus = fetchError.value.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
}
if (import.meta.server && status.value === 'success' && !facilityResponse.value?.data) {
  throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
}
// 클라이언트 네비게이션 시 lazy 로드 후 에러 처리
watch(fetchError, (err) => {
  if (!err) return
  const errStatus = err.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
}, { immediate: true })

const facility = computed(() => facilityResponse.value?.data ?? null)
const loading = computed(() => status.value === 'pending')
// SSR에서는 createError로 에러 페이지 전환, 클라이언트 fallback용
const error = ref<{ message: string } | null>(null)

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

// 빈약한 데이터 페이지 noindex 처리
const isThinContent = computed(() => {
  if (!facility.value?.details) return false
  const d = facility.value.details as Record<string, unknown>
  const cat = facility.value.category
  // clothes/trash는 원래 필드가 적으므로 noindex 제외
  if (cat === 'clothes' || cat === 'trash') return false
  // 주소 외 의미있는 상세 필드 수 계산
  const skipKeys = new Set(['govCode', 'dataDate', 'providerCode', 'providerName', 'postNo', 'postCdn1', 'postCdn2', 'sidoCd', 'sgguCd', 'emdongNm', 'ykiho', 'clCd', 'hpid', 'dutyMapimg'])
  let fieldCount = 0
  for (const [key, val] of Object.entries(d)) {
    if (skipKeys.has(key)) continue
    if (val === null || val === undefined || val === '') continue
    fieldCount++
  }
  // 이름+주소만 있는 극빈 데이터만 noindex (색인 복구를 위해 기준 완화)
  return fieldCount < 2
})

watchEffect(() => {
  if (isThinContent.value) {
    useHead({
      meta: [{ name: 'robots', content: 'noindex, follow' }],
    })
  }
})

// Canonical URL 설정 (중복 색인 방지)
useHead(computed(() => ({
  link: [{ rel: 'canonical', href: `https://ilsangkit.co.kr${route.path}`, key: 'canonical' }],
})))

// Category metadata
const categoryMeta = computed(() => CATEGORY_META[category.value] || { label: category.value, icon: '📍' })

// h1 아래 자연어 설명문
const facilityIntro = computed(() => {
  if (!facility.value) return ''
  return buildFacilityIntro(facility.value)
})

// 카테고리별 이용 팁 & FAQ (상세 페이지 하단 콘텐츠 보강)
const categoryTips = computed(() => {
  if (!facility.value) return []
  return generateDynamicTips(facility.value)
})
const categoryFaqItems = computed(() => {
  if (!facility.value) return []
  return generateDynamicFAQ(facility.value)
})

// 모바일 브레드크럼 아이템
const breadcrumbItems = computed(() => {
  if (!facility.value) return []
  return [
    { label: '홈', href: '/', current: false },
    { label: categoryMeta.value.label, href: `/${category.value}`, current: false },
    { label: facility.value.name, href: `/${category.value}/${facility.value.id}`, current: true },
  ]
})

// 같은 지역 시설 링크
const regionLink = computed(() => {
  if (!facility.value) return null
  const city = facility.value.city
  const district = facility.value.district
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  const districtSlug = district ? generateSlug(district) : ''
  // district slug가 없으면 시/도 허브로 연결
  const href = districtSlug
    ? `/${citySlug}/${districtSlug}/${category.value}`
    : `/${citySlug}`
  const label = districtSlug
    ? `${city} ${district} ${categoryMeta.value.label} 전체보기`
    : `${city} 전체 시설 보기`
  return {
    href,
    label,
    cityHref: `/${citySlug}`,
    cityLabel: `${city} 전체 시설 보기`,
  }
})

// 이 지역 다른 시설 관련 카테고리
const relatedCategories = computed(() => {
  const cat = category.value
  return (RELATED_CATEGORIES[cat] || []).filter(c => c !== cat)
})

// Check if 24 hours
const isOpen24Hours = computed(() => {
  if (!facility.value?.details) return false
  const det = facility.value.details as FacilityDetailsAll & Record<string, unknown>
  return det.operatingHours === '24시간' || det.is24Hour
})

// 전 카테고리 통합 전화번호
const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll
  return d.phoneNumber || d.phone || d.clerkTel || null
})

// 시설현황 카드 표시 여부
const hasFacilityStatus = computed(() => {
  if (!facility.value?.details) return false
  const cat = facility.value.category
  if (['pharmacy', 'clothes', 'trash'].includes(cat)) return false
  return true
})

const parkHasFacilities = computed(() => {
  const d = details.value as any
  return !!(d?.exerciseFacilities || d?.playFacilities || d?.convenienceFacilities || d?.cultureFacilities || d?.otherFacilities)
})

// School computed
const schoolHomepageUrl = computed(() => {
  const url = (details.value as any)?.homepageUrl || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
})

const schoolEnrollmentRows = computed(() => {
  const enrollments = (details.value as any)?.enrollments || []
  if (enrollments.length === 0) return []
  const sorted = [...enrollments].sort((a: any, b: any) => a.grade - b.grade)
  const rows = sorted.map((e: any) => ({
    label: `${e.grade}학년`,
    classCount: e.classCount,
    isTotal: false,
  }))
  if (rows.length > 1) {
    let totalClasses = 0
    for (const e of enrollments) {
      totalClasses += e.classCount || 0
    }
    rows.push({ label: '합계', classCount: totalClasses, isTotal: true })
  }
  return rows
})

const schoolDepartments = computed(() => {
  const depts = (details.value as any)?.departments || []
  return depts.map((d: any) => d.departmentName)
})

// Market computed
const marketOpeningCycleLabel = computed(() => {
  const cycle = (details.value as any)?.openingCycle || ''
  if (cycle === '매일') return '매일'
  if (/\d/.test(cycle)) {
    const days = cycle.split('+').map((s: string) => s.trim()).filter(Boolean)
    return `매월 ${days.join(', ')}`
  }
  return cycle
})

const marketProductTags = computed(() =>
  (details.value as any)?.products?.split('+').map((s: string) => s.trim()).filter(Boolean) ?? []
)

const childcareAvailabilityRate = computed(() => {
  const cap = (details.value as any)?.crcapat
  const cur = (details.value as any)?.crchcnt
  if (cap == null || cur == null || cap === 0) return '-'
  return `${((cap - cur) / cap * 100).toFixed(0)}%`
})

const childcareOccupancyPct = computed(() => {
  const cap = (details.value as any)?.crcapat
  const cur = (details.value as any)?.crchcnt
  if (cap == null || cur == null || cap === 0) return 0
  return Math.min(Math.round((cur / cap) * 100), 100)
})

// 반별 정원·현원
const CLASS_DEFS = [
  { label: '0세', classKey: 'classCnt00', childKey: 'childCnt00' },
  { label: '1세', classKey: 'classCnt01', childKey: 'childCnt01' },
  { label: '2세', classKey: 'classCnt02', childKey: 'childCnt02' },
  { label: '3세', classKey: 'classCnt03', childKey: 'childCnt03' },
  { label: '4세', classKey: 'classCnt04', childKey: 'childCnt04' },
  { label: '5세', classKey: 'classCnt05', childKey: 'childCnt05' },
  { label: '만2세미만', classKey: 'classCntM2', childKey: 'childCntM2' },
  { label: '만5세이상', classKey: 'classCntM5', childKey: 'childCntM5' },
  { label: '장애아', classKey: 'classCntSp', childKey: 'childCntSp' },
  { label: '합계', classKey: 'classCntTot', childKey: 'childCntTot' },
] as const

const childcareClassRows = computed(() => {
  const d = details.value as any
  if (!d) return []
  return CLASS_DEFS
    .map(({ label, classKey, childKey }) => {
      const classes = d[classKey] as number | undefined
      const children = d[childKey] as number | undefined
      const avg = (classes != null && classes > 0 && children != null) ? Math.round(children / classes * 10) / 10 : null
      return { label, classes, children, avg }
    })
    .filter(row => (row.classes != null && row.classes > 0) || (row.children != null && row.children > 0))
})

const STAFF_ROLE_DEFS = [
  { label: '원장', key: 'emCntA1' },
  { label: '보육교사', key: 'emCntA2' },
  { label: '특수교사', key: 'emCntA3' },
  { label: '치료사', key: 'emCntA4' },
  { label: '영양사', key: 'emCntA5' },
  { label: '간호사(조무사)', key: 'emCntA6' },
  { label: '조리원', key: 'emCntA10' },
  { label: '사무원', key: 'emCntA7' },
  { label: '기타', key: 'emCntA8' },
] as const

const childcareStaffRoles = computed(() => {
  const d = details.value as any
  if (!d) return []
  return STAFF_ROLE_DEFS
    .map(({ label, key }) => ({ label, cnt: d[key] as number | undefined }))
    .filter(r => r.cnt != null && r.cnt > 0)
})

const CAREER_COLORS = [
  'bg-sky-100 text-sky-800',
  'bg-blue-100 text-blue-800',
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-purple-100 text-purple-800',
]

const childcareCareerItems = computed(() => {
  const d = details.value as any
  if (!d) return []
  const defs = [
    { label: '1년 미만', key: 'emCnt0y' },
    { label: '1년 이상', key: 'emCnt1y' },
    { label: '2년 이상', key: 'emCnt2y' },
    { label: '4년 이상', key: 'emCnt4y' },
    { label: '6년 이상', key: 'emCnt6y' },
  ] as const
  return defs
    .map(({ label, key }, i) => ({ label, cnt: d[key] as number | undefined, colorClass: CAREER_COLORS[i] }))
    .filter(item => item.cnt != null && item.cnt > 0)
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
const showMobileNavDropdown = ref(false)
const openNavigation = (url: string) => {
  if (facility.value) {
    const provider = url.includes('kakao') ? 'kakao' : 'naver'
    trackDirectionsClick({ facilityId: facility.value.id, category: facility.value.category, provider })
  }
  window.open(url, '_blank')
  showNavDropdown.value = false
}

const isMapExpanded = ref(false)

const { trackFacilityView, trackDirectionsClick, trackPhoneClick, trackShareClick } = useAnalytics()
onMounted(() => {
  if (facility.value) {
    trackFacilityView({
      facilityId: facility.value.id,
      category: facility.value.category,
      name: facility.value.name,
    })
  }
})

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

// 카테고리별 최근 동기화 날짜
const { data: syncStatusResponse } = await useAsyncData(
  'sync-status',
  () => $fetch<{ success: boolean; data: Record<string, string | null> }>('/api/meta/sync-status'),
  { lazy: true }
)
const lastSyncDate = computed(() => {
  if (!facility.value || !syncStatusResponse.value?.data) return null
  const cat = facility.value.category
  const iso = syncStatusResponse.value.data[cat]
  if (!iso) return null
  return iso.slice(0, 10)
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

// Hospital operating hours
const formatHospitalTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).replace(':', '')
  const e = String(end).replace(':', '')
  if (s.length === 4 && e.length === 4) return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
  return `${start} ~ ${end}`
}

const hospitalOperatingHours = computed(() => {
  if (facility.value?.category !== 'hospital' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').HospitalDetails
  const days = [
    { day: '월요일', start: d.trmtMonStart, end: d.trmtMonEnd },
    { day: '화요일', start: d.trmtTueStart, end: d.trmtTueEnd },
    { day: '수요일', start: d.trmtWedStart, end: d.trmtWedEnd },
    { day: '목요일', start: d.trmtThuStart, end: d.trmtThuEnd },
    { day: '금요일', start: d.trmtFriStart, end: d.trmtFriEnd },
    { day: '토요일', start: d.trmtSatStart, end: d.trmtSatEnd },
    { day: '일요일', start: d.trmtSunStart, end: d.trmtSunEnd },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatHospitalTime(start, end) }))
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

const handleBack = () => {
  if (window.history.length <= 1) {
    navigateTo(`/${category.value}`)
  } else {
    router.back()
  }
}

const handleShare = async () => {
  if (!facility.value) return

  const canShare = !!navigator.share
  trackShareClick({
    contentType: 'facility',
    contentId: facility.value.id,
    method: canShare ? 'native' : 'clipboard',
  })

  const shareData = {
    title: facility.value.name,
    text: `${facility.value.name} - ${facility.value.roadAddress || facility.value.address}`,
    url: window.location.href,
  }

  try {
    if (canShare) {
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
