import { describe, it, expect } from 'vitest';
import { normalizeDistrict, parseAddress, extractCityDistrict } from '../../src/lib/addressParser.js';

describe('normalizeDistrict', () => {
  it('단축형 광역시 시명이 박힌 district를 address 기준으로 보정한다 (대구동구 → 동구)', () => {
    expect(normalizeDistrict('대구동구', '대구광역시 동구 안심로 58, 3층')).toBe('동구');
  });

  it('시명으로 시작하는 실제 구(부산진구)는 망가뜨리지 않고 보존한다', () => {
    expect(normalizeDistrict('부산진구', '부산광역시 부산진구 가야대로 100')).toBe('부산진구');
    // API가 부산진구를 "부산부산진구"로 줘도 주소 기준이면 부산진구로 복원
    expect(normalizeDistrict('부산부산진구', '부산광역시 부산진구 가야대로 100')).toBe('부산진구');
  });

  it('부산 동구처럼 단축시명+구는 동구로 보정한다', () => {
    expect(normalizeDistrict('부산동구', '부산광역시 동구 중앙대로 206')).toBe('동구');
  });

  it('이미 올바른 district는 그대로 유지한다', () => {
    expect(normalizeDistrict('강남구', '서울특별시 강남구 테헤란로 1')).toBe('강남구');
    expect(normalizeDistrict('동구', '부산광역시 동구 중앙대로 206')).toBe('동구');
  });

  it('도로명/지번 주소 모두에서 도출된다', () => {
    expect(normalizeDistrict('대구동구', '대구광역시 동구 율하동 123-4')).toBe('동구');
  });

  it('세종시는 세종시로 도출한다', () => {
    expect(normalizeDistrict('세종시', '세종특별자치시 한누리대로 2130')).toBe('세종시');
  });

  it('이미 축약된 시명으로 시작하는 주소도 처리한다 (대구 동구 …)', () => {
    expect(normalizeDistrict('대구동구', '대구 동구 안심로 58')).toBe('동구');
  });

  it('address가 없으면 raw 값을 그대로 둔다 (위험한 접두사 제거 안 함)', () => {
    expect(normalizeDistrict('부산진구')).toBe('부산진구');
    expect(normalizeDistrict('대구동구', null)).toBe('대구동구');
    expect(normalizeDistrict('동구', '')).toBe('동구');
  });

  it('address에 구/군이 없으면 raw 유지', () => {
    expect(normalizeDistrict('동구', '안심로 58 3층')).toBe('동구');
  });

  it('raw가 비어도 안전하게 처리', () => {
    expect(normalizeDistrict('', '대구광역시 동구 안심로')).toBe('동구');
    expect(normalizeDistrict('')).toBe('');
  });

  it('주소에 시명이 중복돼도(울산광역시 울산광역시 남구) 올바른 raw를 오염시키지 않는다', () => {
    // parseAddress가 2번째 "울산광역시"(시로 끝남)를 district로 잘못 잡는 케이스 → 거부하고 raw 유지
    expect(normalizeDistrict('남구', '울산광역시 울산광역시 남구 장생포고래로 156')).toBe('남구');
  });

  it('시/도 풀네임은 district 후보로 채택하지 않는다', () => {
    expect(normalizeDistrict('남구', '울산광역시 남구 무거동')).toBe('남구'); // 정상 케이스는 그대로
    expect(normalizeDistrict('세종시', '세종특별자치시 한누리대로')).toBe('세종시'); // 세종시(시 단위)는 유지
  });

  it('시 단위 시군구(남양주시/창원시)는 보존한다', () => {
    expect(normalizeDistrict('남양주', '경기도 남양주시 금곡동 687-16')).toBe('남양주시');
    expect(normalizeDistrict('창원', '경상남도 창원시 의창구')).toBe('창원시');
  });
});

// 기존 파서가 부산진구를 단일 토큰으로 보존하는지 회귀 가드
describe('parseAddress / extractCityDistrict — 부산진구 보존', () => {
  it('parseAddress는 부산진구를 통째로 잡는다', () => {
    expect(parseAddress('부산광역시 부산진구 가야대로 100')?.district).toBe('부산진구');
  });
  it('extractCityDistrict도 부산진구를 보존한다', () => {
    expect(extractCityDistrict('부산광역시 부산진구 가야대로 100').district).toBe('부산진구');
  });
});
