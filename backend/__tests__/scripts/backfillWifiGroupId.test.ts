import { describe, it, expect } from 'vitest';
import { buildGroupIdUpdateSql } from '../../src/scripts/backfillWifiGroupId.js';
import { buildWifiGroupId } from '../../src/services/wifiGroup.js';

const ROWS = [
  { id: 'wifi-aaa', name: '경의선숲길', city: '서울', district: '마포구', address: null },
  { id: 'wifi-bbb', name: '경의선숲길', city: '서울', district: '마포구', address: null },
  { id: 'wifi-ccc', name: '서울식물원', city: '서울', district: '강서구', address: '마곡동로 161' },
];

describe('buildGroupIdUpdateSql', () => {
  it('행마다 계산된 groupId 를 CASE 로 매핑한다', () => {
    const { sql, params } = buildGroupIdUpdateSql(ROWS);

    expect(sql).toContain('UPDATE Wifi SET `groupId` = CASE `id`');
    expect(sql).toContain('WHEN ? THEN ?');
    expect(sql).toContain('WHERE `id` IN (?, ?, ?)');

    const gA = buildWifiGroupId(ROWS[0]);
    const gC = buildWifiGroupId(ROWS[2]);
    // CASE 파라미터가 (id, groupId) 쌍으로 순서대로 들어가고, 마지막에 WHERE 용 id 들이 붙는다
    expect(params).toEqual([
      'wifi-aaa', gA,
      'wifi-bbb', gA,
      'wifi-ccc', gC,
      'wifi-aaa', 'wifi-bbb', 'wifi-ccc',
    ]);
  });

  it('같은 장소의 행들은 동일한 groupId 를 받는다', () => {
    const { params } = buildGroupIdUpdateSql(ROWS);
    expect(params[1]).toBe(params[3]);
    expect(params[1]).not.toBe(params[5]);
  });

  it('빈 배열이면 null 을 준다 — 빈 IN () 로 SQL 문법 오류를 내지 않게', () => {
    expect(buildGroupIdUpdateSql([])).toBeNull();
  });

  it('식별자를 백틱으로 감싸 예약어 충돌을 피하고, 값은 전부 파라미터로만 넣는다', () => {
    const { sql, params } = buildGroupIdUpdateSql([
      { id: "wifi-x'; DROP TABLE Wifi; --", name: '가', city: '서울', district: '중구', address: null },
    ]);
    // 값이 SQL 문자열에 직접 박히지 않아야 한다
    expect(sql).not.toContain('DROP TABLE');
    expect(params).toContain("wifi-x'; DROP TABLE Wifi; --");
  });
});
