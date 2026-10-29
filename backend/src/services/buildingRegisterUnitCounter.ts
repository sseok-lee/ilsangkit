// 전유공용면적(건축HUB 0306) 줄을 받아 오피스텔 호실을 센다.
// 대장 호수 합계에는 상가·학원 호실이 섞인다(아크로텔 강남역 540 = 오피스텔 471 + 소매점 67 + 학원 2).
// 전국 호실을 다 모으면 키가 수백만 개라 메모리를 넘으므로, 표제부에서 고른 대상 지번만 센다.

import { parcelKeyString, type ParcelKey, type UnitRow } from './buildingRegisterParser.js';

export interface UnitCountRow extends ParcelKey {
  bldNm: string;
  dongNm: string;
  offitelUnits: number;
  totalUnits: number;
  sourceMonth: string;
}

interface Group {
  key: ParcelKey;
  bldNm: string;
  dongNm: string;
  /** 호명 → 오피스텔 여부(한 호실에 오피스텔 행이 하나라도 있으면 true) */
  units: Map<string, boolean>;
}

export class OffitelUnitCounter {
  private readonly groups = new Map<string, Group>();

  constructor(private readonly targets: Set<string>) {}

  add(row: UnitRow): void {
    if (!row.isExclusive) return;
    const parcel = parcelKeyString(row.key);
    if (!this.targets.has(parcel)) return;
    const groupKey = `${parcel}|${row.bldNm}|${row.dongNm}`;
    let group = this.groups.get(groupKey);
    if (!group) {
      group = { key: row.key, bldNm: row.bldNm, dongNm: row.dongNm, units: new Map() };
      this.groups.set(groupKey, group);
    }
    group.units.set(row.hoNm, (group.units.get(row.hoNm) ?? false) || row.isOffitel);
  }

  results(sourceMonth: string): UnitCountRow[] {
    return [...this.groups.values()].map((group) => ({
      ...group.key,
      bldNm: group.bldNm,
      dongNm: group.dongNm,
      offitelUnits: [...group.units.values()].filter(Boolean).length,
      totalUnits: group.units.size,
      sourceMonth,
    }));
  }
}
