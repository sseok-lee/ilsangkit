import { describe, it, expect, vi, beforeEach } from 'vitest';

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));

vi.mock('../../src/lib/prisma', () => {
  const model = { aggregate };
  return {
    prisma: {
      aptSaleTransaction: model,
      aptRentTransaction: model,
      villaSaleTransaction: model,
      villaRentTransaction: model,
      offitelSaleTransaction: model,
      offitelRentTransaction: model,
    },
  };
});

vi.mock('../../src/services/facilityService', () => ({
  getStatsByDistrict: vi.fn(),
  getDistrictStatsByCity: vi.fn(),
  CITY_SLUG_TO_FULL: {},
  CITY_SLUG_TO_SHORT: {},
}));

import { aggregateRealEstate } from '../../src/services/areaService';

describe('aggregateRealEstate 세종 코드 별칭', () => {
  beforeEach(() => {
    aggregate.mockReset();
    aggregate.mockResolvedValue({ _avg: {}, _count: 0 });
  });

  it('세종 Region 코드 36111 은 거래 bjdCode 36110 접두로 거른다', async () => {
    await aggregateRealEstate(['36111']);
    expect(aggregate).toHaveBeenCalledTimes(6);
    for (const [arg] of aggregate.mock.calls) {
      expect(arg.where).toEqual({ bjdCode: { startsWith: '36110' } });
    }
  });

  it('여러 코드일 때도 별칭을 적용하고 다른 코드는 그대로 둔다', async () => {
    await aggregateRealEstate(['11680', '36111']);
    expect(aggregate.mock.calls[0][0].where).toEqual({
      OR: [{ bjdCode: { startsWith: '11680' } }, { bjdCode: { startsWith: '36110' } }],
    });
  });
});

describe('area cache TTL', () => {
  // 지역 허브 집계는 6개 거래 테이블을 전체 기간으로 훑는다(경기 아파트 전월세 286만 건).
  // 거래는 하루 한 번(03:00)만 바뀌므로 10분 캐시는 봇 크롤마다 재계산만 부른다.
  it('6시간 안에는 캐시를 유지하고 그 뒤에는 버린다', async () => {
    vi.useFakeTimers();
    try {
      const { setCache, getCached } = await import('../../src/services/areaService');
      setCache('ttl-probe', { v: 1 });
      vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      expect(getCached('ttl-probe')).toEqual({ v: 1 });
      vi.advanceTimersByTime(3 * 60 * 60 * 1000 + 1);
      expect(getCached('ttl-probe')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
