import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { batchUpsertRaw } from '../../src/services/baseSyncService.js';

const TEST_PREFIX = 'PHASE3-EXACTSTATS-';

async function clean() {
  await prisma.toilet.deleteMany({ where: { sourceId: { startsWith: TEST_PREFIX } } });
}

function row(suffix: string, name = '테스트화장실') {
  return {
    id: `toilet-${TEST_PREFIX}${suffix}`,
    name,
    address: '테스트주소',
    roadAddress: '테스트도로명',
    lat: 37.5,
    lng: 127.0,
    city: '서울특별시',
    district: '중구',
    sourceId: `${TEST_PREFIX}${suffix}`,
    operatingHours: '24시간',
    maleToilets: 1, maleUrinals: 1, femaleToilets: 1,
    hasDisabledToilet: false,
    createdAt: new Date(), updatedAt: new Date(), syncedAt: new Date(),
  };
}

describe('batchUpsertRaw with exactStats', () => {
  beforeEach(clean);
  afterEach(clean);

  it('정확 통계 모드는 사전 SELECT로 new/updated를 구분한다', async () => {
    await prisma.toilet.create({ data: row('1', '기존') });

    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('1', '수정'), row('2', '신규')],
      100,
      undefined,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    expect(newCount).toBe(1);
    expect(updateCount).toBe(1);
  });

  it('동일 키 재입력 시 exact 모드는 updated=1로 집계한다', async () => {
    // NOTE: 본 케이스는 updatedAt이 NOW()로 강제 갱신되어 휴리스틱도 우연히 (0,1)을 반환한다 —
    // 휴리스틱 vs exact 차이를 differential하게 증명하진 못함. exact 모드의 종단 정확성만 검증.
    // 진짜 differential 케이스(no-op upsert, BIGINT key 등)는 후속 spec에서.
    await prisma.toilet.create({ data: row('3', '동일') });

    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('3', '동일')],
      100,
      undefined,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    expect(newCount).toBe(0);
    expect(updateCount).toBe(1);
  });

  it('exactStats 미지정 시 기존 휴리스틱 동작 유지 (비파괴)', async () => {
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('4'), row('5')],
      100
    );

    expect(newCount).toBe(2);
    expect(updateCount).toBe(0);
  });
});
