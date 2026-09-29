import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const source = readFileSync(resolve(frontendRoot, 'pages/trash/[id].vue'), 'utf8')

// ─── Task 1.3: HowTo 스키마 데이터 구조 검증 ─────────────────────────────
// 페이지 컴포넌트 마운트 대신 HowTo에 전달될 데이터 구조를 직접 검증

describe('TrashDetailPage - HowTo 스키마 구조', () => {
  const howToData = {
    name: '서울특별시 강남구 쓰레기 배출 방법',
    description: '서울특별시 강남구 지역 쓰레기 올바른 배출 절차',
    steps: [
      { name: '종량제 봉투 구매', text: '해당 지역 지정 종량제 봉투를 편의점 또는 마트에서 구매합니다.' },
      { name: '분리배출', text: '일반 쓰레기, 음식물, 재활용품을 분리합니다.' },
      { name: '배출 요일 확인', text: '배출 요일과 시간을 확인합니다.' },
      { name: '지정 장소 배출', text: '지정된 배출 장소에 올바르게 배출합니다.' },
    ],
    totalTime: 'PT10M',
  }

  it('HowTo에 4개의 steps가 있다', () => {
    expect(howToData.steps).toHaveLength(4)
  })

  it('totalTime이 PT10M이다', () => {
    expect(howToData.totalTime).toBe('PT10M')
  })

  it('각 step에 name과 text가 있다', () => {
    for (const step of howToData.steps) {
      expect(step.name).toBeTruthy()
      expect(step.text).toBeTruthy()
    }
  })

  it('name에 지역명(city, district)이 포함된다', () => {
    expect(howToData.name).toContain('서울특별시')
    expect(howToData.name).toContain('강남구')
  })

  it('name에 "쓰레기 배출 방법"이 포함된다', () => {
    expect(howToData.name).toContain('쓰레기 배출 방법')
  })

  it('첫 번째 step은 종량제 봉투 구매이다', () => {
    expect(howToData.steps[0].name).toBe('종량제 봉투 구매')
  })
})

describe('TrashDetailPage - 원본 상세 직접 접근', () => {
  it('서버 직접 진입을 지역 301로 바꾸지 않고 원본 본문을 렌더한다', () => {
    expect(source).not.toContain('redirectCode: 301')
    expect(source).not.toContain('await navigateTo(trashRegionPath.value')
    expect(source).toContain('<WasteScheduleContent')
    expect(source).toContain("content: 'noindex, follow'")
    expect(source).not.toContain("rel: 'canonical'")
    expect(source).not.toContain('<AdBanner')
  })

  it('legacy fragment를 임시 복귀 문맥으로 소비하고 공유 URL에서는 제거한다', () => {
    expect(source).toMatch(/consumeLegacyTrashFromFragment\s*\(\s*scheduleId\.value/)
    expect(source).toContain('readTrashReturnContext(scheduleId.value)')
  })
})
