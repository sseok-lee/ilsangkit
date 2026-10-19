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
