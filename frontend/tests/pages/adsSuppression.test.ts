// frontend/tests/pages/adsSuppression.test.ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const pages: [string, RegExp][] = [
  ['pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*noindex\.value\s*\)/],
  ['pages/[city]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/real-estate/[realEstateType]/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*totalComplexes\.value === 0\s*\)/],
]

describe('degraded/noindex 페이지는 reactive로 광고를 억제한다', () => {
  it.each(pages)('%s', (p, re) => {
    const src = read(p)
    expect(src).toContain("import { suppressAds } from '~/composables/useAdsPolicy'")
    expect(src).toContain('watchEffect(')
    expect(src).toMatch(re)
  })
})
