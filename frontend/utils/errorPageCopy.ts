import { CATEGORY_META, FACILITY_CATEGORIES, type FacilityCategory } from '~/types/facility'

/**
 * 에러 페이지 문구·탈출구 판정 (순수 함수).
 *
 * 배경 — error.vue 는 `statusCode === 404` 만 분기하고 나머지를 전부 500 폴백으로
 * 떨어뜨렸다. 2026-08-27 폐원 어린이집 31,092건이 FacilityGone 에 등록되면서(#753·#755)
 * 그 URL 들이 410 을 내기 시작했고, 네이버에 색인된 상세 URL 로 들어온 사용자는
 *   "오류가 발생했습니다 / 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
 * 를 봤다. 410 은 영구 응답이라 재시도해도 같은 화면이므로 문구가 사실과 다르고,
 * 탈출구(재검색·바로가기)가 404 전용이어서 "홈으로" 버튼 하나만 남았다.
 * GA4 실측(속성 525300908): 8/27 9건 → 8/28 22건, 유입원은 거의 전부 네이버.
 *
 * 그래서 상태코드를 세 갈래로 나눈다.
 *  - gone(410)      : 영구 제거. 폐업·폐원 사실을 알리고 같은 카테고리 목록으로 보낸다.
 *  - not-found(404) : 기존 동작 유지.
 *  - error(5xx 등)  : 일시 장애. 재시도가 정답이므로 탈출구를 띄우지 않는다.
 */
export type ErrorPageKind = 'not-found' | 'gone' | 'error'

export interface ErrorPageCopyInput {
  statusCode?: number
  /**
   * 410 일 때 어느 시설의 URL 이었는지. 경로에서 resolveSearchScope 로 뽑아 넘긴다.
   * 시설 카테고리로 확정되지 않으면 null — 문구를 시설 기준으로 단정하지 않는다.
   */
  facilityCategory?: FacilityCategory | null
}

export interface ErrorPageCopy {
  kind: ErrorPageKind
  title: string
  description: string
  /** 재검색 폼·카테고리 바로가기 노출 여부. 영구 응답(404·410)만 켠다. */
  showRecovery: boolean
  /** 410 + 카테고리 확정 시의 목록 CTA. 그 외 null. */
  categoryCta: { href: string; label: string } | null
}

export function resolveErrorPageCopy(input: ErrorPageCopyInput): ErrorPageCopy {
  const statusCode = input.statusCode ?? 500

  if (statusCode === 410) {
    const category = input.facilityCategory ?? null
    const meta = category ? CATEGORY_META[category] : undefined

    // 카테고리를 못 뽑은 410 은 시설이라고 단정하지 않는다(gone.ts 처럼 다른 출처가
    // 늘어날 수 있다). 문구만 일반화하고 gone 의미와 탈출구는 그대로 유지한다.
    if (!category || !meta) {
      return {
        kind: 'gone',
        title: '삭제된 페이지입니다',
        description: '요청하신 정보는 원본 공공데이터에서 영구히 제거되었습니다.',
        showRecovery: true,
        categoryCta: null,
      }
    }

    return {
      kind: 'gone',
      title: '운영이 종료된 시설입니다',
      // reason 은 전량 'closed' 지만 통합·전환도 같은 경로로 들어올 수 있어 함께 적는다.
      description: `폐업·폐원 또는 통합되어 공공데이터에서 제거된 ${meta.label} 정보입니다.`,
      showRecovery: true,
      categoryCta: { href: `/${category}`, label: `${meta.shortLabel} 전체 보기` },
    }
  }

  if (statusCode === 404) {
    return {
      kind: 'not-found',
      title: '페이지를 찾을 수 없습니다',
      description: '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.',
      showRecovery: true,
      categoryCta: null,
    }
  }

  return {
    kind: 'error',
    title: '오류가 발생했습니다',
    description: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    showRecovery: false,
    categoryCta: null,
  }
}

/**
 * Nuxt 가 error.vue 에 넘기는 에러 객체에서 경로만 뽑는다.
 *
 * error.url 을 1순위로 쓴다 — 프로덕션 410 페이로드 실측에서 확인된 값이다.
 *   "error",{"url":"/childcare/childcare-27230000317","statusCode":410,...}
 * useRoute() 는 치명적 에러 때 라우터가 해소되기 전 값일 수 있어 fallback 으로만 쓴다.
 * 어느 쪽도 없으면 '/' — 에러 페이지가 스스로 던지면 안 되므로 절대 throw 하지 않는다.
 */
export function errorPagePath(
  error?: { url?: string } | null,
  fallbackPath?: string,
): string {
  const raw = error?.url || fallbackPath || ''
  if (!raw) return '/'
  // 절대 URL·쿼리·해시를 떼고 pathname 만 남긴다.
  const withoutOrigin = raw.replace(/^[a-z]+:\/\/[^/]+/i, '')
  const pathname = withoutOrigin.split(/[?#]/)[0]
  return pathname || '/'
}

const FACILITY_CATEGORY_SET: ReadonlySet<string> = new Set(FACILITY_CATEGORIES)

/**
 * 경로 첫 세그먼트가 시설 카테고리면 그것을 돌려준다.
 *
 * resolveSearchScope 를 재사용하지 않는다 — 그쪽은 subway 를 의도적으로 시설 스코프에서
 * 제외해(역 그룹 단위라 키워드 검색 대상이 아님) 부동산으로 떨어뜨리는데, 여기서는
 * "어느 카테고리의 상세였나" 를 알아야 하므로 subway 도 포함해야 한다.
 */
export function facilityCategoryFromPath(path: string): FacilityCategory | null {
  const first = (path || '').split('/').filter(Boolean)[0]
  if (first && FACILITY_CATEGORY_SET.has(first)) return first as FacilityCategory
  return null
}
