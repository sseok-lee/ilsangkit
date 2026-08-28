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
  /**
   * 새로 받지 못해 직전 생성본을 그대로 재사용한 파일들.
   * 비어있지 않으면 "부분 갱신" — 호출부는 이를 조용히 성공으로 처리하면 안 된다.
   */
  carriedForward: string[]
  /**
   * SITEMAP_FORCE_SWAP=1 로 개수 회귀 가드를 무시하고 스왑했는가.
   * true 면 `ok` 는 true 지만 `regressions` 에 무시한 항목이 남아 있다 —
   * 호출부는 "성공했으나 사람이 가드를 껐다"로 읽어야 한다.
   */
  forced?: boolean
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
  const fail = (error: string): GenerationResult => ({ ok: false, regressions: [], carriedForward: [], error })

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
  //
  // 자식 1건이 최종 실패해도 전체를 버리지 않는다. 직전 생성본이 디스크에 있으면 그것을
  // 이월(carry-forward)하고 나머지는 갱신한다. 이월할 파일조차 없으면(첫 실행 등) 어쩔 수 없이
  // 중단한다 — 없는 파일을 지어낼 수는 없다.
  // 배경: 2026-07-22~27 real-estate-2.xml 하나의 503 때문에 78개 파일이 5일간 얼어붙었다.
  const carriedForward: string[] = []
  for (const loc of parseChildLocs(indexXml)) {
    const rel = locToRelPath(loc)
    const child = await fetchXmlWithRetry(`${opts.base}${new URL(loc).pathname}`)
    if (child.ok) {
      nextCounts[rel] = countLocs(child.body)
      files.push({ rel, body: child.body })
    } else {
      let previous: string
      try {
        previous = await readFile(join(opts.dir, rel), 'utf-8')
      } catch {
        await rm(tmp, { recursive: true, force: true })
        return fail(`child fetch failed ${rel}: ${child.status} (이월할 직전 생성본 없음)`)
      }
      // 이월본의 개수를 그대로 기록해야 다음 실행에서 회귀로 오인되지 않는다.
      nextCounts[rel] = countLocs(previous)
      files.push({ rel, body: previous })
      carriedForward.push(rel)
      console.warn(`[generateSitemaps] ${rel}: fetch 실패(${child.status}) — 직전 생성본 이월`)
    }
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
  let guard = evaluateCountGuard(oldCounts, nextCounts, opts.threshold)
  let forced = false

  if (!guard.ok && force) {
    // 사람이 의도적 대량 변경(예: 고아 URL 301 정리로 상세가 수천 건 빠짐)임을 알고 켠 우회로.
    // 가드를 건너뛰되 무시한 회귀는 결과에 남긴다.
    //
    // 종전에는 아래 블록을 `!guard.ok && !force` 로 건너뛰기만 하고 guard.ok 를 재계산하지
    // 않아, 스왑에 성공하고도 ok:false 를 반환했다. CLI 가 그걸 exit 2(거부·실패)로 매핑해
    // 파일은 정상 교체됐는데 워크플로는 "실패/거부 — 기존 sitemap 유지"로 끝났다
    // (2026-08-28 run 33132457088: hospital-9 879·school-2 4214 로 실제 스왑됨).
    // 강제 실행이 늘 빨간불이면 진짜 실패와 구분이 안 된다.
    forced = true
    console.warn(
      `[generateSitemaps] FORCE — 개수 회귀 ${guard.regressions.length}건을 무시하고 스왑: ${JSON.stringify(guard.regressions)}`,
    )
    guard = { ...guard, ok: true }
  }

  if (!guard.ok) {
    // 자식이 200 이어도 URL 이 0/급감으로 올 수 있다. 프론트 fetch 헬퍼가 upstream 실패를
    // catch 해서 빈 배열을 반환하기 때문이다(2026-07-27 재생성 실패의 실제 원인).
    // 이 경로는 child.ok=true 라 위의 이월이 발동하지 않으므로 여기서 한 번 더 막는다.
    // 회귀한 파일만 직전 생성본으로 되돌리고 나머지는 갱신한다.
    for (const r of guard.regressions) {
      try {
        const previous = await readFile(join(opts.dir, r.file), 'utf-8')
        await writeFile(join(tmp, r.file), previous, 'utf-8')
        nextCounts[r.file] = countLocs(previous)
        if (!carriedForward.includes(r.file)) carriedForward.push(r.file)
        console.warn(`[generateSitemaps] ${r.file}: 개수 급감(${r.old}→${r.next}) — 직전 생성본 이월`)
      } catch {
        // 이월할 파일이 없다 — 아래 재평가에서 회귀로 남아 전체가 거부된다.
      }
    }
    guard = evaluateCountGuard(oldCounts, nextCounts, opts.threshold)
    if (!guard.ok) {
      await rm(tmp, { recursive: true, force: true })
      return { ...guard, carriedForward, forced }
    }
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

  return { ...guard, carriedForward, forced }
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
      if (r.forced) {
        // 사람이 가드를 껐고 스왑은 됐다 → 성공(exit 0). 다만 무엇을 덮었는지는 남긴다.
        // 종전에는 이 경우가 exit 2 로 떨어져 워크플로가 빨간불이었고, 파일이 실제로
        // 바뀌었는지 로그만 보고는 알 수 없었다.
        console.warn(
          `[generateSitemaps] 강제 스왑 — 개수 회귀 ${r.regressions.length}건 무시: ${JSON.stringify(r.regressions)}`,
        )
      }
      if (r.carriedForward.length > 0) {
        // 스왑은 됐지만 일부는 갱신되지 않았다. 호출부(배포 워크플로)가 성공과 구분할 수 있도록
        // 별도 종료 코드를 쓴다 — 조용히 넘어가면 이번 사고처럼 며칠간 아무도 모른다.
        console.error(
          `[generateSitemaps] 부분 갱신 — ${r.carriedForward.length}개 파일이 직전 생성본으로 이월됨: ${r.carriedForward.join(', ')}`,
        )
        process.exit(4)
      }
      console.log('[generateSitemaps] 완료 — 디스크 sitemap 갱신')
    })
    .catch((err) => {
      console.error('[generateSitemaps] 예외 — 기존 sitemap 유지:', err?.message || err)
      process.exit(3)
    })
}
