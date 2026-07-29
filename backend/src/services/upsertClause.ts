/**
 * `INSERT ... ON DUPLICATE KEY UPDATE` 의 UPDATE 절 생성 (순수 함수).
 *
 * 핵심 규칙 — 두 타임스탬프의 의미를 분리한다:
 *   syncedAt   = 마지막으로 "확인"한 시각.  항상 NOW().
 *   updatedAt  = 마지막으로 "실제 내용이 바뀐" 시각. 값이 하나라도 달라졌을 때만 NOW().
 *
 * ## 배경
 *
 * 기존 코드는 `updatedAt` = NOW() 를 무조건 찍었다. 소스 데이터가 전과 동일해도
 * sync 가 훑기만 하면 그 행은 "방금 수정됨"이 됐다. 시설 사이트맵 lastmod 가
 * 이 컬럼에서 나오므로(sitemapService → facilityService.getAllIds), lastmod 는
 * 콘텐츠 변경이 아니라 **sync 활동**을 반영하게 됐다.
 *
 * 2026-07-29 프로덕션 사이트맵 실측 — 한 카테고리(10,000 URL) 안의 lastmod 고유 날짜 수:
 *   school 64 · aed 43 · toilet 27 · hospital 20 · park 7
 *
 * Google 은 lastmod 가 consistently/verifiably accurate 하지 않으면 그 신호를 무시한다.
 * 거짓 신선도를 계속 내보내는 것은 신호가 없는 것보다 나쁘다.
 * (부동산은 이 문제를 이미 우회하고 있다 — sitemapService.ts:14 는 lastmod 를
 *  updatedAt 대신 MAX(dealYmd) 에서 만든다. 시설에는 그런 대체 신호가 없어 이 수정이 필요하다.)
 *
 * ## ★ 대입 순서가 정확성을 좌우한다
 *
 * MySQL 의 ON DUPLICATE KEY UPDATE 는 대입을 **좌→우로** 평가하고, 우변의 컬럼 참조는
 * "그 시점까지 갱신된 값"을 본다. 따라서 content 대입이 먼저 오면
 *
 *     `name` = VALUES(`name`), `updatedAt` = IF(NOT (`name` <=> VALUES(`name`)), ...)
 *                                                 ^^^^^ 이미 갱신돼서 항상 같음
 *
 * 비교가 항상 참이 되어 updatedAt 은 영원히 바뀌지 않는다.
 * 그래서 updatedAt 조건절을 **맨 앞에** 놓는다.
 *
 * ## 비교 연산자
 *
 * `<=>` (NULL-safe equal) 를 쓴다. 일반 `=` 는 한쪽이 NULL 이면 UNKNOWN 을 반환해
 * NULL→값, 값→NULL 변경을 놓친다. 공공데이터는 NULL 필드가 흔하다.
 */

/** 갱신 대상에서 항상 제외되는 컬럼 (호출자가 추가로 확장할 수 있다) */
export const DEFAULT_SKIP_UPDATE_COLS = [
  'id',
  'sourceId',
  'viewCount',
  'createdAt',
  'updatedAt',
  'syncedAt',
] as const;

/**
 * @param columns  INSERT 에 쓰이는 전체 컬럼 목록 (배치 첫 항목의 키 순서)
 * @param skipUpdateCols  UPDATE 에서 제외할 컬럼 집합
 * @returns `ON DUPLICATE KEY UPDATE` 뒤에 붙일 절. 항목이 없으면 빈 문자열.
 */
export function buildOnDuplicateUpdateClause(
  columns: string[],
  skipUpdateCols: Set<string>
): string {
  const contentCols = columns.filter((c) => !skipUpdateCols.has(c));

  const parts: string[] = [];

  // 1) updatedAt 조건절 — 반드시 content 대입보다 앞.
  //    갱신되는 content 컬럼이 하나도 없으면 바뀔 것도 없으므로 절 자체를 만들지 않는다
  //    (`NOT ()` 는 문법 오류다).
  if (columns.includes('updatedAt') && contentCols.length > 0) {
    const changed = contentCols
      .map((c) => `\`${c}\` <=> VALUES(\`${c}\`)`)
      .join(' AND ');
    parts.push(`\`updatedAt\` = IF(NOT (${changed}), NOW(), \`updatedAt\`)`);
  }

  // 2) content 대입
  for (const c of contentCols) {
    parts.push(`\`${c}\` = VALUES(\`${c}\`)`);
  }

  // 3) syncedAt — 내용이 그대로여도 "확인은 했다"는 사실은 기록한다.
  //    이 컬럼이 항상 바뀌므로 MySQL 의 affected-rows 휴리스틱(기존 행 = 2)도 그대로 유지된다.
  if (columns.includes('syncedAt')) {
    parts.push('`syncedAt` = NOW()');
  }

  return parts.join(', ');
}
