// generateGuide 슬림 버전 테스트
// Scope: CLI 파서, 네이버 검색, 트렌드 키워드 발굴, 리서치, 구조 검증, 전체 happy path

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted로 호이스팅 안전)
// ---------------------------------------------------------------------------

const {
  mockGuideUpsert,
  mockGuideFindMany,
  mockCount,
  mockFetch,
  mockChatCreate,
  mockImageGenerate,
} = vi.hoisted(() => ({
  mockGuideUpsert: vi.fn(),
  mockGuideFindMany: vi.fn().mockResolvedValue([]),
  mockCount: vi.fn().mockResolvedValue(100),
  mockFetch: vi.fn(),
  mockChatCreate: vi.fn(),
  mockImageGenerate: vi.fn(),
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
    wasteSchedule: { count: mockCount },
    $disconnect: vi.fn(),
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: { create: mockChatCreate },
    };
    images = { generate: mockImageGenerate };
  },
}));

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

process.env.NAVER_CLIENT_ID = 'test-naver-client-id';
process.env.NAVER_CLIENT_SECRET = 'test-naver-client-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  parseCliOptions,
  isGuideCategory,
  fetchNaverSearch,
  discoverTrendingKeyword,
  researchByKeyword,
  extractHeadings,
  validateArticleStructure,
  stripDateMarkers,
  normalizeSections,
  isSummaryHeading,
  isReferencesHeading,
  generateOneGuide,
  GUIDE_CATEGORIES,
} from '../../src/scripts/generateGuide.js';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_HEADINGS = [
  '핵심 요약',
  '이 글이 필요한 사람',
  '달라지는 점',
  '지금 확인할 것',
  '주의할 점',
  '참고 자료',
] as const;

function buildValidArticleContent(headings: readonly string[] = DEFAULT_HEADINGS): string {
  const body = '실제 행동과 이해에 도움이 되는 내용을 충분히 설명합니다. '.repeat(30);
  return headings.map((heading) => `## ${heading}\n\n${body}`).join('\n\n');
}

const SECTION_BODY = '이 섹션 본문입니다. 실제 행동과 이해에 도움이 되는 내용을 구체적으로 설명합니다. 사이트명, 기관명, 절차 등을 포함합니다. '.repeat(10);

function setupNaverResponse(items: unknown[]) {
  mockFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ items }),
  }));
}

/**
 * Article generation은 meta(1) + 섹션 수만큼 호출.
 * meta는 JSON(title/summary/keywords/sections), 섹션은 마크다운 본문.
 */
function setupArticleGenerationMocks(overrides?: {
  title?: string;
  summary?: string;
  keywords?: string;
  sectionBody?: string;
  sections?: Array<{ heading: string; description: string }>;
}) {
  const sections =
    overrides?.sections ??
    DEFAULT_HEADINGS.map((h) => ({ heading: h, description: `${h} 섹션 설명` }));

  mockChatCreate.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const prompt = messages[0]?.content ?? '';
    if (prompt.includes('제목·요약·키워드·섹션')) {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: overrides?.title ?? '슬림 버전 테스트 가이드 스무자 이상의 제목입니다',
                summary:
                  overrides?.summary ?? '슬림 버전 테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
                keywords: overrides?.keywords ?? '키워드1, 키워드2, 키워드3',
                sections,
              }),
            },
          },
        ],
      };
    }
    // 섹션 본문 호출
    return {
      choices: [{ message: { content: overrides?.sectionBody ?? SECTION_BODY } }],
    };
  });
}

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

describe('parseCliOptions', () => {
  it('모든 플래그를 올바르게 파싱', () => {
    const parsed = parseCliOptions([
      '--category', 'apt-sale',
      '--topic', '스트레스 DSR',
      '--dry-run',
    ]);
    expect(parsed).toEqual({
      category: 'apt-sale',
      topic: '스트레스 DSR',
      dryRun: true,
    });
  });

  it('옵션이 없으면 undefined + dryRun false', () => {
    const parsed = parseCliOptions([]);
    expect(parsed.category).toBeUndefined();
    expect(parsed.topic).toBeUndefined();
    expect(parsed.dryRun).toBe(false);
  });

  it('유효하지 않은 카테고리는 throw', () => {
    expect(() => parseCliOptions(['--category', 'invalid'])).toThrow(/Unknown category/);
  });
});

