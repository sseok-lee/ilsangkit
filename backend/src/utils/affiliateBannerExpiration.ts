const FIFTEEN_HOURS_MS = 15 * 60 * 60 * 1000;

export function isValidAffiliateEndDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function endDateToExpiresAt(value: string | null): Date | null {
  if (value === null) return null;
  if (!isValidAffiliateEndDate(value)) throw new RangeError('유효한 종료일을 입력하세요');

  return new Date(`${value}T15:00:00.000Z`);
}

export function expiresAtToEndDate(value: Date | null): string | null {
  if (value === null) return null;

  return new Date(value.getTime() - FIFTEEN_HOURS_MS).toISOString().slice(0, 10);
}

export function isAffiliateBannerExpired(value: Date | null, now: Date): boolean {
  return value !== null && (!Number.isFinite(value.getTime()) || value.getTime() <= now.getTime());
}
