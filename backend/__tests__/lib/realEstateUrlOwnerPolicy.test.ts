import { describe, expect, it } from 'vitest';
import {
  resolveLegacyUrlOwnerPolicy,
  type LegacyUrlLatestEvidence,
} from '../../src/lib/realEstateUrlOwnerPolicy.js';
import type { LegacyUrlObservation } from '../../src/lib/realEstateUrlBaseline.js';

const basePath = '/real-estate/apt-sale/gyeongnam/changwon-seongsan/%EC%84%B1%EC%9B%90';

function observation(overrides: Partial<LegacyUrlObservation> = {}): LegacyUrlObservation {
  return {
    kind: 'observation',
    at: '2026-09-30T09:07:45.147Z',
    endpointPath:
      '/api/real-estate/building-info?type=apt-sale&path=/real-estate/apt-sale/gyeongnam/changwon-seongsan/%EC%84%B1%EC%9B%90',
    type: 'apt-sale',
    bjdCode: '48123',
    buildingName: '성원',
    basePath,
    stableLatest: true,
    mappings: [
      mapping('상남동', '45-1'),
      mapping('신촌동', '23-2'),
      mapping('신촌동', '23-4'),
    ],
    info: {
      bjdCode: '48123',
      buildingName: '성원',
      dongName: '신촌동',
      jibun: '45-1',
      regionMatched: true,
    },
    latest: {
      id: 701,
      dongName: '상남동',
      jibun: '45-1',
      roadName: null,
    },
    parcels: [
      { dongName: '상남동', jibun: '45-1', roadName: null, transactions: '12' },
      { dongName: '신촌동', jibun: '23-2', roadName: null, transactions: '20' },
      { dongName: '신촌동', jibun: '23-4', roadName: null, transactions: '10' },
    ],
    ...overrides,
  };
}

function mapping(dongName: string, jibun: string) {
  return {
    type: 'apt-sale',
    buildingKey: `${dongName}-${jibun}`,
    bjdCode: '48123',
    buildingName: '성원',
    basePath,
    canonicalPath: basePath,
    dongName,
    jibun,
    evidence: { source: 'legacy-deferred', reasons: ['ambiguous-legacy-owner'] },
  };
}

const latestEvidence: LegacyUrlLatestEvidence[] = [
  { dongName: '상남동', jibun: '45-1', transactions: 12, latestDate: 20260920 },
  { dongName: '신촌동', jibun: '23-2', transactions: 20, latestDate: 20260801 },
  { dongName: '신촌동', jibun: '23-4', transactions: 10, latestDate: 20260901 },
];

