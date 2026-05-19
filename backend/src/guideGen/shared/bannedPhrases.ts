export const BANNED_PHRASES: readonly string[] = [
  '많은 분들이 궁금해합니다',
  '꼼꼼히 확인해보세요',
  '도움이 되셨길 바랍니다',
  '반드시 혜택을 받을 수 있습니다',
  '지금 바로 신청하세요',
  '자세한 내용은 검색해보세요',
  '최근에',
  '현재는',
  '오늘 기준',
  '곧 시행됩니다',
  '조만간',
];

export function findBannedPhrases(text: string): string[] {
  const hits = new Set<string>();
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) hits.add(phrase);
  }
  return Array.from(hits);
}
