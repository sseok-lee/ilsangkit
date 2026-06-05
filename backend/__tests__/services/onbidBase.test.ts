// backend/__tests__/services/onbidBase.test.ts
import { describe, it, expect } from 'vitest';
import { parseOnbid } from '../../src/services/onbidBase.js';

describe('parseOnbid (JSON)', () => {
  it('정상 응답을 items 배열로 정규화', () => {
    const json = JSON.stringify({
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: { item: [{ cltrMngNo: '2019-02917-001' }, { cltrMngNo: '2019-02917-002' }] },
        totalCount: 2,
        numOfRows: 10,
        pageNo: 1,
      },
    });
    const r = parseOnbid(json);
    expect(r.resultCode).toBe('00');
    expect(r.totalCount).toBe(2);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].cltrMngNo).toBe('2019-02917-001');
  });

  it('단일 item 객체도 배열로 정규화', () => {
    const json = JSON.stringify({
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: { item: { cltrMngNo: '2019-02917-004' } },
        totalCount: 1,
      },
    });
    const r = parseOnbid(json);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].cltrMngNo).toBe('2019-02917-004');
  });

  it('items:""(빈 결과) → 빈 배열로 정규화', () => {
    const json = JSON.stringify({
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: { items: '', totalCount: 0 },
    });
    const r = parseOnbid(json);
    expect(r.items).toHaveLength(0);
    expect(r.totalCount).toBe(0);
  });

  it('에러 응답(resultCode!=00) 감지', () => {
    const json = JSON.stringify({
      header: { resultCode: '99', resultMsg: 'UNKNOWN_ERROR' },
      body: {},
    });
    const r = parseOnbid(json);
    expect(r.resultCode).toBe('99');
    expect(r.resultMsg).toBe('UNKNOWN_ERROR');
    expect(r.items).toHaveLength(0);
  });

  it('JSON 파싱 실패 시 PARSE_ERROR 반환', () => {
    const r = parseOnbid('NOT_JSON');
    expect(r.resultCode).toBe('PARSE_ERROR');
    expect(r.items).toHaveLength(0);
  });
});
