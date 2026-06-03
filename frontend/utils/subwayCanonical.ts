import { SITE_URL } from '~/utils/seoConstants'

export function subwayCanonicalUrl(slug: string): string {
  return slug ? `${SITE_URL}/subway/${slug}` : `${SITE_URL}/subway`
}
