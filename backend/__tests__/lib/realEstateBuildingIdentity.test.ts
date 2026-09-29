import { describe, expect, it } from 'vitest';
import { buildingKeySql, makeBuildingKey } from '../../src/lib/realEstateBuildingIdentity.js';

const base = { propertyType: 'villa', bjdCode: '11680', buildingName: '스톤빌리지', dongName: '대치동', jibun: '934-2' };

describe('building address identity', () => {
  it('separates same-name buildings by dong and parcel', () => {
    expect(makeBuildingKey(base)).not.toBe(makeBuildingKey({ ...base, dongName: '역삼동', jibun: '785-10' }));
    expect(makeBuildingKey(base)).not.toBe(makeBuildingKey({ ...base, jibun: '934-3' }));
    expect(makeBuildingKey(base)).not.toBe(makeBuildingKey({ ...base, dongName: '역삼동' }));
  });
  it('is stable across whitespace and missing parcel representations', () => {
    expect(makeBuildingKey(base)).toBe(makeBuildingKey({ ...base, dongName: ' 대치동 ', jibun: '934-2 ' }));
    expect(makeBuildingKey({ ...base, jibun: null })).toBe(makeBuildingKey({ ...base, jibun: '' }));
    expect(makeBuildingKey({ ...base, jibun: null })).not.toBe(makeBuildingKey(base));
    expect(makeBuildingKey(base)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('keeps property categories and regions separate', () => {
    expect(makeBuildingKey(base)).not.toBe(makeBuildingKey({ ...base, propertyType: 'apt' }));
    expect(makeBuildingKey(base)).not.toBe(makeBuildingKey({ ...base, bjdCode: '11110' }));
  });
  it('rejects SQL identifier injection and binds the category', () => {
    expect(() => buildingKeySql('apt', 't; DROP TABLE t')).toThrow();
    expect(buildingKeySql('apt', 't').values).toEqual(['apt']);
  });
});
