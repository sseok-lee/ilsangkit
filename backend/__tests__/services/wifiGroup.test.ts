import { describe, it, expect } from 'vitest';
import { buildWifiGroupId, wifiGroupKeyParts } from '../../src/services/wifiGroup.js';

describe('buildWifiGroupId', () => {
  it('같은 (name, city, district, address) 는 같은 id 를 만든다', () => {
    const a = buildWifiGroupId({
      name: '경의선숲길', city: '서울', district: '마포구', address: '서울특별시 마포구 와우산로 79',
    });
    const b = buildWifiGroupId({
      name: '경의선숲길', city: '서울', district: '마포구', address: '서울특별시 마포구 와우산로 79',
    });
    expect(a).toBe(b);
  });

  it('address 가 다르면 다른 id 를 만든다 — 버스정류장 37km 오병합 방지', () => {
    const a = buildWifiGroupId({ name: '버스정류장', city: '경기', district: '파주시', address: '경기도 파주시 금촌동 1' });
    const b = buildWifiGroupId({ name: '버스정류장', city: '경기', district: '파주시', address: '경기도 파주시 문산읍 2' });
    expect(a).not.toBe(b);
  });

  it('같은 이름이라도 구가 다르면 다른 id 를 만든다', () => {
    const a = buildWifiGroupId({ name: '주민센터', city: '서울', district: '마포구', address: null });
    const b = buildWifiGroupId({ name: '주민센터', city: '서울', district: '강서구', address: null });
    expect(a).not.toBe(b);
  });

  it('address 가 null 이든 빈 문자열이든 같은 그룹으로 접는다 — 에스플렉스센터(주소 전량 NULL) 케이스', () => {
    const a = buildWifiGroupId({ name: '에스플렉스센터', city: '서울', district: '마포구', address: null });
    const b = buildWifiGroupId({ name: '에스플렉스센터', city: '서울', district: '마포구', address: '' });
    expect(a).toBe(b);
  });

  it('앞뒤 공백은 무시한다 — 원본 CSV 공백 드리프트로 그룹이 갈라지지 않게', () => {
    const a = buildWifiGroupId({ name: ' 서울식물원 ', city: '서울', district: '강서구', address: ' 서울특별시 강서구 마곡동로 161 ' });
    const b = buildWifiGroupId({ name: '서울식물원', city: '서울', district: '강서구', address: '서울특별시 강서구 마곡동로 161' });
    expect(a).toBe(b);
  });

  it('기존 상세 id(wifi-<hex12>) 와 네임스페이스가 겹치지 않는다', () => {
    const id = buildWifiGroupId({ name: '경의선숲길', city: '서울', district: '마포구', address: null });
    // 기존 id 는 'wifi-' + 16진수 12자. 그룹 id 는 'wifi-g' 로 시작해 절대 겹치지 않는다.
    expect(id).toMatch(/^wifi-g[0-9a-f]{12}$/);
    expect(id).not.toMatch(/^wifi-[0-9a-f]{12}$/);
  });

  it('robots.txt 의 AI 크롤러 차단 규칙(/wifi/wifi-) 이 그대로 적용되는 접두사를 쓴다', () => {
    const id = buildWifiGroupId({ name: '해운대 백병원', city: '부산', district: '해운대구', address: null });
    expect(`/wifi/${id}`.startsWith('/wifi/wifi-')).toBe(true);
  });

  it('구분자가 값 안에 들어가도 그룹이 섞이지 않는다', () => {
    // '가|나' + '다' 와 '가' + '나|다' 가 같은 문자열로 접히면 안 된다
    const a = buildWifiGroupId({ name: '가|나', city: '서울', district: '다', address: null });
    const b = buildWifiGroupId({ name: '가', city: '서울', district: '나|다', address: null });
    expect(a).not.toBe(b);
  });
});

describe('wifiGroupKeyParts', () => {
  it('정규화된 키 구성요소를 그대로 돌려준다 — SQL GROUP BY 와 앱 계산이 어긋나지 않게', () => {
    expect(wifiGroupKeyParts({ name: ' 서울식물원 ', city: '서울', district: '강서구', address: null }))
      .toEqual({ name: '서울식물원', city: '서울', district: '강서구', address: '' });
  });
});
