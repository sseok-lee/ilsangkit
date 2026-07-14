import { describe, it, expect, vi } from 'vitest';
import { validateGuideDraftStructure, generateGuideDraft } from '../../src/services/guideDraftGeneration.js';

// 프론트(/guide/[slug].vue)가 실제로 쓰는 정규식 — 반드시 여기서 파싱돼야 JSON-LD 점등
const FAQ_RE = /\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([\s\S]*?)(?=\n\*\*Q\.|$)/g;
const STEP_RE = /\d+\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\d+\.\s*\*\*|$)/g;

const HOWTO_MD = [
  '## 개요',
  '공영주차장 요금을 아끼는 방법을 안내합니다. '.repeat(40),
  '',
  '## 단계별 방법',
  '',
  '1. **앱 설치하기**',
  '   지자체 주차 앱을 설치합니다.',
  '',
  '2. **차량 등록하기**',
  '   차량 번호를 등록합니다.',
  '',
  '3. **할인 신청하기**',
  '   경차·다자녀 할인을 신청합니다.',
  '',
  '## 자주 묻는 질문',
  '',
  '**Q. 무료 시간이 있나요?**',
  'A. 지자체별로 최초 30분 무료가 있습니다.',
  '',
  '**Q. 경차 할인은?**',
  'A. 대부분 50% 감면됩니다.',
  '',
  '**Q. 정기권도 있나요?**',
  'A. 월 정기권을 운영합니다.',
].join('\n');

describe('validateGuideDraftStructure', () => {
  it('howto는 단계별 방법 + FAQ 둘 다 필요', () => {
    const r = validateGuideDraftStructure(HOWTO_MD, 'howto');
    expect(r.valid, r.errors.join('; ')).toBe(true);
  });
  it('howto에서 단계별 방법 없으면 실패', () => {
    const noSteps = HOWTO_MD.replace('## 단계별 방법', '## 방법');
    expect(validateGuideDraftStructure(noSteps, 'howto').valid).toBe(false);
  });
  it('FAQ 섹션 없으면 실패', () => {
    const noFaq = HOWTO_MD.split('## 자주 묻는 질문')[0];
    expect(validateGuideDraftStructure(noFaq, 'howto').valid).toBe(false);
  });
  it('너무 짧으면 실패', () => {
    expect(validateGuideDraftStructure('## 자주 묻는 질문\n\n**Q. a**\nA. b', 'guide').valid).toBe(false);
  });
  it('howto에서 단계별 방법 섹션의 단계가 2개뿐이면 실패', () => {
    // HOWTO_MD의 3번째 단계("3. **할인 신청하기**" 블록)를 제거해 단계 2개만 남긴다
    const twoSteps = HOWTO_MD.replace(
      '\n\n3. **할인 신청하기**\n   경차·다자녀 할인을 신청합니다.',
      ''
    );
    const r = validateGuideDraftStructure(twoSteps, 'howto');
    expect(r.valid).toBe(false);
    expect(r.errors.join('; ')).toMatch(/단계별 방법/);
  });
  it('섹션-스코프 카운트: FAQ 섹션 밖의 가짜 Q/A는 세지 않는다', () => {
    // "## 개요" 섹션에 가짜 Q/A 하나를 끼워 넣는다 — 구버전(전체 문서 카운트)은
    // 이걸 포함해 3개로 세서 valid였겠지만, 신버전은 FAQ 섹션 안의 2개만 세야 한다
    const withStrayQaInOverview = HOWTO_MD.replace(
      '## 개요',
      '## 개요\n\n**Q. 가짜?**\nA. 가짜.\n'
    ).replace(
      '**Q. 정기권도 있나요?**\nA. 월 정기권을 운영합니다.',
      ''
    );
    const r = validateGuideDraftStructure(withStrayQaInOverview, 'howto');
    expect(r.valid).toBe(false);
    expect(r.errors.join('; ')).toMatch(/FAQ/);
  });
});

