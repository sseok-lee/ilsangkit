// generateArticle — 오늘의 이슈 draft 생성기 테스트
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockArticleCreate,
  mockArticleFindMany,
  mockArticleFindUnique,
  mockGuideFindMany,
  mockGuideFindUnique,
  mockCount,
  mockFetch,
  mockChatCreate,
  mockImageGenerate,
} = vi.hoisted(() => ({
  mockArticleCreate: vi.fn(),
  mockArticleFindMany: vi.fn().mockResolvedValue([]),
  mockArticleFindUnique: vi.fn().mockResolvedValue(null),
  mockGuideFindMany: vi.fn().mockResolvedValue([]),
  mockGuideFindUnique: vi.fn().mockResolvedValue(null),
  mockCount: vi.fn().mockResolvedValue(100),
  mockFetch: vi.fn(),
  mockChatCreate: vi.fn(),
  mockImageGenerate: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    article: { create: mockArticleCreate, findMany: mockArticleFindMany, findUnique: mockArticleFindUnique },
    guide: { findMany: mockGuideFindMany, findUnique: mockGuideFindUnique },
    toilet: { count: mockCount }, aed: { count: mockCount }, hospital: { count: mockCount },
    pharmacy: { count: mockCount }, parking: { count: mockCount }, wifi: { count: mockCount },
    clothes: { count: mockCount }, park: { count: mockCount }, school: { count: mockCount },
    market: { count: mockCount }, library: { count: mockCount }, childcare: { count: mockCount },
    evCharger: { count: mockCount }, sports: { count: mockCount }, wasteSchedule: { count: mockCount },
    $disconnect: vi.fn(),
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
    images = { generate: mockImageGenerate };
  },
}));
vi.mock('child_process', () => ({ execFileSync: vi.fn() }));
// NOTE(deviation from brief verbatim): execFileSync is mocked as a no-op, so it never
// actually writes `outputPath`. Real fs/promises isn't mocked elsewhere in this file, so
// without this, `stat(outputPath)` in generateThumbnail always throws ENOENT once the
// PNG-as-webp fallback is removed (Step 4) — making every thumbnail-success path
// unreachable regardless of test intent. Simulate a successful `convert` result instead.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, stat: vi.fn().mockResolvedValue({ size: 12345 } as any) };
});
vi.stubGlobal('fetch', mockFetch);

process.env.NAVER_CLIENT_ID = 'test-id';
process.env.NAVER_CLIENT_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';

import {
  parseArticleCliOptions,
  toSources,
  buildArticleInternalLinks,
  generateOneArticle,
} from '../../src/scripts/generateArticle.js';

const DEFAULT_HEADINGS = ['핵심 요약', '이번 이슈에서 봐야 할 점', '달라지는 내용', '지금 확인할 것', '주의할 점', '참고 자료'];
const SECTION_BODY = '이 섹션 본문입니다. 실제 확인 행동과 사이트 데이터 연결을 구체적으로 설명합니다. 기관명·절차를 포함합니다. '.repeat(10);

function setupNaver(items: unknown[]) {
  mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ items }) }));
}
function setupGen() {
  mockChatCreate.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const prompt = messages[0]?.content ?? '';
    if (prompt.includes('제목·요약·키워드')) {
      return { choices: [{ message: { content: JSON.stringify({
        title: '오늘의 이슈 테스트 제목입니다 스무자 이상',
        summary: '오늘의 이슈 테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
        keywords: '키워드1, 키워드2, 키워드3',
        sections: DEFAULT_HEADINGS.map((h) => ({ heading: h, description: `${h} 설명` })),
      }) } }] };
    }
    return { choices: [{ message: { content: SECTION_BODY } }] };
  });
}

