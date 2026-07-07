import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockChatCreate } = vi.hoisted(() => ({ mockChatCreate: vi.fn() }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));
// 코어는 prisma를 import하므로 최소 stub (이 테스트에선 미사용)
vi.mock('../../src/lib/prisma.js', () => ({ default: {} }));

import OpenAI from 'openai';
import {
  POLICY_FOCUS_CATEGORIES,
  formatPolicyContext,
  formatApproveDate,
  selectPolicyCandidate,
  generateArticleMeta,
} from '../../src/services/articleGenerationCore.js';
import type { PolicyNewsItem } from '../../src/services/policyBriefingClient.js';

const ITEM: PolicyNewsItem = {
  newsItemId: 'P1001',
  title: '청약제도 개편안 발표',
  subTitle: '무주택 실수요자 중심',
  ministerCode: '1741000',
  dataContents: '국토교통부는 특별공급을 확대한다. 신혼부부 물량이 늘어난다.',
  approveDate: '20260705',
  originalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
  thumbnailUrl: '',
};

describe('POLICY_FOCUS_CATEGORIES', () => {
  it('생활정보 전반(부동산·주거·육아 + 의료·환경·교육·생활편의) 13종', () => {
    expect(POLICY_FOCUS_CATEGORIES).toEqual([
      'subscription', 'apt-sale', 'apt-rent', 'childcare',
      'hospital', 'pharmacy', 'park', 'trash',
      'school', 'library', 'market', 'ev-charger', 'sports',
    ]);
  });
});

describe('formatApproveDate', () => {
  it('MM/DD/YYYY(실제 API) 파싱', () => {
    expect(formatApproveDate('06/30/2026 14:58:00')).toBe('2026년 6월 30일');
  });
  it('YYYYMMDD 파싱', () => {
    expect(formatApproveDate('20260705')).toBe('2026년 7월 5일');
  });
  it('알 수 없는 형식은 빈 문자열', () => {
    expect(formatApproveDate('')).toBe('');
  });
});

describe('formatPolicyContext', () => {
  it('원문 전문 + 발표일 앵커 + 연도 임의생성 금지 규칙', () => {
    const ctx = formatPolicyContext(ITEM);
    expect(ctx).toContain('[정책 원문]');
    expect(ctx).toContain('국토교통부는 특별공급을 확대한다');
    expect(ctx).toContain('임의로 만들지 마세요');
    expect(ctx).toContain('발표일: 2026년 7월 5일');
    expect(ctx).toContain('원문에 없는 연도·시행일·유효기간을 지어내지 마세요');
    expect(ctx).toContain('내년');
    expect(ctx).toContain('정책브리핑');
  });
});

describe('selectPolicyCandidate', () => {
  beforeEach(() => mockChatCreate.mockReset());
  const openai = new OpenAI({ apiKey: 'test' });

  it('유효 응답이면 후보 반환', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 0, category: 'subscription', keyword: '청약 특별공급 개편' }) } }] });
    const out = await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES);
    expect(out).not.toBeNull();
    expect(out!.category).toBe('subscription');
    expect(out!.item.newsItemId).toBe('P1001');
    expect(out!.keyword).toBe('청약 특별공급 개편');
  });

  it('none:true면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ none: true }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('포커스 밖 카테고리면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 0, category: 'toilet', keyword: 'x 정책' }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('index 범위 밖이면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 9, category: 'subscription', keyword: 'x 정책' }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('빈 목록이면 null', async () => {
    expect(await selectPolicyCandidate(openai, [], POLICY_FOCUS_CATEGORIES)).toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('프롬프트가 시설이 아닌 생활 주제로 묻고 억지 매칭을 금지한다', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 0, category: 'apt-sale', keyword: '투기과열지구 지정' }) } }] });
    await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES);
    const sent = String(mockChatCreate.mock.calls[0][0].messages[0].content);
    expect(sent).toContain('생활 주제');
    expect(sent).toContain('억지');
    expect(sent).toContain('아파트매매·부동산시장'); // 도메인 설명 사용 확인
  });
});

describe('generateArticleMeta — 제목 규칙 강화', () => {
  beforeEach(() => mockChatCreate.mockReset());
  const openai = new OpenAI({ apiKey: 'test' });

  it('프롬프트에 title-rules(관심유발·과장금지)가 포함된다', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      title: '테스트 제목입니다 스무자 이상으로 작성',
      summary: '테스트 요약입니다. 50자 이상의 요약 텍스트를 채워 넣습니다 채워요.',
      keywords: 'a, b, c',
      sections: [{ heading: '핵심 요약', description: 'x' }, { heading: '참고 자료', description: 'y' }],
    }) } }] });

    await generateArticleMeta(openai, 'subscription', '청약 개편', '[정책 원문] ...', '');

    const sentPrompt = String(mockChatCreate.mock.calls[0][0].messages[0].content);
    expect(sentPrompt).toContain('title-rules');
    expect(sentPrompt).toContain('낚시');
  });
});
