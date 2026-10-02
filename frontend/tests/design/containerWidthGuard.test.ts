import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// 스펙 §3.2 — 1152·1120·1040·1024px 컨테이너를 없애고 .page-container(1200 + 정렬선) 로 맞춘다.
const root = resolve(__dirname, '../..')
const FILES = [
  'pages/faq.vue',
  'pages/article/[slug].vue',
  'pages/guide/[slug].vue',
  'pages/subscription/sale/index.vue',
  'pages/subscription/sale/[type].vue',
  'pages/subscription/rent/index.vue',
  'pages/subscription/rent/[type].vue',
  'pages/about.vue',
  'pages/contact.vue',
  'pages/privacy.vue',
  'pages/terms.vue',
]
const ODD_WIDTH = /max-w-(?:6xl|\[(?:1152|1120|1040|1024)px\])/

describe('컨테이너 폭 가드', () => {
  it.each(FILES)('%s', (file) => {
    const src = readFileSync(resolve(root, file), 'utf8')
    expect(src.match(ODD_WIDTH)?.[0] ?? null).toBeNull()
    expect(src).toContain('page-container')
  })
})
