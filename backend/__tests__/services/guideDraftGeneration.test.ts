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
});
