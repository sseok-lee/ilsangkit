import { beforeEach, describe, expect, it, vi } from 'vitest';

const { count } = vi.hoisted(() => ({ count: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { count: vi.fn().mockResolvedValue(0) };
  const prisma = {
    toilet: model,
    aed: model,
    hospital: model,
    pharmacy: model,
    parking: model,
    wifi: model,
    clothes: model,
    park: model,
    school: model,
    market: model,
    library: model,
    wasteSchedule: { count },
    childcare: model,
    evCharger: model,
    sports: model,
  };
  return { default: prisma, prisma };
});

import { getDbStats } from '../../src/services/articleGenerationCore.js';

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(3);
});

describe('articleGenerationCore trash stats', () => {
  it('excludes staged trash rows from public guide stats', async () => {
    await getDbStats('trash');

    expect(count).toHaveBeenCalledWith({ where: { stagedMarker: null } });
  });
});
