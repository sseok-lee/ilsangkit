import { describe, expect, it } from 'vitest';
import {
  applyReleaseSchema,
  classifyColumn,
  normalizeCheckClause,
  rejectDangerousSql,
  validateExistingTable,
  type ExpectedTable,
  type IntrospectedTable,
} from '../../src/scripts/applyReleaseSchema.js';

const expected: ExpectedTable = {
  name: 'Example',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment' },
    { name: 'buildingKey', type: 'char(64)', nullable: false },
    { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)', extra: 'on update CURRENT_TIMESTAMP(3)' },
  ],
  indexes: [
    { name: 'PRIMARY', unique: true, columns: ['id'] },
    { name: 'Example_buildingKey_key', unique: true, columns: ['buildingKey'] },
  ],
  checks: [
    { name: 'Example_buildingKey_hex_chk', clause: "REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c')" },
  ],
};

const actual: IntrospectedTable = {
  name: 'Example',
  columns: [
    { name: 'id', type: 'int(11)', nullable: false, default: null, extra: 'auto_increment' },
    { name: 'buildingKey', type: 'char(64)', nullable: false, default: null, extra: '' },
    { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'current_timestamp(3)', extra: 'DEFAULT_GENERATED on update current_timestamp(3)' },
  ],
  indexes: [
    { name: 'PRIMARY', unique: true, columns: ['id'] },
    { name: 'Example_buildingKey_key', unique: true, columns: ['buildingKey'] },
    { name: 'Example_extra_idx', unique: false, columns: ['buildingKey'] },
  ],
  checks: [
    { name: 'Example_buildingKey_hex_chk', clause: "regexp_like(`buildingKey`,_utf8mb4'^[a-f0-9]{64}$',_utf8mb4'c')" },
  ],
};

describe('applyReleaseSchema allowlist validation', () => {
  it('rejects destructive or broad historical migration SQL before allowlist classification', () => {
    expect(() => rejectDangerousSql('DROP TABLE RealEstateBuildingSummary')).toThrow(/Forbidden DDL token/);
    expect(() => rejectDangerousSql('TRUNCATE TABLE ApartmentSaleTransaction')).toThrow(/Forbidden DDL token/);
    expect(() => rejectDangerousSql('ALTER TABLE RealEstateBuildingSummary ADD COLUMN buildingKey CHAR\\(64\\)')).toThrow(/legacy summary/);
    expect(() => rejectDangerousSql('ALTER TABLE Subscription ADD COLUMN publicRental JSON NULL')).not.toThrow();
  });

  it('normalizes MySQL column and CHECK representations without weakening datetime precision', () => {
    expect(classifyColumn(actual.columns[0])).toMatchObject({ type: 'int' });
    expect(classifyColumn(actual.columns[2])).toMatchObject({
      type: 'datetime(3)',
      default: 'current_timestamp(3)',
      extra: expect.stringContaining('on update current_timestamp(3)'),
    });
    expect(classifyColumn({ ...actual.columns[2], type: 'datetime' }).type).toBe('datetime');
    expect(normalizeCheckClause(actual.checks[0].clause)).toBe(
      normalizeCheckClause(expected.checks[0].clause)
    );
  });

  it('accepts matching expected structure, ignores additive extra indexes, and reports checksum', () => {
    const result = validateExistingTable(expected, actual);

    expect(result.ok).toBe(true);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.errors).toEqual([]);
  });

  it('rejects drift in column type, index order, and missing CHECK without auto-fixing', () => {
    expect(validateExistingTable(expected, {
      ...actual,
      columns: actual.columns.map(column => column.name === 'buildingKey'
        ? { ...column, type: 'varchar(64)', nullable: true }
        : column),
    }).errors.join('\n')).toMatch(/buildingKey/);

    expect(validateExistingTable(expected, {
      ...actual,
      indexes: actual.indexes.map(index => index.name === 'Example_buildingKey_key'
        ? { ...index, columns: ['id', 'buildingKey'] }
        : index),
    }).errors.join('\n')).toMatch(/Example_buildingKey_key/);

    expect(validateExistingTable(expected, {
      ...actual,
      checks: [],
    }).errors.join('\n')).toMatch(/Example_buildingKey_hex_chk/);
  });

  it('preserves string literal case and boolean grouping when normalizing CHECK clauses', () => {
    expect(normalizeCheckClause("REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c')")).not.toBe(
      normalizeCheckClause("REGEXP_LIKE(buildingKey, '^[A-F0-9]{64}$', 'c')")
    );
    expect(normalizeCheckClause('(a AND b) OR c')).not.toBe(
      normalizeCheckClause('a AND (b OR c)')
    );
  });

  it('runs apply through a pinned session and sets low lock timeout before DDL', async () => {
    const events: string[] = [];
    const sessionDb = {
      pinnedSession: true,
      query: async <T>(sql: string): Promise<T[]> => {
        events.push(`query:${sql}`);
        if (sql.includes('VERSION')) return [{ version: '8.0.44' }] as T[];
        if (sql.includes('@@SESSION.lock_wait_timeout')) return [{ lock_wait_timeout: 3 }] as T[];
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [{ count: 0 }] as T[];
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [] as T[];
        if (sql.includes('INFORMATION_SCHEMA.STATISTICS')) return [] as T[];
        return [] as T[];
      },
      execute: async (sql: string): Promise<unknown> => {
        events.push(`execute:${sql}`);
        return undefined;
      },
    };
    const db = {
      withSession: async (fn: (sessionDatabase: typeof sessionDb) => Promise<unknown>) => fn(sessionDb),
      query: async () => { throw new Error('outer connection should not be used'); },
      execute: async () => { throw new Error('outer connection should not be used'); },
    };

    await expect(applyReleaseSchema(db)).rejects.toThrow(/Subscription table is required/);

    expect(events[0]).toMatch(/^query:SELECT VERSION/);
    expect(events).toContain('execute:SET SESSION lock_wait_timeout = 3');
    expect(events.some(event => event.includes('CREATE TABLE'))).toBe(false);
  });

});
