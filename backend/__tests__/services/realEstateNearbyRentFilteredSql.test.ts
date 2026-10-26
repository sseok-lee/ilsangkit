import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRaw: vi.fn(), $queryRawUnsafe: vi.fn() };
  return { prisma, default: prisma };
});

import { LATEST_DEAL_INDEX } from '../../src/services/realEstateLatestDeals.js';
import { nearbyRentFilteredSql } from '../../src/services/realEstateService.js';

function text(sql: Prisma.Sql): string {
  return sql.strings.join('?').replace(/\s+/g, ' ');
}

const BASE = { dongName: null, excludeBuildingName: null, limitPerType: 4 };

// 인근 단지 전세/월세 필터 SQL — 동 전체 거래 창 정렬 대신 파티션 집계 + 고른 파티션만 인덱스 LIMIT 1.
// 결과 동등성은 로컬·운영 대조 스크립트로 확인하고, 여기서는 그 근거가 되는 SQL 모양을 고정한다.
describe('nearbyRentFilteredSql', () => {
  it('1단계: 옛 PARTITION BY 와 같은 식으로 GROUP BY 집계만 하고 창 함수는 쓰지 않는다', () => {
    const sql = nearbyRentFilteredSql('apt', '11350', 'jeonse', BASE);
    const t = text(sql);
    expect(t).not.toContain('ROW_NUMBER');
    expect(t).toContain("GROUP BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')");
    expect(t).toContain('COUNT(*) AS transactionCount');
    expect(t).toContain('MAX(t.dealYear * 100 + t.dealMonth) AS latestYm');
  });

  it('정렬 키는 옛과 같은 (최신 연·월 DESC, 건수 DESC) 뿐이다 — 동률 tie-break 를 새로 넣지 않는다', () => {
    const t = text(nearbyRentFilteredSql('apt', '11350', 'jeonse', BASE));
    expect(t).toContain('ORDER BY latestYm DESC, transactionCount DESC LIMIT ?');
    expect(t.trim().endsWith('ORDER BY g.latestYm DESC, g.transactionCount DESC')).toBe(true);
  });

  it('2단계: 고른 파티션마다 LATERAL 로 최신 1건을 [buildingName, bjdCode, dealYear, dealMonth, dealDay] 인덱스로 읽는다', () => {
    const t = text(nearbyRentFilteredSql('offitel', '28185', 'wolse', BASE));
    expect(t).toContain('INNER JOIN LATERAL');
    expect(t).toContain(`/*+ INDEX(lt ${LATEST_DEAL_INDEX.OffitelRentTransaction}) */`);
    expect(t).toContain(
      "WHERE lt.buildingName = g.buildingName AND lt.bjdCode = g.bjdCode AND TRIM(lt.dongName) = g.dongKey AND COALESCE(TRIM(lt.jibun), '') = g.jibunKey",
    );
    // dealDay DESC 는 NULL 을 맨 뒤에 두므로 옛 COALESCE(dealDay, 0) DESC 와 같은 순서(일자 1 이상).
    expect(t).toContain('ORDER BY lt.dealYear DESC, lt.dealMonth DESC, lt.dealDay DESC, lt.id DESC LIMIT 1');
  });

  it('표시 값(이름·동·지번·city·district·buildYear)은 옛 rn = 1 행과 같은 최신 행에서 꺼낸다', () => {
    const t = text(nearbyRentFilteredSql('apt', '11350', 'jeonse', BASE));
    expect(t).toContain('SELECT latest.buildingName, latest.bjdCode, latest.city, latest.district, TRIM(latest.dongName) AS dongName');
    expect(t).toContain("COALESCE(TRIM(latest.jibun), '') AS jibun, latest.buildYear, g.transactionCount");
    expect(t).toContain('latest.deposit AS latestPrice, latest.monthlyRent, latest.dealYear AS latestDealYear, latest.dealMonth AS latestDealMonth');
  });

  it.each([
    ['apt', 'AptRentTransaction'],
    ['villa', 'VillaRentTransaction'],
    ['offitel', 'OffitelRentTransaction'],
  ] as const)('%s 는 %s 를 1·2단계 모두 읽는다', (key, table) => {
    const t = text(nearbyRentFilteredSql(key, '11350', 'jeonse', BASE));
    expect(t).toContain(`FROM \`${table}\` t `);
    expect(t).toContain(`FROM \`${table}\` lt `);
  });

  it.each([
    ['jeonse', "'전세'"],
    ['wolse', "'월세'"],
  ] as const)('rentType=%s 는 1·2단계 모두 rentType = %s', (rentType, literal) => {
    const t = text(nearbyRentFilteredSql('apt', '11350', rentType, BASE));
    expect(t).toContain(`t.rentType = ${literal}`);
    expect(t).toContain(`lt.rentType = ${literal}`);
  });

  it('dongName(TRIM)·excludeBuildingName·limit 을 옛 WHERE 와 같이 1·2단계에 바인딩한다', () => {
    const sql = nearbyRentFilteredSql('villa', '11350', 'jeonse', {
      dongName: ' 상계동 ',
      excludeBuildingName: '현재단지',
      limitPerType: 20,
    });
    const t = text(sql);
    expect(t).toContain('AND TRIM(t.dongName) = ? AND t.buildingName != ?');
    expect(t).toContain('AND TRIM(lt.dongName) = ? AND lt.buildingName != ?');
    expect(sql.values).toEqual(['11350', '상계동', '현재단지', 20, '11350', '상계동', '현재단지']);
  });

  it('dongName·excludeBuildingName 이 없으면 bjdCode·rentType 만 건다', () => {
    const sql = nearbyRentFilteredSql('apt', '11350', 'wolse', BASE);
    const t = text(sql);
    expect(t).not.toContain('dongName) = ? ');
    expect(t).not.toContain('buildingName != ?');
    expect(sql.values).toEqual(['11350', 4, '11350']);
  });
});
