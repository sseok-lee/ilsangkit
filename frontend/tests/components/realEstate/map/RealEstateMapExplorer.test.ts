import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { MapItem } from '~/types/realEstateMap'

const ITEMS: MapItem[] = [
  { name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 },
]

function mountExplorer() {
  return mount(RealEstateMapExplorer, {
    props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
    global: { stubs: { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } } },
  })
}

// AdBanner 는 tests/setup.ts 의 config.global.stubs 로 전역 스텁된다 (`.stub-ad-banner`).
// MapSidebar 가 로컬 import 하지만 VTU 스텁 매칭은 등록 방식과 무관하게 걸린다(실측 확인).
// 광고 슬롯 자체는 MapSidebar 가 심는 `[data-testid="map-sidebar-ad"]` 래퍼로 센다 —
// 이게 실제로 "인피드 광고 자리가 몇 개 렌더됐는가"를 세는 마커다.
const AD_SLOT_SELECTOR = '[data-testid="map-sidebar-ad"]'

function stubDesktopViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('RealEstateMapExplorer', () => {
  it('사이드바를 SSR 가능한 형태로 렌더한다 — 지도 없이도 목록이 나온다', () => {
    const w = mountExplorer()
    expect(w.text()).toContain('서울')
  })

  it('필터바를 렌더한다', () => {
    expect(mountExplorer().text()).toContain('아파트 매매')
  })

  it('거래 축이 2종이라 전세/월세 버튼이 없다', () => {
    const t = mountExplorer().text()
    expect(t).toContain('아파트 전월세')
    expect(t).not.toContain('아파트 전세')
    expect(t).not.toContain('아파트 월세')
  })

  it('지도 캔버스는 ClientOnly 안에 있다 — SSR 에서 kakao SDK 를 건드리지 않는다', () => {
    const w = mountExplorer()
    expect(w.html()).not.toContain('window.kakao')
  })

  // 루프 회귀 가드: RealEstateMapCanvas 가 idle 의 3번째 인자로 올려보내는 "실제 중심"을
  // onIdle 이 그대로 반영해야 한다. bounds.sw/ne 산술중점으로 되돌아가면(과거 버그) Kakao
  // Mercator 투영 오차 때문에 panTo → idle 재발화가 무한 반복되는 드리프트가 재발한다.
  // center 는 로컬 ref 라 직접 관측할 수 없으므로, syncHash() 가 그 값을 그대로 실어보내는
  // location.hash 를 관측 지점으로 삼는다(라이브 검증 때 실제로 이 해시를 읽어 확인한 방식과 동일).
  it('idle 의 3번째 인자(getCenter() 실제 중심)를 center 에 그대로 반영한다 — bounds 산술중점이 아니다 (루프 회귀 가드)', async () => {
    const CanvasStub = {
      template: '<div data-testid="canvas" />',
      emits: ['idle', 'select', 'hover'],
    }
    const w = mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
      global: { stubs: { RealEstateMapCanvas: CanvasStub } },
    })

    // sw/ne 산술중점 = lat (33+41)/2=37, lng (124+132)/2=128 — getCenter() 실제값과
    // 의도적으로 다르게 둔다(Mercator 왜곡 재현).
    const bounds = { swLat: 33, swLng: 124, neLat: 41, neLng: 132 }
    const realCenter = { lat: 36.5, lng: 127.8 }

    await w.findComponent(CanvasStub).vm.$emit('idle', bounds, 9, realCenter)

    expect(window.location.hash).toContain(`lat=${realCenter.lat}`)
    expect(window.location.hash).toContain(`lng=${realCenter.lng}`)
    expect(window.location.hash).not.toContain('lat=37')
    expect(window.location.hash).not.toContain('lng=128')
  })

  // MapSidebar 가 데스크톱 aside 와 모바일 바텀시트에 동시에 마운트된다(하나는 CSS 로만
  // 숨김, DOM 에서 사라지지 않음). showAd 게이팅이 없으면 두 사본이 동시에 AdBanner 를
  // 마운트해 adsbygoogle.push() 를 중복 호출한다(라이브에서 관측된 버그, availableWidth=0
  // 에러 + <ins class="adsbygoogle"> 3개). 뷰포트별로 정확히 1개만 남아야 한다.
  describe('인피드 광고 중복 방지 (RealEstateMapExplorer 이슈)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('데스크톱 뷰포트에서는 두 MapSidebar 사본 중 정확히 1개만 인피드 광고를 렌더한다', async () => {
      stubDesktopViewport(true)
      const w = mountExplorer()
      await nextTick()
      await nextTick()

      const adSlots = w.findAll(AD_SLOT_SELECTOR)
      expect(adSlots).toHaveLength(1)
      // 보이는 쪽(데스크톱 aside)에 있어야 한다 — hidden lg:block 조상 안.
      expect(w.find('aside').findAll(AD_SLOT_SELECTOR)).toHaveLength(1)
    })

    it('모바일 뷰포트에서는 두 MapSidebar 사본 중 정확히 1개만 인피드 광고를 렌더한다', async () => {
      stubDesktopViewport(false)
      const w = mountExplorer()
      await nextTick()
      await nextTick()

      const adSlots = w.findAll(AD_SLOT_SELECTOR)
      expect(adSlots).toHaveLength(1)
      // aside(데스크톱) 쪽엔 없어야 한다 — 바텀시트 사본에만 있어야 한다.
      expect(w.find('aside').findAll(AD_SLOT_SELECTOR)).toHaveLength(0)
    })

    it('마운트 직후(뷰포트 판정 전)에는 광고 슬롯이 최대 1개를 넘지 않는다 (합계 상한 가드)', () => {
      stubDesktopViewport(true)
      const w = mountExplorer()
      // await 없이 — onMounted 의 matchMedia 갱신이 아직 patch 로 반영되기 전 시점도
      // 두 사본 합쳐 광고가 2개 이상 뜨는 순간이 없어야 한다는 회귀 가드.
      expect(w.findAll(AD_SLOT_SELECTOR).length).toBeLessThanOrEqual(1)
    })
  })
})
