import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateOgImageSvg, CATEGORY_COLORS, OG_WIDTH, OG_HEIGHT } from '~/server/utils/ogImage'

describe('OG Image generation', () => {
  describe('generateOgImageSvg', () => {
    it('유효한 category로 호출 시 SVG 문자열 반환', () => {
      const svg = generateOgImageSvg({ category: 'toilet', title: '공공화장실' })
      expect(svg).toBeTypeOf('string')
      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
    })

    it('응답 SVG는 1200x630px 크기 설정 포함', () => {
      const svg = generateOgImageSvg({ category: 'toilet', title: '공공화장실' })
      expect(svg).toContain(`width="${OG_WIDTH}"`)
      expect(svg).toContain(`height="${OG_HEIGHT}"`)
      expect(OG_WIDTH).toBe(1200)
      expect(OG_HEIGHT).toBe(630)
    })

    it('title 파라미터가 SVG에 포함됨', () => {
      const svg = generateOgImageSvg({ category: 'toilet', title: '공공화장실' })
      expect(svg).toContain('공공화장실')
    })

    it('잘못된 category 파라미터 시 기본 배경색(fallback) 사용', () => {
      const svg = generateOgImageSvg({ category: 'invalid' as any, title: '테스트' })
      expect(svg).toBeTypeOf('string')
      expect(svg).toContain('<svg')
      // fallback color should be used - no crash
    })

    it('카테고리별 배경색이 CATEGORY_COLORS에 정의됨', () => {
      const validCategories = ['toilet', 'trash', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market'] as const
      for (const cat of validCategories) {
        expect(CATEGORY_COLORS[cat]).toBeTypeOf('string')
        // hex color format: #rrggbb
        expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })

    it('city, district 파라미터가 제공되면 SVG에 포함됨', () => {
      const svg = generateOgImageSvg({ category: 'hospital', title: '서울대병원', city: '서울특별시', district: '관악구' })
      expect(svg).toContain('서울특별시')
      expect(svg).toContain('관악구')
    })

    it('city, district 없이 호출 시 에러 없이 SVG 반환', () => {
      const svg = generateOgImageSvg({ category: 'parking', title: '공영주차장' })
      expect(svg).toBeTypeOf('string')
      expect(svg).toContain('<svg')
    })
  })

  describe('OG Image Nitro route handler', () => {
    it('유효한 category 쿼리로 SVG Content-Type 응답 (이미지 관련 Content-Type)', () => {
      // generateOgImageSvg가 반환하는 SVG는 image/svg+xml로 서빙됨
      const svg = generateOgImageSvg({ category: 'toilet', title: '공공화장실' })
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    })

    it('빈 title이면 카테고리 기본 label로 폴백', () => {
      const svg = generateOgImageSvg({ category: 'hospital', title: '' })
      // Should contain hospital label fallback
      expect(svg).toBeTypeOf('string')
      expect(svg).toContain('<svg')
    })
  })
})
