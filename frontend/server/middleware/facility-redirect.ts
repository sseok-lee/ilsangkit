import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'
import REDIRECT_MAP from '../data/facilityRedirects.json'

/**
 * 고아 시설 상세 URL → 현행 URL 301.
 *
 * ## 왜 필요한가
 *
 * 시설 sourceId 는 카테고리마다 재료가 다르고, 그 재료가 원천에서 바뀌면 같은 시설이
 * 새 sourceId 로 INSERT 되고 옛 행은 갱신되지 않은 채 남는다. 두 URL 이 각각 200 ·
 * index · 자기참조 canonical 로 살아 있어 중복 콘텐츠가 된다.
 *
 * 2026-07-01 전남광주통합특별시 출범이 방아쇠였다. SyncHistory 실측:
 *   sports  2026-06-19 신규   311 / 갱신 34,292
 *   sports  2026-07-14 신규 4,153 / 갱신 30,372   ← 여기서 갈라짐
 *   school  2026-07-14 신규 1,215 / 갱신 11,329
 *
 * 원인은 카테고리별로 다르다:
 *   - sports : sourceId = md5(이름 + 주소) → 원천의 주소 값 변경으로 해시가 달라짐
 *   - school : sourceId = NEIS SD_SCHUL_CODE → 원천이 코드를 재발급 (8490311 → 7140155)
 *   - toilet : sourceId = md5(govCode + mngNo) → 원천이 관리번호를 재부여
 * 뒤의 두 경우는 안정키를 썼는데도 갈렸다 — 원천이 키를 바꾸면 우리가 막을 수 없다.
 *
 * ## 매핑 산출 기준 (facilityRedirects.json)
 *
 * 고아 = syncedAt < (테이블 최종 syncedAt − 1일). sync 가 건드리지 않은 행 = 원천이 주지 않는 행.
 * 짝   = (이름, 구, 시도명 제외 주소, 카테고리별 구별자) 공백무시 완전일치 + 양방향 유일성.
 *        구별자는 Aed.buildPlace · Clothes.detailLocation · Toilet.facilityType.
 * 라이브 44개 표본 검증: 둘 다 200 44/44, title 동일 42/44(상이 2건은 이름 띄어쓰기 차이).
 *
 * ev-charger 는 제외했다 — 행 id 는 `ev-charger-{statId}-{충전기번호}` 인데 URL 은
 * `/ev-charger/{statId}` 라 행 단위 매핑이 URL 에 대응하지 않는다.
 *
 * 짝을 찾지 못한 고아는 이 매핑에 넣지 않았다. Childcare 처럼 sync 커버리지 결함으로
 * 낡은 행이 실존 시설인 경우가 섞여 있어 일괄 410 은 위험하다.
 */
const REDIRECTS = REDIRECT_MAP as Record<string, string>

/** `/{category}/{id}` 형태만 대상. 목록(1세그먼트)·지역(3세그먼트)·부동산은 제외된다. */
const DETAIL_PATH = /^\/([a-z-]+)\/([a-z-]+-[A-Za-z0-9_-]+)\/?$/

/**
 * 고아 시설 URL 이면 현행 경로를, 아니면 null 을 반환한다.
 * 카테고리 세그먼트가 id 접두와 일치할 때만 치환해 오작동을 막는다.
 */
export function resolveFacilityRedirect(pathname: string): string | null {
  const m = DETAIL_PATH.exec(pathname)
  if (!m) return null

  const [, category, id] = m
  if (!id.startsWith(`${category}-`)) return null

  const target = REDIRECTS[id]
  if (!target) return null

  return `/${category}/${target}`
}

export default defineEventHandler((event) => {
  const method = event.method
  if (method !== 'GET' && method !== 'HEAD') return

  const url = getRequestURL(event)
  const target = resolveFacilityRedirect(url.pathname)
  if (!target) return

  return sendRedirect(event, `${target}${url.search}`, 301)
})
