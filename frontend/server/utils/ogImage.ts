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
  kiosk: '#f97316',    // orange-500
  parking: '#0ea5e9',  // sky-500
  aed: '#ef4444',      // red-500
  library: '#f59e0b',  // amber-500
  hospital: '#14b8a6', // teal-500
  pharmacy: '#10b981', // emerald-500
}

const FALLBACK_COLOR = '#6366f1' // indigo-500

export interface OgImageOptions {
  category: FacilityCategory | string
  title: string
  city?: string
  district?: string
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
  const { category, city, district } = options
  const meta = CATEGORY_META[category as FacilityCategory]
  const bgColor = CATEGORY_COLORS[category as FacilityCategory] ?? FALLBACK_COLOR

  // title fallback: empty string → use category label
  const title = options.title || meta?.label || String(category)
  const categoryLabel = meta?.label || String(category)

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
