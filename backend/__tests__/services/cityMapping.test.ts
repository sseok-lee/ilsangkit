import { describe, it, expect } from 'vitest';
import { resolveCitySlug, buildRegionFilter, GWANGJU_GU_BJD } from '../../src/services/cityMapping.js';

describe('resolveCitySlug (통합시 bjdCode 되돌림)', () => {
  it('광주 자치구 코드(12###)는 gwangju/광주로', () => {
    expect(resolveCitySlug('12240', '전남광주통합특별시')).toEqual({ citySlug: 'gwangju', cityLabel: '광주' });
    expect(resolveCitySlug('12330', '전남광주통합특별시')).toEqual({ citySlug: 'gwangju', cityLabel: '광주' });
  });

  it('통합시 코드12 중 광주 자치구 외(전남 시·군)는 jeonnam/전남으로', () => {
    expect(resolveCitySlug('12130', '전남광주통합특별시')).toEqual({ citySlug: 'jeonnam', cityLabel: '전남' }); // 여수
    expect(resolveCitySlug('12110', '전남광주통합특별시')).toEqual({ citySlug: 'jeonnam', cityLabel: '전남' }); // 목포
    expect(resolveCitySlug('12870', '전남광주통합특별시')).toEqual({ citySlug: 'jeonnam', cityLabel: '전남' }); // 신안
  });

  it('일반 도시는 city명 기반(short/full 모두) — 회귀 없음', () => {
    expect(resolveCitySlug('44200', '충남')).toEqual({ citySlug: 'chungnam', cityLabel: '충남' });
    expect(resolveCitySlug('11110', '서울특별시')).toEqual({ citySlug: 'seoul', cityLabel: '서울' });
    expect(resolveCitySlug('28110', '인천')).toEqual({ citySlug: 'incheon', cityLabel: '인천' });
  });

  it('bjdCode 없어도(구데이터/테스트) city명으로 폴백', () => {
    expect(resolveCitySlug('', '전북')).toEqual({ citySlug: 'jeonbuk', cityLabel: '전북' });
    expect(resolveCitySlug(undefined as unknown as string, '부산광역시')).toEqual({ citySlug: 'busan', cityLabel: '부산' });
  });

  it('미지 코드 + 미지 도시 → 빈 slug (방어 가드 대상)', () => {
    expect(resolveCitySlug('99999', '없는시')).toEqual({ citySlug: '', cityLabel: '없는시' });
  });

  it('GWANGJU_GU_BJD는 5개 자치구 코드', () => {
    expect(GWANGJU_GU_BJD).toEqual(new Set(['12210', '12240', '12270', '12300', '12330']));
  });
});

describe('buildRegionFilter (통합시 district-level 변형 추가)', () => {
  it('광주 + 구 지정 시 통합명을 city 변형에 포함', () => {
    const f = buildRegionFilter('광주광역시', '서구') as { city: { in: string[] }; district: string };
    expect(f.city.in).toContain('전남광주통합특별시');
    expect(f.city.in).toContain('광주광역시');
    expect(f.district).toBe('서구');
  });

  it('전남 + 시 지정 시 통합명 포함', () => {
    const f = buildRegionFilter('전라남도', '여수시') as { city: { in: string[] }; district: string };
    expect(f.city.in).toContain('전남광주통합특별시');
    expect(f.district).toBe('여수시');
  });

  it('city만(허브) 지정 시 통합명 미포함 — city-hub 오버매칭 방지', () => {
    const f = buildRegionFilter('광주광역시') as { city: { in: string[] } };
    expect(f.city.in).not.toContain('전남광주통합특별시');
    expect(f.city.in).toEqual(expect.arrayContaining(['광주광역시', '광주']));
  });

  it('무관 도시(부산 서구)는 통합명 미포함 — 회귀 없음', () => {
    const f = buildRegionFilter('부산광역시', '서구') as { city: { in: string[] }; district: string };
    expect(f.city.in).not.toContain('전남광주통합특별시');
    expect(f.district).toBe('서구');
  });
});
