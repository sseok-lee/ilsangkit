export interface LegacyUrlObservationMapping {
  id?: number;
  type: string;
  buildingKey: string;
  bjdCode: string;
  buildingName: string;
  basePath: string;
  canonicalPath: string;
  dongName: string | null;
  jibun: string | null;
  evidence?: unknown;
}

export interface LegacyUrlObservationInfo {
  bjdCode?: string | null;
  buildingName?: string | null;
  city?: string | null;
  district?: string | null;
  dongName?: string | null;
  jibun?: string | null;
  roadName?: string | null;
  regionMatched?: boolean;
}

export interface LegacyUrlObservationLatest {
  id?: number;
  dongName?: string | null;
  jibun?: string | null;
  roadName?: string | null;
}

export interface LegacyUrlObservationParcel {
  dongName: string | null;
  jibun: string | null;
  roadName?: string | null;
  transactions?: string | number;
}

export interface LegacyUrlObservation {
  kind?: string;
  at?: string | null;
  endpointPath?: string | null;
  type?: string | null;
  bjdCode?: string | null;
  buildingName?: string | null;
  basePath?: string | null;
  mappings?: LegacyUrlObservationMapping[];
  info?: LegacyUrlObservationInfo | null;
  latest?: LegacyUrlObservationLatest | null;
  parcels?: LegacyUrlObservationParcel[];
  stableLatest?: boolean;
  error?: unknown;
}

export interface LegacyRealEstateUrlBaselineEntry {
  type: string;
  basePath: string;
  dongName: string;
  jibun: string;
  provenance: string;
}

export type LegacyUrlObservationUnresolvedReason =
  | 'observation-error'
  | 'missing-capture-time'
  | 'missing-endpoint-path'
  | 'missing-observation-identity'
  | 'missing-info'
  | 'missing-latest'
  | 'missing-source-parcels'
  | 'unstable-latest'
  | 'region-mismatch'
  | 'identity-mismatch'
  | 'mapping-not-deferred'
  | 'missing-readable-address'
  | 'readable-suffix-clash'
  | 'source-mapping-drift'
  | 'display-address-conflict'
  | 'display-address-ambiguous'
  | 'road-address-conflict'
  | 'road-address-ambiguous';

export type LegacyUrlObservationClassification =
  | { status: 'confirmed'; entry: LegacyRealEstateUrlBaselineEntry }
  | {
      status: 'unresolved';
      reason: LegacyUrlObservationUnresolvedReason;
      detail?: string;
    };

interface Address {
  dongName: string;
  jibun: string;
}

interface ParcelAddress extends Address {
  roadName: string | null;
}

