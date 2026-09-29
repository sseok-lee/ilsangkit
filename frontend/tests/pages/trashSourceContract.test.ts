import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApplicableWasteArea } from '~/types/wasteArea'

function routeFor(id: number) {
  return { path: `/trash/${id}`, params: { id: String(id) }, query: {}, fullPath: `/trash/${id}`, hash: '' }
}

let activeRoute: ReturnType<typeof routeFor>
vi.mock('vue-router', () => ({
  useRoute: () => activeRoute,
}))

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const contractPath = resolve(frontendRoot, '../backend/__tests__/fixtures/waste-area-api-contract.json')

interface ContractScheduleDetail {
  id: number
  city: string
  district: string
  targetRegion: string | null
  emissionPlace: string | null
  sourceUrl?: string | null
  applicableAreas?: ApplicableWasteArea[]
  appliesTo?: Array<{ conditionText: string; state: string; reason: string }>
  details: Record<string, unknown> | null
}

const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
  sourceDetail: { success: boolean; data: ContractScheduleDetail }
  sourceDetailMultiCondition?: { success: boolean; data: ContractScheduleDetail }
  sourceDetailEmptyAreas?: { success: boolean; data: ContractScheduleDetail }
}

const fetchMock = vi.fn()
const useHeadMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockReset()
  useHeadMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  activeRoute = routeFor(contract.sourceDetail.data.id)
  vi.stubGlobal('useHead', useHeadMock)
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useNuxtApp', () => ({ $router: null }))
  vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) => Object.assign(new Error(opts.statusMessage), opts))
  vi.stubGlobal('useAsyncData', async (_key: string, handler: () => Promise<unknown>) => {
    const result = { data: ref(null as unknown), error: ref(null as unknown), status: ref('success'), pending: ref(false), refresh: vi.fn() }
    try {
      result.data.value = await handler()
    } catch (error) {
      result.error.value = error
    }
    return result
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountTrashSource(detail: ContractScheduleDetail) {
  activeRoute = routeFor(detail.id)
  fetchMock.mockResolvedValue({ success: true, data: detail })
  const Page = (await import('~/pages/trash/[id].vue')).default
  const wrapper = mount(defineComponent({
    render() {
      return h(Suspense, null, { default: () => h(Page) })
    },
  }), {
    global: {
      stubs: {
        Breadcrumb: { template: '<nav />' },
        PageHero: { props: ['title', 'description'], template: '<header><h1>{{ title }}</h1><p>{{ description }}</p><slot name="sidebar" /></header>' },
        SectionBlock: { props: ['heading', 'subtext'], template: '<section><h2>{{ heading }}</h2><slot /></section>' },
        DataSourceSection: { template: '<div />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        WasteScheduleContent: { props: ['schedule', 'conditionText'], template: '<article data-testid="source-card"><p>{{ conditionText }}</p><p>{{ schedule.emissionPlace }}</p></article>' },
      },
      config: { warnHandler: () => {} },
    },
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  return wrapper
}

function resolveHeadArg(value: unknown) {
  if (typeof value === 'function') {
    return (value as () => unknown)()
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: unknown }).value
  }
  return value
}

function wasteSchemaAreaServed() {
  for (const [value] of useHeadMock.mock.calls) {
    const head = resolveHeadArg(value) as { script?: Array<{ key?: string; innerHTML: string }> } | undefined
    const script = head?.script?.find(entry => entry.key === 'jsonld-waste')
    if (script) {
      return JSON.parse(script.innerHTML).areaServed
    }
  }
  throw new Error('jsonld-waste was not emitted')
}

describe('trash source detail applicableAreas contract', () => {
  it('imports backend actual-response fixture with linked dong cases and exclusions', () => {
    expect(contract.sourceDetail.data.applicableAreas).toEqual([
      { areaId: 101, name: '계약1동', href: '/trash/areas/101', scope: 'whole', conditionText: '' },
      { areaId: 102, name: '계약2동', href: '/trash/areas/102', scope: 'whole', conditionText: '' },
    ])
    expect(contract.sourceDetailMultiCondition?.data.applicableAreas?.[0]).toMatchObject({
      areaId: 101,
      name: '계약1동',
      href: '/trash/areas/101',
      scope: 'conditional',
      conditionText: '계약 조건 A\n계약 조건 B',
    })
    expect(contract.sourceDetailEmptyAreas?.data.applicableAreas).toEqual([])
    expect(JSON.stringify(contract)).toContain('법정')
    expect(JSON.stringify(contract)).toContain('만료')
    expect(JSON.stringify(contract)).toContain('conflict')
  })

  it('renders applicable area links separately from original source condition text', async () => {
    const wrapper = await mountTrashSource(contract.sourceDetail.data)

    expect(wrapper.get('[data-testid="source-card"]').text()).toContain('원본 적용 지역: 계약구')
    expect(wrapper.get('[data-testid="source-card"]').text()).not.toContain('적용 동: 계약1동, 계약2동')
    expect(wrapper.get('a[href="/trash/areas/101"]').text()).toContain('계약1동')
    expect(wrapper.get('a[href="/trash/areas/102"]').text()).toContain('계약2동')
    expect(wrapper.find(`a[href="${contract.sourceDetail.data.sourceUrl}"]`).exists()).toBe(false)
  })

  it('hides the linked dong box for an empty applicableAreas fixture', async () => {
    const emptyDetail = contract.sourceDetailEmptyAreas?.data
    expect(emptyDetail).toBeTruthy()
    const wrapper = await mountTrashSource(emptyDetail!)

    expect(wrapper.text()).not.toContain('적용 동')
    expect(wrapper.find('a[href^="/trash/areas/"]').exists()).toBe(false)
    const sourceCardText = wrapper.get('[data-testid="source-card"]').text()
    expect(sourceCardText).toContain('원본 적용 조건: 계약 conflict 제외')
    expect(sourceCardText).toContain('계약 만료 제외')
  })

  it('emits JSON-LD areaServed from applicableAreas', async () => {
    await mountTrashSource(contract.sourceDetail.data)

    expect(wasteSchemaAreaServed()).toEqual([
      { '@type': 'AdministrativeArea', name: '서울특별시 계약구 계약1동' },
      { '@type': 'AdministrativeArea', name: '서울특별시 계약구 계약2동' },
    ])
  })
})
