import { z } from 'zod';
import { KOREA_BOUNDS } from '../constants/index.js';
import { ValidationError } from '../lib/errors.js';

export type Granularity = 'city' | 'district' | 'dong' | 'building';

/**
 * 카카오맵 level 은 숫자가 클수록 축소된다. 1=20m, 14=전국.
 * 각 단위가 정확히 2칸을 차지하도록 잡았다(설계문서 5.1.1 전이표).
 * 이 값을 바꾸면 전이표를 다시 그려 건너뛰는 단위가 없는지 확인할 것.
 */
const CITY_MIN_LEVEL = 11;
const DISTRICT_MIN_LEVEL = 9;
const DONG_MIN_LEVEL = 7;

/** 축소된 순서(큰 단위 → 작은 단위). 인접 판정과 히스테리시스에 쓴다. */
const ORDER: readonly Granularity[] = ['city', 'district', 'dong', 'building'];

/** 각 단위가 시작되는 최소 레벨. 경계는 여기 한 곳에서만 정의된다. */
const MIN_LEVEL: Record<Exclude<Granularity, 'building'>, number> = {
  city: CITY_MIN_LEVEL,
  district: DISTRICT_MIN_LEVEL,
  dong: DONG_MIN_LEVEL,
};

/**
 * 줌 레벨 → 표시 단위.
 *
 * prev 를 넘기면 히스테리시스가 걸린다. 경계값(10↔11, 8↔9, 6↔7)에서 사용자가 미세하게
 * 줌하면 granularity 가 왕복하면서 좌측 목록과 마커가 깜빡이기 때문에, 이미 어떤
 * 단위에 있으면 경계를 한 단계 더 넘어야 전환한다.
 */
export function resolveGranularity(level: number, prev?: Granularity): Granularity {
  const base: Granularity =
    level >= MIN_LEVEL.city
      ? 'city'
      : level >= MIN_LEVEL.district
        ? 'district'
        : level >= MIN_LEVEL.dong
          ? 'dong'
          : 'building';

  if (!prev || prev === base) return base;

  // 히스테리시스: 경계에서 미세하게 줌하면 단위가 왕복하며 목록·마커가 깜빡인다.
  // 이미 어떤 단위에 있으면 경계를 **한 칸 더** 넘어야 전환한다.
  //
  // 인접 단위 사이에서만 적용한다 — 두 칸 이상 건너뛴 전환(드릴다운으로 city→dong 등)은
  // 사용자의 명시적 동작이므로 붙잡지 않는다.
  const prevIdx = ORDER.indexOf(prev);
  const baseIdx = ORDER.indexOf(base);
  if (Math.abs(prevIdx - baseIdx) !== 1) return base;

  if (baseIdx > prevIdx) {
    // 확대(level 감소): prev 밴드 바로 아래 한 칸까지는 prev 를 유지한다.
    // `MIN_LEVEL[prev] - 1` 은 곧 다음(작은) 밴드의 꼭대기 칸이다.
    // 예: prev=district(9~10) → 8 에서는 아직 district, 7 부터 dong.
    if (prev !== 'building' && level === MIN_LEVEL[prev] - 1) return prev;
  } else {
    // 축소(level 증가): base 밴드의 첫 칸에서는 아직 prev 를 유지한다.
    // 예: prev=dong, base=district → 9 에서는 아직 dong, 10 부터 district.
    if (base !== 'building' && level === MIN_LEVEL[base]) return prev;
  }

  return base;
}

// ── 단지 단계 필터 구간 ─────────────────────────────────────────────
// 구간 id 는 "하한-상한"(만원·㎡). 의미는 "하한 초과 ~ 상한 이하"이고, 하한 0 은 하한 없음
// (첫 구간 "N 이하"), 상한이 비면 상한 없음("N 초과")이다. 프론트 utils/mapFilters.ts 와 같아야 한다.

/** 전용면적(㎡): 60 이하 / 60~85 / 85~135 / 135 초과 */
export const AREA_BUCKETS = ['0-60', '60-85', '85-135', '135-'] as const;

export type PriceKind = 'sale' | 'jeonse' | 'wolse';

