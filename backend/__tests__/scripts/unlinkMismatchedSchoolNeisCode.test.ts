import { describe, it, expect } from 'vitest';
import {
  isAdminReorgTransition,
  shouldUnlinkNeisCode,
} from '../../src/scripts/unlinkMismatchedSchoolNeisCode.js';

/**
 * 오연결된 neisSchoolCode 를 끊을 대상 판정.
 *
 * mergeSchoolNeis 가 학교명만으로 매칭해 동명 타 학교 코드를 박은 행이 있다. 표준데이터
 * 정본(도로명주소 → resolveSchoolRegion)과 DB 의 city/district 가 어긋나면 그 링크는 틀렸다.
 *
 * 단 어긋남이 곧 오염은 아니다. 2026 인천 행정구역 개편(중구·동구·서구 → 제물포구·영종구·
 * 서해구·검단구)은 DB 가 최신이고 표준데이터 원본(기준일 2025-09-22)이 옛 구명을 담고 있다.
 * 실측 1,070건 중 141건이 이 개편이었고, 이를 제외한 929건이 실제 링크 오류다.
 */

const cmp = (dbCity: string, dbDistrict: string, authCity: string, authDistrict: string) => ({
  dbCity,
  dbDistrict,
  authoritativeCity: authCity,
  authoritativeDistrict: authDistrict,
});

describe('isAdminReorgTransition - 행정구역 개편은 오염이 아니다', () => {
  it('2026 인천 개편 전이를 개편으로 판정한다', () => {
    // 실측 건수: 서구→서해구 61, 서구→검단구 33, 중구→영종구 22, 중구→제물포구 15, 동구→제물포구 10
    expect(isAdminReorgTransition(cmp('인천', '서해구', '인천', '서구'))).toBe(true);
    expect(isAdminReorgTransition(cmp('인천', '검단구', '인천', '서구'))).toBe(true);
    expect(isAdminReorgTransition(cmp('인천', '영종구', '인천', '중구'))).toBe(true);
    expect(isAdminReorgTransition(cmp('인천', '제물포구', '인천', '중구'))).toBe(true);
    expect(isAdminReorgTransition(cmp('인천', '제물포구', '인천', '동구'))).toBe(true);
  });

  it('개편 방향이 반대면 개편이 아니다', () => {
    // DB 가 옛 구명이고 정본이 신설구면 개편 반영이 아니라 다른 문제다.
    expect(isAdminReorgTransition(cmp('인천', '중구', '인천', '제물포구'))).toBe(false);
  });

  it('시/도가 다르면 개편이 아니다', () => {
    expect(isAdminReorgTransition(cmp('경기', '제물포구', '인천', '중구'))).toBe(false);
  });

  it('개편 목록에 없는 시군구 전이는 개편이 아니다', () => {
    expect(isAdminReorgTransition(cmp('경남', '양산시', '경남', '창원시'))).toBe(false);
    expect(isAdminReorgTransition(cmp('서울', '중구', '서울', '마포구'))).toBe(false);
    expect(isAdminReorgTransition(cmp('경기', '안산시', '경기', '수원시'))).toBe(false);
  });

  it('지역이 같으면 전이가 아니다', () => {
    expect(isAdminReorgTransition(cmp('인천', '중구', '인천', '중구'))).toBe(false);
  });
});

describe('shouldUnlinkNeisCode - 링크를 끊을 대상', () => {
  it('링크가 없으면 끊을 것이 없다', () => {
    expect(shouldUnlinkNeisCode({ neisSchoolCode: null, ...cmp('충남', '천안시', '서울', '동대문구') })).toBe(false);
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '', ...cmp('충남', '천안시', '서울', '동대문구') })).toBe(false);
  });

  it('지역이 일치하면 끊지 않는다', () => {
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '7021119', ...cmp('서울', '동대문구', '서울', '동대문구') })).toBe(false);
  });

  it('시/도가 다르면 끊는다', () => {
    // 실제 사고 행: 은석초등학교(서울 동대문) → 충남 천안 은석초 코드 8151065
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '8151065', ...cmp('충남', '천안시', '서울', '동대문구') })).toBe(true);
    // school-B000012035 서울 영등포 영신고 → 대구 영신고
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '7240097', ...cmp('대구', '동구', '서울', '영등포구') })).toBe(true);
  });

  it('행정구역 개편으로 설명되는 차이는 끊지 않는다', () => {
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '7031045', ...cmp('인천', '제물포구', '인천', '중구') })).toBe(false);
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '7031046', ...cmp('인천', '서해구', '인천', '서구') })).toBe(false);
  });

  it('같은 시/도 안에서 개편이 아닌 시군구 차이는 끊는다', () => {
    // 실측 17건. 창원시 학교가 양산시 코드를 물고 있는 식이다.
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '9151007', ...cmp('경남', '양산시', '경남', '창원시') })).toBe(true);
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '7010001', ...cmp('서울', '중구', '서울', '마포구') })).toBe(true);
  });

  it('정본 지역을 못 구한 경우에는 끊지 않는다', () => {
    // 판단 근거가 없으면 건드리지 않는다(fail-safe).
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '8151065', ...cmp('충남', '천안시', '', '') })).toBe(false);
    expect(shouldUnlinkNeisCode({ neisSchoolCode: '8151065', ...cmp('충남', '천안시', '서울', '') })).toBe(false);
  });
});