describe('parseArticleCliOptions', () => {
  it('count를 1..3으로 clamp하고 파싱', () => {
    expect(parseArticleCliOptions(['--count', '3']).count).toBe(3);
    expect(parseArticleCliOptions(['--count', '99']).count).toBe(3);
    expect(parseArticleCliOptions(['--count', '0']).count).toBe(1);
    expect(parseArticleCliOptions([]).count).toBe(3); // 기본 3
  });
  it('알 수 없는 카테고리는 throw', () => {
    expect(() => parseArticleCliOptions(['--category', 'nope'])).toThrow(/Unknown category/);
  });
});

describe('toSources', () => {
  it('리서치 아이템을 {title,url}로 전량 매핑', () => {
    const out = toSources([
      { title: 'A', description: 'd', link: 'https://a.com' },
      { title: 'B', description: 'd', link: 'https://b.com' },
    ]);
    expect(out).toEqual([
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: 'https://b.com' },
    ]);
  });
});

describe('buildArticleInternalLinks', () => {
  beforeEach(() => { mockArticleFindMany.mockReset().mockResolvedValue([]); });
  it('/article/ 경로로 내부링크 생성 (/guide 아님)', async () => {
    mockArticleFindMany.mockResolvedValue([{ slug: 'pharmacy-x', title: '다른 이슈' }]);
    const md = await buildArticleInternalLinks('pharmacy', 'pharmacy-cur');
    expect(md).toContain('/article/pharmacy-x');
    expect(md).not.toContain('/guide/');
  });
});

describe('generateOneArticle — happy path', () => {
  beforeEach(() => {
    mockFetch.mockReset(); mockChatCreate.mockReset(); mockImageGenerate.mockReset();
    mockArticleCreate.mockReset(); mockArticleFindMany.mockReset().mockResolvedValue([]);
    mockArticleFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindMany.mockReset().mockResolvedValue([]);
  });

  it('draft 상태(status:draft, publishedAt:null)로 저장', async () => {
    setupNaver([{ title: '관련 뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockResolvedValue({ data: [{ b64_json: Buffer.from('x').toString('base64') }] });
    mockArticleCreate.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));

    const result = await generateOneArticle({ category: 'pharmacy', topic: '야간 약국 운영' });

    expect(result.category).toBe('pharmacy');
    expect(result.slug).toMatch(/^pharmacy-/);
    expect(mockArticleCreate).toHaveBeenCalledOnce();
    const arg = mockArticleCreate.mock.calls[0][0].data;
    expect(arg.status).toBe('draft');
    expect(arg.publishedAt).toBeNull();
    expect(arg.articleType).toBe('news-brief');
    expect(Array.isArray(arg.sources)).toBe(true);
    expect(arg.thumbnailUrl).toMatch(/^\/api\/images\/articles\//);
  });

  it('slug가 Guide와 충돌하면 새 slug 재발급', async () => {
    setupNaver([{ title: '뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockResolvedValue({ data: [{ b64_json: Buffer.from('x').toString('base64') }] });
    // 첫 slug는 guide에 존재, 두 번째는 없음
    mockGuideFindUnique.mockResolvedValueOnce({ id: 'g1' }).mockResolvedValue(null);
    mockArticleCreate.mockImplementation(async ({ data }: any) => ({ id: 'a2', ...data }));

    await generateOneArticle({ category: 'toilet', topic: '개방화장실' });
    expect(mockGuideFindUnique).toHaveBeenCalled(); // 교차 테이블 확인함
    expect(mockArticleCreate).toHaveBeenCalledOnce();
  });

  it('썸네일 생성 실패 시 throw하고 저장 스킵', async () => {
    setupNaver([{ title: '뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockRejectedValue(new Error('image fail'));
    await expect(generateOneArticle({ category: 'pharmacy', topic: '야간 약국' }))
      .rejects.toThrow(/썸네일/);
    expect(mockArticleCreate).not.toHaveBeenCalled();
  });

  it('OPENAI_API_KEY 없으면 throw', async () => {
    const k = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
    await expect(generateOneArticle({ category: 'toilet', topic: 't' })).rejects.toThrow(/OPENAI_API_KEY/);
    process.env.OPENAI_API_KEY = k;
  });
});