/** 가격 구간(만원). 매매=거래금액, 전세=보증금, 월세=월세액. */
export const PRICE_BUCKETS = {
  sale: ['0-30000', '30000-60000', '60000-90000', '90000-150000', '150000-250000', '250000-'],
  jeonse: ['0-10000', '10000-30000', '30000-50000', '50000-80000', '80000-'],
  wolse: ['0-50', '50-100', '100-'],
} as const satisfies Record<PriceKind, readonly string[]>;

const ALL_PRICE_BUCKETS = [
  ...new Set([...PRICE_BUCKETS.sale, ...PRICE_BUCKETS.jeonse, ...PRICE_BUCKETS.wolse]),
] as [string, ...string[]];

/** 하한 초과 ~ 상한 이하. null 은 그쪽 끝이 열려 있다는 뜻이다. */
export interface ValueRange {
  min: number | null;
  max: number | null;
}

export interface MapFilter {
  area: ValueRange | null;
  price: { kind: PriceKind; range: ValueRange } | null;
}

export function bucketRange(id: string): ValueRange {
  const [lo, hi] = id.split('-');
  const min = Number(lo);
  return { min: min > 0 ? min : null, max: hi ? Number(hi) : null };
}

export function inRange(value: number, range: ValueRange): boolean {
  return (range.min == null || value > range.min) && (range.max == null || value <= range.max);
}

/**
 * 쿼리의 필터 값을 유형에 맞춰 해석한다. 아무 필터도 없으면 null — 호출부는 이때 기존 경로를
 * 그대로 타야 한다(필터 없는 응답은 예전과 완전히 같아야 한다).
 *
 * 매매는 priceKind 없이 price 만, 전월세는 priceKind(jeonse|wolse) + price 를 함께 받는다.
 * 짝이 안 맞거나 그 종류의 구간이 아니면 ValidationError(422).
 */
export function resolveMapFilter(
  type: string,
  q: { area?: string; price?: string; priceKind?: 'jeonse' | 'wolse' },
): MapFilter | null {
  const isSale = type.endsWith('-sale');
  let price: MapFilter['price'] = null;
  if (q.priceKind && isSale) throw new ValidationError('매매 지도에는 priceKind 를 쓰지 않습니다');
  if (q.priceKind && !q.price) throw new ValidationError('priceKind 는 price 와 함께 보내야 합니다');
  if (q.price) {
    const kind: PriceKind | undefined = isSale ? 'sale' : q.priceKind;
    if (!kind) throw new ValidationError('전월세 가격 필터에는 priceKind(jeonse|wolse) 가 필요합니다');
    if (!(PRICE_BUCKETS[kind] as readonly string[]).includes(q.price)) {
      throw new ValidationError(`${kind} 가격 구간이 아닙니다: ${q.price}`);
    }
    price = { kind, range: bucketRange(q.price) };
  }
  const area = q.area ? bucketRange(q.area) : null;
  if (!area && !price) return null;
  return { area, price };
}

const lat = z.coerce
  .number()
  .min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다')
  .max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다');
const lng = z.coerce
  .number()
  .min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다')
  .max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다');

export const MapQuerySchema = z
  .object({
    level: z.coerce.number().int().min(1).max(14),
    swLat: lat,
    swLng: lng,
    neLat: lat,
    neLng: lng,
    prev: z.enum(['city', 'district', 'dong', 'building']).optional(),
    // 단지 단계 필터(선택). 값은 아래 구간 id 만 받는다. 유형과의 짝(매매 가격 vs 전월세
    // priceKind)은 유형이 path 에 있어 여기서 못 본다 — 라우트가 resolveMapFilter 로 확인한다.
    area: z.enum(AREA_BUCKETS).optional(),
    price: z.enum(ALL_PRICE_BUCKETS).optional(),
    priceKind: z.enum(['jeonse', 'wolse']).optional(),
  })
  .refine((d) => d.swLat <= d.neLat && d.swLng <= d.neLng, {
    message: 'sw 좌표는 ne 좌표보다 작거나 같아야 합니다',
  });

export type MapQueryInput = z.infer<typeof MapQuerySchema>;
