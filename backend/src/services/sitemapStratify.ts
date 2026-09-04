/**
 * 사이트맵 상한 절단 시 "어떤 N개를 뽑을지"를 결정하는 SQL 생성 (순수 함수).
 *
 * ## 배경 — 절단 순서가 정의돼 있지 않았다
 *
 * `SITEMAP_FACILITY_LIMITS`(sitemapService.ts)는 검색 수요 데이터에 근거한 의도적인
 * 크롤 예산 조치다(e8db782e, 2026-03-24). 총량은 유지가 맞다.
 *
 * 문제는 뽑는 방식이었다. facilityService.getAllIds 가
 *
 *     config.model().findMany({ select: {...}, take: limit })   // orderBy 없음
 *
 * 로 잘라, 어떤 15,000개가 선택되는지 정의돼 있지 않았다(MySQL 구현 의존).
 * 실제로는 물리적 저장 순서 ≈ id 오름차순 ≈ 지역코드 오름차순이 되어
 * 앞 지역이 상한을 다 먹었다.
 *
 * 2026-07-29 프로덕션 childcare 사이트맵 실측 — 15,000 URL 의 지역코드 분포:
 *   11(서울) 9,486 · 12 2 · 26(부산) 2,540 · 27(대구) 2,125 · 28(인천) 847
 *   → 지역코드 5개뿐. 29(광주) 이후 13개 시·도가 통째로 빠져 있었다.
 *
 * 게다가 순서가 미정의라 배포마다 선택 집합이 바뀔 수 있다. 그러면 구글 입장에서
 * URL 이 사이트맵에 들어왔다 나갔다 하는 셈이라, lastmod 를 정직하게 만들어 둔
 * 노력(#690/#691)까지 같은 시스템의 신뢰를 깎아먹는다.
 *
 * ## 해법 — 구·군 라운드로빈
 *
 * 구·군별로 순번(rn)을 매기고 rn 을 우선 정렬한다. 그러면
 * "각 구·군의 1번째 → 각 구·군의 2번째 → …" 순서가 되어, 상한이 걸려도
 * 모든 지역이 밀도에 비례해 고르게 포함된다.
 *
 * 적용 후 같은 15,000 URL 의 지역코드 분포: 5개 → 18개
 *   11 2,250 · 41 1,783 · 26 1,279 · 48 1,091 · 47 1,089 · 46 978 … (전 지역 포함)
 *
 * 파티션 내부를 id 로 정렬하므로 결과는 결정론적이다 — 같은 데이터면 같은 집합이 나온다.
 *
 * ## SQL 안전
 *
 * 테이블명만 아래 고정 화이트리스트에서 보간하고, limit 은 `?` 파라미터로 바인딩한다.
 * facilityService 의 koreanNameFirstIds 가 쓰는 것과 동일한 규칙이다.
 */

/** 테이블명은 raw SQL 에 보간되므로 반드시 이 고정 목록에서만 온다. */
export const SITEMAP_STRATIFY_TABLES: Record<string, string> = {
  childcare: 'Childcare',
  aed: 'Aed',
  sports: 'Sports',
  clothes: 'Clothes',
  'ev-charger': 'EvCharger',
};

export interface StratifyOptions {
  /**
   * EvCharger 전용. 행이 커넥터 단위(49만)라 statId 로 묶어야 충전소 단위(9.8만)가 된다.
   *
   * 기존 코드는 Prisma 의 `distinct: ['statId']` 를 썼는데 그건 앱 메모리에서 처리된다 —
   * 이 프로젝트에서 야간 지오코딩 OOM(2.07GB)을 낸 바로 그 패턴이다.
   * GROUP BY 로 DB 안에서 접으면 그 지뢰도 함께 사라진다.
   */
  groupByStationId?: boolean;
  /**
   * 중복 통합(rel=canonical) 그룹 키 컬럼. 주면 그룹 대표행(최소 id)만 남긴다.
   *
   * 반드시 LIMIT **안쪽**에서 걸러야 한다. 바깥에서 걸러내면 aed 15,000 상한이
   * "15,000 뽑고 그중 비대표를 뺀" 수가 되어 사이트맵이 그만큼 줄고,
   * .github/workflows/regen-sitemaps.yml 의 파일별 20% count-drop 가드에 걸려
   * 교체 자체가 거부된다. 안쪽에서 걸러야 "중복 제거 후 15,000"이 된다.
   */
  dedupeGroupColumns?: string[];
}

/**
 * @param table  SITEMAP_STRATIFY_TABLES 에서 온 테이블명 (호출자가 검증 책임)
 * @returns `?` 하나(limit)를 받는 SQL. `{ id, updatedAt }` 행을 돌려준다.
 */
