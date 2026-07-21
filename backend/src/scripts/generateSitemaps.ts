import { mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'

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

type FetcherResponse = { ok: boolean; status: number; text: () => Promise<string> }
type Fetcher = (url: string, headers: Record<string, string>) => Promise<FetcherResponse>

export interface GenerationOptions {
  dir: string
  base: string
  token: string
  threshold: number
  fetcher?: Fetcher
  /** 재시도 백오프·자식 간 지연용. 테스트에서 no-op 주입해 즉시 실행. 기본은 실제 setTimeout. */
  sleep?: (ms: number) => Promise<void>
}

export interface GenerationResult extends CountGuardResult {
  error?: string
}

const REGEN_TOKEN_HEADER = 'X-Sitemap-Regen-Token'

/** loc URL → SITEMAP_DIR 기준 상대 파일 경로. https://host/sitemap/toilet.xml → sitemap/toilet.xml */
function locToRelPath(loc: string): string {
  return new URL(loc).pathname.replace(/^\/+/, '')
}

// fetch의 .text()는 본문을 완전히 버퍼링하므로, 여기선 HTML 에러 페이지(<!DOCTYPE/<html)를 거른다
function isValidXml(body: string): boolean {
  return body.trimStart().startsWith('<?xml')
}

export async function runGeneration(opts: GenerationOptions): Promise<GenerationResult> {
  const fetcher: Fetcher = opts.fetcher ?? ((url, headers) => fetch(url, { headers }))
  const headers = { [REGEN_TOKEN_HEADER]: opts.token }
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const fail = (error: string): GenerationResult => ({ ok: false, regressions: [], error })

  const tmp = `${opts.dir}.tmp`
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })

  // 무거운 사이트맵(real-estate-N, region-categories 등)은 생성 크롤 중 DB 부하로
  // 간헐 503/타임아웃이 난다. 첫 실패에 전체를 중단하지 않고 백오프 재시도로 흡수한다.
  const MAX_FETCH_RETRIES = 4
  const fetchXmlWithRetry = async (url: string): Promise<{ ok: boolean; status: number; body: string }> => {
    let lastStatus = 0
    for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
      try {
        const res = await fetcher(url, headers)
        if (res.ok) {
          const body = await res.text()
          if (isValidXml(body)) return { ok: true, status: res.status, body }
          lastStatus = res.status // 200이지만 XML 아님(에러 페이지) — 재시도
        } else {
          lastStatus = res.status
        }
      } catch {
        lastStatus = 0
      }
      if (attempt < MAX_FETCH_RETRIES) await sleep(1000 * 2 ** (attempt - 1))
    }
    return { ok: false, status: lastStatus, body: '' }
  }

  // 1) 인덱스
  const idx = await fetchXmlWithRetry(`${opts.base}/sitemap.xml`)
  if (!idx.ok) { await rm(tmp, { recursive: true, force: true }); return fail(`index fetch failed: ${idx.status}`) }
  const indexXml = idx.body

  const nextCounts: Record<string, number> = { 'sitemap.xml': countLocs(indexXml) }
  const files: { rel: string; body: string }[] = [{ rel: 'sitemap.xml', body: indexXml }]

  // 2) 자식들 — 순차(동시성 1)
  for (const loc of parseChildLocs(indexXml)) {
    const rel = locToRelPath(loc)
    const child = await fetchXmlWithRetry(`${opts.base}${new URL(loc).pathname}`)
    if (!child.ok) { await rm(tmp, { recursive: true, force: true }); return fail(`child fetch failed ${rel}: ${child.status}`) }
    nextCounts[rel] = countLocs(child.body)
    files.push({ rel, body: child.body })
    // 무거운 쿼리 연속 타격으로 DB 풀이 소진되지 않게 자식 간 소폭 지연
    await sleep(150)
  }

  // 3) tmp에 기록
  for (const f of files) {
    const dest = join(tmp, f.rel)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, f.body, 'utf-8')
  }

  // 4) 개수 회귀 가드
  let oldCounts: Record<string, number> = {}
  try {
    oldCounts = JSON.parse(await readFile(join(opts.dir, '.counts.json'), 'utf-8'))
  } catch { /* 첫 실행 */ }

  const force = process.env.SITEMAP_FORCE_SWAP === '1'
  const guard = evaluateCountGuard(oldCounts, nextCounts, opts.threshold)
  if (!guard.ok && !force) {
    await rm(tmp, { recursive: true, force: true })
    return guard
  }

  await writeFile(join(tmp, '.counts.json'), JSON.stringify(nextCounts, null, 2), 'utf-8')

  // 5) 교체: dir → dir.old → 삭제, tmp → dir.
  // 각 rename은 atomic이나 두 rename 사이에 dir이 잠깐 사라지는 창이 있다.
  // 그 창에 들어온 요청은 reader가 동적 폴백으로 강등하므로 안전하다(완전 atomic 아님).
  const old = `${opts.dir}.old`
  await rm(old, { recursive: true, force: true })
  let movedAside = false
  try {
    await rename(opts.dir, old)
    movedAside = true
  } catch { /* dir 없음(첫 실행) */ }
  try {
    await rename(tmp, opts.dir)
  } catch (swapErr) {
    if (movedAside) { try { await rename(old, opts.dir) } catch { /* swallow */ } }
    throw swapErr
  }
  await rm(old, { recursive: true, force: true })

  return guard
}

// --- CLI 엔트리 ---
const isMain = process.argv[1] && process.argv[1].endsWith('generateSitemaps.js')
if (isMain) {
  const dir = process.env.SITEMAP_DIR
  const token = process.env.SITEMAP_REGEN_TOKEN
  const base = process.env.SITEMAP_REGEN_BASE || 'http://127.0.0.1:3000'
  const threshold = Number(process.env.SITEMAP_COUNT_DROP_THRESHOLD || '0.2')
  if (!dir || !token) {
    console.error('[generateSitemaps] SITEMAP_DIR / SITEMAP_REGEN_TOKEN 필요 — 생성 생략')
    process.exit(1)
  }
  runGeneration({ dir, token, base, threshold })
    .then((r) => {
      if (!r.ok) {
        console.error('[generateSitemaps] 실패/거부 — 기존 sitemap 유지:', r.error || JSON.stringify(r.regressions))
        process.exit(2)
      }
      console.log('[generateSitemaps] 완료 — 디스크 sitemap 갱신')
    })
    .catch((err) => {
      console.error('[generateSitemaps] 예외 — 기존 sitemap 유지:', err?.message || err)
      process.exit(3)
    })
}
