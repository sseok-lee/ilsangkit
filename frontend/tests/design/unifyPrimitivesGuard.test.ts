import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// 흰색 평면형 공통 부품은 그림자·원시 팔레트·hex 를 쓰지 않는다(스펙 2026-10-02 §3, §8-4).
const FILES = [
  'components/common/PageHead.vue',
  'components/common/SummaryRow.vue',
  'components/common/UiButton.vue',
  'components/common/UiChip.vue',
  'components/common/SegmentedControl.vue',
]

const read = (p: string) => readFileSync(resolve(here, '../../', p), 'utf8')

describe('평면형 부품 가드', () => {
  it.each(FILES)('%s 에 그림자·원시 팔레트·hex·scoped @apply 가 없다', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/shadow-/)
    expect(src).not.toMatch(/box-shadow/)
    expect(src).not.toMatch(/\b(text|bg|border)-(gray|slate|zinc|neutral|blue)-\d{2,3}\b/)
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/@apply/)
  })

  it('main.css 의 평면형 블록(시작~끝 마커)에 box-shadow 와 hex 리터럴이 없다', () => {
    const css = read('assets/css/main.css')
    const start = css.indexOf('흰색 평면형 공통 기준')
    const end = css.indexOf('흰색 평면형 공통 기준 끝')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(css.slice(start, end)).not.toMatch(/box-shadow/)
    expect(css.slice(start, end)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
