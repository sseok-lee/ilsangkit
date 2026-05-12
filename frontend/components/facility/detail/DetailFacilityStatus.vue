<template>
  <SectionBlock v-if="hasFacilityStatus" heading="시설현황" subtext="카테고리별 세부 설비·현황 정보입니다.">
    <div>
      <div v-if="hasGridContent" class="grid grid-cols-2 gap-4">
        <!-- Toilet Stalls (if applicable) -->
        <template v-if="facility.category === 'toilet'">
          <div v-if="details?.maleToilets" class="col-span-1 py-2 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                <span class="material-symbols-outlined">man</span>
              </div>
              <span class="text-sm font-medium text-gray-600">남자 화장실</span>
            </div>
            <span class="text-base font-bold text-slate-900">{{ details?.maleToilets }}칸</span>
          </div>
          <div v-if="details?.femaleToilets" class="col-span-1 py-2 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-pink-50 text-pink-600 rounded-full">
                <span class="material-symbols-outlined">woman</span>
              </div>
              <span class="text-sm font-medium text-gray-600">여자 화장실</span>
            </div>
            <span class="text-base font-bold text-slate-900">{{ details?.femaleToilets }}칸</span>
          </div>
          <div v-if="details?.maleUrinals" class="col-span-1 py-2 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-50 text-blue-600 rounded-full">
                <span class="material-symbols-outlined">man</span>
              </div>
              <span class="text-sm font-medium text-gray-600">남성용 소변기</span>
            </div>
            <span class="text-base font-bold text-slate-900">{{ details?.maleUrinals }}개</span>
          </div>
        </template>
    
        <!-- Feature Cards -->
        <div
          v-for="amenity in facilityAmenities"
          :key="amenity"
          class="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center justify-center gap-2 text-center"
        >
          <span class="material-symbols-outlined text-primary text-3xl">{{ getAmenityIcon(amenity) }}</span>
          <span class="text-sm font-medium text-slate-900">{{ amenity }}</span>
          <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">설치됨</span>
        </div>
      </div>
    
      <!-- Toilet Extra Details -->
      <template v-if="facility.category === 'toilet'">
        <!-- Toilet Accessibility Details -->
        <div v-if="toiletAccessibilityDetails.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">접근성 상세</h3>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="item in toiletAccessibilityDetails"
              :key="item.label"
              class="py-2 flex items-center justify-between"
            >
              <span class="text-sm text-gray-600">{{ item.label }}</span>
              <span class="text-sm font-bold text-slate-900">{{ item.value }}</span>
            </div>
          </div>
        </div>
    
        <!-- Emergency Bell / Diaper Changing Location -->
        <div v-if="details?.emergencyBellLocation || details?.diaperChangingLocation" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">편의시설 위치</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">비상벨 위치</span>
              <span v-if="details?.emergencyBellLocation" class="text-sm font-medium text-slate-900">{{ details?.emergencyBellLocation }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">기저귀교환대 위치</span>
              <span v-if="details?.diaperChangingLocation" class="text-sm font-medium text-slate-900">{{ details?.diaperChangingLocation }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </div>
      </template>
    
      <!-- Wifi Details -->
      <template v-if="facility.category === 'wifi'">
        <div :class="[hasGridContent ? 'mt-5 border-t border-slate-100 pt-5' : '', 'flex flex-col gap-3']">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">SSID</span>
            <span v-if="details?.ssid" class="text-sm font-medium text-slate-900">{{ details?.ssid }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치 장소</span>
            <span v-if="details?.installLocation" class="text-sm font-medium text-slate-900">{{ details?.installLocation }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치 장소 상세</span>
            <span v-if="details?.installLocationDetail && details?.installLocationDetail !== details?.installLocation" class="text-sm font-medium text-slate-900">{{ details?.installLocationDetail }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>
    
      <!-- Parking Details -->
      <template v-if="facility.category === 'parking'">
        <div :class="[hasGridContent ? 'mt-5 border-t border-slate-100 pt-5' : '']">
          <h3 class="text-sm font-bold text-slate-900 mb-3">요금 정보</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">요금구분</span>
              <span v-if="details?.feeType" class="text-sm font-medium text-slate-900">{{ details?.feeType }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">기본요금</span>
              <span v-if="details?.baseFee != null && details?.baseTime != null" class="text-sm font-medium text-slate-900">{{ details?.baseFee }}원 / {{ details?.baseTime }}분</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">추가요금</span>
              <span v-if="details?.additionalFee != null && details?.additionalTime != null" class="text-sm font-medium text-slate-900">{{ details?.additionalFee }}원 / {{ details?.additionalTime }}분</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">일 최대요금</span>
              <span v-if="details?.dailyMaxFee != null" class="text-sm font-medium text-slate-900">{{ details?.dailyMaxFee }}원</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">일최대요금 적용시간</span>
              <span v-if="details?.dailyMaxFeeHours" class="text-sm font-medium text-slate-900">{{ details?.dailyMaxFeeHours }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">월정기권</span>
              <span v-if="details?.monthlyFee != null" class="text-sm font-medium text-slate-900">{{ details?.monthlyFee }}원</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </div>
    
        <div class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">시설 정보</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">주차장 유형</span>
              <span v-if="details?.lotType" class="text-sm font-medium text-slate-900">{{ details?.lotType }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">주차면수</span>
              <span v-if="details?.capacity" class="text-sm font-medium text-slate-900">{{ details?.capacity }}면</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">결제방법</span>
              <span v-if="details?.paymentMethod" class="text-sm font-medium text-slate-900">{{ details?.paymentMethod }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">장애인 주차구역</span>
              <span v-if="details?.hasDisabledParking !== undefined" class="text-sm font-medium text-slate-900">{{ details?.hasDisabledParking ? '있음' : '없음' }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">부제 운영</span>
              <span v-if="details?.alternateParking" class="text-sm font-medium text-slate-900">{{ details?.alternateParking }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">특기사항</span>
              <span v-if="details?.remarks" class="text-sm font-medium text-slate-900">{{ details?.remarks }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">구역구분</span>
              <span v-if="details?.zoneClass" class="text-sm font-medium text-slate-900">{{ details?.zoneClass }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </div>
      </template>
    
      <!-- Library Details -->
      <template v-if="facility.category === 'library'">
        <div :class="[hasGridContent ? 'mt-5 border-t border-slate-100 pt-5' : '', 'flex flex-col gap-3']">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">좌석수</span>
            <span v-if="details?.seatCount" class="text-sm font-medium text-slate-900">{{ details?.seatCount.toLocaleString() }}석</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">장서수</span>
            <span v-if="details?.bookCount" class="text-sm font-medium text-slate-900">{{ details?.bookCount.toLocaleString() }}권</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">연속간행물</span>
            <span v-if="details?.serialCount" class="text-sm font-medium text-slate-900">{{ details?.serialCount.toLocaleString() }}종</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">비도서 자료</span>
            <span v-if="details?.nonBookCount" class="text-sm font-medium text-slate-900">{{ details?.nonBookCount.toLocaleString() }}점</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">대출가능 권수</span>
            <span v-if="details?.loanableBooks" class="text-sm font-medium text-slate-900">{{ details?.loanableBooks }}권</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">대출가능 일수</span>
            <span v-if="details?.loanableDays" class="text-sm font-medium text-slate-900">{{ details?.loanableDays }}일</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
    
        <!-- Library Facility Size -->
        <div v-if="details?.lotArea || details?.buildingArea" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">시설 규모</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">부지면적</span>
              <span v-if="details?.lotArea" class="text-sm font-medium text-slate-900">{{ details?.lotArea }}㎡</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">건물면적</span>
              <span v-if="details?.buildingArea" class="text-sm font-medium text-slate-900">{{ details?.buildingArea }}㎡</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </div>
      </template>
    
      <!-- AED Details -->
      <template v-if="facility.category === 'aed'">
        <div v-if="details?.buildPlace || details?.mfg || details?.model" :class="[hasGridContent ? 'mt-5 border-t border-slate-100 pt-5' : '', 'flex flex-col gap-3']">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">설치위치</span>
            <span v-if="details?.buildPlace" class="text-sm font-medium text-slate-900">{{ details?.buildPlace }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">제조사</span>
            <span v-if="details?.mfg" class="text-sm font-medium text-slate-900">{{ details?.mfg }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">모델명</span>
            <span v-if="details?.model" class="text-sm font-medium text-slate-900">{{ details?.model }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- Pharmacy Details -->
      <template v-if="facility.category === 'pharmacy'">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">약사 수</span>
            <span v-if="(details as any)?.pharmacistCnt" class="text-sm font-bold text-slate-900">{{ (details as any).pharmacistCnt }}명</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>

      <!-- Park Details -->
      <template v-if="facility.category === 'park'">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">면적</span>
            <span v-if="details?.area != null" class="text-sm font-medium text-slate-900">{{ details.area.toLocaleString() }}㎡ (약 {{ Math.round(details.area * 0.3025).toLocaleString() }}평)</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
        <div v-if="parkHasFacilities" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">보유 시설</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-600 shrink-0">운동시설</span>
              <span v-if="details?.exerciseFacilities" class="text-sm font-medium text-slate-900 text-right">{{ details.exerciseFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-600 shrink-0">놀이시설</span>
              <span v-if="details?.playFacilities" class="text-sm font-medium text-slate-900 text-right">{{ details.playFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-600 shrink-0">편의시설</span>
              <span v-if="details?.convenienceFacilities" class="text-sm font-medium text-slate-900 text-right">{{ details.convenienceFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-600 shrink-0">교양시설</span>
              <span v-if="details?.cultureFacilities" class="text-sm font-medium text-slate-900 text-right">{{ details.cultureFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-600 shrink-0">기타시설</span>
              <span v-if="details?.otherFacilities" class="text-sm font-medium text-slate-900 text-right">{{ details.otherFacilities.split('+').map(s => s.trim()).filter(Boolean).join(', ') }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
        </div>
      </template>
    
      <!-- School Details -->
      <template v-if="facility.category === 'school'">
        <div v-if="schoolEnrollmentRows.length > 0">
          <h3 class="text-sm font-bold text-slate-900 mb-3">학급 현황</h3>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <div v-for="row in schoolEnrollmentRows" :key="row.label" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2" :class="row.isTotal ? 'bg-indigo-50 col-span-full' : 'bg-slate-50'">
              <span class="text-xs text-gray-600">{{ row.label }}</span>
              <span class="text-sm font-bold" :class="row.isTotal ? 'text-indigo-600' : 'text-slate-900'">{{ row.classCount }}반</span>
            </div>
          </div>
        </div>
        <div v-if="schoolDepartments.length > 0" :class="schoolEnrollmentRows.length > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''">
          <h3 class="text-sm font-bold text-slate-900 mb-3">계열 정보</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="dept in schoolDepartments" :key="dept" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800">{{ dept }}</span>
          </div>
        </div>
      </template>
    
      <!-- Market Details -->
      <template v-if="facility.category === 'market'">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">점포 수</span>
            <span v-if="details?.storeCount != null" class="text-sm font-medium text-slate-900">{{ details.storeCount.toLocaleString() }}개</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
        <div v-if="marketProductTags.length" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">주요 판매품목</h3>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in marketProductTags" :key="tag" class="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs">{{ tag }}</span>
          </div>
        </div>
        <div v-if="details?.hasPublicToilet != null || details?.hasParking != null" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">편의시설</h3>
          <div class="grid grid-cols-2 gap-2">
            <div v-if="details?.hasPublicToilet != null" class="flex items-center gap-1.5 text-sm text-gray-700">
              <span :class="details.hasPublicToilet ? 'text-green-600' : 'text-gray-400'">{{ details.hasPublicToilet ? '✓' : '✗' }}</span>
              <span>공중화장실</span>
            </div>
            <div v-if="details?.hasParking != null" class="flex items-center gap-1.5 text-sm text-gray-700">
              <span :class="details.hasParking ? 'text-green-600' : 'text-gray-400'">{{ details.hasParking ? '✓' : '✗' }}</span>
              <span>주차시설</span>
            </div>
            <div v-if="details?.giftCertificates" class="flex items-center gap-1.5 text-sm text-gray-700">
              <span class="text-green-600">✓</span>
              <span>{{ details.giftCertificates }}</span>
            </div>
          </div>
        </div>
      </template>
    
      <!-- Childcare Details -->
      <template v-if="facility.category === 'childcare'">
        <!-- 카드형 속성 + 휴지 알림 -->
        <div class="grid grid-cols-2 gap-2">
          <div v-if="details?.crtypename" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
            <span class="text-xs text-gray-600">어린이집 유형</span>
            <span class="text-sm font-bold text-slate-900">{{ details.crtypename }}</span>
          </div>
          <div v-if="details?.crstatusname" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
            <span class="text-xs text-gray-600">운영 상태</span>
            <span class="text-sm font-bold text-slate-900">{{ details.crstatusname }}</span>
          </div>
        </div>
        <div v-if="details?.crpausebegindt && details?.crpauseenddt" class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          휴지 기간: {{ details.crpausebegindt }} ~ {{ details.crpauseenddt }}
        </div>
    
        <!-- 기본 정보 테이블 -->
        <div class="mt-4">
          <h3 class="text-sm font-bold text-slate-900 mb-3">기본 정보</h3>
          <table class="w-full text-sm">
            <tbody class="divide-y divide-[#f0f2f5]">
              <tr v-if="details?.crcnfmdt">
                <td class="py-2.5 text-gray-600 w-28">인가일</td>
                <td class="py-2.5 text-slate-900 font-medium text-right">{{ formatKoreanDate(details.crcnfmdt) }}</td>
              </tr>
              <tr v-if="details?.crrepname">
                <td class="py-2.5 text-gray-600">대표자</td>
                <td class="py-2.5 text-slate-900 font-medium text-right">{{ details.crrepname }}</td>
              </tr>
              <tr v-if="details?.crtelno">
                <td class="py-2.5 text-gray-600">연락처</td>
                <td class="py-2.5 text-right"><a :href="'tel:' + details.crtelno" class="font-medium text-blue-600 hover:underline">{{ details.crtelno }}</a></td>
              </tr>
              <tr v-if="details?.crfaxno">
                <td class="py-2.5 text-gray-600">팩스</td>
                <td class="py-2.5 text-slate-900 font-medium text-right">{{ details.crfaxno }}</td>
              </tr>
              <tr v-if="details?.crcargbname">
                <td class="py-2.5 text-gray-600">통학차량</td>
                <td class="py-2.5 text-slate-900 font-medium text-right">{{ details.crcargbname }}</td>
              </tr>
              <tr v-if="details?.crhome">
                <td class="py-2.5 text-gray-600">홈페이지</td>
                <td class="py-2.5 text-right"><a :href="details.crhome" target="_blank" rel="noopener noreferrer" class="font-medium text-blue-600 hover:underline truncate inline-block max-w-[200px]">{{ details.crhome }}</a></td>
              </tr>
            </tbody>
          </table>
        </div>
    
        <!-- 정원·현원 + 시설 정보 (2열 그리드) -->
        <div class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">정원·시설 현황</h3>
          <div class="grid grid-cols-2 gap-3">
            <div v-if="details?.crcapat != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">정원</p>
              <p class="text-lg font-bold text-slate-900">{{ details.crcapat }}<span class="text-xs font-normal text-gray-600">명</span></p>
            </div>
            <div v-if="details?.crchcnt != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">현원</p>
              <p class="text-lg font-bold text-slate-900">{{ details.crchcnt }}<span class="text-xs font-normal text-gray-600">명</span></p>
            </div>
            <div v-if="details?.nrtrroomcnt != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">보육실</p>
              <p class="text-lg font-bold text-slate-900">{{ details.nrtrroomcnt }}<span class="text-xs font-normal text-gray-600">개</span></p>
            </div>
            <div v-if="details?.cctvinstlcnt != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">CCTV</p>
              <p class="text-lg font-bold text-slate-900">{{ details.cctvinstlcnt }}<span class="text-xs font-normal text-gray-600">대</span></p>
            </div>
            <div v-if="details?.plgrdco != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">놀이터</p>
              <p class="text-lg font-bold text-slate-900">{{ details.plgrdco }}<span class="text-xs font-normal text-gray-600">개</span></p>
            </div>
            <div v-if="details?.chcrtescnt != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">교직원</p>
              <p class="text-lg font-bold text-slate-900">{{ details.chcrtescnt }}<span class="text-xs font-normal text-gray-600">명</span></p>
            </div>
            <div v-if="details?.nrtrroomsize != null" class="bg-slate-50 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-600 mb-1">보육실 면적</p>
              <p class="text-lg font-bold text-slate-900">{{ details.nrtrroomsize }}<span class="text-xs font-normal text-gray-600">㎡</span></p>
            </div>
          </div>
          <div v-if="details?.crcapat != null && details?.crchcnt != null && details.crcapat > 0" class="mt-3">
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>가용률</span>
              <span class="font-medium">{{ childcareAvailabilityRate }}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="h-2 rounded-full transition-colors duration-300" :class="childcareOccupancyPct >= 90 ? 'bg-red-400' : childcareOccupancyPct >= 70 ? 'bg-yellow-400' : 'bg-green-400'" :style="{ width: Math.min(childcareOccupancyPct, 100) + '%' }" />
            </div>
          </div>
        </div>
    
        <!-- 반별 정원·현원 -->
        <div v-if="childcareClassRows.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">연령별 반·아동 현황</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-slate-50">
                  <th class="py-2 px-3 text-left text-gray-600 font-medium rounded-tl-lg">연령</th>
                  <th class="py-2 px-2 text-right text-gray-600 font-medium">반 수</th>
                  <th class="py-2 px-2 text-right text-gray-600 font-medium">아동 수</th>
                  <th class="py-2 px-3 text-right text-gray-600 font-medium rounded-tr-lg">반당 평균</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#f0f2f5]">
                <tr v-for="row in childcareClassRows" :key="row.label" :class="row.label === '합계' ? 'bg-slate-50 font-semibold' : ''">
                  <td class="py-2 px-3 text-slate-900">{{ row.label }}</td>
                  <td class="py-2 px-2 text-right text-gray-600">{{ row.classes != null ? row.classes + '개' : '-' }}</td>
                  <td class="py-2 px-2 text-right text-gray-600">{{ row.children != null ? row.children + '명' : '-' }}</td>
                  <td class="py-2 px-3 text-right text-gray-600">{{ row.avg != null ? row.avg + '명' : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
    
        <!-- 직원 현황 -->
        <div v-if="(details as any)?.emCntTot || childcareStaffRoles.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">직원 현황 <span v-if="(details as any)?.emCntTot" class="text-gray-600 font-normal">(총 {{ (details as any).emCntTot }}명)</span></h3>
          <table class="w-full text-sm">
            <tbody class="divide-y divide-[#f0f2f5]">
              <tr v-for="role in childcareStaffRoles" :key="role.label">
                <td class="py-2 text-gray-600">{{ role.label }}</td>
                <td class="py-2 text-slate-900 font-medium text-right">{{ role.cnt }}명</td>
              </tr>
            </tbody>
          </table>
        </div>
    
        <!-- 교사 경력 분포 -->
        <div v-if="childcareCareerItems.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">교사 경력 분포</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="item in childcareCareerItems" :key="item.label" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" :class="item.colorClass">
              {{ item.label }} <span class="font-semibold">{{ item.cnt }}명</span>
            </span>
          </div>
        </div>
    
        <!-- 특이사항 -->
        <div v-if="details?.crspec" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-2">특이사항</h3>
          <p class="text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{{ details.crspec }}</p>
        </div>
    
        <!-- 데이터 기준일 -->
        <div v-if="details?.datastdrdt" class="mt-4 pt-3 border-t border-slate-100">
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
            <div v-if="details?.ftypeNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">시설유형</span>
              <span class="text-sm font-bold text-slate-900">{{ details.ftypeNm }}</span>
            </div>
            <div v-if="details?.faciGbNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">시설구분</span>
              <span class="text-sm font-bold text-slate-900">{{ details.faciGbNm }}</span>
            </div>
            <div v-if="details?.nationYn === 'Y'" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
              <span class="text-xs text-gray-600">국가대표시설</span>
              <span class="text-sm font-bold text-slate-900">Y</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">업종명</span>
            <span v-if="details?.fcobNm" class="text-sm font-medium text-slate-900">{{ details.fcobNm }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">시설면적</span>
            <span v-if="details?.faciGfa" class="text-sm font-medium text-slate-900">{{ details.faciGfa }}㎡</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관람석수</span>
            <span v-if="details?.standCptPsnCnt != null" class="text-sm font-medium text-slate-900">{{ details.standCptPsnCnt.toLocaleString() }}석</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>
    
      <!-- Hospital Details -->
      <template v-if="facility.category === 'hospital'">
        <!-- Hospital Staff Info -->
        <div v-if="details?.drTotCnt" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">의료진 현황</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">의사 총수</span>
              <span class="text-sm font-bold text-slate-900">{{ details?.drTotCnt }}명</span>
            </div>
            <div v-if="details?.mdeptSdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">의과 전문의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.mdeptSdrCnt }}명</span>
            </div>
            <div v-if="details?.mdeptGdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">의과 일반의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.mdeptGdrCnt }}명</span>
            </div>
            <div v-if="details?.detySdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">치과 전문의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.detySdrCnt }}명</span>
            </div>
            <div v-if="details?.cmdcSdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">한방 전문의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.cmdcSdrCnt }}명</span>
            </div>
            <div v-if="details?.mdeptIntnCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">의과 인턴</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.mdeptIntnCnt }}명</span>
            </div>
            <div v-if="details?.mdeptResdntCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">의과 레지던트</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.mdeptResdntCnt }}명</span>
            </div>
            <div v-if="details?.detyGdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">치과 일반의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.detyGdrCnt }}명</span>
            </div>
            <div v-if="details?.detyIntnCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">치과 인턴</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.detyIntnCnt }}명</span>
            </div>
            <div v-if="details?.detyResdntCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">치과 레지던트</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.detyResdntCnt }}명</span>
            </div>
            <div v-if="details?.cmdcGdrCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">한방 일반의</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.cmdcGdrCnt }}명</span>
            </div>
            <div v-if="details?.cmdcIntnCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">한방 인턴</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.cmdcIntnCnt }}명</span>
            </div>
            <div v-if="details?.cmdcResdntCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">한방 레지던트</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.cmdcResdntCnt }}명</span>
            </div>
            <div v-if="details?.pnursCnt" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">간호사</span>
              <span class="text-sm font-medium text-slate-900">{{ details?.pnursCnt }}명</span>
            </div>
          </div>
        </div>
    
        <!-- Hospital Departments -->
        <div v-if="details?.departments?.length" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">진료과목</h3>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="dept in details.departments" :key="dept.dgsbjtCdNm"
              class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200">
              {{ dept.dgsbjtCdNm }}
              <span v-if="dept.dgsbjtPrSdrCnt" class="ml-1 text-teal-500">({{ dept.dgsbjtPrSdrCnt }}명)</span>
            </span>
          </div>
        </div>
    
        <!-- Hospital Bed Info -->
        <div v-if="hospitalBedRows.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">병상 정보 <span class="text-xs text-gray-500 font-normal">(총 {{ hospitalTotalBeds }}병상)</span></h3>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div v-for="row in hospitalBedRows" :key="row.label" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ row.label }}</span>
              <span class="text-sm font-medium text-slate-900">{{ row.value }}</span>
            </div>
          </div>
        </div>
    
        <!-- Hospital Parking Info -->
        <div v-if="details?.parkQty != null || details?.parkEtc" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">주차정보</h3>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">주차가능대수</span>
              <span v-if="details?.parkQty != null" class="text-sm font-medium text-slate-900">{{ details.parkQty }}대</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <p v-if="details?.parkEtc" class="text-sm text-gray-600">{{ details.parkEtc }}</p>
          </div>
        </div>
      </template>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { FacilityDetail, FacilityDetailsAll } from '~/types/facility'

const props = defineProps<{
  facility: FacilityDetail
}>()

const details = computed(() => props.facility?.details as FacilityDetailsAll | undefined)

// 시설현황 카드 표시 여부
const hasFacilityStatus = computed(() => {
  if (!props.facility?.details) return false
  const cat = props.facility.category
  if (['clothes', 'trash'].includes(cat)) return false
  if (cat === 'pharmacy') {
    const d = props.facility.details as Record<string, unknown>
    return typeof d.pharmacistCnt === 'number' && d.pharmacistCnt > 0
  }
  return true
})

const facilityAmenities = computed(() => {
  if (!props.facility?.details) return [] as string[]
  const amenities: string[] = []
  const d = props.facility.details as FacilityDetailsAll & Record<string, unknown>
  if (d.hasDisabledToilet) amenities.push('장애인 화장실')
  if (d.hasDiaperChangingTable) amenities.push('기저귀 교환대')
  if (d.hasEmergencyBell) amenities.push('비상벨')
  if (d.hasCCTV) amenities.push('CCTV')
  if (d.hasChildToilet) amenities.push('어린이 화장실')
  if (d.hasDisabledAccess) amenities.push('장애인 편의시설')
  return amenities
})

const hasGridContent = computed(() => {
  if (!props.facility?.details) return false
  if (props.facility.category === 'toilet') return true
  if (props.facility.category === 'hospital' || props.facility.category === 'pharmacy') return false
  return facilityAmenities.value.length > 0
})

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

const toiletAccessibilityDetails = computed(() => {
  if (props.facility.category !== 'toilet' || !details.value) return [] as Array<{ label: string; value: string }>
  const d = details.value as import('~/types/facility').ToiletDetails
  const items: Array<{ label: string; value: string }> = []
  if (d.maleDisabledToilets) items.push({ label: '남성 장애인 대변기', value: `${d.maleDisabledToilets}개` })
  if (d.maleDisabledUrinals) items.push({ label: '남성 장애인 소변기', value: `${d.maleDisabledUrinals}개` })
  if (d.femaleDisabledToilets) items.push({ label: '여성 장애인 대변기', value: `${d.femaleDisabledToilets}개` })
  if (d.maleChildToilets) items.push({ label: '남성 어린이 대변기', value: `${d.maleChildToilets}개` })
  if (d.maleChildUrinals) items.push({ label: '남성 어린이 소변기', value: `${d.maleChildUrinals}개` })
  if (d.femaleChildToilets) items.push({ label: '여성 어린이 대변기', value: `${d.femaleChildToilets}개` })
  return items
})

// AED 시간표
const aedWeeklyHours = computed(() => {
  if (props.facility.category !== 'aed') return [] as Array<{ day: string; time: string; allDay: boolean; closed: boolean; isToday: boolean }>
  const d = details.value as Record<string, unknown> | undefined
  if (!d) return []
  const today = new Date().getDay()
  const fmt = (t: unknown) => {
    if (!t) return null
    const s = String(t).padStart(4, '0')
    return `${s.slice(0, 2)}:${s.slice(2)}`
  }
  const DAYS = [
    { label: '월', start: 'monSttTme', end: 'monEndTme', todayIdx: 1 },
    { label: '화', start: 'tueSttTme', end: 'tueEndTme', todayIdx: 2 },
    { label: '수', start: 'wedSttTme', end: 'wedEndTme', todayIdx: 3 },
    { label: '목', start: 'thuSttTme', end: 'thuEndTme', todayIdx: 4 },
    { label: '금', start: 'friSttTme', end: 'friEndTme', todayIdx: 5 },
    { label: '토', start: 'satSttTme', end: 'satEndTme', todayIdx: 6 },
    { label: '일', start: 'sunSttTme', end: 'sunEndTme', todayIdx: 0 },
    { label: '공휴일', start: 'holSttTme', end: 'holEndTme', todayIdx: -1 },
  ]
  const rows = DAYS.map(dk => {
    const s = fmt(d[dk.start])
    const e = fmt(d[dk.end])
    const allDay = s === '00:00' && e === '24:00'
    const closed = !s && !e
    return {
      day: dk.label,
      time: allDay ? '24시간' : closed ? '이용불가' : (s && e ? `${s} ~ ${e}` : '정보없음'),
      allDay,
      closed,
      isToday: dk.todayIdx === today,
    }
  })
  const hasAny = rows.some(r => !r.closed && r.time !== '정보없음')
  return hasAny ? rows : []
})

// Hospital 시간표
const hospitalWeeklyHours = computed(() => {
  if (props.facility.category !== 'hospital') return [] as Array<{ day: string; time: string; lunch: string; closed: boolean; isToday: boolean }>
  const d = details.value as Record<string, unknown> | undefined
  if (!d) return []
  const today = new Date().getDay()
  const DAY_KEYS = [
    { label: '월', start: 'trmtMonStart', end: 'trmtMonEnd', todayIdx: 1 },
    { label: '화', start: 'trmtTueStart', end: 'trmtTueEnd', todayIdx: 2 },
    { label: '수', start: 'trmtWedStart', end: 'trmtWedEnd', todayIdx: 3 },
    { label: '목', start: 'trmtThuStart', end: 'trmtThuEnd', todayIdx: 4 },
    { label: '금', start: 'trmtFriStart', end: 'trmtFriEnd', todayIdx: 5 },
    { label: '토', start: 'trmtSatStart', end: 'trmtSatEnd', todayIdx: 6 },
    { label: '일', start: 'trmtSunStart', end: 'trmtSunEnd', todayIdx: 0 },
    { label: '공휴일', start: null, end: null, todayIdx: -1 },
  ] as const
  const fmt = (t: unknown) => {
    if (!t) return null
    const s = String(t).padStart(4, '0')
    return `${s.slice(0, 2)}:${s.slice(2)}`
  }
  const rows = DAY_KEYS.map(dk => {
    const s = dk.start ? fmt(d[dk.start]) : null
    const e = dk.end ? fmt(d[dk.end]) : null
    const closed = !s && !e
    const isNoTrmt = (dk.label === '일' && d.noTrmtSun) || (dk.label === '공휴일' && d.noTrmtHoli)
    const isClosed = closed || isNoTrmt
    const lunchStr = isClosed
      ? null
      : dk.label === '토'
        ? (d.lunchSat || d.lunchWeek || null)
        : dk.label === '일' || dk.label === '공휴일'
          ? null
          : (d.lunchWeek || null)
    return {
      day: dk.label,
      time: isClosed ? '휴진' : (s && e ? `${s} ~ ${e}` : '정보없음'),
      lunch: (lunchStr as string) || '—',
      closed: !!isClosed,
      isToday: dk.todayIdx === today,
    }
  })
  const hasAnyTime = rows.some(r => !r.closed && r.time !== '정보없음')
  return hasAnyTime ? rows : []
})

const HOSPITAL_BED_DEFS: { key: string; label: string }[] = [
  { key: 'generalUpperBeds', label: '일반(상급)' },
  { key: 'generalNormalBeds', label: '일반(일반)' },
  { key: 'adultIcuBeds', label: '성인 중환자' },
  { key: 'childIcuBeds', label: '소아 중환자' },
  { key: 'neonatalIcuBeds', label: '신생아 중환자' },
  { key: 'deliveryBeds', label: '분만실' },
  { key: 'operatingBeds', label: '수술실' },
  { key: 'emergencyBeds', label: '응급실' },
  { key: 'physicalTherapyBeds', label: '물리치료실' },
  { key: 'psychClosedUpper', label: '정신과 폐쇄(상급)' },
  { key: 'psychClosedNormal', label: '정신과 폐쇄(일반)' },
  { key: 'psychOpenUpper', label: '정신과 개방(상급)' },
  { key: 'psychOpenNormal', label: '정신과 개방(일반)' },
  { key: 'isolationBeds', label: '격리병실' },
  { key: 'sterileBeds', label: '무균치료실' },
]

const hospitalBedRows = computed(() => {
  if (props.facility.category !== 'hospital') return [] as Array<{ label: string; value: string }>
  const d = details.value as Record<string, unknown> | undefined
  if (!d) return []
  return HOSPITAL_BED_DEFS
    .map(({ key, label }) => {
      const v = d[key]
      const num = typeof v === 'number' ? v : null
      return num && num > 0 ? { label, value: `${num}병상` } : null
    })
    .filter((r): r is { label: string; value: string } => r !== null)
})

const hospitalTotalBeds = computed(() => {
  if (props.facility.category !== 'hospital') return 0
  const d = details.value as Record<string, unknown> | undefined
  if (!d) return 0
  return HOSPITAL_BED_DEFS.reduce((sum, { key }) => {
    const v = d[key]
    return sum + (typeof v === 'number' && v > 0 ? v : 0)
  }, 0)
})

const schoolHomepageUrl = computed(() => {
  const url = (details.value as Record<string, string> | undefined)?.homepageUrl || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
})

const schoolEnrollmentRows = computed(() => {
  const d = details.value as Record<string, unknown> | undefined
  const enrollments = (d?.enrollments as Array<{ grade: number; classCount: number }> | undefined) || []
  if (enrollments.length === 0) return [] as Array<{ label: string; classCount: number; isTotal: boolean }>
  const sorted = [...enrollments].sort((a, b) => a.grade - b.grade)
  const rows: Array<{ label: string; classCount: number; isTotal: boolean }> = sorted.map((e) => ({
    label: `${e.grade}학년`,
    classCount: e.classCount,
    isTotal: false,
  }))
  if (rows.length > 1) {
    let totalClasses = 0
    for (const e of enrollments) totalClasses += e.classCount || 0
    rows.push({ label: '합계', classCount: totalClasses, isTotal: true })
  }
  return rows
})

const schoolDepartments = computed(() => {
  const depts = (details.value as Record<string, unknown> | undefined)?.departments as Array<{ departmentName: string }> | undefined
  return (depts || []).map(d => d.departmentName)
})

const marketOpeningCycleLabel = computed(() => {
  const cycle = (details.value as Record<string, string> | undefined)?.openingCycle || ''
  if (cycle === '매일') return '매일'
  if (/\d/.test(cycle)) {
    const days = cycle.split('+').map(s => s.trim()).filter(Boolean)
    return `매월 ${days.join(', ')}`
  }
  return cycle
})

const marketProductTags = computed(() => {
  const products = (details.value as Record<string, string> | undefined)?.products
  return products?.split('+').map(s => s.trim()).filter(Boolean) ?? []
})

const childcareAvailabilityRate = computed(() => {
  const d = details.value as Record<string, number> | undefined
  const cap = d?.crcapat
  const cur = d?.crchcnt
  if (cap == null || cur == null || cap === 0) return '-'
  return `${((cap - cur) / cap * 100).toFixed(0)}%`
})

const childcareOccupancyPct = computed(() => {
  const d = details.value as Record<string, number> | undefined
  const cap = d?.crcapat
  const cur = d?.crchcnt
  if (cap == null || cur == null || cap === 0) return 0
  return Math.min(Math.round((cur / cap) * 100), 100)
})

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
  const d = details.value as Record<string, number> | undefined
  if (!d) return [] as Array<{ label: string; classes?: number; children?: number; avg: number | null }>
  return CLASS_DEFS
    .map(({ label, classKey, childKey }) => {
      const classes = d[classKey]
      const children = d[childKey]
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
  const d = details.value as Record<string, number> | undefined
  if (!d) return [] as Array<{ label: string; cnt: number }>
  return STAFF_ROLE_DEFS
    .map(({ label, key }) => ({ label, cnt: d[key] }))
    .filter(r => r.cnt != null && r.cnt > 0) as Array<{ label: string; cnt: number }>
})

const CAREER_COLORS = [
  'bg-sky-100 text-sky-800',
  'bg-blue-100 text-blue-800',
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-purple-100 text-purple-800',
]

const childcareCareerItems = computed(() => {
  const d = details.value as Record<string, number> | undefined
  if (!d) return [] as Array<{ label: string; cnt: number; colorClass: string }>
  const defs = [
    { label: '1년 미만', key: 'emCnt0y' },
    { label: '1년 이상', key: 'emCnt1y' },
    { label: '2년 이상', key: 'emCnt2y' },
    { label: '4년 이상', key: 'emCnt4y' },
    { label: '6년 이상', key: 'emCnt6y' },
  ] as const
  return defs
    .map(({ label, key }, i) => ({ label, cnt: d[key], colorClass: CAREER_COLORS[i] }))
    .filter(item => item.cnt != null && item.cnt > 0) as Array<{ label: string; cnt: number; colorClass: string }>
})

const parkHasFacilities = computed(() => {
  const d = details.value as Record<string, unknown> | undefined
  return !!(d?.exerciseFacilities || d?.playFacilities || d?.convenienceFacilities || d?.cultureFacilities || d?.otherFacilities)
})

function formatKoreanDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const s = String(dateStr).replace(/\D/g, '')
  if (s.length === 8) {
    return `${s.slice(0, 4)}년 ${parseInt(s.slice(4, 6))}월 ${parseInt(s.slice(6, 8))}일`
  }
  return String(dateStr)
}
</script>
