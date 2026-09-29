export type PropertyType = 'apt' | 'villa' | 'offitel';
export type DealKind = 'sale' | 'jeonse' | 'wolse';

export interface BuildingKey {
  propertyType: PropertyType;
  buildingName: string;
  bjdCode: string;
  dongName?: string | null;
  jibun?: string | null;
}

export interface DealSnapshot {
  kind: DealKind;
  amount: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: number | null;
  floor: number | null;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
}

export interface LatestDeals {
  sale: DealSnapshot | null;
  jeonse: DealSnapshot | null;
  wolse: DealSnapshot | null;
}

export type DealScope = 'sale' | 'rent' | 'all';
