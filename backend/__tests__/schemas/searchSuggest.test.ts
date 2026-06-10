import { describe, it, expect } from 'vitest';
import { SuggestQuerySchema } from '../../src/schemas/search.js';

describe('SuggestQuerySchema', () => {
  it('q 문자열 통과', () => {
    expect(SuggestQuerySchema.parse({ q: '강남' }).q).toBe('강남');
  });
  it('q 누락 시 빈 문자열 기본값', () => {
    expect(SuggestQuerySchema.parse({}).q).toBe('');
  });
  it('q 50자 초과 거부', () => {
    expect(() => SuggestQuerySchema.parse({ q: 'a'.repeat(51) })).toThrow();
  });
});