describe('isGuideCategory', () => {
  it('등록된 카테고리는 true', () => {
    expect(isGuideCategory('apt-sale')).toBe(true);
    expect(isGuideCategory('toilet')).toBe(true);
  });
  it('알 수 없는 카테고리는 false', () => {
    expect(isGuideCategory('foo')).toBe(false);
  });
  it('19개 카테고리 등록', () => {
    expect(GUIDE_CATEGORIES.length).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// Article structure validation
// ---------------------------------------------------------------------------

describe('validateArticleStructure (유동 섹션 스펙)', () => {
  it('5~8섹션 + 첫 요약류 + 마지막 참고 자료류 통과', () => {
    const result = validateArticleStructure(buildValidArticleContent());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('주제별로 다른 중간 섹션 제목도 통과 (유동성 확인)', () => {
    const headings = [
      '핵심 요약',
      '스트레스 DSR 2단계 뭐가 달라지나',
      '영향 받는 사람은 누구?',
      '대출 한도 확인 방법',
      '참고 자료',
    ];
    const result = validateArticleStructure(buildValidArticleContent(headings));
    expect(result.valid).toBe(true);
  });

  it('섹션 수가 5 미만이면 실패', () => {
    const content = '## 핵심 요약\n\n내용\n\n## 참고 자료\n\n내용';
    const result = validateArticleStructure(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('section count out of range'))).toBe(true);
  });

  it('섹션 수가 8 초과면 실패', () => {
    const headings = [
      '핵심 요약', 's1', 's2', 's3', 's4', 's5', 's6', 's7', '참고 자료',
    ];
    const result = validateArticleStructure(buildValidArticleContent(headings));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('section count out of range'))).toBe(true);
  });

  it('첫 섹션이 요약류가 아니면 실패', () => {
    const headings = ['잘못된 시작', '섹션2', '섹션3', '섹션4', '참고 자료'];
    const result = validateArticleStructure(buildValidArticleContent(headings));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('first section must be a summary'))).toBe(true);
  });

  it('마지막 섹션이 참고 자료류가 아니면 실패', () => {
    const headings = ['핵심 요약', 's2', 's3', 's4', '잘못된 끝'];
    const result = validateArticleStructure(buildValidArticleContent(headings));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('last section must be a references'))).toBe(true);
  });

  it('extractHeadings는 ## 헤더만 추출', () => {
    const content = '## A\n본문\n### 소제목\n## B\n본문';
    expect(extractHeadings(content)).toEqual(['A', 'B']);
  });
});

describe('heading classifiers', () => {
  it('isSummaryHeading은 요약류 헤딩을 true', () => {
    expect(isSummaryHeading('핵심 요약')).toBe(true);
    expect(isSummaryHeading('한눈에 보기')).toBe(true);
    expect(isSummaryHeading('미리 보기')).toBe(true);
    expect(isSummaryHeading('주의할 점')).toBe(false);
  });

  it('isReferencesHeading은 참고 자료류 헤딩을 true', () => {
    expect(isReferencesHeading('참고 자료')).toBe(true);
    expect(isReferencesHeading('공식 확인 채널')).toBe(true);
    expect(isReferencesHeading('참고 링크')).toBe(true);
    expect(isReferencesHeading('핵심 요약')).toBe(false);
  });
});

