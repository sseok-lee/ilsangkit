import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * 토지 상세의 색인 판정과 토지 사이트맵의 수록 기준이 같아야 한다.
 *
 * PR #770 이 상세 페이지를 `transactionCount >= 3`(frontend/utils/indexability.ts) 으로 바꾸면서
 * 사이트맵은 손대지 않았다. 사이트맵은 sync 시점에 저장된 `isIndexable`
 * (= recentCount >= 5 OR transactionCount >= 10, backend/src/scripts/syncLandSale.ts) 로 걸렀다.
 *
 * 그 결과 `index, follow` + self-canonical 로 나가는데 사이트맵엔 없는 URL 이 생겼다 —
 * 색인 가능한 고아다. 실측 2026-09-04 로컬 DB: isIndexable=true 188개 vs transactionCount>=3
 * 241개, 차이 53개. 역방향(사이트맵엔 있는데 페이지가 noindex)은 0건이었다.
 */

const MIN_INDEXABLE_TRANSACTIONS = 3;

const findManyMock = vi.fn();
const prismaStub = {
  landAreaSummary: { findMany: (...args: unknown[]) => findManyMock(...args) },
};
// landService 는 named import 를 쓴다. default 도 함께 내어 다른 소비자와 형태를 맞춘다.
vi.mock('../../src/lib/prisma.js', () => ({ default: prismaStub, prisma: prismaStub }));

const { getSitemapEntries } = await import('../../src/services/landService.js');

describe('토지 색인 기준 — 상세 페이지와 사이트맵이 같은 술어를 쓴다', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
  });

  it('사이트맵은 저장된 isIndexable 이 아니라 transactionCount 임계값으로 거른다', async () => {
    await getSitemapEntries();

    const dongCall = findManyMock.mock.calls
      .map((c) => c[0] as { where?: Record<string, unknown> })
      .find((a) => a?.where);

    expect(dongCall).toBeDefined();
    // 저장된 플래그로 거르면 sync 시점 규칙(recent>=5 || total>=10)에 묶여 페이지와 갈라진다.
    expect(dongCall!.where).not.toHaveProperty('isIndexable');
    expect(dongCall!.where).toEqual({
      transactionCount: { gte: MIN_INDEXABLE_TRANSACTIONS },
    });
  });
});

describe('임계값 드리프트 가드', () => {
  // 백엔드는 frontend/utils/indexability.ts 를 import 할 수 없다(tsconfig 루트가 다름).
  // 저장소 선례(backend/src/lib/regionSlugs.ts 의 "SOURCE OF TRUTH" 미러링)를 따라 값을
  // 복제하되, 원본이 바뀌면 여기서 깨지도록 소스를 읽어 대조한다.
  it('프론트의 MIN_INDEXABLE_TRANSACTIONS 와 값이 같다', () => {
    const source = readFileSync(
      resolve(process.cwd(), '../frontend/utils/indexability.ts'),
      'utf-8',
    );
    const match = source.match(/export const MIN_INDEXABLE_TRANSACTIONS\s*=\s*(\d+)/);

    expect(match, 'frontend/utils/indexability.ts 에서 상수를 찾지 못했다').not.toBeNull();
    expect(Number(match![1])).toBe(MIN_INDEXABLE_TRANSACTIONS);
  });

  it('백엔드 landService 도 같은 값을 쓴다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/landService.ts'),
      'utf-8',
    );
    const match = source.match(/const MIN_INDEXABLE_TRANSACTIONS\s*=\s*(\d+)/);

    expect(match, 'landService 에서 상수를 찾지 못했다').not.toBeNull();
    expect(Number(match![1])).toBe(MIN_INDEXABLE_TRANSACTIONS);
  });
});
