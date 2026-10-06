<template>
  <div class="estate-detail-page bg-white">
    <!-- Loading State (lazy navigation) -->
    <div v-if="ssrLoading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-muted">{{ UI_MESSAGES.loading }}</p>
      </div>
    </div>

    <template v-else>
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
          v-if="isMapExpanded && buildingInfo?.lat && buildingInfo?.lng"
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
            <span class="text-sm font-bold text-ink bg-white/90 px-3 py-1.5 rounded-full shadow-card-2 backdrop-blur-sm truncate max-w-[60vw]">{{ buildingName }}</span>
            <div class="size-10"></div>
          </div>
          <ClientOnly>
            <FacilityMap
              :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
              :facilities="buildingMarker"
              :level="3"
              class="w-full h-full"
            />
          </ClientOnly>
        </div>
      </Transition>
    </Teleport>

    <div class="page-container pt-3 md:pt-5 pb-20 md:pb-14 flex flex-col">
      <div class="order-1 min-w-0 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
        <Breadcrumb :items="breadcrumbItems" />
      </div>

      <PageHead class="order-2" :title="buildingName">
        <template #actions>
          <UiButton variant="secondary" aria-label="이 건물 공유하기" @click="handleShare">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">share</span>
            <span>공유</span>
          </UiButton>
        </template>
        <div v-if="hasReportedAddressAmbiguity" class="mt-3 text-[13px] md:text-sm text-faint">
          <a href="#reported-addresses" class="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
            <span class="material-symbols-outlined text-[15px]" aria-hidden="true">info</span>
            주소 후보 {{ reportedAddressCount }}건 · 위치 섹션에서 확인
          </a>
        </div>
        <p v-else class="mt-3 text-[13px] md:text-sm text-faint">
          <AddressLine :address="fullAddress" />
        </p>

        <SummaryRow lead class="mt-[22px] md:mt-7" aria-label="실거래 요약" :items="estateSummaryItems" />
        <div v-if="overviewError" class="estate-inline-error" role="alert">
          <span>최근 매매 요약을 불러오지 못했습니다. 가격 흐름과 거래 내역은 마지막 성공 데이터를 유지합니다.</span>
          <button type="button" @click="refreshOverview">요약 다시 불러오기</button>
        </div>
        <p class="estate-record-note">국토교통부 실거래 자료 기준 · 건축연도와 면적은 거래 신고 정보입니다.</p>
        <nav class="estate-section-nav" aria-label="상세 정보 바로가기">
          <a href="#trend">가격 흐름</a>
          <a href="#transactions">거래 내역</a>
          <a href="#location">위치</a>
          <a href="#nearby">주변 정보</a>
        </nav>
      </PageHead>

      <!-- Ad: Hero 직후 (fold 하단) — 모바일 실측 384px 로 폴드 안이라 규격 상한을 둔다.
           높이 미지정이면 AdSense 가 390×390(뷰포트의 46%)을 배정하고 full-bleed 로 번진다.
           시설 상세 첫 슬롯과 동일 조합. 폴드 아래 슬롯은 auto 유지. -->
      <AdBanner class="estate-ad-slot estate-ad-slot--first order-3 md:order-3" sizing="fixed" ad-format="rectangle" :fixed-height="280" />

      <!-- 위치·로드뷰 (responsive: mobile은 로드뷰만, md+에서 지도+로드뷰 2-col) -->
      <SectionBlock variant="flat" id="location" class="order-9 md:order-11" heading="위치" :subtext="locationSectionSubtext">
        <template #right>
          <div v-if="hasMapCoords" class="hidden md:flex items-center gap-1">
            <div class="relative">
              <button
                class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
                :aria-expanded="showNavDropdown"
                @click="showNavDropdown = !showNavDropdown"
              >
                <span class="material-symbols-outlined text-[18px]">directions</span>
                길찾기
                <span class="material-symbols-outlined text-[14px]">expand_more</span>
              </button>
              <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-[10px] shadow-card-2 border border-line overflow-hidden z-20">
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                  <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                </button>
                <div class="h-px bg-line"></div>
                <button class="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                  <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                </button>
              </div>
            </div>
          </div>
        </template>
        <!-- 좌표 결측: 섹션을 숨기지 않고 사실 + 대안 경로를 제시한다.
             (숨기면 앞뒤 광고가 붙고, 사용자는 주소로 찾을 방법도 잃는다.) -->
        <EmptyState
          v-if="!hasMapCoords"
          icon="location_off"
          :title="locationEmptyTitle"
          :description="locationEmptyDescription"
        >
          <div
            v-if="hasReportedAddressAmbiguity"
            id="reported-addresses"
            class="mt-4 w-full max-w-2xl scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left"
            role="note"
          >
            <p class="text-sm font-semibold text-amber-900">주소가 여러 건 보고되었습니다</p>
            <p class="mt-1 text-xs text-amber-800">원본 실거래 자료에 같은 건물명으로 여러 지번이 있어 주소별 검색 링크를 제공합니다.</p>
            <ul class="mt-3 space-y-3">
              <li
                v-for="item in reportedAddressItems"
                :key="item.key"
                class="rounded-[10px] border border-amber-100 bg-white px-3 py-3"
              >
                <AddressLine :address="item.display" />
                <div class="mt-3 flex flex-wrap gap-2">
                  <a
                    :href="kakaoAddressSearchUrl(item.searchQuery)"
                    :aria-label="`카카오맵에서 ${shortAddressLabel(item.display)} 검색`"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-background-light"
                  >
                    <img src="/images/icons/kakaomap.svg" alt="" class="h-5 w-5 rounded" aria-hidden="true" />
                    카카오맵
                  </a>
                  <a
                    :href="naverAddressSearchUrl(item.searchQuery)"
                    :aria-label="`네이버맵에서 ${shortAddressLabel(item.display)} 검색`"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-background-light"
                  >
                    <img src="/images/icons/navermap.svg" alt="" class="h-5 w-5 rounded" aria-hidden="true" />
                    네이버맵
                  </a>
                </div>
              </li>
            </ul>
          </div>
          <template v-else>
            <AddressLine :address="fullAddress" class="justify-center" />
            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <UiButton variant="secondary" :href="kakaoSearchUrl" target="_blank" rel="noopener">
                <img src="/images/icons/kakaomap.svg" alt="" class="h-5 w-5 rounded" aria-hidden="true" />
                카카오맵에서 주소 검색
              </UiButton>
              <UiButton variant="secondary" :href="naverSearchUrl" target="_blank" rel="noopener">
                <img src="/images/icons/navermap.svg" alt="" class="h-5 w-5 rounded" aria-hidden="true" />
                네이버맵에서 주소 검색
              </UiButton>
            </div>
          </template>
        </EmptyState>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 지도: 모바일에서도 노출 (짧은 높이 + 크게 보기 버튼) -->
          <div class="relative rounded-[10px] border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
            <ClientOnly>
              <FacilityMap
                :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                :facilities="buildingMarker"
                :level="3"
              />
            </ClientOnly>
            <button
              class="md:hidden absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-ink px-3 py-1.5 rounded-full backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
              @click="isMapExpanded = true"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_full</span>
              지도 크게 보기
            </button>
          </div>
          <div class="roadview-wrapper rounded-[10px] border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
            <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
          </div>
        </div>
      </SectionBlock>


      <!-- "전·월세 거래 비중" 블록 (rent 전용) — 시세추이(order-4) 직후로 승격 -->
      <SectionBlock
        variant="flat"
        v-if="currentTab === 'rent' && rentRatioTotal > 0"
        class="order-5 md:order-5"
        heading="전·월세 거래 비중"
        subtext="전체 거래의 전세·월세 구성입니다."
      >
        <RentRatioBar :jeonse-count="buildingInfo?.jeonseCount" :wolse-count="buildingInfo?.wolseCount" />
      </SectionBlock>

      <SectionBlock variant="flat" id="trend" class="order-4 md:order-4" aria-labelledby="trend-title" subtext="거래 유형과 전용면적을 함께 확인하세요.">
        <template #heading><h2 id="trend-title" class="ui-h2 text-strong">가격 흐름</h2></template>

        <ExactDealFilters
          v-if="snapshot"
          class="estate-exact-filters"
          :filters="snapshot.filters"
          :options="snapshot.options"
          :pending="pending"
          @patch="handleExactFilterPatch"
        />

        <p
          v-if="announcement"
          class="mb-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700"
          role="status"
          aria-live="polite"
        >
          {{ announcement }}
        </p>

        <div v-if="pending && !snapshot" class="flex justify-center py-8">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <div v-else-if="snapshot" class="estate-chart-shell">
          <DealPriceChart
            :points="snapshot.points"
            :window="snapshot.window"
            :mode="snapshot.filters.mode"
            :loading="pending"
            :error="error"
            @retry="refresh"
          />
          <div class="estate-chart-summary" aria-label="선택 조건 요약">
            <div>
              <span>기간 내 최고</span>
              <strong class="tabular-nums">{{ periodMaxPriceLabel }}</strong>
            </div>
            <div>
              <span>기간 내 최저</span>
              <strong class="tabular-nums">{{ periodMinPriceLabel }}</strong>
            </div>
            <div>
              <span>{{ periodTradeLabel }}</span>
              <strong class="tabular-nums">{{ periodTradeCount }}건</strong>
            </div>
          </div>
        </div>
        <div v-else class="estate-empty">
          시세 데이터가 아직 없습니다.
        </div>
        <SourceStamp
          v-if="snapshot"
          class="mt-3"
          variant="plain"
          provider="국토교통부"
          :basis="txBasis"
          :synced-at="rawSyncDate"
          :stale-days="RE_STALE_DAYS"
        />
        <p v-if="snapshot" class="estate-data-caveat">필수 신고 정보가 있는 거래 기준</p>
      </SectionBlock>

      <!-- Ad: 시세 추이/비중 ↔ 위치 사이 (데스크톱 md:order-6, 모바일 order-5는 비중 뒤로 tie-break) -->
      <AdBanner class="estate-ad-slot order-5 md:order-6" />

      <SectionBlock variant="flat" id="transactions" class="order-6 md:order-7" aria-labelledby="transactions-title" subtext="선택한 거래 유형·면적·기간의 내역입니다.">
        <template #heading><h2 id="transactions-title" class="ui-h2 text-strong">거래 내역</h2></template>
        <template #right>
          <div class="md:text-right">
            <SourceStamp
              provider="국토교통부"
              :synced-at="rawSyncDate"
              :stale-days="RE_STALE_DAYS"
              source-url="https://rt.molit.go.kr"
              link-label="원본 보기"
            />
            <p class="estate-data-caveat">필수 신고 정보가 있는 거래 기준</p>
          </div>
        </template>
        <div v-if="tableError" class="estate-inline-error mb-4" role="alert">
          <span>거래 내역 페이지를 불러오지 못했습니다. 표는 마지막 성공 데이터를 유지합니다.</span>
          <button type="button" @click="retryExactPage">거래 내역 다시 불러오기</button>
        </div>
        <div v-if="tablePending && table.items.length === 0" class="flex justify-center py-8">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <TransactionTable
          v-else-if="table.items.length > 0"
          :transactions="table.items"
          :type="currentTab"
          :loading="tablePending || pending"
          :hide-building="true"
          presentation="detail"
        />
        <div v-else class="estate-empty">
          {{ emptyFiltered('거래 내역') }}
        </div>
        <Pagination
          v-if="table.totalPages > 1"
          :current-page="table.page"
          :total-pages="table.totalPages"
          @page-change="goToExactPage"
          class="mt-4"
        />
      </SectionBlock>

      <!-- Ad: 거래내역 이후 (In-Article) -->
      <AdBanner class="estate-ad-slot order-7 md:order-8" />

      <!-- "인근 단지" 블록 — cross-property 3섹션 (apt → offitel → villa) -->
      <div id="nearby" class="flex flex-col gap-0 order-12 md:order-12">
        <SectionBlock
          variant="flat"
          v-if="nearbyByType.apt.length > 0"
          subtext="같은 동 내 다른 아파트 단지를 함께 확인하세요."
        >
          <template #heading>
            <h3 class="ui-h2 text-strong flex items-center gap-2">
              <img src="/icons/category/apt.webp?v2" alt="아파트" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('apt') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.apt"
              :key="item.buildingKey ?? `apt-${item.buildingName}-${item.bjdCode}-${item.dongName}-${item.jibun ?? ''}`"
              :item="item"
              property-type="apt"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>

        <SectionBlock
          variant="flat"
          v-if="nearbyByType.offitel.length > 0"
          subtext="같은 동 내 오피스텔 단지의 실거래를 함께 확인하세요."
        >
          <template #heading>
            <h3 class="ui-h2 text-strong flex items-center gap-2">
              <img src="/icons/category/offitel.webp?v2" alt="오피스텔" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('offitel') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.offitel"
              :key="item.buildingKey ?? `offitel-${item.buildingName}-${item.bjdCode}-${item.dongName}-${item.jibun ?? ''}`"
              :item="item"
              property-type="offitel"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>

        <SectionBlock
          variant="flat"
          v-if="nearbyByType.villa.length > 0"
          subtext="같은 동 내 빌라 단지의 실거래를 비교해 보세요."
        >
          <template #heading>
            <h3 class="ui-h2 text-strong flex items-center gap-2">
              <img src="/icons/category/villa.webp?v2" alt="빌라" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('villa') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.villa"
              :key="item.buildingKey ?? `villa-${item.buildingName}-${item.bjdCode}-${item.dongName}-${item.jibun ?? ''}`"
              :item="item"
              property-type="villa"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>

        <!-- 인근 단지 결측: 세 유형이 모두 비면 블록째 사라져 앞뒤 광고가 붙는다. -->
        <SectionBlock variant="flat" v-if="!hasNearby" heading="인근 단지" subtext="반경 내 등록된 다른 단지가 없습니다.">
          <EmptyState
            icon="apartment"
            title="반경 내 다른 단지가 없습니다"
            :description="`${buildingName} 주변에 실거래가가 등록된 다른 단지를 찾지 못했습니다. ${districtName}의 전체 목록에서 비교해보세요.`"
          >
            <UiButton
              variant="secondary"
              :to="`/real-estate/${realEstateTypeParam}/${citySlugParam}/${districtSlugParam}`"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">apartment</span>
              {{ districtName }} {{ propertyMeta?.label ?? '' }} 전체 보기
            </UiButton>
          </EmptyState>
        </SectionBlock>
      </div>


      <!-- "주변 생활시설" 블록 -->
      <SectionBlock
        variant="flat"
        class="order-12 md:order-12"
        heading="주변 생활시설"
        :subtext="facilitySectionSubtext"
      >
        <NearbyFacilities v-if="hasMapCoords" :lat="buildingInfo!.lat!" :lng="buildingInfo!.lng!" />
        <EmptyState
          v-else
          icon="search_off"
          :title="facilityEmptyTitle"
          :description="facilityEmptyDescription"
        >
          <UiButton
            variant="secondary"
            :to="`/${citySlugParam}/${districtSlugParam}`"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">location_on</span>
            {{ districtName }} 생활시설 전체 보기
          </UiButton>
        </EmptyState>
      </SectionBlock>

      <!-- Ad: 주변 생활시설 이후 -->
      <AdBanner class="estate-ad-slot order-12 md:order-12" />

      <!-- 네이버 블로그 후기 -->
      <BlogReviewSection
        variant="flat"
        v-if="buildingName"
        class="order-12 md:order-12"
        kind="real-estate"
        :primary-key="(realEstateTypeParam as string)"
        :secondary-key="`${cityName}|${districtName}|${buildingName}`"
      />

      <!-- 관련 가이드 -->
      <RelatedGuides variant="flat" class="order-12 md:order-12" :categories="PROPERTY_GUIDE_CATEGORIES" :limit="3" />


      <!-- 데이터 출처 -->
      <!-- DataSourceSection은 멀티 루트 템플릿(compact/full v-if·v-else)이라 class fall-through가 안 됨 → order를 wrapper div에 부여 -->
      <div class="order-12 md:order-12">
        <DataSourceSection variant="flat" domain="real-estate" :last-sync-date="lastSyncDate" />
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'
import type { FacilitySearchItem } from '~/types'
import type { RealEstatePropertyType, TransactionMode, BuildingInfo, StatsSummary, NearbyResponse, RealEstateType } from '~/types/realEstate'
import { toApiSlug } from '~/types/realEstate'
import type { DealMode, DetailOverview, DetailQuery } from '~/types/housingRedesign'
import { useRealEstateDetail } from '~/composables/useRealEstateDetail'
import { shouldNoindexRealEstateDetail } from '~/utils/realEstateNoindex'
import {
  isRegionMismatch,
  resolveCitySlugStrict,
  resolveDistrictSlugStrict,
  resolveRegionRedirectPath,
} from '~/utils/realEstateRegion'
import { buildOgMapImageUrl } from '~/utils/ogImageUrl'
import { OG_MAP_WIDTH, OG_MAP_HEIGHT } from '~/utils/ogMapSpec'
import { useNearbyComplexes } from '~/composables/useNearbyComplexes'
import { fetchNearbyForSsr } from '~/utils/realEstateNearbySsr'
import RentRatioBar from '~/components/realEstate/RentRatioBar.vue'
import { formatKoreanPrice } from '~/utils/formatters'
import { resolveLatestSaleDeal } from '~/utils/realEstateRecentDeal'
import { RE_STALE_DAYS, formatDotDate } from '~/utils/syncFreshness'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'
import { useAnalytics } from '~/composables/useAnalytics'
import { useApiBase } from '~/composables/useApiBase'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, toRealEstateListUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { isDetailSsrDegraded } from '~/utils/detailSsrDegraded'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import PageHead from '~/components/common/PageHead.vue'
import SummaryRow, { type SummaryItem } from '~/components/common/SummaryRow.vue'
import UiButton from '~/components/common/UiButton.vue'
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'

