import { describe, it, expect } from 'vitest';
import { OffitelUnitCounter } from '../../src/services/buildingRegisterUnitCounter.js';
import type { ParcelKey, UnitRow } from '../../src/services/buildingRegisterParser.js';

const ACROTEL: ParcelKey = { sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002' };
const OTHER: ParcelKey = { ...ACROTEL, bun: '1338' };
const TARGETS = new Set(['11650|10800|0|1337|0002']);

function unit(hoNm: string, isOffitel: boolean, extra: Partial<UnitRow> = {}): UnitRow {
  return { key: ACROTEL, bldNm: '아크로텔 강남역', dongNm: '', hoNm, isExclusive: true, isOffitel, ...extra };
}

describe('OffitelUnitCounter', () => {
  it('아크로텔 강남역: 전유 540호 중 오피스텔 471호', () => {
    const counter = new OffitelUnitCounter(TARGETS);
    // 오피스텔 호실은 전유 행이 2개씩 온다(층·면적 나눔)
    for (let i = 0; i < 471; i++) {
      counter.add(unit(`${i}호`, true));
      counter.add(unit(`${i}호`, true));
    }
    for (let i = 0; i < 67; i++) counter.add(unit(`상가${i}`, false));
    for (let i = 0; i < 2; i++) counter.add(unit(`학원${i}`, false));
    for (let i = 0; i < 100; i++) counter.add(unit(`${i}호`, false, { isExclusive: false })); // 공용
    for (let i = 0; i < 50; i++) counter.add(unit(`${i}호`, true, { key: OTHER })); // 대상 아닌 지번

    expect(counter.results('2026-09')).toEqual([{
      sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002',
      bldNm: '아크로텔 강남역', dongNm: '', offitelUnits: 471, totalUnits: 540, sourceMonth: '2026-09',
    }]);
  });

  it('한 호실에 소매점 행과 오피스텔 행이 있으면 오피스텔 1호', () => {
    const counter = new OffitelUnitCounter(TARGETS);
    counter.add(unit('101호', false));
    counter.add(unit('101호', true));
    expect(counter.results('2026-09')[0]).toMatchObject({ offitelUnits: 1, totalUnits: 1 });
  });

  it('동이 다르면 따로 센다', () => {
    const counter = new OffitelUnitCounter(TARGETS);
    counter.add(unit('101호', true, { dongNm: 'A동' }));
    counter.add(unit('101호', true, { dongNm: 'B동' }));
    expect(counter.results('2026-09').map((r) => [r.dongNm, r.offitelUnits])).toEqual([['A동', 1], ['B동', 1]]);
  });
});
