import { describe, it, expect } from 'vitest';
import {
  parseParcel,
  splitDongName,
  dongMatches,
  normalizeComplexName,
  nameNumbers,
  isNameMatch,
} from '../../src/services/kaptComplexMatcher.js';

describe('parseParcel', () => {
  it('본번·부번·산 지번을 파싱한다', () => {
    expect(parseParcel('649')).toEqual({ isMountain: false, mainNo: 649, subNo: 0 });
    expect(parseParcel('649-1')).toEqual({ isMountain: false, mainNo: 649, subNo: 1 });
    expect(parseParcel('산12-3')).toEqual({ isMountain: true, mainNo: 12, subNo: 3 });
    expect(parseParcel(' 0649-0001 ')).toEqual({ isMountain: false, mainNo: 649, subNo: 1 });
  });

  it('블록·가지번·빈 값은 null', () => {
    expect(parseParcel('가-240')).toBeNull();
    expect(parseParcel('BL')).toBeNull();
    expect(parseParcel('')).toBeNull();
    expect(parseParcel(null)).toBeNull();
    expect(parseParcel(undefined)).toBeNull();
    expect(parseParcel('0')).toBeNull();
  });
});

describe('splitDongName / dongMatches', () => {
  it('읍 리 두 토큰을 나눈다', () => {
    expect(splitDongName('오송읍 서평리')).toEqual({ eupmyeon: '오송읍', dongri: '서평리' });
    expect(splitDongName('개포동')).toEqual({ eupmyeon: null, dongri: '개포동' });
  });

  it('dongri 가 같으면 연결, 읍면이 다르면 불연결', () => {
    expect(dongMatches(splitDongName('개포동'), { eupmyeon: null, dongri: '개포동' })).toBe(true);
    expect(dongMatches(splitDongName('오송읍 서평리'), { eupmyeon: '오송읍', dongri: '서평리' })).toBe(true);
    expect(dongMatches(splitDongName('강내면 서평리'), { eupmyeon: '오송읍', dongri: '서평리' })).toBe(false);
    expect(dongMatches(splitDongName('구로동'), { eupmyeon: null, dongri: '개봉동' })).toBe(false);
  });

  it('K-apt dongri 가 비면 eupmyeon 과 비교한다', () => {
    expect(dongMatches(splitDongName('오송읍'), { eupmyeon: '오송읍', dongri: null })).toBe(true);
    expect(dongMatches(splitDongName('오송읍'), { eupmyeon: '오송읍', dongri: '' })).toBe(true);
  });
});

describe('normalizeComplexName / nameNumbers', () => {
  it('표기를 통일한다', () => {
    expect(normalizeComplexName('천안두정엘에이치2단지')).toBe(normalizeComplexName('천안두정 LH2단지'));
    expect(normalizeComplexName('테헤란아이파크')).toBe(normalizeComplexName('테헤란 IPARK'));
    expect(normalizeComplexName("테헤란 I'PARK")).toBe(normalizeComplexName('테헤란아이파크'));
    expect(normalizeComplexName('e편한세상 수지')).toBe(normalizeComplexName('이-편한세상수지'));
    expect(normalizeComplexName('래미안 플래티넘')).toBe(normalizeComplexName('래미안플레티넘'));
    expect(normalizeComplexName('에스케이뷰')).toBe(normalizeComplexName('SK뷰'));
    expect(normalizeComplexName('개포경남아파트')).toBe('개포경남');
    expect(normalizeComplexName('고척아이파크(주상복합)')).toBe('고척ipark');
  });

  it('숫자 열을 뽑고 로마 숫자를 환산한다', () => {
    expect(nameNumbers('크라운빌Ⅱ')).toEqual(['2']);
    expect(nameNumbers('해운대자이2단지')).toEqual(['2']);
    expect(nameNumbers('해운대자이')).toEqual([]);
    expect(nameNumbers('수서1-1단지(임대)')).toEqual(['1', '1']);
  });
});

describe('isNameMatch (스펙 §4.3 실제 사례)', () => {
  const cases: Array<[string, number, string, string, boolean]> = [
    ['동일센타시아', 2024, '남구로역 동일센타시아', '20240115', true],
    ['천안두정엘에이치2단지', 2022, '천안두정 LH2단지', '20220301', true],
    ['테헤란아이파크', 2014, '테헤란 IPARK', '20140520', true],
    ['크라운빌Ⅱ', 2021, '크라운빌', '20150101', false],
    ['해운대자이2단지', 2013, '해운대자이', '20130101', false],
    ['센텀리슈빌2단지', 2019, '센텀리슈빌', '20170101', false],
  ];
  it.each(cases)('%s(%i) ↔ %s → %s', (localName, buildYear, kaptName, approval, expected) => {
    expect(isNameMatch({ name: localName, buildYear }, { name: kaptName, useApprovalDate: approval })).toBe(expected);
  });

  it('연식이 한쪽이라도 없으면 불연결', () => {
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: null }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(false);
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2014 }, { name: '테헤란 IPARK', useApprovalDate: null })).toBe(false);
  });

  it('연식 차이 1년은 허용, 2년은 불연결', () => {
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2015 }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(true);
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2016 }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(false);
  });

  it('정규화 이름 2자 이하는 포함 매칭을 허용하지 않는다', () => {
    expect(isNameMatch({ name: '삼익', buildYear: 1990 }, { name: '서초삼익', useApprovalDate: '19900101' })).toBe(false);
    expect(isNameMatch({ name: '삼익', buildYear: 1990 }, { name: '삼익아파트', useApprovalDate: '19900101' })).toBe(true);
  });
});
