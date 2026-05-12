<template>
  <SectionBlock heading="기본정보" subtext="주소·운영시간·연락처 등 공통 정보를 먼저 확인합니다.">
    <div class="flex flex-col gap-3">
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
        <div class="mt-0.5 text-slate-500">
          <span class="material-symbols-outlined">location_on</span>
        </div>
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <p class="text-slate-900 text-base font-medium break-words">
            {{ facility.roadAddress || facility.address }}
          </p>
        </div>
        <button class="ml-auto text-primary text-sm font-medium hover:underline whitespace-nowrap shrink-0" @click="copyAddress">복사</button>
      </div>

      <div v-if="(details?.operatingHours || isOpen24Hours || facilityPhone) && !hideOperatingHours" class="h-px bg-slate-100 w-full"></div>

      <!-- Operating Hours (병원·AED는 시설현황 테이블이 있으면 여기서는 숨김) -->
      <div v-if="(details?.operatingHours || isOpen24Hours) && !hideOperatingHours" class="flex gap-4 items-start">
        <div class="mt-0.5 text-slate-500">
          <span class="material-symbols-outlined">schedule</span>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-slate-900 text-base font-medium whitespace-pre-line">{{ details?.operatingHours ? formatOperatingHours(details.operatingHours) : '24시간 운영' }}</p>
            <span v-if="isOpen24Hours" class="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <span class="relative flex h-2 w-2">
                <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              운영중
            </span>
          </div>
        </div>
      </div>

      <div v-if="facilityPhone && (details?.operatingHours || isOpen24Hours)" class="h-px bg-slate-100 w-full"></div>

      <!-- Phone (unified) -->
      <div v-if="facilityPhone" class="flex gap-4 items-center">
        <div class="text-slate-500">
          <span class="material-symbols-outlined">call</span>
        </div>
        <a :href="`tel:${facilityPhone}`" class="text-primary text-base font-medium hover:underline" @click="handlePhoneClick">{{ facilityPhone }}</a>
      </div>

      <!-- Toilet -->
      <template v-if="facility.category === 'toilet' && (details?.facilityType || details?.openTime || details?.managingOrg || details?.installDate || details?.ownershipType)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">시설유형</span>
            <span v-if="details?.facilityType" class="text-sm font-medium text-slate-900">{{ details?.facilityType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">개방시간</span>
            <span v-if="details?.openTime" class="text-sm font-medium text-slate-900">{{ details?.openTime }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="details?.managingOrg" class="text-sm font-medium text-slate-900">{{ details?.managingOrg }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치일</span>
            <span v-if="details?.installDate" class="text-sm font-medium text-slate-900">{{ details?.installDate }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">소유구분</span>
            <span v-if="details?.ownershipType" class="text-sm font-medium text-slate-900">{{ details?.ownershipType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- WiFi -->
      <template v-if="facility.category === 'wifi' && (details?.managementAgency || details?.serviceProvider || details?.installDate)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="details?.managementAgency" class="text-sm font-medium text-slate-900">{{ details?.managementAgency }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">서비스 제공사</span>
            <span v-if="details?.serviceProvider" class="text-sm font-medium text-slate-900">{{ details?.serviceProvider }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치일</span>
            <span v-if="details?.installDate" class="text-sm font-medium text-slate-900">{{ details?.installDate }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- Clothes -->
      <template v-if="facility.category === 'clothes' && (details?.detailLocation || details?.providerName || details?.managementAgency)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">상세 위치</span>
            <span v-if="details?.detailLocation" class="text-sm font-medium text-slate-900">{{ details?.detailLocation }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">운영기관</span>
            <span v-if="details?.providerName" class="text-sm font-medium text-slate-900">{{ details?.providerName }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="details?.managementAgency" class="text-sm font-medium text-slate-900">{{ details?.managementAgency }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>
      <!-- Clothes: 수거 품목 가이드 -->
      <template v-if="facility.category === 'clothes'">
        <div class="h-px bg-slate-100 w-full"></div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 mb-2">수거 가능 품목</h3>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex items-center gap-1.5 text-gray-700"><span class="text-green-600">✓</span> 의류·내의·양말</div>
            <div class="flex items-center gap-1.5 text-gray-700"><span class="text-green-600">✓</span> 신발·가방·벨트</div>
            <div class="flex items-center gap-1.5 text-gray-700"><span class="text-green-600">✓</span> 커튼·이불커버</div>
            <div class="flex items-center gap-1.5 text-gray-400"><span class="text-red-500">✗</span> 솜이불·베개</div>
            <div class="flex items-center gap-1.5 text-gray-400"><span class="text-red-500">✗</span> 인형·장난감</div>
            <div class="flex items-center gap-1.5 text-gray-400"><span class="text-red-500">✗</span> 책·신문</div>
          </div>
          <p class="mt-2 text-xs text-gray-500">※ 비닐에 담아 배출, 비 오는 날 X</p>
        </div>
      </template>

      <!-- Parking -->
      <template v-if="facility.category === 'parking' && (details?.parkingType || details?.operatingDays || details?.managingOrg)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">주차 구분</span>
            <span v-if="details?.parkingType" class="text-sm font-medium text-slate-900">{{ details?.parkingType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">운영요일</span>
            <span v-if="details?.operatingDays" class="text-sm font-medium text-slate-900">{{ details?.operatingDays }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="details?.managingOrg" class="text-sm font-medium text-slate-900">{{ details?.managingOrg }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- Library -->
      <template v-if="facility.category === 'library'">
        <template v-if="details?.libraryType || details?.operatingOrg || details?.closedDays">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">도서관유형</span>
              <span v-if="details?.libraryType" class="text-sm font-medium text-slate-900">{{ details?.libraryType }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">운영기관</span>
              <span v-if="details?.operatingOrg" class="text-sm font-medium text-slate-900">{{ details?.operatingOrg }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">휴관일</span>
              <span v-if="details?.closedDays" class="text-sm font-medium text-slate-900">{{ details?.closedDays }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </template>
        <template v-if="details?.weekdayOpenTime || details?.saturdayOpenTime || details?.holidayOpenTime">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">평일</span>
              <span v-if="details?.weekdayOpenTime" class="text-sm font-medium text-slate-900">{{ formatLibraryHours(details?.weekdayOpenTime, details?.weekdayCloseTime) }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">토요일</span>
              <span v-if="details?.saturdayOpenTime" class="text-sm font-medium text-slate-900">{{ formatLibraryHours(details?.saturdayOpenTime, details?.saturdayCloseTime) }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">공휴일</span>
              <span v-if="details?.holidayOpenTime" class="text-sm font-medium text-slate-900">{{ formatLibraryHours(details?.holidayOpenTime, details?.holidayCloseTime) }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </template>
        <template v-if="details?.homepageUrl">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">홈페이지</span>
            <a :href="details?.homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">바로가기</a>
          </div>
        </template>
      </template>

      <!-- AED -->
      <template v-if="facility.category === 'aed'">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-wrap gap-2">
          <a href="tel:119" class="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 active:scale-[0.98] transition">
            <span class="material-symbols-outlined text-[18px]">emergency</span>
            119 신고
          </a>
          <a href="https://www.kacpr.org/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <span class="material-symbols-outlined text-[18px]">menu_book</span>
            AED 사용법
          </a>
        </div>
        <template v-if="details?.org">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치기관</span>
            <span class="text-sm font-medium text-slate-900">{{ String(details?.org || '').replace(/^[\s-]+|[\s-]+$/g, '') }}</span>
          </div>
        </template>
        <!-- AED 요일별 이용시간 표 -->
        <template v-if="aedWeeklyHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 mb-3">요일별 이용시간</h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-slate-50">
                  <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
                  <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">이용시간</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in aedWeeklyHours" :key="row.day"
                    :class="row.isToday ? 'bg-blue-50 font-semibold' : ''">
                  <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-blue-700' : 'text-slate-600'">
                    {{ row.day }}{{ row.isToday ? ' ★' : '' }}
                  </td>
                  <td class="py-1.5 px-2 text-xs" :class="row.allDay ? 'text-green-600 font-medium' : row.closed ? 'text-gray-400' : 'text-slate-800'">
                    {{ row.time }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-if="aedOperatingHours.length > 0 && aedWeeklyHoursCount === 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div v-for="item in aedOperatingHours" :key="item.day" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ item.day }}</span>
              <span class="text-sm font-medium text-slate-900">{{ item.time }}</span>
            </div>
          </div>
        </template>
        <!-- AED 담당자 연락처 -->
        <template v-if="(details as any)?.clerkTel">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">담당자 연락처</span>
            <a :href="`tel:${(details as any).clerkTel}`" class="text-sm font-medium text-primary hover:underline">{{ (details as any).clerkTel }}</a>
          </div>
        </template>
      </template>

      <!-- Hospital -->
      <template v-if="facility.category === 'hospital'">
        <template v-if="details?.clCdNm || details?.homepage || details?.estbDd">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">종별</span>
              <span v-if="details?.clCdNm" class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">{{ details?.clCdNm }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">설립구분</span>
              <span v-if="details?.foundationCdNm" class="text-sm font-medium text-slate-900">{{ details.foundationCdNm }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">간호등급</span>
              <span v-if="details?.nurseGrade" class="text-sm font-medium text-slate-900">{{ details.nurseGrade }}등급</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">홈페이지</span>
              <a v-if="details?.homepage" :href="details?.homepage" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ details?.homepage }}</a>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">개설일자</span>
              <span v-if="details?.estbDd" class="text-sm font-medium text-slate-900">{{ formatKoreanDate(details?.estbDd) }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </template>
        <!-- Hospital 요일별 진료시간 표 -->
        <template v-if="hospitalWeeklyHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 mb-3">요일별 진료시간</h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-slate-50">
                  <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
                  <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">진료시간</th>
                  <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">점심</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in hospitalWeeklyHours" :key="row.day"
                    :class="row.isToday ? 'bg-blue-50 font-semibold' : ''">
                  <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-blue-700' : 'text-slate-600'">
                    {{ row.day }}{{ row.isToday ? ' ★' : '' }}
                  </td>
                  <td class="py-1.5 px-2 text-xs" :class="row.closed ? 'text-gray-400' : 'text-slate-800'">
                    {{ row.time }}
                  </td>
                  <td class="py-1.5 px-2 text-xs text-gray-500">{{ row.lunch }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="(details as any)?.noTrmtSun" class="mt-2 text-xs text-gray-500">
              <span class="font-medium">일요일 안내:</span> {{ (details as any).noTrmtSun }}
            </p>
            <p v-if="(details as any)?.noTrmtHoli" class="text-xs text-gray-500">
              <span class="font-medium">공휴일 안내:</span> {{ (details as any).noTrmtHoli }}
            </p>
          </div>
        </template>
        <template v-if="hospitalOperatingHours.length > 0 && hospitalWeeklyHoursCount === 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div v-for="item in hospitalOperatingHours" :key="item.day" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ item.day }}</span>
              <span class="text-sm font-medium text-slate-900">{{ item.time }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(평일)</span>
              <span v-if="details?.lunchWeek" class="text-sm font-medium text-slate-900">{{ details.lunchWeek }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(토)</span>
              <span v-if="details?.lunchSat" class="text-sm font-medium text-slate-900">{{ details.lunchSat }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
          <p v-if="details?.noTrmtSun" class="text-xs text-gray-500">
            <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
          </p>
          <p v-if="details?.noTrmtHoli" class="text-xs text-gray-500">
            <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
          </p>
        </template>
      </template>

      <!-- Pharmacy -->
      <template v-if="facility.category === 'pharmacy'">
        <template v-if="details?.dutyTel3">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex gap-4 items-center">
            <div class="text-slate-500">
              <span class="material-symbols-outlined">emergency</span>
            </div>
            <div class="flex flex-col">
              <span class="text-xs text-gray-600">응급전화</span>
              <a :href="`tel:${details?.dutyTel3}`" class="text-primary text-base font-medium hover:underline">{{ details?.dutyTel3 }}</a>
            </div>
          </div>
        </template>
        <template v-if="details?.pharmacistCnt && details.pharmacistCnt > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">약사 수</span>
            <span class="text-sm font-bold text-slate-900">{{ details.pharmacistCnt }}명</span>
          </div>
        </template>
        <template v-if="pharmacyOperatingHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div v-for="item in pharmacyOperatingHours" :key="item.day" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ item.day }}</span>
              <span class="text-sm font-medium text-slate-900">{{ item.time }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(평일)</span>
              <span v-if="details?.lunchWeek" class="text-sm font-medium text-slate-900">{{ details.lunchWeek }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(토)</span>
              <span v-if="details?.lunchSat" class="text-sm font-medium text-slate-900">{{ details.lunchSat }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
          <p v-if="details?.recpWeek" class="text-xs text-gray-500">
            <span class="font-medium">접수(평일):</span> {{ details.recpWeek }}
          </p>
          <p v-if="details?.recpSat" class="text-xs text-gray-500">
            <span class="font-medium">접수(토):</span> {{ details.recpSat }}
          </p>
          <p v-if="details?.noTrmtSun" class="text-xs text-gray-500">
            <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
          </p>
          <p v-if="details?.noTrmtHoli" class="text-xs text-gray-500">
            <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
          </p>
        </template>
      </template>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import OperatingStatusBanner from '~/components/facility/OperatingStatusBanner.vue'
import { formatOperatingHours } from '~/utils/formatOperatingHours'
import { useAnalytics } from '~/composables/useAnalytics'
import type { FacilityDetail, FacilityDetailsAll } from '~/types/facility'

const props = defineProps<{
  facility: FacilityDetail
  hospitalOperatingHours: Array<{ day: string; time: string }>
  hospitalWeeklyHours: Array<{ day: string; time: string; lunch: string; closed: boolean; isToday: boolean }>
  hospitalWeeklyHoursCount: number
  aedOperatingHours: Array<{ day: string; time: string }>
  aedWeeklyHours: Array<{ day: string; time: string; allDay: boolean; closed: boolean; isToday: boolean }>
  aedWeeklyHoursCount: number
  pharmacyOperatingHours: Array<{ day: string; time: string }>
}>()

const details = computed(() => props.facility?.details as FacilityDetailsAll | undefined)

const isOpen24Hours = computed(() => {
  if (!details.value) return false
  const det = details.value as FacilityDetailsAll & Record<string, unknown>
  return det.operatingHours === '24시간' || det.is24Hour === true
})

const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { phone?: string; clerkTel?: string }
  return d.phoneNumber || d.phone || d.clerkTel || null
})

const hideOperatingHours = computed(() => {
  return (
    (props.facility.category === 'hospital' && props.hospitalWeeklyHoursCount > 0) ||
    (props.facility.category === 'aed' && props.aedWeeklyHoursCount > 0)
  )
})

function formatKoreanDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const s = String(dateStr).replace(/\D/g, '')
  if (s.length === 8) {
    return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월 ${parseInt(s.slice(6, 8))}일`
  }
  return String(dateStr)
}

function formatLibraryHours(start?: string | null, end?: string | null): string {
  const s = (start || '').trim()
  const e = (end || '').trim()
  if (!s || (s === '00:00' && (!e || e === '00:00'))) return '휴관'
  return `${s} ~ ${e || s}`
}

const { trackPhoneClick } = useAnalytics()
function handlePhoneClick() {
  trackPhoneClick({ facilityId: props.facility.id, category: props.facility.category })
}

async function copyAddress() {
  const address = props.facility.roadAddress || props.facility.address || ''
  try {
    await navigator.clipboard.writeText(address)
    alert('주소가 복사되었습니다.')
  } catch (err) {
    console.error('주소 복사 실패:', err)
  }
}
</script>