describe('resolveLegacyUrlOwnerPolicy', () => {
  it('keeps an exact classifier owner before policy selection can run', () => {
    const result = resolveLegacyUrlOwnerPolicy(
      observation({
        info: {
          bjdCode: '48123',
          buildingName: '성원',
          dongName: '상남동',
          jibun: '45-1',
          regionMatched: true,
        },
      }),
      []
    );

    expect(result).toMatchObject({
      status: 'confirmed',
      entry: {
        dongName: '상남동',
        jibun: '45-1',
        provenance:
          'production-function-getBuildingInfo observation=2026-09-30T09:07:45.147Z endpoint=/api/real-estate/building-info?type=apt-sale&path=/real-estate/apt-sale/gyeongnam/changwon-seongsan/%EC%84%B1%EC%9B%90',
      },
    });
  });

  it('selects the highest transaction address inside the displayed representative dong without date evidence', () => {
    const result = resolveLegacyUrlOwnerPolicy(observation(), [], {
      policyEvidenceObservedAt: '2026-09-30T11:00:00.000Z',
    });

    expect(result).toEqual({
      status: 'confirmed',
      entry: {
        type: 'apt-sale',
        basePath,
        dongName: '신촌동',
        jibun: '23-2',
        provenance:
          'approved-fixed-owner-policy-v1 observation=2026-09-30T09:07:45.147Z policyEvidence=not-required reason=max-transactions-within-displayed-dong displayedDong=신촌동 transactions=20',
      },
    });
  });

  it('uses latest transaction date only to break a transaction-count tie', () => {
    const result = resolveLegacyUrlOwnerPolicy(
      observation({
        parcels: [
          { dongName: '상남동', jibun: '45-1', roadName: null, transactions: '12' },
          { dongName: '신촌동', jibun: '23-2', roadName: null, transactions: '20' },
          { dongName: '신촌동', jibun: '23-4', roadName: null, transactions: '20' },
        ],
      }),
      [
        { dongName: '상남동', jibun: '45-1', transactions: 12, latestDate: 20260920 },
        { dongName: '신촌동', jibun: '23-2', transactions: 20, latestDate: 20260801 },
        { dongName: '신촌동', jibun: '23-4', transactions: 20, latestDate: 20260901 },
      ],
      { policyEvidenceObservedAt: '2026-09-30T11:00:00.000Z' }
    );

    expect(result).toMatchObject({
      status: 'confirmed',
      entry: {
        dongName: '신촌동',
        jibun: '23-4',
        provenance:
          'approved-fixed-owner-policy-v1 observation=2026-09-30T09:07:45.147Z policyEvidence=2026-09-30T11:00:00.000Z reason=latest-transaction-date-tiebreak-within-displayed-dong displayedDong=신촌동 transactions=20 latestDate=20260901',
      },
    });
  });

  it('keeps the group unresolved when transaction counts are tied and date evidence is missing', () => {
    const result = resolveLegacyUrlOwnerPolicy(
      observation({
        parcels: [
          { dongName: '상남동', jibun: '45-1', roadName: null, transactions: '12' },
          { dongName: '신촌동', jibun: '23-2', roadName: null, transactions: '20' },
          { dongName: '신촌동', jibun: '23-4', roadName: null, transactions: '20' },
        ],
      })
    );

    expect(result).toEqual({
      status: 'unresolved',
      reason: 'display-address-conflict',
      detail: 'policy latest-date evidence is missing for transaction-count tie',
    });
  });

  it('keeps the group unresolved when latest-date evidence is still tied', () => {
    const result = resolveLegacyUrlOwnerPolicy(
      observation({
        parcels: [
          { dongName: '상남동', jibun: '45-1', roadName: null, transactions: '12' },
          { dongName: '신촌동', jibun: '23-2', roadName: null, transactions: '20' },
          { dongName: '신촌동', jibun: '23-4', roadName: null, transactions: '20' },
        ],
      }),
      [
        { dongName: '상남동', jibun: '45-1', transactions: 12, latestDate: 20260920 },
        { dongName: '신촌동', jibun: '23-2', transactions: 20, latestDate: 20260901 },
        { dongName: '신촌동', jibun: '23-4', transactions: 20, latestDate: 20260901 },
      ]
    );

    expect(result).toEqual({
      status: 'unresolved',
      reason: 'display-address-conflict',
      detail: 'policy latest-date tie in displayed dong',
    });
  });

  it('does not apply the fixed-owner policy to non-display-conflict observations', () => {
    const result = resolveLegacyUrlOwnerPolicy(
      observation({
        stableLatest: false,
      }),
      latestEvidence
    );

    expect(result).toEqual({
      status: 'unresolved',
      reason: 'unstable-latest',
    });
  });

  it('requires policy evidence to exactly match the captured address keyset and counts', () => {
    expect(
      resolveLegacyUrlOwnerPolicy(observation(), [
        { dongName: '상남동', jibun: '45-1', transactions: 12, latestDate: 20260920 },
        { dongName: '신촌동', jibun: '23-2', transactions: 21, latestDate: 20260801 },
        { dongName: '신촌동', jibun: '23-4', transactions: 10, latestDate: 20260901 },
      ])
    ).toEqual({
      status: 'unresolved',
      reason: 'display-address-conflict',
      detail: 'policy evidence does not match captured parcel counts',
    });

    expect(
      resolveLegacyUrlOwnerPolicy(observation(), [
        { dongName: '상남동', jibun: '45-1', transactions: 12, latestDate: 20260920 },
        { dongName: '신촌동', jibun: '23-2', transactions: 20, latestDate: 20260801 },
      ])
    ).toEqual({
      status: 'unresolved',
      reason: 'display-address-conflict',
      detail: 'policy evidence does not match captured parcel keys',
    });
  });
});
