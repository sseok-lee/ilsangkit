import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareRealEstateSummaryV2, validationBatchCountsSqlForTests } from '../../src/services/realEstateSummaryValidation.js';

describe('realEstateSummaryValidation service guards', () => {
  it('rejects relative reportOut before acquiring a write lock or touching the database', async () => {
    await expect(prepareRealEstateSummaryV2({ reportOut: 'relative/report.json' })).rejects.toThrow('--report-out must be an absolute path');
  });

  it('rejects an existing directory reportOut before acquiring a write lock or touching the database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'summary-report-out-dir-'));
    try {
      await expect(prepareRealEstateSummaryV2({ reportOut: dir })).rejects.toThrow('--report-out must not point to a directory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps validation projection narrow and combines core batch drift into one windowed source projection', () => {
    const sql = validationBatchCountsSqlForTests('apt-sale');

    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect((sql.match(/ROW_NUMBER\(\) OVER/g) ?? [])).toHaveLength(1);
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('raw_keys');
    expect(sql).toContain('missingKeys');
    expect(sql).toContain('mismatchedGroups');
    expect(sql).toContain('extraKeys');
  });

});