const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'

definePageMeta({
  path: '/real-estate/:realEstateType/:city/:district/:buildingName/:addressSuffix?',
  key: route => route.path,
})

const route = useRoute()
const router = useRouter()
const apiBase = useApiBase()

const PROPERTY_GUIDE_CATEGORIES: string[] = ['apt-sale', 'apt-rent', 'subscription']

// ── Route params ────────────────────────────────────────────────────────────

const realEstateTypeParam = route.params.realEstateType as string
const citySlugParam = route.params.city as string
const districtSlugParam = route.params.district as string
const rawAddressSuffixParam = Array.isArray(route.params.addressSuffix)
  ? route.params.addressSuffix[0]
  : route.params.addressSuffix
const hasAddressSuffix = typeof rawAddressSuffixParam === 'string'
  && rawAddressSuffixParam.length > 0
const hasHashAddressSuffix = typeof rawAddressSuffixParam === 'string'
  && /^[a-f0-9]{64}$/i.test(rawAddressSuffixParam)

// Validate realEstateType
if (!isRealEstateUrlType(realEstateTypeParam)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// Build reverse map: slug → Korean district name
const DISTRICT_SLUG_TO_NAME: Record<string, string> = Object.entries(DISTRICT_SLUG_MAP).reduce(
  (acc, [name, slug]) => ({ ...acc, [slug]: name }),
  {} as Record<string, string>,
)

// Validate city slug
const cityName = CITY_SLUG_MAP[citySlugParam]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// Validate district slug
const districtName = DISTRICT_SLUG_TO_NAME[districtSlugParam]
if (!districtName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const buildingName = computed(() =>
  decodeURIComponent(route.params.buildingName as string).normalize('NFC'),
)

type PublicUrlResolution =
  | { mode: 'keyed'; canonicalPath: null }
  | {
    mode: 'preserved'
    type: RealEstateUrlType
    buildingKey?: string
    bjdCode: string
    buildingName: string
    canonicalPath: string
    redirect: boolean
    legacyGrouped?: true
  }

function stringifyRouteQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) params.append(key, String(item))
      }
    } else {
      params.set(key, String(value))
    }
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