describe('generateGuideDraft (OpenAI mock)', () => {
  it('생성 결과가 프론트 정규식으로 파싱된다(FAQ≥3, 단계≥3)', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn()
            // 1st call = meta(json_object)
            .mockResolvedValueOnce({
              choices: [{ message: { content: JSON.stringify({
                title: '공영주차장 무료·할인 요금 받는 법',
                summary: '공영주차장 요금을 아끼는 실전 방법을 단계별로 안내합니다. 경차·다자녀 할인까지 정리했습니다.',
                keywords: '공영주차장, 주차요금, 할인, 경차, 거주자우선주차',
              }) } }],
            })
            // 2nd call = body(markdown)
            .mockResolvedValueOnce({ choices: [{ message: { content: HOWTO_MD } }] }),
        },
      },
    } as unknown as import('openai').default;

    const res = await generateGuideDraft(openai, {
      category: 'parking', topic: '공영주차장 무료·할인 요금 받는 법', articleType: 'howto',
    });

    expect(res.title).toBeTruthy();
    expect(res.summary).toBeTruthy();
    const faqs = [...res.content.matchAll(FAQ_RE)];
    const steps = [...res.content.matchAll(STEP_RE)];
    expect(faqs.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('제목에 연도가 포함되면 에버그린 위반으로 throw한다', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
              title: '2026년 공영주차장 할인 받는 법',
              summary: '공영주차장 요금을 아끼는 실전 방법을 단계별로 안내합니다.',
              keywords: '공영주차장, 주차요금, 할인',
            }) } }],
          }),
        },
      },
    } as unknown as import('openai').default;

    await expect(
      generateGuideDraft(openai, {
        category: 'parking', topic: '공영주차장 무료·할인 요금 받는 법', articleType: 'howto',
      })
    ).rejects.toThrow(/year|연도/);
  });

  it('본문이 처음 검증 실패해도 재시도로 통과한다', async () => {
    const create = vi.fn()
      // meta
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        title: '공영주차장 할인 받는 법', summary: '요약입니다.', keywords: 'a, b, c',
      }) } }] })
      // 1st body attempt = invalid(짧고 FAQ/단계 없음)
      .mockResolvedValueOnce({ choices: [{ message: { content: '## 개요\n짧은 본문' } }] })
      // 2nd body attempt = valid
      .mockResolvedValueOnce({ choices: [{ message: { content: HOWTO_MD } }] });
    const openai = { chat: { completions: { create } } } as unknown as import('openai').default;

    const res = await generateGuideDraft(openai, { category: 'parking', topic: 't', articleType: 'howto' });
    expect(res.content).toContain('## 단계별 방법');
    expect(create).toHaveBeenCalledTimes(3); // meta + 2 body attempts
  });

  it('3회 재시도 모두 실패하면 throw한다', async () => {
    const invalidBody = { choices: [{ message: { content: '## 개요\n짧은 본문' } }] };
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        title: '공영주차장 할인 받는 법', summary: '요약입니다.', keywords: 'a, b, c',
      }) } }] })
      .mockResolvedValueOnce(invalidBody)
      .mockResolvedValueOnce(invalidBody)
      .mockResolvedValueOnce(invalidBody);
    const openai = { chat: { completions: { create } } } as unknown as import('openai').default;

    await expect(
      generateGuideDraft(openai, { category: 'parking', topic: 't', articleType: 'howto' })
    ).rejects.toThrow(/3 attempts/);
    expect(create).toHaveBeenCalledTimes(4); // meta + 3 body attempts
  });

  it('§5-8: 메타·본문 프롬프트에 해요체·상투어 금지 규칙이 포함된다', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        title: '공영주차장 무료·할인 요금 받는 법',
        summary: '요약입니다.', keywords: 'a, b, c',
      }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: HOWTO_MD } }] });
    const openai = { chat: { completions: { create } } } as unknown as import('openai').default;

    await generateGuideDraft(openai, { category: 'parking', topic: 't', articleType: 'howto' });

    const metaPrompt = String(create.mock.calls[0][0].messages[0].content);
    const bodyPrompt = String(create.mock.calls[1][0].messages[0].content);
    expect(metaPrompt).toContain('해요체');    // generateGuideMeta summary 규칙 (편집#4)
    expect(bodyPrompt).toContain('해요체');     // generateGuideBody 규칙 (편집#3)
    expect(bodyPrompt).toContain('살펴봅니다'); // 상투어 금지
  });
});
