import { describe, it, expect } from 'vitest';
import {
  TITLE_COLUMNS,
  RECAP_COLUMNS,
  UNIT_COLUMNS,
  splitRow,
  parcelKeyString,
  parseTitleRow,
  parseRecapRow,
  parseUnitRow,
  shouldKeepTitle,
  isOffitelPurpose,
  dongNamesFromPlatPlc,
  type TitleRow,
} from '../../src/services/buildingRegisterParser.js';

// 2026-10 총괄표제부 파일 첫 행 그대로
const RECAP = '1050115|1|일반|1|총괄표제부|1|신대장|대구광역시 수성구 수성동4가 1125-14번지|대구광역시 수성구 들안로77길 27 (수성동4가)||27260|10600|0|1125|0014||||0|272604238182|10602|0|27|0|0|78.73|0|202.1|202.1|0|01000|단독주택|주택, 소매점|0|3|2|1|1|0|0|0|0|0|0|0|0|0|||||||||0||0|0||0||0|20221126';

/** 레이아웃 번호(1부터) → 값 으로 표제부 한 줄을 만든다 */
function titleLine(values: Record<number, string>): string {
  const cols = Array.from({ length: TITLE_COLUMNS.length }, (_, i) => values[i + 1] ?? '');
  return cols.join('|');
}

const YATAP_302 = titleLine({
  1: '41135-100204', 2: '2', 4: '3', 6: '경기도 성남시 분당구 야탑동 177번지', 8: '대원빌라3단지',
  9: '41135', 10: '10700', 11: '0', 12: '0177', 13: '0000', 23: '302동', 24: '0',
  33: '철근콘크리트구조', 35: '02002', 36: '공동주택', 37: '연립주택', 41: '32', 42: '0',
  44: '4', 45: '1', 46: '0', 47: '0', 51: '1', 53: '2', 55: '3', 57: '4', 61: '19941108', 67: '0',
});

describe('열 레이아웃', () => {
  it('레이아웃 열 수', () => {
    expect(TITLE_COLUMNS).toHaveLength(77);
    expect(RECAP_COLUMNS).toHaveLength(64);
    expect(UNIT_COLUMNS).toHaveLength(39);
    expect(TITLE_COLUMNS[0]).toBe('관리_건축물대장_PK');
    expect(UNIT_COLUMNS[37]).toBe('면적(㎡)');
  });
});

describe('splitRow', () => {
  it('열 수가 맞으면 그대로', () => expect(splitRow(RECAP, 64)).toHaveLength(64));
  it('끝에 | 가 하나 더 있으면 정상', () => expect(splitRow(`${RECAP}|`, 64)).toHaveLength(64));
  it('열 수가 다르면 null', () => {
    expect(splitRow('a|b', 64)).toBeNull();
    expect(splitRow(`${RECAP}|x`, 64)).toBeNull();
  });
});

describe('parseRecapRow', () => {
  it('총괄 실제 행', () => {
    const r = parseRecapRow(splitRow(RECAP, 64)!, '2026-09');
    expect(r).toMatchObject({
      mgmPk: '1050115', sggCode: '27260', bjdongCode: '10600', platGbCd: '0', bun: '1125', ji: '0014',
      bldNm: null, mainPurpsCdNm: '단독주택', hhldCnt: 0, fmlyCnt: 3, mainBldCnt: 2, totPkngCnt: 0,
      hoCnt: 0, useAprDay: null, sourceMonth: '2026-09',
    });
    expect(r.raw['대지_위치']).toBe('대구광역시 수성구 수성동4가 1125-14번지');
    expect(Object.keys(r.raw)).toHaveLength(64);
  });
});