function isSafeRealEstatePath(path: string | null | undefined): path is string {
  return typeof path === 'string'
    && path.startsWith('/real-estate/')
    && !path.startsWith('//')
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).normalize('NFC')
  } catch {
    return segment.normalize('NFC')
  }
}

function normalizePublicUrlPath(path: string): string {
  const [pathname = ''] = path.split('?', 1)
  return pathname
    .split('/')
    .map((segment, index) => index === 0 ? '' : encodeURIComponent(decodePathSegment(segment)))
    .join('/')
}

function toPublicUrlResolutionError(err: unknown): never {
  const status = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { status?: number }).status
  if (status === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
  }
  throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
}

async function fetchPublicUrlResolution(path: string): Promise<PublicUrlResolution> {
  const res = await $fetch<{ success: boolean; data: PublicUrlResolution | null }>(
    `${apiBase}/api/real-estate/resolve-url`,
    { query: { path }, timeout: 8000 },
  )
  if (res.data?.mode === 'keyed') {
    return { mode: 'keyed', canonicalPath: null }
  }
  if (res.data?.mode === 'preserved'
    && (res.data.buildingKey || res.data.legacyGrouped)
    && isSafeRealEstatePath(res.data.canonicalPath)) {
    return res.data
  }
  throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
}

const publicUrlPath = normalizePublicUrlPath(route.path)
const { data: publicUrlResolution, error: publicUrlResolutionError } = await useAsyncData(
  `re-public-url-resolution-${publicUrlPath}`,
  () => fetchPublicUrlResolution(publicUrlPath),
)

if (publicUrlResolutionError.value) {
  toPublicUrlResolutionError(publicUrlResolutionError.value)
}
if (!publicUrlResolution.value) {
  throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
}

if (publicUrlResolution.value?.mode === 'preserved' && publicUrlResolution.value.redirect) {
  await navigateTo(
    `${publicUrlResolution.value.canonicalPath}${stringifyRouteQuery(route.query)}`,
    { redirectCode: 301 },
  )
}
if (publicUrlResolution.value?.mode === 'keyed' && hasAddressSuffix) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}
if (hasHashAddressSuffix) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// ── Derived values ────────────────────────────────────────────────────────────

// Split realEstateType: e.g. "apt-sale" → propertyType="apt", tab="sale"
const realEstateType = realEstateTypeParam as RealEstateUrlType
const [propertyTypePart] = realEstateType.split('-') as [string, string]
const propertyTypeParam = propertyTypePart as RealEstatePropertyType
const routeRealEstateType = computed(() => route.params.realEstateType as RealEstateUrlType)
const routePropertyTypePart = computed(() =>
  routeRealEstateType.value.replace(/-(?:sale|rent)$/, '') as RealEstatePropertyType
)
const routeCurrentTab = computed<TransactionMode>(() =>
  routeRealEstateType.value.endsWith('-sale') ? 'sale' : 'rent'
)

// Tab is canonical from URL — no ?tab= query param
const currentTab = computed<TransactionMode>({
  get: () => routeCurrentTab.value,
  set: (val) => {
    void pushTransactionTab(val)
  },
})

const apiSlug = computed(() => toApiSlug(routePropertyTypePart.value, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[routePropertyTypePart.value])

// ── SEO / Head ────────────────────────────────────────────────────────────────

const buildingInfo = ref<BuildingInfo | null>(null)
function isLegacyGroupedResolution(): boolean {
  return publicUrlResolution.value?.mode === 'preserved'
    && publicUrlResolution.value.legacyGrouped === true
}
function activeBuildingKey(): string | undefined {
  if (isLegacyGroupedResolution()) return undefined
  const resolvedKey = publicUrlResolution.value?.mode === 'preserved'
    ? publicUrlResolution.value.buildingKey
    : undefined
  return resolvedKey ?? buildingInfo.value?.buildingKey
}
function activeCanonicalPath(): string | null {
  const resolvedPath = publicUrlResolution.value?.mode === 'preserved'
    ? publicUrlResolution.value.canonicalPath
    : null
  return resolvedPath ?? buildingInfo.value?.canonicalPath ?? null
}

async function canonicalPathForType(type: RealEstateUrlType, buildingKey: string | undefined): Promise<string | null> {
  if (!buildingKey) return null
  const res = await $fetch<{ success: boolean; data: { mode: 'preserved'; canonicalPath: string | null } | { mode: 'keyed'; canonicalPath: null } }>(
    `${apiBase}/api/real-estate/canonical-url`,
    { query: { type, buildingKey }, timeout: 8000 },
  )
  if (res.data?.mode !== 'preserved') return null
  return isSafeRealEstatePath(res.data.canonicalPath) ? res.data.canonicalPath : null
}

async function canonicalPathForLegacyGroupedType(type: RealEstateUrlType): Promise<string | null> {
  const basePath = toRealEstateUrl({
    type,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
  })
  const resolved = await fetchPublicUrlResolution(basePath)
  if (resolved.mode !== 'preserved') return null
  return isSafeRealEstatePath(resolved.canonicalPath) ? resolved.canonicalPath : null
}

async function pathForTransactionTab(tab: TransactionMode): Promise<string | null> {
  const siblingType = `${routePropertyTypePart.value}-${tab}` as RealEstateUrlType
  if (isLegacyGroupedResolution()) {
    return canonicalPathForLegacyGroupedType(siblingType)
  }
  const buildingKey = activeBuildingKey()
  const canonicalPath = await canonicalPathForType(siblingType, buildingKey)
  if (publicUrlResolution.value?.mode === 'preserved' && !canonicalPath) {
    return null
  }
  return toRealEstateUrl({
    type: siblingType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
    buildingKey,
    canonicalPath,
  })
}

async function pushTransactionTab(tab: TransactionMode, query: Record<string, string> = {}): Promise<void> {
  let path: string | null = null
  try {
    path = await pathForTransactionTab(tab)
  } catch {
    fetchFailed.value = true
    return
  }
  if (!path) return
  await router.push({
    path,
    query,
  })
}
const fetchFailed = ref(false)   // SSR building-info 일시 실패 여부
const summary = ref<StatsSummary | null>(null)
const statsLoading = ref(true)
const txLoading = ref(true)
const facilitySummary = ref<string | null>(null)
// 요청 지역 ≠ 실제 건물 지역인데 301 목적지도 만들 수 없는 경우(= 합칠 곳이 없는 중복 문서).
// SSR 데이터가 도착하는 지점(아래 지역 통합 블록)에서 채운다. 선언이 noindex 위에 있어야
// 하는 이유는 바로 아래 watchEffect 가 즉시 noindex 를 평가하기 때문이다(위 TDZ 주석 참조).
const regionUnresolvable = ref(false)

// noindex 판정 (canonical 정책과 함께 사용) — .omc/notes/noindex-canonical-policy.md
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
    fetchFailed: fetchFailed.value,
  }) || regionUnresolvable.value,
)

