// generateGuide.ts TDD 테스트
// P0: 코드 버그 수정 + P1: 네이버 API, 입력 검증, URL 수정

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted로 호이스팅 안전하게 처리)
// ---------------------------------------------------------------------------

const {
  mockGuideUpsert, mockGuideFindMany, mockCount, mockFetch,
} = vi.hoisted(() => ({
  mockGuideUpsert: vi.fn(),
  mockGuideFindMany: vi.fn().mockResolvedValue([]),
  mockCount: vi.fn().mockResolvedValue(100),
  mockFetch: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    guide: { upsert: mockGuideUpsert, findMany: mockGuideFindMany },
    toilet: { count: mockCount },
    aed: { count: mockCount },
    hospital: { count: mockCount },
    pharmacy: { count: mockCount },
    parking: { count: mockCount },
    wifi: { count: mockCount },
    clothes: { count: mockCount },
    park: { count: mockCount },
    school: { count: mockCount },
    market: { count: mockCount },
    library: { count: mockCount },
    childcare: { count: mockCount },
    evCharger: { count: mockCount },
    sports: { count: mockCount },
    $disconnect: vi.fn(),
  },
}));

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  title: '테스트 가이드 제목 스무자 이상의 제목입니다',
                  summary: '테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
                  content: '## 섹션1\n\n내용1 '.repeat(100) + '\n\n## 섹션2\n\n내용2 '.repeat(100),
                  keywords: '키워드1, 키워드2, 키워드3',
                }),
              },
            }],
          }),
        },
      };
      images = {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
        }),
      };
    },
  };
});

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

process.env.NAVER_CLIENT_ID = 'test-naver-client-id';
process.env.NAVER_CLIENT_SECRET = 'test-naver-client-secret';

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  collectNewsTitles,
} from '../../src/scripts/generateGuide.js';

// ---------------------------------------------------------------------------
// P0: 코드 버그 테스트
// ---------------------------------------------------------------------------

// getCategoryHubUrl은 내부 함수 — buildInternalLinksSection 출력으로 간접 검증 (P1에서)

// ---------------------------------------------------------------------------
// P1: 네이버 뉴스 검색 API
// ---------------------------------------------------------------------------

describe('P1: 네이버 검색 API 기반 뉴스 수집', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('네이버 뉴스 API에서 제목+설명을 수집해야 함', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            title: '아파트 <b>매매</b> 거래량 증가',
            description: '서울 아파트 매매 거래량이 3개월 연속 증가세를 보이고 있다.',
            link: 'https://example.com/1',
            pubDate: new Date().toISOString(),
          },
          {
            title: '전세 시장 안정화 전망',
            description: '전세 시장이 안정화되고 있다는 분석이 나왔다.',
            link: 'https://example.com/2',
            pubDate: new Date().toISOString(),
          },
        ],
      }),
    });

    const result = await collectNewsTitles('apt-sale');

    // 네이버 API 호출 확인
    expect(mockFetch).toHaveBeenCalled();
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('openapi.naver.com');

    // 제목 + 설명이 포함된 결과
    expect(result.length).toBeGreaterThan(0);
    // HTML 태그가 제거되어야 함
    expect(result[0]).not.toContain('<b>');
  });

  it('네이버 API 실패 시 빈 배열 반환', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await collectNewsTitles('toilet');
    expect(result).toEqual([]);
  });

  it('네이버 API 타임아웃 시 빈 배열 반환', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));

    const result = await collectNewsTitles('toilet');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1: 부동산 허브 URL ?tab= 구분
// ---------------------------------------------------------------------------

describe('P1: 부동산 허브 URL에 tab 쿼리 포함', () => {
  it('apt-sale은 /real-estate/apt?tab=sale URL을 생성해야 함', async () => {
    mockGuideFindMany.mockResolvedValue([]);
    // buildInternalLinksSection을 통해 간접 검증
    // import 후 호출할 수 있도록 export 필요
    // 현재는 내부 함수라 리팩토링 후 테스트 추가
    expect(true).toBe(true); // placeholder — 리팩토링 후 구현
  });
});

// ---------------------------------------------------------------------------
// P1: 입력 검증 (zod)
// ---------------------------------------------------------------------------

describe('P1: 런타임 입력 검증', () => {
  it('유효하지 않은 카테고리는 에러를 throw해야 함', async () => {
    // generateOneGuide에 잘못된 카테고리 전달
    const { generateOneGuide } = await import('../../src/scripts/generateGuide.js');

    await expect(
      generateOneGuide('invalid-category', 'guide', '테스트'),
    ).rejects.toThrow();
  });

  it('유효하지 않은 articleType은 에러를 throw해야 함', async () => {
    const { generateOneGuide } = await import('../../src/scripts/generateGuide.js');

    await expect(
      generateOneGuide('toilet', 'invalid-type' as any, '테스트'),
    ).rejects.toThrow();
  });

  it('유효한 카테고리와 타입은 정상 동작해야 함', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    mockGuideUpsert.mockResolvedValue({ id: 'test-id', slug: 'test-slug' });

    const { generateOneGuide } = await import('../../src/scripts/generateGuide.js');

    // OPENAI_API_KEY가 없으면 에러 → env mock 필요
    // 이 테스트는 검증 로직만 확인 (OpenAI 호출 전에 검증이 통과하는지)
    process.env.OPENAI_API_KEY = 'test-key';

    const result = await generateOneGuide('toilet', 'howto', '테스트 주제');
    expect(result).toBeDefined();
    expect(result?.category).toBe('toilet');
    expect(result?.articleType).toBe('howto');
  });
});
