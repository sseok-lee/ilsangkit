import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const searchPage = readFileSync(resolve(__dirname, '../../pages/search.vue'), 'utf-8')

describe('search.vue 시설 그룹 전체 보기 링크', () => {
  it('서버가 준 group.moreHref 를 우선하고 없으면 /{category}?keyword= 로 폴백한다', () => {
    expect(searchPage).toContain(':more-href="group.moreHref ?? `/${group.category}?keyword=${encodeURIComponent(applied.q)}`"')
  })
})
