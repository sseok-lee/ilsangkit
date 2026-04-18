import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDatabaseUrl } from '../../src/lib/prisma.js';

describe('validateDatabaseUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('production: should throw error when DATABASE_URL is not set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => validateDatabaseUrl(undefined)).toThrow(
      'DATABASE_URL is not set'
    );
  });

  it('production: should throw error when pool parameters are missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const url = 'mysql://user:password@localhost:3306/dbname';
    expect(() => validateDatabaseUrl(url)).toThrow(
      'DATABASE_URL missing required pool parameters'
    );
  });

  it('production: should not throw when pool parameters are present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const url =
      'mysql://user:password@localhost:3306/dbname?connection_limit=10&pool_timeout=30';
    expect(() => validateDatabaseUrl(url)).not.toThrow();
  });

  it('development: should not throw when pool parameters are missing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const url = 'mysql://user:password@localhost:3306/dbname';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateDatabaseUrl(url)).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('development: should warn when DATABASE_URL is not set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateDatabaseUrl(undefined);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL is not set')
    );
    warnSpy.mockRestore();
  });
});
