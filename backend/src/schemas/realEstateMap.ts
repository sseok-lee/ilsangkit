import { z } from 'zod';
import { KOREA_BOUNDS } from '../constants/index.js';

export type Granularity = 'city' | 'district' | 'building';

/** 카카오맵 level 은 숫자가 클수록 축소된다. 1=20m, 14=전국. */
const CITY_MIN_LEVEL = 11;
const DISTRICT_MIN_LEVEL = 8;

/**
 * 줌 레벨 → 표시 단위.
 *
 * prev 를 넘기면 히스테리시스가 걸린다. 경계값(10↔11, 7↔8)에서 사용자가 미세하게
 * 줌하면 granularity 가 왕복하면서 좌측 목록과 마커가 깜빡이기 때문에, 이미 어떤
 * 단위에 있으면 경계를 한 단계 더 넘어야 전환한다.
 */
export function resolveGranularity(level: number, prev?: Granularity): Granularity {
  const base: Granularity =
    level >= CITY_MIN_LEVEL ? 'city' : level >= DISTRICT_MIN_LEVEL ? 'district' : 'building';

  if (!prev || prev === base) return base;

  // 확대 방향(level 감소)으로 내려갈 때: 경계 바로 위 한 칸은 이전 단위를 유지
  if (prev === 'city' && base === 'district' && level === DISTRICT_MIN_LEVEL + 2) return 'city';
  if (prev === 'district' && base === 'building' && level === DISTRICT_MIN_LEVEL - 1) return 'district';
  // 축소 방향(level 증가)으로 올라갈 때
  if (prev === 'district' && base === 'city' && level === CITY_MIN_LEVEL) return 'district';
  if (prev === 'building' && base === 'district' && level === DISTRICT_MIN_LEVEL) return 'building';

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
    prev: z.enum(['city', 'district', 'building']).optional(),
  })
  .refine((d) => d.swLat <= d.neLat && d.swLng <= d.neLng, {
    message: 'sw 좌표는 ne 좌표보다 작거나 같아야 합니다',
  });

export type MapQueryInput = z.infer<typeof MapQuerySchema>;
