import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 히어로 빈값 문구를 EMPTY_FIELD_TEXT 단일 소스로 통일 — 히어로·rentRatio·모바일칩 필터가
// 같은 상수를 참조하는지 소스로 락(커플링 회귀 방지). 페이지 마운트는 과도하므로 소스 가드 채택.
//
// 주의: `new URL('<literal>', import.meta.url)` 형태는 Vite의 정적 asset-import URL 변환에
// 걸려 dev 서버 URL(http://localhost:3000/...)로 치환되어 fileURLToPath가 실패한다
// (TypeError: The URL must be of scheme file). path.resolve로 우회.
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const targetPath = path.resolve(
  currentDir,
  '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
)
const SRC = readFileSync(targetPath, 'utf-8')

describe('부동산 상세 히어로 빈값 — EMPTY_FIELD_TEXT 통일 (§5-8 rule4)', () => {
  it('EMPTY_FIELD_TEXT를 import한다', () => {
    expect(SRC).toContain("import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'")
  })
  it("bare '정보 없음' 리터럴이 남아있지 않다 (3곳 전부 상수화)", () => {
    expect(SRC).not.toContain("'정보 없음'")
  })
  it('모바일 헤더칩 필터가 EMPTY_FIELD_TEXT 상수를 참조한다 (커플링 구조적 보장)', () => {
    expect(SRC).toContain('s.value !== EMPTY_FIELD_TEXT')
  })
})
