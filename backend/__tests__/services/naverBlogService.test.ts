import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildNaverBlogQuery, stripHtml, buildNaverBlogQueryForRealEstate, filterNaverBlogPosts, fetchFromNaver, type RawNaverBlogPost, NAVER_BLOG_MIN_RESULTS } from '../../src/services/naverBlogService.js';

describe('buildNaverBlogQuery', () => {
  const base = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('parking: name + district + "주차장"', () => {
    expect(buildNaverBlogQuery(base, 'parking')).toBe('종로주차장 종로구 주차장');
  });
  it('toilet', () => {
    expect(buildNaverBlogQuery({ name: '광화문역', city: '서울특별시', district: '종로구' }, 'toilet'))
      .toBe('광화문역 공중화장실 종로구');
  });
  it('park uses city short', () => {
    expect(buildNaverBlogQuery({ name: '남산공원', city: '서울특별시', district: '중구' }, 'park'))
      .toBe('남산공원 서울');
  });
  it('library / hospital → name + district', () => {
    expect(buildNaverBlogQuery({ name: '종로도서관', city: '서울특별시', district: '종로구' }, 'library'))
      .toBe('종로도서관 종로구');
    expect(buildNaverBlogQuery({ name: '서울대병원', city: '서울특별시', district: '종로구' }, 'hospital'))
      .toBe('서울대병원 종로구');
  });
  it('pharmacy', () => {
    expect(buildNaverBlogQuery({ name: '종로약국', city: '서울특별시', district: '종로구' }, 'pharmacy'))
      .toBe('종로약국 종로구 약국');
  });
  it('ev-charger', () => {
    expect(buildNaverBlogQuery({ name: '이마트 종로점', city: '서울특별시', district: '종로구' }, 'ev-charger'))
      .toBe('이마트 종로점 전기차 충전소');
  });
  it('childcare', () => {
    expect(buildNaverBlogQuery({ name: '해님', city: '서울특별시', district: '종로구' }, 'childcare'))
      .toBe('해님 종로구 어린이집');
  });
  it('aed', () => {
    expect(buildNaverBlogQuery({ name: '시청', city: '서울특별시', district: '중구' }, 'aed'))
      .toBe('시청 AED 중구');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQuery({ name: '광장시장', city: '서울특별시', district: '' }, 'market'))
      .toBe('광장시장 서울');
  });
});

describe('stripHtml', () => {
  it('<b> 태그 제거', () => {
    expect(stripHtml('<b>광장시장</b> 후기')).toBe('광장시장 후기');
  });
  it('여러 태그 + 엔티티 제거', () => {
    expect(stripHtml('<b>주차장</b>은 &quot;좋다&quot; &amp; 깨끗')).toBe('주차장은 "좋다" & 깨끗');
  });
  it('&#39; &nbsp; &lt; &gt; 처리', () => {
    expect(stripHtml('it&#39;s&nbsp;great&lt;3&gt;')).toBe('it\'s great<3>');
  });
});

describe('buildNaverBlogQueryForRealEstate', () => {
  const base = { buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' };

  it('apt-sale → 아파트 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-sale'))
      .toBe('롯데캐슬 골드 종로구 아파트 매매');
  });
  it('apt-rent → 아파트 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-rent'))
      .toBe('롯데캐슬 골드 종로구 아파트 전세');
  });
  it('villa-sale → 빌라 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-sale'))
      .toBe('롯데캐슬 골드 종로구 빌라 매매');
  });
  it('villa-rent → 빌라 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-rent'))
      .toBe('롯데캐슬 골드 종로구 빌라 전세');
  });
  it('offitel-sale → 오피스텔 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-sale'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 매매');
  });
  it('offitel-rent → 오피스텔 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-rent'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 전세');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQueryForRealEstate({ buildingName: '롯데캐슬', city: '서울특별시', district: '' }, 'apt-sale'))
      .toBe('롯데캐슬 서울 아파트 매매');
  });
});

function mkPost(overrides: Partial<RawNaverBlogPost> = {}): RawNaverBlogPost {
  return {
    url: 'https://blog.naver.com/x/1',
    title: '종로주차장 후기',
    description: '여기는 종로 한가운데에 있어서 가기 편하고 요금도 합리적이었어요. 추천합니다',
    bloggerName: '여행객A',
    bloggerLink: 'https://blog.naver.com/x',
    postDate: '20250901',
    ...overrides,
  };
}

describe('filterNaverBlogPosts', () => {
  const FIXED_NOW = new Date('2026-05-15T00:00:00+09:00');

  it('광고 키워드 포함 시 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', title: '[광고] 종로주차장 추천' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('description에 협찬 포함 시 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', description: '소개해드릴게요. 본 후기는 협찬 받아 작성되었습니다 (충분한 내용입니다 진짜로)' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('도메인 블랙리스트', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', bloggerLink: 'https://blog.naver.com/blocked-fixture' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW, blockedBloggerLinks: ['https://blog.naver.com/blocked-fixture'] });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('3년 초과 글 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', postDate: '20220101' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('description 30자 미만 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', description: '짧음' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('상위 5건만 반환', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => mkPost({ url: `u${i}` }));
    expect(filterNaverBlogPosts(inputs, { now: FIXED_NOW })).toHaveLength(5);
  });

  it('NAVER_BLOG_MIN_RESULTS = 3', () => {
    expect(NAVER_BLOG_MIN_RESULTS).toBe(3);
  });

  it('최종 5건을 날짜 내림차순(최신순)으로 정렬한다', () => {
    const inputs = [
      mkPost({ url: 'old1',  postDate: '20240301' }),
      mkPost({ url: 'new2',  postDate: '20260215' }),
      mkPost({ url: 'mid1',  postDate: '20250303' }),
      mkPost({ url: 'new1',  postDate: '20260512' }),
      mkPost({ url: 'old2',  postDate: '20240709' }),
    ];
    const out = filterNaverBlogPosts(inputs, { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['new1', 'new2', 'mid1', 'old2', 'old1']);
  });
});

describe('fetchFromNaver', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('정상 응답을 RawNaverBlogPost 배열로 매핑 (HTML strip 적용)', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        title: '<b>종로주차장</b> 후기',
        link: 'https://blog.naver.com/x/1',
        description: '여기는 <b>종로</b> 한가운데에 있어서 가기 편함',
        bloggername: '여행객A',
        bloggerlink: 'https://blog.naver.com/x',
        postdate: '20260301',
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const out = await fetchFromNaver('test query', 'CID', 'CSEC');
    expect(out).toEqual([{
      url: 'https://blog.naver.com/x/1',
      title: '종로주차장 후기',
      description: '여기는 종로 한가운데에 있어서 가기 편함',
      bloggerName: '여행객A',
      bloggerLink: 'https://blog.naver.com/x',
      postDate: '20260301',
    }]);
  });

  it('4xx 응답이면 빈 배열', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    expect(await fetchFromNaver('q', 'CID', 'CSEC')).toEqual([]);
  });

  it('네트워크 에러면 빈 배열', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    expect(await fetchFromNaver('q', 'CID', 'CSEC')).toEqual([]);
  });

  it('clientId 또는 secret 미설정이면 호출 스킵', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    expect(await fetchFromNaver('q', '', 'CSEC')).toEqual([]);
    expect(await fetchFromNaver('q', 'CID', '')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
