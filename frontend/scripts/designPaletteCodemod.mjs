#!/usr/bin/env node
// 디자인 통일(스펙 2026-10-02 §3) — 원시 회색 팔레트와 토큰과 같은 값의 hex 를 토큰 클래스로 바꾼다.
// 의미 색(emerald·teal·red 등)과 primary-* 는 건드리지 않는다. 규칙 밖의 회색·hex 는 leftovers 로 보고해 사람이 고른다.
// leftover 가 있어도 치환 결과는 파일에 쓰고 exit 1 로 끝난다(가드 RAW_GRAY 보다 넓거나 같은 범위를 탐지).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** [패턴, 치환]. 순서가 중요하다 — h-px 구분선 규칙이 bg 일반 규칙보다 먼저 온다. */
export const PALETTE_RULES = [
  [/\bh-px bg-(?:slate|gray)-(?:100|200)\b/g, 'h-px bg-line'],
  [/\btext-(?:slate|gray)-(?:950|900|800|700)\b/g, 'text-ink'],
  [/\btext-(?:slate|gray)-(?:600|500)\b/g, 'text-muted'],
  [/\btext-(?:slate|gray)-(?:400|300)\b/g, 'text-faint'],
  [/\bbg-(?:slate|gray)-(?:50|100)\b/g, 'bg-background-light'],
  [/\bbg-(?:slate|gray)-(?:200|300)\b/g, 'bg-line'],
  [/\bborder-(?:slate|gray)-(?:50|100|200)\b/g, 'border-line'],
  [/\bborder-(?:slate|gray)-300\b/g, 'border-line-2'],
  [/\bdivide-(?:slate|gray)-(?:100|200)\b/g, 'divide-line'],
  [/\bring-(?:slate|gray)-(?:100|200)\b/g, 'ring-line'],
  [/\b(divide|border)-\[#(?:e6e9f0|f0f2f5)\]/gi, '$1-line'],
  [/\b(border|ring)-\[#d5dce8\]/gi, '$1-line-2'],
  [/\b(text|bg|border|ring|divide)-\[#2450dc\]/gi, '$1-primary'],
  [/\b(text|bg|border)-\[#15213b\]/gi, '$1-ink'],
  [/\b(text|bg|border)-\[#56627a\]/gi, '$1-muted'],
  [/\bbg-\[#(?:f7f8fa|f1f4f8)\]/gi, 'bg-background-light'],
  [/\bbg-\[#1e43ba\]/gi, 'bg-primary-dark'],
]

const LEFTOVER = /\b(?:text|bg|border(?:-[trblxy])?|divide|ring|from|to|via|fill|stroke|placeholder|outline)-(?:(?:gray|slate)-\d{2,3}|\[#[0-9a-fA-F]{3,8}\])/g

export function mapPalette(src) {
  let out = src
  for (const [pattern, replacement] of PALETTE_RULES) out = out.replace(pattern, replacement)
  const leftovers = out.match(LEFTOVER) ?? []
  return { out, leftovers }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let failed = false
  for (const file of process.argv.slice(2)) {
    const src = readFileSync(file, 'utf8')
    const { out, leftovers } = mapPalette(src)
    if (out !== src) writeFileSync(file, out)
    console.log(`${file}: ${out === src ? '변경 없음' : '치환됨'}${leftovers.length ? ` · 남은 클래스 ${leftovers.join(', ')}` : ''}`)
    if (leftovers.length) failed = true
  }
  process.exit(failed ? 1 : 0)
}
