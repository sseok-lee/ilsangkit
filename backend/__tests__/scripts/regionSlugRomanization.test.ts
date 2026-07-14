import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeKoreanToSlug } from '../../src/scripts/syncRegion.js';
import { DISTRICT_SLUG_MAP as BACKEND_LIB_DISTRICT_SLUG_MAP } from '../../src/lib/regionSlugs.js';

/**
 * 프론트엔드 단일 소스(`frontend/shared/regionSlugs.ts`)의 DISTRICT_SLUG_MAP을
 * 텍스트로 읽어 파싱한다.
 *
 * 왜 import가 아니라 텍스트 파싱인가:
 * 해당 파일을 직접 import 하면 vite/esbuild가 frontend/tsconfig.json(→ .nuxt/tsconfig.json
 * 을 extends)을 resolve 하려다 CI 백엔드 잡(.nuxt 미생성)에서 TSConfckParseError로 깨진다.
 * 텍스트로만 읽으면 트랜스폼이 일어나지 않아 환경에 안전하면서도 드리프트 검증은 유지된다.
 */
function loadFrontendDistrictSlugMap(): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(here, '../../../frontend/shared/regionSlugs.ts');
  const src = readFileSync(filePath, 'utf8');

  const startMatch = src.match(/export const DISTRICT_SLUG_MAP[^=]*=\s*\{/);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error('DISTRICT_SLUG_MAP 선언을 frontend/shared/regionSlugs.ts에서 찾지 못함');
  }
  const bodyStart = startMatch.index + startMatch[0].length;
  const bodyEnd = src.indexOf('\n}', bodyStart);
  if (bodyEnd === -1) throw new Error('DISTRICT_SLUG_MAP 닫는 괄호를 찾지 못함');
  const body = src.slice(bodyStart, bodyEnd);

  const map: Record<string, string> = {};
  // 각 라인: `'화성시 동탄구': 'hwaseong-dongtan',` 또는 `서울: 'seoul',`
  const lineRe = /(?:'([^']+)'|([^\s:'"]+))\s*:\s*'([^']+)'/;
  for (const line of body.split('\n')) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const key = m[1] ?? m[2];
    map[key] = m[3];
  }
  return map;
}

describe('Region slug 로마자화 가드', () => {
  const DISTRICT_SLUG_MAP = loadFrontendDistrictSlugMap();

  it('프론트 DISTRICT_SLUG_MAP을 정상 파싱했다 (파서 회귀 방지)', () => {
    // 현재 200+ 개 구/시가 등록되어 있음. 파서가 깨져 0건이면 즉시 실패.
    expect(Object.keys(DISTRICT_SLUG_MAP).length).toBeGreaterThan(200);
  });

  it('백엔드 normalizeKoreanToSlug 결과가 프론트 DISTRICT_SLUG_MAP과 전부 일치한다', () => {
    const mismatches: string[] = [];
    for (const [district, expectedSlug] of Object.entries(DISTRICT_SLUG_MAP)) {
      const got = normalizeKoreanToSlug(district);
      if (got !== expectedSlug) {
        mismatches.push(`${district}: front=${expectedSlug} back=${got}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  // 2026-07-01 인천 2군9구 개편 신설 구 — 3중 맵(syncRegion·프론트·backend/lib) 로마자 등록 가드.
  it('인천 신설 4구가 로마자 slug로 매핑된다', () => {
    expect(normalizeKoreanToSlug('제물포구')).toBe('jemulpo');
    expect(normalizeKoreanToSlug('영종구')).toBe('yeongjong');
    expect(normalizeKoreanToSlug('서해구')).toBe('seohae');
    expect(normalizeKoreanToSlug('검단구')).toBe('geomdan');
  });

  it('어떤 구/군/시도 한글이 섞인 slug를 생성하지 않는다 (한글 fallback 차단)', () => {
    const koreanLeak: string[] = [];
    for (const district of Object.keys(DISTRICT_SLUG_MAP)) {
      const slug = normalizeKoreanToSlug(district);
      if (!/^[a-z0-9-]+$/.test(slug)) {
        koreanLeak.push(`${district} → ${slug}`);
      }
    }
    expect(koreanLeak).toEqual([]);
  });

  // backend/src/lib/regionSlugs.ts 의 DISTRICT_SLUG_MAP 은 IndexNow·색인 제출 URL 생성에
  // 쓰인다(toDistrictSlug). 프론트 맵과 어긋나면 매핑 실패 → 한글 fallback slug(404 URL)를
  // 검색엔진에 제출한다. 과거 화성·부천 7개 신설 구가 이 맵에만 누락돼 사고가 났으므로
  // 프론트 단일 소스와 완전 일치를 강제한다.
  it('backend/lib DISTRICT_SLUG_MAP 이 프론트 단일 소스와 완전 일치한다 (IndexNow 유출 차단)', () => {
    const mismatches: string[] = [];
    for (const [district, expectedSlug] of Object.entries(DISTRICT_SLUG_MAP)) {
      const got = BACKEND_LIB_DISTRICT_SLUG_MAP[district];
      if (got !== expectedSlug) {
        mismatches.push(`${district}: front=${expectedSlug} backendLib=${got ?? '(누락)'}`);
      }
    }
    for (const district of Object.keys(BACKEND_LIB_DISTRICT_SLUG_MAP)) {
      if (!(district in DISTRICT_SLUG_MAP)) {
        mismatches.push(`${district}: backendLib 에만 존재(프론트 누락)`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
