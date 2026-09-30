import { describe, expect, it, vi } from 'vitest';
import {
  assertLocalCiDatabaseUrl,
  CI_REAL_ESTATE_TYPES,
  ciRealEstateSourceFixtures,
  seedCiRealEstateSources,
} from '../../src/scripts/seedCiSummaryReadiness.js';

describe('seedCiSummaryReadiness', () => {
  it('allows only the local CI MySQL test database', () => {
    expect(
      assertLocalCiDatabaseUrl('mysql://root:testpassword@localhost:3306/ilsangkit_test')
    ).toBe('ilsangkit_test');
    expect(
      assertLocalCiDatabaseUrl(
        'mysql://root:testpassword@127.0.0.1:3306/ilsangkit_test?connection_limit=5'
      )
    ).toBe('ilsangkit_test');

    expect(() =>
      assertLocalCiDatabaseUrl('mysql://root:testpassword@localhost:3306/ilsangkit')
    ).toThrow(/Refusing/);
    expect(() =>
      assertLocalCiDatabaseUrl('mysql://root:testpassword@db.example.com:3306/ilsangkit_test')
    ).toThrow(/Refusing/);
    expect(() =>
      assertLocalCiDatabaseUrl('postgres://root:testpassword@localhost:5432/ilsangkit_test')
    ).toThrow(/Refusing/);
  });

  it('defines one raw source fixture for every summary type before prepare runs', () => {
    const fixtures = ciRealEstateSourceFixtures();

    expect(fixtures.map((fixture) => fixture.type).sort()).toEqual(
      [...CI_REAL_ESTATE_TYPES].sort()
    );
    expect(new Set(fixtures.map((fixture) => fixture.sourceId)).size).toBe(fixtures.length);
    expect(
      fixtures.every(
        (fixture) =>
          fixture.buildingName && fixture.jibun && fixture.sourceId.startsWith('ci-summary-')
      )
    ).toBe(true);
  });

  it('upserts one raw source row into each real estate source table', async () => {
    const tableNames = ciRealEstateSourceFixtures().map((fixture) => fixture.table);
    const prisma = Object.fromEntries(
      tableNames.map((tableName) => [tableName, { upsert: vi.fn().mockResolvedValue({}) }])
    );

    await seedCiRealEstateSources(prisma);

    for (const fixture of ciRealEstateSourceFixtures()) {
      const upsert = prisma[fixture.table].upsert;
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sourceId: fixture.sourceId },
          create: expect.objectContaining({
            bjdCode: '1168010100',
            buildingName: fixture.buildingName,
            jibun: fixture.jibun,
            sourceId: fixture.sourceId,
          }),
        })
      );
    }
  });
});
