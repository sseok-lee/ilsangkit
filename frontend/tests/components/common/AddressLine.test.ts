import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AddressLine from '~/components/common/AddressLine.vue'

describe('AddressLine', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('주소·핀 아이콘·복사 버튼을 렌더한다', () => {
    const w = mount(AddressLine, { props: { address: '서울 강남구 테헤란로 1' } })
    expect(w.text()).toContain('서울 강남구 테헤란로 1')
    expect(w.text()).toContain('location_on') // 핀 아이콘(material-symbols ligature)
    expect(w.find('[data-test="address-copy"]').exists()).toBe(true)
  })

  it('주소가 없거나 "-"면 아무것도 렌더하지 않는다', () => {
    expect(mount(AddressLine, { props: { address: null } }).text()).toBe('')
    expect(mount(AddressLine, { props: { address: '-' } }).text()).toBe('')
    expect(mount(AddressLine, { props: { address: '' } }).text()).toBe('')
    expect(mount(AddressLine, { props: {} }).text()).toBe('')
  })

  it('복사 버튼 클릭 시 clipboard에 주소를 쓰고 "복사됨"을 표시한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = mount(AddressLine, { props: { address: '부산 해운대구 우동 1' } })
    expect(w.text()).toContain('복사') // 초기 라벨
    expect(w.text()).not.toContain('복사됨')
    await w.find('[data-test="address-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('부산 해운대구 우동 1')
    expect(w.text()).toContain('복사됨')
  })

  it('clipboard 미지원(비보안 컨텍스트 등)이어도 예외를 던지지 않고 상태를 바꾸지 않는다', async () => {
    vi.stubGlobal('navigator', {}) // clipboard 없음 → writeText 접근 시 throw → catch
    const w = mount(AddressLine, { props: { address: '대구 중구 동성로 1' } })
    await w.find('[data-test="address-copy"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('복사됨')
  })
})
