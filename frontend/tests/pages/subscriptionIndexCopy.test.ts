import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const page = readFileSync(
  resolve(__dirname, '../../pages/subscription/index.vue'),
  'utf8',
)

describe('subscription/index.vue public rental source copy', () => {
  it('공공임대 통합 출처를 마이홈/LH까지 말하고 SH 포괄을 주장하지 않는다', () => {
    expect(page).toContain('한국부동산원 청약홈, 마이홈·LH')
    expect(page).toContain('공공임대(마이홈·LH)')
    expect(page).not.toContain('LH·SH')
  })

  it('공고별 자격을 단정하는 예시 문구를 허브에서 제거한다', () => {
    expect(page).not.toContain('청약통장 없이도 신청 가능합니다')
    expect(page).not.toContain('온라인 접수는 청약통장 보유자이면 누구나 신청할 수 있습니다')
  })
})
