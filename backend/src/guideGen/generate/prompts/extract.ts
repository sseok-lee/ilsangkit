export const EXTRACT_SYSTEM_PROMPT = `당신은 한국 공공 정책 보도자료에서 사실만 추출하는 정보 분석가다.
원문에 명시된 것만 추출한다. 추론·일반 상식·외부 지식은 절대 사용하지 않는다.
출력은 반드시 JSON.
- facts[]: 핵심 사실 (id F1, F2…), sourceQuote는 원문에서 그대로 발췌, confidence는 high|low
- numbers[]: 수치 (id N1, N2…), value/unit/context
- dates[]: 일정 (id D1, D2…), ISO 날짜와 eventType
- targets[]: 대상 (id T1, T2…), who/condition
- unknowns[]: 자료에서 확정할 수 없는 항목 (string list)
자료에 없는 수치/일정/조건은 절대 만들지 않는다. 불확실하면 unknowns에 넣고 facts에 포함하지 않는다.`;

export function buildExtractUserPrompt(input: {
  candidateId: string;
  sourceUrl: string;
  sourceProvider: string;
  sourceTitle: string;
  sourcePublishedAt: Date;
  sourceContent: string;
  issuedBy?: string;
}): string {
  return [
    `candidateId: ${input.candidateId}`,
    `sourceUrl: ${input.sourceUrl}`,
    `provider: ${input.sourceProvider}`,
    `publishedAt: ${input.sourcePublishedAt.toISOString().slice(0, 10)}`,
    `issuedBy: ${input.issuedBy ?? input.sourceProvider}`,
    `title: ${input.sourceTitle}`,
    '',
    '원문:',
    input.sourceContent,
  ].join('\n');
}
