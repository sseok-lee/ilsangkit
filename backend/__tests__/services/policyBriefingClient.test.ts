import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
  toYyyymmdd,
  stripHtml,
  parsePolicyResponse,
  fetchRecentPolicyNews,
} from '../../src/services/policyBriefingClient.js';

const XML_OK = `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>0</resultCode><resultMsg>NORMAL_SERVICE</resultMsg></header><body>` +
  `<NewsItem><NewsItemId>148967733</NewsItemId><GroupingCode>policy</GroupingCode>` +
  `<Title><![CDATA[청약제도 개편안 발표]]></Title><SubTitle1><![CDATA[무주택 실수요자 중심]]></SubTitle1>` +
  `<ContentsType>H</ContentsType><DataContents><![CDATA[<p>국토교통부는 청약제도를 <b>개편</b>한다.</p>]]></DataContents>` +
  `<MinisterCode>국토교통부</MinisterCode><OriginalUrl>https://www.korea.kr/news/policyNewsView.do?newsId=148967733</OriginalUrl>` +
  `<ApproveDate>07/05/2026 10:00:00</ApproveDate><ModifyDate>07/05/2026 10:00:00</ModifyDate><KoglType>1</KoglType></NewsItem>` +
  `<NewsItem><NewsItemId></NewsItemId><Title></Title><DataContents></DataContents></NewsItem></body></response>`;

const XML_ERR = `<?xml version="1.0"?><response><header><resultCode>98</resultCode><resultMsg>THREE_DAYS_OVER_ERROR</resultMsg></header><body></body></response>`;

const parseXml = (s: string) => new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true }).parse(s);

describe('toYyyymmdd', () => {
  it('YYYYMMDD로 0패딩 포맷', () => {
    expect(toYyyymmdd(new Date(2026, 6, 5))).toBe('20260705'); // month는 0-index(6=July)
  });
});

describe('stripHtml', () => {
  it('태그 제거 후 trim', () => {
    expect(stripHtml('<p>국토교통부는 <b>개편</b>한다.</p>')).toBe('국토교통부는 개편한다.');
  });
});

describe('parsePolicyResponse', () => {
  it('XML 파싱 객체에서 필드 매핑 + HTML 제거 + 불완전 항목 필터', () => {
    const out = parsePolicyResponse(parseXml(XML_OK));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      newsItemId: '148967733',
      title: '청약제도 개편안 발표',
      subTitle: '무주택 실수요자 중심',
      ministerCode: '국토교통부',
      dataContents: '국토교통부는 청약제도를 개편한다.',
      approveDate: '07/05/2026 10:00:00',
      originalUrl: 'https://www.korea.kr/news/policyNewsView.do?newsId=148967733',
      thumbnailUrl: '',
    });
  });
  it('알 수 없는 형태면 빈 배열', () => {
    expect(parsePolicyResponse({})).toEqual([]);
    expect(parsePolicyResponse(null)).toEqual([]);
  });
});

describe('fetchRecentPolicyNews', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
  });

  it('키 없으면 빈 배열(fail-soft)', async () => {
    delete process.env.OPENAPI_SERVICE_KEY;
    const out = await fetchRecentPolicyNews({ startDate: '20260705', endDate: '20260707' });
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
  });

  it('HTTP 실패면 빈 배열', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await fetchRecentPolicyNews({ startDate: '20260705', endDate: '20260707' })).toEqual([]);
  });

  it('resultCode!=0(에러 XML)이면 빈 배열', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => XML_ERR });
    expect(await fetchRecentPolicyNews({ startDate: '20260701', endDate: '20260707' })).toEqual([]);
  });

  it('성공 XML 파싱 + startDate/endDate 쿼리 포함', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => XML_OK });
    const out = await fetchRecentPolicyNews({ startDate: '20260705', endDate: '20260707', numOfRows: 100 });
    expect(out).toHaveLength(1);
    expect(out[0].newsItemId).toBe('148967733');
    expect(out[0].ministerCode).toBe('국토교통부');
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('startDate=20260705');
    expect(calledUrl).toContain('endDate=20260707');
  });
});
