import { describe, expect, it } from 'vitest';
import {
  planRealEstatePublicUrls,
  type RealEstateUrlPlanInput,
} from '../../src/lib/realEstateUrlPlan.js';

const generatedAt = new Date('2026-09-29T00:00:00.000Z');

const deferredBase = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
function deferredInput(): RealEstateUrlPlanInput {
  return {
    generatedAt,
    sourceFingerprint: 'f'.repeat(64),
    baselineProvenance: 'snapshot',
    existing: [],
    legacyBaseline: [],
    unresolvedPolicy: 'defer',
    current: ['a', 'b'].map((key, index) => ({
      type: 'villa-sale',
      buildingKey: key.repeat(64),
      bjdCode: '11680',
      city: '서울특별시',
      district: '강남구',
      buildingName: '같은빌라',
      dongName: '역삼동',
      jibun: String(index + 1),
    })),
  };
}

describe('explicit deferred legacy groups', () => {
  it('keeps explicitly deferred grouped identities on the old base path', () => {
    const result = planRealEstatePublicUrls(deferredInput());
    expect(result.blockers).toEqual([]);
    expect(result.deferred).toEqual([
      expect.objectContaining({ kind: 'missing-legacy-owner', basePath: deferredBase }),
    ]);
    expect(result.toCreate).toHaveLength(2);
    for (const row of result.toCreate) {
      expect(row.canonicalPath).toBe(deferredBase);
      expect(row.pathHash).toBe(result.toCreate[0].pathHash);
      expect(row.evidence).toMatchObject({
        source: 'legacy-deferred',
        reasons: ['missing-legacy-owner'],
      });
    }
  });

  it('retains strict blocking unless defer was explicitly requested', () => {
    const input = deferredInput();
    delete input.unresolvedPolicy;
    expect(planRealEstatePublicUrls(input).blockers).toHaveLength(1);
  });

  it('does not defer a group spanning multiple legal-region identities', () => {
    const input = deferredInput();
    input.current[1].bjdCode = '1168010200';
    const result = planRealEstatePublicUrls(input);
    expect(result.blockers).toHaveLength(1);
    expect(result.toCreate).toEqual([]);
  });

  it('holds the whole group when one suffix lacks an address, without assigning the base to a parcel', () => {
    const input = deferredInput();
    input.current[1].jibun = null;
    input.legacyBaseline = [
      {
        type: 'villa-sale',
        basePath: deferredBase,
        dongName: '역삼동',
        jibun: '1',
        provenance: 'snapshot',
      },
    ];
    const result = planRealEstatePublicUrls(input);
    expect(result.blockers).toEqual([]);
    expect(result.deferred[0].kind).toBe('missing-readable-address');
    expect(result.toCreate.every((row) => row.canonicalPath === deferredBase)).toBe(true);
    expect(result.toCreate).toHaveLength(2);
  });

  it('keeps an existing hold when refresh adds another address, even without the initial defer flag', () => {
    const input = deferredInput();
    const initial = planRealEstatePublicUrls(input);
    input.existing = initial.mappings;
    input.current.push({ ...input.current[0], buildingKey: 'c'.repeat(64), jibun: '3' });
    delete input.unresolvedPolicy;
    const refreshed = planRealEstatePublicUrls(input);
    expect(refreshed.blockers).toEqual([]);
    expect(refreshed.toCreate).toHaveLength(1);
    expect(refreshed.toCreate[0]).toMatchObject({
      canonicalPath: deferredBase,
      evidence: { source: 'legacy-deferred' },
    });
    expect(refreshed.mappings.every((row) => row.canonicalPath === deferredBase)).toBe(true);
  });

  it('never holds a published base owner or hides a readable-path collision', () => {
    const input = deferredInput();
    input.existing = [{ ...input.current[0], basePath: deferredBase, canonicalPath: deferredBase }];
    input.current[1].jibun = null;
    expect(planRealEstatePublicUrls(input).blockers[0].kind).toBe('missing-readable-address');
    const clash = deferredInput();
    clash.current.push({ ...clash.current[1], buildingKey: 'c'.repeat(64) });
    clash.legacyBaseline = [
      {
        type: 'villa-sale',
        basePath: deferredBase,
        dongName: '역삼동',
        jibun: '1',
        provenance: 'snapshot',
      },
    ];
    expect(planRealEstatePublicUrls(clash).blockers[0].kind).toBe('readable-suffix-clash');
  });
});

