import type { FactsJson } from '../types.js';

export const PLAN_SYSTEM_PROMPT = `당신은 일상킷 정보 아티클의 구조를 결정하는 편집장이다.
입력으로 받은 facts/numbers/dates/targets/unknowns만 사용해 글의 articleType, 섹션 구조, 슬러그를 정한다.

articleType은 다음 중 하나: news-brief | policy-explainer | living-impact | data-update | how-to-check
mix 비율이 있다면 typeMix에 표기.
각 섹션은 heading/intent/factsRefs를 가진다. factsRefs는 facts.json에 존재하는 id만 사용.
internalLinks는 입력으로 받은 allowedPaths에서만 선택.
slug는 ASCII kebab-case, 영어 또는 로마자.
JSON 출력만.`;

export function buildPlanUserPrompt(input: {
  facts: FactsJson;
  category: string;
  allowedPaths: readonly string[];
}): string {
  return [
    `category: ${input.category}`,
    `allowedPaths: ${JSON.stringify(input.allowedPaths)}`,
    '',
    'facts.json:',
    JSON.stringify(input.facts, null, 2),
  ].join('\n');
}
