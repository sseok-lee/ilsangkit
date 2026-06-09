import { describe, it, expect } from 'vitest';
import { normalizeKoreanToSlug } from '../../src/scripts/syncRegion.js';
// 프론트엔드 단일 소스(standalone, 무의존) — 백엔드↔프론트 slug 드리프트 방지용
import { DISTRICT_SLUG_MAP } from '../../../frontend/shared/regionSlugs';

describe('Region slug 로마자화 가드', () => {
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
