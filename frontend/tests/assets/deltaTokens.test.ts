import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../assets/css/main.css'), 'utf-8')
const tw = readFileSync(resolve(here, '../../tailwind.config.js'), 'utf-8')

describe('등락 토큰 (§6-4)', () => {
  it('main.css에 delta 토큰이 정의된다', () => {
    expect(css).toMatch(/--delta-up:\s*#DC2626/)
    expect(css).toMatch(/--delta-down:\s*#2563EB/)
  })
  it('tailwind에 delta 별칭이 있다', () => {
    expect(tw).toMatch(/delta-up/)
    expect(tw).toMatch(/delta-down/)
  })
  it('semantic success/danger·brand와 값이 다르다 (분리)', () => {
    const deltaUp = css.match(/--delta-up:\s*(#[0-9A-Fa-f]{3,6})/)?.[1]
    const deltaDown = css.match(/--delta-down:\s*(#[0-9A-Fa-f]{3,6})/)?.[1]
    const danger = css.match(/--danger:\s*(#[0-9A-Fa-f]{3,6})/)?.[1]
    const brand = css.match(/--brand:\s*(#[0-9A-Fa-f]{3,6})/)?.[1]
    expect(deltaUp).toBeTruthy()
    expect(deltaDown).toBeTruthy()
    expect(deltaUp).not.toBe(danger) // 상승 ≠ semantic danger
    expect(deltaDown).not.toBe(brand) // 하락 ≠ 브랜드 코발트
  })
})
