import { ValidationError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';
import {
  type BrowseCategory,
  type BrowseGroup,
  type BrowseItem,
  type BrowseResult,
  type FacilityBrowseInput,
} from '../schemas/facilityBrowse.js';
import { CITY_SLUG_TO_FULL, cityVariantList } from './cityMapping.js';
import { ALL_CATEGORIES, mapWasteAreaToBrowseItem, searchInExplicitRegion } from './facilityService.js';
import { listStationsGrouped } from './subwayService.js';
import { isWasteAreaDiscoveryEnabled, listWasteAreas } from './wasteAreaService.js';

const BROWSE_CATEGORIES: BrowseCategory[] = [...ALL_CATEGORIES, 'trash', 'subway'];

const BROWSE_LABELS: Record<BrowseCategory, string> = {
  toilet: '공공화장실',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  parking: '공영주차장',
  aed: '자동심장충격기',
  library: '공공도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '전통시장',
  trash: '쓰레기배출',
  childcare: '어린이집',
  'ev-charger': '전기차충전소',
  sports: '체육시설',
  subway: '지하철역',
};

const BROWSE_UNITS: Record<BrowseCategory, BrowseGroup['unit']> = {
  toilet: '시설',
  wifi: '장소',
  clothes: '시설',
  parking: '시설',
  aed: '시설',
  library: '시설',
  hospital: '시설',
  pharmacy: '시설',
  park: '시설',
  school: '시설',
  market: '시설',
  trash: '일정',
  childcare: '시설',
  'ev-charger': '충전소',
  sports: '시설',
  subway: '역',
};

export async function resolveBrowseRegion(
  citySlug: string,
  districtSlug: string,
): Promise<{ citySlug: string; city: string; district: string }> {
  const fullCityName = CITY_SLUG_TO_FULL[citySlug];
  if (!fullCityName) {
    throw new ValidationError('unknown city slug');
  }

  const region = await prisma.region.findFirst({
    where: {
      city: { in: cityVariantList(fullCityName) },
      slug: districtSlug,
    },
    select: { city: true, district: true, slug: true },
  });

  if (!region) {
    throw new ValidationError('district does not belong to city');
  }

  return {
    citySlug,
    city: region.city,
    district: region.district,
  };
}

type ResolvedBrowseRegion = Awaited<ReturnType<typeof resolveBrowseRegion>>;

function toSubwayBrowseItem(station: Awaited<ReturnType<typeof listStationsGrouped>>['items'][number]): BrowseItem {
  return {
    id: station.nameSlug,
    category: 'subway',
    name: station.name,
    address: station.address,
    roadAddress: station.roadAddress,
    lat: station.lat,
    lng: station.lng,
    extras: {
      primaryLine: station.primaryLine,
      lines: station.lines,
      operator: station.operator,
    },
  };
}

async function readBrowseCategory(
  input: FacilityBrowseInput,
  category: BrowseCategory,
  region: ResolvedBrowseRegion,
): Promise<Extract<BrowseResult, { mode: 'list' }>> {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  if (category === 'subway') {
    const result = await listStationsGrouped({
      citySlug: region.citySlug,
      district: region.district,
      keyword: input.keyword,
      page,
      limit,
    });
    return {
      mode: 'list',
      category,
      unit: BROWSE_UNITS[category],
      items: result.items.map(toSubwayBrowseItem),
      total: result.total,
      page: result.page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  if (category === 'trash') {
    if (!isWasteAreaDiscoveryEnabled()) {
      const result = await searchInExplicitRegion({
        category,
        city: region.city,
        district: region.district,
        keyword: input.keyword,
        page,
        limit,
        departments: input.departments,
      });
      return {
        mode: 'list',
        category,
        unit: BROWSE_UNITS[category],
        items: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    const result = await listWasteAreas({
      city: region.city,
      district: region.district,
      keyword: input.keyword,
      page,
      limit,
    });
    return {
      mode: 'list',
      category,
      unit: '지역',
      items: result.items.map(mapWasteAreaToBrowseItem),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  const result = await searchInExplicitRegion({
    category,
    city: region.city,
    district: region.district,
    keyword: input.keyword,
    page,
    limit,
    departments: input.departments,
  });

  return {
    mode: 'list',
    category,
    unit: BROWSE_UNITS[category],
    items: result.items,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
}

export async function browseFacilities(input: FacilityBrowseInput): Promise<BrowseResult> {
  const region = await resolveBrowseRegion(input.city, input.district);

  if (input.category) {
    return readBrowseCategory(input, input.category, region);
  }

  const lists = await Promise.all(
    BROWSE_CATEGORIES.map((category) =>
      readBrowseCategory({ ...input, page: 1, limit: 3 }, category, region)
    ),
  );

  const order = new Map(BROWSE_CATEGORIES.map((category, index) => [category, index]));
  const groups = lists
    .filter((x) => x.total > 0)
    .map((x) => ({
      category: x.category,
      label: BROWSE_LABELS[x.category],
      unit: x.unit,
      count: x.total,
      items: x.items,
    }))
    .sort((a, b) => b.count - a.count || (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0));

  return { mode: 'grouped', groups };
}
