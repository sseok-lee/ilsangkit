import { prisma } from '../lib/prisma.js';

async function main() {
  const tables = ['aptSaleTransaction', 'aptRentTransaction', 'villaSaleTransaction', 'villaRentTransaction', 'offitelSaleTransaction', 'offitelRentTransaction'] as const;
  
  for (const table of tables) {
    const model = (prisma as any)[table];
    const total = await model.count();
    const withCoords = await model.count({ where: { lat: { not: null } } });
    const noCoords = total - withCoords;
    const rate = total > 0 ? ((withCoords / total) * 100).toFixed(1) : '0';
    console.log(`${table}: 전체 ${total} | 좌표있음 ${withCoords} | 좌표없음 ${noCoords} | 성공률 ${rate}%`);
  }
  await prisma.$disconnect();
}
main();
