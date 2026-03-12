import { prisma } from '../lib/prisma.js';

async function main() {
  const tables = ['aptSaleTransaction', 'aptRentTransaction', 'villaSaleTransaction', 'villaRentTransaction', 'offitelSaleTransaction', 'offitelRentTransaction'] as const;
  
  for (const table of tables) {
    const model = (prisma as any)[table];
    const buildings = await model.findMany({
      where: { lat: null },
      select: { buildingName: true, bjdCode: true },
      distinct: ['buildingName', 'bjdCode'],
    });
    console.log(`${table}: 좌표없는 건물 ${buildings.length}개`);
  }
  await prisma.$disconnect();
}
main();
