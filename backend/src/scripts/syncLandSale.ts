#!/usr/bin/env tsx
// 토지 매매 실거래가 동기화 스크립트

const CATEGORY = 'landSale';

export interface RawLandSaleItem extends Record<string, unknown> {
  sggCd: string;
  umdNm: string;
  jibun: string;
  jimok: string;
  landUse: string;
  dealArea: string;
  dealAmount: string;
  shareDealingType: string;
  dealingGbn: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  cdealType: string;
  cdealDay: string;
  city: string;
  district: string;
}

function parseIntOrNull(value: string): number | null {
  const t = String(value ?? '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

export function transformLandSaleItem(item: RawLandSaleItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dongName = String(item.umdNm ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const jimokStr = String(item.jimok ?? '').trim();
  const landUseStr = String(item.landUse ?? '').trim();
  const areaStr = String(item.dealArea ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  const shareDeal = String(item.shareDealingType ?? '').trim() === '지분';

  const sourceId = [CATEGORY, bjdCode, dongName, jibunStr, dealYear, dealMonth, dayStr, areaStr, dealAmountStr].join('-');

  return {
    sourceId,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName,
    jibun: jibunStr || null,
    jimok: jimokStr || null,
    landUse: landUseStr || null,
    dealArea: areaStr || null,
    shareDeal,
    dealAmount: dealAmountVal,
    dealType: dealTypeStr || null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
  };
}
