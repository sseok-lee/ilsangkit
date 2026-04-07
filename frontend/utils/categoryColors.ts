/**
 * Canonical category color map.
 * Source of truth: tailwind.config.js category colors + extended set.
 * Import this in any component that needs category-specific colors.
 */
export const CATEGORY_MARKER_COLORS: Record<string, string> = {
  toilet: '#8b5cf6',   // purple — matches tailwind.config.js
  trash: '#10b981',    // emerald — matches tailwind.config.js
  wifi: '#f59e0b',     // amber — matches tailwind.config.js
  clothes: '#ec4899',  // pink — matches tailwind.config.js
  parking: '#0ea5e9',  // sky
  aed: '#ef4444',      // red
  library: '#d97706',  // amber-600
  park: '#22c55e',     // green
  school: '#6366f1',   // indigo
  market: '#f97316',   // orange
  hospital: '#3b82f6', // blue
  pharmacy: '#14b8a6', // teal
  childcare: '#f472b6',// pink-400
  'ev-charger': '#06b6d4', // cyan
  sports: '#8b5cf6',   // purple
}

export function getMarkerColor(category: string): string {
  return CATEGORY_MARKER_COLORS[category] || '#3b82f6'
}