// degraded(503) 또는 noindex(빈 건물) 페이지에선 광고 발화를 억제한다 (SSR·클라 네비 모두).
// useState 는 setup 문맥에서 한 번만 잡고, reactive watcher 안에서는 ref 값만 바꾼다.
// noindex 가 비동기 SSR 데이터 반영 뒤 true 로 바뀔 때 useState 를 다시 호출하면 Nuxt context 가 없어 500 이 날 수 있다.
const adsSuppressed = useState<boolean>('ads:suppressed', () => false)
watchEffect(() => {
  adsSuppressed.value = fetchFailed.value || noindex.value
})

const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')

// og:image 는 공용 빌더만 쓴다 (utils/ogImageUrl.ts).
// 종전 구현은 두 결함을 동시에 갖고 있었다.
//  - 좌표가 없으면 `/og?...` 를 발행했는데, 그 라우트는 sharp 미설치 환경(Cafe24)에서
//    항상 /og-image.png 로 302 한다 → 문서마다 고유한 영구 리다이렉트 URL 을 하나씩 발행.
//  - 좌표가 있으면 건물명을 label 과 title 에 두 번, 자르지 않고 실었다(한글 percent-encoding
//    3배 팽창). NCP 성공 경로는 title/city/district 를 읽지도 않는다.
function buildOgImage(info: BuildingInfo | null | undefined): string {
  if (!info) return DEFAULT_OG_IMAGE
  return buildOgMapImageUrl({
    lat: info.lat,
    lng: info.lng,
    label: buildingName.value,
    category: propertyTypeParam,
  })
}

const detailOverview = ref<DetailOverview | null>(null)

// 최근 매매는 새 overview.latestSale만 쓴다. rent URL에서도 전세/월세 금액으로 재해석하지 않는다.
const recentDealForDisplay = computed(() => resolveLatestSaleDeal(detailOverview.value))

const detailMeta = computed(() => {
  const mode = currentTab.value

  let areaRange: { min: number; max?: number } | null = null
  const minArea = Number(detailOverview.value?.minArea ?? buildingInfo.value?.minArea)
  const maxArea = Number(detailOverview.value?.maxArea ?? buildingInfo.value?.maxArea)
  if (Number.isFinite(minArea) && minArea > 0) {
    areaRange = Number.isFinite(maxArea) && maxArea > minArea ? { min: minArea, max: maxArea } : { min: minArea }
  }

  // 헤더와 동일 소스(overview.latestSale)에서만 최근 매매를 뽑는다 — table.items[0] 의존 제거.
  // 보증금 0(무보증 월세)도 거래다. amount 를 truthy 로 거르면 통째로 사라진다.
  const rd = recentDealForDisplay.value
  const recentDeal: { amount: number; dealDate: string; monthlyRent?: number | null } | undefined =
    currentTab.value === 'sale' && rd.amount != null && rd.dealDate
      ? { amount: rd.amount, dealDate: rd.dealDate, monthlyRent: rd.monthlyRent }
      : undefined
  const recentSale: { amount: number; dealDate: string } | undefined =
    currentTab.value === 'rent' && rd.amount != null && rd.amount > 0 && rd.dealDate
      ? { amount: rd.amount, dealDate: rd.dealDate }
      : undefined

  const totalCount = summary.value?.totalCount ?? 0
  const buildYearVal = buildingInfo.value?.buildYear ?? null

  return buildRealEstateDetailMeta({
    buildingName: buildingName.value,
    region: {
      city: buildingInfo.value?.city || cityName,
      district: buildingInfo.value?.district || districtName,
      dong: buildingInfo.value?.dongName ?? null,
    },
    propertyType: propertyTypeParam,
    transactionMode: mode,
    summary: summary.value ? { totalCount, recentDeal, recentSale } : null,
    buildYear: buildYearVal,
    areaRange,
    facilitySummary: facilitySummary.value,
  })
})

useHead(() => {
  const { title, description } = detailMeta.value

  // Canonical uses new URL structure — distinct per realEstateType (apt-sale ≠ apt-rent)
  const canonicalUrl = `${SITE_URL}${toRealEstateUrl({
    type: realEstateType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
    buildingKey: activeBuildingKey(),
    canonicalPath: activeCanonicalPath(),
  })}`

  // 치수는 실제로 만들어진 URL 에서 되읽는다. 예전엔 좌표 유무를 truthy 로 따로 판정했는데,
  // 빌더는 isMappableCoord(대한민국 범위)로 판정하므로 둘이 어긋날 수 있었다 —
  // 범위 밖 좌표면 빌더는 정적 PNG(1200x630)를 내놓는데 선언은 1024x536 이 된다.
  // 판정을 두 번 하지 않으면 어긋날 수도 없다(auctionHead.ts 와 같은 방식).
  const ogImage = buildOgImage(buildingInfo.value)
  const isOgMap = ogImage !== DEFAULT_OG_IMAGE
  const ogImageWidth = isOgMap ? String(OG_MAP_WIDTH) : '1200'
  const ogImageHeight = isOgMap ? String(OG_MAP_HEIGHT) : '630'

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:image:width', content: ogImageWidth },
    { property: 'og:image:height', content: ogImageHeight },
  ]
  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  } else if (fetchFailed.value) {
    meta.push({ name: 'robots', content: 'index, follow' })
  }
  // noindex-canonical-policy.md: noindex 페이지는 canonical 을 출력하지 않는다 (신호 충돌 방지)
  return {
    title,
    meta,
    ...(noindex.value ? {} : { link: [{ rel: 'canonical', href: canonicalUrl }] }),
  }
})

// ── Composables ───────────────────────────────────────────────────────────────

const { useRealEstate } = await import('~/composables/useRealEstate')
const { getBuildingInfo, getComplexList, getNearby } = useRealEstate()

const { setBuildingPlaceSchema, setBreadcrumbSchema, setRealEstateListingSchema, setDetailProvenance } = useStructuredData()

// Breadcrumb JSON-LD
const listUrl = toRealEstateListUrl({ type: realEstateType, city: cityName, district: districtName })
const typeHubPath = `/real-estate/${realEstateType}`
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, url: typeHubPath },
  { name: cityName, url: `/real-estate/${realEstateType}/${citySlugParam}` },
  { name: districtName, url: listUrl },
  {
    name: buildingName.value,
    url: toRealEstateUrl({
      type: realEstateType,
      city: cityName,
      district: districtName,
      buildingName: buildingName.value,
      buildingKey: activeBuildingKey(),
      canonicalPath: activeCanonicalPath(),
    }),
  },
])

// Breadcrumb 컴포넌트용 아이템
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, href: typeHubPath, current: false },
  { label: cityName, href: `/real-estate/${realEstateType}/${citySlugParam}`, current: false },
  { label: districtName, href: listUrl, current: false },
  { label: buildingName.value, current: true },
])

// ── Navigation helpers ────────────────────────────────────────────────────────

const kakaoMapUrl = computed(() =>
  `https://map.kakao.com/link/to/${encodeURIComponent(buildingName.value)},${buildingInfo.value?.lat},${buildingInfo.value?.lng}`)
const naverMapUrl = computed(() =>
  `https://map.naver.com/v5/directions/-/${buildingInfo.value?.lng},${buildingInfo.value?.lat},${encodeURIComponent(buildingName.value)}/-/walk`)

const isMapExpanded = ref(false)
const showNavDropdown = ref(false)

const { trackBuildingView, trackDirectionsClick, trackShareClick } = useAnalytics()

function openNavigation(url: string) {
  const provider = url.includes('kakao') ? 'kakao' : 'naver'
  trackDirectionsClick({ facilityId: buildingName.value, category: propertyTypeParam, provider })
  window.open(url, '_blank')
  showNavDropdown.value = false
}

async function handleShare() {
  const canShare = !!navigator.share
  trackShareClick({
    contentType: 'building',
    contentId: buildingName.value,
    method: canShare ? 'native' : 'clipboard',
  })

  const shareData = {
    title: buildingName.value,
    text: `${buildingName.value} ${propertyMeta.value?.label} 실거래가`,
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

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) {
    showNavDropdown.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// ── Sync status ───────────────────────────────────────────────────────────────

// Secondary fetches — sync-status를 secondary 패턴으로 통일 (Phase 2 spec 5.5).
// 현재는 단일 항목이지만 향후 확장성·시설 상세/홈과 일관성을 위해 동일 구조 채택.
const { data: secondaryResponse } = await useAsyncData(
  'real-estate-secondary',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [syncR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal }
      ),
    ])
    if (syncR.status === 'rejected') {
      console.warn('[real-estate-secondary] sync-status failed:', syncR.reason)
    }
    return {
      syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null,
    }
  },
  {
    lazy: true,
    default: () => ({ syncStatus: null as Record<string, string | null> | null }),
  }
)
const syncStatusKey = computed(() => apiSlug.value.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))
const lastSyncDate = computed(() => {
  const syncStatus = secondaryResponse.value?.syncStatus
  if (!syncStatus) return null
  return formatDotDate(syncStatus[syncStatusKey.value])
})
const rawSyncDate = computed(() => {
  const syncStatus = secondaryResponse.value?.syncStatus
  if (!syncStatus) return null
  return syncStatus[syncStatusKey.value] ?? null
})

