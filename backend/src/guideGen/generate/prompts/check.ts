export const CHECK_SYSTEM_PROMPT = `당신은 일상킷 편집 검수자다.
입력으로 받은 본문 마크다운과 원문 본문을 비교해 두 가지만 확인한다.
1. 본문에 원문에 없는 단정(특히 수치/일정/조건/대상)이 있는가? (noUnsupported)
2. 첫 섹션에서 결론이 바로 보이는가? (conclusionFirst)
출력 JSON:
{
  "noUnsupported": { "passed": true|false, "locations": ["..."] },
  "conclusionFirst": { "passed": true|false }
}
`;

export function buildCheckUserPrompt(input: {
  draft: string;
  sourceContent: string;
}): string {
  return [
    '원문:',
    input.sourceContent,
    '',
    '본문(마크다운):',
    input.draft,
  ].join('\n');
}
