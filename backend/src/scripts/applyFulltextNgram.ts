// FULLTEXT 인덱스를 ngram 파서로 스왑하는 멱등 스크립트.
// prisma db push는 @@fulltext를 기본 파서로 생성한다 — 한국어 부분일치는 ngram이 필요하므로
// push 후 이 스크립트로 파서를 교체한다. 이미 ngram이면 건너뛴다.
// 실행: npx tsx src/scripts/applyFulltextNgram.ts
import { prisma } from '../lib/prisma.js';

const TARGETS: Array<{ table: string; index: string; columns: string }> = [
  ...['Toilet', 'Wifi', 'Clothes', 'Park', 'School', 'Childcare', 'Market', 'Parking',
      'Aed', 'Library', 'EvCharger', 'Sports', 'Hospital', 'Pharmacy'].map((table) => ({
    table,
    index: `${table}_name_address_roadAddress_idx`,
    columns: 'name, address, roadAddress',
  })),
  {
    table: 'WasteSchedule',
    index: 'WasteSchedule_targetRegion_emissionPlace_idx',
    columns: 'targetRegion, emissionPlace',
  },
];

async function main() {
  const [{ plugin }] = await prisma.$queryRawUnsafe<Array<{ plugin: bigint }>>(
    "SELECT COUNT(*) AS plugin FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'ngram' AND PLUGIN_STATUS = 'ACTIVE'",
  );
  if (Number(plugin) === 0) {
    console.error('[fulltext-ngram] ngram 플러그인이 비활성 — 중단 (검색은 LIKE 폴백으로 동작)');
    process.exit(1);
  }

  for (const t of TARGETS) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SHOW CREATE TABLE \`${t.table}\``,
    );
    const ddl = Object.values(rows[0]).join(' ');
    const hasIndex = ddl.includes(`\`${t.index}\``);
    const hasNgram = hasIndex && new RegExp(`\`${t.index}\`[^\\n]*ngram`).test(ddl);

    if (hasNgram) {
      console.log(`[fulltext-ngram] ${t.table}: 이미 ngram — 스킵`);
      continue;
    }
    if (hasIndex) {
      console.log(`[fulltext-ngram] ${t.table}: 기본 파서 인덱스 드랍`);
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${t.table}\` DROP INDEX \`${t.index}\``);
    }
    console.log(`[fulltext-ngram] ${t.table}: ngram 인덱스 생성 중...`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${t.table}\` ADD FULLTEXT INDEX \`${t.index}\` (${t.columns}) WITH PARSER ngram`,
    );
  }
  console.log('[fulltext-ngram] 완료');
}

main().finally(() => prisma.$disconnect());
