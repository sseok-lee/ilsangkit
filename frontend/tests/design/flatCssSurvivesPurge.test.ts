import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

// 평면형 공통 클래스가 Tailwind 퍼지(content 스캔)에서 살아남는지 컴파일로 확인한다.
// 클래스 이름을 런타임에 조립하면(`ui-btn--${variant}`) 리터럴이 없어 규칙이 빌드에서 빠진다.
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const cssPath = resolve(root, 'assets/css/main.css')
const START = '흰색 평면형 공통 기준'
const END = '흰색 평면형 공통 기준 끝'

describe('평면형 CSS 퍼지 생존', () => {
  it('블록에 정의된 모든 클래스가 컴파일 결과에 남는다', async () => {
    const src = readFileSync(cssPath, 'utf-8')
    const start = src.indexOf(START)
    const end = src.indexOf(END)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const classes = [...new Set([...src.slice(start, end).matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]))]
      .filter((c) => !/^\d/.test(c))
    expect(classes.length).toBeGreaterThan(15)

    const config = (await import(resolve(root, 'tailwind.config.js'))).default
    const result = await postcss([tailwindcss({ ...config, content: config.content.map((c: string) => resolve(root, c)) })])
      .process(src, { from: cssPath })

    const missing = classes.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(result.css))
    expect(missing).toEqual([])
  }, 60000)
})
