/** sitemapindex XML에서 자식 sitemap의 <loc> URL 목록 추출 */
export function parseChildLocs(indexXml: string): string[] {
  const locs: string[] = []
  const re = /<loc>([^<]+)<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(indexXml)) !== null) {
    locs.push(m[1].trim())
  }
  return locs
}

/** urlset/sitemapindex XML의 <loc> 개수 */
export function countLocs(xml: string): number {
  const matches = xml.match(/<loc>/g)
  return matches ? matches.length : 0
}

export interface CountGuardResult {
  ok: boolean
  regressions: { file: string; old: number; next: number }[]
}

/**
 * 직전 생성본(old) 대비 새 생성본(next)이 특정 파일에서 threshold 이상 급감하거나
 * old에 있던 파일이 사라지면 거부한다. old에 없던 신규 파일은 통과.
 */
export function evaluateCountGuard(
  oldCounts: Record<string, number>,
  nextCounts: Record<string, number>,
  threshold: number,
): CountGuardResult {
  const regressions: { file: string; old: number; next: number }[] = []
  for (const [file, old] of Object.entries(oldCounts)) {
    const next = nextCounts[file] ?? 0
    if (next < old * (1 - threshold)) {
      regressions.push({ file, old, next })
    }
  }
  return { ok: regressions.length === 0, regressions }
}
