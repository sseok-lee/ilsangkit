import { describe, it, expect } from 'vitest';
import {
  resolveGeocodeAddress,
  needsGeocoding,
  type GeocodeCandidate,
} from '../../src/scripts/geocodeSchool.js';

/**
 * 지오코딩 대상 선정.
 *
 * ## 왜 `lat IS NULL` 만으로는 부족한가
 *
 * 학교가 이전하면 sync 가 주소를 갱신하지만 좌표는 그대로 남는다. 좌표가 있으니
 * `lat IS NULL` 에 걸리지 않아 옛 위치를 계속 가리킨다. 2026-09-09 실측에서
 * 12,540행 중 63건이 그 상태였다 — 여명학교(중구 남산 → 강서구 가양동) 10.7km,
 * 호연고 34.5km, 내덕초 200km.
 *
 * 그 63건은 전량 재지오코딩(12,540 콜)으로 찾아냈다. 원인이 "주소 변경"이므로
 * 바뀐 행만 알면 몇 건으로 끝난다.
 *
 * ## 왜 좌표를 비우지 않고 `geocodedAddress` 를 두는가
 *
 * "주소가 바뀌면 lat/lng 을 NULL 로 만들고 기존 경로가 줍게 한다"가 더 간단하지만,
 * 같은 실측에서 73건은 카카오가 주소를 찾지 못했다(no-result). 그런 행의 주소가
 * 바뀌면 좌표를 비운 뒤 다시 채우지 못해 지도가 사라진다. 좌표를 유지한 채
 * "이 좌표가 어느 주소로 만들어졌는지"를 기록하면 실패해도 옛 좌표가 남는다.
 *
 * ## 왜 geocodedAddress 가 NULL 이면 건드리지 않는가
 *
 * 기존 12,540행의 좌표는 표준데이터 CSV 의 측량 좌표에서 왔고, 카카오 도로명
 * 중심점보다 정확한 경우가 많다. 같은 실측에서 200m 초과 95건을 학교명 키워드
 * 검색으로 교차검증하니 32건은 저장 좌표가 더 정확했다 — 평택고는 주소 지오코딩이
 * 1,746m 벗어났고, 인천 석정로 165 는 5개교가 한 주소라 단지 입구로 찍혔다.
 * 출처를 모르는 좌표를 일괄로 덮으면 그런 행이 나빠진다.
 */

function candidate(overrides: Partial<GeocodeCandidate> = {}): GeocodeCandidate {
  return {
    id: 'school-7010112',
    name: '청담고등학교',
    address: '서울특별시 서초구 신반포로23길 66',
    roadAddress: '서울특별시 서초구 신반포로23길 66',
    geocodedAddress: '서울특별시 서초구 신반포로23길 66',
    lat: 37.51,
    lng: 127.0,
    ...overrides,
  };
}

describe('resolveGeocodeAddress - 어느 주소를 쓰는가', () => {
  it('도로명주소를 우선한다', () => {
    expect(resolveGeocodeAddress(candidate())).toBe('서울특별시 서초구 신반포로23길 66');
  });

  it('도로명주소가 없으면 지번주소를 쓴다', () => {
    const c = candidate({ roadAddress: null, address: '서울특별시 서초구 잠원동 1' });
    expect(resolveGeocodeAddress(c)).toBe('서울특별시 서초구 잠원동 1');
  });

  it('둘 다 없으면 빈 문자열', () => {
    expect(resolveGeocodeAddress(candidate({ roadAddress: null, address: null }))).toBe('');
  });

  it('공백만 있는 도로명주소는 없는 것으로 본다', () => {
    const c = candidate({ roadAddress: '   ', address: '서울특별시 서초구 잠원동 1' });
    expect(resolveGeocodeAddress(c)).toBe('서울특별시 서초구 잠원동 1');
  });
});

describe('needsGeocoding - 좌표 없음', () => {
  it('lat 이 없으면 대상이다', () => {
    expect(needsGeocoding(candidate({ lat: null }))).toBe(true);
  });

  it('lng 이 없으면 대상이다', () => {
    expect(needsGeocoding(candidate({ lng: null }))).toBe(true);
  });

  it('좌표가 없으면 geocodedAddress 가 NULL 이어도 대상이다', () => {
    // 신규 행은 출처를 따질 좌표 자체가 없다.
    expect(needsGeocoding(candidate({ lat: null, lng: null, geocodedAddress: null }))).toBe(true);
  });

  it('주소가 아예 없으면 대상이 아니다 - 지오코딩할 재료가 없다', () => {
    const c = candidate({ lat: null, lng: null, roadAddress: null, address: null });
    expect(needsGeocoding(c)).toBe(false);
  });
});

describe('needsGeocoding - 주소 변경', () => {
  it('geocodedAddress 와 현재 주소가 다르면 대상이다', () => {
    // 여명학교: 중구 남산 → 강서구 가양동 이전
    const c = candidate({
      geocodedAddress: '서울특별시 중구 소파로 21',
      roadAddress: '서울특별시 강서구 허준로 221-22',
    });
    expect(needsGeocoding(c)).toBe(true);
  });

  it('같으면 대상이 아니다', () => {
    expect(needsGeocoding(candidate())).toBe(false);
  });

  it('앞뒤 공백 차이만으로는 대상이 되지 않는다', () => {
    // sync 가 주소를 조립하며 공백이 붙고 떨어지는 것만으로 12,540 콜이 나가면 안 된다.
    const c = candidate({ geocodedAddress: '  서울특별시 서초구 신반포로23길 66  ' });
    expect(needsGeocoding(c)).toBe(false);
  });

  it('도로명주소가 비고 지번주소로 바뀌면 지번주소 기준으로 판정한다', () => {
    const c = candidate({
      roadAddress: null,
      address: '서울특별시 서초구 잠원동 1',
      geocodedAddress: '서울특별시 서초구 신반포로23길 66',
    });
    expect(needsGeocoding(c)).toBe(true);
  });
});

describe('needsGeocoding - 출처 불명 좌표는 건드리지 않는다', () => {
  it('geocodedAddress 가 NULL 이고 좌표가 있으면 대상이 아니다', () => {
    // 표준데이터 CSV 측량 좌표. 카카오 도로명 중심점보다 정확한 경우가 많아
    // 일괄로 덮으면 나빠진다(실측 95건 중 32건).
    expect(needsGeocoding(candidate({ geocodedAddress: null }))).toBe(false);
  });

  it('geocodedAddress 가 빈 문자열이어도 대상이 아니다', () => {
    expect(needsGeocoding(candidate({ geocodedAddress: '' }))).toBe(false);
  });

  it('출처 불명이어도 좌표가 없으면 대상이다', () => {
    expect(needsGeocoding(candidate({ geocodedAddress: null, lat: null }))).toBe(true);
  });
});
