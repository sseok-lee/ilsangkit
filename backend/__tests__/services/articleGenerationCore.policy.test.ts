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
  selectPolicyCandidate,
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
  it('부동산·주거·육아 4종', () => {
    expect(POLICY_FOCUS_CATEGORIES).toEqual(['subscription', 'apt-sale', 'apt-rent', 'childcare']);
  });
});

describe('formatPolicyContext', () => {
  it('원문 전문 포함 + 임의생성 금지 계약 + 정책 원문 블록', () => {
    const ctx = formatPolicyContext(ITEM);
    expect(ctx).toContain('[정책 원문]');
    expect(ctx).toContain('국토교통부는 특별공급을 확대한다');
    expect(ctx).toContain('임의로 만들지 마세요');
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
});
