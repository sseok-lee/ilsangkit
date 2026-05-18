import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP } from './realEstateService.js';

export const HUB_TYPES = [
  'apt-sale',
  'apt-rent',
  'offitel-sale',
  'offitel-rent',
  'villa-sale',
  'villa-rent',
] as const;
export type HubType = (typeof HUB_TYPES)[number];

export interface HubTypeEntry {
  last30dCount: number | null;
}

export interface HubSummary {
  data: Record<HubType, HubTypeEntry>;
  generatedAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cache: { value: HubSummary; expiresAt: number } | null = null;
let inFlight: Promise<HubSummary> | null = null;

export function __resetHubSummaryCacheForTest(): void {
  cache = null;
  inFlight = null;
}

function computeCutoffYYYYMM(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return prevY * 100 + prevM;
}

async function countForType(type: HubType, cutoff: number): Promise<number | null> {
  const table = TABLE_NAME_MAP[type];
  if (!table) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
      `SELECT COUNT(*) AS cnt FROM ${table}
       WHERE dealYear * 100 + dealMonth >= ?`,
      cutoff,
    );
    const raw = rows[0]?.cnt ?? 0;
    return typeof raw === 'bigint' ? Number(raw) : Number(raw);
  } catch {
    return null;
  }
}

async function build(): Promise<HubSummary> {
  const cutoff = computeCutoffYYYYMM(new Date());
  const counts = await Promise.all(HUB_TYPES.map((t) => countForType(t, cutoff)));
  const data = HUB_TYPES.reduce(
    (acc, t, i) => {
      acc[t] = { last30dCount: counts[i] };
      return acc;
    },
    {} as Record<HubType, HubTypeEntry>,
  );
  return { data, generatedAt: new Date().toISOString() };
}

export async function getHubSummary(): Promise<HubSummary> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = build()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
