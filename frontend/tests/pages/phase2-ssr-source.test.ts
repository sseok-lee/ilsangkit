import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const read = (relPath: string) => readFileSync(resolve(frontendRoot, relPath), 'utf8')

describe('Phase 2 — SSR 워터폴 병렬화 source assertions', () => {
  describe('시설 상세 (pages/[category]/[id].vue)', () => {
    const src = read('pages/[category]/[id].vue')

    it('secondary fetches가 Promise.allSettled로 묶여 있다', () => {
      expect(src).toMatch(/facility-secondary-\$\{category\.value\}-\$\{id\.value\}/)
      expect(src).toContain('Promise.allSettled')
    })

    it('secondary $fetch에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('옛 youtubeSsrResponse / syncStatusResponse 참조가 모두 제거됐다', () => {
      expect(src).not.toContain('youtubeSsrResponse')
      expect(src).not.toContain('syncStatusResponse')
    })
  })

  describe('홈 (pages/index.vue)', () => {
    const src = read('pages/index.vue')

    it('home-page useAsyncData가 단일 Promise.allSettled로 dashboard+guides 병렬화한다', () => {
      expect(src).toMatch(/useAsyncData\(\s*\n?\s*'home-page'/)
      expect(src).toContain('Promise.allSettled')
    })

    it('secondary $fetch에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('dashboard 실패 시 503 throw로 빈 hero 색인을 차단한다', () => {
      expect(src).toMatch(/createError\(\{\s*statusCode:\s*503/)
      expect(src).toContain('import.meta.server')
    })

    it('옛 dashboardResponse / recentGuidesData / useHomeDashboard() 호출이 모두 제거됐다', () => {
      expect(src).not.toContain('dashboardResponse')
      expect(src).not.toContain('recentGuidesData')
      // type-only import는 OK, 함수 호출은 제거됐어야 함
      expect(src).not.toMatch(/=\s*await\s+useHomeDashboard\s*\(/)
    })
  })

  describe('부동산 상세 (pages/real-estate/.../[buildingName].vue)', () => {
    const src = read('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')

    it('real-estate-secondary useAsyncData로 sync-status를 분리했다', () => {
      expect(src).toContain("'real-estate-secondary'")
      // 새 secondary 안의 Promise.allSettled는 존재해야 함 (단, 다른 ssrData 내부의 allSettled와 구분 불가하므로 키만 단언)
    })

    it('secondary 영역에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('ssrData (critical, 404 gate)는 그대로 유지된다', () => {
      // critical SSR useAsyncData 분기 (data: ssrData)는 유지돼야 함
      expect(src).toMatch(/data:\s*ssrData/)
      // 404 gate가 사라지지 않았는지
      expect(src).toMatch(/createError\(\{\s*statusCode:\s*404/)
    })

    it('옛 syncStatusResponse 참조가 모두 제거됐다', () => {
      expect(src).not.toContain('syncStatusResponse')
    })
  })
})
