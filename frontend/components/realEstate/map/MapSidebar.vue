<template>
  <div class="flex flex-col h-full overflow-y-auto bg-white">
    <div class="px-4 py-3 border-b border-line sticky top-0 bg-white z-10">
      <p class="text-sm font-semibold text-slate-900">{{ heading }}</p>
      <p v-if="showCountNote" class="text-xs text-slate-600 mt-0.5">
        이 영역에 {{ props.total.toLocaleString('ko-KR') }}곳 — 상위 {{ visibleRows.length.toLocaleString('ko-KR') }}곳 표시
      </p>
    </div>

    <ul class="flex-1">
      <template v-for="(row, idx) in visibleRows" :key="row.key">
        <li
          data-testid="map-sidebar-item"
          class="border-b border-line-2"
          @mouseenter="emit('hover', row.key)"
          @mouseleave="emit('hover', null)"
        >
          <NuxtLink
            v-if="props.granularity === 'building'"
            :to="row.href ?? undefined"
            class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background-light transition-colors"
            @click="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span v-if="row.isRent" class="text-right whitespace-nowrap leading-tight">
              <span
                class="block text-sm"
                :class="row.jeonse != null ? 'font-semibold text-primary' : 'text-slate-400'"
              >
                <span class="text-[11px] font-medium text-slate-500 mr-1">전세</span>{{ row.jeonse ?? '거래 없음' }}
              </span>
              <span class="block text-xs text-slate-700">
                <span class="text-[11px] font-medium text-slate-500 mr-1">월세</span>{{ row.wolse ?? '거래 없음' }}
              </span>
            </span>
            <span v-else class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </NuxtLink>
          <!--
            city/district 행은 허브 페이지로 떠나지 않고 지도를 드릴다운해야 한다(select
            emit → RealEstateMapExplorer.onSelect 가 center+level 을 세팅). 그래도 href 는
            SSR HTML 에 반드시 남아야 한다 — 이 16개 시/도 링크가 이 페이지의 핵심 크롤
            가능 콘텐츠다. NuxtLink 안에서 preventDefault 하지 않는 이유: RouterLink 자체
            핸들러와의 등록 순서에 기대게 되어 안전하지 않다 — 대신 일반 a + click.exact.prevent
            로 가로챈다(MapFilterBar 와 동일 패턴). .exact 라서 ⌘/Ctrl+클릭 등 수정키 클릭은
            가로채지 않고 브라우저 기본 동작(새 탭 열기)이 그대로 통과한다.
          -->
          <a
            v-else-if="row.href"
            :href="row.href"
            class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background-light transition-colors"
            @click.exact.prevent="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </a>
          <!--
            동 행. 6종 유형에 동 라우트가 없어(land 만 있다) 갈 페이지가 없으므로
            링크가 아니라 버튼이다 — href 를 만들면 죽은 링크가 되고 크롤러가
            존재하지 않는 URL 을 따라간다. 클릭은 지도를 그 동으로 확대한다.
          -->
          <button
            v-else
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background-light transition-colors"
            @click="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </button>
        </li>
        <li
          v-if="idx === AD_AFTER_INDEX && props.showAd"
          data-testid="map-sidebar-ad"
          class="border-b border-line-2 p-2"
        >
          <AdBanner />
        </li>
      </template>
      <li v-if="hasMore" class="p-3">
        <button
          type="button"
          data-testid="map-sidebar-more"
          class="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-line bg-white text-sm font-medium text-slate-700 hover:bg-background-light transition-colors"
          @click="showMore"
        >
          더보기
        </button>
      </li>
    </ul>
    <!--
      전역 푸터는 layouts/map.vue 에 없다(페이지 스크롤을 0으로 만들기 위해). 대신 여기
      목록 하단에 둬 사이드바 스크롤 끝에서 도달하게 한다. 목록이 짧으면 위 ul 의 flex-1 이
      밀어내 컨테이너 바닥에 붙는다.
    -->
    <AppFooter v-if="props.showFooter" compact />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isBuildingItem, type Granularity, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'
