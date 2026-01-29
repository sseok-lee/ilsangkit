// @TASK T0.4 - Seed 스크립트 (초기 데이터)
// @SPEC docs/planning/04-database-design.md#seed-data

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 카테고리 초기 데이터
const categories = [
  {
    id: 'toilet',
    name: '공공화장실',
    icon: '🚽',
    description: '24시간 이용 가능한 공공화장실',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'trash',
    name: '쓰레기 배출',
    icon: '♻️',
    description: '생활쓰레기 배출 정보',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'wifi',
    name: '무료 와이파이',
    icon: '📡',
    description: '무료 와이파이 핫스팟',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'clothes',
    name: '옷 수거함',
    icon: '👕',
    description: '중고 의류 수거함',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'kiosk',
    name: '무인민원',
    icon: '🏛️',
    description: '무인민원 발급 서비스',
    sortOrder: 5,
    isActive: true,
  },
];

async function main() {
  console.log('Seeding database...');

  // Category 데이터 삽입
  console.log('Creating categories...');
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }
  console.log(`Created ${categories.length} categories`);

  // Region 데이터는 sync:regions에서 공공데이터 API로 동기화
  console.log('Note: Region data will be synced via npm run sync:regions');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
