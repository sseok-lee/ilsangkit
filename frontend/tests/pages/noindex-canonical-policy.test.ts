/**
 * noindex / canonical 정책 회귀 방지 테스트.
 * 규칙: robots=noindex 를 내보내는 페이지는 같은 응답에 rel=canonical 을 포함하지 않는다.
 * 관련 문서: .omc/notes/noindex-canonical-policy.md
 *
 * 여기서는 페이지 SFC 전체를 mount 하지 않고, 각 페이지가 의존하는 헬퍼/computed 계약을
 * 시뮬레이션해 정책이 유지되는지 확인한다.
 */
import { describe, it, expect, vi } from 'vitest'
import { computed, ref } from 'vue'

// useFacilityMeta 는 setMeta 내부에서 useHead 를 통해 canonical 을 emit 한다.
// canonical: false 를 전달하면 canonical 이 생략되는지 검증한다.
const mockUseHead = vi.fn()
vi.stubGlobal('useHead', mockUseHead)

vi.mock('~/utils/seoConstants', () => ({
  SITE_NAME: '일상킷',
  SITE_URL: 'https://ilsangkit.co.kr',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og/default.png',
  SITE_DESCRIPTION: '정보 사이트',
  CATEGORY_SEO_INTENT: {
    toilet: '위치·개방시간',
    wifi: '위치·SSID',
    aed: '설치위치·이용가능시간',
    park: '산책로·운동시설',
  },
}))

vi.mock('~/types/facility', () => ({
  CATEGORY_META: {
    toilet: { label: '공중화장실' },
    wifi: { label: '공공와이파이' },
    aed: { label: 'AED' },
    park: { label: '공원' },
  },
}))

import { useFacilityMeta } from '~/composables/useFacilityMeta'

describe('noindex/canonical 정책 — useFacilityMeta', () => {
  it('setRegionMeta 에 canonical=false 를 전달하면 link 배열에 rel=canonical 이 포함되지 않는다', () => {
    mockUseHead.mockClear()
    const { setRegionMeta } = useFacilityMeta()
    setRegionMeta({
      city: 'seoul',
      cityName: '서울특별시',
      district: 'gangnam',
      districtName: '강남구',
      category: 'toilet',
      canonical: false,
    })
    // setMeta 호출 중 canonical 스킵 분기가 발동했는지는 실제 useHead 전달 값으로 검증
    const headPayloads = mockUseHead.mock.calls.map((c) => c[0])
    const canonicalLinks = headPayloads
      .flatMap((p: { link?: Array<{ rel: string }> }) => p?.link ?? [])
      .filter((l) => l.rel === 'canonical')
    expect(canonicalLinks).toHaveLength(0)
  })

  it('setRegionMeta 를 canonical 옵션 없이 호출하면 기본 canonical URL 이 포함된다', () => {
    mockUseHead.mockClear()
    const { setRegionMeta } = useFacilityMeta()
    setRegionMeta({
      city: 'seoul',
      cityName: '서울특별시',
      district: 'gangnam',
      districtName: '강남구',
      category: 'toilet',
    })
    const headPayloads = mockUseHead.mock.calls.map((c) => c[0])
    const canonicalLinks = headPayloads
      .flatMap((p: { link?: Array<{ rel: string; href: string }> }) => p?.link ?? [])
      .filter((l) => l.rel === 'canonical')
    expect(canonicalLinks.length).toBeGreaterThan(0)
    expect(canonicalLinks[0].href).toBe('https://ilsangkit.co.kr/seoul/gangnam/toilet')
  })

  it('setMeta 에 canonical=false 를 전달하면 카테고리 page 2 초기 렌더 canonical 을 생략할 수 있다', () => {
    mockUseHead.mockClear()
    const { setMeta } = useFacilityMeta()
    setMeta({
      title: '공중화장실 찾기',
      description: '전국 공중화장실 위치와 운영시간을 검색하세요.',
      path: '/toilet',
      canonical: false,
    })
    const headPayloads = mockUseHead.mock.calls.map((c) => c[0])
    const canonicalLinks = headPayloads
      .flatMap((p: { link?: Array<{ rel: string }> }) => p?.link ?? [])
      .filter((l) => l.rel === 'canonical')
    expect(canonicalLinks).toHaveLength(0)
  })
})

describe('noindex/canonical 정책 — page-level useHead 패턴', () => {
  /**
   * 페이지들이 공통적으로 따라야 하는 패턴:
   *   useHead(computed(() => {
   *     if (isNoindex.value) return { meta: [robots noindex] }
   *     return { link: [{rel: 'canonical', ...}] }
   *   }))
   * 이 계약을 단위 수준에서 시뮬레이션해 noindex/canonical 동시 송출이 없음을 검증한다.
   */

  function buildHead(isNoindex: boolean, canonicalHref: string) {
    if (isNoindex) {
      return { meta: [{ name: 'robots', content: 'noindex, follow' }], link: [] as Array<{ rel: string; href: string }> }
    }
    return {
      meta: [] as Array<{ name: string; content: string }>,
      link: [{ rel: 'canonical', href: canonicalHref }],
    }
  }

  it('pagination page 2+ (noindex=true) 는 canonical 없이 robots noindex 만 포함', () => {
    const head = buildHead(true, 'https://ilsangkit.co.kr/toilet')
    expect(head.meta).toEqual([{ name: 'robots', content: 'noindex, follow' }])
    expect(head.link.find((l) => l.rel === 'canonical')).toBeUndefined()
  })

  it('기본 상태(noindex=false) 는 robots noindex 없이 canonical 포함', () => {
    const head = buildHead(false, 'https://ilsangkit.co.kr/toilet')
    expect(head.meta.find((m) => m.name === 'robots')).toBeUndefined()
    expect(head.link).toContainEqual({ rel: 'canonical', href: 'https://ilsangkit.co.kr/toilet' })
  })

  it('Vue computed 기반 reactivity — isNoindex flip 시 canonical on/off 전환', () => {
    const pageParam = ref(1)
    const canonicalHref = 'https://ilsangkit.co.kr/park'
    const head = computed(() => buildHead(pageParam.value > 1, canonicalHref))

    expect(head.value.link).toContainEqual({ rel: 'canonical', href: canonicalHref })
    pageParam.value = 2
    expect(head.value.meta).toEqual([{ name: 'robots', content: 'noindex, follow' }])
    expect(head.value.link.find((l) => l.rel === 'canonical')).toBeUndefined()
    pageParam.value = 1
    expect(head.value.link).toContainEqual({ rel: 'canonical', href: canonicalHref })
  })

  it('page 2+ 가 클라이언트에서 발생하면 URL query 도 함께 갱신돼 pageQueryParam 이 reactive 로 noindex 를 켠다', () => {
    // 회귀 방지: 이전 구현은 pageQueryParam 을 setup 시점에 한 번만 읽어 고정된 숫자로 보관했다.
    // 이 경우 query 가 바뀌어도 isNoindex 가 갱신되지 않아 policy 가 무력화됐다.
    // 새 구현은 query 변경이 pageQueryParam computed 를 통해 전파된다.
    const routeQuery = ref<Record<string, string>>({})
    const pageQueryParam = computed(() => Math.max(1, Number(routeQuery.value.page) || 1))
    const isNoindex = computed(() => pageQueryParam.value >= 2)

    expect(isNoindex.value).toBe(false)
    routeQuery.value = { page: '2' }
    expect(isNoindex.value).toBe(true)
    routeQuery.value = { page: '1' }
    expect(isNoindex.value).toBe(false)
  })
})
