/**
 * 지하철역 ASCII 슬러그 생성기.
 *
 * 우선순위:
 *  1. 영문역사명 → 슬러그화 (예: "Gangnam-gu Office" → "gangnam-gu-office")
 *  2. fallback: 역사명에서 ASCII만 추출
 *
 * 충돌 시 noseon 번호 기반 deterministic suffix 부여.
 */

const SLUG_BASE_RE = /[^a-z0-9]+/g;

function baseSlug(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(SLUG_BASE_RE, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 노선 식별자 추출 — slug suffix 용.
 *  - "2호선" → "line2"
 *  - "9호선" → "line9"
 *  - "신분당선" → "shinbundang" (한글이면 lineNumber에서 추출)
 *  - lineNumber 코드 (예: "S1102", "I41D1") → 마지막 영숫자 그룹 사용
 */
export function lineSuffix(lineName: string, lineNumber: string): string {
  const numMatch = lineName.match(/(\d+)호선/);
  if (numMatch) return `line${numMatch[1]}`;

  const ascii = lineName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (ascii) return ascii;

  const codeAscii = lineNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return codeAscii || 'unknown';
}

export interface SlugifyArgs {
  englishName: string;
  koreanName: string;
  lineName: string;
  lineNumber: string;
  takenSlugs: Set<string>;
}

/**
 * 단일 station에 대한 slug 생성. takenSlugs 집합에 결과를 등록한다.
 */
export function slugifyStation(args: SlugifyArgs): string {
  const { englishName, koreanName, lineName, lineNumber, takenSlugs } = args;

  const primary = englishName?.trim() || '';
  let base = baseSlug(primary);

  if (!base) {
    // 영문명 부재 시 한글에서 ASCII만 — 대부분 빈 문자열이 되므로 강제 fallback
    base = baseSlug(koreanName ?? '') || 'station';
  }

  if (!takenSlugs.has(base)) {
    takenSlugs.add(base);
    return base;
  }

  // 충돌 — line suffix 부여
  const suffix = lineSuffix(lineName, lineNumber);
  const composite = `${base}-${suffix}`;
  if (!takenSlugs.has(composite)) {
    takenSlugs.add(composite);
    return composite;
  }

  // 여전히 충돌 시 sourceId 기반 단조 증가 suffix
  let n = 2;
  while (takenSlugs.has(`${composite}-${n}`)) n++;
  const final = `${composite}-${n}`;
  takenSlugs.add(final);
  return final;
}
