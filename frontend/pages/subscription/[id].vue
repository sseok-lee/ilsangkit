<template>
  <div class="bg-background-light">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-slate-600">로딩 중...</p>
      </div>
    </div>

    <template v-else-if="subscription">
      <!-- Mobile: Map at top -->
      <div v-if="hasCoords" class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
        <ClientOnly>
          <FacilityMap
            :center="mapCenter!"
            :facilities="mapMarker"
            :level="4"
            class="w-full h-full !min-h-0 !rounded-none"
          />
        </ClientOnly>

        <!-- Back & Name Overlay -->
        <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div class="flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="$router.back()">
            <span class="material-symbols-outlined text-slate-800">arrow_back</span>
          </div>
          <span class="max-w-[calc(100vw-100px)] truncate rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-sm">{{ subscription.houseName }}</span>
        </div>

        <!-- Gradient Overlay -->
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
            v-if="isMapExpanded && hasCoords"
            class="md:hidden fixed inset-0 z-[60] bg-background-light"
          >
            <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 to-transparent">
              <button
                class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm"
                @click="isMapExpanded = false"
              >
                <span class="material-symbols-outlined text-slate-700">close</span>
              </button>
              <span class="text-sm font-bold text-slate-900 bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ subscription.houseName }}</span>
              <a
                :href="kakaoMapUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-sm"
              >
                <span class="material-symbols-outlined text-[20px]">directions</span>
              </a>
            </div>
            <ClientOnly>
              <FacilityMap
                :center="mapCenter!"
                :facilities="mapMarker"
                :level="4"
                class="w-full h-full"
              />
            </ClientOnly>
          </div>
        </Transition>
      </Teleport>

      <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-10 flex flex-col gap-4">
        <!-- Breadcrumb -->
        <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

        <!-- Mobile: 상태 뱃지 -->
        <div class="md:hidden flex items-center gap-2">
          <span v-if="subscription.rentType" :class="rentTypeBadgeClass">
            {{ subscription.rentType === '임대주택' ? '임대' : '분양' }}
          </span>
          <span :class="statusBadgeClass">
            {{ getStatusLabel(subscription.status) }}
          </span>
        </div>

        <!-- PageHero -->
        <PageHero
          :eyebrow="heroEyebrow"
          :title="subscription.houseName"
          :description="subscription.supplyLocation || subscription.regionName"
          :stats="heroStats"
        >
          <template #sidebar>
            <div class="grid gap-2.5 content-start">
              <div
                v-for="stat in heroStats"
                :key="stat.label"
                class="p-3 bg-white border border-line rounded-xl shadow-card"
              >
                <span class="block text-slate-500 text-xs font-bold">{{ stat.label }}</span>
                <strong class="block mt-1 text-lg md:text-xl font-bold text-slate-900">{{ stat.value }}</strong>
              </div>
              <div class="hidden md:flex items-center gap-2">
                <span v-if="subscription.rentType" :class="rentTypeBadgeClass">
                  {{ subscription.rentType === '임대주택' ? '임대' : '분양' }}
                </span>
                <span :class="statusBadgeClass">
                  {{ getStatusLabel(subscription.status) }}
                </span>
              </div>
            </div>
          </template>
        </PageHero>

        <!-- "청약 일정" 블록 -->
        <SectionBlock heading="청약 일정" subtext="놓치면 안 되는 일정을 가장 먼저 확인하세요.">
          <div class="flex items-center gap-2 mb-2 text-primary">
            <span class="material-symbols-outlined text-[20px]">schedule</span>
            <span class="text-sm font-semibold text-slate-800">주요 일정</span>
          </div>
          <div class="space-y-4">
            <TimelineItem
              v-if="subscription.announcementDate"
              title="모집공고"
              :date="subscription.announcementDate"
              icon="article"
            />
            <TimelineItem
              v-if="subscription.specialStartDate && subscription.specialEndDate"
              title="특별공급 접수"
              :date="`${subscription.specialStartDate} ~ ${subscription.specialEndDate}`"
              icon="edit_note"
            />
            <TimelineItem
              v-if="subscription.rank1AreaStartDate && subscription.rank1AreaEndDate"
              title="1순위 접수"
              :date="`${subscription.rank1AreaStartDate} ~ ${subscription.rank1AreaEndDate}`"
              icon="first_page"
            />
            <TimelineItem
              v-if="subscription.rank2AreaStartDate && subscription.rank2AreaEndDate"
              title="2순위 접수"
              :date="`${subscription.rank2AreaStartDate} ~ ${subscription.rank2AreaEndDate}`"
              icon="last_page"
            />
            <TimelineItem
              v-if="subscription.winnerDate"
              title="당첨자 발표"
              :date="subscription.winnerDate"
              icon="check_circle"
            />
            <TimelineItem
              v-if="subscription.contractStartDate && subscription.contractEndDate"
              title="계약 기간"
              :date="`${subscription.contractStartDate} ~ ${subscription.contractEndDate}`"
              icon="description"
            />
            <TimelineItem
              v-if="subscription.moveInMonth"
              title="입주 예정"
              :date="formatMoveInMonth(subscription.moveInMonth)"
              icon="home"
              :is-last="true"
            />
          </div>
        </SectionBlock>

        <!-- Ad: 일정 이후 -->
        <AdBanner />

        <!-- "면적별 공급정보" 블록 -->
        <SectionBlock v-if="unitTypes && unitTypes.length > 0" heading="면적별 공급정보" subtext="주택형별 공급 규모와 분양가를 비교합니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-4 font-semibold text-slate-800">주택형</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">전용면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">공급면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">일반공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">특별공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">합계</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">분양최고가</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">평당가</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-4 text-slate-900 font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ formatExclusiveArea(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ formatSupplyArea(unit.supplyArea) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.generalCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.specialCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-primary font-bold text-right">{{ ((unit.generalCount || 0) + (unit.specialCount || 0)).toLocaleString() }}호</td>
                  <td class="py-3 px-4 text-slate-900 font-semibold text-right">
                    {{ unit.topAmount ? formatPrice(unit.topAmount) : '-' }}
                  </td>
                  <td class="py-3 px-4 text-slate-600 text-right">
                    {{ calcPricePerPyeong(unit) }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-slate-300 bg-slate-50">
                  <td class="py-3 px-4 font-bold text-slate-800" colspan="3">합계</td>
                  <td class="py-3 px-4 font-bold text-slate-800 text-right">{{ totalGeneral.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-slate-800 text-right">{{ totalSpecial.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-primary text-right">{{ (totalGeneral + totalSpecial).toLocaleString() }}호</td>
                  <td class="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- "면적별 경쟁률" 블록 -->
        <SectionBlock v-if="competitions.length > 0" heading="면적별 경쟁률" subtext="1·2순위 접수자수와 공급세대수 기준 경쟁률입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-3 font-semibold text-slate-800">주택형</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">1순위(해당)</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">1순위(기타)</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">2순위(해당)</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">2순위(기타)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in competitionByModel" :key="row.modelNo" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-3 text-slate-900 font-medium">{{ formatHouseType(row.houseType) }}</td>
                  <td class="py-3 px-3 text-right" :class="getCompetitionClass(row.rank1Area)">{{ formatCompetition(row.rank1Area) }}</td>
                  <td class="py-3 px-3 text-right" :class="getCompetitionClass(row.rank1Other)">{{ formatCompetition(row.rank1Other) }}</td>
                  <td class="py-3 px-3 text-right text-slate-600">{{ formatCompetition(row.rank2Area) }}</td>
                  <td class="py-3 px-3 text-right text-slate-600">{{ formatCompetition(row.rank2Other) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-slate-400 mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">info</span>
            접수자수/공급세대수 기준 경쟁률입니다
          </p>
        </SectionBlock>

        <!-- "당첨 가점 분석" 블록 -->
        <SectionBlock v-if="validScores.length > 0" heading="당첨 가점 분석" subtext="가점제 적용 단지의 1순위 당첨 가점 · 84점 만점 기준입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-3 font-semibold text-slate-800">주택형</th>
                  <th class="text-left py-3 px-3 font-semibold text-slate-800">지역</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">최저 가점</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">최고 가점</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">평균 가점</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="score in validScores" :key="`${score.modelNo}-${score.regionCode}`" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-3 text-slate-900 font-medium">{{ formatHouseType(score.houseType) }}</td>
                  <td class="py-3 px-3 text-slate-600">{{ score.regionName || '-' }}</td>
                  <td class="py-3 px-3 text-right font-semibold text-blue-600">{{ score.minScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-semibold text-red-600">{{ score.maxScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-bold text-slate-900">{{ score.avgScore || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-slate-400 mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">info</span>
            가점제 적용 단지의 1순위 당첨 가점입니다. 84점 만점 기준.
          </p>
        </SectionBlock>

        <!-- Ad: 가점·경쟁률 이후 1회 -->
        <AdBanner />

        <!-- "면적별 특별공급 내역" 블록 -->
        <SectionBlock v-if="hasSpecialSupply" heading="면적별 특별공급 내역" subtext="특별공급 대상별 세대수를 한눈에 확인합니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-3 font-semibold text-slate-800">주택형</th>
                  <th v-for="col in activeSpecialColumns" :key="col.key" class="text-right py-3 px-3 font-semibold text-slate-800">{{ col.label }}</th>
                  <th class="text-right py-3 px-3 font-semibold text-slate-800">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-3 text-slate-900 font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 text-slate-600 text-right">
                    {{ (unit[col.key as keyof SubscriptionUnitType] as number) || '-' }}
                  </td>
                  <td class="py-3 px-3 text-primary font-bold text-right">{{ unit.specialCount || 0 }}</td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-slate-300 bg-slate-50">
                  <td class="py-3 px-3 font-bold text-slate-800">합계</td>
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 font-bold text-slate-800 text-right">
                    {{ specialColumnTotal(col.key) }}
                  </td>
                  <td class="py-3 px-3 font-bold text-primary text-right">{{ totalSpecial }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- "특별공급 신청현황" 블록 -->
        <SectionBlock v-if="specialStatuses.length > 0" heading="특별공급 신청현황" subtext="특별공급 대상별 접수자수 대비 공급세대수입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-3 font-semibold text-slate-800">주택형</th>
                  <th v-for="col in activeSpecialStatusColumns" :key="col.key" class="text-right py-3 px-3 font-semibold text-slate-800">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="status in specialStatuses" :key="status.houseType ?? status.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-3 text-slate-900 font-medium">{{ formatHouseType(status.houseType) }}</td>
                  <td v-for="col in activeSpecialStatusColumns" :key="col.key" class="py-3 px-3 text-right text-slate-600">
                    <span class="block text-xs text-slate-400">{{ (status[col.applyKey] as number) || 0 }}명 / {{ (status[col.supplyKey] as number) || 0 }}세대</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <!-- 전월세 시세 (임대주택만) -->
        <RentalPriceStatsBox v-if="subscription?.rentType === '임대주택'" :subscription-id="subscription.id" :region-name="subscription.regionName" />

        <!-- "위치와 로드뷰" 데스크톱 -->
        <SectionBlock v-if="hasCoords" heading="위치와 로드뷰" subtext="지도와 로드뷰로 공급지의 위치를 확인합니다." class="hidden md:block">
          <template #right>
            <div class="relative">
              <button
                class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                @click="showNavDropdown = !showNavDropdown"
              >
                <span class="material-symbols-outlined text-[18px]">directions</span>
                길찾기
                <span class="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
              <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                  <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                </button>
                <div class="h-px bg-slate-100"></div>
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                  <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                </button>
              </div>
            </div>
          </template>
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-xl border border-line overflow-hidden h-[300px]">
              <ClientOnly>
                <FacilityMap
                  :center="mapCenter!"
                  :facilities="mapMarker"
                  :level="4"
                />
              </ClientOnly>
            </div>
            <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[300px]">
              <FacilityRoadview :lat="Number(subscription.lat)" :lng="Number(subscription.lng)" />
            </div>
          </div>
        </SectionBlock>

        <!-- 로드뷰 (모바일) -->
        <SectionBlock v-if="hasCoords" heading="로드뷰" class="md:hidden">
          <div class="roadview-wrapper rounded-xl overflow-hidden h-[200px]">
            <FacilityRoadview :lat="Number(subscription.lat)" :lng="Number(subscription.lng)" />
          </div>
        </SectionBlock>

        <!-- 좌표 없음 fallback -->
        <div v-if="!hasCoords" class="rounded-xl border border-line bg-slate-50 p-6 text-center">
          <span class="material-symbols-outlined text-[32px] text-slate-400 mb-2">location_off</span>
          <p class="text-sm text-slate-500">위치 정보가 제공되지 않아 지도를 표시할 수 없습니다.</p>
        </div>

        <!-- "기본정보" 블록 -->
        <SectionBlock heading="기본정보" subtext="시공사·시행사·문의처 등 청약 개요를 모았습니다.">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">주택유형</span>
              <span class="font-medium text-slate-900">{{ subscription.houseType }}</span>
            </div>
            <div v-if="subscription.houseDetailType" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">분양구분</span>
              <span class="font-medium text-slate-900">{{ subscription.houseDetailType }}</span>
            </div>
            <div v-if="subscription.supplyLocation" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">공급위치</span>
              <span class="font-medium text-slate-900">{{ subscription.supplyLocation }}</span>
            </div>
            <div v-if="subscription.totalSupplyCount" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">총 공급호수</span>
              <span class="font-medium text-slate-900">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
            </div>
            <div v-if="subscription.constructorName" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">시공사</span>
              <span class="font-medium text-slate-900">{{ subscription.constructorName }}</span>
            </div>
            <div v-if="subscription.developerName" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">시행사</span>
              <span class="font-medium text-slate-900">{{ subscription.developerName }}</span>
            </div>
            <div v-if="subscription.moveInMonth" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">입주예정</span>
              <span class="font-medium text-slate-900">{{ formatMoveInMonth(subscription.moveInMonth) }}</span>
            </div>
            <div v-if="subscription.inquiryTel" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">문의전화</span>
              <a :href="`tel:${subscription.inquiryTel}`" class="font-medium text-primary hover:underline">{{ subscription.inquiryTel }}</a>
            </div>
          </div>
        </SectionBlock>

        <!-- 관련 가이드 -->
        <RelatedGuides :categories="['subscription', 'apt-sale', 'apt-rent']" :limit="3" />

        <!-- 외부 링크 버튼 -->
        <div class="flex flex-col md:flex-row gap-4">
          <a
            v-if="subscription.homepage"
            :href="subscription.homepage"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">explore</span>
            공식 홈페이지
          </a>
          <a
            v-if="subscription.pblancUrl"
            :href="subscription.pblancUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">description</span>
            청약홈 공고 보기
          </a>
        </div>

      </main>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">청약 정보를 불러올 수 없습니다</p>
        <NuxtLink
          to="/subscription"
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          목록으로
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import type { Subscription, SubscriptionUnitType, SubscriptionCompetition, SubscriptionScore, SubscriptionSpecialStatus } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'
import { useStructuredData } from '~/composables/useStructuredData'
import RentalPriceStatsBox from '~/components/subscription/RentalPriceStatsBox.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const route = useRoute()
const id = Number(route.params.id)

const { getSubscriptionDetail } = useSubscription()

const subscription = ref<Subscription | null>(null)
const unitTypes = ref<SubscriptionUnitType[]>([])
const competitions = ref<SubscriptionCompetition[]>([])
const scores = ref<SubscriptionScore[]>([])
const specialStatuses = ref<SubscriptionSpecialStatus[]>([])
const pending = ref(false)
const error = ref<string | null>(null)
const isMapExpanded = ref(false)
const showNavDropdown = ref(false)

const hasCoords = computed(() => !!(subscription.value?.lat && subscription.value?.lng))

const mapCenter = computed(() => {
  if (!hasCoords.value) return null
  return { lat: Number(subscription.value!.lat), lng: Number(subscription.value!.lng) }
})

const mapMarker = computed(() => {
  if (!mapCenter.value || !subscription.value) return []
  return [{
    id: 'sub',
    name: subscription.value.houseName,
    lat: mapCenter.value.lat,
    lng: mapCenter.value.lng,
    category: 'toilet' as const,
    address: subscription.value.supplyLocation || null,
    roadAddress: null,
    city: '',
    district: '',
  }]
})

const kakaoMapUrl = computed(() => {
  if (!mapCenter.value || !subscription.value) return ''
  return `https://map.kakao.com/link/to/${encodeURIComponent(subscription.value.houseName)},${mapCenter.value.lat},${mapCenter.value.lng}`
})

const naverMapUrl = computed(() => {
  if (!mapCenter.value || !subscription.value) return ''
  return `https://map.naver.com/v5/directions/-/-/-/transit?c=${mapCenter.value.lng},${mapCenter.value.lat},15,0,0,0,dh&destination=${encodeURIComponent(subscription.value.houseName)},${mapCenter.value.lng},${mapCenter.value.lat}`
})

function openNavigation(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  showNavDropdown.value = false
}

const rentTypeBadgeClass = computed(() => {
  if (!subscription.value) return ''
  const rt = subscription.value.rentType
  const baseClass = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold'
  if (rt === '임대주택') return `${baseClass} bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200`
  return `${baseClass} bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200`
})

const priceRange = computed(() => {
  const amounts = unitTypes.value.map(u => u.topAmount).filter((a): a is number => a != null && a > 0)
  if (amounts.length === 0) return null
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} ~ ${formatPrice(max)}`
})

const heroEyebrow = computed(() => {
  if (!subscription.value) return '청약'
  const rent = subscription.value.rentType === '임대주택' ? '임대' : '분양'
  return `${rent} · ${getStatusLabel(subscription.value.status)}`
})

const heroStats = computed(() => {
  if (!subscription.value) return []
  const items: { label: string; value: string }[] = []
  if (subscription.value.totalSupplyCount) {
    items.push({ label: '총 공급', value: `${subscription.value.totalSupplyCount.toLocaleString()}호` })
  }
  if (subscription.value.moveInMonth) {
    items.push({ label: '입주 예정', value: formatMoveInMonth(subscription.value.moveInMonth) })
  }
  if (priceRange.value) {
    items.push({ label: '분양가', value: priceRange.value })
  }
  return items
})

const breadcrumbItems = computed(() => {
  if (!subscription.value) return []
  const isRent = subscription.value.rentType === '임대주택' || subscription.value.sourceType === 'PRIVATE_RENT'
  const items: { label: string; href?: string; current?: boolean }[] = [
    { label: '홈', href: '/', current: false },
    { label: '청약·임대', href: '/subscription', current: false },
  ]
  if (isRent) items.push({ label: '임대', href: '/subscription/rent', current: false })
  else items.push({ label: '분양', href: '/subscription/sale', current: false })
  items.push({ label: subscription.value.houseName, current: true })
  return items
})

const statusBadgeClass = computed(() => {
  if (!subscription.value) return ''
  const status = subscription.value.status
  const baseClass = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold'
  if (status === 'upcoming') return `${baseClass} bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200`
  if (status === 'ongoing') return `${baseClass} bg-green-100 text-green-700 ring-1 ring-inset ring-green-200`
  return `${baseClass} bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200`
})

// 합계 계산
const totalGeneral = computed(() => unitTypes.value.reduce((sum, u) => sum + (u.generalCount || 0), 0))
const totalSpecial = computed(() => unitTypes.value.reduce((sum, u) => sum + (u.specialCount || 0), 0))

// 특별공급 매트릭스
const allSpecialColumns = [
  { key: 'newlywedsCount', label: '신혼부부' },
  { key: 'multiChildCount', label: '다자녀' },
  { key: 'firstLifeCount', label: '생애최초' },
  { key: 'elderlyCount', label: '노부모부양' },
  { key: 'institutionCount', label: '기관추천' },
  { key: 'youthCount', label: '청년' },
  { key: 'newbornCount', label: '신생아' },
  { key: 'transferCount', label: '이전기관' },
  { key: 'etcCount', label: '기타' },
]

const activeSpecialColumns = computed(() =>
  allSpecialColumns.filter(col =>
    unitTypes.value.some(u => (u[col.key as keyof SubscriptionUnitType] as number) > 0)
  )
)

function specialColumnTotal(key: string): number {
  return unitTypes.value.reduce((sum, u) => sum + ((u[key as keyof SubscriptionUnitType] as number) || 0), 0)
}

const hasSpecialSupply = computed(() => activeSpecialColumns.value.length > 0)

// 경쟁률 모델별 그룹핑
const competitionByModel = computed(() => {
  const map = new Map<string, { modelNo: string; houseType: string | null; rank1Area: SubscriptionCompetition | null; rank1Other: SubscriptionCompetition | null; rank2Area: SubscriptionCompetition | null; rank2Other: SubscriptionCompetition | null }>()
  for (const c of competitions.value) {
    if (!map.has(c.modelNo)) {
      map.set(c.modelNo, { modelNo: c.modelNo, houseType: c.houseType, rank1Area: null, rank1Other: null, rank2Area: null, rank2Other: null })
    }
    const row = map.get(c.modelNo)!
    if (c.rank === 1 && c.regionCode === '01') row.rank1Area = c
    else if (c.rank === 1 && c.regionCode === '02') row.rank1Other = c
    else if (c.rank === 2 && c.regionCode === '01') row.rank2Area = c
    else if (c.rank === 2 && c.regionCode === '02') row.rank2Other = c
  }
  return [...map.values()]
})

function formatCompetition(c: SubscriptionCompetition | null): string {
  if (!c) return '-'
  const count = c.applicantCount ?? 0
  const supply = c.supplyCount ?? 0
  if (supply === 0) return '-'
  return `${count}/${supply} (${c.competitionRate || '-'})`
}

function getCompetitionClass(c: SubscriptionCompetition | null): string {
  if (!c || !c.applicantCount || !c.supplyCount) return 'text-slate-600'
  const rate = c.applicantCount / c.supplyCount
  if (rate >= 10) return 'text-red-600 font-bold'
  if (rate >= 5) return 'text-orange-600 font-semibold'
  if (rate >= 1) return 'text-slate-900 font-medium'
  return 'text-slate-600'
}

// 유효한 가점 (모두 "-"인 행 제외)
const validScores = computed(() =>
  scores.value.filter(s => s.minScore !== '-' || s.maxScore !== '-' || s.avgScore !== '-')
)

// 특별공급 신청현황 컬럼
const allSpecialStatusColumns = [
  { key: 'newlyweds', label: '신혼부부', supplyKey: 'newlywedsSupply' as const, applyKey: 'newlywedsAreaCount' as const },
  { key: 'multiChild', label: '다자녀', supplyKey: 'multiChildSupply' as const, applyKey: 'multiChildAreaCount' as const },
  { key: 'firstLife', label: '생애최초', supplyKey: 'firstLifeSupply' as const, applyKey: 'firstLifeAreaCount' as const },
  { key: 'elderly', label: '노부모부양', supplyKey: 'elderlySupply' as const, applyKey: 'elderlyAreaCount' as const },
  { key: 'youth', label: '청년', supplyKey: 'youthSupply' as const, applyKey: 'youthAreaCount' as const },
  { key: 'newborn', label: '신생아', supplyKey: 'newbornSupply' as const, applyKey: 'newbornAreaCount' as const },
]

const activeSpecialStatusColumns = computed(() =>
  allSpecialStatusColumns.filter(col =>
    specialStatuses.value.some(s => (s[col.supplyKey] as number) > 0 || (s[col.applyKey] as number) > 0)
  )
)

// 포맷 함수들
function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  return '마감'
}

function formatMoveInMonth(month: string): string {
  if (month.length === 6) {
    return `${month.substring(0, 4)}년 ${parseInt(month.substring(4, 6))}월`
  }
  return month
}

function formatHouseType(type: string | null): string {
  if (!type) return '-'
  // "084.9421A" → "84A"
  const match = type.match(/^0?(\d+)\.?\d*([A-Z]?)$/)
  if (match) return `${match[1]}${match[2]}`
  return type
}

function formatExclusiveArea(houseType: string | null): string {
  if (!houseType) return '-'
  // "084.9421A" → 전용 84.94㎡ (약 25.7평)
  const match = houseType.match(/^0?(\d+\.\d+)/)
  if (match) {
    const sqm = parseFloat(match[1])
    const pyeong = (sqm / 3.3058).toFixed(0)
    return `${sqm.toFixed(1)}㎡ (${pyeong}평)`
  }
  return '-'
}

function formatSupplyArea(area: string | null): string {
  if (!area) return '-'
  const sqm = parseFloat(area)
  if (isNaN(sqm)) return area
  const pyeong = (sqm / 3.3058).toFixed(0)
  return `${sqm.toFixed(1)}㎡ (${pyeong}평)`
}

function calcPricePerPyeong(unit: SubscriptionUnitType): string {
  if (!unit.topAmount || !unit.supplyArea) return '-'
  const sqm = parseFloat(unit.supplyArea)
  if (isNaN(sqm) || sqm === 0) return '-'
  const pyeong = sqm / 3.3058
  const pricePerPyeong = Math.round(unit.topAmount / pyeong)
  return `${pricePerPyeong.toLocaleString()}만원`
}

function formatPrice(amount: number): string {
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000)
    const man = amount % 10000
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
}

// SSR: Load initial data
const { data } = await useAsyncData(`subscription-${id}`, () =>
  getSubscriptionDetail(id)
)

if (data.value) {
  const { unitTypes: units, competitions: comps, scores: scrs, specialStatuses: specials, ...sub } = data.value
  subscription.value = sub
  unitTypes.value = units || []
  competitions.value = comps || []
  scores.value = scrs || []
  specialStatuses.value = specials || []
}

const { setBreadcrumbSchema, setEventSchema } = useStructuredData()

if (subscription.value) {
  const sub = subscription.value
  const isRent = sub.sourceType === 'PRIVATE_RENT' || (sub.sourceType === 'APT' && sub.rentType === '임대주택')
  const categoryName = isRent ? '임대' : '분양'
  const categoryPath = isRent ? '/subscription/rent' : '/subscription/sale'

  setBreadcrumbSchema([
    { name: '홈', url: SITE_URL },
    { name: '청약 정보', url: `${SITE_URL}/subscription` },
    { name: categoryName, url: `${SITE_URL}${categoryPath}` },
    { name: sub.houseName, url: `${SITE_URL}/subscription/${id}` },
  ])

  // Event schema for subscription reception period
  if (sub.receptionStartDate && sub.receptionEndDate) {
    setEventSchema({
      name: `${sub.houseName} 청약 접수`,
      description: `${sub.houseName} ${sub.houseType} 청약 접수 기간`,
      startDate: sub.receptionStartDate,
      endDate: sub.receptionEndDate,
      location: sub.regionName,
      url: `/subscription/${id}`,
    })
  }
}

// SEO
useSeoMeta({
  title: subscription.value ? `${subscription.value.houseName} 청약 분양정보 - 일상킷` : '청약 정보 - 일상킷',
  description: subscription.value
    ? `${subscription.value.houseName} ${subscription.value.houseType} 청약 일정, 면적별 공급정보, 분양가를 확인하세요.`
    : '청약 분양정보를 확인하세요.',
  ogTitle: subscription.value ? `${subscription.value.houseName} 청약 - ${subscription.value.regionName}` : '청약 정보',
  ogDescription: subscription.value
    ? `${subscription.value.houseName} ${subscription.value.houseType} 청약 정보`
    : '청약 분양정보',
  ogImage: DEFAULT_OG_IMAGE,
  ogUrl: `${SITE_URL}/subscription/${id}`,
  ogSiteName: SITE_NAME,
})

useHead({
  link: [{ rel: 'canonical', href: `${SITE_URL}/subscription/${id}` }],
})
</script>

<style scoped>
.roadview-wrapper :deep(> div) {
  height: 100% !important;
}
.roadview-wrapper :deep(> div > div) {
  height: 100% !important;
}
</style>
