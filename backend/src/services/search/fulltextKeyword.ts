// FULLTEXT(ngram) 키워드 검색 헬퍼.
// LIKE '%kw%' 풀스캔을 MATCH AGAINST 인덱스 검색으로 대체한다.
// 패턴: raw로 id/count만 조회 → 호출부가 findMany({ id: { in } })로 기존 select/매핑 재사용.
import { prisma } from '../../lib/prisma.js';

/** 카테고리 slug → MySQL 테이블명 (raw 쿼리 테이블 화이트리스트) */
export const FULLTEXT_TABLES: Record<string, string> = {
  toilet: 'Toilet', wifi: 'Wifi', clothes: 'Clothes', parking: 'Parking',
  aed: 'Aed', library: 'Library', hospital: 'Hospital', pharmacy: 'Pharmacy',
  park: 'Park', school: 'School', market: 'Market', childcare: 'Childcare',
  sports: 'Sports',
};

const ALLOWED_TABLES = new Set([...Object.values(FULLTEXT_TABLES), 'WasteSchedule', 'EvCharger']);
const MIN_FT_LENGTH = 2; // ngram_token_size=2 — 1자는 매칭 불가, 호출부가 LIKE 폴백

export function canUseFulltext(keyword?: string | null): keyword is string {
  if (!keyword) return false;
  const cleaned = keyword.replace(/["+\-><()~*@]/g, '').trim();
  return cleaned.length >= MIN_FT_LENGTH;
}

/** BOOLEAN MODE 연산자 무력화 + 구문(phrase) 검색 고정 */
export function toBooleanPhrase(keyword: string): string {
  const cleaned = keyword.replace(/["+\-><()~*@]/g, ' ').trim().replace(/\s+/g, ' ');
  return `"${cleaned}"`;
}

export interface FtRegion { cityVariants?: string[]; district?: string }

function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) throw new Error('fulltext 미지원 테이블');
}

function regionClause(region: FtRegion): { sql: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  if (region.cityVariants && region.cityVariants.length > 0) {
    parts.push(`city IN (${region.cityVariants.map(() => '?').join(', ')})`);
    values.push(...region.cityVariants);
  }
  if (region.district) {
    parts.push('district = ?');
    values.push(region.district);
  }
  return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', values };
}

/** MATCH 매칭 id 목록 (name 순 정렬 — 페이지네이션 결정성 확보) */
export async function fulltextIds(
  table: string, keyword: string, region: FtRegion, limit: number, offset = 0,
): Promise<string[]> {
  assertTable(table);
  const { sql, values } = regionClause(region);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM \`${table}\` WHERE MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)${sql} ORDER BY name ASC LIMIT ? OFFSET ?`,
    toBooleanPhrase(keyword), ...values, limit, offset,
  );
  return rows.map((r) => String(r.id));
}

export async function fulltextCount(table: string, keyword: string, region: FtRegion): Promise<number> {
  assertTable(table);
  const { sql, values } = regionClause(region);
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)${sql}`,
    toBooleanPhrase(keyword), ...values,
  );
  return Number(rows[0]?.cnt ?? 0);
}
