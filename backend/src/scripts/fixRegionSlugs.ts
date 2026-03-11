/**
 * Region 테이블의 slug를 KOREAN_TO_ROMANIZATION 매핑 기준으로 정규화
 *
 * 용도: slug 변경 후 DB가 재동기화되지 않아 발생하는 불일치 수정
 * 예: sejong-si → sejong (접미사 제거)
 *
 * 실행: npx tsx src/scripts/fixRegionSlugs.ts
 *       또는: npm run fix:region-slugs
 */

import prisma from '../lib/prisma.js';
import { normalizeKoreanToSlug } from './syncRegion.js';

async function fixRegionSlugs(): Promise<void> {
  const regions = await prisma.region.findMany();
  let fixed = 0;

  for (const region of regions) {
    const expectedSlug = normalizeKoreanToSlug(region.district);

    if (region.slug !== expectedSlug) {
      console.log(
        `  fix: ${region.city} ${region.district}: "${region.slug}" → "${expectedSlug}"`
      );

      await prisma.region.update({
        where: { id: region.id },
        data: { slug: expectedSlug },
      });
      fixed++;
    }
  }

  if (fixed === 0) {
    console.log('모든 Region slug가 정상입니다.');
  } else {
    console.log(`\n${fixed}개 Region slug 수정 완료.`);
  }
}

console.log('Region slug 정규화 시작...\n');
fixRegionSlugs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('오류:', err);
    process.exit(1);
  });
