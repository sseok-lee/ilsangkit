import { describe, it, expect } from 'vitest';
import { slugifyStation, lineSuffix } from '../../src/utils/subwaySlug.js';

describe('lineSuffix', () => {
  it('한국어 N호선 → lineN', () => {
    expect(lineSuffix('2호선', 'S1102')).toBe('line2');
    expect(lineSuffix('9호선', 'S1109')).toBe('line9');
  });

  it('한국어 노선명 → ASCII만 추출', () => {
    expect(lineSuffix('신분당선', 'I11D1')).toBe('i11d1'); // 한글이 ASCII 0이라 lineNumber로 fallback
    expect(lineSuffix('Bundang Line', 'I4105')).toBe('bundangline');
  });

  it('빈 입력은 unknown', () => {
    expect(lineSuffix('', '')).toBe('unknown');
  });
});

describe('slugifyStation', () => {
  it('영문역사명 우선 사용', () => {
    const taken = new Set<string>();
    expect(
      slugifyStation({
        englishName: 'Gangnam',
        koreanName: '강남',
        lineName: '2호선',
        lineNumber: 'S1102',
        takenSlugs: taken,
      }),
    ).toBe('gangnam');
    expect(taken.has('gangnam')).toBe(true);
  });

  it('영문명 공백·특수문자 → 하이픈', () => {
    const taken = new Set<string>();
    expect(
      slugifyStation({
        englishName: "Gangnam-gu Office",
        koreanName: '강남구청',
        lineName: '7호선',
        lineNumber: 'S1107',
        takenSlugs: taken,
      }),
    ).toBe('gangnam-gu-office');
  });

  it('충돌 시 노선 suffix 부여 (deterministic)', () => {
    const taken = new Set<string>(['city-hall']);
    expect(
      slugifyStation({
        englishName: 'City Hall',
        koreanName: '시청',
        lineName: '1호선',
        lineNumber: 'S1101',
        takenSlugs: taken,
      }),
    ).toBe('city-hall-line1');
  });

  it('두 번 충돌 시 -2 suffix', () => {
    const taken = new Set<string>(['city-hall', 'city-hall-line1']);
    const slug = slugifyStation({
      englishName: 'City Hall',
      koreanName: '시청',
      lineName: '1호선',
      lineNumber: 'S1101',
      takenSlugs: taken,
    });
    expect(slug).toBe('city-hall-line1-2');
  });

  it('영문명 없으면 station fallback', () => {
    const taken = new Set<string>();
    const slug = slugifyStation({
      englishName: '',
      koreanName: '강남',
      lineName: '2호선',
      lineNumber: 'S1102',
      takenSlugs: taken,
    });
    // baseSlug('강남') === '' → fallback 'station'
    expect(slug).toBe('station');
  });

  it('순차 호출 시 takenSlugs 누적', () => {
    const taken = new Set<string>();
    const a = slugifyStation({
      englishName: 'Gongdeok',
      koreanName: '공덕',
      lineName: '5호선',
      lineNumber: 'S1105',
      takenSlugs: taken,
    });
    const b = slugifyStation({
      englishName: 'Gongdeok',
      koreanName: '공덕',
      lineName: '6호선',
      lineNumber: 'S1106',
      takenSlugs: taken,
    });
    const c = slugifyStation({
      englishName: 'Gongdeok',
      koreanName: '공덕',
      lineName: '경의중앙선',
      lineNumber: 'I4101',
      takenSlugs: taken,
    });
    expect(a).toBe('gongdeok');
    expect(b).toBe('gongdeok-line6');
    expect(c).toBe('gongdeok-i4101');
  });
});
