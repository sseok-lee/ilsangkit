import { describe, expect, it } from 'vitest';
import {
  classifyLegacyUrlObservation,
  type LegacyUrlObservation,
} from '../../src/lib/realEstateUrlBaseline.js';

const baseObservation = (
  overrides: Partial<LegacyUrlObservation> = {}
): LegacyUrlObservation => ({
  kind: 'observation',
  at: '2026-09-30T09:07:45.147Z',
  endpointPath: '/api/real-estate/building-info?type=apt-sale&path=/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
  type: 'apt-sale',
  bjdCode: '51130',
  buildingName: '덕원',
  basePath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
  stableLatest: true,
  mappings: [
    {
      id: 252,
      type: 'apt-sale',
      buildingKey: '174e2e6991fc32e07b4a8ac6682d302a8e212f84c9937c2edeff653da2834d28',
      bjdCode: '51130',
      buildingName: '덕원',
      basePath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
      canonicalPath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
      dongName: '문막읍 건등리',
      jibun: '193-2',
      evidence: { source: 'legacy-deferred', reasons: ['ambiguous-legacy-owner'] },
    },
    {
      id: 253,
      type: 'apt-sale',
      buildingKey: '8942f6caa38f3ab2eb826c5c0510e3750ac1576b13d2325eab3a7c135bb26158',
      bjdCode: '51130',
      buildingName: '덕원',
      basePath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
      canonicalPath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
      dongName: '우산동',
      jibun: '157',
      evidence: { source: 'legacy-deferred', reasons: ['ambiguous-legacy-owner'] },
    },
  ],
  info: {
    bjdCode: '51130',
    buildingName: '덕원',
    city: '강원',
    district: '원주시',
    dongName: '우산동',
    roadName: null,
    jibun: '157',
    regionMatched: true,
  },
  latest: {
    id: 1540378,
    dongName: '우산동',
    jibun: '157',
    roadName: null,
  },
  parcels: [
    {
      dongName: '문막읍 건등리',
      jibun: '193-2',
      roadName: null,
      transactions: '31',
    },
    {
      dongName: '우산동',
      jibun: '157',
      roadName: null,
      transactions: '40',
    },
  ],
  ...overrides,
});

