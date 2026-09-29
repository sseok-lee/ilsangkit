import { describe, expect, it } from 'vitest';
import referenceFixture from '../fixtures/waste-area-reference.json' with { type: 'json' };
import {
  resolveCoverage,
  resolveSearchCandidates,
} from '../../src/services/wasteAreaResolver.js';
import type { CoverageCandidate, ReferenceBundle, SourceRegionInput } from '../../src/types/wasteArea.js';

const refs = referenceFixture as ReferenceBundle;
const at = '2026-09-28';

function input(overrides: Partial<SourceRegionInput>): SourceRegionInput {
  return {
    scheduleId: 1,
    sourceScope: 'fixture:administrative',
    city: '서울특별시',
    district: '강남구',
    targetRegion: '역삼1동',
    ...overrides,
  };
}

function onlyCandidate(overrides: Partial<SourceRegionInput>): CoverageCandidate {
  const result = resolveCoverage(input(overrides), refs, at);
  expect(result).toHaveLength(1);
  return result[0];
}

describe('resolveCoverage', () => {
  it('does not infer administrative coverage from an untyped name', () => {
    const result = resolveCoverage({
      scheduleId: 1,
      sourceScope: 'unknown',
      city: '서울특별시',
      district: '강남구',
      targetRegion: '역삼동 일부(공동주택 제외)',
    }, refs, at);

    expect(result).toEqual([expect.objectContaining({
      state: 'unresolved',
      areaKey: null,
      conditionText: '역삼동 일부(공동주택 제외)',
    })]);
  });

  it('verifies exact administrative dong names only inside the requested city, district, and period', () => {
    expect(onlyCandidate({ targetRegion: ' 역삼1동 ' })).toMatchObject({
      scheduleId: 1,
      areaKey: 'administrative:1168064000',
      districtCode: '11680',
      scope: 'whole',
      conditionText: '',
      state: 'verified',
      reason: 'exact administrative dong match',
    });

    expect(onlyCandidate({ targetRegion: '논현1동' })).toMatchObject({
      areaKey: null,
      districtCode: null,
      state: 'unresolved',
      conditionText: '논현1동',
    });

    expect(onlyCandidate({ targetRegion: '폐지동' })).toMatchObject({
      areaKey: null,
      districtCode: null,
      state: 'unresolved',
      conditionText: '폐지동',
    });
  });

  it('preserves NFC input and never strips trailing numbers from dong names', () => {
    expect(onlyCandidate({ targetRegion: '역삼10동' })).toMatchObject({
      areaKey: 'administrative:1168065100',
      state: 'verified',
    });

    expect(onlyCandidate({ targetRegion: '역삼동' })).toMatchObject({
      areaKey: null,
      state: 'unresolved',
      conditionText: '역삼동',
    });
  });

  it('keeps conditional and exclusion text while splitting only top-level region delimiters', () => {
    const result = resolveCoverage(input({
      scheduleId: 2,
      targetRegion: '역삼1동+역삼2동(공동주택 제외), 거점수거 지역',
    }), refs, at);

    expect(result).toEqual([
      expect.objectContaining({
        scheduleId: 2,
        areaKey: 'administrative:1168064000',
        scope: 'whole',
        conditionText: '',
        state: 'verified',
      }),
      expect.objectContaining({
        scheduleId: 2,
        areaKey: 'administrative:1168065000',
        scope: 'conditional',
        conditionText: '역삼2동(공동주택 제외)',
        state: 'verified',
      }),
      expect.objectContaining({
        scheduleId: 2,
        areaKey: null,
        scope: 'conditional',
        conditionText: '거점수거 지역',
        state: 'unresolved',
      }),
    ]);
  });

  it('represents confirmed whole-district scopes without expanding to every dong', () => {
    expect(onlyCandidate({ targetRegion: '강남구 전역(공동주택 제외)' })).toMatchObject({
      areaKey: null,
      districtCode: '11680',
      scope: 'conditional',
      conditionText: '강남구 전역(공동주택 제외)',
      state: 'verified',
      reason: 'whole district scope',
    });
  });

  it('verifies whole-district scopes from official district identity without source-kind evidence', () => {
    expect(onlyCandidate({
      sourceScope: 'unknown',
      targetRegion: '강남구 전역(공동주택 제외)',
    })).toMatchObject({
      areaKey: null,
      districtCode: '11680',
      scope: 'conditional',
      conditionText: '강남구 전역(공동주택 제외)',
      state: 'verified',
      reason: 'whole district scope',
    });
  });

  it('does not verify bare district names as whole-district coverage', () => {
    expect(onlyCandidate({
      sourceScope: 'unknown',
      targetRegion: '강남구',
    })).toMatchObject({
      areaKey: null,
      districtCode: null,
      scope: 'whole',
      conditionText: '강남구',
      state: 'unresolved',
      reason: 'source area kind is not verified',
    });

    expect(onlyCandidate({
      sourceScope: 'fixture:administrative',
      targetRegion: '강남구',
    })).toMatchObject({
      areaKey: null,
      districtCode: null,
      scope: 'whole',
      conditionText: '강남구',
      state: 'unresolved',
      reason: 'no current exact administrative dong match',
    });
  });

  it('does not convert typed legal source names into administrative coverage', () => {
    expect(onlyCandidate({
      sourceScope: 'fixture:legal',
      targetRegion: '역삼동',
    })).toMatchObject({
      areaKey: null,
      districtCode: null,
      scope: 'whole',
      conditionText: '역삼동',
      state: 'unresolved',
    });
  });

  it('does not verify dong names with expired or future source-kind evidence', () => {
    expect(onlyCandidate({
      sourceScope: 'fixture:administrative-expired',
      targetRegion: '역삼1동',
    })).toMatchObject({
      areaKey: null,
      state: 'unresolved',
      reason: 'source area kind evidence is not active',
    });

    expect(onlyCandidate({
      sourceScope: 'fixture:administrative-future',
      targetRegion: '역삼1동',
    })).toMatchObject({
      areaKey: null,
      state: 'unresolved',
      reason: 'source area kind evidence is not active',
    });
  });


  it('treats date-only effectiveTo as inclusive for source-kind and area evidence on non-midnight request times', () => {
    const boundaryEvidence = {
      ...refs.areas.find((area) => area.key === 'administrative:1168064000')!.evidence,
      effectiveFrom: '2026-09-28',
      effectiveTo: '2026-09-28',
    };
    const boundaryRefs: ReferenceBundle = {
      ...refs,
      areas: [{ ...refs.areas.find((area) => area.key === 'administrative:1168064000')!, evidence: boundaryEvidence }],
      relations: [],
      sourceAreaKinds: {
        'fixture:administrative': { kind: 'administrative', evidence: boundaryEvidence },
      },
    };

    expect(resolveCoverage(input({ targetRegion: '역삼1동' }), boundaryRefs, '2026-09-28T15:30:00.000Z'))
      .toEqual([expect.objectContaining({ areaKey: 'administrative:1168064000', state: 'verified' })]);
    expect(resolveCoverage(input({ targetRegion: '역삼1동' }), boundaryRefs, '2026-09-29T00:00:00.000Z'))
      .toEqual([expect.objectContaining({ areaKey: null, state: 'unresolved', reason: 'source area kind evidence is not active' })]);
  });

  it('treats date-only effectiveFrom as active for source-kind and area evidence on that same day', () => {
    const boundaryEvidence = {
      ...refs.areas.find((area) => area.key === 'administrative:1168064000')!.evidence,
      effectiveFrom: '2026-09-28',
      effectiveTo: null,
    };
    const boundaryRefs: ReferenceBundle = {
      ...refs,
      areas: [{ ...refs.areas.find((area) => area.key === 'administrative:1168064000')!, evidence: boundaryEvidence }],
      relations: [],
      sourceAreaKinds: {
        'fixture:administrative': { kind: 'administrative', evidence: boundaryEvidence },
      },
    };

    expect(resolveCoverage(input({ targetRegion: '역삼1동' }), boundaryRefs, '2026-09-28T00:01:00.000Z'))
      .toEqual([expect.objectContaining({ areaKey: 'administrative:1168064000', state: 'verified' })]);
  });

  it('applies hash-bound source kind evidence only to the matching raw targetRegion', () => {
    expect(onlyCandidate({
      sourceScope: 'fixture:administrative-hashed',
      targetRegion: '역삼1동',
    })).toMatchObject({
      areaKey: 'administrative:1168064000',
      state: 'verified',
    });

    expect(onlyCandidate({
      sourceScope: 'fixture:administrative-hashed',
      targetRegion: '역삼2동',
    })).toMatchObject({
      areaKey: null,
      state: 'unresolved',
      reason: 'source kind evidence does not match targetRegion hash',
    });
  });

  it('uses the requested date when resolving the same reference bundle more than once', () => {
    const oldBoundary = resolveCoverage(input({ targetRegion: '경계동' }), refs, '2025-12-31');
    const newBoundary = resolveCoverage(input({ targetRegion: '경계동' }), refs, '2026-09-28');

    expect(oldBoundary).toEqual([
      expect.objectContaining({
        areaKey: 'administrative:1168068000',
        evidence: expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.test/administrative-old-boundary' }),
        ]),
      }),
    ]);
    expect(newBoundary).toEqual([
      expect.objectContaining({
        areaKey: 'administrative:1168068000',
        evidence: expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.test/administrative-new-boundary' }),
        ]),
      }),
    ]);
  });

  it('accepts valid special-city administrative dong rows with an empty district', () => {
    expect(onlyCandidate({
      city: '세종특별자치시',
      district: '',
      targetRegion: '해밀동',
    })).toMatchObject({
      areaKey: 'administrative:3611056000',
      districtCode: '36110',
      state: 'verified',
    });
  });

  it('reports conflicts instead of choosing between duplicate current exact matches', () => {
    const duplicateRefs: ReferenceBundle = {
      ...refs,
      areas: [
        ...refs.areas,
        {
          ...refs.areas.find((area) => area.key === 'administrative:1168064000')!,
          key: 'administrative:1168064999',
          code: '1168064999',
        },
      ],
    };

    const [candidate] = resolveCoverage(input({ targetRegion: '역삼1동' }), duplicateRefs, at);

    expect(candidate).toMatchObject({
      areaKey: null,
      districtCode: null,
      state: 'conflict',
      conditionText: '역삼1동',
    });
  });
});

