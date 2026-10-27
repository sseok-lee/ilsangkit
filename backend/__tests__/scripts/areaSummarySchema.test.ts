import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AREA_SUMMARY_TABLES } from '../../src/scripts/applyReleaseSchema.js';

const migration = readFileSync(new URL('../../prisma/migrations/202610270001_building_area_summary/migration.sql', import.meta.url), 'utf8');
const incrementalMigration = readFileSync(new URL('../../prisma/migrations/202610270002_area_incremental_checkpoint/migration.sql', import.meta.url), 'utf8');
describe('지도 면적 요약 배포 스키마', () => {
  it.each(AREA_SUMMARY_TABLES)('$name은 수동 migration과 applyReleaseSchema에서 같은 컬럼·인덱스를 만든다', (table) => {
    let body = migration.split(`CREATE TABLE \`${table.name}\` (`)[1]?.split(') DEFAULT CHARACTER')[0];
    expect(body).toBeDefined();
    if (table.name === 'RealEstateAreaSummaryState') {
      const additions = [...incrementalMigration.matchAll(/ADD COLUMN (`\w+` [^,;]+)/g)].map((m) => `  ${m[1]},`).join('\n');
      expect(additions).toContain('`incrementalThrough` DATETIME(3) NULL');
      expect(additions).toContain('`incrementalDateThrough` CHAR(10) NULL');
      body = body.replace('  PRIMARY KEY', `${additions}\n  PRIMARY KEY`);
    }
    const columns = [...body.matchAll(/^\s*`(\w+)`/gm)].map((m) => m[1]);
    expect(columns).toEqual(table.columns.map((c) => c.name));
    for (const index of table.indexes) {
      if (index.name !== 'PRIMARY') expect(body).toContain(index.name);
      expect(body).toContain(index.columns.map((c) => `\`${c}\``).join(', '));
    }
    expect(table.createSql.replace(/\s/g, '')).toBe(`CREATE TABLE \`${table.name}\` (${body}) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`.replace(/\s/g, ''));
  });
});
