import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf-8')

/**
 * 주어진 User-agent 의 규칙 블록만 잘라낸다.
 * robots.txt 그룹은 다음 User-agent 줄에서 끝난다(연속된 User-agent 줄은 같은 그룹을 공유).
 * 그룹이 없으면 빈 문자열.
 */
function extractGroup(txt: string, ua: string): string {
  const lines = txt.split('\n')
  const out: string[] = []
  let inGroup = false
  let inHeader = false
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = /^User-agent:\s*(.+)$/i.exec(line)
    if (m) {
      const name = m[1].trim()
      if (inGroup && !inHeader) break // 다음 그룹 시작 → 종료
      if (name.toLowerCase() === ua.toLowerCase()) inGroup = true
      inHeader = true
      continue
    }
    inHeader = false
    // Sitemap 은 그룹 소속이 아닌 사이트 레벨 지시문이다(RFC 9309 "non-group record").
    // 파일 맨 끝에 있어서 걸러내지 않으면 마지막 그룹에 딸려 들어간다.
    if (/^Sitemap:/i.test(line)) continue
    if (inGroup) out.push(line)
  }
  return out.join('\n')
}

describe('robots.txt crawl policy', () => {
  it('Google rendering assets are crawlable while non-image API endpoints stay blocked', () => {
    expect(robots).toContain('Allow: /_nuxt/')
    expect(robots).toContain('Allow: /api/images/')
    expect(robots).toContain('Disallow: /api/')
  })

  it('aed detail stays crawlable so Google can read page-level robots meta', () => {
    expect(robots).not.toMatch(/^Disallow:\s*\/aed\/$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/aed\/aed-/m)
  })

  it('keeps wifi detail crawlable for search engines so the noindex meta can be re-verified', () => {
    // wifi 상세(/wifi/wifi-)는 영구 noindex 다. 그런데 noindex 는 크롤해야만 확인되므로
    // robots.txt 로 크롤을 막으면 이미 수집된 사본이 색인에 영구 고착된다.
    // 실측(2026-07-28 네이버 진단): wifi 657건이 중복 title 로 남아 있고 마지막 크롤이 06-29,
    // 7월 크롤 0건 — 크롤 차단이 회수 경로를 없앤 상태였다. 검색엔진에는 크롤을 허용한다.
    expect(extractGroup(robots, 'Yeti')).not.toContain('Disallow: /wifi/wifi-')
    expect(extractGroup(robots, '*')).not.toContain('Disallow: /wifi/wifi-')
    // 카테고리 허브(/wifi)와 지역 wifi 도 계속 크롤 허용.
    expect(robots).not.toMatch(/^Disallow:\s*\/wifi\/$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/wifi$/m)
  })

  it('keeps query pagination crawlable for every search engine so detail links stay reachable', () => {
    // 목록 2페이지 이후는 HTML 에서 이미 noindex, follow 다. 색인 비대는 noindex 가 막고 있고,
    // 그 페이지에 남는 유일한 가치는 "상세로 가는 링크 통로"다. robots 로 크롤을 막으면
    // 크롤러가 페이지를 가져올 수 없어 통로만 끊긴다.
    //
    // 2026-05-28 에 Yeti 에만 /*?page= 를 넣었다가(크롤 예산 절약 의도) 되돌린다.
    // 같은 실수를 wifi 상세에서 이미 했다 — 07-09 차단 → 색인 동결 → 07-28 해제(3c455d63).
    //
    // 실측 근거: 페이지네이션이 <button> 뿐이라 크롤 경로가 없던 동안 URL Inspection 표본
    // 225건 중 76.9% 가 'URL is unknown to Google' 이었고, 내부링크가 있는 페이지는
    // 65.7% 가 크롤된 반면 없는 페이지는 37.1% 였다(Fisher p=0.031).
    for (const ua of ['Yeti', '*']) {
      expect(extractGroup(robots, ua)).not.toContain('Disallow: /*?page=')
      expect(extractGroup(robots, ua)).not.toContain('Disallow: /*&page=')
    }
  })

  it('blocks Nuxt _payload.json from crawlers to reclaim crawl budget', () => {
    // payload URLs carry a ?<buildId> query, so no $ anchor — it would miss the query string.
    expect(robots).toContain('Disallow: /*_payload.json')
    expect(robots).not.toContain('Disallow: /*_payload.json$')
    // applied to the default (Googlebot) group and to Naver Yeti — robots groups do not inherit.
    expect(robots).toMatch(/User-agent:\s*\*[\s\S]*Disallow:\s*\/\*_payload\.json/)
    expect(robots).toMatch(/User-agent:\s*Yeti[\s\S]*Disallow:\s*\/\*_payload\.json/)
  })

  it('blocks /og-map for Google and AI crawlers to reclaim crawl budget', () => {
    // og-map 은 상세 페이지 og:image 가 가리키는 소셜 미리보기 생성 라우트다.
    // 상세마다 쿼리스트링이 달라 URL 이 전부 고유하므로 크롤러가 개별 리소스로 무한 수집한다.
    //
    // 실측(2026-08-26): Googlebot 요청 619건 중 og-map 이 163건(26.3%)으로 1위.
    // 응답이 837KB/0.411초라 바이트로는 og-map 136MB 대 실제 콘텐츠 20MB —
    // 크롤 대역폭의 약 87% 를 차지했다. 같은 기간 Googlebot 은 하루 318건만 왔고
    // (bingbot 7,717 / Yeti 8,777), 콘텐츠 페이지 전량 크롤에 약 4.9년이 걸리는 속도였다.
    //
    // 페이지가 아니라 바이너리 이미지이므로 wifi·페이지네이션 때와 달리 robots 차단이 옳은 도구다:
    // meta robots 가 없어 "크롤해야 noindex 를 확인한다"는 회수 경로 문제가 성립하지 않고,
    // 검색 결과에 나오지 않으므로 차단해도 잃는 색인 자산이 없다.
    expect(extractGroup(robots, '*')).toContain('Disallow: /og-map')
  })

  it('keeps /og-map crawlable for Naver Yeti — og:image is rendered, not indexed', () => {
    // 네이버는 og:image 를 실제로 가져가 검색 결과 카드에 렌더링한다(project_naver_seo_og_image).
    // 네이버가 유입의 약 89% 이므로 여기서 차단하면 크롤 예산보다 큰 것을 잃는다.
    // Yeti 쪽 비용은 차단이 아니라 응답 경량화로 다룬다.
    expect(extractGroup(robots, 'Yeti')).not.toContain('Disallow: /og-map')
  })

  it('keeps /og-map fetchable for social preview scrapers so share cards keep rendering', () => {
    // 이 스크레이퍼들은 자기 이름 그룹이 없으면 User-agent: * 를 따른다.
    // og-map 을 * 에서 차단하는 순간 카카오톡·페이스북·X 공유 미리보기가 통째로 깨진다.
    // 크롤러가 아니라 "공유 시점에 1회 가져가는" 소비자이므로 크롤 예산과 무관하다.
    const SOCIAL_SCRAPERS = ['kakaotalk-scrap', 'facebookexternalhit', 'Twitterbot']
    for (const ua of SOCIAL_SCRAPERS) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} group must exist`).not.toBe('')
      expect(group, `${ua} must reach og-map`).not.toContain('Disallow: /og-map')
      expect(group, `${ua} must reach the page body`).toContain('Allow: /')
    }
  })

  it('social scraper groups still block the non-public surface (groups do not inherit from *)', () => {
    // og-map 을 열어주려고 만든 그룹이 /api/ 와 /admin 까지 열어버리면 안 된다.
    // AI 크롤러 그룹에서 이미 겪은 함정과 동일하다.
    for (const ua of ['kakaotalk-scrap', 'facebookexternalhit', 'Twitterbot']) {
      const group = extractGroup(robots, ua)
      for (const rule of ['/api/', '/admin']) {
        expect(group, `${ua} must disallow ${rule}`).toContain(`Disallow: ${rule}`)
      }
    }
  })

  it('applies the crawl-budget Disallow set to every AI crawler group (groups do not inherit from *)', () => {
    // robots.txt 그룹은 상속되지 않는다 — 자기 이름 그룹이 있는 봇은 User-agent: * 를 통째로 무시한다.
    // AI 봇 그룹에 Allow: / 만 두면 _payload.json·wifi 상세 같은 차단 대상이 그 봇에게만 열린다.
    const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot']
    const REQUIRED_DISALLOW = ['/api/', '/*_payload.json', '/admin', '/wifi/wifi-', '/og-map']
    for (const ua of AI_CRAWLERS) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} group must exist`).not.toBe('')
      for (const rule of REQUIRED_DISALLOW) {
        expect(group, `${ua} must disallow ${rule}`).toContain(`Disallow: ${rule}`)
      }
      // 의도는 유지: AI 검색 노출을 위해 본문은 계속 허용한다.
      expect(group, `${ua} must still allow the site body`).toContain('Allow: /')
    }
  })

  it('AI crawler groups keep image/asset rendering allowed', () => {
    for (const ua of ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot']) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} keeps api images allowed`).toContain('Allow: /api/images/')
    }
  })

  it('blocks the Amazon crawler family — AI training crawl with no citation surface', () => {
    // Amazon 공식 문서: 수집 데이터가 "may be used to train Amazon AI models" 이고 Alexa 검색을 지원한다.
    // 즉 CCBot·Bytespider 와 같은 "훈련 전용" 범주다. GPTBot·PerplexityBot 을 허용한 근거는
    // AI 답변이 출처를 인용해 유입이 생긴다는 것인데, Alexa 는 한국 사용자에게 웹 출처를 보여주지 않는다.
    //
    // 실측(2026-08-26, 2일): Amazonbot 30,079 요청 = 이 사이트 최대 크롤러(Yeti 8,777/일·bingbot 7,717/일 상회).
    // 경로는 real-estate 6,712 · og-map 6,119 · wifi 2,974 · hospital 2,805 · childcare 2,039.
    // crawl-delay 를 지원하지 않아 속도 조절 수단도 없다.
    //
    // IVT 와는 무관하다 — _nuxt 번들 요청이 30,079건 중 2건뿐인 순수 HTML 페처라
    // 애드센스 스크립트를 로드하지 않고 광고 노출을 만들지 않는다(Googlebot 은 대조적으로 142건).
    // 따라서 차단 근거는 광고 수익 보호가 아니라 순수 서버 부하다.
    //
    // 차단으로 잃는 것은 문서에 적힌 "Amazon Content Partners" 자격(어필리에이트 커미션 부스트·
    // 호스팅 크레딧)뿐인데, 이 사이트는 애드센스 퍼블리셔라 해당되지 않는다.
    expect(robots).toMatch(/User-agent:\s*Amazonbot\s+Disallow:\s*\//)
    // 계열 봇도 함께 막는다 — Amazonbot 그룹은 Amzn-SearchBot 에 적용되지 않는다(실측 101건).
    expect(robots).toMatch(/User-agent:\s*Amzn-SearchBot\s+Disallow:\s*\//)
  })

  it('does not leave the Amazon groups partially open (Disallow: / must be the whole group)', () => {
    // Allow: / 가 섞이면 전면 차단 의도가 깨진다. CCBot·Bytespider 와 같은 형태여야 한다.
    for (const ua of ['Amazonbot', 'Amzn-SearchBot']) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} group must exist`).not.toBe('')
      expect(group, `${ua} must be a full block`).toBe('Disallow: /')
    }
  })

  it('keeps AdSense crawlers able to read page bodies — this site monetizes with AdSense', () => {
    // Mediapartners-Google 은 광고 관련성 판정을 위해 본문을 읽어야 한다. 전용 그룹이 없으면
    // User-agent: * 를 따르므로, * 의 Disallow 가 본문을 막지 않는지 확인한다.
    // (/og-map·/api/·/*_payload.json·/admin 은 광고 타겟팅에 필요한 본문이 아니다.)
    const star = extractGroup(robots, '*')
    expect(star).toContain('Allow: /')
    for (const ua of ['Mediapartners-Google', 'AdsBot-Google']) {
      const own = extractGroup(robots, ua)
      // 전용 그룹을 두는 것도 허용하지만, 두는 순간 전면 차단이 되어선 안 된다.
      if (own !== '') expect(own, `${ua} must not be fully blocked`).not.toBe('Disallow: /')
    }
  })

  it('allows Google-Extended (AI search visibility) and blocks training-only scrapers', () => {
    // Google-Extended is intentionally allowed — its rule must not contradict the surrounding comment.
    expect(robots).toMatch(/User-agent:\s*Google-Extended\s+Allow:\s*\//)
    expect(robots).not.toMatch(/User-agent:\s*Google-Extended\s+Disallow:\s*\//)
    // training-only scrapers stay blocked
    expect(robots).toMatch(/User-agent:\s*CCBot\s+Disallow:\s*\//)
    expect(robots).toMatch(/User-agent:\s*Bytespider\s+Disallow:\s*\//)
  })
})
