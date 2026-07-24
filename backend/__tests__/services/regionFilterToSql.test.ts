import { describe, it, expect } from 'vitest';
import { regionFilterToSql } from '../../src/services/realEstateService.js';

// regionFilterToSql: buildRegionFilter() 결과(Prisma where 조각)를 raw-SQL 조각 + 파라미터로 변환.
// DB-free 순수 함수 — city-variant 로직을 재사용하며 searchAll의 COUNT(DISTINCT) 쿼리에 쓰인다.
describe('regionFilterToSql', () => {
  it('city.in(배열)을 IN (?, ?) 절 + 순서대로 파라미터로 변환', () => {
    const res = regionFilterToSql({ city: { in: ['서울특별시', '서울'] }, district: '강남구' });
    expect(res.clauses).toEqual(['city IN (?, ?)', 'district = ?']);
    expect(res.params).toEqual(['서울특별시', '서울', '강남구']);
  });

  it('문자열 city는 city = ? 단일 절로 변환', () => {
    const res = regionFilterToSql({ city: '경기도' });
    expect(res.clauses).toEqual(['city = ?']);
    expect(res.params).toEqual(['경기도']);
  });

  it('빈 필터는 빈 절/파라미터를 반환', () => {
    const res = regionFilterToSql({});
    expect(res).toEqual({ clauses: [], params: [] });
  });

  it('district만 있으면 district = ? 단일 절', () => {
    const res = regionFilterToSql({ district: '해운대구' });
    expect(res.clauses).toEqual(['district = ?']);
    expect(res.params).toEqual(['해운대구']);
  });

  it('city.in의 빈 배열은 절을 만들지 않는다', () => {
    const res = regionFilterToSql({ city: { in: [] } });
    expect(res.clauses).toEqual([]);
    expect(res.params).toEqual([]);
  });

  it('3개 variant IN 절과 district 결합 — 파라미터 순서 보존', () => {
    const res = regionFilterToSql({ city: { in: ['광주광역시', '광주', '전남광주통합특별시'] }, district: '북구' });
    expect(res.clauses).toEqual(['city IN (?, ?, ?)', 'district = ?']);
    expect(res.params).toEqual(['광주광역시', '광주', '전남광주통합특별시', '북구']);
  });
});
