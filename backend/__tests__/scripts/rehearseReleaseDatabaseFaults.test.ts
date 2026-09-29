import { describe, expect, it } from 'vitest';
import { assertC3TestDatabaseUrl } from '../../src/scripts/rehearseReleaseDatabaseFaults.js';

describe('rehearseReleaseDatabaseFaults test database guard', () => {
  it('rejects missing and non-local database URLs before Prisma can be imported', () => {
    expect(() => assertC3TestDatabaseUrl(undefined)).toThrow(/C3_TEST_DATABASE_URL is required/);
    expect(() => assertC3TestDatabaseUrl('mysql://root:pw@localhost:3307/ilsangkit')).toThrow(/localhost:3307 \*_test/);
    expect(() => assertC3TestDatabaseUrl('mysql://root:pw@example.com:3307/ilsangkit_c3_test')).toThrow(/localhost:3307 \*_test/);
    expect(() => assertC3TestDatabaseUrl('mysql://root:pw@localhost:3306/ilsangkit_c3_test')).toThrow(/localhost:3307 \*_test/);
  });

  it('accepts only localhost:3307 MySQL URLs with *_test database names for CLI runtime use', () => {
    const url = 'mysql://root:pw@127.0.0.1:3307/ilsangkit_c3_runtime_test?connection_limit=1&pool_timeout=1';
    expect(assertC3TestDatabaseUrl(url)).toBe(url);
  });
});