describe('resolving previously deferred addresses', () => {
  function resolutionInput(): RealEstateUrlPlanInput {
    const input = deferredInput();
    input.existing = planRealEstatePublicUrls(input).mappings;
    input.resolveDeferred = true;
    input.legacyBaseline = [
      {
        type: 'villa-sale',
        basePath: deferredBase,
        dongName: '역삼동',
        jibun: '1',
        provenance: 'captured-production-detail',
      },
    ];
    return input;
  }

  it('keeps the evidenced owner at the base and gives the other address a readable suffix', () => {
    const input = resolutionInput();
    const result = planRealEstatePublicUrls(input);
    expect(result.blockers).toEqual([]);
    expect(result.toCreate).toEqual([]);
    expect(result.toUpdate).toHaveLength(2);
    expect(result.mappings.map((row) => row.canonicalPath)).toEqual([
      deferredBase,
      `${deferredBase}/${encodeURIComponent('역삼동-2')}`,
    ]);
    expect(result.mappings.map((row) => row.evidence.source)).toEqual([
      'legacy-exact-address',
      'readable-address-suffix',
    ]);
    const again = planRealEstatePublicUrls({ ...input, existing: result.mappings });
    expect(again.toUpdate).toEqual([]);
    expect(again.toCreate).toEqual([]);
    expect(again.mappings.map((row) => row.canonicalPath)).toEqual(
      result.mappings.map((row) => row.canonicalPath)
    );
  });

  it('requires explicit resolution and leaves groups outside the baseline unchanged', () => {
    const input = resolutionInput();
    expect(planRealEstatePublicUrls({ ...input, resolveDeferred: false }).toUpdate).toEqual([]);
    const untouched = planRealEstatePublicUrls({ ...input, legacyBaseline: [] });
    expect(untouched.toUpdate).toEqual([]);
    expect(untouched.mappings.every((row) => row.canonicalPath === deferredBase)).toBe(true);
  });

  it.each([
    'ambiguous',
    'missing-suffix',
    'missing-candidate',
    'missing-group',
    'new-candidate',
    'settled-owner',
    'clashing-suffix',
  ])('fails the entire resolution group for %s without falling back to defer', (problem) => {
    const input = resolutionInput();
    if (problem === 'ambiguous')
      input.legacyBaseline.push({ ...input.legacyBaseline[0], jibun: '2' });
    if (problem === 'missing-suffix') input.current[1].jibun = null;
    if (problem === 'missing-candidate') input.current.pop();
    if (problem === 'missing-group') input.current = [];
    if (problem === 'new-candidate')
      input.current.push({ ...input.current[1], buildingKey: 'c'.repeat(64), jibun: '3' });
    if (problem === 'settled-owner')
      input.existing[1].evidence = { source: 'legacy-exact-address' };
    if (problem === 'clashing-suffix')
      input.existing.push({
        ...input.existing[1],
        buildingKey: 'outside',
        basePath: '/other',
        canonicalPath: `${deferredBase}/${encodeURIComponent('역삼동-2')}`,
        evidence: {},
      });
    const result = planRealEstatePublicUrls(input);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.toUpdate).toEqual([]);
    expect(result.toCreate).toEqual([]);
    expect(result.mappings).toEqual([]);
  });

  it('does not reassign an already settled owner even if a different baseline is provided', () => {
    const input = resolutionInput();
    const resolved = planRealEstatePublicUrls(input);
    const changed = planRealEstatePublicUrls({
      ...input,
      existing: resolved.mappings,
      legacyBaseline: [{ ...input.legacyBaseline[0], jibun: '2' }],
    });
    expect(changed.toUpdate).toEqual([]);
    expect(changed.mappings.map((row) => row.canonicalPath)).toEqual(
      resolved.mappings.map((row) => row.canonicalPath)
    );
  });

  it('records an approved policy separately from historical evidence and never reassigns it', () => {
    const input = resolutionInput();
    input.legacyBaseline[0].provenance =
      'approved-fixed-owner-policy-v1 reason=latest-tied-transaction observation=2026-09-30';
    const resolved = planRealEstatePublicUrls(input);
    expect(resolved.blockers).toEqual([]);
    expect(resolved.mappings[0].evidence).toMatchObject({
      source: 'approved-fixed-owner-policy',
      baselineProvenance: [input.legacyBaseline[0].provenance],
    });
    const refreshed = planRealEstatePublicUrls({
      ...input,
      existing: resolved.mappings,
      legacyBaseline: [{ ...input.legacyBaseline[0], jibun: '2' }],
    });
    expect(refreshed.toUpdate).toEqual([]);
    expect(refreshed.toCreate).toEqual([]);
    expect(refreshed.mappings.map((row) => row.canonicalPath)).toEqual(
      resolved.mappings.map((row) => row.canonicalPath)
    );
  });
});

