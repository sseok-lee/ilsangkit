import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { getRentalPriceStats } from '../src/services/subscriptionService.js';

describe('getRentalPriceStats', () => {
  beforeAll(async () => {
    // Insert test data: 서울 강남구 전월세 데이터
    // 최근 3개월 범위: 2025년 01, 02, 03월
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 지난 3개월 범위 계산
    let year = currentYear;
    let month = currentMonth;
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    await prisma.aptRentTransaction.createMany({
      data: [
        // 전세 데이터 (monthlyRent = null)
        {
          city: '서울',
          district: '강남구',
          bjdCode: '11680',
          dongName: '테헤란로',
          buildingName: '테스트빌딩1',
          dealYear: currentYear,
          dealMonth: currentMonth,
          dealDay: 1,
          rentType: '전세',
          deposit: 800000000n, // 8억
          monthlyRent: null,
          sourceId: `seoul-gangnam-jeonse-1-${Date.now()}`,
        },
        {
          city: '서울',
          district: '강남구',
          bjdCode: '11680',
          dongName: '테헤란로',
          buildingName: '테스트빌딩2',
          dealYear: currentYear,
          dealMonth: currentMonth,
          dealDay: 2,
          rentType: '전세',
          deposit: 700000000n, // 7억
          monthlyRent: null,
          sourceId: `seoul-gangnam-jeonse-2-${Date.now()}`,
        },
        // 월세 데이터 (monthlyRent > 0)
        {
          city: '서울',
          district: '강남구',
          bjdCode: '11680',
          dongName: '테헤란로',
          buildingName: '테스트빌딩3',
          dealYear: currentYear,
          dealMonth: currentMonth,
          dealDay: 3,
          rentType: '월세',
          deposit: 200000000n, // 2억
          monthlyRent: 3000000, // 300만원
          sourceId: `seoul-gangnam-wolse-1-${Date.now()}`,
        },
        {
          city: '서울',
          district: '강남구',
          bjdCode: '11680',
          dongName: '테헤란로',
          buildingName: '테스트빌딩4',
          dealYear: currentYear,
          dealMonth: currentMonth,
          dealDay: 4,
          rentType: '월세',
          deposit: 300000000n, // 3억
          monthlyRent: 2500000, // 250만원
          sourceId: `seoul-gangnam-wolse-2-${Date.now()}`,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.aptRentTransaction.deleteMany({
      where: {
        sourceId: {
          contains: 'seoul-gangnam',
        },
      },
    });
  });

  it('should parse regionName "서울 강남구" correctly', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    expect(stats).toBeDefined();
    expect(stats.jeonsae.count).toBeGreaterThanOrEqual(2);
    expect(stats.wolse.count).toBeGreaterThanOrEqual(2);
  });

  it('should separate jeonsae and wolse', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    expect(stats.jeonsae.count).toBeGreaterThan(0);
    expect(stats.wolse.count).toBeGreaterThan(0);
  });

  it('should calculate correct averages for jeonsae', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    // Average of 800M and 700M = 750M = 75000만원
    const expectedAvg = (800000000 + 700000000) / 2;
    expect(stats.jeonsae.avgDeposit).toBe(expectedAvg);
  });

  it('should calculate correct averages for wolse', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    const expectedDepositAvg = (200000000 + 300000000) / 2;
    const expectedMonthlyAvg = (3000000 + 2500000) / 2;
    expect(stats.wolse.avgDeposit).toBe(expectedDepositAvg);
    expect(stats.wolse.avgMonthlyRent).toBe(expectedMonthlyAvg);
  });

  it('should include period information', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    expect(stats.period).toBeDefined();
    expect(stats.period).toMatch(/\d{4}\.\d{2}~\d{4}\.\d{2}/);
  });

  it('should return null averages when no data exists', async () => {
    const stats = await getRentalPriceStats('경기 비존재구');
    expect(stats.jeonsae.count).toBe(0);
    expect(stats.jeonsae.avgDeposit).toBeNull();
    expect(stats.wolse.count).toBe(0);
    expect(stats.wolse.avgDeposit).toBeNull();
    expect(stats.wolse.avgMonthlyRent).toBeNull();
  });

  it('should handle single space in regionName', async () => {
    const stats = await getRentalPriceStats('서울 강남구');
    expect(stats).toBeDefined();
    expect(stats.jeonsae).toBeDefined();
  });
});