export function classifyLegacyUrlObservation(
  observation: LegacyUrlObservation
): LegacyUrlObservationClassification {
  if (observation.error) return unresolved('observation-error', String(observation.error));

  const at = normalizeText(observation.at);
  if (!at) return unresolved('missing-capture-time');

  const endpointPath = normalizeText(observation.endpointPath ?? observation.basePath);
  if (!endpointPath) return unresolved('missing-endpoint-path');

  const type = normalizeText(observation.type);
  const bjdCode = normalizeText(observation.bjdCode);
  const buildingName = normalizeText(observation.buildingName);
  const basePath = normalizeText(observation.basePath);
  if (!type || !bjdCode || !buildingName || !basePath) {
    return unresolved('missing-observation-identity');
  }

  const info = observation.info;
  if (!info) return unresolved('missing-info');

  if (observation.stableLatest !== true) return unresolved('unstable-latest');
  if (info.regionMatched !== true) return unresolved('region-mismatch');
  if (!sameText(info.bjdCode, bjdCode) || !sameText(info.buildingName, buildingName)) {
    return unresolved('identity-mismatch');
  }

  const latestAddress = completeAddress(observation.latest);
  if (!latestAddress) return unresolved('missing-latest');

  const mappings = observation.mappings ?? [];
  if (mappings.length === 0) return unresolved('identity-mismatch');
  for (const mapping of mappings) {
    if (
      !sameText(mapping.type, type) ||
      !sameText(mapping.bjdCode, bjdCode) ||
      !sameText(mapping.buildingName, buildingName) ||
      !sameText(mapping.basePath, basePath) ||
      !sameText(mapping.canonicalPath, basePath)
    ) {
      return unresolved('identity-mismatch');
    }
    if (!isDeferredEvidence(mapping.evidence)) {
      return unresolved('mapping-not-deferred');
    }
  }

  const mappingAddresses = mappings.map((mapping) => completeAddress(mapping));
  if (mappingAddresses.some((address) => !address)) return unresolved('missing-readable-address');
  const mappingAddressKeys = mappingAddresses.map((address) => addressKey(address as Address));
  if (new Set(mappingAddressKeys).size !== mappingAddressKeys.length) {
    return unresolved('readable-suffix-clash');
  }

  const rawParcels = (observation.parcels ?? []).map((parcel) => completeParcelAddress(parcel));
  if (rawParcels.length === 0) return unresolved('missing-source-parcels');
  if (rawParcels.some((parcel) => !parcel)) return unresolved('missing-readable-address');
  const completeParcels = rawParcels as ParcelAddress[];
  const parcelAddressKeys = uniqueAddressKeys(completeParcels);
  if (!sameKeySet(mappingAddressKeys, parcelAddressKeys)) {
    return unresolved('source-mapping-drift');
  }
  if (!parcelAddressKeys.includes(addressKey(latestAddress))) {
    return unresolved('source-mapping-drift');
  }

  const infoAddress = completeAddress(info);
  if (!infoAddress) return unresolved('display-address-conflict');
  if (!sameAddress(infoAddress, latestAddress)) return unresolved('display-address-conflict');

  const matchedParcels = uniqueAddresses(
    completeParcels.filter((parcel) => sameAddress(parcel, infoAddress))
  );
  if (matchedParcels.length === 0) return unresolved('display-address-conflict');
  if (matchedParcels.length > 1) return unresolved('display-address-ambiguous');

  const matchingMappings = mappings.filter((mapping) => sameAddress(mapping, infoAddress));
  if (matchingMappings.length === 0) return unresolved('display-address-conflict');
  if (matchingMappings.length > 1) return unresolved('display-address-ambiguous');

  const infoRoadName = normalizeNullableText(info.roadName);
  if (infoRoadName) {
    const roadParcels = uniqueAddresses(
      completeParcels.filter((parcel) => parcel.roadName === infoRoadName)
    );
    if (roadParcels.length > 1) return unresolved('road-address-ambiguous');
    if (roadParcels.length !== 1 || !sameAddress(roadParcels[0], infoAddress)) {
      return unresolved('road-address-conflict');
    }
  }

  const latestRoadName = normalizeNullableText(observation.latest?.roadName);
  if (latestRoadName && sameAddress(latestAddress, infoAddress)) {
    const ownerRoadNames = new Set(
      completeParcels
        .filter((parcel) => sameAddress(parcel, infoAddress))
        .map((parcel) => parcel.roadName)
        .filter((roadName): roadName is string => Boolean(roadName))
    );
    if (ownerRoadNames.size > 0 && !ownerRoadNames.has(latestRoadName)) {
      return unresolved('road-address-conflict');
    }
  }

  return {
    status: 'confirmed',
    entry: {
      type,
      basePath,
      dongName: infoAddress.dongName,
      jibun: infoAddress.jibun,
      provenance: `production-function-getBuildingInfo observation=${at} endpoint=${endpointPath}`,
    },
  };
}

function unresolved(
  reason: LegacyUrlObservationUnresolvedReason,
  detail?: string
): LegacyUrlObservationClassification {
  return detail ? { status: 'unresolved', reason, detail } : { status: 'unresolved', reason };
}

function completeAddress(value?: {
  dongName?: string | null;
  jibun?: string | null;
} | null): Address | null {
  const dongName = normalizeText(value?.dongName);
  const jibun = normalizeText(value?.jibun);
  return dongName && jibun ? { dongName, jibun } : null;
}

function completeParcelAddress(value?: LegacyUrlObservationParcel | null): ParcelAddress | null {
  const address = completeAddress(value);
  if (!address) return null;
  return { ...address, roadName: normalizeNullableText(value?.roadName) };
}

function uniqueAddressKeys(addresses: Address[]): string[] {
  return uniqueAddresses(addresses).map((address) => addressKey(address));
}

function uniqueAddresses<T extends Address>(addresses: T[]): T[] {
  const deduped: T[] = [];
  const seen = new Set<string>();
  for (const address of addresses) {
    const key = addressKey(address);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(address);
  }
  return deduped;
}

function sameAddress(
  left: { dongName?: string | null; jibun?: string | null },
  right: { dongName?: string | null; jibun?: string | null }
): boolean {
  return sameText(left.dongName, right.dongName) && sameText(left.jibun, right.jibun);
}

function addressKey(address: { dongName: string; jibun: string }): string {
  return `${address.dongName}\x1f${address.jibun}`;
}

function sameKeySet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false;
  for (const key of leftSet) {
    if (!rightSet.has(key)) return false;
  }
  return true;
}

function isDeferredEvidence(evidence: unknown): boolean {
  if (typeof evidence === 'string') {
    try {
      return isDeferredEvidence(JSON.parse(evidence));
    } catch {
      return false;
    }
  }
  if (!evidence || typeof evidence !== 'object') return false;
  const value = evidence as Record<string, unknown>;
  return value.source === 'legacy-deferred';
}

function sameText(left?: string | null, right?: string | null): boolean {
  return normalizeText(left) === normalizeText(right);
}

function normalizeNullableText(value?: string | null): string | null {
  return normalizeText(value) || null;
}

function normalizeText(value?: string | null): string {
  return typeof value === 'string' ? value.trim().normalize('NFC') : '';
}
