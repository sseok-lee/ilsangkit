import { describe, it, expect } from 'vitest';
import { ensureDatasetDescription } from '~/utils/dataSource';

const src = {
  datasetName: '국토교통부 실거래가 공개시스템',
  provider: '국토교통부',
  url: 'https://www.data.go.kr/data/15057511/openapi.do',
};

describe('ensureDatasetDescription', () => {
  it('50자 미만이면 데이터셋 컨텍스트를 덧붙여 50자 이상 보장하고 원문을 앞에 둔다', () => {
    const base = '산장 실거래가·시세 (국토교통부 공개 데이터 기반)'; // 28자
    const out = ensureDatasetDescription(base, src);
    expect(out.length).toBeGreaterThanOrEqual(50);
    expect(out.startsWith(base)).toBe(true);
  });

  it('이미 50자 이상이면 그대로 반환(불변)', () => {
    const base = '가'.repeat(60);
    expect(ensureDatasetDescription(base, src)).toBe(base);
  });

  it('빈 문자열도 크래시 없이 50자 이상 보장', () => {
    const out = ensureDatasetDescription('', src);
    expect(out.length).toBeGreaterThanOrEqual(50);
  });

  it('5000자를 초과하지 않는다', () => {
    const out = ensureDatasetDescription('가'.repeat(6000), src);
    expect(out.length).toBeLessThanOrEqual(5000);
  });
});
