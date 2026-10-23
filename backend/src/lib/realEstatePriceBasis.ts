import type {
  AreaGroup,
  BasisDealRef,
  DealFlag,
  ExcludedDeal,
  PriceBasis,
} from '../types/housingRedesign.js';

export const PRICE_BASIS = {
  saleSample: 5,
  jeonseSample: 6,
  minSample: 3,
  outlierRatio: 0.4,
  outlierNeighbors: 10,
  outlierMinNeighbors: 5,
  outlierWindowDays: 183,
  repMonths: 12,
  yearAgoFromMonths: 13,
  yearAgoToMonths: 11,
  defaultAreaMonths: 36,
} as const;

export interface BasisDeal {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  area: string;
  floor: number | null;
  direct: boolean;
}

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function areaGroupKey(area: string | number): string {
  return String(Math.round(Number(area)));
}

export function exclusivePyeong(area: number): number {
  return Math.round(area / 3.3058);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function monthsBefore(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 최다 빈도 면적(동률이면 작은 값). */
function modalArea(areas: string[]): number {
  const counts = new Map<number, number>();
  for (const a of areas) {
    const v = Number(a);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = NaN;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && v < best)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function areaGroupLabel(areas: string[]): string {
  return String(Math.floor(modalArea(areas)));
}

export function areaGroupPyeong(areas: string[]): number {
  return exclusivePyeong(modalArea(areas));
}

export interface DealClassification {
  flags: Map<number, DealFlag>;
  /** 비직거래 거래의 (금액 ÷ 이웃 중간값 − 1). 이웃이 5건 미만이면 null. 직거래는 없음. */
  deviations: Map<number, number | null>;
}

/**
 * 같은 그룹 안에서 자기 제외·비직거래·±183일 이내 가장 가까운 이웃 10건의 금액 중간값(5건 미만이면 null)을
 * 그룹 전체에 대해 계산한다. 정렬은 날짜 거리 오름차순, 동률이면 id 오름차순.
 * 그룹을 (날짜, id) 로 한 번 정렬한 뒤 각 거래 위치에서 좌우로 날짜 블록 단위로 넓혀 가므로 거의 선형이다.
 */
function neighborMedians(group: BasisDeal[]): Map<number, number | null> {
  const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const n = sorted.length;
  const days = sorted.map((d) => toUtc(d.date) / DAY_MS);
  // 같은 날짜 블록의 [시작, 끝] 인덱스
  const blockStart = new Array<number>(n);
  const blockEnd = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    blockStart[i] = i > 0 && days[i - 1] === days[i] ? blockStart[i - 1] : i;
  }
  for (let i = n - 1; i >= 0; i--) {
    blockEnd[i] = i < n - 1 && days[i + 1] === days[i] ? blockEnd[i + 1] : i;
  }

  const want = PRICE_BASIS.outlierNeighbors;
  const result = new Map<number, number | null>();
  for (let i = 0; i < n; i++) {
    const target = sorted[i];
    if (target.direct) continue;
    const picked: number[] = [];
    // 같은 거리 수준의 두 후보 구간(각각 id 오름차순)을 병합해 비직거래를 필요한 만큼만 취한다.
    const take = (aFrom: number, aTo: number, bFrom: number, bTo: number): void => {
      let a = aFrom;
      let b = bFrom;
      while (picked.length < want) {
        while (a <= aTo && (sorted[a].direct || sorted[a].id === target.id)) a++;
        while (b <= bTo && (sorted[b].direct || sorted[b].id === target.id)) b++;
        if (a > aTo && b > bTo) return;
        if (b > bTo || (a <= aTo && sorted[a].id < sorted[b].id)) picked.push(sorted[a++].amount);
        else picked.push(sorted[b++].amount);
      }
    };
    // 거리 0: 같은 날짜 블록(자기 제외)
    take(blockStart[i], i - 1, i + 1, blockEnd[i]);
    let l = blockStart[i] - 1;
    let r = blockEnd[i] + 1;
    while (picked.length < want) {
      const dl = l >= 0 ? days[i] - days[l] : Infinity;
      const dr = r < n ? days[r] - days[i] : Infinity;
      const d = Math.min(dl, dr);
      if (d > PRICE_BASIS.outlierWindowDays) break;
      const useL = dl === d;
      const useR = dr === d;
      const lFrom = useL ? blockStart[l] : 0;
      const lTo = useL ? l : -1;
      const rFrom = useR ? r : 0;
      const rTo = useR ? blockEnd[r] : -1;
      take(lFrom, lTo, rFrom, rTo);
      if (useL) l = lFrom - 1;
      if (useR) r = rTo + 1;
    }
    result.set(
      target.id,
      picked.length < PRICE_BASIS.outlierMinNeighbors ? null : median(picked),
    );
  }
  return result;
}

/** 면적 그룹 키별로 거래를 묶는다(입력 순서 유지). */
export function groupByArea(deals: BasisDeal[]): Map<string, BasisDeal[]> {
  const groups = new Map<string, BasisDeal[]>();
  for (const d of deals) {
    const key = areaGroupKey(d.area);
    const list = groups.get(key);
    if (list) list.push(d);
    else groups.set(key, [d]);
  }
  return groups;
}

export function classifyDealsDetailed(deals: BasisDeal[]): DealClassification {
  const flags = new Map<number, DealFlag>();
  const deviations = new Map<number, number | null>();
  for (const group of groupByArea(deals).values()) {
    const medians = neighborMedians(group);
    for (const d of group) {
      if (d.direct) {
        flags.set(d.id, 'direct');
        continue;
      }
      const med = medians.get(d.id) ?? null;
      const deviation = med !== null ? d.amount / med - 1 : null;
      deviations.set(d.id, deviation);
      flags.set(
        d.id,
        deviation !== null && Math.abs(deviation) >= PRICE_BASIS.outlierRatio ? 'outlier' : 'normal',
      );
    }
  }
  return { flags, deviations };
}

export function classifyDeals(deals: BasisDeal[]): Map<number, DealFlag> {
  return classifyDealsDetailed(deals).flags;
}

const byDateDesc = (a: BasisDeal, b: BasisDeal): number =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;

const toRef = (d: BasisDeal): BasisDealRef => ({
  id: d.id,
  date: d.date,
  amount: d.amount,
  floor: d.floor,
});

export function computePriceBasis(
  deals: BasisDeal[],
  flags: Map<number, DealFlag>,
  today: string,
  sampleSize: number,
  deviations: Map<number, number | null> = classifyDealsDetailed(deals).deviations,
): PriceBasis {
  const winStart = monthsBefore(today, PRICE_BASIS.repMonths);
  const inWindow = deals.filter((d) => d.date > winStart && d.date <= today);
  const normalAll = deals.filter((d) => flags.get(d.id) === 'normal').sort(byDateDesc);
  const normalWin = inWindow.filter((d) => flags.get(d.id) === 'normal').sort(byDateDesc);

  let representative: number | null = null;
  let sampleCount = 0;
  if (normalWin.length >= PRICE_BASIS.minSample) {
    const sample = normalWin.slice(0, sampleSize);
    representative = median(sample.map((d) => d.amount));
    sampleCount = sample.length;
  }

  const yearFrom = monthsBefore(today, PRICE_BASIS.yearAgoFromMonths);
  const yearTo = monthsBefore(today, PRICE_BASIS.yearAgoToMonths);
  const yearNormals = normalAll.filter((d) => d.date > yearFrom && d.date <= yearTo);
  const yearAgo =
    yearNormals.length >= PRICE_BASIS.minSample ? median(yearNormals.map((d) => d.amount)) : null;

  const changeRate =
    representative !== null && yearAgo !== null
      ? Math.round((representative / yearAgo - 1) * 1e4) / 1e4
      : null;

  const excluded: ExcludedDeal[] = inWindow
    .filter((d) => flags.get(d.id) === 'direct' || flags.get(d.id) === 'outlier')
    .sort(byDateDesc)
    .map((d) => {
      if (flags.get(d.id) === 'direct') {
        return { ...toRef(d), reason: 'direct' as const, deviation: null };
      }
      const deviation = deviations.get(d.id) ?? null;
      return {
        ...toRef(d),
        reason: 'outlier' as const,
        deviation: deviation !== null ? Math.round(deviation * 100) / 100 : null,
      };
    });

  return {
    representative,
    sampleCount,
    latest: normalAll.length > 0 ? toRef(normalAll[0]) : null,
    max12m: normalWin.length > 0 ? Math.max(...normalWin.map((d) => d.amount)) : null,
    yearAgo,
    changeRate,
    excluded,
  };
}

export function buildAreaGroups(
  sale: BasisDeal[],
  jeonse: BasisDeal[],
  today: string,
): AreaGroup[] {
  const winStart = monthsBefore(today, PRICE_BASIS.defaultAreaMonths);
  const acc = new Map<string, { areas: string[]; sale: number; jeonse: number }>();
  const add = (deals: BasisDeal[], side: 'sale' | 'jeonse'): void => {
    for (const d of deals) {
      const key = areaGroupKey(d.area);
      let g = acc.get(key);
      if (!g) {
        g = { areas: [], sale: 0, jeonse: 0 };
        acc.set(key, g);
      }
      g.areas.push(d.area);
      if (d.date > winStart && d.date <= today) g[side] += 1;
    }
  };
  add(sale, 'sale');
  add(jeonse, 'jeonse');
  return [...acc.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([key, g]) => ({
      key,
      label: areaGroupLabel(g.areas),
      pyeong: areaGroupPyeong(g.areas),
      saleCount36m: g.sale,
      jeonseCount36m: g.jeonse,
    }));
}

function latestDate(deals: BasisDeal[], key: string): string {
  let best = '';
  for (const d of deals) {
    if (areaGroupKey(d.area) === key && d.date > best) best = d.date;
  }
  return best;
}

function pickBySide(
  groups: AreaGroup[],
  deals: BasisDeal[],
  count: (g: AreaGroup) => number,
): string | null {
  let best: AreaGroup | null = null;
  let bestDate = '';
  for (const g of groups) {
    const c = count(g);
    if (c <= 0) continue;
    const date = latestDate(deals, g.key);
    if (
      best === null ||
      c > count(best) ||
      (c === count(best) && (date > bestDate || (date === bestDate && Number(g.key) < Number(best.key))))
    ) {
      best = g;
      bestDate = date;
    }
  }
  return best ? best.key : null;
}

export function chooseDefaultAreaGroup(
  groups: AreaGroup[],
  sale: BasisDeal[],
  jeonse: BasisDeal[],
  prefer: 'sale' | 'jeonse',
): string | null {
  const sides = {
    sale: { deals: sale, count: (g: AreaGroup): number => g.saleCount36m },
    jeonse: { deals: jeonse, count: (g: AreaGroup): number => g.jeonseCount36m },
  };
  const other = prefer === 'sale' ? 'jeonse' : 'sale';
  const picked =
    pickBySide(groups, sides[prefer].deals, sides[prefer].count) ??
    pickBySide(groups, sides[other].deals, sides[other].count);
  if (picked !== null) return picked;
  const keys = groups.map((g) => g.key).sort((x, y) => Number(x) - Number(y));
  return keys.length > 0 ? keys[0] : null;
}
