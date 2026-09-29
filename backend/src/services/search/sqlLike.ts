export function escapeSqlLikeKeyword(keyword: string): string {
  return keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function containsSqlLikeKeyword(keyword: string): string {
  return `%${escapeSqlLikeKeyword(keyword)}%`;
}
