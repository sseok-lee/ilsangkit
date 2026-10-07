import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import prisma from '../lib/prisma.js';
import { ValidationError } from '../lib/errors.js';
import { affiliateDisclosureSaveSchema, type AffiliateDisclosureSaveInput } from '../schemas/affiliateDisclosure.js';
import { AFFILIATE_PROVIDERS, type AffiliateProvider } from '../types/affiliateBanner.js';
import type { AffiliateProviderDisclosureDto } from '../types/affiliateDisclosure.js';

type AffiliateDisclosureRow = {
  provider: AffiliateProvider;
  defaultDisclosureText: string;
  updatedAt: Date;
};

type AffiliateDisclosureDefaultsRow = {
  provider: AffiliateProvider;
  defaultDisclosureText: string;
};

type AffiliateDisclosureDb = Pick<Prisma.TransactionClient, 'affiliateProviderDisclosure'>;

function parseDisclosureInput(value: AffiliateDisclosureSaveInput): { defaultDisclosureText: string } {
  try {
    return affiliateDisclosureSaveSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('기본 문구 입력값이 올바르지 않습니다', error.flatten());
    }
    throw error;
  }
}

function toDto(row: AffiliateDisclosureRow): AffiliateProviderDisclosureDto {
  return {
    provider: row.provider,
    defaultDisclosureText: row.defaultDisclosureText,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAffiliateProviderDisclosures(): Promise<AffiliateProviderDisclosureDto[]> {
  const rows = await prisma.affiliateProviderDisclosure.findMany({
    where: { provider: { in: [...AFFILIATE_PROVIDERS] } },
    select: {
      provider: true,
      defaultDisclosureText: true,
      updatedAt: true,
    },
  }) as AffiliateDisclosureRow[];
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return AFFILIATE_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) {
      return {
        provider,
        defaultDisclosureText: null,
        updatedAt: null,
      };
    }

    return toDto(row);
  });
}

export async function saveAffiliateProviderDisclosure(
  provider: AffiliateProvider,
  input: AffiliateDisclosureSaveInput,
): Promise<AffiliateProviderDisclosureDto> {
  const parsed = parseDisclosureInput(input);
  const row = await prisma.affiliateProviderDisclosure.upsert({
    where: { provider },
    create: {
      provider,
      defaultDisclosureText: parsed.defaultDisclosureText,
    },
    update: {
      defaultDisclosureText: parsed.defaultDisclosureText,
    },
  }) as AffiliateDisclosureRow;

  return toDto(row);
}

export async function loadAffiliateDisclosureDefaults(
  providers: readonly AffiliateProvider[],
  db: AffiliateDisclosureDb = prisma,
): Promise<Map<AffiliateProvider, string>> {
  if (providers.length === 0) return new Map();

  const rows = await db.affiliateProviderDisclosure.findMany({
    where: { provider: { in: [...new Set(providers)] } },
    select: { provider: true, defaultDisclosureText: true },
  }) as AffiliateDisclosureDefaultsRow[];

  return new Map(rows.map((row) => [row.provider, row.defaultDisclosureText]));
}
