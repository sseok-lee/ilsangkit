// backend/__tests__/services/onbidBase.test.ts
import { describe, it, expect } from 'vitest';
import { parseOnbidXml } from '../../src/services/onbidBase.js';

describe('parseOnbidXml', () => {
  it('정상 응답을 items 배열로 정규화', () => {
    const xml = `<?xml version="1.0"?><response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items><item><cltrMngNo>1</cltrMngNo></item><item><cltrMngNo>2</cltrMngNo></item></items><totalCount>2</totalCount></body></response>`;
    const r = parseOnbidXml(xml);
    expect(r.resultCode).toBe('00');
    expect(r.totalCount).toBe(2);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].cltrMngNo).toBe('1');
  });
  it('단일 item도 배열로', () => {
    const xml = `<response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items><item><cltrMngNo>1</cltrMngNo></item></items><totalCount>1</totalCount></body></response>`;
    expect(parseOnbidXml(xml).items).toHaveLength(1);
  });
  it('에러 응답(resultCode!=00) 감지', () => {
    const xml = `<result><resultCode>99</resultCode><resultMsg>UNKNOWN_ERROR</resultMsg></result>`;
    const r = parseOnbidXml(xml);
    expect(r.resultCode).toBe('99');
    expect(r.items).toHaveLength(0);
  });
});
