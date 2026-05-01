export const LINE_COLORS: Record<string, string> = {
  '1호선': '#0052A4', '2호선': '#00A84D', '3호선': '#EF7C1C', '4호선': '#00A5DE',
  '5호선': '#996CAC', '6호선': '#CD7C2F', '7호선': '#747F00', '8호선': '#E6186C',
  '9호선': '#BDB092', '신분당선': '#D4003B', '경의중앙선': '#77C4A3', '공항철도': '#0090D2',
  '경춘선': '#0C8E72', '수인분당선': '#F5A200', 'GTX-A': '#9E5D45',
}

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? '#64748b'
}
