<template>
  <div class="subscription-detail-page bg-white">
    <template v-if="subscription">
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
                class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-card-2"
                aria-label="지도 닫기"
                @click="isMapExpanded = false"
              >
                <span class="material-symbols-outlined text-ink" aria-hidden="true">close</span>
              </button>
              <span class="text-sm font-bold text-strong bg-white/90 px-3 py-1.5 rounded-full shadow-card-2 backdrop-blur-sm truncate max-w-[60vw]">{{ subscription.houseName }}</span>
              <a
                :href="kakaoMapUrl"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="카카오맵 길찾기 (새 창)"
                class="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-card-2"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">directions</span>
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

      <div class="page-container pt-3 md:pt-5 pb-10 flex flex-col">
        <!-- Breadcrumb (데스크톱만 — chrome, order 미부여로 소스 최상단 유지) -->
        <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

        <!-- T0 헤더 (literal h1 소유) -->
        <PageHead
          class="order-1 md:order-1"
          :eyebrow="heroEyebrow"
          :title="subscription.houseName"
          :description="subscription.supplyLocation || subscription.regionName"
        >
          <template #title><span class="break-keep [overflow-wrap:anywhere]">{{ subscription.houseName }}</span></template>
          <div class="mt-4">
            <UiButton variant="secondary" aria-label="공유하기" @click="handleShare">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">share</span>
              공유
            </UiButton>
          </div>
          <dl v-if="heroStats.length" class="mt-6 grid grid-cols-1 border-t border-line md:grid-cols-2">
            <div
              v-for="stat in heroStats"
              :key="stat.label"
              :data-testid="stat.prominent ? 'hero-price-stat' : undefined"
              class="border-t border-line py-4 first:border-t-0 md:px-5 md:[&:nth-child(2)]:border-l md:[&:nth-child(2)]:border-line"
              :class="stat.prominent ? 'md:col-span-2 md:px-0' : 'first:md:pl-0'"
            >
              <dt class="text-xs font-semibold text-faint">{{ stat.label }}</dt>
              <dd
                class="mt-2 font-extrabold text-strong tabular-nums break-keep"
                :class="stat.prominent ? 'text-[36px] leading-tight whitespace-normal [overflow-wrap:anywhere]' : 'text-xl md:text-2xl'"
              >
                {{ stat.value }}
              </dd>
            </div>
          </dl>
        </PageHead>

        <!-- 광고① : 헤더 직후 (최고 가시성) -->
        <AdBanner class="order-2 md:order-2" />

        <!-- T1a "청약 일정" 블록 -->
        <SectionBlock variant="flat" class="order-3 md:order-3" heading="청약 일정" subtext="놓치면 안 되는 일정을 가장 먼저 확인하세요.">
          <SubscriptionScheduleTimeline :subscription="subscription" />
        </SectionBlock>

        <!-- T1b "면적별 공급정보" 블록 (일정과 인접 — 사이에 광고 없음) -->
        <SectionBlock variant="flat" v-if="unitTypes && unitTypes.length > 0" class="order-4 md:order-4" heading="면적별 공급정보" :subtext="supplySectionSubtext">
          <div data-testid="unit-summary-list" class="md:hidden border-t border-line">
            <div v-for="unit in unitTypes" :key="`summary-${unit.id}`" class="border-b border-line bg-white py-3">
              <div class="flex items-baseline justify-between gap-3">
                <span class="font-semibold text-strong">{{ formatHouseType(unit.houseType) }}</span>
                <span class="text-xs text-faint">{{ formatSupplyArea(unit.supplyArea) }}</span>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span class="text-muted">일반 <strong class="text-strong tabular-nums">{{ formatCount(unit.generalCount, '호') }}</strong></span>
                <span class="text-muted">특별 <strong class="text-strong tabular-nums">{{ formatCount(unit.specialCount, '호') }}</strong></span>
                <span class="text-muted">{{ unitPriceShortLabel }} <strong class="text-strong tabular-nums">{{ formatUnitPrice(unit) }}</strong></span>
              </div>
            </div>
          </div>
          <div class="overflow-x-auto" role="region" aria-label="면적별 공급정보 전체 표" tabindex="0">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-4 font-semibold text-faint">주택형</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">전용면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">공급면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">일반공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">특별공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">합계</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">{{ unitPriceHeader }}</th>
                  <th v-if="!isPublicRent" class="text-right py-3 px-4 font-semibold text-faint">평당가</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-4 text-strong font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-muted text-right">{{ formatExclusiveArea(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-muted text-right">{{ formatSupplyArea(unit.supplyArea) }}</td>
                  <td class="py-3 px-4 text-muted text-right tabular-nums">{{ formatCount(unit.generalCount, '호') }}</td>
                  <td class="py-3 px-4 text-muted text-right tabular-nums">{{ formatCount(unit.specialCount, '호') }}</td>
                  <td class="py-3 px-4 text-primary font-bold text-right tabular-nums">{{ formatCount(unitTotal(unit), '호') }}</td>
                  <td class="py-3 px-4 text-strong font-semibold text-right tabular-nums">
                    {{ formatUnitPrice(unit) }}
                  </td>
                  <td v-if="!isPublicRent" class="py-3 px-4 text-muted text-right tabular-nums">
                    {{ calcPricePerPyeong(unit) }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-line-2 bg-background-light">
                  <td class="py-3 px-4 font-bold text-ink" colspan="3">합계</td>
                  <td class="py-3 px-4 font-bold text-ink text-right tabular-nums">{{ formatCount(totalGeneral, '호') }}</td>
                  <td class="py-3 px-4 font-bold text-ink text-right tabular-nums">{{ formatCount(totalSpecial, '호') }}</td>
                  <td class="py-3 px-4 font-bold text-primary text-right tabular-nums">{{ formatCount(totalSupplyTotal, '호') }}</td>
                  <td class="py-3 px-4"></td>
                  <td v-if="!isPublicRent" class="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- Ad: T1(일정+공급정보) 두 표 직후로 한 칸 이동 -->
        <AdBanner class="order-5 md:order-5" />

        <!-- T3 "면적별 경쟁률" 블록 -->
        <SectionBlock variant="flat" v-if="competitions.length > 0" class="order-6 md:order-6" heading="면적별 경쟁률" subtext="1·2순위 접수자수와 공급세대수 기준 경쟁률입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-3 font-semibold text-faint">주택형</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">1순위(해당)</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">1순위(기타)</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">2순위(해당)</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">2순위(기타)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in competitionByModel" :key="row.modelNo" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-3 text-strong font-medium">{{ formatHouseType(row.houseType) }}</td>
                  <td class="py-3 px-3 text-right tabular-nums" :class="getCompetitionClass(row.rank1Area)">{{ formatCompetition(row.rank1Area) }}</td>
                  <td class="py-3 px-3 text-right tabular-nums" :class="getCompetitionClass(row.rank1Other)">{{ formatCompetition(row.rank1Other) }}</td>
                  <td class="py-3 px-3 text-right text-muted tabular-nums">{{ formatCompetition(row.rank2Area) }}</td>
                  <td class="py-3 px-3 text-right text-muted tabular-nums">{{ formatCompetition(row.rank2Other) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-faint mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
            접수자수/공급세대수 기준 경쟁률입니다
          </p>
        </SectionBlock>

        <!-- "당첨 가점 분석" 블록 -->
        <SectionBlock variant="flat" v-if="validScores.length > 0" class="order-6 md:order-6" heading="당첨 가점 분석" subtext="가점제 적용 단지의 1순위 당첨 가점 · 84점 만점 기준입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-3 font-semibold text-faint">주택형</th>
                  <th class="text-left py-3 px-3 font-semibold text-faint">지역</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">최저 가점</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">최고 가점</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">평균 가점</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="score in validScores" :key="`${score.modelNo}-${score.regionCode}`" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-3 text-strong font-medium">{{ formatHouseType(score.houseType) }}</td>
                  <td class="py-3 px-3 text-muted">{{ score.regionName || '-' }}</td>
                  <td class="py-3 px-3 text-right font-semibold text-primary tabular-nums">{{ score.minScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-semibold text-red-600 tabular-nums">{{ score.maxScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-bold text-strong tabular-nums">{{ score.avgScore || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-faint mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
            가점제 적용 단지의 1순위 당첨 가점입니다. 84점 만점 기준.
          </p>
        </SectionBlock>

        <!-- "면적별 특별공급 내역" 블록 -->
        <SectionBlock variant="flat" v-if="hasSpecialSupply" class="order-7 md:order-7" heading="면적별 특별공급 내역" subtext="특별공급 대상별 세대수를 한눈에 확인합니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-3 font-semibold text-faint">주택형</th>
                  <th v-for="col in activeSpecialColumns" :key="col.key" class="text-right py-3 px-3 font-semibold text-faint">{{ col.label }}</th>
                  <th class="text-right py-3 px-3 font-semibold text-faint">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-3 text-strong font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 text-muted text-right tabular-nums">
                    {{ formatCount(unit[col.key as keyof SubscriptionUnitType] as number | null, '세대') }}
                  </td>
                  <td class="py-3 px-3 text-primary font-bold text-right tabular-nums">{{ formatCount(unit.specialCount, '세대') }}</td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-line-2 bg-background-light">
                  <td class="py-3 px-3 font-bold text-ink">합계</td>
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 font-bold text-ink text-right tabular-nums">
                    {{ formatCount(specialColumnTotal(col.key), '세대') }}
                  </td>
                  <td class="py-3 px-3 font-bold text-primary text-right tabular-nums">{{ formatCount(totalSpecial, '세대') }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- "특별공급 신청현황" 블록 -->
        <SectionBlock variant="flat" v-if="specialStatuses.length > 0" class="order-7 md:order-7" heading="특별공급 신청현황" subtext="특별공급 대상별 접수자수 대비 공급세대수입니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-3 font-semibold text-faint">주택형</th>
                  <th v-for="col in activeSpecialStatusColumns" :key="col.key" class="text-right py-3 px-3 font-semibold text-faint">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="status in specialStatuses" :key="status.houseType ?? status.id" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-3 text-strong font-medium">{{ formatHouseType(status.houseType) }}</td>
                  <td v-for="col in activeSpecialStatusColumns" :key="col.key" class="py-3 px-3 text-right text-muted">
                    <span class="block text-xs text-faint tabular-nums">{{ formatCount(status[col.applyKey] as number | null, '명') }} / {{ formatCount(status[col.supplyKey] as number | null, '세대') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <!-- 전월세 시세 (임대주택만) -->
        <RentalPriceStatsBox v-if="showRentalPriceStats" class="order-7 md:order-7" :subscription-id="subscription.id" :region-name="subscription.regionName" />

        <!-- "위치와 로드뷰" 데스크톱 -->
        <SectionBlock variant="flat" v-if="hasCoords" heading="위치와 로드뷰" subtext="지도와 로드뷰로 공급지의 위치를 확인합니다." class="hidden md:block order-8 md:order-8">
          <template #right>
            <div class="relative">
              <button
                class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
                :aria-expanded="showNavDropdown"
                @click="showNavDropdown = !showNavDropdown"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">directions</span>
                길찾기
                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">expand_more</span>
              </button>
              <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-[10px] shadow-card-2 border border-line-2 overflow-hidden z-20">
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                  <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                </button>
                <div class="h-px bg-line"></div>
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
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

        <!-- 위치·로드뷰 (모바일) -->
        <SectionBlock variant="flat" v-if="hasCoords" heading="위치·로드뷰" subtext="지도와 로드뷰로 공급지의 위치를 확인합니다." class="md:hidden order-8 md:order-8">
          <!-- 모바일 전용 라이브 지도 (데스크톱은 위 사이드 섹션 사용) -->
          <div class="relative h-[220px] w-full rounded-xl overflow-hidden border border-line mb-3">
            <ClientOnly>
              <FacilityMap
                :center="mapCenter!"
                :facilities="mapMarker"
                :level="4"
                class="w-full h-full !min-h-0"
              />
            </ClientOnly>
            <button
              class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-ink px-3 py-1.5 rounded-full shadow-card-2 backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
              @click="isMapExpanded = true"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_full</span>
              지도 크게 보기
            </button>
          </div>
          <div class="roadview-wrapper rounded-xl overflow-hidden h-[220px]">
            <FacilityRoadview :lat="Number(subscription.lat)" :lng="Number(subscription.lng)" />
          </div>
        </SectionBlock>

        <!-- 좌표 없음 fallback -->
        <div v-if="!hasCoords" class="mt-6 rounded-[10px] border border-line bg-background-light p-6 text-center order-8 md:order-8">
          <span class="material-symbols-outlined text-[32px] text-faint mb-2" aria-hidden="true">location_off</span>
          <p class="text-sm text-muted">위치 정보가 제공되지 않아 지도를 표시할 수 없습니다.</p>
        </div>


        <SectionBlock
          variant="flat"
          v-if="subscription.publicRental"
          class="order-8 md:order-8"
          heading="공공임대 공급정보"
          subtext="공급지역·단지별 모집 수량과 임대 조건입니다. 금액이 비어 있으면 원문 확인으로 표시합니다."
        >
          <div class="mb-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div class="rounded-lg border border-line bg-background-light p-3">
              <span class="block text-xs font-semibold text-faint">공급기관</span>
              <strong class="mt-1 block text-strong">{{ subscription.publicRental.provider || subscription.developerName || '원문 확인' }}</strong>
            </div>
            <div class="rounded-lg border border-line bg-background-light p-3">
              <span class="block text-xs font-semibold text-faint">출처</span>
              <strong class="mt-1 block text-strong">{{ publicRentalSourceLabel }}</strong>
            </div>
            <div class="rounded-lg border border-line bg-background-light p-3">
              <span class="block text-xs font-semibold text-faint">원문 상태</span>
              <strong class="mt-1 block text-strong">{{ subscription.publicRental.sourceStatus || '원문 확인' }}</strong>
            </div>
          </div>
          <div v-if="publicRentalSupplies.length > 0" class="overflow-x-auto" role="region" aria-label="공공임대 공급지역별 조건 표" tabindex="0">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="px-4 py-3 text-left font-semibold text-faint">단지/공급</th>
                  <th class="px-4 py-3 text-left font-semibold text-faint">지역</th>
                  <th class="px-4 py-3 text-left font-semibold text-faint">주소</th>
                  <th class="px-4 py-3 text-right font-semibold text-faint">수량</th>
                  <th class="px-4 py-3 text-right font-semibold text-faint">최소 보증금</th>
                  <th class="px-4 py-3 text-right font-semibold text-faint">최소 월임대료</th>
                  <th class="px-4 py-3 text-left font-semibold text-faint">모집기간</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="supply in publicRentalSupplies" :key="supply.key" class="border-b border-line hover:bg-background-light">
                  <td class="px-4 py-3 font-medium text-strong">{{ supply.name || '원문 확인' }}</td>
                  <td class="px-4 py-3 text-muted">{{ supply.region || '원문 확인' }}</td>
                  <td class="px-4 py-3 text-muted">{{ supply.address || '원문 확인' }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatPublicRentalCount(supply.supplyCount) }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatWonAmount(supply.deposit) }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatWonAmount(supply.monthlyRent) }}</td>
                  <td class="px-4 py-3 text-muted">{{ formatPublicRentalPeriod(supply) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="rounded-lg border border-line bg-background-light p-4 text-sm text-muted">단지별 공급 조건은 원문 확인이 필요합니다.</p>
        </SectionBlock>

        <!-- "기본정보" 블록 -->
        <SectionBlock variant="flat" class="order-9 md:order-9" heading="기본정보" subtext="시공사·시행사·문의처 등 청약 개요를 모았습니다.">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">주택유형</span>
              <span class="font-medium text-strong">{{ subscription.houseType }}</span>
            </div>
            <div v-if="subscription.houseDetailType" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">분양구분</span>
              <span class="font-medium text-strong">{{ subscription.houseDetailType }}</span>
            </div>
            <div v-if="subscription.supplyLocation" class="flex flex-col gap-1 py-2 border-b border-line md:flex-row md:justify-between md:items-baseline md:gap-4">
              <span class="text-muted shrink-0">공급위치</span>
              <span class="font-medium text-strong md:text-right">{{ subscription.supplyLocation }}</span>
            </div>
            <div v-if="subscription.totalSupplyCount != null" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">총 공급호수</span>
              <span class="font-medium text-strong tabular-nums">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
            </div>
            <div v-if="subscription.constructorName" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">시공사</span>
              <span class="font-medium text-strong">{{ subscription.constructorName }}</span>
            </div>
            <div v-if="subscription.developerName" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">시행사</span>
              <span class="font-medium text-strong">{{ subscription.developerName }}</span>
            </div>
            <div v-if="subscription.moveInMonth" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">입주예정</span>
              <span class="font-medium text-strong tabular-nums">{{ formatMoveInMonth(subscription.moveInMonth) }}</span>
            </div>
            <div v-if="subscription.inquiryTel" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">문의전화</span>
              <a :href="`tel:${subscription.inquiryTel}`" class="font-medium text-primary hover:underline">{{ subscription.inquiryTel }}</a>
            </div>
          </div>
        </SectionBlock>

        <!-- 외부 링크 버튼 -->
        <div class="mt-6 flex flex-col md:flex-row gap-4 order-9 md:order-9">
          <UiButton
            v-if="subscription.homepage"
            variant="primary"
            :href="subscription.homepage"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 w-full justify-center"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">explore</span>
            공식 홈페이지
          </UiButton>
          <UiButton
            v-if="subscription.pblancUrl"
            variant="secondary"
            :href="subscription.pblancUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 w-full justify-center"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">description</span>
            원문 확인
          </UiButton>
        </div>

        <!-- Ad③: 기본정보 이후 · 관련 가이드 앞 (항상 존재하는 블록 사이로 이동 — 결과 미발표 청약에서 경쟁률·가점 섹션이 비어 광고②와 연속 노출되던 문제 방지) -->
        <AdBanner class="order-10 md:order-10" />

        <!-- 관련 가이드 -->
        <RelatedGuides variant="flat" class="order-11 md:order-11" :categories="['subscription', 'apt-sale', 'apt-rent']" :limit="3" />

        <!-- Ad: 본문 마무리 (하단) -->
        <AdBanner class="order-12 md:order-12" />

        <!-- 데이터 정보 (멀티루트 → wrapper에 order) -->
        <div class="order-12 md:order-12">
          <DataSourceSection variant="flat" domain="subscription" :last-sync-date="subscription?.updatedAt ? formatDotDate(subscription.updatedAt) : null" />
        </div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400" aria-hidden="true">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">청약 정보를 불러올 수 없습니다</p>
        <NuxtLink
          to="/subscription"
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
          목록으로
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL } from '~/utils/seoConstants'
import { OG_MAP_WIDTH, OG_MAP_HEIGHT } from '~/utils/ogMapSpec'
import { buildOgMapImageUrl, staticOgImageUrl } from '~/utils/ogImageUrl'
import { buildSubscriptionSeoTitle, PUBLIC_RENT_TYPES } from '~/utils/subscriptionMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { Subscription, SubscriptionUnitType, SubscriptionCompetition, SubscriptionScore, SubscriptionSpecialStatus, PublicRentalSupply } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'
import { useStructuredData } from '~/composables/useStructuredData'
import { formatDotDate } from '~/utils/syncFreshness'
import { useAnalytics } from '~/composables/useAnalytics'
import RentalPriceStatsBox from '~/components/subscription/RentalPriceStatsBox.vue'
import SubscriptionScheduleTimeline from '~/components/subscription/SubscriptionScheduleTimeline.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import PageHead from '~/components/common/PageHead.vue'
import UiButton from '~/components/common/UiButton.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'

const route = useRoute()
const id = Number(route.params.id)

const { getSubscriptionDetail } = useSubscription()

const subscription = ref<Subscription | null>(null)
const unitTypes = ref<SubscriptionUnitType[]>([])
const competitions = ref<SubscriptionCompetition[]>([])
const scores = ref<SubscriptionScore[]>([])
const specialStatuses = ref<SubscriptionSpecialStatus[]>([])
const error = ref<string | null>(null)
const isMapExpanded = ref(false)
const showNavDropdown = ref(false)

const publicRentalSupplies = computed(() => subscription.value?.publicRental?.supplies ?? [])
const isPublicRentalMultiRegion = computed(() =>
  subscription.value?.sourceType === 'PUBLIC_RENT' && (
    subscription.value.regionName === '전국' ||
    publicRentalSupplies.value.length !== 1 ||
    new Set(publicRentalSupplies.value.map(supply => supply.region).filter(Boolean)).size > 1
  )
)
const hasCoords = computed(() => !!(subscription.value?.lat && subscription.value?.lng) && !isPublicRentalMultiRegion.value)

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
    // 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)
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

function handleShare() {
  if (!subscription.value) return
  const url = `${SITE_URL}/subscription/${id}`
  if (import.meta.client && navigator.share) {
    navigator.share({ title: subscription.value.houseName, url }).catch(() => {})
  } else if (import.meta.client && navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

function openNavigation(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  showNavDropdown.value = false
}

const priceRange = computed(() => {
  const amounts = unitTypes.value.map(u => u.topAmount).filter((a): a is number => a != null && a > 0)
  if (amounts.length === 0) return null
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  if (min === max) return formatPrice(min)
  // 범위 구분자는 일반 공백으로 둔다. 36px 대표 금액은 좁은 폭에서 여기서 자연스럽게 줄바꿈된다.
  return `${formatPrice(min)} ~ ${formatPrice(max)}`
})

const isApplyHomePublicRent = computed(() =>
  subscription.value?.sourceType === 'APT' &&
  subscription.value.rentType != null &&
  PUBLIC_RENT_TYPES.includes(subscription.value.rentType),
)

const isPublicRent = computed(() =>
  isApplyHomePublicRent.value || subscription.value?.sourceType === 'PUBLIC_RENT',
)

const isRentSubscription = computed(() =>
  isPublicRent.value || subscription.value?.sourceType === 'PRIVATE_RENT',
)

const showRentalPriceStats = computed(() => isApplyHomePublicRent.value)

const unitPriceHeader = computed(() => isPublicRent.value ? '임대 조건' : '분양최고가')
const unitPriceShortLabel = computed(() => isPublicRent.value ? '조건' : '가격')
const supplySectionSubtext = computed(() =>
  isPublicRent.value
    ? '주택형별 공급 규모와 임대 조건을 비교합니다.'
    : '주택형별 공급 규모와 분양가를 비교합니다.',
)

const heroEyebrow = computed(() => {
  if (!subscription.value) return '청약'
  const rent = isPublicRent.value ? '공공임대' : isRentSubscription.value ? '임대' : '분양'
  return `${rent} · ${getStatusLabel(subscription.value.status)}`
})

const heroStats = computed(() => {
  if (!subscription.value) return []
  const items: { label: string; value: string; prominent?: boolean }[] = []
  if (subscription.value.totalSupplyCount != null) {
    items.push({ label: '총 공급', value: `${subscription.value.totalSupplyCount.toLocaleString()}호` })
  }
  if (subscription.value.moveInMonth) {
    items.push({ label: '입주 예정', value: formatMoveInMonth(subscription.value.moveInMonth) })
  }
  if (!isPublicRent.value && priceRange.value) {
    items.push({ label: '분양가', value: priceRange.value, prominent: true })
  }
  return items
})

const subscriptionTypeLabel = computed(() => {
  if (!subscription.value) return '청약'
  if (isPublicRent.value) return '공공임대'
  if (subscription.value.houseType) return subscription.value.houseType
  if (subscription.value.sourceType === 'PRIVATE_RENT') return '민간임대'
  if (subscription.value.sourceType === 'OFFITEL') return '오피스텔'
  if (subscription.value.sourceType === 'REMAINING') return '무순위·잔여세대'
  return '아파트'
})

const subscriptionDateRange = computed(() => {
  const start = subscription.value?.receptionStartDate
  const end = subscription.value?.receptionEndDate
  if (!start || !end) return null
  // ISO datetime(2026-06-15T00:00:00.000Z)을 SEO/OG 설명에 그대로 노출하지 않도록 날짜만 표기.
  return `${start.slice(0, 10)}~${end.slice(0, 10)}`
})

const subscriptionSeoTitle = computed(() => {
  if (!subscription.value) return '청약 일정'
  // 위치/유형/상태는 description에만 노출(타이틀 길이 제한 회피). setMeta가 ` | 일상킷` 접미사를 붙임.
  // 접수 연월은 회차 구분용 — 같은 단지가 여러 번 공고를 내므로 단지명만으로는 제목이 겹친다.
  // 근거·수치는 buildSubscriptionSeoTitle 주석 참조.
  return buildSubscriptionSeoTitle({
    houseName: subscription.value.houseName,
    receptionStartDate: subscription.value.receptionStartDate,
  })
})

const subscriptionSeoDescription = computed(() => {
  if (!subscription.value) return '청약 일정과 분양·임대 정보를 확인하세요.'

  const location = subscription.value.regionName || '전국'
  const facts = [getStatusLabel(subscription.value.status)]

  if (subscription.value.totalSupplyCount != null) {
    facts.push(`공급 ${subscription.value.totalSupplyCount.toLocaleString()}호`)
  }
  if (subscriptionDateRange.value) {
    facts.push(`접수 ${subscriptionDateRange.value}`)
  }
  else if (subscription.value.winnerDate) {
    facts.push(`발표 ${subscription.value.winnerDate.slice(0, 10)}`)
  }
  else if (subscription.value.moveInMonth) {
    facts.push(`입주 ${formatMoveInMonth(subscription.value.moveInMonth)}`)
  }
  if (!isPublicRent.value && priceRange.value) {
    facts.push(`분양가 ${priceRange.value}`)
  }

  return `${subscription.value.houseName} ${location} ${subscriptionTypeLabel.value} 청약 정보입니다. ${facts.join(', ')} 정보를 확인하세요.`
})

const breadcrumbItems = computed(() => {
  if (!subscription.value) return []
  const isRent = isRentSubscription.value
  const items: { label: string; href?: string; current?: boolean }[] = [
    { label: '홈', href: '/', current: false },
    { label: '청약 정보', href: '/subscription', current: false },
  ]
  if (isRent) items.push({ label: '임대', href: '/subscription/rent', current: false })
  else items.push({ label: '분양', href: '/subscription/sale', current: false })
  items.push({ label: subscription.value.houseName, current: true })
  return items
})

const publicRentalSourceLabel = computed(() => {
  const sources = subscription.value?.publicRental?.sources ?? []
  if (sources.length === 0) return '원문 확인'
  return sources.map(source => source === 'MYHOME' ? '마이홈' : 'LH').join(' · ')
})

function formatPublicRentalCount(value: number | null): string {
  return value == null ? '원문 확인' : `${value.toLocaleString()}호`
}

function formatWonAmount(value: number | null): string {
  if (value == null || value === 0) return '원문 확인'
  const manwon = Math.round(value / 10000)
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000)
    const man = manwon % 10000
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억`
  }
  return `${manwon.toLocaleString()}만원`
}

function formatPublicRentalPeriod(supply: PublicRentalSupply): string {
  if (!supply.receptionStartDate || !supply.receptionEndDate) return '원문 확인'
  return `${supply.receptionStartDate.slice(0, 10)} ~ ${supply.receptionEndDate.slice(0, 10)}`
}

// 합계 계산
function nullableUnitSum(key: 'generalCount' | 'specialCount'): number | null {
  let hasValue = false
  const total = unitTypes.value.reduce((sum, unit) => {
    const value = unit[key]
    if (value == null) return sum
    hasValue = true
    return sum + value
  }, 0)
  return hasValue ? total : null
}

const totalGeneral = computed(() => nullableUnitSum('generalCount'))
const totalSpecial = computed(() => nullableUnitSum('specialCount'))
const totalSupplyTotal = computed(() => {
  if (totalGeneral.value == null && totalSpecial.value == null) return null
  return (totalGeneral.value ?? 0) + (totalSpecial.value ?? 0)
})

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
    unitTypes.value.some(u => (u[col.key as keyof SubscriptionUnitType] as number | null) != null)
  )
)

function specialColumnTotal(key: string): number | null {
  let hasValue = false
  const total = unitTypes.value.reduce((sum, u) => {
    const value = u[key as keyof SubscriptionUnitType] as number | null
    if (value == null) return sum
    hasValue = true
    return sum + value
  }, 0)
  return hasValue ? total : null
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
  if (!c || !c.applicantCount || !c.supplyCount) return 'text-muted'
  const rate = c.applicantCount / c.supplyCount
  if (rate >= 10) return 'text-red-600 font-bold'
  if (rate >= 5) return 'text-orange-600 font-semibold'
  if (rate >= 1) return 'text-strong font-medium'
  return 'text-muted'
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
    specialStatuses.value.some(s => (s[col.supplyKey] as number | null) != null || (s[col.applyKey] as number | null) != null)
  )
)

// 포맷 함수들
function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '청약중'
  if (status === 'unknown') return '일정 확인 필요'
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

function formatCount(value: number | null, unit: string): string {
  return value == null ? '미제공' : `${value.toLocaleString()}${unit}`
}

function unitTotal(unit: SubscriptionUnitType): number | null {
  if (unit.generalCount == null && unit.specialCount == null) return null
  return (unit.generalCount ?? 0) + (unit.specialCount ?? 0)
}

function formatUnitPrice(unit: SubscriptionUnitType): string {
  if (isPublicRent.value) return '원문 확인'
  return unit.topAmount == null ? '미제공' : formatPrice(unit.topAmount)
}

function calcPricePerPyeong(unit: SubscriptionUnitType): string {
  if (unit.topAmount == null || !unit.supplyArea) return '-'
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
    // '억' 과 '만원' 사이는 non-breaking space (U+00A0) — 한 가격 안에서 줄바꿈 방지.
    // 범위 표시 "min ~ max" 의 ~ 양쪽 공백만 자연스러운 줄바꿈 지점이 되도록 한다.
    return man > 0 ? `${eok}억\u00A0${man.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
}

// SSR: Load initial data
const { data, error: fetchError } = await useAsyncData(`subscription-${id}`, () =>
  getSubscriptionDetail(id)
)

// getSubscriptionDetail 은 $fetch 예외를 삼키지 않는다. 따라서 백엔드가 404 를 주면
// data 가 null 이 되는 게 아니라 fetchError 로 올라온다 — 상태코드를 보지 않으면
// "존재하지 않는 청약"까지 일시 장애로 오인해 503 을 내보내게 된다.
// 실측(2026-07-28 라이브): /subscription/does-not-exist-999999 →
//   HTTP 503 + robots `index, follow` + title `청약 일정 | 일상킷`
// 게다가 그 title 은 청약 상세 전체가 공유하므로, 백엔드가 흔들리면 약 5,000건이
// 동시에 같은 title 로 나간다(네이버 진단에 표본 상한 50건 기록됨).
// 정책은 #674(시설 상세)와 동일: 확정 부재만 404, 그 외는 fail-open.
const subErrStatus = fetchError.value?.statusCode
if (subErrStatus === 404 || subErrStatus === 422) {
  // 백엔드가 "없다"고 확정 → 진짜 404 (soft-404 색인 방지)
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 정보입니다' })
} else if (fetchError.value) {
  // 5xx·네트워크 등 일시 장애 — soft-503 fail-open (404 오인 색인 방지)
  if (import.meta.server) markDegradedResponse()
} else if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 정보입니다' })
}

if (data.value) {
  const { unitTypes: units, competitions: comps, scores: scrs, specialStatuses: specials, ...sub } = data.value
  subscription.value = sub
  unitTypes.value = units || []
  competitions.value = comps || []
  scores.value = scrs || []
  specialStatuses.value = specials || []
}

const { setBreadcrumbSchema, setEventSchema, setDetailProvenance } = useStructuredData()
const { trackSubscriptionView } = useAnalytics()

if (subscription.value) {
  const sub = subscription.value
  const isRent = sub.sourceType === 'PRIVATE_RENT' || sub.sourceType === 'PUBLIC_RENT' || (sub.sourceType === 'APT' && sub.rentType != null && PUBLIC_RENT_TYPES.includes(sub.rentType))
  const categoryName = isRent ? '임대' : '분양'
  const categoryPath = isRent ? '/subscription/rent' : '/subscription/sale'

  onMounted(() => trackSubscriptionView({
    subscriptionId: id,
    houseName: sub.houseName,
    subscriptionType: isRent ? 'rent' : 'sale',
  }))

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

  setDetailProvenance({
    domain: 'subscription', path: `/subscription/${sub.id}`,
    description: subscriptionSeoDescription.value,
    updatedAt: sub.updatedAt ?? null,
  })
}

// SEO
// og:image 조립은 공용 빌더 한곳에서만 한다 — 예전엔 단지명을 label 과 title 에 두 번 싣고
// 자르지도 않아 URL 이 불필요하게 길었다(라우트는 title 을 읽지 않는다).
const subscriptionOgImage = computed(() => buildOgMapImageUrl({
  lat: mapCenter.value?.lat,
  lng: mapCenter.value?.lng,
  label: subscription.value?.houseName,
  category: 'subscription',
}))
// 정적 PNG 로 떨어졌으면 실제 파일 규격은 1200x630 (setMeta 기본값).
const subscriptionOgImageIsStatic = computed(() => subscriptionOgImage.value === staticOgImageUrl())

const { setMeta } = useFacilityMeta()
setMeta({
  title: subscriptionSeoTitle.value,
  description: subscriptionSeoDescription.value,
  path: `/subscription/${id}`,
  image: subscriptionOgImage.value,
  imageWidth: subscriptionOgImageIsStatic.value ? undefined : OG_MAP_WIDTH,
  imageHeight: subscriptionOgImageIsStatic.value ? undefined : OG_MAP_HEIGHT,
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