describe('planRealEstatePublicUrls', () => {
  it('keeps an existing mapping immutable even when the readable path would change', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'f'.repeat(64),
      baselineProvenance: 'production-sitemap-2026-09-29',
      existing: [
        {
          type: 'villa-sale',
          buildingKey: 'k-existing',
          bjdCode: '1168010100',
          buildingName: '스톤빌리지',
          canonicalPath: '/real-estate/villa-sale/seoul/gangnam/old-path',
        },
      ],
      current: [
        {
          type: 'villa-sale',
          buildingKey: 'k-existing',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '스톤빌리지',
          dongName: '역삼동',
          jibun: '10-1',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.blockers).toEqual([]);
    expect(result.toCreate).toEqual([]);
    expect(result.mappings).toEqual([
      expect.objectContaining({
        buildingKey: 'k-existing',
        canonicalPath: '/real-estate/villa-sale/seoul/gangnam/old-path',
        evidence: expect.objectContaining({ source: 'existing-registry' }),
      }),
    ]);
  });

  it('assigns the legacy base path only to the one exact historical dong+jibun match', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'e'.repeat(64),
      baselineProvenance: 'production-detail-snapshot-2026-09-29',
      existing: [],
      current: [
        {
          type: 'villa-sale',
          buildingKey: 'key-a',
          bjdCode: '2817710100',
          city: '인천광역시',
          district: '미추홀구',
          buildingName: 'BSVIEW',
          dongName: '도화동',
          jibun: '369-1',
        },
        {
          type: 'villa-sale',
          buildingKey: 'key-b',
          bjdCode: '2817710200',
          city: '인천광역시',
          district: '미추홀구',
          buildingName: 'BSVIEW',
          dongName: '용현동',
          jibun: '491-49',
        },
      ],
      legacyBaseline: [
        {
          type: 'villa-sale',
          basePath: '/real-estate/villa-sale/incheon/michuhol/BSVIEW',
          dongName: '도화동',
          jibun: '369-1',
          provenance: 'old-production-render',
        },
      ],
    });

    expect(result.blockers).toEqual([]);
    expect(result.toCreate).toEqual([
      expect.objectContaining({
        buildingKey: 'key-a',
        canonicalPath: '/real-estate/villa-sale/incheon/michuhol/BSVIEW',
        evidence: expect.objectContaining({ source: 'legacy-exact-address' }),
      }),
      expect.objectContaining({
        buildingKey: 'key-b',
        canonicalPath: `/real-estate/villa-sale/incheon/michuhol/BSVIEW/${encodeURIComponent('용현동-491-49')}`,
        evidence: expect.objectContaining({ source: 'readable-address-suffix' }),
      }),
    ]);
  });

  it('blocks a colliding base path when the historical displayed address is absent', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'd'.repeat(64),
      baselineProvenance: null,
      existing: [],
      current: [
        {
          type: 'apt-rent',
          buildingKey: 'a',
          bjdCode: '2823710100',
          city: '인천광역시',
          district: '부평구',
          buildingName: '더샵부평센트럴시티',
          dongName: '십정동',
          jibun: '630',
        },
        {
          type: 'apt-rent',
          buildingKey: 'b',
          bjdCode: '2823710200',
          city: '인천광역시',
          district: '부평구',
          buildingName: '더샵부평센트럴시티',
          dongName: '부평동',
          jibun: '10',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.toCreate).toEqual([]);
    expect(result.blockers).toEqual([
      expect.objectContaining({
        kind: 'missing-legacy-owner',
        basePath: `/real-estate/apt-rent/incheon/bupyeong/${encodeURIComponent('더샵부평센트럴시티')}`,
        buildingKeys: ['apt-rent\x1fa', 'apt-rent\x1fb'],
      }),
    ]);
  });

  it('blocks readable suffix clashes instead of falling back to a hash URL', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'c'.repeat(64),
      baselineProvenance: 'manual-review-fixture',
      existing: [],
      current: [
        {
          type: 'villa-rent',
          buildingKey: 'owner',
          bjdCode: '1111010100',
          city: '서울특별시',
          district: '종로구',
          buildingName: '같은빌라',
          dongName: '청운동',
          jibun: '1',
        },
        {
          type: 'villa-rent',
          buildingKey: 'dup-a',
          bjdCode: '1111010200',
          city: '서울특별시',
          district: '종로구',
          buildingName: '같은빌라',
          dongName: '청운동',
          jibun: '2',
        },
        {
          type: 'villa-rent',
          buildingKey: 'dup-b',
          bjdCode: '1111010300',
          city: '서울특별시',
          district: '종로구',
          buildingName: '같은빌라',
          dongName: '청운동',
          jibun: '2',
        },
      ],
      legacyBaseline: [
        {
          type: 'villa-rent',
          basePath: `/real-estate/villa-rent/seoul/jongno/${encodeURIComponent('같은빌라')}`,
          dongName: '청운동',
          jibun: '1',
          provenance: 'old-production-render',
        },
      ],
    });

    expect(result.blockers).toEqual([
      expect.objectContaining({
        kind: 'readable-suffix-clash',
        buildingKeys: ['villa-rent\x1fdup-a', 'villa-rent\x1fdup-b'],
      }),
    ]);
    expect(result.toCreate.some((mapping) => mapping.buildingKey === 'dup-a')).toBe(false);
    expect(result.toCreate.some((mapping) => mapping.buildingKey === 'dup-b')).toBe(false);
  });

  it('blocks baseline entries that no current candidate can own', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'b'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'apt-sale',
          buildingKey: 'current',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '현재아파트',
          dongName: '역삼동',
          jibun: '1',
        },
      ],
      legacyBaseline: [
        {
          type: 'apt-sale',
          basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('사라진아파트')}`,
          dongName: '역삼동',
          jibun: '99',
          provenance: 'old-production-render',
        },
      ],
    });

    expect(result.blockers).toEqual([
      expect.objectContaining({
        kind: 'unresolved-baseline-entry',
        basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('사라진아파트')}`,
      }),
    ]);
  });

  it('keeps an old base owner even when it is absent from the current summary and suffixes a new competitor', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: 'a'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [
        {
          type: 'villa-sale',
          buildingKey: 'old-owner',
          bjdCode: '1168010100',
          buildingName: '같은빌라',
          canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`,
          basePath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`,
        },
      ],
      current: [
        {
          type: 'villa-sale',
          buildingKey: 'new-competitor',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은빌라',
          dongName: '삼성동',
          jibun: '2',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.blockers).toEqual([]);
    expect(result.toCreate).toEqual([
      expect.objectContaining({
        buildingKey: 'new-competitor',
        canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}/${encodeURIComponent('삼성동-2')}`,
      }),
    ]);
  });

  it('uses type+buildingKey when filtering blocked candidates', () => {
    const sharedKey = 'shared-key';
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '9'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'apt-sale',
          buildingKey: sharedKey,
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '공유키아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-rent',
          buildingKey: sharedKey,
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '공유키아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-rent',
          buildingKey: 'rent-competitor',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '공유키아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.blockers).toEqual([
      expect.objectContaining({
        kind: 'missing-legacy-owner',
        buildingKeys: ['apt-rent\x1frent-competitor', `apt-rent\x1f${sharedKey}`],
      }),
    ]);
    expect(result.toCreate).toEqual([
      expect.objectContaining({ type: 'apt-sale', buildingKey: sharedKey }),
    ]);
  });

  it('preserves long encoded building paths beyond varchar-sized storage', () => {
    const longName = `긴이름${'가'.repeat(420)}`;
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '8'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'apt-sale',
          buildingKey: 'long-name',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: longName,
          dongName: '역삼동',
          jibun: '1',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.toCreate[0].canonicalPath.length).toBeGreaterThan(1000);
    expect(decodeURIComponent(result.toCreate[0].canonicalPath.split('/').at(-1) ?? '')).toBe(
      longName
    );
  });

  it('labels a singleton current base path without historical baseline as current-only evidence', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '4'.repeat(64),
      baselineProvenance: null,
      existing: [],
      current: [
        {
          type: 'apt-sale',
          buildingKey: 'single-current',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '새아파트',
          dongName: '역삼동',
          jibun: '1',
        },
      ],
      legacyBaseline: [],
    });

    expect(result.blockers).toEqual([]);
    expect(result.toCreate).toEqual([
      expect.objectContaining({
        buildingKey: 'single-current',
        canonicalPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('새아파트')}`,
        evidence: expect.objectContaining({ source: 'single-current-address' }),
      }),
    ]);
  });

  it('does not treat missing legacy dong+jibun as an exact owner match', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '7'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'villa-sale',
          buildingKey: 'missing-address',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '주소없는빌라',
          dongName: null,
          jibun: null,
        },
        {
          type: 'villa-sale',
          buildingKey: 'complete-address',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '주소없는빌라',
          dongName: '삼성동',
          jibun: '2',
        },
      ],
      legacyBaseline: [
        {
          type: 'villa-sale',
          basePath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('주소없는빌라')}`,
          dongName: null,
          jibun: null,
          provenance: 'old-production-render',
        },
      ],
    });

    expect(result.blockers).toEqual([expect.objectContaining({ kind: 'ambiguous-legacy-owner' })]);
    expect(result.toCreate).toEqual([]);
  });

  it('blocks a single current candidate when baseline says another address owned the old base URL', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '6'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'villa-sale',
          buildingKey: 'current',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '남은빌라',
          dongName: '삼성동',
          jibun: '2',
        },
      ],
      legacyBaseline: [
        {
          type: 'villa-sale',
          basePath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('남은빌라')}`,
          dongName: '역삼동',
          jibun: '1',
          provenance: 'old-production-render',
        },
      ],
    });

    expect(result.blockers).toEqual([expect.objectContaining({ kind: 'missing-legacy-owner' })]);
    expect(result.toCreate).toEqual([]);
  });

  it('blocks inconsistent baseline observations even when one candidate matches one observation', () => {
    const result = planRealEstatePublicUrls({
      generatedAt,
      sourceFingerprint: '5'.repeat(64),
      baselineProvenance: 'production-detail-snapshot',
      existing: [],
      current: [
        {
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '충돌아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '충돌아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ],
      legacyBaseline: [
        {
          type: 'apt-sale',
          basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('충돌아파트')}`,
          dongName: '역삼동',
          jibun: '1',
          provenance: 'old-production-render-a',
        },
        {
          type: 'apt-sale',
          basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('충돌아파트')}`,
          dongName: '삼성동',
          jibun: '2',
          provenance: 'old-production-render-b',
        },
      ],
    });

    expect(result.blockers).toEqual([expect.objectContaining({ kind: 'ambiguous-legacy-owner' })]);
    expect(result.toCreate).toEqual([]);
  });
});
