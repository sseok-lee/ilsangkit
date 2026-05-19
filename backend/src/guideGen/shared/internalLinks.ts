const CATEGORY_LINKS: Record<string, readonly string[]> = {
  'apt-sale': ['/real-estate/apt-sale'],
  'apt-rent': ['/real-estate/apt-rent'],
  'villa-sale': ['/real-estate/villa-sale'],
  'villa-rent': ['/real-estate/villa-rent'],
  'offitel-sale': ['/real-estate/offitel-sale'],
  'offitel-rent': ['/real-estate/offitel-rent'],
  'subscription': ['/subscription'],
  'public-rental': ['/public-rental'],
  'pharmacy': ['/pharmacy'],
  'hospital': ['/hospital'],
  'parking': ['/parking'],
  'ev-charger': ['/ev-charger'],
  'aed': ['/aed'],
  'toilet': ['/toilet'],
  'park': ['/park'],
  'library': ['/library'],
  'school': ['/school'],
  'childcare': ['/childcare'],
  'market': ['/market'],
};

export function allowedLinksFor(category: string): readonly string[] {
  return CATEGORY_LINKS[category] ?? [];
}

export function isAllowedLink(path: string, category: string): boolean {
  return allowedLinksFor(category).includes(path);
}
