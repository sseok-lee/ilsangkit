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
  it('구 타이틀도 동 타이틀과 같은 축약 시도명을 쓴다(형제 문서 표기 일치)', () => {
    // 예전엔 구 분기만 원문(서울특별시)을 써서 동 분기(서울)와 어긋났다.
    expect(buildLandRegionTitle({ city: '서울특별시', district: '중구' }))
      .toBe('중구 토지 실거래가 | 서울 | 일상킷');
    expect(buildLandRegionTitle({ city: '서울특별시', district: '중구', dong: '명동' }))
      .toContain('서울 중구');
  });
  it('같은 구 이름이라도 시도가 다르면 타이틀이 달라야 한다(중구는 6개 시도에 존재)', () => {
    const seoul = buildLandRegionTitle({ city: '서울', district: '중구' });
    const busan = buildLandRegionTitle({ city: '부산', district: '중구' });
    expect(seoul).not.toBe(busan);
  });
  it('허브 타이틀', () => { expect(buildLandRegionTitle({})).toContain('전국 토지'); });
  it('설명에 동·평당가·건수 주입', () => {
    const d = buildLandRegionDescription({ city: '서울', district: '강남구', dong: '역삼동', avgPricePerPyeong: 18678, count: 22 });
    expect(d).toContain('역삼동');
    expect(d).toContain('18,678');
    // avgPricePerPyeong 은 만원/평 단위 — '원'이 아니라 '만원'으로 표기해야 한다(1만배 오표기 방지).
    expect(d).toContain('평당 18,678만원');
  });
  it('평당가 없을 때도 설명 생성(폴백)', () => {
    const d = buildLandRegionDescription({ city: '서울', district: '강남구', dong: '수서동', avgPricePerPyeong: null, count: 0 });
    expect(typeof d).toBe('string'); expect(d.length).toBeGreaterThan(10);
  });
  it('평당가 없어도 거래건수가 있으면 폴백 설명을 차별화한다', () => {
    const d = buildLandRegionDescription({ city: '경기', district: '가평군', avgPricePerPyeong: null, count: 37 });
    expect(d).toContain('가평군');
    expect(d).toContain('37');
  });
  it('같은 구 이름이라도 시도가 다르면 설명문이 달라야 한다(평당가 없는 폴백 분기)', () => {
    // 2026-09-04 실측 '중복 설명 225,388건'의 전형적 경로.
    // 평당가·거래건수가 모두 없는 분기에서 지역 라벨이 '중구' 하나뿐이면
    // /land/seoul/jung 과 /land/busan/jung 의 설명문이 바이트 단위로 같아진다.
    const seoul = buildLandRegionDescription({ city: '서울', district: '중구', avgPricePerPyeong: null, count: 0 });
    const busan = buildLandRegionDescription({ city: '부산', district: '중구', avgPricePerPyeong: null, count: 0 });
    expect(seoul).not.toBe(busan);
    expect(seoul).toContain('서울 중구');
    expect(busan).toContain('부산 중구');
  });
  it('동 설명문에도 시도·구가 함께 들어간다', () => {
    const d = buildLandRegionDescription({ city: '부산광역시', district: '중구', dong: '동광동', avgPricePerPyeong: null, count: 0 });
    expect(d).toContain('부산 중구 동광동');
  });
  it('시도만 있는 허브 설명문은 종전 표기를 유지한다', () => {
    const d = buildLandRegionDescription({ city: '서울', avgPricePerPyeong: null, count: 0 });
    expect(d).toContain('서울 토지');
  });
  it('FAQ ≥4문항, META label 토지', () => {
    expect(LAND_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(LAND_META.label).toBe('토지');
  });
});
