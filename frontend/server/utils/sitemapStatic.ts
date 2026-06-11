import { readFile } from 'node:fs/promises'
import { getHeader, setHeader, type H3Event } from 'h3'

export const REGEN_TOKEN_HEADER = 'x-sitemap-regen-token'

/** SITEMAP_DIR env. 미설정이면 빈 문자열 → 디스크 서빙 비활성(동적 폴백). */
export function getSitemapDir(): string {
  return (process.env.SITEMAP_DIR || '').replace(/\/+$/, '')
}

/** 요청 path(쿼리 포함 가능)를 SITEMAP_DIR 하위 파일 경로로 매핑. 안전하지 않으면 null. */
export function resolveSitemapFile(reqPath: string, dir: string): string | null {
  const pathname = reqPath.split('?')[0]
  if (!pathname.endsWith('.xml')) return null
  // 디코드 후 '..' 또는 비정상 문자 차단
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.length > 64) return null
  if (decoded.includes('..') || decoded.includes('\0')) return null
  // 허용: /sitemap.xml, /sitemap/<name>.xml  (영숫자/하이픈만)
  if (!/^\/sitemap(\/[a-z0-9-]+)?\.xml$/.test(decoded)) return null
  return `${dir}${decoded}`
}

/** X-Sitemap-Regen-Token 헤더가 SITEMAP_REGEN_TOKEN과 일치하는지. 토큰 미설정 시 항상 false. */
export function isRegenRequest(event: H3Event): boolean {
  const token = process.env.SITEMAP_REGEN_TOKEN
  if (!token) return false
  return getHeader(event, REGEN_TOKEN_HEADER) === token
}

/**
 * 디스크에 사전생성된 sitemap이 있으면 그 내용을 반환(+content-type 설정), 없으면 null.
 * null 반환 시 호출부는 기존 동적 로직으로 폴백한다.
 */
export async function tryServeStaticSitemap(event: H3Event): Promise<string | null> {
  const dir = getSitemapDir()
  if (!dir) return null
  const filePath = resolveSitemapFile(event.path || '', dir)
  if (!filePath) return null
  try {
    const xml = await readFile(filePath, 'utf-8')
    setHeader(event, 'Content-Type', 'application/xml')
    setHeader(event, 'X-Sitemap-Source', 'static')
    return xml
  } catch {
    return null
  }
}
