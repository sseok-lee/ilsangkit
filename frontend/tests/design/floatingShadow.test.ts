import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 떠 있는 층의 그림자는 shadow-card-2 하나(스펙 2026-10-02 §7.3).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const FLOATING: Array<[string, number]> = [
  ['components/common/AppHeader.vue', 3],
  ['components/search/SearchAutocomplete.vue', 1],
  ['components/realEstate/map/MapFilterBar.vue', 2],
  ['components/map/FacilityMap.vue', 1],
  ['layouts/default.vue', 1],
  ['layouts/map.vue', 1],
]

describe('떠 있는 층 그림자 통일', () => {
  for (const [file, count] of FLOATING) {
    it(`${file}: shadow-sm/md/lg 없이 shadow-card-2 ${count}곳`, () => {
      const src = read(file)
      expect(src).not.toMatch(/\bshadow-(?:sm|md|lg|xl)\b/)
      expect(src.match(/\bshadow-card-2\b/g)?.length ?? 0).toBe(count)
    })
  }
})
