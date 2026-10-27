import { z } from 'zod';
import { KOREA_BOUNDS } from '../constants/index.js';

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
  })
  .refine((d) => d.swLat <= d.neLat && d.swLng <= d.neLng, {
    message: 'sw 좌표는 ne 좌표보다 작거나 같아야 합니다',
  });

export type MapQueryInput = z.infer<typeof MapQuerySchema>;