import { formatPriceLabel, formatPyeongLabel, getRentDisplay } from '~/composables/useMapOverlays'
import { itemKey } from '~/composables/useRealEstateMap'
import { SIDO_CHIPS } from '~/utils/regionChips'
import { toRealEstateUrl, toRealEstateListUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { CITY_SLUG_MAP } from '~/shared/regionSlugs'
import AdBanner from '~/components/ads/AdBanner.vue'
import AppFooter from '~/components/common/AppFooter.vue'

const AD_AFTER_INDEX = 4 // 5번째 항목 뒤

const props = withDefaults(defineProps<{
  items: MapItem[]
  granularity: Granularity
  total: number
  exact: boolean
  pending: boolean
  type: string
  /**
   * 이 사이드바 사본에 인피드 광고를 렌더할지. 데스크톱(aside)과 모바일(바텀시트)에
   * 같은 MapSidebar 가 항상 둘 다 마운트되므로(하나는 CSS 로만 숨김), 기본값 true 로 두면
   * 두 사본이 동시에 AdBanner 를 마운트해 adsbygoogle.push() 를 중복 호출한다.
   * 호출부(RealEstateMapExplorer)가 실제 보이는 뷰포트 한쪽에만 true 를 넘겨야 한다.
   */
  showAd?: boolean
  /**
   * 이 사본에 푸터를 렌더할지. showAd 와 같은 이유로 게이트가 필요하다 — 두 사본이
   * 동시에 마운트되므로 그냥 두면 링크 8개와 data-testid="footer-links" 가 2벌 생긴다.
   *
   * 기본값은 false 다. showAd 처럼 true 로 두면 게이트를 잊은 호출부에서 조용히 2벌이 된다.
   */
  showFooter?: boolean
}>(), {
  showAd: true,
  showFooter: false,
})

const emit = defineEmits<{ hover: [string | null]; select: [MapItem] }>()

const heading = computed(() => {
  if (props.granularity === 'building') return '이 지역 건물'
  if (props.granularity === 'dong') return '동별 평균 평당가'
  return '지역별 평균 평당가'
})

interface Row {
  key: string
  title: string
  subtitle: string | null
  price: string
  /** 전월세 전용. null 이면 매매이거나 지역 행이라 한 줄로 그린다. */
  jeonse: string | null
  wolse: string | null
  /** 전월세 행인지. jeonse/wolse 가 둘 다 null 이어도 "거래 없음" 을 그려야 하므로 별도 플래그가 필요하다. */
  isRent: boolean
  /** null = 갈 페이지가 없는 행(동). 템플릿이 링크 대신 버튼을 그린다. */
  href: string | null
  item: MapItem
}

/**
 * 지역 모드의 목록은 **항상 SIDO_CHIPS 16개를 기준**으로 만든다.
 * 집계(items)는 가격을 채우는 데만 쓴다. 집계가 통째로 실패해도 링크 16개가 남아야
 * 이 페이지가 빈 허브가 되지 않는다 — 지도가 SSR 불가라 좌측이 유일한 SSR 콘텐츠다.
 */
const rows = computed<Row[]>(() => {
  if (props.granularity === 'building') {
    // 전월세 타입에서만 두 줄로 나눈다. 매매는 보여줄 두 번째 값이 없다.
    const isRent = props.type.endsWith('-rent')
    return props.items.map((i) => {
      const b = i as MapBuildingItem
      // 배포 직후처럼 새 분리 컬럼이 아직 안 갱신됐으면 레거시 컬럼으로 폴백한다.
      const rent = isRent ? getRentDisplay(b) : null
      return {
        key: itemKey(i),
        title: b.buildingName,
        subtitle: `${b.city} ${b.district} ${b.dongName}`,
        price: formatPriceLabel(b),
        jeonse: rent?.jeonse ?? null,
        wolse: rent?.wolse ?? null,
        isRent,
        // 건물 상세는 4-segment URL. 슬러그 변환·NFC 정규화·encodeURIComponent 가
        // 전부 이 유틸에 들어 있으므로 직접 문자열을 조립하지 않는다.
        href: toRealEstateUrl({
          type: props.type as RealEstateUrlType,
          city: b.city,
          district: b.district,
          buildingName: b.buildingName,
        }),
        item: i,
      }
    })
  }

  if (props.granularity === 'district') {
    return props.items.map((i) => {
      const r = i as MapRegionItem
      return {
        key: itemKey(i),
        title: r.district ?? r.name,
        subtitle: r.name,
        price: formatPyeongLabel(r),
        jeonse: null,
        wolse: null,
        isRent: false,
        href: toRealEstateListUrl({
          type: props.type as RealEstateUrlType,
          city: r.name,
          district: r.district ?? '',
        }),
        item: i,
      }
    })
  }

  if (props.granularity === 'dong') {
    return props.items.map((i) => {
      const r = i as MapRegionItem
      return {
        key: itemKey(i),
        title: r.dong ?? '',
        subtitle: `${r.name} ${r.district ?? ''}`.trim(),
        price: formatPyeongLabel(r),
        jeonse: null,
        wolse: null,
        isRent: false,
        // 동 페이지가 없다(6종 라우트는 구·군까지). href 를 만들면 죽은 링크가 되므로
        // null 을 주고 템플릿이 버튼을 그리게 한다.
        href: null,
        item: i,
      }
    })
  }

  const byName = new Map<string, MapRegionItem>()
  for (const i of props.items) {
    if (!isBuildingItem(i)) byName.set((i as MapRegionItem).name, i as MapRegionItem)
  }

  return SIDO_CHIPS.map((chip) => {
    // byName 은 API MapRegionItem.name, 즉 DB city 컬럼 원값으로 키가 잡힌다. 15개 도는
    // 축약형(예: '서울')이라 chip.label 과 우연히 같지만, 통합시(전남광주통합특별시)는
    // 축약명이 없어 DB 값이 그대로 풀네임이다 — chip.label('전남·광주')/chip.slug 어느 쪽과도
    // 일치하지 않아 항상 폴백(0건)으로 떨어졌다. CITY_SLUG_MAP[chip.slug] 가 DB city 값과
    // 정확히 일치하는 유일한 키이므로 최우선으로 조회하고, 나머지는 안전망으로 남긴다.
    const agg = byName.get(CITY_SLUG_MAP[chip.slug]) ?? byName.get(chip.label) ?? byName.get(chip.slug)
    // lat/lng 는 null(좌표 없음)이다 — 0,0 을 쓰면 "없음"이 아니라 기니만 앞바다의 유효한
    // 좌표로 읽혀, 이 폴백 항목이 select 로 넘어갔을 때 지도가 실제로 그리로 튄다(회귀 실측).
    const item: MapRegionItem = agg ?? {
      name: chip.label, district: null, dong: null, lat: null, lng: null, avgPricePerPyeong: null, transactionCount: 0,
    }
    return {
      key: `${chip.label}|`,
      title: chip.label,
      subtitle: null,
      price: formatPyeongLabel(item),
      jeonse: null,
      wolse: null,
      isRent: false,
      href: `/real-estate/${props.type}/${chip.slug}`,
      item,
    }
  })
})

/** 건물 목록 초기 표시 개수. 이보다 길면 [더보기] 로 이만큼씩 늘린다. */
const PAGE_SIZE = 20

const shown = ref(PAGE_SIZE)

// 뷰포트가 바뀌어 목록이 새로 오면 처음부터 다시 보여준다.
// 안 그러면 이전 지역에서 늘려 둔 개수가 새 지역에 그대로 남는다.
watch(() => props.items, () => { shown.value = PAGE_SIZE })

/**
 * 화면에 그릴 행.
 *
 * city(시/도) 모드만 예외로 자르지 않는다 — SIDO_CHIPS 16개 링크는 이 페이지의 핵심
 * SSR 콘텐츠라 전부 HTML 에 있어야 한다. 그 외(building·district)는 전부 자른다:
 * 목록을 다 그리면(건물 최대 200개, 항목 약 62px = 12,400px) 그 아래 푸터에 도달할 수
 * 없다 — 데스크톱 사이드바에서도 12화면을 내려야 한다. district 도 수도권은 25~50개라
 * 같은 문제가 생겨 building 과 동일하게 20개씩 페이지네이션한다.
 *
 * city 예외가 실제로 살아 있는지는 테스트로 관측할 수 없다 — SIDO_CHIPS 가 16개라
 * PAGE_SIZE(20) 아래여서 슬라이스를 걸어도 안 걸어도 결과가 같다. 상수가 20을 넘으면
 * 그때부터 검증 가능해지고, 넘기 전까지는 이 조건의 존재 자체가 방어선이다.
 */
const visibleRows = computed<Row[]>(() =>
  props.granularity !== 'city' ? rows.value.slice(0, shown.value) : rows.value,
)

const hasMore = computed(() => visibleRows.value.length < rows.value.length)

function showMore(): void {
  shown.value += PAGE_SIZE
}

/**
 * 표시 개수가 bbox 전체 개수보다 적으면 항상 알린다.
 * 목록은 20개인데 지도엔 최대 200개 라벨이 뜨므로, 그 차이의 이유가 화면에 드러나야 한다.
 *
 * props.exact 는 이 판정에 쓰지 않는다 — exact=false(전체>200)면 어차피
 * visibleRows.length < total 이 참이라 조건이 중복된다. prop 자체는 호출부 호환을 위해 남긴다.
 */
const showCountNote = computed(() => visibleRows.value.length < props.total)
</script>