export function buildStratifiedIdsSql(table: string, options: StratifyOptions = {}): string {
  const source = options.groupByStationId
    ? `(
      SELECT statId AS id, MAX(updatedAt) AS updatedAt,
             MIN(city) AS city, MIN(district) AS district
      FROM \`${table}\`
      WHERE statId IS NOT NULL
      GROUP BY statId
    ) g`
    : `\`${table}\``;

  // 중복 통합 대상 카테고리는 여기서 비대표행을 뺀다 — ROW_NUMBER 와 LIMIT 보다 안쪽이라
  // 상한이 "중복 제거 후 N개"가 된다. (groupByStationId 경로는 커넥터→충전소 접기라 무관)
  const dedupe = options.dedupeGroupColumns?.length && !options.groupByStationId
    ? ` t0 ${buildCanonicalDedupeWhere(table, options.dedupeGroupColumns, 't0')}`
    : '';

  // ORDER BY rn 이 id 보다 먼저여야 지역 라운드로빈이 된다. 순서를 바꾸면
  // 지역코드 오름차순으로 되돌아가 앞 지역이 상한을 독식한다.
  return `SELECT id, updatedAt FROM (
    SELECT id, updatedAt,
           ROW_NUMBER() OVER (PARTITION BY city, district ORDER BY id) AS rn
    FROM ${source}${dedupe}
  ) t
  ORDER BY rn, id
  LIMIT ?`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 중복 통합(rel=canonical) 대표행 선별
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 컬럼명도 테이블명과 똑같이 raw SQL 에 보간된다. 호출부는 모듈 상수(CANONICAL_GROUP_FIELDS)
 * 에서만 넘기지만, 보간 지점에서 한 번 더 막는다 — 이 파일의 테이블명 화이트리스트와 같은 규칙.
 */
const SAFE_COLUMN_RE = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * "그룹 대표행(= 그룹 내 최소 id)만 남긴다" 는 WHERE 절을 만든다.
 *
 * ## 왜 필요한가
 * 제목·설명을 만드는 필드가 형제 행과 하나도 다르지 않은 행은, 상세 페이지가 단어 하나까지
 * 같은 문서가 된다. 실측(2026-09-04 로컬 DB): AED 62,707행 중 361행이 그렇다 —
 * 예를 들어 name='양구군보건소' · buildPlace='보건정책과 사무실' · org='양구군보건소' ·
 * 같은 주소인 18행은 서로 완전히 동일하다. 이 URL 들은 대표 페이지로 rel=canonical 되므로
 * 사이트맵에 광고하면 안 된다 — 사이트맵은 "200 · 색인가능 · 자기참조 canonical" URL 만
 * 담는 자리다(sitemapPolicy.ts 의 <loc> 품질 게이트 주석 참고).
 *
 * 반대로 같은 건물의 층별 AED(㈜녹십자 1~5층처럼 buildPlace 가 서로 다른 행)는 제목이
 * 갈라지므로 그룹에 들어오지 않는다. 그래서 그룹 키에 제목·설명이 읽는 필드를 하나도
 * 빠뜨리면 안 된다 — 키가 좁으면 서로 다른 페이지가 통합돼 버린다.
 *
 * ## 왜 GROUP BY 가 아니라 NOT EXISTS 인가
 * `GROUP BY … MIN(id)` 로 접으면 대표행의 updatedAt 을 잃어 MAX(updatedAt) 같은 대체값을
 * 써야 하는데, 그건 lastmod 를 실제보다 새것으로 만든다 — #690 에서 걷어낸 "거짓 신선도"의
 * 재발이다. 여기서는 행을 그대로 두고 비대표행만 뺀다.
 *
 * ## `<=>` 인 이유
 * NULL-safe equality. `=` 로 쓰면 address 가 NULL 인 형제끼리 매칭되지 않아 중복이 그대로
 * 남는다(Prisma 쪽 findCanonicalId 가 undefined 대신 null 을 넣는 것과 같은 이유).
 *
 * @param table   호출자가 화이트리스트에서 꺼낸 테이블명
 * @param columns 그룹 키 컬럼들 (제목·설명이 읽는 필드 전부)
 * @param alias   바깥 쿼리에서 이 테이블에 붙인 별칭
 */
export function buildCanonicalDedupeWhere(table: string, columns: string[], alias: string): string {
  if (columns.length === 0) throw new Error('buildCanonicalDedupeWhere: columns 가 비었다');
  for (const col of columns) {
    if (!SAFE_COLUMN_RE.test(col)) throw new Error(`buildCanonicalDedupeWhere: 잘못된 컬럼명 ${col}`);
  }
  const predicates = columns.map((col) => `s.\`${col}\` <=> ${alias}.\`${col}\``).join('\n        AND ');
  return `WHERE NOT EXISTS (
      SELECT 1 FROM \`${table}\` s
      WHERE s.id < ${alias}.id
        AND ${predicates}
    )`;
}

/** 상한이 없는 카테고리(parking)용 — 대표행의 id·updatedAt 만 전량 반환. */
export function buildDedupedIdsSql(table: string, columns: string[]): string {
  return `SELECT id, updatedAt FROM \`${table}\` t0 ${buildCanonicalDedupeWhere(table, columns, 't0')}`;
}

/**
 * 사이트맵 인덱스가 광고할 청크 수를 계산하는 COUNT.
 * 인덱스와 실제 청크가 다른 모수를 쓰면, 광고만 되고 비어 있는 청크가 생겨
 * fail-closed 503 으로 재생성이 막힌다(sitemap/[...].ts 의 sitemapUpstreamUnavailable).
 */
export function buildDedupedCountSql(table: string, columns: string[]): string {
  return `SELECT COUNT(*) AS cnt FROM \`${table}\` t0 ${buildCanonicalDedupeWhere(table, columns, 't0')}`;
}
