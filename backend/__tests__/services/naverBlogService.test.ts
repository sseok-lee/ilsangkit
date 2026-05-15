import { describe, it, expect } from 'vitest';
import { buildNaverBlogQuery, stripHtml, buildNaverBlogQueryForRealEstate } from '../../src/services/naverBlogService.js';

describe('buildNaverBlogQuery', () => {
  const base = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('parking: name + district + "주차장"', () => {
    expect(buildNaverBlogQuery(base, 'parking')).toBe('종로주차장 종로구 주차장');
  });
  it('toilet', () => {
    expect(buildNaverBlogQuery({ name: '광화문역', city: '서울특별시', district: '종로구' }, 'toilet'))
      .toBe('광화문역 공중화장실 종로구');
  });
  it('park uses city short', () => {
    expect(buildNaverBlogQuery({ name: '남산공원', city: '서울특별시', district: '중구' }, 'park'))
      .toBe('남산공원 서울');
  });
  it('library / hospital → name + district', () => {
    expect(buildNaverBlogQuery({ name: '종로도서관', city: '서울특별시', district: '종로구' }, 'library'))
      .toBe('종로도서관 종로구');
    expect(buildNaverBlogQuery({ name: '서울대병원', city: '서울특별시', district: '종로구' }, 'hospital'))
      .toBe('서울대병원 종로구');
  });
  it('pharmacy', () => {
    expect(buildNaverBlogQuery({ name: '종로약국', city: '서울특별시', district: '종로구' }, 'pharmacy'))
      .toBe('종로약국 종로구 약국');
  });
  it('ev-charger', () => {
    expect(buildNaverBlogQuery({ name: '이마트 종로점', city: '서울특별시', district: '종로구' }, 'ev-charger'))
      .toBe('이마트 종로점 전기차 충전소');
  });
  it('childcare', () => {
    expect(buildNaverBlogQuery({ name: '해님', city: '서울특별시', district: '종로구' }, 'childcare'))
      .toBe('해님 종로구 어린이집');
  });
  it('aed', () => {
    expect(buildNaverBlogQuery({ name: '시청', city: '서울특별시', district: '중구' }, 'aed'))
      .toBe('시청 AED 중구');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQuery({ name: '광장시장', city: '서울특별시', district: '' }, 'market'))
      .toBe('광장시장 서울');
  });
});

describe('stripHtml', () => {
  it('<b> 태그 제거', () => {
    expect(stripHtml('<b>광장시장</b> 후기')).toBe('광장시장 후기');
  });
  it('여러 태그 + 엔티티 제거', () => {
    expect(stripHtml('<b>주차장</b>은 &quot;좋다&quot; &amp; 깨끗')).toBe('주차장은 "좋다" & 깨끗');
  });
  it('&#39; &nbsp; &lt; &gt; 처리', () => {
    expect(stripHtml('it&#39;s&nbsp;great&lt;3&gt;')).toBe('it\'s great<3>');
  });
});

describe('buildNaverBlogQueryForRealEstate', () => {
  const base = { buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' };

  it('apt-sale → 아파트 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-sale'))
      .toBe('롯데캐슬 골드 종로구 아파트 매매');
  });
  it('apt-rent → 아파트 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-rent'))
      .toBe('롯데캐슬 골드 종로구 아파트 전세');
  });
  it('villa-sale → 빌라 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-sale'))
      .toBe('롯데캐슬 골드 종로구 빌라 매매');
  });
  it('villa-rent → 빌라 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-rent'))
      .toBe('롯데캐슬 골드 종로구 빌라 전세');
  });
  it('offitel-sale → 오피스텔 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-sale'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 매매');
  });
  it('offitel-rent → 오피스텔 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-rent'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 전세');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQueryForRealEstate({ buildingName: '롯데캐슬', city: '서울특별시', district: '' }, 'apt-sale'))
      .toBe('롯데캐슬 서울 아파트 매매');
  });
});