describe('classifyLegacyUrlObservation', () => {
  it('confirms the exact displayed parcel even when it is not the first mapping candidate', () => {
    const result = classifyLegacyUrlObservation(baseObservation());

    expect(result).toEqual({
      status: 'confirmed',
      entry: {
        type: 'apt-sale',
        basePath: '/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
        dongName: '우산동',
        jibun: '157',
        provenance:
          'production-function-getBuildingInfo observation=2026-09-30T09:07:45.147Z endpoint=/api/real-estate/building-info?type=apt-sale&path=/real-estate/apt-sale/gangwon/wonju/%EB%8D%95%EC%9B%90',
      },
    });
  });

  it('normalizes whitespace and unicode before matching the displayed parcel', () => {
    const result = classifyLegacyUrlObservation(
      baseObservation({
        info: {
          bjdCode: '51130',
          buildingName: '덕원',
          dongName: ' 우산동 ',
          jibun: ' 157 ',
          regionMatched: true,
        },
      })
    );

    expect(result).toMatchObject({
      status: 'confirmed',
      entry: { dongName: '우산동', jibun: '157' },
    });
  });

  it.each([
    ['explicit observation error', { error: 'HTTP 500' }, 'observation-error'],
    ['missing capture time', { at: '' }, 'missing-capture-time'],
    ['missing info', { info: null, stableLatest: false }, 'missing-info'],
    ['missing stable latest flag', { stableLatest: undefined }, 'unstable-latest'],
    ['unstable latest', { stableLatest: false }, 'unstable-latest'],
    [
      'region mismatch',
      { info: { bjdCode: '51130', buildingName: '덕원', dongName: '우산동', jibun: '157', regionMatched: false } },
      'region-mismatch',
    ],
  ])('rejects %s', (_name, overrides, reason) => {
    expect(classifyLegacyUrlObservation(baseObservation(overrides))).toMatchObject({
      status: 'unresolved',
      reason,
    });
  });

  it('dedupes repeated source parcel rows by dong and jibun before keyset comparison', () => {
    const result = classifyLegacyUrlObservation(
      baseObservation({
        parcels: [
          { dongName: '문막읍 건등리', jibun: '193-2', roadName: null, transactions: '20' },
          { dongName: '문막읍 건등리', jibun: '193-2', roadName: null, transactions: '11' },
          { dongName: '우산동', jibun: '157', roadName: null, transactions: '40' },
        ],
      })
    );

    expect(result).toMatchObject({
      status: 'confirmed',
      entry: { dongName: '우산동', jibun: '157' },
    });
  });

  it('confirms an owner when the same source parcel has null and multiple road-name variants', () => {
    const result = classifyLegacyUrlObservation(
      baseObservation({
        info: {
          bjdCode: '51130',
          buildingName: '덕원',
          dongName: '우산동',
          jibun: '157',
          roadName: '우산로 2',
          regionMatched: true,
        },
        latest: {
          id: 1540378,
          dongName: '우산동',
          jibun: '157',
          roadName: '우산로 2',
        },
        parcels: [
          { dongName: '문막읍 건등리', jibun: '193-2', roadName: '문막로 1', transactions: '31' },
          { dongName: '우산동', jibun: '157', roadName: null, transactions: '10' },
          { dongName: '우산동', jibun: '157', roadName: '우산로 1', transactions: '10' },
          { dongName: '우산동', jibun: '157', roadName: '우산로 2', transactions: '20' },
        ],
      })
    );

    expect(result).toMatchObject({
      status: 'confirmed',
      entry: { dongName: '우산동', jibun: '157' },
    });
  });

  it('rejects when a mapping candidate has a different identity from the observed group', () => {
    const observation = baseObservation();
    observation.mappings[1] = { ...observation.mappings[1], bjdCode: '99999' };

    expect(classifyLegacyUrlObservation(observation)).toMatchObject({
      status: 'unresolved',
      reason: 'identity-mismatch',
    });
  });

  it('rejects when mappings are not all deferred on the same base path', () => {
    const observation = baseObservation();
    observation.mappings[1] = {
      ...observation.mappings[1],
      evidence: { source: 'legacy-exact-address' },
    };

    expect(classifyLegacyUrlObservation(observation)).toMatchObject({
      status: 'unresolved',
      reason: 'mapping-not-deferred',
    });
  });

  it('rejects when mapping candidates and source parcels drift apart', () => {
    const observation = baseObservation({
      parcels: [
        { dongName: '우산동', jibun: '157', roadName: null, transactions: '40' },
        { dongName: '태장동', jibun: '1', roadName: null, transactions: '1' },
      ],
    });

    expect(classifyLegacyUrlObservation(observation)).toMatchObject({
      status: 'unresolved',
      reason: 'source-mapping-drift',
    });
  });

  it('rejects blank addresses and duplicate readable suffixes among mapping candidates', () => {
    expect(
      classifyLegacyUrlObservation(
        baseObservation({
          mappings: [
            { ...baseObservation().mappings[0], jibun: ' ' },
            baseObservation().mappings[1],
          ],
        })
      )
    ).toMatchObject({ status: 'unresolved', reason: 'missing-readable-address' });

    expect(
      classifyLegacyUrlObservation(
        baseObservation({
          mappings: [
            baseObservation().mappings[0],
            { ...baseObservation().mappings[1], dongName: '문막읍 건등리', jibun: '193-2' },
          ],
        })
      )
    ).toMatchObject({ status: 'unresolved', reason: 'readable-suffix-clash' });
  });

  it('rejects synthetic display addresses mixed from different source parcels', () => {
    const result = classifyLegacyUrlObservation(
      baseObservation({
        info: {
          bjdCode: '51130',
          buildingName: '덕원',
          dongName: '문막읍 건등리',
          jibun: '157',
          regionMatched: true,
        },
      })
    );

    expect(result).toMatchObject({
      status: 'unresolved',
      reason: 'display-address-conflict',
    });
  });

  it('rejects when displayed dong and jibun do not match the stable latest parcel', () => {
    const result = classifyLegacyUrlObservation(
      baseObservation({
        info: {
          bjdCode: '51130',
          buildingName: '덕원',
          dongName: '문막읍 건등리',
          jibun: '193-2',
          regionMatched: true,
        },
        latest: {
          id: 1540378,
          dongName: '우산동',
          jibun: '157',
          roadName: null,
        },
      })
    );

    expect(result).toMatchObject({
      status: 'unresolved',
      reason: 'display-address-conflict',
    });
  });

  it('rejects road-name conflicts because the frontend may prefer roadName display', () => {
    expect(
      classifyLegacyUrlObservation(
        baseObservation({
          info: {
            bjdCode: '51130',
            buildingName: '덕원',
            dongName: '우산동',
            jibun: '157',
            roadName: '문막로 1',
            regionMatched: true,
          },
          parcels: [
            { dongName: '문막읍 건등리', jibun: '193-2', roadName: '문막로 1', transactions: '31' },
            { dongName: '우산동', jibun: '157', roadName: '우산로 1', transactions: '40' },
          ],
        })
      )
    ).toMatchObject({ status: 'unresolved', reason: 'road-address-conflict' });

    expect(
      classifyLegacyUrlObservation(
        baseObservation({
          info: {
            bjdCode: '51130',
            buildingName: '덕원',
            dongName: '우산동',
            jibun: '157',
            roadName: '공유로 1',
            regionMatched: true,
          },
          parcels: [
            { dongName: '문막읍 건등리', jibun: '193-2', roadName: '공유로 1', transactions: '31' },
            { dongName: '우산동', jibun: '157', roadName: '공유로 1', transactions: '40' },
            { dongName: '우산동', jibun: '157', roadName: '공유로 1', transactions: '4' },
          ],
        })
      )
    ).toMatchObject({ status: 'unresolved', reason: 'road-address-ambiguous' });
  });
});
