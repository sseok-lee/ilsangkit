#!/usr/bin/env tsx
import 'dotenv/config';
import prisma from '../lib/prisma.js';

async function main() {
  const subs = [
    {
      houseManageNo: 'TEST001', pblancNo: 'TEST001',
      houseName: '래미안 원베일리', houseType: 'APT', houseDetailType: '민영',
      regionName: '서울', supplyLocation: '서울특별시 서초구 반포동',
      totalSupplyCount: 2990, status: 'upcoming',
      announcementDate: new Date('2026-04-15'),
      receptionStartDate: new Date('2026-04-25'),
      receptionEndDate: new Date('2026-04-28'),
      specialStartDate: new Date('2026-04-24'),
      specialEndDate: new Date('2026-04-24'),
      winnerDate: new Date('2026-05-05'),
      contractStartDate: new Date('2026-05-15'),
      contractEndDate: new Date('2026-05-17'),
      moveInMonth: '202903',
      constructorName: '삼성물산', developerName: '삼성물산',
      pblancUrl: 'https://www.applyhome.co.kr', inquiryTel: '02-1234-5678',
    },
    {
      houseManageNo: 'TEST002', pblancNo: 'TEST002',
      houseName: '힐스테이트 용산', houseType: 'APT', houseDetailType: '민영',
      regionName: '서울', supplyLocation: '서울특별시 용산구 한남동',
      totalSupplyCount: 1500, status: 'ongoing',
      announcementDate: new Date('2026-04-01'),
      receptionStartDate: new Date('2026-04-10'),
      receptionEndDate: new Date('2026-04-15'),
      specialStartDate: new Date('2026-04-09'),
      specialEndDate: new Date('2026-04-09'),
      winnerDate: new Date('2026-04-22'),
      contractStartDate: new Date('2026-05-01'),
      contractEndDate: new Date('2026-05-03'),
      moveInMonth: '202812',
      constructorName: '현대건설', developerName: '현대산업개발',
      pblancUrl: 'https://www.applyhome.co.kr', inquiryTel: '02-9876-5432',
    },
    {
      houseManageNo: 'TEST003', pblancNo: 'TEST003',
      houseName: '디에이치 자이개포', houseType: 'APT', houseDetailType: '민영',
      regionName: '서울', supplyLocation: '서울특별시 강남구 개포동',
      totalSupplyCount: 4000, status: 'closed',
      announcementDate: new Date('2026-03-01'),
      receptionStartDate: new Date('2026-03-15'),
      receptionEndDate: new Date('2026-03-18'),
      winnerDate: new Date('2026-03-25'),
      moveInMonth: '202906',
      constructorName: 'GS건설', developerName: '현대건설',
      pblancUrl: 'https://www.applyhome.co.kr', inquiryTel: '02-5555-1234',
    },
    {
      houseManageNo: 'TEST004', pblancNo: 'TEST004',
      houseName: '검단 파라곤', houseType: 'APT', houseDetailType: '국민',
      regionName: '인천', supplyLocation: '인천광역시 서구 검단동',
      totalSupplyCount: 800, status: 'upcoming',
      announcementDate: new Date('2026-04-20'),
      receptionStartDate: new Date('2026-05-01'),
      receptionEndDate: new Date('2026-05-04'),
      moveInMonth: '202810',
      constructorName: '대우건설',
      pblancUrl: 'https://www.applyhome.co.kr',
    },
    {
      houseManageNo: 'TEST005', pblancNo: 'TEST005',
      houseName: '위례 포레스트', houseType: '오피스텔', houseDetailType: '민영',
      regionName: '경기', supplyLocation: '경기도 성남시 수정구 위례동',
      totalSupplyCount: 350, status: 'upcoming',
      announcementDate: new Date('2026-04-18'),
      receptionStartDate: new Date('2026-04-28'),
      receptionEndDate: new Date('2026-04-30'),
      moveInMonth: '202808',
      constructorName: '포스코건설',
      pblancUrl: 'https://www.applyhome.co.kr',
    },
  ];

  for (const sub of subs) {
    await prisma.subscription.upsert({
      where: { houseManageNo_pblancNo: { houseManageNo: sub.houseManageNo, pblancNo: sub.pblancNo } },
      update: sub,
      create: sub,
    });
  }
  console.log('청약 5건 삽입 완료');

  const sub1 = await prisma.subscription.findUnique({
    where: { houseManageNo_pblancNo: { houseManageNo: 'TEST001', pblancNo: 'TEST001' } },
  });
  if (sub1) {
    await prisma.subscriptionUnitType.deleteMany({ where: { subscriptionId: sub1.id } });
    await prisma.subscriptionUnitType.createMany({
      data: [
        { subscriptionId: sub1.id, modelNo: '01', houseType: '059.9800A', supplyArea: '84.9500', generalCount: 500, specialCount: 300, topAmount: 180000, newlywedsCount: 100, multiChildCount: 50, firstLifeCount: 80, elderlyCount: 30, institutionCount: 20, youthCount: 15, newbornCount: 5 },
        { subscriptionId: sub1.id, modelNo: '02', houseType: '084.9421B', supplyArea: '115.0961', generalCount: 800, specialCount: 400, topAmount: 250000, newlywedsCount: 150, multiChildCount: 70, firstLifeCount: 100, elderlyCount: 40, institutionCount: 25, youthCount: 10, newbornCount: 5 },
        { subscriptionId: sub1.id, modelNo: '03', houseType: '114.9200C', supplyArea: '149.8700', generalCount: 400, specialCount: 200, topAmount: 350000, newlywedsCount: 60, multiChildCount: 40, firstLifeCount: 50, elderlyCount: 25, institutionCount: 15, youthCount: 8, newbornCount: 2 },
      ],
    });
    console.log('주택형 3건 삽입 완료');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
