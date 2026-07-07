import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toYyyymmdd,
  stripHtml,
  parsePolicyResponse,
  fetchRecentPolicyNews,
} from '../../src/services/policyBriefingClient.js';

const SAMPLE = {
  NewsItem: [
    {
      NewsItemId: 'P1001',
      Title: '청약제도 개편안 발표',
      SubTitle1: '무주택 실수요자 중심 개편',
      MinisterCode: '1741000',
      DataContents: '<p>국토교통부는 청약제도를 <b>개편</b>한다.</p>',
      ContentsType: 'H',
      ApproveDate: '20260705',
      OriginalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
      ThumbnailUrl: 'https://www.korea.kr/thumb/P1001.jpg',
    },
    { NewsItemId: '', Title: '', DataContents: '' }, // 불완전 → 필터링됨
  ],
};

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
  it('필드 매핑 + HTML 제거 + 불완전 항목 필터', () => {
    const out = parsePolicyResponse(SAMPLE);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      newsItemId: 'P1001',
      title: '청약제도 개편안 발표',
      subTitle: '무주택 실수요자 중심 개편',
      ministerCode: '1741000',
      dataContents: '국토교통부는 청약제도를 개편한다.',
      approveDate: '20260705',
      originalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
      thumbnailUrl: 'https://www.korea.kr/thumb/P1001.jpg',
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
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705' });
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
  });

  it('HTTP 실패면 빈 배열', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705' });
    expect(out).toEqual([]);
  });

  it('성공 시 파싱 + startDate/endDate 쿼리 포함', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => SAMPLE });
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705', numOfRows: 50 });
    expect(out).toHaveLength(1);
    expect(out[0].newsItemId).toBe('P1001');
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('startDate=20260601');
    expect(calledUrl).toContain('endDate=20260705');
    expect(calledUrl).toContain('numOfRows=50');
  });
});
