import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeKoreanToSlug } from '../../src/scripts/syncRegion.js';

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
});
