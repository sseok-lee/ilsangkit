import type { FactsJson, PlanJson } from '../types.js';
import { BANNED_PHRASES } from '../../shared/bannedPhrases.js';

export const DRAFT_SYSTEM_PROMPT = `당신은 일상킷 편집팀의 기자다.
독자에게 결론을 먼저 제시하고, 짧은 문장으로 작성한다. 한 문단은 2~4문장.
입력으로 받은 facts/numbers/dates에 있는 내용만 본문에 쓴다. 그 외 수치·일정·조건은 절대 만들지 않는다.
plan의 sections 순서와 intent를 따른다. factsRefs에 명시된 fact만 해당 섹션에서 사용한다.
마지막 섹션은 항상 "## 참고 자료"이며 sourceUrl과 발표일을 표시한다.
다음 표현은 사용하지 않는다:
${BANNED_PHRASES.map((p) => `- "${p}"`).join('\n')}
출력은 순수 마크다운만. 코드펜스로 감싸지 않는다.`;

export function buildDraftUserPrompt(input: {
  facts: FactsJson;
  plan: PlanJson;
  retryFeedback?: string;
}): string {
  const parts = [
    'plan.json:',
    JSON.stringify(input.plan, null, 2),
    '',
    'facts.json:',
    JSON.stringify(input.facts, null, 2),
  ];
  if (input.retryFeedback) {
    parts.push('', '직전 시도에서 발견된 문제 (반드시 수정):', input.retryFeedback);
  }
  return parts.join('\n');
}
