#!/usr/bin/env tsx
// @TASK T2.4 - 통합 동기화 스케줄러
// @SPEC docs/planning/02-trd.md#데이터-동기화

/**
 * 5개 카테고리 통합 동기화 스크립트
 *
 * 사용법:
 *   npm run sync:facilities                     # 전체 동기화
 *   npm run sync:facilities -- --only toilet,wifi  # 특정 카테고리만
 *   npm run sync:facilities -- --skip wifi         # 특정 카테고리 제외
 */

import * as path from 'path';
import { syncToilets } from '../services/toiletSyncService.js';
import { syncTrashData } from './syncTrash.js';
import { syncWifiData } from './syncWifi.js';
import { syncClothes } from '../services/clothesSyncService.js';
import { syncParking } from '../services/parkingSyncService.js';
import { syncParks } from '../services/parkSyncService.js';
import { syncSchools } from '../services/schoolSyncService.js';
import { syncMarkets } from '../services/marketSyncService.js';
import { syncAeds } from './syncAed.js';
import { syncLibraries } from '../services/librarySyncService.js';
import { syncHospitals } from './syncHospital.js';
import { syncPharmacies } from './syncPharmacy.js';
import { prisma } from '../lib/prisma.js';
import { submitIndexNow, buildFacilityUrls } from '../services/indexNowService.js';

// 공영주차장 기본 CSV 파일 경로
const PARKING_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/parking.csv'
);

// 공공도서관 기본 CSV 파일 경로
const LIBRARY_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/library.csv'
);

// 공공화장실 기본 CSV 파일 경로
const TOILET_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/toilet.csv'
);

// 무료와이파이 기본 CSV 파일 경로
const WIFI_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/wifi.csv'
);

// 의류수거함 기본 CSV 파일 경로
const CLOTHES_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/clothes.csv'
);

// 공원 기본 CSV 파일 경로
const PARK_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/park.csv'
);

// 학교 기본 CSV 파일 경로
const SCHOOL_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/school.csv'
);

// 시장 기본 CSV 파일 경로
const MARKET_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/market.csv'
);

/**
 * 동기화 결과 타입
 */
interface SyncResult {
  category: string;
  success: boolean;
  count?: number;
  error?: string;
  duration: number;
}

/**
 * 사용 가능한 카테고리 목록
 */
const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'hospital', 'pharmacy', 'parking', 'aed', 'library', 'park', 'school', 'market'] as const;
type Category = typeof CATEGORIES[number];

/**
 * 카테고리별 동기화 실행
 * @param category - 동기화할 카테고리
 * @returns 동기화 결과
 */
