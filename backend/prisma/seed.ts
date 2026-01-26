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
    id: 'battery',
    name: '배터리 수거',
    icon: '🔋',
    description: '폐배터리 수거함',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'kiosk',
    name: '무인민원',
    icon: '🏛️',
    description: '무인민원 발급 서비스',
    sortOrder: 6,
    isActive: true,
  },
];

// 서울 25개 구 지역 데이터
const regions = [
  {
    bjdCode: '11010',
    city: '서울',
    district: '종로구',
    slug: 'jongno-gu',
    lat: 37.5735,
    lng: 126.979,
  },
  {
    bjdCode: '11020',
    city: '서울',
    district: '중구',
    slug: 'jung-gu',
    lat: 37.5585,
    lng: 126.9979,
  },
  {
    bjdCode: '11030',
    city: '서울',
    district: '용산구',
    slug: 'yongsan-gu',
    lat: 37.5326,
    lng: 126.9907,
  },
  {
    bjdCode: '11040',
    city: '서울',
    district: '성동구',
    slug: 'seongdong-gu',
    lat: 37.5467,
    lng: 127.0372,
  },
  {
    bjdCode: '11050',
    city: '서울',
    district: '광진구',
    slug: 'gwangjin-gu',
    lat: 37.5392,
    lng: 127.0866,
  },
  {
    bjdCode: '11060',
    city: '서울',
    district: '동대문구',
    slug: 'dongdaemun-gu',
    lat: 37.5788,
    lng: 127.0079,
  },
  {
    bjdCode: '11070',
    city: '서울',
    district: '중랑구',
    slug: 'jungnang-gu',
    lat: 37.607,
    lng: 127.0922,
  },
  {
    bjdCode: '11080',
    city: '서울',
    district: '성북구',
    slug: 'seongbuk-gu',
    lat: 37.5894,
    lng: 127.0173,
  },
  {
    bjdCode: '11090',
    city: '서울',
    district: '강북구',
    slug: 'gangbuk-gu',
    lat: 37.6394,
    lng: 127.0264,
  },
  {
    bjdCode: '11100',
    city: '서울',
    district: '도봉구',
    slug: 'dobong-gu',
    lat: 37.6663,
    lng: 127.0476,
  },
  {
    bjdCode: '11110',
    city: '서울',
    district: '노원구',
    slug: 'nowon-gu',
    lat: 37.6548,
    lng: 127.0752,
  },
  {
    bjdCode: '11120',
    city: '서울',
    district: '은평구',
    slug: 'eunpyeong-gu',
    lat: 37.6024,
    lng: 126.921,
  },
  {
    bjdCode: '11130',
    city: '서울',
    district: '서대문구',
    slug: 'seodaemun-gu',
    lat: 37.5787,
    lng: 126.9368,
  },
  {
    bjdCode: '11140',
    city: '서울',
    district: '마포구',
    slug: 'mapo-gu',
    lat: 37.5638,
    lng: 126.9011,
  },
  {
    bjdCode: '11150',
    city: '서울',
    district: '양천구',
    slug: 'yangcheon-gu',
    lat: 37.5173,
    lng: 126.8668,
  },
  {
    bjdCode: '11160',
    city: '서울',
    district: '강서구',
    slug: 'gangseo-gu',
    lat: 37.5505,
    lng: 126.8247,
  },
  {
    bjdCode: '11170',
    city: '서울',
    district: '구로구',
    slug: 'guro-gu',
    lat: 37.4954,
    lng: 126.8874,
  },
  {
    bjdCode: '11180',
    city: '서울',
    district: '금천구',
    slug: 'geumcheon-gu',
    lat: 37.4536,
    lng: 126.9035,
  },
  {
    bjdCode: '11190',
    city: '서울',
    district: '영등포구',
    slug: 'yeongdeungpo-gu',
    lat: 37.5268,
    lng: 126.898,
  },
  {
    bjdCode: '11200',
    city: '서울',
    district: '동작구',
    slug: 'dongjak-gu',
    lat: 37.4954,
    lng: 126.9627,
  },
  {
    bjdCode: '11210',
    city: '서울',
    district: '관악구',
    slug: 'gwanak-gu',
    lat: 37.4879,
    lng: 126.9555,
  },
  {
    bjdCode: '11220',
    city: '서울',
    district: '서초구',
    slug: 'seocho-gu',
    lat: 37.4831,
    lng: 127.0325,
  },
  {
    bjdCode: '11230',
    city: '서울',
    district: '강남구',
    slug: 'gangnam-gu',
    lat: 37.4979,
    lng: 127.0276,
  },
  {
    bjdCode: '11240',
    city: '서울',
    district: '송파구',
    slug: 'songpa-gu',
    lat: 37.5148,
    lng: 127.1071,
  },
  {
    bjdCode: '11250',
    city: '서울',
    district: '강동구',
    slug: 'gangdong-gu',
    lat: 37.5297,
    lng: 127.1437,
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

  // Region 데이터 삽입
  console.log('Creating regions...');
  for (const region of regions) {
    await prisma.region.upsert({
      where: { bjdCode: region.bjdCode },
      update: region,
      create: region,
    });
  }
  console.log(`Created ${regions.length} regions`);

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