describe('parseTitleRow', () => {
  it('표제부 값과 합계', () => {
    const r = parseTitleRow(splitRow(YATAP_302, 77)!, '2026-09');
    expect(r).toMatchObject({
      mgmPk: '41135-100204', sggCode: '41135', bjdongCode: '10700', platGbCd: '0', bun: '0177', ji: '0000',
      bldNm: '대원빌라3단지', dongNm: '302동', regstrGbCd: '2', regstrKindCd: '3', mainAtchGbCd: '0',
      mainPurpsCd: '02002', mainPurpsCdNm: '공동주택', etcPurps: '연립주택', hhldCnt: 32, fmlyCnt: 0, hoCnt: 0,
      grndFlrCnt: 4, ugrndFlrCnt: 1, elevatorCnt: 0, parkingCnt: 10, useAprDay: '19941108',
      strctCdNm: '철근콘크리트구조', sourceMonth: '2026-09',
    });
    expect(r.raw['건물_명']).toBe('대원빌라3단지');
  });

  it('빈 숫자·이상한 사용승인일은 null, 긴 문자열은 자른다', () => {
    const r = parseTitleRow(splitRow(titleLine({ 1: 'P', 2: '2', 4: '3', 24: '0', 37: '가'.repeat(600), 61: '1994', 46: '', 47: '' }), 77)!, '2026-09');
    expect(r.useAprDay).toBeNull();
    expect(r.elevatorCnt).toBeNull();
    expect(r.parkingCnt).toBeNull();
    expect(r.etcPurps).toHaveLength(500);
  });
});

describe('parseUnitRow', () => {
  it('전유 오피스텔 호실', () => {
    const cols = Array.from({ length: 39 }, () => '');
    Object.assign(cols, { 7: '아크로텔 강남역', 8: '11650', 9: '10800', 10: '0', 11: '1337', 12: '0002', 21: '', 22: '1201호', 26: '1', 35: '오피스텔', 36: '오피스텔(업무시설)' });
    expect(parseUnitRow(cols)).toEqual({
      key: { sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002' },
      bldNm: '아크로텔 강남역', dongNm: '', hoNm: '1201호', isExclusive: true, isOffitel: true,
    });
  });
});

describe('parcelKeyString', () => {
  it('지번 키 문자열', () => {
    expect(parcelKeyString({ sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002' }))
      .toBe('11650|10800|0|1337|0002');
  });
});

describe('shouldKeepTitle', () => {
  it('집합 대장 전부 + 일반 대장 공동주택', () => {
    expect(shouldKeepTitle({ regstrGbCd: '2', mainPurpsCd: '14000' } as TitleRow)).toBe(true);
    expect(shouldKeepTitle({ regstrGbCd: '1', mainPurpsCd: '02003' } as TitleRow)).toBe(true);
    expect(shouldKeepTitle({ regstrGbCd: '1', mainPurpsCd: '01000' } as TitleRow)).toBe(false);
    expect(shouldKeepTitle({ regstrGbCd: '1', mainPurpsCd: null } as TitleRow)).toBe(false);
  });
});

describe('isOffitelPurpose', () => {
  it('주용도·기타용도 어느 쪽이든', () => {
    expect(isOffitelPurpose('오피스텔', '오피스텔(업무시설)')).toBe(true);
    expect(isOffitelPurpose('업무시설', '업무시설(오피스텔)')).toBe(true);
    expect(isOffitelPurpose('소매점', '제1종근린생활시설(소매점)')).toBe(false);
    expect(isOffitelPurpose(null, null)).toBe(false);
  });
});

describe('dongNamesFromPlatPlc', () => {
  it('동·가', () => expect(dongNamesFromPlatPlc('대구광역시 수성구 수성동4가 1125-14번지')).toEqual(['수성동4가']));
  it('읍면 + 리', () => {
    expect(dongNamesFromPlatPlc('충청북도 청주시 흥덕구 오송읍 서평리 123번지')).toEqual(['서평리', '오송읍 서평리']);
  });
  it('산 지번', () => {
    expect(dongNamesFromPlatPlc('경기도 성남시 분당구 야탑동 산 12-3번지')).toEqual(['야탑동']);
    expect(dongNamesFromPlatPlc('경기도 성남시 분당구 야탑동 산12-3번지')).toEqual(['야탑동']);
  });
  it('외 필지', () => expect(dongNamesFromPlatPlc('서울특별시 서초구 서초동 1337-2번지 외 1필지')).toEqual(['서초동']));
  it('지번이 없으면 빈 목록', () => expect(dongNamesFromPlatPlc('')).toEqual([]));
});