async function syncCategory(category: Category): Promise<SyncResult> {
  const start = Date.now();

  try {
    switch (category) {
      case 'toilet': {
        const result = await syncToilets(TOILET_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'trash': {
        const serviceKey = process.env.OPENAPI_SERVICE_KEY;
        if (!serviceKey) {
          throw new Error('OPENAPI_SERVICE_KEY가 설정되지 않았습니다.');
        }

        const result = await syncTrashData({ serviceKey });
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'wifi': {
        const result = await syncWifiData(WIFI_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'clothes': {
        const result = await syncClothes(CLOTHES_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'hospital': {
        const result = await syncHospitals();
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'pharmacy': {
        const result = await syncPharmacies();
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'parking': {
        const result = await syncParking(PARKING_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'aed': {
        const result = await syncAeds();
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'library': {
        const result = await syncLibraries(LIBRARY_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'park': {
        const result = await syncParks(PARK_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'school': {
        const result = await syncSchools(SCHOOL_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      case 'market': {
        const result = await syncMarkets(MARKET_CSV_PATH);
        return {
          category,
          success: true,
          count: result.newRecords + result.updatedRecords,
          duration: Date.now() - start,
        };
      }

      default:
        throw new Error(`Unknown category: ${category}`);
    }
  } catch (error) {
    return {
      category,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * 메인 함수
 */
async function main(): Promise<void> {
  console.log('=== 통합 동기화 시작 ===\n');

  const args = process.argv.slice(2);
  let categoriesToSync: Category[] = [...CATEGORIES];

  // --only 옵션 처리
  const onlyIndex = args.indexOf('--only');
  if (onlyIndex !== -1 && args[onlyIndex + 1]) {
    const onlyCategories = args[onlyIndex + 1].split(',') as Category[];
    categoriesToSync = categoriesToSync.filter(c => onlyCategories.includes(c));
  }

  // --skip 옵션 처리
  const skipIndex = args.indexOf('--skip');
  if (skipIndex !== -1 && args[skipIndex + 1]) {
    const skipCategories = args[skipIndex + 1].split(',') as Category[];
    categoriesToSync = categoriesToSync.filter(c => !skipCategories.includes(c));
  }

  if (categoriesToSync.length === 0) {
    console.error('동기화할 카테고리가 없습니다.');
    process.exit(1);
  }

  console.log(`동기화 대상: ${categoriesToSync.join(', ')}\n`);

  const results: SyncResult[] = [];

  for (const category of categoriesToSync) {
    console.log(`\n[${category}] 동기화 시작...`);
    const result = await syncCategory(category);
    results.push(result);

    if (result.success) {
      const countInfo = result.count !== undefined ? ` (${result.count}개)` : '';
      console.log(`[${category}] ✅ 완료${countInfo} (${result.duration}ms)`);
    } else {
      console.error(`[${category}] ❌ 실패: ${result.error}`);
    }

    // 다음 카테고리 전에 약간의 대기 (API rate limit 고려)
    if (category !== categoriesToSync[categoriesToSync.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 결과 요약
  console.log('\n=== 동기화 결과 요약 ===');
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`성공: ${success}개, 실패: ${failed}개`);

  // 성공한 카테고리 목록
  const successList = results.filter(r => r.success).map(r => r.category);
  if (successList.length > 0) {
    console.log(`\n✅ 성공: ${successList.join(', ')}`);
  }

  // 실패한 카테고리 상세
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log('\n❌ 실패한 카테고리:');
    failedResults.forEach(r => {
      console.log(`  - ${r.category}: ${r.error}`);
    });
    process.exit(1);
  }

  // IndexNow: 동기화된 시설 URL 제출
  const syncedCategories = results.filter(r => r.success && (r.count ?? 0) > 0);
  if (syncedCategories.length > 0) {
    console.log('\n[IndexNow] 변경된 URL 제출 중...');
    const syncCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2시간 이내

    const modelQueries: Record<string, () => Promise<{ id: string | number }[]>> = {
      toilet: () => prisma.toilet.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      trash: () => prisma.wasteSchedule.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      wifi: () => prisma.wifi.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      clothes: () => prisma.clothes.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      hospital: () => prisma.hospital.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      pharmacy: () => prisma.pharmacy.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      parking: () => prisma.parking.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      aed: () => prisma.aed.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      library: () => prisma.library.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      park: () => prisma.park.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      school: () => prisma.school.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      market: () => prisma.market.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      childcare: () => prisma.childcare.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      'ev-charger': () => prisma.evCharger.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
      sports: () => prisma.sports.findMany({ where: { syncedAt: { gte: syncCutoff } }, select: { id: true } }),
    };

    const allUrls: string[] = [];
    for (const { category } of syncedCategories) {
      const queryFn = modelQueries[category];
      if (!queryFn) continue;
      try {
        const items = await queryFn();
        const urls = buildFacilityUrls(category, items.map(i => String(i.id)));
        allUrls.push(...urls);
        console.log(`[IndexNow] ${category}: ${urls.length}개 URL`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[IndexNow] ${category} URL 조회 실패: ${msg}`);
      }
    }

    if (allUrls.length > 0) {
      await submitIndexNow(allUrls);
    }
  }

  console.log('\n모든 동기화가 성공적으로 완료되었습니다.');
}

// 스크립트 실행
main().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
