/**
 * 시설 상세 전체 IndexNow 백필 스크립트
 *
 * SSR 열화 응답(200 + 기본 title) 시기에 수집된 시설 상세 스냅샷이 네이버 색인에
 * 남아 있어(스니펫이 GNB/푸터 텍스트) 재수집 요청으로 세척한다. URL 소스는 라이브
 * 사이트맵 — DB 접속 없이 어디서든 실행 가능하고, 사이트맵이 광고하는 URL과 제출
 * URL 의 정합이 정의상 보장된다.
 *
 * 제출 이력은 청크별 커서로 data/indexnow-backfill.json 에 기록해 재실행 시 이어서
 * 제출한다. 청크 내용은 sync 로 조금씩 바뀌므로 커서는 근사치다 — 중복 제출은
 * 재수집 요청 특성상 무해하다.
 *
 * Usage:
 *   INDEXNOW_KEY=... npx tsx src/scripts/submitIndexNowBackfill.ts --dry-run
 *   INDEXNOW_KEY=... npx tsx src/scripts/submitIndexNowBackfill.ts --limit 20000
 *   INDEXNOW_KEY=... npx tsx src/scripts/submitIndexNowBackfill.ts --categories school,parking
 *   INDEXNOW_KEY=... npx tsx src/scripts/submitIndexNowBackfill.ts --reset
 */
import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { submitIndexNow } from '../services/indexNowService.js';
import { ALL_CATEGORIES } from '../services/categoryRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.resolve(__dirname, '../../data/indexnow-backfill.json');
const SITE_BASE = 'https://ilsangkit.co.kr';
const SITEMAP_INDEX = `${SITE_BASE}/sitemap.xml`;
const FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_LIMIT = 20_000;

// 화석(열화 스냅샷)이 관측된 카테고리와 유입 기여가 큰 카테고리를 앞에 둔다.
const DEFAULT_CATEGORY_ORDER = [
  'hospital',
  'pharmacy',
  'school',
  'parking',
  'toilet',
  'childcare',
  'market',
  'sports',
  'clothes',
  'ev-charger',
  'aed',
  'library',
  'park',
  'wifi',
];

export interface FacilityChunk {
  name: string;
  url: string;
  category: string;
}

interface BackfillState {
  cursors: Record<string, number>;
  lastRun: string;
}

export function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const pattern = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    locs.push(match[1].trim().replace(/&amp;/g, '&'));
  }
  return locs;
}

