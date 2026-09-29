import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';

const { regionFindFirst } = vi.hoisted(() => ({
  regionFindFirst: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    region: { findFirst: regionFindFirst },
  };
  return { default: prisma, prisma };
});

import { resolveBrowseRegion } from '../../src/services/facilityBrowseService.js';

describe('resolveBrowseRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a district slug that belongs to another city', async () => {
    regionFindFirst.mockResolvedValue(null);

    await expect(resolveBrowseRegion('seoul', 'haeundae')).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns a valid empty-data region from Region without touching area aggregates', async () => {
    regionFindFirst.mockResolvedValue({
      city: '서울특별시',
      district: '강남구',
      slug: 'gangnam',
    });

    await expect(resolveBrowseRegion('seoul', 'gangnam')).resolves.toEqual({
      citySlug: 'seoul',
      city: '서울특별시',
      district: '강남구',
    });
    expect(regionFindFirst).toHaveBeenCalledWith({
      where: {
        city: { in: ['서울특별시', '서울'] },
        slug: 'gangnam',
      },
      select: { city: true, district: true, slug: true },
    });
  });

  it('propagates Prisma failures', async () => {
    const error = new Error('database unavailable');
    regionFindFirst.mockRejectedValue(error);

    await expect(resolveBrowseRegion('seoul', 'gangnam')).rejects.toBe(error);
  });
});