// 시세 추이 각주용 기준월 — 최신 거래월(dealYmd)이 없으면 표기 생략
const txBasis = computed(() => {
  const info = buildingInfo.value
  if (!info?.latestDealYear || !info?.latestDealMonth) return null
  return `기준 ${info.latestDealYear}.${String(info.latestDealMonth).padStart(2, '0')}`
})

// ── Computed display values ───────────────────────────────────────────────────

type ReportedAddressItem = { key: string; display: string; searchQuery: string }

function rawAddressDetail(address: DetailOverview['addresses'][number]): string {
  const jibunDetail = [address.dongName, address.jibun].filter(Boolean).join(' ')
  if (address.roadName && jibunDetail) return `${address.roadName} (${jibunDetail})`
  return address.roadName || jibunDetail
}

function formatReportedAddress(address: DetailOverview['addresses'][number]): string {
  return `${cityName} ${districtName} ${rawAddressDetail(address)}`.trim()
}

function reportedAddressKey(address: DetailOverview['addresses'][number], index: number): string {
  return [address.roadName ?? '', address.dongName, address.jibun ?? '', index].join('|')
}

const fullAddress = computed(() => {
  if (!buildingInfo.value) return '-'
  const { city, district, roadName, dongName, jibun } = buildingInfo.value
  const detail = roadName || [dongName, jibun].filter(Boolean).join(' ')
  return `${city} ${district} ${detail}`.trim()
})

const reportedAddressItems = computed<ReportedAddressItem[]>(() => {
  const raw = detailOverview.value?.addresses ?? []
  const seen = new Set<string>()
  const items = raw.flatMap((address, index) => {
    const key = reportedAddressKey(address, index)
    const identityKey = [address.roadName ?? '', address.dongName, address.jibun ?? ''].join('|')
    if (seen.has(identityKey)) return []
    seen.add(identityKey)
    const display = formatReportedAddress(address)
    return display ? [{ key, display, searchQuery: display }] : []
  })
  if (items.length > 0) return items
  return fullAddress.value !== '-'
    ? [{ key: 'fallback', display: fullAddress.value, searchQuery: fullAddress.value }]
    : []
})

const reportedAddressCount = computed(() => reportedAddressItems.value.length)
const hasReportedAddressAmbiguity = computed(() =>
  !!detailOverview.value?.locationAmbiguous || reportedAddressCount.value > 1
)
const locationSectionSubtext = computed(() => {
  if (hasMapCoords.value) return '지도와 로드뷰로 건물 주변을 바로 확인할 수 있습니다.'
  if (hasReportedAddressAmbiguity.value) return '여러 주소가 보고되어 하나의 지도 위치를 선택하지 않습니다.'
  return '원본 자료에 좌표가 없어 지도를 표시하지 못합니다.'
})
const locationEmptyTitle = computed(() =>
  hasReportedAddressAmbiguity.value
    ? '주소가 여러 건이라 대표 위치를 표시하지 않습니다'
    : '지번 좌표가 실거래가 자료에 없습니다'
)
const locationEmptyDescription = computed(() =>
  hasReportedAddressAmbiguity.value
    ? `${buildingName.value}은 같은 건물명으로 여러 주소가 보고되어 하나의 대표 지도·로드뷰를 선택하지 않습니다. 주소 후보별 지도 검색으로 확인하세요.`
    : `${buildingName.value}의 좌표가 원본에 등록되지 않아 지도·로드뷰를 표시하지 못합니다. 주소로 직접 찾아보세요.`
)
const facilitySectionSubtext = computed(() => {
  if (hasMapCoords.value) return '부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다.'
  if (hasReportedAddressAmbiguity.value) return '대표 위치를 고르지 않아 반경 검색을 하지 않습니다.'
  return '좌표가 없어 반경 검색을 할 수 없습니다.'
})
const facilityEmptyTitle = computed(() =>
  hasReportedAddressAmbiguity.value
    ? '주소 후보별 지도 검색으로 확인하세요'
    : '반경 검색을 할 수 없습니다'
)
const facilityEmptyDescription = computed(() =>
  hasReportedAddressAmbiguity.value
    ? `${buildingName.value}은 여러 주소가 보고되어 대표 좌표 기반 주변 인프라 검색을 생략합니다. 주소 후보별 지도 검색으로 위치를 확인하거나 ${districtName} 전체 시설을 볼 수 있습니다.`
    : `${buildingName.value}의 좌표가 없어 주변 인프라를 반경으로 찾지 못합니다. ${districtName} 전체 시설은 지역 페이지에서 볼 수 있습니다.`
)

function shortAddressLabel(address: string): string {
  const prefix = `${cityName} ${districtName} `
  return address.startsWith(prefix) ? address.slice(prefix.length) : address
}

function kakaoAddressSearchUrl(address: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(address)}`
}

function naverAddressSearchUrl(address: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(address)}`
}

const buildingMarker = computed<FacilitySearchItem[]>(() => {
  if (!buildingInfo.value?.lat || !buildingInfo.value?.lng) return []
  return [{
    id: 'building',
    name: buildingInfo.value.buildingName,
    category: 'toilet' as const,
    address: fullAddress.value,
    roadAddress: null,
    lat: buildingInfo.value.lat,
    lng: buildingInfo.value.lng,
    city: buildingInfo.value.city,
    district: buildingInfo.value.district,
  }]
})

const areaRange = computed(() => {
  if (!buildingInfo.value) return '-'
  const { minArea, maxArea } = buildingInfo.value
  if (minArea === null && maxArea === null) return '-'
  if (minArea === maxArea) return `${minArea}㎡`
  return `${minArea ?? '?'}~${maxArea ?? '?'}㎡`
})

const latestSaleAmountLabel = computed(() => {
  const sale = detailOverview.value?.latestSale
  return sale?.amount != null && sale.amount > 0 ? formatKoreanPrice(sale.amount) : EMPTY_FIELD_TEXT
})

const latestSaleDetailLine = computed(() => {
  const sale = detailOverview.value?.latestSale
  if (!sale) return '최근 매매 신고 내역 없음'
  const parts: string[] = []
  if (sale.area) parts.push(`전용 ${sale.area}㎡`)
  if (sale.floor !== null && sale.floor !== undefined) parts.push(`${sale.floor}층`)
  const month = String(sale.month).padStart(2, '0')
  const day = sale.day == null ? null : String(sale.day).padStart(2, '0')
  parts.push(`${String(sale.year).slice(2)}.${month}${day ? `.${day}` : ''} 계약`)
  return parts.join(' · ')
})

const overviewBuildYearLabel = computed(() => {
  const year = detailOverview.value?.buildYear ?? buildingInfo.value?.buildYear
  return year ? `${year}년` : EMPTY_FIELD_TEXT
})

const overviewAreaRangeLabel = computed(() => {
  const minArea = detailOverview.value?.minArea ?? null
  const maxArea = detailOverview.value?.maxArea ?? null
  if (!minArea && !maxArea) return areaRange.value !== '-' ? areaRange.value.replace('~', '–') : EMPTY_FIELD_TEXT
  if (minArea && maxArea && minArea !== maxArea) return `${minArea}–${maxArea}㎡`
  return `${minArea ?? maxArea}㎡`
})

const overviewSaleCount6mLabel = computed(() => {
  const count = detailOverview.value?.saleCount6m
  return Number.isFinite(count) ? `${Number(count).toLocaleString()}건` : EMPTY_FIELD_TEXT
})

// 머리 요약 줄 — 최근 매매를 강조하고 날짜·면적·층을 보조 줄로 단다
const estateSummaryItems = computed<SummaryItem[]>(() => [
  { label: '최근 매매', value: latestSaleAmountLabel.value, note: latestSaleDetailLine.value },
  { label: '건축연도', value: overviewBuildYearLabel.value },
  { label: '거래된 전용면적', value: overviewAreaRangeLabel.value },
  { label: '6개월 매매 · 전체 면적', value: overviewSaleCount6mLabel.value },
])


const rentRatioTotal = computed(
  () => (buildingInfo.value?.jeonseCount ?? 0) + (buildingInfo.value?.wolseCount ?? 0),
)
// ── Exact detail snapshot display ─────────────────────────────────────────────

const selectedRentType = computed<'jeonse' | 'wolse'>(() =>
  snapshot.value?.filters.mode === 'wolse' ? 'wolse' : 'jeonse',
)

const exactAmounts = computed(() => snapshot.value?.points.map(point => point.amount) ?? [])

const exactAverage = computed(() => {
  if (exactAmounts.value.length === 0) return null
  return exactAmounts.value.reduce((sum, amount) => sum + amount, 0) / exactAmounts.value.length
})

