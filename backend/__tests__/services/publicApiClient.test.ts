import { describe, it, expect, vi, afterEach } from 'vitest';
import { PublicApiClient } from '../../src/services/publicApiClient.js';

const BASE = 'https://api.data.go.kr/openapi/tn_test_api';

function makeClient() {
  return new PublicApiClient(BASE, 'test-key', { maxRetries: 1, retryDelay: 1 });
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(payload) };
}

const HEADER_OK = { resultCode: '00', resultMsg: 'NORMAL SERVICE.' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicApiClient — 응답 봉투 호환', () => {
  it('구형 {response:{header,body}} 봉투를 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          response: { header: HEADER_OK, body: { items: [{ a: 1 }], totalCount: 1, numOfRows: 10, pageNo: 1 } },
        })
      )
    );
    const rows = await makeClient().fetchAllPages(10);
    expect(rows).toEqual([{ a: 1 }]);
  });

  it('신형 루트 {header,body} 봉투를 처리한다 (2026-07 tn_ API 변경)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          header: HEADER_OK,
          body: { items: { item: [{ a: 1 }, { a: 2 }] }, totalCount: 2, numOfRows: 10, pageNo: 1 },
        })
      )
    );
    const rows = await makeClient().fetchAllPages(10);
    expect(rows).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('신형 봉투로 여러 페이지를 순회한다', async () => {
    const page = (pageNo: number, items: unknown[]) =>
      jsonResponse({ header: HEADER_OK, body: { items: { item: items }, totalCount: 3, numOfRows: 2, pageNo } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(page(1, [{ a: 1 }, { a: 2 }])).mockResolvedValueOnce(page(2, [{ a: 3 }]))
    );
    const rows = await makeClient().fetchAllPages(2);
    expect(rows).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });
});

describe('PublicApiClient — 오류 fail-closed', () => {
  it('data.go.kr 공통 에러 페이로드는 메시지를 살려 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          OpenAPI_ServiceResponse: {
            cmmMsgHeader: {
              errMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
              returnAuthMsg: '등록되지 않은 서비스키',
              returnReasonCode: '30',
            },
          },
        })
      )
    );
    await expect(makeClient().fetchData({ pageNo: 1, numOfRows: 10 })).rejects.toThrow('등록되지 않은 서비스키');
  });

  it('header/body 없는 알 수 없는 구조는 원문 일부를 담아 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ totally: 'different' })));
    await expect(makeClient().fetchData({ pageNo: 1, numOfRows: 10 })).rejects.toThrow('예상 밖 응답 구조');
  });

  it('resultCode 오류는 신형 봉투에서도 잡는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ header: { resultCode: '22', resultMsg: 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS' }, body: { items: null, totalCount: 0, numOfRows: 0, pageNo: 1 } })
      )
    );
    await expect(makeClient().fetchData({ pageNo: 1, numOfRows: 10 })).rejects.toThrow('API Error: 22');
  });
});
