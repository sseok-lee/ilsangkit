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
        <button class="ml-auto inline-flex items-center gap-1 text-primary text-xs font-medium bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-colors" @click="copyAddress"><span class="material-symbols-outlined text-[14px]">content_copy</span>복사</button>
      </div>

      <div v-if="(operatingHoursText || isOpen24Hours || facilityPhone) && !hideOperatingHours" class="h-px bg-slate-100 w-full"></div>

      <!-- Operating Hours (병원·AED는 시설현황 테이블이 있으면 여기서는 숨김) -->
      <div v-if="(operatingHoursText || isOpen24Hours) && !hideOperatingHours" class="flex gap-4 items-start">
        <div class="mt-0.5 text-slate-500">
          <span class="material-symbols-outlined">schedule</span>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-slate-900 text-base font-medium whitespace-pre-line">{{ operatingHoursText || '24시간 운영' }}</p>
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

      <!-- Park -->
      <template v-if="facility.category === 'park' && ((details as any)?.parkType || (details as any)?.designatedDate || (details as any)?.managingOrg)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">공원유형</span>
            <span v-if="(details as any)?.parkType" class="text-sm font-medium text-slate-900">{{ (details as any).parkType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">지정일</span>
            <span v-if="(details as any)?.designatedDate" class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).designatedDate) }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="(details as any)?.managingOrg" class="text-sm font-medium text-slate-900">{{ (details as any).managingOrg }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- Parking -->
      <template v-if="facility.category === 'parking' && (details?.parkingType || details?.lotType || details?.operatingDays || details?.managingOrg)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">주차 구분</span>
            <span v-if="details?.parkingType" class="text-sm font-medium text-slate-900">{{ details?.parkingType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">주차장 유형</span>
            <span v-if="details?.lotType" class="text-sm font-medium text-slate-900">{{ details?.lotType }}</span>
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
          <WeekdayHoursTable title="요일별 이용시간" time-header="이용시간" :rows="aedWeeklyHours" />
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
            <WeekdayHoursTable title="요일별 진료시간" time-header="진료시간" :show-lunch="true" :rows="hospitalWeeklyHours" />
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

      <!-- School -->
      <template v-if="facility.category === 'school'">
        <template v-if="(details as any)?.schoolLevel || (details as any)?.foundationType || (details as any)?.coeducationType || (details as any)?.highSchoolType || (details as any)?.branchType || (details as any)?.operationStatus">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="grid grid-cols-2 gap-2">
            <div v-if="(details as any)?.schoolLevel" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">학교급</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).schoolLevel }}</span>
            </div>
            <div v-if="(details as any)?.foundationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">설립형태</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).foundationType }}</span>
            </div>
            <div v-if="(details as any)?.coeducationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">남녀공학</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).coeducationType }}</span>
            </div>
            <div v-if="(details as any)?.highSchoolType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">고교유형</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).highSchoolType }}</span>
            </div>
            <div v-if="(details as any)?.branchType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">본/분교</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).branchType }}</span>
            </div>
            <div v-if="(details as any)?.operationStatus" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">운영상태</span>
              <span class="text-sm font-bold" :class="(details as any).operationStatus === '운영' ? 'text-green-600' : 'text-slate-900'">{{ (details as any).operationStatus }}</span>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.foundedDate || (details as any)?.faxNumber">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">설립일</span>
              <span v-if="(details as any)?.foundedDate" class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).foundedDate) }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">팩스</span>
              <span v-if="(details as any)?.faxNumber" class="text-sm font-medium text-slate-900">{{ (details as any).faxNumber }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.homepageUrl">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">홈페이지</span>
            <a :href="schoolHomepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).homepageUrl }}</a>
          </div>
        </template>
        <template v-if="(details as any)?.sidoEduName || (details as any)?.localEduName">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">시도교육청</span>
              <span v-if="(details as any)?.sidoEduName" class="text-sm font-medium text-slate-900">{{ (details as any).sidoEduName }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">교육지원청</span>
              <span v-if="(details as any)?.localEduName" class="text-sm font-medium text-slate-900">{{ (details as any).localEduName }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </template>
      </template>

      <!-- Market -->
      <template v-if="facility.category === 'market'">
        <template v-if="(details as any)?.marketType || (details as any)?.openingCycle">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="grid grid-cols-2 gap-2">
            <div v-if="(details as any)?.marketType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">시장유형</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).marketType }}</span>
            </div>
            <div v-if="(details as any)?.openingCycle" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">개설주기</span>
              <span class="text-sm font-bold text-slate-900">{{ marketOpeningCycleLabel }}</span>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.foundedYear != null">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">개설연도</span>
            <span class="text-sm font-medium text-slate-900">{{ (details as any).foundedYear }}년</span>
          </div>
        </template>
        <template v-if="(details as any)?.homepageUrl">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">홈페이지</span>
            <a :href="(details as any).homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).homepageUrl }}</a>
          </div>
        </template>
      </template>

      <!-- Childcare -->
      <template v-if="facility.category === 'childcare'">
        <template v-if="(details as any)?.crtypename || (details as any)?.crstatusname">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="grid grid-cols-2 gap-2">
            <div v-if="(details as any)?.crtypename" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">어린이집 유형</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).crtypename }}</span>
            </div>
            <div v-if="(details as any)?.crstatusname" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">운영 상태</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).crstatusname }}</span>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.crpausebegindt && (details as any)?.crpauseenddt">
          <div class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            휴지 기간: {{ (details as any).crpausebegindt }} ~ {{ (details as any).crpauseenddt }}
          </div>
        </template>
        <template v-if="(details as any)?.crcnfmdt || (details as any)?.crrepname || (details as any)?.crfaxno || (details as any)?.crcargbname || (details as any)?.crhome">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <div v-if="(details as any)?.crcnfmdt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">인가일</span>
              <span class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).crcnfmdt) }}</span>
            </div>
            <div v-if="(details as any)?.crrepname" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">대표자</span>
              <span class="text-sm font-medium text-slate-900">{{ (details as any).crrepname }}</span>
            </div>
            <div v-if="(details as any)?.crfaxno" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">팩스</span>
              <span class="text-sm font-medium text-slate-900">{{ (details as any).crfaxno }}</span>
            </div>
            <div v-if="(details as any)?.crcargbname" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">통학차량</span>
              <span class="text-sm font-medium text-slate-900">{{ (details as any).crcargbname }}</span>
            </div>
            <div v-if="(details as any)?.crhome" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">홈페이지</span>
              <a :href="(details as any).crhome" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).crhome }}</a>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.crspec">
          <div class="h-px bg-slate-100 w-full"></div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 mb-2">특이사항</h3>
            <p class="text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{{ (details as any).crspec }}</p>
          </div>
        </template>
        <template v-if="(details as any)?.datastdrdt">
          <div class="h-px bg-slate-100 w-full"></div>
          <p class="text-xs text-[#9ca3af]">데이터 기준일: {{ (details as any).datastdrdt }}</p>
        </template>
      </template>

      <!-- Sports -->
      <template v-if="facility.category === 'sports'">
        <template v-if="(details as any)?.ftypeNm || (details as any)?.faciGbNm || (details as any)?.nationYn === 'Y'">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="grid grid-cols-2 gap-2">
            <div v-if="(details as any)?.ftypeNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">시설유형</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).ftypeNm }}</span>
            </div>
            <div v-if="(details as any)?.faciGbNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">시설구분</span>
              <span class="text-sm font-bold text-slate-900">{{ (details as any).faciGbNm }}</span>
            </div>
            <div v-if="(details as any)?.nationYn === 'Y'" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">국가대표시설</span>
              <span class="text-sm font-bold text-slate-900">Y</span>
            </div>
          </div>
        </template>
        <template v-if="(details as any)?.fcobNm">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">업종명</span>
            <span class="text-sm font-medium text-slate-900">{{ (details as any).fcobNm }}</span>
          </div>
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
        <template v-if="pharmacyWeeklyHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <WeekdayHoursTable title="요일별 운영시간" time-header="운영시간" :rows="pharmacyWeeklyHours" />
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
          <p v-if="details?.recpWeek" class="text-xs text-gray-500"><span class="font-medium">접수(평일):</span> {{ details.recpWeek }}</p>
          <p v-if="details?.recpSat" class="text-xs text-gray-500"><span class="font-medium">접수(토):</span> {{ details.recpSat }}</p>
          <p v-if="details?.noTrmtSun" class="text-xs text-gray-500"><span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}</p>
          <p v-if="details?.noTrmtHoli" class="text-xs text-gray-500"><span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}</p>
        </template>
      </template>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import OperatingStatusBanner from '~/components/facility/OperatingStatusBanner.vue'
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'
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
  pharmacyWeeklyHours: Array<{ day: string; time: string; closed: boolean; isToday: boolean }>
}>()

const details = computed(() => props.facility?.details as FacilityDetailsAll | undefined)

const isOpen24Hours = computed(() => {
  if (!details.value) return false
  const det = details.value as FacilityDetailsAll & Record<string, unknown>
  return det.operatingHours === '24시간' || det.is24Hour === true
})

// ev-charger 등 operatingHours 미사용 카테고리 폴백 (useTime)
const operatingHoursText = computed(() => {
  const d = details.value as (FacilityDetailsAll & { useTime?: string }) | undefined
  const raw = d?.operatingHours || d?.useTime
  return raw ? formatOperatingHours(raw) : null
})

const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { phone?: string; clerkTel?: string; crtelno?: string; busiCall?: string }
  return d.phoneNumber || d.phone || d.clerkTel || d.crtelno || d.busiCall || null
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

const schoolHomepageUrl = computed(() => {
  const url = (details.value as any)?.homepageUrl || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
})

const marketOpeningCycleLabel = computed(() => {
  const cycle = (details.value as any)?.openingCycle || ''
  if (cycle === '매일') return '매일'
  if (/\d/.test(cycle)) {
    const days = cycle.split('+').map((s: string) => s.trim()).filter(Boolean)
    return `매월 ${days.join(', ')}`
  }
  return cycle
})

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
