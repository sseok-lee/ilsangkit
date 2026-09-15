import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockQueryRaw, mockUpdate, mockDisconnect } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockUpdate: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    toilet: { update: mockUpdate },
    $disconnect: mockDisconnect,
  },
}));

import {
  geocodeResultMatchesRegion,
  geocodeToilets,
} from '../../src/scripts/geocodeToilets.js';

const originalFetch = global.fetch;

function kakaoResponse(documents: Array<Record<string, string>>) {
  return {
    ok: true,
    json: async () => ({ documents }),
  } as Response;
}

describe('geocodeResultMatchesRegion', () => {
  it('서울 축약/정식 표기를 모두 허용하고 구가 맞으면 true', () => {
    expect(
      geocodeResultMatchesRegion(
        { lat: 37.52, lng: 126.9, addressName: '서울 영등포구 양산로 지하21' },
        { city: '서울특별시', district: '영등포구' }
      )
    ).toBe(true);
  });

  it('응답 주소의 구가 다르면 false', () => {
    expect(
      geocodeResultMatchesRegion(
        { lat: 37.509109, lng: 127.049088, addressName: '서울 강남구 선릉로 108길 27' },
        { city: '서울특별시', district: '영등포구' }
      )
    ).toBe(false);
  });
});

describe('geocodeToilets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KAKAO_REST_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.KAKAO_REST_API_KEY;
  });

  it('주소와 다른 구를 가리키는 키워드 지오코딩 결과는 저장하지 않는다', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'toilet-5423af32f2a034b7',
        name: '양평역 화장실(1)',
        address: '서울특별시 영등포구 양산로 지하21',
        roadAddress: '서울특별시 영등포구 양산로 지하21',
        city: '서울특별시',
        district: '영등포구',
      },
    ]);
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(kakaoResponse([]))
      .mockResolvedValueOnce(kakaoResponse([
        {
          x: '127.049088',
          y: '37.509109',
          address_name: '서울 강남구 선릉로 108길 27',
        },
      ]));

    const result = await geocodeToilets();

    expect(result).toEqual({ total: 1, updated: 0, failed: 1 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
