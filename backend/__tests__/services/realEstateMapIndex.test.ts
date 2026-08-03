import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { serializeRow } from '../../src/services/realEstateService.js';

describe('RealEstateBuildingSummary 좌표 인덱스', () => {
  it('schema.prisma 에 @@index([type, lat, lng]) 가 있다', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf-8');
    const model = schema.match(/model RealEstateBuildingSummary \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(model).toContain('@@index([type, lat, lng])');
  });
});

describe('serializeRow', () => {
  it('export 되어 있고 BigInt 를 Number 로 바꾼다', () => {
    expect(serializeRow({ a: 10n, b: 'x' })).toEqual({ a: 10, b: 'x' });
  });

  it('null 과 undefined 를 보존한다', () => {
    expect(serializeRow({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
  });
});
