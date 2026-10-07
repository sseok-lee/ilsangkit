import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAffiliateDisclosureSettings from '~/components/admin/AdminAffiliateDisclosureSettings.vue'
import type { AffiliateProviderDisclosureDto } from '~/types/affiliateDisclosure'

const api = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }))
vi.mock('~/composables/useAdminAffiliateDisclosures', () => ({
  useAdminAffiliateDisclosures: () => api,
}))

const settings: AffiliateProviderDisclosureDto[] = [
  { provider: 'coupang', defaultDisclosureText: '기존 테스트 문구', updatedAt: '2026-10-07T00:00:00.000Z' },
  { provider: 'ali', defaultDisclosureText: null, updatedAt: null },
  { provider: 'toss', defaultDisclosureText: null, updatedAt: null },
]

const savedDto = (overrides: Partial<AffiliateProviderDisclosureDto> = {}): AffiliateProviderDisclosureDto => ({
  provider: 'coupang',
  defaultDisclosureText: '저장된 테스트 문구',
  updatedAt: '2026-10-07T01:00:00.000Z',
  ...overrides,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('AdminAffiliateDisclosureSettings', () => {
  it('shows unregistered provider state separately from saved timestamps', async () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready', initialProvider: 'ali' },
    })

    expect(wrapper.get('[data-testid="provider-disclosure-status"]').text()).toContain('아직 기본 문구가 등록되지 않았습니다')
    expect(wrapper.get('[data-testid="provider-disclosure-updated"]').text()).toContain('수정 시각 없음')
    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value).toBe('')

    await wrapper.get('[data-testid="provider-disclosure-provider"]').setValue('coupang')
    expect(wrapper.get('[data-testid="provider-disclosure-status"]').text()).toContain('기본 문구 등록됨')
    expect(wrapper.get('[data-testid="provider-disclosure-updated"]').text()).toContain('2026')
  })

  it('blocks empty and 1,001-code-unit saves without calling the API', async () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('   \r\n  ')
    await wrapper.get('form').trigger('submit')
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="provider-disclosure-error"]').text()).toContain('문구는 1~1,000자로 입력하세요')

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue(`${'😀'.repeat(500)}a`)
    await wrapper.get('form').trigger('submit')
    expect(api.save).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="provider-disclosure-count"]').text()).toContain('1001 / 1000')
  })

  it('keeps the draft on save failure and never emits a false success', async () => {
    api.save.mockRejectedValueOnce(new Error('storage failed'))
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('새 테스트 문구')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value)
      .toBe('새 테스트 문구')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.get('[data-testid="provider-disclosure-error"]').text()).toContain('저장하지 못했습니다')
  })

  it('normalizes text on successful save and clears dirty state after the server response', async () => {
    api.save.mockResolvedValueOnce(savedDto({ defaultDisclosureText: '새 테스트 문구\n둘째 줄' }))
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('  새 테스트 문구\r\n둘째 줄  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.save).toHaveBeenCalledWith('coupang', '새 테스트 문구\n둘째 줄')
    expect(wrapper.emitted('saved')?.[0]?.[0]).toEqual(savedDto({ defaultDisclosureText: '새 테스트 문구\n둘째 줄' }))
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toBe(false)
    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value)
      .toBe('새 테스트 문구\n둘째 줄')
  })

  it('restores the selected provider draft from the latest saved props on cancel', async () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('수정하다 취소')
    await wrapper.get('[data-testid="provider-disclosure-cancel"]').trigger('click')

    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value)
      .toBe('기존 테스트 문구')
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toBe(false)
  })

  it('confirms provider changes when dirty and keeps the previous selection when rejected', async () => {
    const confirm = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('변경 중')
    await wrapper.get('[data-testid="provider-disclosure-provider"]').setValue('ali')
    expect((wrapper.get('[data-testid="provider-disclosure-provider"]').element as HTMLSelectElement).value).toBe('coupang')
    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value).toBe('변경 중')

    await wrapper.get('[data-testid="provider-disclosure-provider"]').setValue('ali')
    expect((wrapper.get('[data-testid="provider-disclosure-provider"]').element as HTMLSelectElement).value).toBe('ali')
    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('blocks provider selection and duplicate submit while saving', async () => {
    const save = deferred<AffiliateProviderDisclosureDto>()
    api.save.mockReturnValueOnce(save.promise)
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('저장 중 문구')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(api.save).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="provider-disclosure-provider"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('busy-change')?.at(-1)?.[0]).toBe(true)

    save.resolve(savedDto({ defaultDisclosureText: '저장 중 문구' }))
    await flushPromises()
    expect(wrapper.emitted('busy-change')?.at(-1)?.[0]).toBe(false)
  })

  it('preserves a dirty draft when parent settings refresh externally', async () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings, loadState: 'ready' },
    })

    await wrapper.get('[data-testid="provider-disclosure-text"]').setValue('로컬 초안')
    await wrapper.setProps({
      settings: [
        { provider: 'coupang', defaultDisclosureText: '서버 새 문구', updatedAt: '2026-10-07T02:00:00.000Z' },
        settings[1],
        settings[2],
      ],
    })

    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value)
      .toBe('로컬 초안')

    await wrapper.get('[data-testid="provider-disclosure-cancel"]').trigger('click')
    expect((wrapper.get('[data-testid="provider-disclosure-text"]').element as HTMLTextAreaElement).value)
      .toBe('서버 새 문구')
  })

  it('shows load failures as retryable errors instead of unregistered settings', async () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings: [], loadState: 'error' },
    })

    expect(wrapper.get('[data-testid="provider-disclosure-load-error"]').text()).toContain('문구 설정을 불러오지 못했습니다')
    expect(wrapper.find('[data-testid="provider-disclosure-status"]').exists()).toBe(false)

    await wrapper.get('[data-testid="provider-disclosure-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('locks the editor while loading', () => {
    const wrapper = mount(AdminAffiliateDisclosureSettings, {
      props: { settings: [], loadState: 'loading' },
    })

    expect(wrapper.get('[data-testid="provider-disclosure-loading"]').text()).toContain('불러오는 중')
    expect(wrapper.get('[data-testid="provider-disclosure-text"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="provider-disclosure-save"]').attributes('disabled')).toBeDefined()
  })
})
