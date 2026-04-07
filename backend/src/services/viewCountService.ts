/**
 * 조회수 배치 처리 서비스
 * 매 요청마다 DB write 대신 인메모리 버퍼에 누적 → 30초 간격 일괄 flush
 */

import { CATEGORY_REGISTRY } from './categoryRegistry.js';
import type { FacilityCategory } from './categoryRegistry.js';

export const viewCountBuffer = new Map<string, { category: FacilityCategory; id: string; count: number }>();

export function bufferViewCount(category: FacilityCategory, id: string): void {
  const key = `${category}:${id}`;
  const existing = viewCountBuffer.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    viewCountBuffer.set(key, { category, id, count: 1 });
  }
}

export async function flushViewCounts(): Promise<void> {
  if (viewCountBuffer.size === 0) return;
  const entries = Array.from(viewCountBuffer.values());
  viewCountBuffer.clear();
  const BATCH_SIZE = 10;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(({ category, id, count }) => {
        const config = CATEGORY_REGISTRY[category];
        if (!config) return Promise.resolve();
        return config.model().update({ where: { id }, data: { viewCount: { increment: count } } });
      })
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(flushViewCounts, 30_000);
}
