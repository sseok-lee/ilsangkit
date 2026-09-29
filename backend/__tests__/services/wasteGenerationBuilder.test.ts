import { describe, expect, it } from 'vitest';
import {
  buildWasteGenerationPlan,
  hashWasteJson,
  type WasteGenerationSourceRow,
} from '../../src/services/wasteGenerationBuilder.js';
import type { ReferenceBundle } from '../../src/types/wasteArea.js';
import { buildWasteSourceScope } from '../../src/utils/wasteSourceScope.js';

const evidence = {
  url: 'https://example.test/ref',
  version: 'fixture',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  note: 'fixture',
};

const refs: ReferenceBundle = {
  version: 'fixture-v1',
  areas: [
    {
      key: 'administrative:1168064000',
      kind: 'administrative',
      level: 'dong',
      code: '1168064000',
      city: '서울특별시',
      district: '강남구',
      districtCode: '11680',
      name: '역삼1동',
      evidence,
    },
  ],
  relations: [],
  sourceAreaKinds: {},
};

function row(overrides: Partial<WasteGenerationSourceRow> = {}): WasteGenerationSourceRow {
  return {
    scheduleId: 1,
    city: '서울특별시',
    district: '강남구',
    sourceId: 'source-1',
    targetRegion: '역삼1동',
    emissionPlace: '집 앞',
    details: { livingWaste: { dayOfWeek: '월' } },
    sourceUrl: 'https://example.test/source',
    govCode: '3220000',
    rawPayload: null,
    ...overrides,
  };
}

refs.sourceAreaKinds[buildWasteSourceScope(row())] = { kind: 'administrative', evidence };

function metadataFingerprintFor(reference = refs.areas[0], relationKeys: string[] = []): string {
  return hashWasteJson({
    reference: {
      key: reference.key,
      kind: reference.kind,
      level: reference.level,
      code: reference.code,
      city: reference.city,
      district: reference.district,
      districtCode: reference.districtCode,
      name: reference.name,
      effectiveFrom: reference.evidence.effectiveFrom,
      effectiveTo: reference.evidence.effectiveTo,
    },
    relationKeys: [...relationKeys].sort(),
  });
}

