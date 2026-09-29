import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolveBaselineSchemaPath } from '../../src/scripts/runWasteMigrationProof.js';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

describe('assertLocalTestDatabaseUrl', () => {
  it('accepts only localhost MySQL test databases on the Docker port without changing credentials', () => {
    const url = 'mysql://user:secret@localhost:3307/ilsangkit_housing_test?connection_limit=1';

    expect(assertLocalTestDatabaseUrl(url)).toBe(url);
    expect(assertLocalTestDatabaseUrl(url.replace('localhost', '127.0.0.1'))).toContain('127.0.0.1');
  });

  it.each([
    undefined,
    'postgresql://user:secret@localhost:3307/ilsangkit_housing_test',
    'mysql://user:secret@example.com:3307/ilsangkit_housing_test',
    'mysql://user:secret@localhost:3306/ilsangkit_housing_test',
    'mysql://user:secret@localhost:3307/ilsangkit',
    'mysql://user:secret@localhost:3307/_test',
    'not-a-url',
  ])('rejects unsafe test database URL %s without leaking credentials', (url) => {
    expect(() => assertLocalTestDatabaseUrl(url)).toThrow(/HOUSING_TEST_DATABASE_URL|Dedicated localhost:3307 \*_test/);

    try {
      assertLocalTestDatabaseUrl(url);
    } catch (error) {
      expect(String(error)).not.toContain('secret');
      expect(String(error)).not.toContain('user:');
    }
  });
});

describe('waste migration proof baseline preflight', () => {
  it('requires an explicit readable baseline schema before checking database access', () => {
    const result = spawnSync(
      'node_modules/.bin/tsx',
      ['src/scripts/runWasteMigrationProof.ts'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          HOUSING_TEST_DATABASE_URL: 'not-a-url',
          WASTE_BASELINE_SCHEMA_PATH: '',
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WASTE_BASELINE_SCHEMA_PATH or --baseline-schema is required');
    expect(result.stderr).not.toContain('not-a-url');
  });

  it('accepts env or CLI baseline schema paths only when they point to readable files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'waste-baseline-'));
    const schemaPath = join(dir, 'schema.prisma');
    writeFileSync(schemaPath, 'datasource db { provider = "mysql" url = env("DATABASE_URL") }');

    try {
      expect(resolveBaselineSchemaPath([], { WASTE_BASELINE_SCHEMA_PATH: schemaPath })).toBe(schemaPath);
      expect(resolveBaselineSchemaPath([`--baseline-schema=${schemaPath}`], {})).toBe(schemaPath);
      expect(() => resolveBaselineSchemaPath([], { WASTE_BASELINE_SCHEMA_PATH: join(dir, 'missing.prisma') }))
        .toThrow('Baseline schema path must be a readable regular file');
      expect(() => resolveBaselineSchemaPath(['--baseline-schema', dir], {}))
        .toThrow('Baseline schema path must be a readable regular file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
