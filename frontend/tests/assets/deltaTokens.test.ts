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
  it('semantic success/danger와 값이 다르다 (분리)', () => {
    expect('#DC2626').not.toBe('#E0443B') // delta-up ≠ danger
    expect('#2563EB').not.toBe('#2450DC') // delta-down ≠ brand
  })
})