describe('normalizeSections', () => {
  it('공백·중복 제거하고 그대로 반환', () => {
    const result = normalizeSections([
      { heading: '  핵심 요약  ', description: 'desc1' },
      { heading: '섹션2', description: 'desc2' },
      { heading: '섹션2', description: 'desc2 dup' },
      { heading: '참고 자료', description: 'desc3' },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].heading).toBe('핵심 요약');
    expect(result.map((s) => s.heading)).toEqual(['핵심 요약', '섹션2', '참고 자료']);
  });

  it('요약/참고 자료 섹션 누락 시 자동 보강', () => {
    const result = normalizeSections([
      { heading: '내용1', description: 'd' },
      { heading: '내용2', description: 'd' },
    ]);
    expect(isSummaryHeading(result[0].heading)).toBe(true);
    expect(isReferencesHeading(result[result.length - 1].heading)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Date markers stripping (본문에서 "YYYY년 N월 기준" 류 표기 제거)
// ---------------------------------------------------------------------------

describe('stripDateMarkers', () => {
  it('"이 글은 ~ 기준으로 작성되었습니다" 문장 제거', () => {
    const input = '본문 내용입니다. 이 글은 2026년 4월 24일 기준으로 작성되었습니다. 이어지는 내용.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('작성되었습니다');
    expect(output).not.toContain('2026년');
    expect(output).toContain('본문 내용입니다.');
    expect(output).toContain('이어지는 내용.');
  });

  it('"YYYY년 N월 기준" 구절 제거 (당해년도 포함 모두)', () => {
    const input = '2026년 4월 기준 정책이 바뀌었습니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('2026년');
    expect(output).toContain('정책이 바뀌었습니다.');
  });

  it('"YYYY년 N월 N일 기준으로" 구절 제거', () => {
    const input = '정책은 2024년 3월 15일 기준으로 유효합니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('2024년');
    expect(output).not.toContain('기준');
    expect(output).toContain('정책은');
    expect(output).toContain('유효합니다');
  });

  it('"오늘 기준" / "오늘 날짜 기준" 표기 제거', () => {
    const input = '오늘 기준으로 확인된 사실입니다. 오늘 날짜 기준에서도 동일합니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('오늘 기준');
    expect(output).not.toContain('오늘 날짜 기준');
  });

  it('여러 개의 기준 표기도 모두 제거', () => {
    const input = '2022년 5월 기준 보도이며, 2023년 8월 기준 개정되었습니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('2022년');
    expect(output).not.toContain('2023년');
    expect(output).not.toContain('기준');
    expect(output).toContain('보도');
    expect(output).toContain('개정되었습니다');
  });

  it('날짜 표기 없는 본문은 변경 없음', () => {
    const input = '아파트 매매 시 등기부등본을 반드시 확인하세요.';
    const output = stripDateMarkers(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Naver search
// ---------------------------------------------------------------------------

describe('fetchNaverSearch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('제목·설명에서 HTML 태그 제거', async () => {
    setupNaverResponse([
      {
        title: '아파트 <b>매매</b> 거래량',
        description: '서울 <em>증가</em>세',
        link: 'https://example.com/1',
      },
    ]);
    const result = await fetchNaverSearch('news', '아파트', 10);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('아파트 매매 거래량');
    expect(result[0].description).toBe('서울 증가세');
  });

  it('HTTP 실패 시 빈 배열', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchNaverSearch('news', '아파트', 10);
    expect(result).toEqual([]);
  });

  it('예외 발생 시 빈 배열', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    const result = await fetchNaverSearch('news', '아파트', 10);
    expect(result).toEqual([]);
  });

  it('URL에 openapi.naver.com + sort=date 포함', async () => {
    setupNaverResponse([]);
    await fetchNaverSearch('news', '아파트 매매', 10);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('openapi.naver.com/v1/search/news.json');
    expect(url).toContain('sort=date');
    expect(url).toContain(encodeURIComponent('아파트 매매'));
  });
});

// ---------------------------------------------------------------------------
// Trending keyword discovery
// ---------------------------------------------------------------------------

describe('discoverTrendingKeyword', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockChatCreate.mockReset();
  });

  it('LLM이 뽑은 키워드를 반환', async () => {
    setupNaverResponse([
      { title: '스트레스 DSR 2단계 시행 임박', description: '...', link: 'https://a.com' },
      { title: 'DSR 규제 강화 전망', description: '...', link: 'https://b.com' },
    ]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ keyword: '스트레스 DSR' }) } }],
    });
    const openai = new OpenAI({ apiKey: 'test' });
    const keyword = await discoverTrendingKeyword(openai, 'apt-sale', []);
    expect(keyword).toBe('스트레스 DSR');
    expect(mockChatCreate).toHaveBeenCalledOnce();
  });

  it('뉴스 0건이면 카테고리 라벨로 fallback', async () => {
    setupNaverResponse([]);
    const openai = new OpenAI({ apiKey: 'test' });
    const keyword = await discoverTrendingKeyword(openai, 'apt-sale', []);
    expect(keyword).toBe('아파트 매매');
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('LLM 키워드가 너무 짧으면 라벨로 fallback', async () => {
    setupNaverResponse([{ title: '뉴스1', description: '...', link: 'https://a.com' }]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ keyword: 'x' }) } }],
    });
    const openai = new OpenAI({ apiKey: 'test' });
    const keyword = await discoverTrendingKeyword(openai, 'apt-sale', []);
    expect(keyword).toBe('아파트 매매');
  });

  it('LLM 호출 실패 시 라벨로 fallback', async () => {
    setupNaverResponse([{ title: '뉴스1', description: '...', link: 'https://a.com' }]);
    mockChatCreate.mockRejectedValue(new Error('openai error'));
    const openai = new OpenAI({ apiKey: 'test' });
    const keyword = await discoverTrendingKeyword(openai, 'apt-sale', []);
    expect(keyword).toBe('아파트 매매');
  });

  it('recentTitles가 LLM 프롬프트에 포함', async () => {
    setupNaverResponse([{ title: '뉴스1', description: '...', link: 'https://a.com' }]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ keyword: '새로운 주제' }) } }],
    });
    const openai = new OpenAI({ apiKey: 'test' });
    await discoverTrendingKeyword(openai, 'apt-sale', ['이전 제목 A', '이전 제목 B']);
    const promptContent = mockChatCreate.mock.calls[0][0].messages[0].content;
    expect(promptContent).toContain('이전 제목 A');
    expect(promptContent).toContain('이전 제목 B');
  });
});

