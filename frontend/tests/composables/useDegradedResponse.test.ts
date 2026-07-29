import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const setResponseStatus = vi.fn()
const headerRef = ref<unknown>(undefined)
const useResponseHeader = vi.fn(() => headerRef)
let mockEvent: unknown = { __isEvent: true }

// stub 대상은 "실제로 Nuxt 앱 자동 import 에 존재하는 것"만 둔다.
// 이전 버전은 setResponseHeader 를 stubGlobal 로 만들어 줬는데, 그 전역은 앱 런타임에
// 존재하지 않는다(.nuxt/imports.d.ts 미포함, 서버 전용 nitro-imports 에만 있음).
// 테스트가 없는 전역을 대신 만들어 주는 바람에 SSR 에서 항상 터지는 코드가 3개월간 초록이었다.
vi.stubGlobal('useRequestEvent', () => mockEvent)
vi.stubGlobal('setResponseStatus', setResponseStatus)
vi.stubGlobal('useResponseHeader', useResponseHeader)

import { markDegradedResponse } from '~/composables/useDegradedResponse'

describe('markDegradedResponse', () => {
  beforeEach(() => {
    setResponseStatus.mockClear()
    useResponseHeader.mockClear()
    headerRef.value = undefined
    mockEvent = { __isEvent: true }
  })

  it('SSR 이벤트가 있으면 503 + cache-control:no-store 설정', () => {
    markDegradedResponse()
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 503)
    expect(useResponseHeader).toHaveBeenCalledWith('cache-control')
    expect(headerRef.value).toBe('no-store')
  })

  it('statusCode 인자를 따른다', () => {
    markDegradedResponse(502)
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 502)
  })

  it('이벤트가 없으면(클라이언트) no-op', () => {
    mockEvent = undefined
    markDegradedResponse()
    expect(setResponseStatus).not.toHaveBeenCalled()
    expect(useResponseHeader).not.toHaveBeenCalled()
    expect(headerRef.value).toBeUndefined()
  })
})

// ── 회귀 가드 ───────────────────────────────────────────────────────────────
// h3 의 setResponseHeader 는 server/ 디렉터리(Nitro)에서만 자동 import 된다.
// 앱 코드(pages·composables·components·utils·plugins·middleware·layouts)에서 쓰면
// 번들에 import 없이 자유 변수로 남아 SSR 런타임에 ReferenceError 가 난다.
// 앱 코드에서는 Nuxt 의 useResponseHeader() 를 쓸 것.
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

describe('앱 코드는 서버 전용 setResponseHeader 를 직접 호출하지 않는다', () => {
  it('pages·composables·utils 등에서 setResponseHeader( 호출이 0건이다', () => {
    const offenders: string[] = []
    for (const dir of APP_DIRS) {
      for (const file of collectSourceFiles(resolve(frontendRoot, dir))) {
        const source = readFileSync(file, 'utf8')
        if (/(^|[^.\w])setResponseHeader\s*\(/.test(source)) {
          offenders.push(file.replace(frontendRoot + '/', ''))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('스캐너가 실제로 파일을 읽고 있다 (가드가 공허하지 않은지 확인)', () => {
    const files = APP_DIRS.flatMap(d => collectSourceFiles(resolve(frontendRoot, d)))
    expect(files.length).toBeGreaterThan(100)
  })
})
