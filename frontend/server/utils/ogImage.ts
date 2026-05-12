import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

// 카테고리별 배경색 (hex)
export const CATEGORY_COLORS: Record<FacilityCategory, string> = {
  toilet: '#3b82f6',   // blue-500
  trash: '#ef4444',    // red-500
  wifi: '#22c55e',     // green-500
  clothes: '#a855f7',  // purple-500
  parking: '#0ea5e9',  // sky-500
  aed: '#ef4444',      // red-500
  library: '#f59e0b',  // amber-500
  hospital: '#14b8a6', // teal-500
  pharmacy: '#10b981', // emerald-500
  park: '#22c55e',     // green-500
  school: '#6366f1',   // indigo-500
  market: '#f97316',   // orange-500
  childcare: '#ec4899', // pink-500
  'ev-charger': '#14b8a6', // teal-500
  sports: '#06b6d4',    // cyan-500
  subway: '#64748b',    // slate-500
}

// 부동산 카테고리 색상/라벨
export const REAL_ESTATE_COLORS: Record<string, string> = {
  apt: '#2563eb',      // blue-600
  villa: '#7c3aed',    // violet-600
  offitel: '#0d9488',  // teal-600
}

export const REAL_ESTATE_LABELS: Record<string, string> = {
  apt: '아파트 실거래가',
  villa: '빌라 실거래가',
  offitel: '오피스텔 실거래가',
}

export const SPECIAL_OG_LABELS: Record<string, string> = {
  area: '지역 생활 정보',
}

export const SPECIAL_OG_COLORS: Record<string, string> = {
  area: '#2563eb',
}

const FALLBACK_COLOR = '#6366f1' // indigo-500

export interface OgImageOptions {
  category: FacilityCategory | string
  title: string
  city?: string
  district?: string
}

function sanitizeForSvg(str: string, maxLen = 100): string {
  return str
    .slice(0, maxLen)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control chars
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateOgImageSvg(options: OgImageOptions): string {
  const { category } = options
  const city = options.city ? sanitizeForSvg(options.city, 30) : undefined
  const district = options.district ? sanitizeForSvg(options.district, 30) : undefined
  const meta = CATEGORY_META[category as FacilityCategory]
  const bgColor = CATEGORY_COLORS[category as FacilityCategory]
    ?? REAL_ESTATE_COLORS[category]
    ?? SPECIAL_OG_COLORS[category]
    ?? FALLBACK_COLOR

  // title fallback: empty string → use category label
  const title = sanitizeForSvg(options.title || meta?.label || REAL_ESTATE_LABELS[category] || SPECIAL_OG_LABELS[category] || String(category), 80)
  const categoryLabel = meta?.label ?? REAL_ESTATE_LABELS[category] ?? SPECIAL_OG_LABELS[category] ?? String(category)

  const locationParts: string[] = []
  if (city) locationParts.push(city)
  if (district) locationParts.push(district)
  const locationText = locationParts.join(' ')

  // Darken the bg for gradient bottom
  const svgTitle = escapeXml(title)
  const svgCategory = escapeXml(categoryLabel)
  const svgLocation = escapeXml(locationText)
  const siteName = escapeXml('일상킷')

  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bgColor}" stop-opacity="0.75"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <!-- Decorative circle -->
  <circle cx="1050" cy="80" r="200" fill="white" fill-opacity="0.08"/>
  <circle cx="150" cy="550" r="150" fill="white" fill-opacity="0.06"/>
  <!-- Site name -->
  <text x="80" y="80" font-family="sans-serif" font-size="32" font-weight="700" fill="white" fill-opacity="0.9">${siteName}</text>
  <!-- Category label -->
  <text x="80" y="160" font-family="sans-serif" font-size="40" font-weight="600" fill="white" fill-opacity="0.85">${svgCategory}</text>
  <!-- Title -->
  <text x="80" y="340" font-family="sans-serif" font-size="72" font-weight="800" fill="white">${svgTitle}</text>
  <!-- Location -->
  ${svgLocation ? `<text x="80" y="430" font-family="sans-serif" font-size="40" font-weight="400" fill="white" fill-opacity="0.8">${svgLocation}</text>` : ''}
  <!-- Bottom bar -->
  <rect x="0" y="580" width="${OG_WIDTH}" height="50" fill="black" fill-opacity="0.2"/>
  <text x="80" y="614" font-family="sans-serif" font-size="28" font-weight="500" fill="white" fill-opacity="0.7">ilsangkit.co.kr - 내 주변 생활 편의 정보</text>
</svg>`
}
