#!/usr/bin/env tsx
// 매매 테이블의 좌표를 전월세 테이블에 복사하는 스크립트
import { prisma } from '../lib/prisma.js';

type TablePair = {
  source: string;
  target: string;
  label: string;
};

const PAIRS: TablePair[] = [
  { source: 'villaSaleTransaction', target: 'villaRentTransaction', label: '빌라' },
  { source: 'offitelSaleTransaction', target: 'offitelRentTransaction', label: '오피스텔' },
  { source: 'aptSaleTransaction', target: 'aptRentTransaction', label: '아파트' },
];

async function copyCoords(pair: TablePair): Promise<void> {
  const { source, target, label } = pair;
  console.info(`\n[${label}] ${source} → ${target} 좌표 복사 시작`);

  // source에서 좌표가 있는 고유 건물 가져오기
  const sourceModel = (prisma as any)[source];
  const buildings = await sourceModel.findMany({
    where: { lat: { not: null } },
    select: { buildingName: true, bjdCode: true, lat: true, lng: true },
    distinct: ['buildingName', 'bjdCode'],
  });

  console.info(`[${label}] 좌표 보유 건물 ${buildings.length}개`);

  let updated = 0;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const targetModel = (prisma as any)[target];
    const result = await targetModel.updateMany({
      where: { buildingName: b.buildingName, bjdCode: b.bjdCode, lat: null },
      data: { lat: b.lat, lng: b.lng },
    });
    updated += result.count;

    if ((i + 1) % 1000 === 0) {
      console.info(`[${label}] ${i + 1}/${buildings.length} 처리 (${updated}건 업데이트)`);
    }
  }

  console.info(`[${label}] 완료 — ${updated}건 좌표 복사됨`);
}

async function main() {
  const arg = process.argv[2]; // 특정 pair만 실행 가능: villa, offitel, apt
  const pairs = arg
    ? PAIRS.filter(p => p.label.includes(arg) || p.source.includes(arg))
    : PAIRS;

  for (const pair of pairs) {
    await copyCoords(pair);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
