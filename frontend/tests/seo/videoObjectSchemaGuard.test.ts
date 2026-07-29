import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * VideoObject 구조화 데이터 재도입 방지 가드.
 *
 * 페이지에 없는 콘텐츠를 구조화 데이터로 주장하는 것은 Google 구조화 데이터 정책
 * 위반이다. 시설 상세는 관련 영상 섹션을 onMounted + IntersectionObserver 로만
 * 가져오므로 SSR HTML 에는 영상이 0건인데, 스키마는 SSR 에서 발행되고 있었다.
 *
 * 2026-07-29 실측 — /childcare/childcare-29110000026 raw SSR HTML:
 *   VideoObject 6건 / <iframe> 0개 / 본문 'youtube' 0회
 *
 * 매칭도 시설명 키워드 검색이라 무관한 영상이 붙었다(인형놀이 브이로그, 고양이 채널).
 *
 * 다시 넣으려면 영상을 SSR 로 실제 렌더하고 관련성을 검증한 뒤에 해야 한다.
 * 이 가드는 그 전제 없이 스키마만 부활하는 것을 막는다.
 */

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const APP_DIRS = ['pages', 'composables', 'components', 'utils', 'plugins', 'middleware', 'layouts']
const SOURCE_EXT = /\.(ts|vue)$/

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc // 해당 디렉터리가 없으면 건너뛴다
  }
  for (const entry of entries) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      collectSourceFiles(full, acc)
    } else if (SOURCE_EXT.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      acc.push(full)
    }
  }
  return acc
}

// 주석에서 이 결정을 설명하는 산문(“VideoObject 스키마를 제거했다”)까지 잡으면
// 가드가 문서화를 막는다. 실제 발행 코드만 매칭한다 —
// @type 키에 VideoObject 를 넣는 리터럴, 그리고 함수 호출 형태.
const EMIT_PATTERN = /['"]@type['"]\s*:\s*['"]VideoObject['"]/
const CALL_PATTERN = /setVideoListSchema\s*\(/

function scan(pattern: RegExp): string[] {
  const offenders: string[] = []
  for (const dir of APP_DIRS) {
    for (const file of collectSourceFiles(resolve(frontendRoot, dir))) {
      if (pattern.test(readFileSync(file, 'utf8'))) {
        offenders.push(file.replace(frontendRoot + '/', ''))
      }
    }
  }
  return offenders
}

describe('앱 코드는 VideoObject 구조화 데이터를 발행하지 않는다', () => {
  it("pages·composables·components 등에서 '@type': 'VideoObject' 발행이 0건이다", () => {
    expect(scan(EMIT_PATTERN)).toEqual([])
  })

  it('setVideoListSchema( 호출이 0건이다', () => {
    expect(scan(CALL_PATTERN)).toEqual([])
  })

  it('두 패턴이 실제 발행 코드를 잡는다 (정규식이 공허하지 않은지 확인)', () => {
    const emitSample = `  item: { '@type': 'VideoObject', name: v.title },`
    const callSample = `      setVideoListSchema(ssrVideos)`
    expect(EMIT_PATTERN.test(emitSample)).toBe(true)
    expect(CALL_PATTERN.test(callSample)).toBe(true)
    // 산문 주석은 잡지 않는다 — 그래야 제거 근거를 코드에 남길 수 있다.
    expect(EMIT_PATTERN.test('// VideoObject 6건이 SSR 로 나가고 있었다')).toBe(false)
    expect(CALL_PATTERN.test('// setVideoListSchema 는 2026-07-29 제거됐다')).toBe(false)
  })

  it('스캐너가 실제로 파일을 읽고 있다 (가드가 공허하지 않은지 확인)', () => {
    const files = APP_DIRS.flatMap(d => collectSourceFiles(resolve(frontendRoot, d)))
    expect(files.length).toBeGreaterThan(100)
  })
})
