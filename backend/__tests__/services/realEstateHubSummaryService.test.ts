import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $queryRawUnsafe: mockQueryRawUnsafe,
  };
  return { prisma, default: prisma };
});

import {
  getHubSummary,
  __resetHubSummaryCacheForTest,
} from '../../src/services/realEstateHubSummaryService.js';

describe('getHubSummary', () => {
  beforeEach(() => {
    __resetHubSummaryCacheForTest();
    mockQueryRawUnsafe.mockReset();
  });

  it('6개 키를 모두 반환한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ cnt: BigInt(42) }]);

    const result = await getHubSummary();

    expect(Object.keys(result.data).sort()).toEqual([
      'apt-rent',
      'apt-sale',
      'offitel-rent',
      'offitel-sale',
      'villa-rent',
      'villa-sale',
    ]);
    for (const key of Object.keys(result.data)) {
      expect(result.data[key as keyof typeof result.data].last30dCount).toBe(42);
    }
    expect(typeof result.generatedAt).toBe('string');
  });

  it('TTL 이내에는 캐시 히트 — 쿼리 6회만 실행', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ cnt: BigInt(1) }]);

    const first = await getHubSummary();
    const second = await getHubSummary();

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(6); // 6 types × 1 build
    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it('동시 요청은 in-flight Promise를 공유한다 — 쿼리 6회만 실행', async () => {
    mockQueryRawUnsafe.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ cnt: BigInt(5) }]), 20)),
    );

    const [a, b, c] = await Promise.all([getHubSummary(), getHubSummary(), getHubSummary()]);

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(6);
    expect(a.generatedAt).toBe(b.generatedAt);
    expect(b.generatedAt).toBe(c.generatedAt);
  });

  it('특정 타입 쿼리 실패 시 해당 타입만 null', async () => {
    let calls = 0;
    mockQueryRawUnsafe.mockImplementation(() => {
      calls += 1;
      if (calls === 2) return Promise.reject(new Error('boom'));
      return Promise.resolve([{ cnt: BigInt(7) }]);
    });

    const result = await getHubSummary();
    const nulls = Object.values(result.data).filter((e) => e.last30dCount === null).length;
    const valid = Object.values(result.data).filter((e) => e.last30dCount === 7).length;
    expect(nulls).toBe(1);
    expect(valid).toBe(5);
  });
});
