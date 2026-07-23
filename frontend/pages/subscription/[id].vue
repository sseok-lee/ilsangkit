<template>
  <div class="bg-background-light">
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
                class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm"
                @click="isMapExpanded = false"
              >
                <span class="material-symbols-outlined text-ink">close</span>
              </button>
              <span class="text-sm font-bold text-strong bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ subscription.houseName }}</span>
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

      <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-8 md:pb-10 flex flex-col gap-3">
        <!-- Breadcrumb (데스크톱만 — chrome, order 미부여로 소스 최상단 유지) -->
        <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

        <!-- T0 모바일 헤더 (literal h1 소유) -->
        <MobileDetailHeader
          class="order-1 md:order-1"
          :title="subscription.houseName"
          :eyebrow="heroEyebrow"
          :stats="heroStats"
          :kakao-map-url="kakaoMapUrl"
          :naver-map-url="naverMapUrl"
          @share="handleShare"
          @directions="(p: string) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
        />

        <!-- T0 데스크톱 헤더 (title-tag="div"로 강등 → literal h1 아님) -->
        <PageHero
          class="hidden md:block order-1 md:order-1"
          title-tag="div"
          :eyebrow="heroEyebrow"
          :title="subscription.houseName"
          :description="subscription.supplyLocation || subscription.regionName"
          :stats="heroStats"
        />

        <!-- 광고① : 헤더 직후 (최고 가시성) -->
        <AdBanner class="order-2 md:order-2" />

        <!-- T1a "청약 일정" 블록 -->
        <SectionBlock class="order-3 md:order-3" heading="청약 일정" subtext="놓치면 안 되는 일정을 가장 먼저 확인하세요.">
          <SubscriptionScheduleTimeline :subscription="subscription" />
        </SectionBlock>

        <!-- T1b "면적별 공급정보" 블록 (일정과 인접 — 사이에 광고 없음) -->
        <SectionBlock v-if="unitTypes && unitTypes.length > 0" class="order-4 md:order-4" heading="면적별 공급정보" subtext="주택형별 공급 규모와 분양가를 비교합니다.">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b-2 border-line-2 bg-background-light">
                  <th class="text-left py-3 px-4 font-semibold text-faint">주택형</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">전용면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">공급면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">일반공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">특별공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">합계</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">분양최고가</th>
                  <th class="text-right py-3 px-4 font-semibold text-faint">평당가</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-line hover:bg-background-light">
                  <td class="py-3 px-4 text-strong font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-muted text-right">{{ formatExclusiveArea(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-muted text-right">{{ formatSupplyArea(unit.supplyArea) }}</td>
                  <td class="py-3 px-4 text-muted text-right font-display tabular-nums">{{ unit.generalCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-muted text-right font-display tabular-nums">{{ unit.specialCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-primary font-bold text-right font-display tabular-nums">{{ ((unit.generalCount || 0) + (unit.specialCount || 0)).toLocaleString() }}호</td>
                  <td class="py-3 px-4 text-strong font-semibold text-right font-display tabular-nums">
                    {{ unit.topAmount ? formatPrice(unit.topAmount) : '-' }}
                  </td>
                  <td class="py-3 px-4 text-muted text-right font-display tabular-nums">
                    {{ calcPricePerPyeong(unit) }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-line-2 bg-background-light">
                  <td class="py-3 px-4 font-bold text-ink" colspan="3">합계</td>
                  <td class="py-3 px-4 font-bold text-ink text-right font-display tabular-nums">{{ totalGeneral.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-ink text-right font-display tabular-nums">{{ totalSpecial.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-primary text-right font-display tabular-nums">{{ (totalGeneral + totalSpecial).toLocaleString() }}호</td>
                  <td class="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- Ad: T1(일정+공급정보) 두 표 직후로 한 칸 이동 -->
        <AdBanner class="order-5 md:order-5" />

        <!-- T3 "면적별 경쟁률" 블록 -->
        <SectionBlock v-if="competitions.length > 0" class="order-6 md:order-6" heading="면적별 경쟁률" subtext="1·2순위 접수자수와 공급세대수 기준 경쟁률입니다.">
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
                  <td class="py-3 px-3 text-right font-display tabular-nums" :class="getCompetitionClass(row.rank1Area)">{{ formatCompetition(row.rank1Area) }}</td>
                  <td class="py-3 px-3 text-right font-display tabular-nums" :class="getCompetitionClass(row.rank1Other)">{{ formatCompetition(row.rank1Other) }}</td>
                  <td class="py-3 px-3 text-right text-muted font-display tabular-nums">{{ formatCompetition(row.rank2Area) }}</td>
                  <td class="py-3 px-3 text-right text-muted font-display tabular-nums">{{ formatCompetition(row.rank2Other) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-faint mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">info</span>
            접수자수/공급세대수 기준 경쟁률입니다
          </p>
        </SectionBlock>

        <!-- "당첨 가점 분석" 블록 -->
        <SectionBlock v-if="validScores.length > 0" class="order-6 md:order-6" heading="당첨 가점 분석" subtext="가점제 적용 단지의 1순위 당첨 가점 · 84점 만점 기준입니다.">
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
                  <td class="py-3 px-3 text-right font-semibold text-primary font-display tabular-nums">{{ score.minScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-semibold text-red-600 font-display tabular-nums">{{ score.maxScore || '-' }}</td>
                  <td class="py-3 px-3 text-right font-bold text-strong font-display tabular-nums">{{ score.avgScore || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-faint mt-3 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">info</span>
            가점제 적용 단지의 1순위 당첨 가점입니다. 84점 만점 기준.
          </p>
        </SectionBlock>

        <!-- "면적별 특별공급 내역" 블록 -->
        <SectionBlock v-if="hasSpecialSupply" class="order-7 md:order-7" heading="면적별 특별공급 내역" subtext="특별공급 대상별 세대수를 한눈에 확인합니다.">
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
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 text-muted text-right font-display tabular-nums">
                    {{ (unit[col.key as keyof SubscriptionUnitType] as number) || '-' }}
                  </td>
                  <td class="py-3 px-3 text-primary font-bold text-right font-display tabular-nums">{{ unit.specialCount || 0 }}</td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-line-2 bg-background-light">
                  <td class="py-3 px-3 font-bold text-ink">합계</td>
                  <td v-for="col in activeSpecialColumns" :key="col.key" class="py-3 px-3 font-bold text-ink text-right font-display tabular-nums">
                    {{ specialColumnTotal(col.key) }}
                  </td>
                  <td class="py-3 px-3 font-bold text-primary text-right font-display tabular-nums">{{ totalSpecial }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>

        <!-- "특별공급 신청현황" 블록 -->
        <SectionBlock v-if="specialStatuses.length > 0" class="order-7 md:order-7" heading="특별공급 신청현황" subtext="특별공급 대상별 접수자수 대비 공급세대수입니다.">
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
                    <span class="block text-xs text-faint font-display tabular-nums">{{ (status[col.applyKey] as number) || 0 }}명 / {{ (status[col.supplyKey] as number) || 0 }}세대</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <!-- 전월세 시세 (임대주택만) -->
        <RentalPriceStatsBox v-if="subscription?.rentType === '임대주택'" class="order-7 md:order-7" :subscription-id="subscription.id" :region-name="subscription.regionName" />

        <!-- "위치와 로드뷰" 데스크톱 -->
        <SectionBlock v-if="hasCoords" heading="위치와 로드뷰" subtext="지도와 로드뷰로 공급지의 위치를 확인합니다." class="hidden md:block order-8 md:order-8">
          <template #right>
            <div class="relative">
              <button
                class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
                @click="showNavDropdown = !showNavDropdown"
              >
                <span class="material-symbols-outlined text-[18px]">directions</span>
                길찾기
                <span class="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
              <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-line-2 overflow-hidden z-20">
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                  <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                </button>
                <div class="h-px bg-line"></div>
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
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
        <SectionBlock v-if="hasCoords" heading="위치·로드뷰" subtext="지도와 로드뷰로 공급지의 위치를 확인합니다." class="md:hidden order-8 md:order-8">
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
              class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-ink px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
              @click="isMapExpanded = true"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_full</span>
              지도 크게 보기
            </button>
          </div>
          <div class="roadview-wrapper rounded-xl overflow-hidden h-[220px]">
            <FacilityRoadview :lat="Number(subscription.lat)" :lng="Number(subscription.lng)" />
          </div>
        </SectionBlock>

        <!-- 좌표 없음 fallback -->
        <div v-if="!hasCoords" class="rounded-xl border border-line bg-background-light p-6 text-center order-8 md:order-8">
          <span class="material-symbols-outlined text-[32px] text-faint mb-2">location_off</span>
          <p class="text-sm text-muted">위치 정보가 제공되지 않아 지도를 표시할 수 없습니다.</p>
        </div>

        <!-- "기본정보" 블록 -->
        <SectionBlock class="order-9 md:order-9" heading="기본정보" subtext="시공사·시행사·문의처 등 청약 개요를 모았습니다.">
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
            <div v-if="subscription.totalSupplyCount" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">총 공급호수</span>
              <span class="font-medium text-strong font-display tabular-nums">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
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
              <span class="font-medium text-strong font-display tabular-nums">{{ formatMoveInMonth(subscription.moveInMonth) }}</span>
            </div>
            <div v-if="subscription.inquiryTel" class="flex justify-between py-2 border-b border-line">
              <span class="text-muted">문의전화</span>
              <a :href="`tel:${subscription.inquiryTel}`" class="font-medium text-primary hover:underline">{{ subscription.inquiryTel }}</a>
            </div>
          </div>
        </SectionBlock>

        <!-- 외부 링크 버튼 -->
        <div class="flex flex-col md:flex-row gap-4 order-9 md:order-9">
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
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-line-2 text-ink font-medium rounded-xl hover:bg-background-light transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">description</span>
            청약홈 공고 보기
          </a>
        </div>

        <!-- Ad③: 기본정보 이후 · 관련 가이드 앞 (항상 존재하는 블록 사이로 이동 — 결과 미발표 청약에서 경쟁률·가점 섹션이 비어 광고②와 연속 노출되던 문제 방지) -->
        <AdBanner class="order-10 md:order-10" />

        <!-- 관련 가이드 -->
        <RelatedGuides class="order-11 md:order-11" :categories="['subscription', 'apt-sale', 'apt-rent']" :limit="3" />

        <!-- Ad: 본문 마무리 (하단) -->
        <AdBanner class="order-12 md:order-12" />

        <!-- 데이터 정보 (멀티루트 → wrapper에 order) -->
        <div class="order-12 md:order-12">
          <DataSourceSection domain="subscription" :last-sync-date="subscription?.updatedAt ? formatDotDate(subscription.updatedAt) : null" />
        </div>

      </div>
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
import { SITE_URL } from '~/utils/seoConstants'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { Subscription, SubscriptionUnitType, SubscriptionCompetition, SubscriptionScore, SubscriptionSpecialStatus } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'
import { useStructuredData } from '~/composables/useStructuredData'
import { formatDotDate } from '~/utils/syncFreshness'
import { useAnalytics } from '~/composables/useAnalytics'
import RentalPriceStatsBox from '~/components/subscription/RentalPriceStatsBox.vue'
import SubscriptionScheduleTimeline from '~/components/subscription/SubscriptionScheduleTimeline.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
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
  // ~ 양쪽도 non-breaking space — 분양가 전체를 한 줄에 유지.
  return `${formatPrice(min)}\u00A0~\u00A0${formatPrice(max)}`
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

const subscriptionTypeLabel = computed(() => {
  if (!subscription.value) return '청약'
  if (subscription.value.houseType) return subscription.value.houseType
  if (subscription.value.sourceType === 'PRIVATE_RENT') return '민간임대'
  if (subscription.value.sourceType === 'OFFITEL') return '오피스텔'
  if (subscription.value.sourceType === 'REMAINING') return '무순위·잔여세대'
  if (subscription.value.rentType === '임대주택') return '공공임대'
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
  return `${subscription.value.houseName} 청약 일정·경쟁률`
})

const subscriptionSeoDescription = computed(() => {
  if (!subscription.value) return '청약 일정과 분양·임대 정보를 확인하세요.'

  const location = subscription.value.regionName || '전국'
  const facts = [getStatusLabel(subscription.value.status)]

  if (subscription.value.totalSupplyCount) {
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
  if (priceRange.value) {
    facts.push(`분양가 ${priceRange.value}`)
  }

  return `${subscription.value.houseName} ${location} ${subscriptionTypeLabel.value} 청약 정보입니다. ${facts.join(', ')} 정보를 확인하세요.`
})

const breadcrumbItems = computed(() => {
  if (!subscription.value) return []
  const isRent = subscription.value.rentType === '임대주택' || subscription.value.sourceType === 'PRIVATE_RENT'
  const items: { label: string; href?: string; current?: boolean }[] = [
    { label: '홈', href: '/', current: false },
    { label: '청약 정보', href: '/subscription', current: false },
  ]
  if (isRent) items.push({ label: '임대', href: '/subscription/rent', current: false })
  else items.push({ label: '분양', href: '/subscription/sale', current: false })
  items.push({ label: subscription.value.houseName, current: true })
  return items
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
    specialStatuses.value.some(s => (s[col.supplyKey] as number) > 0 || (s[col.applyKey] as number) > 0)
  )
)

// 포맷 함수들
function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '청약중'
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

if (fetchError.value) {
  // 백엔드 일시 장애(5xx) — soft-503 fail-open (404 오인 색인 방지)
  if (import.meta.server) markDegradedResponse()
} else if (!data.value) {
  // 존재하지 않는 청약 → 진짜 404 (soft-404 색인 방지)
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
  const isRent = sub.sourceType === 'PRIVATE_RENT' || (sub.sourceType === 'APT' && sub.rentType === '임대주택')
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
const subscriptionOgImage = computed(() => {
  if (!subscription.value || !hasCoords.value) return undefined
  const name = subscription.value.houseName
  return `${SITE_URL}/og-map?lat=${mapCenter.value!.lat}&lng=${mapCenter.value!.lng}&label=${encodeURIComponent(name)}&category=subscription&title=${encodeURIComponent(name)}`
})

const { setMeta } = useFacilityMeta()
setMeta({
  title: subscriptionSeoTitle.value,
  description: subscriptionSeoDescription.value,
  path: `/subscription/${id}`,
  image: subscriptionOgImage.value,
  imageWidth: hasCoords.value ? 1024 : undefined,
  imageHeight: hasCoords.value ? 536 : undefined,
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
