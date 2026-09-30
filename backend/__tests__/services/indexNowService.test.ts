import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockAttachCanonicalPaths, mockIsPreservedMode } = vi.hoisted(() => ({
  mockAttachCanonicalPaths: vi.fn(),
  mockIsPreservedMode: vi.fn(() => false),
}));

vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: mockAttachCanonicalPaths,
  isPreservedRealEstateUrlMode: mockIsPreservedMode,
}));

import {
  buildRegisteredRealEstateUrlsV2,
  buildRealEstateUrlsV2,
  buildFacilityUrls,
  submitIndexNow,
} from '../../src/services/indexNowService.js';

describe('submitIndexNow — 결과 카운트', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    mockAttachCanonicalPaths.mockReset();
    mockIsPreservedMode.mockReset();
    mockIsPreservedMode.mockReturnValue(false);
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

it('does not invent public keyed property indexing URLs without registry canonical paths', () => {
  const urls = buildRealEstateUrlsV2([
    { realEstateType: 'villa-sale', city: '서울특별시', district: '강남구', buildingName: '스톤빌리지', buildingKey: 'a'.repeat(64) },
    { realEstateType: 'villa-sale', city: '서울특별시', district: '강남구', buildingName: '스톤빌리지', buildingKey: 'b'.repeat(64) },
  ]);
  expect(urls).toEqual([
    `https://ilsangkit.co.kr/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}`,
    `https://ilsangkit.co.kr/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}`,
  ]);
});

it('uses registered canonical paths for property indexing URLs in preserved mode', async () => {
  const key = 'f'.repeat(64);
  mockIsPreservedMode.mockReturnValue(true);
  mockAttachCanonicalPaths.mockImplementationOnce((rows: Array<{ type: string; buildingKey?: string }>) =>
    Promise.resolve(rows.map((row) => ({ ...row, canonicalPath: `/registered/${row.type}/${row.buildingKey}` }))),
  );

  const urls = await buildRegisteredRealEstateUrlsV2([
    { realEstateType: 'villa-sale', city: '서울특별시', district: '강남구', buildingName: '스톤빌리지', buildingKey: key },
  ]);

  expect(mockAttachCanonicalPaths).toHaveBeenCalledWith([expect.objectContaining({
    type: 'villa-sale',
    buildingKey: key,
  })]);
  expect(urls).toEqual([`https://ilsangkit.co.kr/registered/villa-sale/${key}`]);
});

it('does not emit unregistered property indexing URLs in preserved mode', () => {
  mockIsPreservedMode.mockReturnValue(true);

  const urls = buildRealEstateUrlsV2([
    { realEstateType: 'villa-sale', city: '서울특별시', district: '강남구', buildingName: '스톤빌리지', buildingKey: 'g'.repeat(64) },
  ]);

  expect(urls).toEqual([]);
});
