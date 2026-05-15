import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildYoutubeQuery, filterVideos, fetchFromYoutube, type RawYoutubeVideo } from '../../src/services/youtubeService.js';

describe('buildYoutubeQuery', () => {
  const base = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('parking: name + district + "주차장"', () => {
    expect(buildYoutubeQuery({ ...base }, 'parking')).toBe('종로주차장 종로구 주차장');
  });

  it('toilet: name + "공중화장실" + district', () => {
    expect(buildYoutubeQuery({ name: '광화문역', city: '서울특별시', district: '종로구' }, 'toilet'))
      .toBe('광화문역 공중화장실 종로구');
  });

  it('park: name + city (short)', () => {
    expect(buildYoutubeQuery({ name: '남산공원', city: '서울특별시', district: '중구' }, 'park'))
      .toBe('남산공원 서울');
  });

  it('library: name + district', () => {
    expect(buildYoutubeQuery({ name: '종로도서관', city: '서울특별시', district: '종로구' }, 'library'))
      .toBe('종로도서관 종로구');
  });

  it('hospital: name + district', () => {
    expect(buildYoutubeQuery({ name: '서울대병원', city: '서울특별시', district: '종로구' }, 'hospital'))
      .toBe('서울대병원 종로구');
  });

  it('ev-charger: name + "전기차 충전소"', () => {
    expect(buildYoutubeQuery({ name: '이마트 종로점', city: '서울특별시', district: '종로구' }, 'ev-charger'))
      .toBe('이마트 종로점 전기차 충전소');
  });

  it('pharmacy: name + district + "약국"', () => {
    expect(buildYoutubeQuery({ name: '종로약국', city: '서울특별시', district: '종로구' }, 'pharmacy'))
      .toBe('종로약국 종로구 약국');
  });

  it('school/market/sports: name + district', () => {
    expect(buildYoutubeQuery({ name: '경복초등학교', city: '서울특별시', district: '종로구' }, 'school'))
      .toBe('경복초등학교 종로구');
    expect(buildYoutubeQuery({ name: '광장시장', city: '서울특별시', district: '종로구' }, 'market'))
      .toBe('광장시장 종로구');
    expect(buildYoutubeQuery({ name: '종로체육관', city: '서울특별시', district: '종로구' }, 'sports'))
      .toBe('종로체육관 종로구');
  });

  it('childcare: name + district + "어린이집"', () => {
    expect(buildYoutubeQuery({ name: '해님', city: '서울특별시', district: '종로구' }, 'childcare'))
      .toBe('해님 종로구 어린이집');
  });

  it('aed: name + "AED" + district', () => {
    expect(buildYoutubeQuery({ name: '시청', city: '서울특별시', district: '중구' }, 'aed'))
      .toBe('시청 AED 중구');
  });

  it('district 누락 시 city short로 폴백', () => {
    expect(buildYoutubeQuery({ name: '광장시장', city: '서울특별시', district: '' }, 'market'))
      .toBe('광장시장 서울');
  });
});

function mkVideo(overrides: Partial<RawYoutubeVideo> = {}): RawYoutubeVideo {
  return {
    videoId: 'v1',
    title: '제목',
    channelTitle: '채널',
    thumbnail: 'https://i.ytimg.com/vi/v1/mqdefault.jpg',
    publishedAt: '2026-05-01T00:00:00Z',
    duration: 'PT5M',
    ...overrides,
  };
}

describe('filterVideos', () => {
  it('제목에 광고 키워드가 포함되면 제외한다', () => {
    const out = filterVideos([
      mkVideo({ videoId: 'a', title: '[광고] 종로주차장' }),
      mkVideo({ videoId: 'b', title: '종로주차장 솔직 후기' }),
    ]);
    expect(out.map((v) => v.videoId)).toEqual(['b']);
  });

  it('채널이 차단 리스트에 있으면 제외한다', () => {
    const out = filterVideos([
      mkVideo({ videoId: 'a', channelTitle: 'BLOCKED_CHANNEL_FIXTURE' }),
      mkVideo({ videoId: 'b' }),
    ], { blockedChannels: ['BLOCKED_CHANNEL_FIXTURE'] });
    expect(out.map((v) => v.videoId)).toEqual(['b']);
  });

  it('상위 6개로 잘라낸다', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => mkVideo({ videoId: `v${i}` }));
    expect(filterVideos(inputs)).toHaveLength(6);
  });
});

describe('fetchFromYoutube', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('정상 응답을 RawYoutubeVideo 배열로 매핑한다', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        id: { kind: 'youtube#video', videoId: 'abc' },
        snippet: {
          title: '제목',
          channelTitle: '채널',
          publishedAt: '2026-05-01T00:00:00Z',
          thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc/mqdefault.jpg' } },
        },
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const out = await fetchFromYoutube('test query', 'KEY');
    expect(out).toEqual([{
      videoId: 'abc',
      title: '제목',
      channelTitle: '채널',
      thumbnail: 'https://i.ytimg.com/vi/abc/mqdefault.jpg',
      publishedAt: '2026-05-01T00:00:00Z',
      duration: '',
    }]);
  });

  it('4xx 응답이면 빈 배열을 반환한다', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', 'KEY')).toEqual([]);
  });

  it('네트워크 에러면 빈 배열을 반환한다', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', 'KEY')).toEqual([]);
  });

  it('API key 미설정이면 호출을 건너뛰고 빈 배열을 반환한다', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', '')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
