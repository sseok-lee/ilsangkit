<template>
  <section v-if="hasAny" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]">local_fire_department</span>
          이번 주 인기 단지
        </h2>
        <p class="text-sm text-slate-500 mt-1">최근 7일 매매·전세·월세 거래가 가장 많은 단지입니다.</p>
      </div>
      <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">전체 보기 →</HardLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <div
        v-for="col in columns"
        :key="col.type"
        class="bg-white border border-line rounded-2xl shadow-card overflow-hidden flex flex-col"
      >
        <!-- Column header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div :class="['w-[1.5px] h-5 rounded-full', col.accentBar]" />
          <span class="font-bold text-slate-900 text-sm">{{ col.label }}</span>
          <span class="ml-auto text-[11px] text-slate-400">최근 7일</span>
        </div>
        <!-- Empty state -->
        <div v-if="col.items.length === 0" class="flex-1 flex items-center justify-center py-8 text-sm text-slate-400">
          이번 주 거래 없음
        </div>
        <!-- Building rows -->
        <template v-else>
          <a
            v-for="(b, i) in col.items"
            :key="b.buildingName + i"
            :href="buildUrl(col.type, b.slug)"
            :class="['flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors', col.hoverBg]"
          >
            <!-- Rank -->
            <span
              :class="['w-5 text-center text-sm font-bold shrink-0', i < 2 ? col.accentText : 'text-slate-400']"
            >{{ i + 1 }}</span>
            <!-- Name + region -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-slate-900 truncate">{{ b.buildingName }}</div>
              <div class="text-[11px] text-slate-400">{{ shortRegion(b.city, b.district) }}</div>
            </div>
            <!-- Txn count + price -->
            <div class="text-right shrink-0">
              <div class="text-[11px] text-slate-400">{{ b.txnCount }}건</div>
              <div :class="['text-sm font-bold', col.accentText]">{{ formatBuildingPrice(col.type, b) }}</div>
            </div>
          </a>
        </template>
      </div>
    </div>
    <!-- Caption -->
    <p class="text-[11px] text-slate-400 mt-2">월세는 보증금/월세(만원) 평균으로 표기합니다.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import { formatPrice } from '~/utils/priceFormat';
import type { TrendingBuildingItem } from '~/composables/useHomeDashboard';

type ColType = 'sale' | 'jeonse' | 'wolse';

const props = defineProps<{
  buildings: {
    sale: TrendingBuildingItem[];
    jeonse: TrendingBuildingItem[];
    wolse: TrendingBuildingItem[];
  };
}>();

const CITY_SHORT: Record<string, string> = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '경기도': '경기',
  '강원특별자치도': '강원',
  '충청북도': '충북',
  '충청남도': '충남',
  '전북특별자치도': '전북',
  '전라남도': '전남',
  '경상북도': '경북',
  '경상남도': '경남',
  '제주특별자치도': '제주',
};

function shortRegion(city: string, district: string): string {
  return `${CITY_SHORT[city] ?? city} ${district}`;
}

function buildUrl(type: ColType, slug: string): string {
  if (type === 'sale') return `/real-estate/apt-sale/${slug}`;
  return `/real-estate/apt-rent/${slug}`;
}

function formatBuildingPrice(type: ColType, b: TrendingBuildingItem): string {
  if (type === 'wolse') {
    const deposit = formatPrice(b.avgPrice);
    const monthly = b.avgMonthlyRent !== null ? Math.round(b.avgMonthlyRent).toLocaleString('ko-KR') : '—';
    return `${deposit}/${monthly}`;
  }
  return formatPrice(b.avgPrice);
}

interface Column {
  type: ColType;
  label: string;
  items: TrendingBuildingItem[];
  accentBar: string;
  accentText: string;
  hoverBg: string;
}

const columns = computed<Column[]>(() => [
  {
    type: 'sale',
    label: '매매 TOP',
    items: props.buildings.sale,
    accentBar: 'bg-primary',
    accentText: 'text-primary',
    hoverBg: 'hover:bg-primary/5',
  },
  {
    type: 'jeonse',
    label: '전세 TOP',
    items: props.buildings.jeonse,
    accentBar: 'bg-emerald-500',
    accentText: 'text-emerald-600',
    hoverBg: 'hover:bg-emerald-50/50',
  },
  {
    type: 'wolse',
    label: '월세 TOP',
    items: props.buildings.wolse,
    accentBar: 'bg-amber-500',
    accentText: 'text-amber-600',
    hoverBg: 'hover:bg-amber-50/50',
  },
]);

const hasAny = computed(() =>
  props.buildings.sale.length > 0 ||
  props.buildings.jeonse.length > 0 ||
  props.buildings.wolse.length > 0,
);
</script>
