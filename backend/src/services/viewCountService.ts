/**
 * 조회수 배치 처리 서비스
 * 매 요청마다 DB write 대신 인메모리 버퍼에 누적 → 30초 간격 일괄 flush
 */

import { prisma } from '../lib/prisma.js';
import { CATEGORY_REGISTRY } from './categoryRegistry.js';
import type { FacilityCategory } from './categoryRegistry.js';

/**
 * 카테고리 → MySQL 테이블명.
 *
 * raw UPDATE 는 테이블명을 파라미터로 바인딩할 수 없으므로 신뢰 가능한 리터럴이 필요하다.
 * schema.prisma 에 @@map 이 하나도 없어 Prisma 모델명 = 테이블명이다.
 * 타입이 CATEGORY_REGISTRY 의 키 집합과 묶여 있어, 새 카테고리를 등록하면 여기서 컴파일 에러가 난다.
 */
const VIEW_COUNT_TABLES: Record<keyof typeof CATEGORY_REGISTRY, string> = {
  toilet: 'Toilet',
  wifi: 'Wifi',
  clothes: 'Clothes',
  parking: 'Parking',
  aed: 'Aed',
  library: 'Library',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  park: 'Park',
  school: 'School',
  market: 'Market',
  childcare: 'Childcare',
  'ev-charger': 'EvCharger',
  sports: 'Sports',
  subway: 'SubwayStation',
};

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
        const table = VIEW_COUNT_TABLES[category];
        if (!table) return Promise.resolve();
        // model().update() 는 @updatedAt 을 함께 갱신한다. 시설의 updatedAt 은 사이트맵 lastmod 로
        // 나가므로, 조회만으로 "이 페이지가 바뀌었다"고 검색엔진에 신고하는 꼴이 된다.
        // raw UPDATE 로 viewCount 만 증가시켜 updatedAt 을 보존한다.
        return prisma.$executeRawUnsafe(
          `UPDATE \`${table}\` SET \`viewCount\` = \`viewCount\` + ? WHERE \`id\` = ?`,
          count,
          id,
        );
      })
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(flushViewCounts, 30_000);
}
