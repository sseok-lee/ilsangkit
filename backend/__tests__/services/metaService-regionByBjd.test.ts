import { describe, it, expect, beforeEach, vi } from 'vitest';

const findFirstMock = vi.fn();

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { region: { findFirst: findFirstMock } },
}));

// Import AFTER the mock is declared so service sees the mocked prisma.
const { getRegionByBjdCode } = await import('../../src/services/metaService.js');

describe('getRegionByBjdCode', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('uses 5-digit bjdCode as-is', async () => {
    findFirstMock.mockResolvedValue({ city: '서울특별시', district: '강남구', bjdCode: '11680' });
    await getRegionByBjdCode('11680');
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { bjdCode: '11680' },
      select: { city: true, district: true, bjdCode: true },
    });
  });

  it('slices 10-digit bjdCode to leading 5-digit lawd code', async () => {
    findFirstMock.mockResolvedValue({ city: '서울특별시', district: '강남구', bjdCode: '11680' });
    await getRegionByBjdCode('1168010100');
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { bjdCode: '11680' },
      select: { city: true, district: true, bjdCode: true },
    });
  });

  it('returns null for empty bjdCode without querying DB', async () => {
    const result = await getRegionByBjdCode('');
    expect(result).toBeNull();
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