// ---------------------------------------------------------------------------
// Deep research
// ---------------------------------------------------------------------------

describe('researchByKeyword', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('news + blog 양쪽 호출하고 dedupe', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/news.json')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              { title: '중복 제목', description: 'news desc', link: 'https://dup.com' },
              { title: '뉴스 단독', description: '...', link: 'https://news-only.com' },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            { title: '중복 제목', description: 'blog desc', link: 'https://dup.com' }, // link 기준 dedupe
            { title: '블로그 단독', description: '...', link: 'https://blog-only.com' },
          ],
        }),
      };
    });

    const items = await researchByKeyword('스트레스 DSR');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const links = items.map((i) => i.link);
    expect(new Set(links).size).toBe(links.length); // no dupes
    expect(links).toContain('https://news-only.com');
    expect(links).toContain('https://blog-only.com');
  });
});

// ---------------------------------------------------------------------------
// End-to-end happy path
// ---------------------------------------------------------------------------

describe('generateOneGuide — happy path', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockChatCreate.mockReset();
    mockImageGenerate.mockReset();
    mockGuideFindMany.mockReset();
    mockGuideUpsert.mockReset();
    mockGuideFindMany.mockResolvedValue([]);
  });

  it('--topic 지정 시 트렌드 선정 스킵 + 글 생성 + 저장', async () => {
    setupNaverResponse([
      { title: '관련 뉴스', description: '...', link: 'https://a.com' },
    ]);
    setupArticleGenerationMocks();
    mockImageGenerate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('fake').toString('base64') }],
    });
    mockGuideUpsert.mockImplementation(async ({ where, create }: any) => ({
      id: 'guide-1',
      slug: where.slug,
      ...create,
    }));

    const result = await generateOneGuide({
      category: 'apt-sale',
      topic: '스트레스 DSR',
    });

    expect(result.category).toBe('apt-sale');
    expect(result.keyword).toBe('스트레스 DSR');
    expect(result.slug).toMatch(/^apt-sale-/);
    expect(mockGuideUpsert).toHaveBeenCalledOnce();

    // --topic 모드: keyword-picker 스킵. meta(1) + 6섹션 = 7회 호출
    expect(mockChatCreate).toHaveBeenCalledTimes(7);
  });

  it('--topic 미지정 시 트렌드 키워드 발굴 → 리서치 → 생성', async () => {
    setupNaverResponse([
      { title: '최신 이슈', description: '...', link: 'https://a.com' },
    ]);
    let callIndex = 0;
    mockChatCreate.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const prompt = messages[0]?.content ?? '';
      callIndex += 1;
      if (prompt.includes('요즘 가장 화제가 되는')) {
        // keyword picker
        return { choices: [{ message: { content: JSON.stringify({ keyword: '자동선정 키워드' }) } }] };
      }
      if (prompt.includes('제목·요약·키워드')) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: '자동 선정 테스트 가이드 제목입니다 스무자',
                  summary:
                    '자동 선정 테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
                  keywords: '키워드1, 키워드2, 키워드3',
                  sections: DEFAULT_HEADINGS.map((h) => ({
                    heading: h,
                    description: `${h} 섹션 설명`,
                  })),
                }),
              },
            },
          ],
        };
      }
      return { choices: [{ message: { content: SECTION_BODY } }] };
    });
    mockImageGenerate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('fake').toString('base64') }],
    });
    mockGuideUpsert.mockImplementation(async ({ where }: any) => ({
      id: 'guide-2',
      slug: where.slug,
    }));

    const result = await generateOneGuide({ category: 'apt-sale' });

    expect(result.keyword).toBe('자동선정 키워드');
    // picker(1) + meta(1) + 6 sections = 8
    expect(mockChatCreate).toHaveBeenCalledTimes(8);
    expect(callIndex).toBe(8);
    expect(mockGuideUpsert).toHaveBeenCalledOnce();
  });

  it('이미지 생성 실패 시 throw하고 DB 저장 스킵', async () => {
    setupNaverResponse([
      { title: '뉴스', description: '...', link: 'https://a.com' },
    ]);
    setupArticleGenerationMocks();
    mockImageGenerate.mockRejectedValue(new Error('image gen failed'));

    await expect(
      generateOneGuide({ category: 'pharmacy', topic: '야간 약국' })
    ).rejects.toThrow(/썸네일 생성 실패/);

    expect(mockGuideUpsert).not.toHaveBeenCalled();
  });

  it('OPENAI_API_KEY 없으면 throw', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(generateOneGuide({ category: 'toilet', topic: '테스트' })).rejects.toThrow(
      /OPENAI_API_KEY/
    );

    process.env.OPENAI_API_KEY = originalKey;
  });
});