const periodTradeLabel = computed(() => {
  const months = snapshot.value?.filters.months ?? 0
  if (months === 0) return '전체 기간 거래'
  if (months === 6) return '최근 6개월 거래'
  if (months === 12) return '최근 1년 거래'
  return '최근 3년 거래'
})

const periodTradeCount = computed(() => (snapshot.value?.points.length ?? 0).toLocaleString())

const periodPriceExtremes = computed(() => {
  if (exactAmounts.value.length === 0) return { maxPrice: null, minPrice: null }
  return {
    maxPrice: Math.max(...exactAmounts.value),
    minPrice: Math.min(...exactAmounts.value),
  }
})

const periodMaxPriceLabel = computed(() => {
  const price = periodPriceExtremes.value.maxPrice
  return price ? formatKoreanPrice(price) : '-'
})

const periodMinPriceLabel = computed(() => {
  const price = periodPriceExtremes.value.minPrice
  return price ? formatKoreanPrice(price) : '-'
})

const trustedOverviewLocation = computed(() => {
  const value = detailOverview.value
  if (!value?.location || value.locationAmbiguous || overviewError.value) return null
  return value.location
})

/** 좌표·인근단지 결측 판정 — 섹션을 숨기는 대신 빈 상태로 렌더할지 가른다. */
const hasMapCoords = computed(() =>
  !!trustedOverviewLocation.value
  && !!(buildingInfo.value?.lat && buildingInfo.value?.lng),
)

// 좌표가 없을 때의 대안 — 길찾기(좌표 필요) 대신 주소 검색으로 보낸다.
const kakaoSearchUrl = computed(() => kakaoAddressSearchUrl(fullAddress.value))
const naverSearchUrl = computed(() => naverAddressSearchUrl(fullAddress.value))

// ── bjdCode resolution ────────────────────────────────────────────────────────
// Resolve bjdCode from complex list before initial data load

const resolvedBjdCode = ref('')

async function resolveBuildingContext(): Promise<{ bjdCode: string; building: BuildingInfo | null }> {
  if (resolvedBjdCode.value) {
    return { bjdCode: resolvedBjdCode.value, building: buildingInfo.value }
  }

  const buildingKey = activeBuildingKey()
  if (buildingKey) {
    const keyedBuilding = await getBuildingInfo(
      apiSlug.value,
      '',
      buildingName.value,
      buildingKey,
    )
    return {
      bjdCode: keyedBuilding?.bjdCode ?? '',
      building: keyedBuilding,
    }
  }

  if (publicUrlResolution.value?.mode === 'preserved' && publicUrlResolution.value.legacyGrouped) {
    return {
      bjdCode: publicUrlResolution.value.bjdCode,
      building: null,
    }
  }

  // getComplexList: HTTP 에러(일시 장애)면 throw되어 상위 로더가 잡는다. 빈 목록은 정상 통과.
  const listResult = await getComplexList(apiSlug.value, cityName, districtName, buildingName.value, 1, 1)
  const candidate = listResult.items[0]
  if (candidate?.bjdCode) {
    return { bjdCode: candidate.bjdCode, building: null }
  }

  // fallback: getBuildingInfo는 404→null(없는 건물), 일시 장애→throw.
  const fallbackBuilding = await getBuildingInfo(apiSlug.value, '', buildingName.value)
  if (fallbackBuilding?.bjdCode) {
    return { bjdCode: fallbackBuilding.bjdCode, building: fallbackBuilding }
  }

  return { bjdCode: '', building: null }
}

// 주변 생활시설 요약에 쓰는 카테고리와 라벨.
// 배열 순서 = 문구에 노출되는 우선순위(개수순이 아니다). 앞에서부터 개수 > 0 인 두 개만 쓴다.
const FACILITY_SUMMARY_CATS = ['school', 'hospital', 'park', 'childcare', 'sports', 'pharmacy'] as const
const FACILITY_SUMMARY_LABELS: Record<(typeof FACILITY_SUMMARY_CATS)[number], string> = {
  school: '학교', hospital: '병원', park: '공원', childcare: '어린이집', sports: '체육시설', pharmacy: '약국',
}

// ── SSR initial data load ─────────────────────────────────────────────────────

const detailPayloadKey = `re-detail-new-${realEstateType}-${publicUrlPath}`
const { data: ssrData, error: ssrError, status: ssrStatus } = await useAsyncData(
  detailPayloadKey,
  async () => {
    let infoFetchFailed = false
    let bjdCode = ''
    let primedBuilding: BuildingInfo | null = null
    try {
      const ctx = await resolveBuildingContext()
      bjdCode = ctx.bjdCode
      primedBuilding = ctx.building
    } catch {
      infoFetchFailed = true   // bjdCode 해석 단계의 일시 장애
    }

    const [infoResult] = await Promise.allSettled([
      primedBuilding
        ? Promise.resolve(primedBuilding)
        : getBuildingInfo(apiSlug.value, bjdCode, buildingName.value, activeBuildingKey()),
    ])
    const resolvedBuildingInfo = infoResult.status === 'fulfilled' ? infoResult.value : null
    if (infoResult.status === 'rejected') infoFetchFailed = true
    // 좌표 기반 생활시설 요약은 overview.location 이 확정된 뒤 별도 useAsyncData에서 읽는다.
    // buildingInfo 좌표만으로 SSR에서 먼저 호출하면 동명이인/위치 모호 건물에서도 반경 요청이 나간다.
    // 인근 단지 — SSR best-effort. 내부링크·SEO 보조이므로 실패/지연이 페이지·noindex에 영향 X.
    // (Yeti는 client-only JS를 못 봐 기존엔 SSR HTML에 인근 섹션이 비어 나갔다)
    let nearbySSR = { nearby: { apt: [], villa: [], offitel: [] } as NearbyResponse, loaded: false }
    if (bjdCode) {
      const nearbyMode = currentTab.value
      // The exact-detail snapshot is initialized after this SSR loader. Rent pages start
      // in the jeonse detail mode, then client/server hydration can refine nearby links
      // from the serialized snapshot without reading that snapshot before declaration.
      const nearbyRentType: 'jeonse' | undefined = nearbyMode === 'rent' ? 'jeonse' : undefined
      nearbySSR = await fetchNearbyForSsr(() => getNearby(bjdCode, nearbyMode, {
        rentType: nearbyRentType,
        dongName: resolvedBuildingInfo?.dongName,
        excludeBuildingName: buildingName.value,
        limitPerType: 4,
      }))
    }
    return {
      bjdCode,
      statsResponse: { monthly: [], summary: null },
      transactions: { items: [], total: 0, page: 1, totalPages: 0 },
      buildingInfo: resolvedBuildingInfo,
      areaGroups: [],
      facilitySummary: null,
      nearby: nearbySSR.nearby,
      nearbyLoaded: nearbySSR.loaded,
      infoFetchFailed,
    }
  },
)
// 판정 근거·회귀 배경은 utils/detailSsrDegraded.ts 주석 참조.
// 핵심: infoFetchFailed 는 핸들러 "반환값 안에" 있으므로, 핸들러가 통째로 throw 하면
// ssrData 가 null 이라 옵셔널 체이닝이 undefined 를 내고 가드가 통과됐다.
if (import.meta.server && isDetailSsrDegraded({
  hasError: !!ssrError.value,
  hasData: !!ssrData.value,
  explicitFailure: ssrData.value?.infoFetchFailed,
})) {
  fetchFailed.value = true
  markDegradedResponse()
}

// building-info의 확정 404만 null로 반환된다. 일시 장애나 누락된 SSR 응답은 부재 근거가 아니다.
// useAsyncData 밖에서 던져야 Nuxt가 실제 HTTP 404를 반환한다.
if (!ssrError.value
  && ssrData.value?.infoFetchFailed === false
  && ssrData.value?.buildingInfo === null) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// ── 지역 불일치 문서 통합 (301) ───────────────────────────────────────────────
