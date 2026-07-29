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

  // ORDER BY rn 이 id 보다 먼저여야 지역 라운드로빈이 된다. 순서를 바꾸면
  // 지역코드 오름차순으로 되돌아가 앞 지역이 상한을 독식한다.
  return `SELECT id, updatedAt FROM (
    SELECT id, updatedAt,
           ROW_NUMBER() OVER (PARTITION BY city, district ORDER BY id) AS rn
    FROM ${source}
  ) t
  ORDER BY rn, id
  LIMIT ?`;
}
