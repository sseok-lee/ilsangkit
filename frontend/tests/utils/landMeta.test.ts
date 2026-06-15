import { describe, it, expect } from 'vitest';
import { buildLandRegionTitle, buildLandRegionDescription, LAND_FAQ, LAND_META } from '~/utils/landMeta';

describe('landMeta', () => {
  it('동 타이틀에 동·시·구·브랜드 포함', () => {
    const t = buildLandRegionTitle({ city: '서울', district: '강남구', dong: '역삼동' });
    expect(t).toBe('역삼동 토지 시세·실거래가 | 서울 강남구 | 일상킷');
  });
  it('구 타이틀에 구·시도', () => {
    const t = buildLandRegionTitle({ city: '서울', district: '강남구' });
    expect(t).toContain('강남구'); expect(t).toContain('서울');
  });
  it('허브 타이틀', () => { expect(buildLandRegionTitle({})).toContain('전국 토지'); });
  it('설명에 동·평당가·건수 주입', () => {
    const d = buildLandRegionDescription({ city: '서울', district: '강남구', dong: '역삼동', avgPricePerPyeong: 18678, count: 22 });
    expect(d).toContain('역삼동');
    expect(d).toMatch(/18,678|평당/);
  });
  it('평당가 없을 때도 설명 생성(폴백)', () => {
    const d = buildLandRegionDescription({ city: '서울', district: '강남구', dong: '수서동', avgPricePerPyeong: null, count: 0 });
    expect(typeof d).toBe('string'); expect(d.length).toBeGreaterThan(10);
  });
  it('FAQ ≥4문항, META label 토지', () => {
    expect(LAND_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(LAND_META.label).toBe('토지');
  });
});
