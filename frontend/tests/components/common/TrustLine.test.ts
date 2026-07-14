import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrustLine from '~/components/common/TrustLine.vue'

describe('TrustLine', () => {
  it('공공데이터 기반 문구와 전체 출처 링크를 렌더한다', () => {
    const w = mount(TrustLine)
    expect(w.text()).toContain('공공데이터 기반 서비스')
    expect(w.text()).toContain('공공누리(KOGL)')
    expect(w.text()).toContain('전체 출처 보기')
    expect(w.html()).toContain('/about#data-sources')
  })
})
