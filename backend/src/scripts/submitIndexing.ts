/**
 * Google Indexing API 자동 제출 스크립트
 *
 * 부동산 페이지 URL을 Google Indexing API로 제출하여 크롤링을 촉진한다.
 * 이미 제출한 URL은 로그 파일로 관리하여 중복 제출을 방지한다.
 *
 * Usage:
 *   npm run submit:indexing              # 기본 200개 제출
 *   npm run submit:indexing -- --limit 10  # 10개만 제출
 */
// 프로덕션 DB 사용: prisma import 전에 DATABASE_URL 교체
import 'dotenv/config';
if (process.env.PRODUCTION_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
}

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.resolve(__dirname, '../../data/indexing-log.json');
const SITE_BASE = 'https://ilsangkit.com';

interface IndexingLog {
  submittedUrls: string[];
  lastRun: string;
}

function parseArgs(): { limit: number } {
  const args = process.argv.slice(2);
  let limit = 200;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const parsed = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = parsed;
    }
  }
  return { limit };
}

function loadLog(): IndexingLog {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { submittedUrls: [], lastRun: '' };
  }
}

function saveLog(log: IndexingLog): void {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

async function fetchBuildingUrls(): Promise<string[]> {
  const buildings = await prisma.$queryRaw<
    Array<{ propertyType: string; buildingName: string; bjdCode: string }>
  >`
    SELECT 'apt' AS propertyType, buildingName, bjdCode FROM (
      SELECT DISTINCT buildingName, bjdCode FROM AptSaleTransaction
      UNION SELECT DISTINCT buildingName, bjdCode FROM AptRentTransaction
    ) apt WHERE buildingName IS NOT NULL AND buildingName != ''
    UNION ALL
    SELECT 'villa' AS propertyType, buildingName, bjdCode FROM (
      SELECT DISTINCT buildingName, bjdCode FROM VillaSaleTransaction
      UNION SELECT DISTINCT buildingName, bjdCode FROM VillaRentTransaction
    ) villa WHERE buildingName IS NOT NULL AND buildingName != ''
    UNION ALL
    SELECT 'offitel' AS propertyType, buildingName, bjdCode FROM (
      SELECT DISTINCT buildingName, bjdCode FROM OffitelSaleTransaction
      UNION SELECT DISTINCT buildingName, bjdCode FROM OffitelRentTransaction
    ) offitel WHERE buildingName IS NOT NULL AND buildingName != ''
  `;

  return buildings.map(
    (b) =>
      `${SITE_BASE}/real-estate/${b.propertyType}/${encodeURIComponent(b.buildingName)}?bjdCode=${b.bjdCode}`
  );
}

async function main() {
  const { limit } = parseArgs();

  // Google Auth 설정
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY_PATH 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  const client = await auth.getClient();

  // 부동산 건물 URL 조회
  console.log('📋 부동산 건물 URL 목록 조회 중...');
  const allUrls = await fetchBuildingUrls();
  console.log(`  전체 URL: ${allUrls.length}개`);

  // 이미 제출한 URL 필터링
  const log = loadLog();
  const submittedSet = new Set(log.submittedUrls);
  const pendingUrls = allUrls.filter((url) => !submittedSet.has(url));
  console.log(`  미제출 URL: ${pendingUrls.length}개`);

  if (pendingUrls.length === 0) {
    console.log('✅ 모든 URL이 이미 제출되었습니다.');
    await prisma.$disconnect();
    return;
  }

  const targets = pendingUrls.slice(0, limit);
  console.log(`\n🚀 ${targets.length}개 URL 제출 시작...\n`);

  let success = 0;
  let fail = 0;

  for (const url of targets) {
    try {
      await client.request({
        url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
        method: 'POST',
        data: {
          url,
          type: 'URL_UPDATED',
        },
      });
      log.submittedUrls.push(url);
      success++;

      if (success % 50 === 0) {
        console.log(`  진행: ${success}/${targets.length}`);
      }
    } catch (err: unknown) {
      fail++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ 실패: ${url} — ${message}`);
    }
  }

  // 로그 저장
  log.lastRun = new Date().toISOString();
  saveLog(log);

  // 결과 출력
  const remaining = pendingUrls.length - success;
  console.log(`\n📊 결과:`);
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${fail}개`);
  console.log(`  남은 미제출 URL: ${remaining}개`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('스크립트 실행 중 오류:', err);
  prisma.$disconnect();
  process.exit(1);
});
