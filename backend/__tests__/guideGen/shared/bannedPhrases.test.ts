import { describe, it, expect } from 'vitest';
import { findBannedPhrases } from '../../../src/guideGen/shared/bannedPhrases.js';

describe('findBannedPhrases', () => {
  it('returns hits for AI-slop phrases', () => {
    const text = '많은 분들이 궁금해합니다. 꼼꼼히 확인해보세요.';
    const hits = findBannedPhrases(text);
    expect(hits).toContain('많은 분들이 궁금해합니다');
    expect(hits).toContain('꼼꼼히 확인해보세요');
  });

  it('returns hits for relative date phrases', () => {
    const text = '최근에 발표된 정책이며 현재는 시행 중입니다. 곧 시행됩니다.';
    const hits = findBannedPhrases(text);
    expect(hits).toEqual(expect.arrayContaining(['최근에', '현재는', '곧 시행됩니다']));
  });

  it('returns empty array when no banned phrases', () => {
    const text = '2026년 5월 12일에 발표된 정책입니다. 신청은 6월 1일부터 가능합니다.';
    expect(findBannedPhrases(text)).toEqual([]);
  });

  it('returns each banned phrase at most once', () => {
    const text = '최근에 발표. 최근에 또 발표.';
    const hits = findBannedPhrases(text);
    expect(hits.filter((h) => h === '최근에')).toHaveLength(1);
  });
});
