import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Nuxt composables before import
const mockUseSeoMeta = vi.fn()
const mockUseHead = vi.fn()

vi.stubGlobal('useSeoMeta', mockUseSeoMeta)
vi.stubGlobal('useHead', mockUseHead)

vi.mock('~/utils/seoConstants', () => ({
  SITE_NAME: '일상킷',
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_DESCRIPTION: '테스트 설명',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og-image.png',
}))

import { useRealEstateMeta } from '~/composables/useRealEstateMeta'

describe('useRealEstateMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Task 1.5: 부동산 목록 페이지 OG 태그 ───────────────────────────────────

  describe('setRealEstateListMeta', () => {
    it('useSeoMeta를 호출한다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      expect(mockUseSeoMeta).toHaveBeenCalled()
    })

    it('ogImage를 설정한다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImage).toBeTruthy()
    })

    it('ogType이 website이다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogType).toBe('website')
    })

    it('twitterCard가 summary_large_image이다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.twitterCard).toBe('summary_large_image')
    })

    it('ogImage에 /og?category= 가 포함된다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImage).toContain('/og?category=')
    })

    it('villa-rent 타입에도 ogImage가 설정된다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('villa-rent')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImage).toContain('/og?category=villa')
    })

    it('useHead를 호출하여 title과 meta를 설정한다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      expect(mockUseHead).toHaveBeenCalled()
      const call = mockUseHead.mock.calls[0][0]
      expect(call.title).toBeTruthy()
      expect(Array.isArray(call.meta)).toBe(true)
    })

    it('title은 "| 일상킷" 접미사를 사용한다 (구분자 통일)', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseHead.mock.calls[0][0]
      expect(call.title).toMatch(/\| 일상킷$/)
      expect(call.title).not.toContain('- 일상킷')
    })

    it('canonical link를 설정한다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('apt-sale')
      const call = mockUseHead.mock.calls[0][0]
      expect(Array.isArray(call.link)).toBe(true)
      const canonical = call.link.find((l: { rel: string }) => l.rel === 'canonical')
      expect(canonical).toBeTruthy()
      expect(canonical.href).toBe('https://ilsangkit.co.kr/real-estate/apt-sale')
    })

    it('canonical URL과 ogUrl이 동일하다', () => {
      const { setRealEstateListMeta } = useRealEstateMeta()
      setRealEstateListMeta('villa-rent')
      const headCall = mockUseHead.mock.calls[0][0]
      const seoCall = mockUseSeoMeta.mock.calls[0][0]
      const canonical = headCall.link.find((l: { rel: string }) => l.rel === 'canonical')
      expect(canonical.href).toBe(seoCall.ogUrl)
    })
  })

  // ─── Task 1.5: 부동산 상세 페이지 OG 태그 ───────────────────────────────────

  describe('setRealEstateDetailMeta', () => {
    it('useSeoMeta를 호출한다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      expect(mockUseSeoMeta).toHaveBeenCalled()
    })

    it('ogImage를 설정한다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImage).toBeTruthy()
    })

    it('ogType이 website이다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogType).toBe('website')
    })

    it('twitterCard가 summary_large_image이다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.twitterCard).toBe('summary_large_image')
    })

    it('ogImage에 /og?category= 가 포함된다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImage).toContain('/og?category=apt')
    })

    it('ogUrl에 건물명이 인코딩되어 포함된다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogUrl).toContain(encodeURIComponent('래미안 강남'))
    })

    it('useHead를 호출하여 title과 meta를 설정한다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      expect(mockUseHead).toHaveBeenCalled()
      const call = mockUseHead.mock.calls[0][0]
      expect(call.title).toContain('래미안 강남')
      expect(Array.isArray(call.meta)).toBe(true)
    })

    it('title은 "| 일상킷" 접미사를 사용한다 (구분자 통일)', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseHead.mock.calls[0][0]
      expect(call.title).toMatch(/\| 일상킷$/)
      expect(call.title).not.toContain('- 일상킷')
    })

    it('canonical link에 buildingName이 인코딩되어 포함된다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const call = mockUseHead.mock.calls[0][0]
      const canonical = call.link.find((l: { rel: string }) => l.rel === 'canonical')
      expect(canonical).toBeTruthy()
      expect(canonical.href).toBe(
        `https://ilsangkit.co.kr/real-estate/apt-sale/${encodeURIComponent('래미안 강남')}`
      )
    })

    it('canonical URL과 ogUrl이 동일하다', () => {
      const { setRealEstateDetailMeta } = useRealEstateMeta()
      setRealEstateDetailMeta('apt-sale', '래미안 강남', '서울시', '강남구')
      const headCall = mockUseHead.mock.calls[0][0]
      const seoCall = mockUseSeoMeta.mock.calls[0][0]
      const canonical = headCall.link.find((l: { rel: string }) => l.rel === 'canonical')
      expect(canonical.href).toBe(seoCall.ogUrl)
    })
  })
})