describe('buildWasteGenerationPlan', () => {
  it('fails complete publication input with duplicate source identity', () => {
    expect(() => buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [
        row(),
        row({ scheduleId: 2 }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
    })).toThrow(/duplicate waste source identity/i);
  });

  it('carries missing previous revisions forward with a one-run missing streak', () => {
    const previous = {
      ...row(),
      scheduleId: 10,
      sourceId: 'missing-source',
      contentHash: 'a'.repeat(64),
      rawPayload: null,
      provenance: 'raw' as const,
      sourceModifiedAt: null,
      observedAt: new Date('2026-09-27T00:00:00.000Z'),
      contentUpdatedAt: new Date('2026-09-27T00:00:00.000Z'),
      state: 'active' as const,
      missingCompleteRuns: 0,
      terminationEvidence: null,
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: 'base-generation',
      references: refs,
      rows: [row({ scheduleId: 11, sourceId: 'new-source' })],
      provenance: 'raw',
      sourceComplete: true,
      previousRevisions: [previous],
    });

    expect(plan.revisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scheduleId: 10,
        sourceId: 'missing-source',
        state: 'active',
        missingCompleteRuns: 1,
      }),
    ]));
    expect(plan.canPublish).toBe(true);
  });

  it('does not increment a missing streak for incomplete source input', () => {
    const previous = {
      ...row(),
      scheduleId: 10,
      sourceId: 'missing-source',
      contentHash: 'a'.repeat(64),
      rawPayload: null,
      provenance: 'raw' as const,
      sourceModifiedAt: null,
      observedAt: new Date('2026-09-27T00:00:00.000Z'),
      contentUpdatedAt: new Date('2026-09-27T00:00:00.000Z'),
      state: 'active' as const,
      missingCompleteRuns: 1,
      terminationEvidence: null,
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: 'base-generation',
      references: refs,
      rows: [],
      provenance: 'raw',
      sourceComplete: false,
      previousRevisions: [previous],
    });

    expect(plan.revisions[0]).toMatchObject({
      scheduleId: 10,
      state: 'active',
      missingCompleteRuns: 1,
    });
    expect(plan.canPublish).toBe(false);
  });

  it('rejects references missing official level before generation planning', () => {
    const badRefs = {
      ...refs,
      areas: [{ ...refs.areas[0], level: undefined }],
    } as ReferenceBundle;

    expect(() => buildWasteGenerationPlan({
      baseGenerationId: null,
      references: badRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
    })).toThrow(/official level/i);
  });

  it('chooses one deterministic active area entry per key and applies the W9 indexing policy', () => {
    const boundaryRefs: ReferenceBundle = {
      ...refs,
      areas: [
        {
          ...refs.areas[0],
          evidence: { ...evidence, effectiveFrom: '2020-01-01', effectiveTo: '2023-12-31' },
          name: '역삼1동-과거',
        },
        {
          ...refs.areas[0],
          evidence: { ...evidence, effectiveFrom: '2024-01-01', effectiveTo: null },
          name: '역삼1동-현재',
        },
      ],
    };
    const activeRow = row({ targetRegion: '역삼1동-현재' });
    boundaryRefs.sourceAreaKinds[buildWasteSourceScope(activeRow)] = { kind: 'administrative', evidence };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: boundaryRefs,
      rows: [activeRow],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(plan.areaEntries).toHaveLength(1);
    expect(plan.areaEntries[0]).toMatchObject({
      reference: expect.objectContaining({ name: '역삼1동-현재' }),
      indexEligible: true,
      indexReason: 'verified-distinct-content',
    });
  });


  it('keeps references active on the exact date-only effectiveTo boundary', () => {
    const boundaryRefs: ReferenceBundle = {
      ...refs,
      areas: [{
        ...refs.areas[0],
        evidence: { ...evidence, effectiveFrom: '2026-09-28', effectiveTo: '2026-09-28' },
      }],
      sourceAreaKinds: {
        [buildWasteSourceScope(row())]: {
          kind: 'administrative',
          evidence: { ...evidence, effectiveFrom: '2026-09-28', effectiveTo: '2026-09-28' },
        },
      },
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: boundaryRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T12:34:56.000Z'),
    });

    expect(plan.areaEntries).toEqual([
      expect.objectContaining({
        reference: expect.objectContaining({ key: 'administrative:1168064000' }),
      }),
    ]);
    expect(plan.revisions[0].coverageCandidates).toEqual([
      expect.objectContaining({ areaKey: 'administrative:1168064000', state: 'verified' }),
    ]);
  });

  it('keeps the public area fingerprint stable across area names, source ids, and collection-only dates', () => {
    const sharedRefs: ReferenceBundle = {
      ...refs,
      areas: [
        refs.areas[0],
        {
          ...refs.areas[0],
          key: 'administrative:1168065000',
          code: '1168065000',
          name: '역삼2동',
        },
      ],
    };
    sharedRefs.sourceAreaKinds[buildWasteSourceScope(row({ scheduleId: 2, sourceId: 'source-2', targetRegion: '역삼2동' }))] = {
      kind: 'administrative',
      evidence,
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: sharedRefs,
      rows: [
        row({ scheduleId: 1, sourceId: 'source-1', targetRegion: '역삼1동', details: { livingWaste: { dayOfWeek: '월' }, collectedAt: '2026-09-01T00:00:00.000Z' } }),
        row({ scheduleId: 2, sourceId: 'source-2', targetRegion: '역삼2동', details: { livingWaste: { dayOfWeek: '월' }, collectedAt: '2026-09-28T00:00:00.000Z' } }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(plan.areaEntries.map((entry) => entry.contentFingerprint)).toEqual([
      plan.areaEntries[0].contentFingerprint,
      plan.areaEntries[0].contentFingerprint,
    ]);
    expect(plan.areaEntries.every((entry) => entry.indexEligible)).toBe(false);
    expect(plan.areaEntries.map((entry) => entry.indexReason)).toEqual([
      'shared-schedule-duplicate',
      'shared-schedule-duplicate',
    ]);
  });



  it('keeps verified rows without practical public schedule content out of the index', () => {
    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [row({ emissionPlace: null, details: { livingWaste: { dayOfWeek: '', time: '', method: '', content: '' }, dataCreatedDate: '2026-09-28' } })],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(plan.areaEntries[0]).toMatchObject({
      indexEligible: false,
      indexReason: 'no-practical-content',
    });
  });

  it('does not treat emission place or names alone as practical schedule content', () => {
    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [row({ emissionPlace: '집 앞', details: { title: '역삼1동 생활폐기물', dataCreatedDate: '2026-09-28' } })],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(plan.areaEntries[0]).toMatchObject({
      indexEligible: false,
      indexReason: 'no-practical-content',
    });
  });

  it('keeps public fingerprints stable when schedule ids and source identities are swapped', () => {
    const first = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [
        row({ scheduleId: 1, sourceId: 'source-a', details: { livingWaste: { dayOfWeek: '월' } } }),
        row({ scheduleId: 2, sourceId: 'source-b', emissionPlace: '공동현관', details: { recycle: { dayOfWeek: '화' } } }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });
    const second = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [
        row({ scheduleId: 2, sourceId: 'source-b', details: { livingWaste: { dayOfWeek: '월' } } }),
        row({ scheduleId: 1, sourceId: 'source-a', emissionPlace: '공동현관', details: { recycle: { dayOfWeek: '화' } } }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(second.areaEntries[0].contentFingerprint).toBe(first.areaEntries[0].contentFingerprint);
  });

  it('does not let non-public legal references make an admin dong look like a shared-schedule duplicate', () => {
    const legalRow = row({ scheduleId: 2, sourceId: 'legal-source', targetRegion: '역삼동', details: { livingWaste: { dayOfWeek: '월' } } });
    const mixedRefs: ReferenceBundle = {
      ...refs,
      areas: [
        refs.areas[0],
        {
          ...refs.areas[0],
          key: 'legal:1168010100',
          kind: 'legal',
          level: 'dong',
          code: '1168010100',
          name: '역삼동',
        },
      ],
      sourceAreaKinds: {
        ...refs.sourceAreaKinds,
        [buildWasteSourceScope(legalRow)]: { kind: 'legal', evidence },
      },
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: mixedRefs,
      rows: [row(), legalRow],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    const adminEntry = plan.areaEntries.find((entry) => entry.reference.kind === 'administrative')!;
    const legalEntry = plan.areaEntries.find((entry) => entry.reference.kind === 'legal')!;
    expect(adminEntry).toMatchObject({ indexEligible: true, indexReason: 'verified-distinct-content' });
    expect(legalEntry).toMatchObject({ indexEligible: false, indexReason: 'invalid-area' });
  });

  it('keeps unchanged schedule content on the previous lastmod but bumps when area metadata changed', () => {
    const previousRevision = {
      ...row(),
      contentHash: 'placeholder',
      rawPayload: null,
      provenance: 'legacy' as const,
      sourceModifiedAt: null,
      observedAt: new Date('2026-09-20T00:00:00.000Z'),
      contentUpdatedAt: new Date('2026-09-20T00:00:00.000Z'),
      state: 'active' as const,
      missingCompleteRuns: 0,
      terminationEvidence: null,
    };
    const baseline = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    const unchanged = buildWasteGenerationPlan({
      baseGenerationId: 'previous',
      references: refs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [{ ...previousRevision, contentHash: baseline.revisions[0].contentHash }],
      previousAreaSnapshots: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });
    const metadataChanged = buildWasteGenerationPlan({
      baseGenerationId: 'previous',
      references: refs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [{ ...previousRevision, contentHash: baseline.revisions[0].contentHash }],
      previousAreaSnapshots: [{
        areaKey: refs.areas[0].key,
        metadataFingerprint: 'previous-reference-name-or-relation',
        contentUpdatedAt: new Date('2026-09-20T00:00:00.000Z'),
      }],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(unchanged.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(metadataChanged.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('does not update area lastmod when only genuine collection timestamps change', () => {
    const previousObservedAt = new Date('2026-09-20T00:00:00.000Z');
    const nextObservedAt = new Date('2026-09-28T00:00:00.000Z');
    const previousRow = row({ details: { livingWaste: { dayOfWeek: '월' }, collectedAt: '2026-09-20T01:00:00.000Z', observedAt: '2026-09-20T01:00:00.000Z' } });
    const previousPlan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [previousRow],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: previousObservedAt,
    });

    const nextPlan = buildWasteGenerationPlan({
      baseGenerationId: 'previous',
      references: refs,
      rows: [row({ details: { livingWaste: { dayOfWeek: '월' }, collectedAt: '2026-09-28T01:00:00.000Z', observedAt: '2026-09-28T01:00:00.000Z' } })],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: previousPlan.revisions,
      previousAreaSnapshots: [],
      observedAt: nextObservedAt,
    });

    expect(nextPlan.revisions[0].contentUpdatedAt.toISOString()).toBe(previousObservedAt.toISOString());
    expect(nextPlan.areaEntries[0].contentUpdatedAt.toISOString()).toBe(previousObservedAt.toISOString());
  });

  it('updates area lastmod when actual source date fields change', () => {
    const previousPlan = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [row({ details: { livingWaste: { dayOfWeek: '월' }, dataCreatedDate: '2026-09-20', lastModified: '2026-09-20T00:00:00.000Z' } })],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-20T00:00:00.000Z'),
    });

    const nextPlan = buildWasteGenerationPlan({
      baseGenerationId: 'previous',
      references: refs,
      rows: [row({ details: { livingWaste: { dayOfWeek: '월' }, dataCreatedDate: '2026-09-28', lastModified: '2026-09-28T00:00:00.000Z' } })],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: previousPlan.revisions,
      previousAreaSnapshots: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(nextPlan.revisions[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(nextPlan.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('updates area lastmod when reference or relation metadata changes even if public schedule content is unchanged', () => {
    const relationRefs: ReferenceBundle = {
      ...refs,
      relations: [{
        fromKey: null,
        toKey: refs.areas[0].key,
        alias: '역삼1동',
        evidence,
      }],
    };

    const plan = buildWasteGenerationPlan({
      baseGenerationId: 'previous',
      references: relationRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [{
        ...row(),
        contentHash: buildWasteGenerationPlan({
          baseGenerationId: null,
          references: relationRefs,
          rows: [row()],
          provenance: 'legacy',
          sourceComplete: true,
          previousRevisions: [],
          observedAt: new Date('2026-09-20T00:00:00.000Z'),
        }).revisions[0].contentHash,
        rawPayload: null,
        provenance: 'legacy' as const,
        sourceModifiedAt: null,
        observedAt: new Date('2026-09-20T00:00:00.000Z'),
        contentUpdatedAt: new Date('2026-09-20T00:00:00.000Z'),
        state: 'active' as const,
        missingCompleteRuns: 0,
        terminationEvidence: null,
      }],
      previousAreaSnapshots: [{
        areaKey: refs.areas[0].key,
        metadataFingerprint: 'previous-reference-or-relation-state',
        contentUpdatedAt: new Date('2026-09-20T00:00:00.000Z'),
      }],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(plan.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('preserves a rename lastmod on the next unchanged generation', () => {
    const first = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: refs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    const renamedRefs: ReferenceBundle = {
      ...refs,
      areas: [{ ...refs.areas[0], name: '역삼일동' }],
    };
    const renamed = buildWasteGenerationPlan({
      baseGenerationId: 'first',
      references: renamedRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: first.revisions,
      previousAreaSnapshots: [{
        areaKey: refs.areas[0].key,
        metadataFingerprint: metadataFingerprintFor(refs.areas[0]),
        contentFingerprint: first.areaEntries[0].contentFingerprint,
        contentUpdatedAt: first.areaEntries[0].contentUpdatedAt,
      }],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });
    const unchangedAfterRename = buildWasteGenerationPlan({
      baseGenerationId: 'renamed',
      references: renamedRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: renamed.revisions,
      previousAreaSnapshots: [{
        areaKey: renamedRefs.areas[0].key,
        metadataFingerprint: metadataFingerprintFor(renamedRefs.areas[0]),
        contentFingerprint: renamed.areaEntries[0].contentFingerprint,
        contentUpdatedAt: renamed.areaEntries[0].contentUpdatedAt,
      }],
      observedAt: new Date('2026-10-02T00:00:00.000Z'),
    });

    expect(renamed.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(unchangedAfterRename.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('bumps public area lastmod when source coverage is removed', () => {
    const twoSourceRefs: ReferenceBundle = {
      ...refs,
      sourceAreaKinds: {
        ...refs.sourceAreaKinds,
        [buildWasteSourceScope(row({ scheduleId: 2, sourceId: 'source-2', details: { foodWaste: { dayOfWeek: '화' } } }))]: {
          kind: 'administrative',
          evidence,
        },
      },
    };
    const first = buildWasteGenerationPlan({
      baseGenerationId: null,
      references: twoSourceRefs,
      rows: [
        row({ scheduleId: 1, sourceId: 'source-1', details: { livingWaste: { dayOfWeek: '월' } } }),
        row({ scheduleId: 2, sourceId: 'source-2', details: { foodWaste: { dayOfWeek: '화' } } }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    const removed = buildWasteGenerationPlan({
      baseGenerationId: 'first',
      references: twoSourceRefs,
      rows: [
        row({ scheduleId: 1, sourceId: 'source-1', details: { livingWaste: { dayOfWeek: '월' } } }),
      ],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      previousAreaSnapshots: [{
        areaKey: refs.areas[0].key,
        metadataFingerprint: metadataFingerprintFor(refs.areas[0]),
        contentFingerprint: first.areaEntries[0].contentFingerprint,
        contentUpdatedAt: first.areaEntries[0].contentUpdatedAt,
      }],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    expect(removed.areaEntries[0].contentFingerprint).not.toBe(first.areaEntries[0].contentFingerprint);
    expect(removed.areaEntries[0].contentUpdatedAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('rejects overlapping active reference versions for the same key', () => {
    const overlappingRefs: ReferenceBundle = {
      ...refs,
      areas: [
        { ...refs.areas[0], evidence: { ...evidence, effectiveFrom: '2024-01-01', effectiveTo: null } },
        { ...refs.areas[0], evidence: { ...evidence, effectiveFrom: '2025-01-01', effectiveTo: null }, name: 'duplicate active' },
      ],
    };

    expect(() => buildWasteGenerationPlan({
      baseGenerationId: null,
      references: overlappingRefs,
      rows: [row()],
      provenance: 'legacy',
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    })).toThrow(/overlapping active reference/i);
  });

  it('binds collection and evidence hashes into reportHash', () => {
    const baseInput = {
      baseGenerationId: null,
      references: refs,
      rows: [row()],
      provenance: 'legacy' as const,
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    };

    const first = buildWasteGenerationPlan({
      ...baseInput,
      evidence: { collection: { pageCount: 1, totalCount: 1, pageFingerprints: ['a'.repeat(64)], parseFailureCount: 0, rawSourceRowCount: 1 } },
    });
    const second = buildWasteGenerationPlan({
      ...baseInput,
      evidence: { collection: { pageCount: 1, totalCount: 1, pageFingerprints: ['b'.repeat(64)], parseFailureCount: 0, rawSourceRowCount: 1 } },
    });

    expect(first.reportHash).not.toBe(second.reportHash);
    expect(first.report.evidence.collection?.pageFingerprints).toEqual(['a'.repeat(64)]);
  });


  it('keeps approval reportHash stable across different clocks for unchanged meaningful input', () => {
    const baseInput = {
      baseGenerationId: null,
      references: refs,
      rows: [row()],
      provenance: 'legacy' as const,
      sourceComplete: true,
      previousRevisions: [],
      evidence: { collection: { pageCount: 1, totalCount: 1, pageFingerprints: ['a'.repeat(64)], parseFailureCount: 0, rawSourceRowCount: 1 } },
    };

    const first = buildWasteGenerationPlan({
      ...baseInput,
      observedAt: new Date('2026-09-28T01:00:00.000Z'),
    });
    const second = buildWasteGenerationPlan({
      ...baseInput,
      observedAt: new Date('2026-09-28T23:00:00.000Z'),
    });

    expect(first.inputHash).toBe(second.inputHash);
    expect(first.reportHash).toBe(second.reportHash);
  });

});
