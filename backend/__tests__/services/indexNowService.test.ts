import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildRealEstateUrlsV2,
  buildFacilityUrls,
  submitIndexNow,
} from '../../src/services/indexNowService.js';

describe('submitIndexNow — 결과 카운트', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('INDEXNOW_KEY 미설정이면 제출 없이 0/0 을 반환한다', async () => {
    vi.stubEnv('INDEXNOW_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await submitIndexNow(['https://ilsangkit.co.kr/a'])).toEqual({
      submitted: 0,
      failed: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('200 응답이면 배치 전체를 submitted 로 센다', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    expect(await submitIndexNow(['u1', 'u2'])).toEqual({ submitted: 2, failed: 0 });
  });

  it('4xx 응답이면 배치 전체를 failed 로 센다', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve(''),
      })
    );
    expect(await submitIndexNow(['u1', 'u2'])).toEqual({ submitted: 0, failed: 2 });
  });

  it('네트워크 오류도 failed 로 센다', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await submitIndexNow(['u1'])).toEqual({ submitted: 0, failed: 1 });
  });
});

describe('buildRealEstateUrlsV2 — new URL format (US-008)', () => {
  it('builds absolute URLs in /real-estate/{type}/{city}/{dist}/{bldg} form', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
      },
    ]);
    expect(urls).toEqual([
      `https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`,
    ]);
  });

  it('filters jibun patterns even in new format', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '관악구',
        buildingName: '(535-3)',
      },
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '관악구',
        buildingName: 'ABC빌라',
      },
    ]);
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('/real-estate/villa-sale/seoul/gwanak/');
  });

  it('never emits bjdCode= query in new URLs', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-rent',
        city: '서울',
        district: '강남구',
        buildingName: '래미안강남',
      },
    ]);
    for (const url of urls) {
      expect(url).not.toContain('bjdCode=');
    }
  });

  it('applies NFC normalization before encoding', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-sale',
        city: '서울',
        district: '강남구',
        buildingName: '래미안'.normalize('NFD'),
      },
    ]);
    expect(urls[0]).toContain(encodeURIComponent('래미안'.normalize('NFC')));
  });
});

describe('buildFacilityUrls', () => {
  it('builds /category/id style URLs', () => {
    expect(buildFacilityUrls('toilet', ['abc', 'def'])).toEqual([
      'https://ilsangkit.co.kr/toilet/abc',
      'https://ilsangkit.co.kr/toilet/def',
    ]);
  });
});
