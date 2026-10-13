import { describe, expect, it } from 'vitest';
import {
  buildWasteGenerationPlan,
  collapseContentDuplicates,
  hashWasteJson,
  type PreviousWasteRevision,
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
  it('keeps unresolved source revisions without changing verified public area content', () => {
    const input = {
      baseGenerationId: null,
      references: refs,
      rows: [row()],
      provenance: 'legacy' as const,
      sourceComplete: true,
      previousRevisions: [],
      observedAt: new Date('2026-09-28T00:00:00.000Z'),
    };
    const verifiedOnly = buildWasteGenerationPlan(input);
    const mixed = buildWasteGenerationPlan({
      ...input,
      rows: [...input.rows, ...Array.from({ length: 100 }, (_, index) => row({
        scheduleId: index + 2,
        sourceId: `unresolved-${index}`,
        targetRegion: '적용 범위 미확인',
        // 내용이 모두 같으면 중복으로 접히므로, 행마다 내용이 달라지도록 emissionPlace 를 구분한다.
        emissionPlace: `미확인 배출장소 ${index}`,
        details: { livingWaste: { dayOfWeek: '화' } },
      }))],
    });

    expect(mixed.areaEntries).toEqual(verifiedOnly.areaEntries);
    expect(mixed.revisions).toHaveLength(101);
    expect(mixed.report.unresolvedCoverageCount).toBe(100);
    expect(mixed.revisions.slice(1).every((revision) => (
      revision.state === 'active' && revision.coverageCandidates[0].state === 'unresolved'
    ))).toBe(true);
  });

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

describe('collapseContentDuplicates / 내용 중복 접기', () => {
  const base = { livingWaste: { dayOfWeek: '월' } };
  const dup = (scheduleId: number, sourceId: string, dataCreatedDate: string, lastModified: string) => row({
    scheduleId,
    sourceId,
    details: { ...base, dataCreatedDate, lastModified },
  });
  const plan = (rows: WasteGenerationSourceRow[], previousRevisions: PreviousWasteRevision[] = []) => buildWasteGenerationPlan({
    baseGenerationId: previousRevisions.length ? 'base' : null,
    references: refs,
    rows,
    provenance: 'raw',
    sourceComplete: true,
    previousRevisions,
    observedAt: new Date('2026-10-13T00:00:00.000Z'),
  });
  const byId = (p: ReturnType<typeof plan>) => new Map(p.revisions.map((r) => [r.scheduleId, r]));

  it('같은 연도판 3건 중복은 대표 1건만 active, 나머지는 대표를 가리키는 duplicate', () => {
    const p = plan([
      dup(1, '2025-A', '2025-01-01', '2025-02-01 00:00:00'),
      dup(2, '2025-B', '2025-01-01', '2025-02-01 00:00:00'),
      dup(3, '2025-C', '2025-01-01', '2025-02-01 00:00:00'),
    ]);
    const m = byId(p);
    expect(m.get(3)).toMatchObject({ state: 'active', duplicateOfScheduleId: null });
    expect(m.get(1)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 3 });
    expect(m.get(2)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 3 });
    expect(p.report.activeCount).toBe(1);
    expect(p.report.duplicateCount).toBe(2);
    expect(p.canPublish).toBe(true);
  });

  it('연도판만 다른 중복은 dataCreatedDate 가 최신인 행이 대표', () => {
    const m = byId(plan([
      dup(1, '2026-X', '2026-01-01', '2026-01-02 00:00:00'),
      dup(2, '2024-Z', '2024-01-01', '2026-09-01 00:00:00'),
    ]));
    expect(m.get(1)?.state).toBe('active');
    expect(m.get(2)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 1 });
  });

  it('dataCreatedDate 가 같으면 lastModified 최신, 그것도 같으면 sourceId 내림차순', () => {
    const byModified = byId(plan([
      dup(1, 'B', '2025-01-01', '2025-03-01 00:00:00'),
      dup(2, 'A', '2025-01-01', '2025-04-01 00:00:00'),
    ]));
    expect(byModified.get(2)?.state).toBe('active');
    const bySource = byId(plan([
      dup(1, 'A', '2025-01-01', '2025-03-01 00:00:00'),
      dup(2, 'B', '2025-01-01', '2025-03-01 00:00:00'),
    ]));
    expect(bySource.get(2)?.state).toBe('active');
  });

  it('dataCreatedDate 가 없는 행은 대표 우선순위가 가장 낮다', () => {
    const m = byId(plan([
      row({ scheduleId: 1, sourceId: 'Z', details: { ...base } }),
      dup(2, 'A', '2020-01-01', '2020-01-01 00:00:00'),
    ]));
    expect(m.get(2)?.state).toBe('active');
    expect(m.get(1)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 2 });
  });

  it('입력 순서를 바꿔도 대표가 같다', () => {
    const rows = [
      dup(1, '2025-A', '2025-01-01', '2025-02-01 00:00:00'),
      dup(2, '2025-B', '2025-01-01', '2025-02-01 00:00:00'),
      dup(3, '2025-C', '2025-01-01', '2025-02-01 00:00:00'),
    ];
    const forward = plan(rows).revisions.find((r) => r.state === 'active')?.scheduleId;
    const reversed = plan([...rows].reverse()).revisions.find((r) => r.state === 'active')?.scheduleId;
    expect(forward).toBe(3);
    expect(reversed).toBe(3);
  });

  it('한 필드라도 다르면 접지 않는다', () => {
    const p = plan([
      dup(1, 'A', '2025-01-01', '2025-02-01 00:00:00'),
      row({ scheduleId: 2, sourceId: 'B', emissionPlace: '다른 곳', details: { ...base, dataCreatedDate: '2025-01-01', lastModified: '2025-02-01 00:00:00' } }),
    ]);
    expect(p.revisions.every((r) => r.state === 'active' && r.duplicateOfScheduleId === null)).toBe(true);
    expect(p.report.duplicateCount).toBe(0);
  });

  it('이전 대표가 이번 수집에서 빠지면 남은 행이 active 로 승격되고, 빠진 대표는 carried 규칙을 탄다', () => {
    const prevRep = { ...dup(3, '2025-C', '2025-01-01', '2025-02-01 00:00:00'), contentHash: 'a'.repeat(64), provenance: 'raw' as const, sourceModifiedAt: null, observedAt: new Date('2026-10-12T00:00:00.000Z'), contentUpdatedAt: new Date('2026-10-12T00:00:00.000Z'), state: 'active' as const, missingCompleteRuns: 0, terminationEvidence: null, duplicateOfScheduleId: null };
    const prevDup = { ...dup(1, '2025-A', '2025-01-01', '2025-02-01 00:00:00'), contentHash: 'b'.repeat(64), provenance: 'raw' as const, sourceModifiedAt: null, observedAt: new Date('2026-10-12T00:00:00.000Z'), contentUpdatedAt: new Date('2026-10-12T00:00:00.000Z'), state: 'duplicate' as const, missingCompleteRuns: 0, terminationEvidence: null, duplicateOfScheduleId: 3 };
    const m = byId(plan([dup(1, '2025-A', '2025-01-01', '2025-02-01 00:00:00')], [prevRep, prevDup]));
    expect(m.get(1)).toMatchObject({ state: 'active', duplicateOfScheduleId: null });
    expect(m.get(3)).toMatchObject({ state: 'active', missingCompleteRuns: 1 });
  });

  it('이전 duplicate 행이 빠지면 1회째 duplicate 유지, 2회째 inactive', () => {
    const prev = (runs: number) => ({ ...dup(1, '2025-A', '2025-01-01', '2025-02-01 00:00:00'), contentHash: 'b'.repeat(64), provenance: 'raw' as const, sourceModifiedAt: null, observedAt: new Date('2026-10-12T00:00:00.000Z'), contentUpdatedAt: new Date('2026-10-12T00:00:00.000Z'), state: 'duplicate' as const, missingCompleteRuns: runs, terminationEvidence: null, duplicateOfScheduleId: 3 });
    const other = row({ scheduleId: 9, sourceId: 'other', emissionPlace: '다른 곳' });
    const first = byId(plan([other], [prev(0)]));
    expect(first.get(1)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 3, missingCompleteRuns: 1 });
    const second = byId(plan([other], [prev(1)]));
    expect(second.get(1)).toMatchObject({ state: 'inactive', missingCompleteRuns: 2 });
  });

  it('revisionHash 입력에 duplicateOfScheduleId 가 포함된다', () => {
    // 대표를 바꾸려면 내용 필드를 바꿔야 해 contentHash 도 같이 변하므로, 해시 입력을 직접 재구성해 대조한다.
    const p = plan([dup(1, 'A', '2025-01-01', '2025-02-01 00:00:00'), dup(2, 'B', '2025-01-01', '2025-02-01 00:00:00')]);
    const expected = hashWasteJson(p.revisions.map((r) => ({
      scheduleId: r.scheduleId,
      sourceId: r.sourceId,
      state: r.state,
      contentHash: r.contentHash,
      missingCompleteRuns: r.missingCompleteRuns,
      sourceModifiedAt: r.sourceModifiedAt,
      duplicateOfScheduleId: r.duplicateOfScheduleId ?? null,
    })));
    expect(p.report.revisionHash).toBe(expected);
  });

  it('collapseContentDuplicates 는 순수 함수로도 쓸 수 있다', () => {
    const input = [
      { ...dup(1, 'A', '2025-01-01', '2025-02-01 00:00:00'), state: 'active' as const, duplicateOfScheduleId: null },
      { ...dup(2, 'B', '2025-01-01', '2025-02-01 00:00:00'), state: 'active' as const, duplicateOfScheduleId: null },
    ];
    const out = collapseContentDuplicates(input);
    expect(out.map((r) => [r.scheduleId, r.state, r.duplicateOfScheduleId])).toEqual([
      [1, 'duplicate', 2],
      [2, 'active', null],
    ]);
    expect(input[0].state).toBe('active');
  });
});
