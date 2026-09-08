import { defineEventHandler, setResponseStatus, getRequestURL } from 'h3'
import GONE_FACILITIES from '../data/goneFacilities.json'

// 제거된 카테고리 — 410 Gone으로 색인 제거 유도
const GONE_PREFIXES = ['/kiosk/', '/public-rental/', '/lh-rental/']
const GONE_SUFFIXES = ['/kiosk', '/public-rental', '/lh-rental']

/**
 * 원천에서 사라진 개별 시설 id.
 *
 * 학교 데이터를 NEIS 단일 소스로 재구성하면서 NEIS 현재 목록에 없는 113건을 삭제했다
 * (폐교·통폐합, 학력인정 평생학교·공동실습소). 대응 학교가 없어 갈 곳이 없으므로
 * 301 이 아니라 410 이다. 같은 학교의 다른 URL 로 옮겨간 1,594건은
 * facilityRedirects.json 이 301 로 처리한다 — 두 목록은 배타적이어야 한다(테스트로 고정).
 */
const GONE_FACILITY_IDS = new Set(GONE_FACILITIES as string[])

/** `/{category}/{id}` 형태만 대상. 목록(1세그먼트)·지역(3세그먼트)은 제외된다. */
const DETAIL_PATH = /^\/([a-z-]+)\/([a-z-]+-[A-Za-z0-9_-]+)\/?$/

/**
 * 이 경로가 의도적으로 제거된 URL 인지.
 * 카테고리 세그먼트가 id 접두와 일치할 때만 시설 목록을 적용해 오작동을 막는다.
 */
export function isGonePath(pathname: string): boolean {
  if (
    GONE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    GONE_SUFFIXES.some((s) => pathname.endsWith(s))
  ) {
    return true
  }

  const m = DETAIL_PATH.exec(pathname)
  if (!m) return false

  const [, category, id] = m
  if (!id.startsWith(`${category}-`)) return false

  return GONE_FACILITY_IDS.has(id)
}

export default defineEventHandler((event) => {
  if (!isGonePath(getRequestURL(event).pathname)) return

  setResponseStatus(event, 410)
  return 'Gone'
})