//
// 배경·프로덕션 실측(2026-09-04)은 utils/realEstateRegion.ts 상단 주석 참조. 요약하면
// 백엔드 getBuildingInfo 가 요청 지역에 그 이름의 건물이 없을 때 buildingName 만으로 전국에서
// bjdCode 를 재해석해, /villa-sale/{seoul/gangnam, busan/haeundae, daegu/suseong}/현대 세 URL 이
// 전부 200·index·self-canonical 로 "제주 서귀포시 현대" 문서를 렌더하고 있었다. 흔한 건물명
// 하나가 (구·군 250 × 타입 6) 만큼 동일 문서를 발행한 셈이고, 이게 중복 title 22.5만 건의 주범이다.
//
// 이미 색인된 URL 을 404 로 죽이지 않는다. 실제 지역 URL 로 301 해 한 문서로 합친다.
// 헬퍼가 루프(목적지 == 현재 경로)와 slug 로 못 되돌리는 지역을 이미 null 로 걸러주므로,
// null 이면 오늘 동작 그대로 통과시킨다.
//
// fail-open: SSR 이 일시 실패(fetchFailed)면 지역 판정 근거가 없으므로 301 도, noindex 도 하지 않는다.
const regionSourceInfo = ssrData.value?.buildingInfo as (BuildingInfo & { regionMatched?: boolean }) | null | undefined
// regionMatched 는 백엔드가 새로 실은 선택 필드(공유 타입 파일은 이 작업 범위 밖이라 지역 확장으로 읽는다).
if (regionSourceInfo && !fetchFailed.value) {
  const redirectPath = resolveRegionRedirectPath({
    type: realEstateType,
    buildingName: buildingName.value,
    buildingKey: activeBuildingKey(),
    canonicalPath: activeCanonicalPath(),
    actualCity: regionSourceInfo.city,
    actualDistrict: regionSourceInfo.district,
    requestedCitySlug: citySlugParam,
    requestedDistrictSlug: districtSlugParam,
    currentPath: route.path,
  })

  if (import.meta.server && redirectPath) {
    await navigateTo(redirectPath, { redirectCode: 301 })
  }

  // 301 을 만들 수 없는 불일치는 색인에서 뺀다. 그대로 두면 self-canonical 중복 문서가 계속 색인된다.
  //
  // 실제 지역명을 slug 로 되돌릴 수 있으면 isRegionMismatch 가 정확한 판정이다. 되돌릴 수 없으면
  // (매핑에 없는 지역명) isRegionMismatch 는 "근거 없음"으로 false 를 주므로, 그때만 백엔드
  // regionMatched=false 를 증거로 쓴다.
  // ⚠️ 두 신호를 그냥 OR 하지 않는 이유: 백엔드의 regionMatched 는 법정동코드 앞 5자리(시군구)
  // 비교라 "URL slug 기준으로 맞는가"를 답하지 못한다. slug 를 읽을 수 있을 때는 slug 비교가
  // 더 정확한 판정이므로 그쪽을 쓰고, 읽을 수 없을 때만 백엔드 신호로 내려간다.
  const regionSlugsResolvable = !!resolveCitySlugStrict(regionSourceInfo.city)
    && !!resolveDistrictSlugStrict(regionSourceInfo.district)
  const mismatched = isRegionMismatch({
    requestedCitySlug: citySlugParam,
    requestedDistrictSlug: districtSlugParam,
    actualCity: regionSourceInfo.city,
    actualDistrict: regionSourceInfo.district,
  }) || (!regionSlugsResolvable && regionSourceInfo.regionMatched === false)
  regionUnresolvable.value = mismatched && !redirectPath
}

const ssrLoading = computed(() => ssrStatus.value === 'pending')

watch(ssrData, (data) => {
  if (!data) return
  resolvedBjdCode.value = data.bjdCode || data.buildingInfo?.bjdCode || ''
  buildingInfo.value = data.buildingInfo as BuildingInfo | null
  facilitySummary.value = data.facilitySummary ?? null
  statsLoading.value = false
  txLoading.value = false
  fetchFailed.value = data.infoFetchFailed ?? false
}, { immediate: true })

const detailContext = computed(() => ({
  type: routeRealEstateType.value as RealEstateType,
  bjdCode: resolvedBjdCode.value,
  buildingName: buildingName.value,
  buildingKey: activeBuildingKey(),
  initialMode: initialDetailMode.value,
}))

function validateInitialDetailMode(type: RealEstateType, rawMode: unknown): DealMode | undefined {
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode
  if (typeof mode !== 'string') return undefined
  if (type.endsWith('-sale')) return mode === 'sale' ? 'sale' : undefined
  if (mode === 'jeonse' || mode === 'wolse') return mode
  return undefined
}

const initialDetailMode = computed(() =>
  validateInitialDetailMode(routeRealEstateType.value as RealEstateType, route.query.mode)
)

const {
  overview,
  snapshot,
  table,
  pending,
  tablePending,
  error,
  overviewError,
  tableError,
  announcement,
  setFilters,
  goToPage,
  refresh,
  refreshOverview,
} = await useRealEstateDetail(detailContext)

async function resetDetailFiltersForRoute() {
  await setFilters({
    mode: initialDetailMode.value ?? (currentTab.value === 'sale' ? 'sale' : 'jeonse'),
    months: 0,
    area: undefined,
    deposit: undefined,
  })
}

if (import.meta.client) {
  let disposedBeforeInitialDetailFallback = false
  let initialDetailFallbackFrame: number | undefined

  onMounted(() => {
    if (snapshot.value) return
    initialDetailFallbackFrame = requestAnimationFrame(() => {
      if (disposedBeforeInitialDetailFallback || snapshot.value) return
      void resetDetailFiltersForRoute()
    })
  })

  onBeforeUnmount(() => {
    disposedBeforeInitialDetailFallback = true
    if (initialDetailFallbackFrame != null) {
      cancelAnimationFrame(initialDetailFallbackFrame)
    }
  })

  watch(
    [
      () => routeRealEstateType.value,
      () => initialDetailMode.value,
      () => activeBuildingKey(),
    ],
    resetDetailFiltersForRoute
  )
}

function applyOverview(overviewValue: DetailOverview | null): void {
  detailOverview.value = overviewValue
  if (!overviewValue) return

  const primaryAddress = overviewValue.addresses[0]
  const lat = overviewValue.locationAmbiguous ? null : overviewValue.location?.lat ?? null
  const lng = overviewValue.locationAmbiguous ? null : overviewValue.location?.lng ?? null
  const latestSale = overviewValue.latestSale
  const existing = buildingInfo.value

  buildingInfo.value = {
    buildingKey: overviewValue.identity.buildingKey ?? existing?.buildingKey,
    canonicalPath: existing?.canonicalPath ?? activeCanonicalPath(),
    bjdCode: overviewValue.identity.bjdCode || existing?.bjdCode || resolvedBjdCode.value,
    buildingName: overviewValue.identity.buildingName || existing?.buildingName || buildingName.value,
    city: existing?.city || cityName,
    district: existing?.district || districtName,
    dongName: primaryAddress?.dongName ?? existing?.dongName ?? null,
    roadName: primaryAddress?.roadName ?? existing?.roadName ?? null,
    jibun: primaryAddress?.jibun ?? existing?.jibun ?? null,
    buildYear: overviewValue.buildYear ?? existing?.buildYear ?? null,
    minArea: overviewValue.minArea != null ? Number(overviewValue.minArea) : existing?.minArea ?? null,
    maxArea: overviewValue.maxArea != null ? Number(overviewValue.maxArea) : existing?.maxArea ?? null,
    latestDealAmount: latestSale?.amount ?? existing?.latestDealAmount ?? null,
    latestMonthlyRent: null,
    latestDealYear: latestSale?.year ?? existing?.latestDealYear ?? null,
    latestDealMonth: latestSale?.month ?? existing?.latestDealMonth ?? null,
    lat,
    lng,
    jeonseCount: existing?.jeonseCount,
    wolseCount: existing?.wolseCount,
  }
  if (overviewValue.locationAmbiguous) {
    facilitySummary.value = null
  }
}

applyOverview(overview.value)

function overviewLocationKey(location: { lat: number; lng: number } | null): string | null {
  return location ? `${location.lat}:${location.lng}` : null
}

async function loadOverviewFacilitySummaryForLocation(location: { lat: number; lng: number }): Promise<string | null> {
  try {
    const countsRes = await $fetch<{
      data: { radius: number; counts: Record<string, { count: number; exact: boolean }> }
    }>(`${apiBase}/api/facilities/nearby-counts`, {
      query: {
        lat: location.lat,
        lng: location.lng,
        radius: 300,
        categories: FACILITY_SUMMARY_CATS.join(','),
      },
    })
    const counts = countsRes?.data?.counts ?? {}
    const parts = FACILITY_SUMMARY_CATS
      .map(cat => ({ cat, entry: counts[cat] }))
      .filter(({ entry }) => (entry?.count ?? 0) > 0)
      .slice(0, 2)
      .map(({ cat, entry }) =>
        `${FACILITY_SUMMARY_LABELS[cat]} ${entry!.count}곳${entry!.exact ? '' : ' 이상'}`)
    return parts.length > 0 ? parts.join('·') : null
  } catch {
    return null
  }
}

async function loadOverviewFacilitySummary(): Promise<string | null> {
  const location = trustedOverviewLocation.value
  if (!location) return null
  return await loadOverviewFacilitySummaryForLocation(location)
}

let facilitySummaryGeneration = 0

async function refreshOverviewFacilitySummary(): Promise<void> {
  const generation = ++facilitySummaryGeneration
  const location = trustedOverviewLocation.value
  const locationKey = overviewLocationKey(location)
  if (!location || !locationKey) {
    facilitySummary.value = null
    return
  }
  const value = await loadOverviewFacilitySummaryForLocation(location)
  if (generation === facilitySummaryGeneration
    && overviewLocationKey(trustedOverviewLocation.value) === locationKey) {
    facilitySummary.value = value
  }
}

watch(overview, (value) => {
  applyOverview(value)
  void refreshOverviewFacilitySummary()
}, { deep: true })

onBeforeUnmount(() => {
  facilitySummaryGeneration++
})