describe('resolveSearchCandidates', () => {
  it('uses typed exact, alias, relation, partial, and region candidates with stable ranking', () => {
    const result = resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼동',
      page: 1,
      limit: 10,
    }, refs, at);

    expect(result).toEqual([
      { key: 'administrative:1168064000', reason: 'relation', rank: 1 },
      { key: 'administrative:1168065000', reason: 'relation', rank: 1 },
    ]);

    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼일동',
      page: 1,
      limit: 10,
    }, refs, at)).toEqual([
      { key: 'administrative:1168064000', reason: 'alias', rank: 1 },
    ]);

    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      page: 1,
      limit: 10,
    }, refs, at).map((candidate) => candidate.reason)).toEqual(['partial', 'partial', 'partial']);

    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      page: 1,
      limit: 2,
    }, refs, at)).toEqual([
      { key: 'administrative:1168066000', reason: 'region', rank: 3 },
      { key: 'administrative:1168068000', reason: 'region', rank: 3 },
    ]);
  });


  it('treats date-only relation effectiveTo as inclusive for search relation evidence', () => {
    const boundaryEvidence = {
      ...refs.areas.find((area) => area.key === 'administrative:1168064000')!.evidence,
      effectiveFrom: '2026-09-28',
      effectiveTo: '2026-09-28',
    };
    const boundaryRefs: ReferenceBundle = {
      ...refs,
      areas: refs.areas.map((area) => ({ ...area, evidence: area.key === 'legal:1168010100' || area.key === 'administrative:1168064000' ? boundaryEvidence : area.evidence })),
      relations: [{
        fromKey: 'legal:1168010100',
        toKey: 'administrative:1168064000',
        alias: null,
        evidence: boundaryEvidence,
      }],
      sourceAreaKinds: refs.sourceAreaKinds,
    };

    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼동',
      page: 1,
      limit: 10,
    }, boundaryRefs, '2026-09-28T23:59:59.000Z')).toEqual([
      { key: 'administrative:1168064000', reason: 'relation', rank: 1 },
    ]);
    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼동',
      page: 1,
      limit: 10,
    }, boundaryRefs, '2026-09-29T00:00:00.000Z')).toEqual([]);
  });

  it('excludes administrative parent rows and expired aliases from search candidates', () => {
    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '강남구',
      page: 1,
      limit: 10,
    }, refs, at)).toEqual([]);

    expect(resolveSearchCandidates({
      city: '서울특별시',
      district: '강남구',
      keyword: '개포본동',
      page: 1,
      limit: 10,
    }, refs, at)).toEqual([]);
  });
});