export function selectFacilityChunks(indexLocs: string[], categories: string[]): FacilityChunk[] {
  const chunks: FacilityChunk[] = [];
  for (const category of categories) {
    const pattern = new RegExp(`/sitemap/(${category})(?:-(\\d+))?\\.xml$`);
    const matched = indexLocs
      .map((url) => {
        const m = url.match(pattern);
        if (!m) return null;
        const num = m[2] ? parseInt(m[2], 10) : 0;
        const name = m[2] ? `${category}-${m[2]}` : category;
        return { name, url, category, num };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.num - b.num);
    chunks.push(...matched.map(({ name, url, category: cat }) => ({ name, url, category: cat })));
  }
  return chunks;
}

export function filterDetailUrls(urls: string[], category: string): string[] {
  const pattern = new RegExp(`^${SITE_BASE}/${category}/[^/]+$`);
  return urls.filter((url) => pattern.test(url));
}

export function planSubmission(
  chunks: Array<{ name: string; urls: string[] }>,
  cursors: Record<string, number>,
  limit: number
): { picks: Array<{ name: string; urls: string[] }>; nextCursors: Record<string, number> } {
  const picks: Array<{ name: string; urls: string[] }> = [];
  const nextCursors = { ...cursors };
  let remaining = limit;
  for (const chunk of chunks) {
    if (remaining <= 0) break;
    const cursor = cursors[chunk.name] ?? 0;
    const pending = chunk.urls.slice(cursor, cursor + remaining);
    if (pending.length === 0) {
      nextCursors[chunk.name] = cursor;
      continue;
    }
    picks.push({ name: chunk.name, urls: pending });
    nextCursors[chunk.name] = cursor + pending.length;
    remaining -= pending.length;
  }
  return { picks, nextCursors };
}

function parseArgs(): { limit: number; categories: string[]; dryRun: boolean; reset: boolean } {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let categories = DEFAULT_CATEGORY_ORDER;
  const dryRun = args.includes('--dry-run');
  const reset = args.includes('--reset');

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const parsed = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) limit = parsed;
  }

  const catIdx = args.indexOf('--categories');
  if (catIdx !== -1 && args[catIdx + 1]) {
    const requested = args[catIdx + 1].split(',').map((c) => c.trim());
    const invalid = requested.filter((c) => !ALL_CATEGORIES.includes(c as never));
    if (invalid.length > 0) {
      console.error(`❌ 알 수 없는 카테고리: ${invalid.join(', ')}`);
      console.error(`   사용 가능: ${ALL_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    categories = requested;
  }

  return { limit, categories, dryRun, reset };
}

function loadState(): BackfillState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { cursors: {}, lastRun: '' };
  }
}

function saveState(state: BackfillState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`${url} 응답 ${response.status}`);
  }
  return response.text();
}

async function main() {
  const { limit, categories, dryRun, reset } = parseArgs();

  if (!dryRun && !process.env.INDEXNOW_KEY) {
    console.error('❌ INDEXNOW_KEY 환경 변수가 필요합니다 (frontend/public 의 키 파일과 동일 값).');
    process.exit(1);
  }

  const state = reset ? { cursors: {}, lastRun: '' } : loadState();

  console.log(`📋 사이트맵 인덱스 조회: ${SITEMAP_INDEX}`);
  const indexLocs = extractLocs(await fetchText(SITEMAP_INDEX));
  const chunkRefs = selectFacilityChunks(indexLocs, categories);
  if (chunkRefs.length === 0) {
    console.error('❌ 시설 사이트맵 청크를 찾지 못했습니다. 사이트맵 인덱스를 확인하세요.');
    process.exit(1);
  }
  console.log(`  시설 청크 ${chunkRefs.length}개 (${categories.join(', ')})`);

  const chunks: Array<{ name: string; urls: string[] }> = [];
  let totalUrls = 0;
  for (const ref of chunkRefs) {
    const urls = filterDetailUrls(extractLocs(await fetchText(ref.url)), ref.category);
    chunks.push({ name: ref.name, urls });
    totalUrls += urls.length;
  }
  console.log(`  상세 URL 총 ${totalUrls.toLocaleString()}개`);

  const { picks, nextCursors } = planSubmission(chunks, state.cursors, limit);
  const planned = picks.reduce((sum, p) => sum + p.urls.length, 0);
  const alreadySubmitted = chunks.reduce(
    (sum, c) => sum + Math.min(state.cursors[c.name] ?? 0, c.urls.length),
    0
  );

  console.log(`\n🚀 이번 실행 제출 계획: ${planned.toLocaleString()}개 (기제출 ~${alreadySubmitted.toLocaleString()}개)`);
  for (const pick of picks) {
    console.log(`  ${pick.name}: ${pick.urls.length.toLocaleString()}개`);
  }

  if (dryRun) {
    console.log('\n(dry-run — 제출하지 않음)');
    return;
  }
  if (planned === 0) {
    console.log('✅ 남은 미제출 URL이 없습니다.');
    return;
  }

  let totalSubmitted = 0;
  for (const pick of picks) {
    const { submitted, failed } = await submitIndexNow(pick.urls);
    if (failed > 0 || submitted < pick.urls.length) {
      console.error(`❌ ${pick.name} 제출 실패 (성공 ${submitted}/${pick.urls.length}) — 커서를 보존하고 중단합니다.`);
      break;
    }
    state.cursors[pick.name] = nextCursors[pick.name];
    totalSubmitted += submitted;
    saveState({ ...state, lastRun: new Date().toISOString() });
  }

  const remainingTotal = totalUrls - alreadySubmitted - totalSubmitted;
  console.log(`\n📊 결과: 제출 ${totalSubmitted.toLocaleString()}개 / 남은 미제출 ~${Math.max(remainingTotal, 0).toLocaleString()}개`);
  console.log('   다음 실행 시 이어서 제출됩니다.');
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error('스크립트 실행 중 오류:', err);
    process.exit(1);
  });
}