const { data: overviewFacilitySummary } = await useAsyncData(
  `re-detail-overview-facility-summary-${realEstateType}-${citySlugParam}-${districtSlugParam}-${route.params.buildingName}${activeBuildingKey() ? `-${activeBuildingKey()}` : ''}`,
  loadOverviewFacilitySummary,
)

watch(overviewFacilitySummary, (value) => {
  if (facilitySummaryGeneration === 0) {
    facilitySummary.value = value ?? null
  }
}, { immediate: true })

watch(snapshot, (value) => {
  const totalCount = value?.table.total ?? 0
  summary.value = {
    recentAvg: exactAverage.value,
    previousAvg: null,
    changeRate: null,
    totalCount,
    lowVolume: totalCount > 0 && totalCount < 3,
    priceLabel: value?.filters.mode === 'wolse' ? '월세' : value?.filters.mode === 'jeonse' ? '전세가' : '매매가',
  }
  statsLoading.value = false
  txLoading.value = false
}, { immediate: true, deep: true })

type FilterPatch = Partial<Pick<DetailQuery, 'mode' | 'months' | 'area' | 'deposit'>>

const lastRequestedTablePage = ref<number | null>(null)

async function handleExactFilterPatch(patch: FilterPatch): Promise<void> {
  if (patch.mode) {
    const nextTab: TransactionMode = patch.mode === 'sale' ? 'sale' : 'rent'
    if (nextTab !== currentTab.value) {
      await pushTransactionTab(nextTab, nextTab === 'rent' ? { mode: patch.mode } : {})
      // 다른 탭 URL 로 이동하는 동안 같은 컴포넌트가 재사용될 수 있다.
      // 이전 route/context 로 즉시 setFilters 를 호출하면 legacy grouped 상세에서
      // 새 rent API 를 buildingKey 없이 요청할 수 있으므로, 새 route watcher 에 refetch 를 맡긴다.
      return
    }
  }
  await setFilters(patch)
}

async function goToExactPage(page: number): Promise<void> {
  lastRequestedTablePage.value = page
  await goToPage(page)
}

async function retryExactPage(): Promise<void> {
  await goToExactPage(lastRequestedTablePage.value ?? table.value.page)
}

// ── Structured data + analytics ───────────────────────────────────────────────

// JSON-LD 스키마를 SSR-safe 경로로 등록 — buildingInfo lazy-load 전에도 route 파라미터로 유추 가능한
// 필드는 이미 들어가 있으며, buildingInfo 가 도착하면 useHead 가 reactive 하게 새 스키마로 교체된다.
setBuildingPlaceSchema(() => ({
  name: buildingName.value,
  address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
  city: buildingInfo.value?.city || cityName,
  district: buildingInfo.value?.district || districtName,
  lat: buildingInfo.value?.lat ?? null,
  lng: buildingInfo.value?.lng ?? null,
  buildYear: buildingInfo.value?.buildYear,
  propertyType: propertyMeta.value?.label || '',
  propertySlug: propertyTypePart as 'apt' | 'villa' | 'offitel',
  image: buildOgImage(buildingInfo.value),
}))
setRealEstateListingSchema(() => {
  const info = buildingInfo.value
  const latestDealDate = info?.latestDealYear && info?.latestDealMonth
    ? `${info.latestDealYear}-${String(info.latestDealMonth).padStart(2, '0')}-01`
    : undefined
  return {
    name: buildingName.value,
    address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
    city: info?.city || cityName,
    district: info?.district || districtName,
    propertyType: propertyMeta.value?.label || '',
    url: `${SITE_URL}${toRealEstateUrl({
      type: realEstateType,
      city: cityName,
      district: districtName,
      buildingName: buildingName.value,
      buildingKey: activeBuildingKey(),
      canonicalPath: activeCanonicalPath(),
    })}`,
    buildYear: info?.buildYear,
    totalCount: summary.value?.totalCount,
    lat: info?.lat ?? null,
    lng: info?.lng ?? null,
    image: buildOgImage(info),
    // summary.recentAvg는 만원 단위 — schema.org offers.price는 KRW(원) 이므로 10_000 곱해 전달
    recentAvg: summary.value?.recentAvg != null ? summary.value.recentAvg * 10_000 : undefined,
    latestDealDate,
  }
})
watchEffect(() => {
  setDetailProvenance({
    domain: 'real-estate',
    path: route.path,
    description: detailMeta.value.description,
    updatedAt: rawSyncDate.value,
    noindex: noindex.value,
  })
})

// building_viewed analytics 는 클라이언트에서 buildingInfo 로드 후만 발화
watch(() => buildingInfo.value, (info) => {
  if (info) {
    trackBuildingView({
      propertyType: propertyTypeParam,
      buildingName: buildingName.value,
      city: info.city,
      district: info.district,
    })
  }
})

// ── Nearby complexes ──────────────────────────────────────────────────────────

function nearbyHeading(propertyType: 'apt' | 'villa' | 'offitel'): string {
  const label = propertyType === 'apt' ? '아파트' : propertyType === 'villa' ? '빌라' : '오피스텔'
  if (currentTab.value === 'sale') return `주변 ${label} 매매가`
  if (selectedRentType.value === 'jeonse') return `주변 ${label} 전세가`
  if (selectedRentType.value === 'wolse') return `주변 ${label} 월세가`
  return `주변 ${label} 전월세`
}

// Reuse successful SSR data (including empty results); retry failed/missing SSR once.
const { nearby: nearbyByType } = useNearbyComplexes(
  computed(() => ({
    bjdCode: resolvedBjdCode.value,
    mode: currentTab.value,
    rentType: currentTab.value === 'rent' ? selectedRentType.value : undefined,
    dongName: buildingInfo.value?.dongName,
    excludeBuildingName: buildingName.value,
    limitPerType: 4,
  })),
  getNearby,
  ssrData.value?.nearbyLoaded ? ssrData.value.nearby : undefined,
)

const hasNearby = computed(() =>
  nearbyByType.value.apt.length > 0
  || nearbyByType.value.offitel.length > 0
  || nearbyByType.value.villa.length > 0)

// noindex / robots 는 상단 useHead 팩토리에서 canonical 과 함께 처리한다
// (.omc/notes/noindex-canonical-policy.md).
</script>

<style scoped>
.estate-record-note {
  margin: 8px 0 16px;
  max-width: 36ch;
  color: rgb(var(--faint-rgb));
  font-size: 12px;
  line-height: 1.7;
}

.estate-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #fed7aa;
  background: #fff7ed;
  padding: 12px 14px;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.6;
}

.estate-inline-error button {
  min-height: 36px;
  flex-shrink: 0;
  border: 1px solid #fdba74;
  border-radius: 8px;
  background: rgb(var(--surface-rgb));
  padding: 6px 10px;
  color: #9a3412;
  font-size: 12px;
  font-weight: 700;
}

.estate-data-caveat {
  margin-top: 6px;
  color: rgb(var(--faint-rgb));
  font-size: 12px;
  line-height: 1.6;
}

.estate-section-nav {
  display: flex;
  gap: 22px;
  overflow-x: auto;
  border-top: 1px solid rgb(var(--border-rgb));
  padding-top: 14px;
  color: rgb(var(--faint-rgb));
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.estate-section-nav a:first-child {
  color: rgb(var(--brand-rgb));
}

.estate-ad-slot {
  margin: 18px 0;
}

.estate-exact-filters {
  margin-bottom: 22px;
}

.estate-chart-shell {
  display: grid;
  gap: 18px;
}

.estate-chart-summary {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid rgb(var(--border-rgb));
  padding-top: 18px;
}

.estate-chart-summary span {
  color: rgb(var(--faint-rgb));
  font-size: 12px;
}

.estate-chart-summary strong {
  display: block;
  margin-top: 3px;
  color: rgb(var(--ink-rgb));
  font-size: 19px;
  font-weight: 650;
}

.estate-empty {
  background: rgb(var(--paper-rgb));
  padding: 30px;
  text-align: center;
  color: rgb(var(--faint-rgb));
}

@media (min-width: 768px) {
  .estate-record-note {
    margin-bottom: 24px;
    max-width: none;
    font-size: 13px;
  }

  .estate-section-nav {
    gap: 28px;
    padding-top: 16px;
  }

  .estate-ad-slot {
    margin: 22px 0;
  }

  .estate-ad-slot--first {
    min-height: 280px;
  }

  .estate-chart-shell {
    grid-template-columns: minmax(0, 1fr) 200px;
    gap: 36px;
  }

  .estate-chart-summary {
    display: block;
    border-top: 0;
    border-left: 1px solid rgb(var(--border-rgb));
    padding: 8px 0 0 26px;
  }

  .estate-chart-summary > div {
    margin-bottom: 24px;
  }

  .estate-chart-summary span {
    font-size: 13px;
  }

  .estate-chart-summary strong {
    font-size: 23px;
  }
}

.roadview-wrapper :deep(> div) {
  height: 100% !important;
}
.roadview-wrapper :deep(> div > div) {
  height: 100% !important;
}
</style>
