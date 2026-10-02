import { describe, it, expect } from 'vitest'
import { mapPalette } from '~/scripts/designPaletteCodemod.mjs'

describe('designPaletteCodemod.mapPalette', () => {
  it.each([
    ['text-slate-900', 'text-ink'],
    ['text-gray-700', 'text-ink'],
    ['text-slate-500', 'text-muted'],
    ['text-gray-600', 'text-muted'],
    ['text-gray-400', 'text-faint'],
    ['bg-slate-50', 'bg-background-light'],
    ['bg-gray-100', 'bg-background-light'],
    ['bg-slate-200', 'bg-line'],
    ['border-slate-100', 'border-line'],
    ['border-gray-200', 'border-line'],
    ['border-slate-300', 'border-line-2'],
    ['divide-slate-100', 'divide-line'],
    ['divide-[#f0f2f5]', 'divide-line'],
    ['border-[#e6e9f0]', 'border-line'],
    ['text-[#15213b]', 'text-ink'],
    ['text-[#56627A]', 'text-muted'],
    ['bg-[#F7F8FA]', 'bg-background-light'],
    ['bg-[#F1F4F8]', 'bg-background-light'],
    ['text-[#2450DC]', 'text-primary'],
    ['border-[#D5DCE8]', 'border-line-2'],
    ['hover:bg-[#1E43BA]', 'hover:bg-primary-dark'],
  ])('%s → %s', (from, to) => {
    expect(mapPalette(`class="${from}"`).out).toBe(`class="${to}"`)
  })

  it('h-px 구분선의 slate 배경은 line 색으로 바꾼다', () => {
    expect(mapPalette('<div class="h-px bg-slate-100 w-full"></div>').out).toBe('<div class="h-px bg-line w-full"></div>')
  })

  it('변형 접두사·투명도 접미사를 보존한다', () => {
    expect(mapPalette('hover:bg-slate-50 md:text-slate-500 placeholder:text-[#56627A]/60 focus:ring-[#2450DC]/20').out)
      .toBe('hover:bg-background-light md:text-muted placeholder:text-muted/60 focus:ring-primary/20')
  })

  it('의미 색은 건드리지 않는다', () => {
    const src = 'bg-emerald-50 text-emerald-700 bg-teal-50 text-red-700 bg-primary-50 text-primary-700'
    expect(mapPalette(src).out).toBe(src)
  })

  it('방향 테두리·그라데이션 접두 회색도 leftovers 로 보고한다', () => {
    const { leftovers } = mapPalette('border-t-slate-100 from-gray-50')
    expect(leftovers).toEqual(['border-t-slate-100', 'from-gray-50'])
  })

  it('치환 규칙 밖의 회색·hex 를 leftovers 로 보고한다', () => {
    const { leftovers } = mapPalette('bg-slate-900 text-slate-100 bg-[#123456]')
    expect(leftovers).toEqual(['bg-slate-900', 'text-slate-100', 'bg-[#123456]'])
  })
})
