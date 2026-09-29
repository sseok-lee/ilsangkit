interface WasteSourceIdentity {
  city: string;
  district: string;
  sourceId: string;
}

const WASTE_PROVIDER_DATASET = 'household_waste_info';

export function buildWasteSourceScope(identity: WasteSourceIdentity): string {
  return JSON.stringify([
    WASTE_PROVIDER_DATASET,
    normalizeScopePart(identity.city),
    normalizeScopePart(identity.district),
    identity.sourceId,
  ]);
}

function normalizeScopePart(value: string): string {
  return value.trim().normalize('NFC');
}
