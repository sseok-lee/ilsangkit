// ev-charger IndexNow URL 버그 회귀 테스트
// EvCharger는 충전기(row) 단위(id = statId-chgerId, ~51만행)지만 상세페이지/사이트맵은
// 충전소(statId) 단위 — IndexNow도 DISTINCT statId를 제출해야 실제 페이지와 일치한다.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    evCharger: { findMany: mockFindMany },
  },
}));

import { getRecentlySyncedStationIds } from '../../src/scripts/syncEvCharger.js';
import { buildFacilityUrls } from '../../src/services/indexNowService.js';

describe('getRecentlySyncedStationIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DISTINCT statId로 조회하고 statId 목록만 반환한다 (row id 아님)', async () => {
    mockFindMany.mockResolvedValue([
      { statId: 'ME12345' },
      { statId: 'ME67890' },
    ]);

    const cutoff = new Date('2026-07-21T00:00:00Z');
    const statIds = await getRecentlySyncedStationIds(cutoff);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { syncedAt: { gte: cutoff }, statId: { not: null } },
      select: { statId: true },
      distinct: ['statId'],
    });
    expect(statIds).toEqual(['ME12345', 'ME67890']);
  });

  it('결과 statId로 만든 URL이 충전소(station) 페이지 형식이다 (충전기 row id 아님)', async () => {
    mockFindMany.mockResolvedValue([{ statId: 'ME12345' }]);

    const statIds = await getRecentlySyncedStationIds(new Date());
    const urls = buildFacilityUrls('ev-charger', statIds);

    expect(urls).toEqual(['https://ilsangkit.co.kr/ev-charger/ME12345']);
    // 회귀 방지: EvCharger.id 포맷(evcharger-{statId}-{chgerId})이 섞여 들어가면 안 된다
    expect(urls[0]).not.toContain('evcharger-');
  });

  it('동일 충전소의 여러 충전기 row가 있어도 1개 URL로 중복 제거된다', async () => {
    // Prisma distinct: ['statId']를 모킹으로 흉내 — 실제로는 DB가 중복 제거해 반환
    mockFindMany.mockResolvedValue([{ statId: 'ME12345' }]);

    const statIds = await getRecentlySyncedStationIds(new Date());

    expect(statIds).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['statId'] })
    );
  });
});
