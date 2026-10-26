import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LATEST_DEAL_INDEX } from '../../src/services/realEstateLatestDeals.js';

const LATEST_DEAL_COLUMNS = ['buildingName', 'bjdCode', 'dealYear', 'dealMonth', 'dealDay'];
const schema = readFileSync(fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url)), 'utf8');

function modelBlock(model: string): string {
  const match = schema.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`model ${model} not found in schema.prisma`);
  return match[1];
}

// Prisma 기본 인덱스 이름: `{테이블}_{컬럼_}` 를 MySQL 식별자 한도 64자에서 접미사 `_idx` 4자를 뺀
// 60자로 자른 뒤 `_idx` 를 붙인다(운영·CI 모두 prisma db push 로 만든 이름).
function prismaDefaultIndexName(table: string, columns: readonly string[]): string {
  return `${`${table}_${columns.join('_')}`.slice(0, 60)}_idx`;
}

describe('latest deal index hint names', () => {
  it.each(Object.entries(LATEST_DEAL_INDEX))(
    '%s hint names the index created by its @@index([buildingName, bjdCode, dealYear, dealMonth, dealDay])',
    (table, indexName) => {
      const indexLines = modelBlock(table)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(`@@index([${LATEST_DEAL_COLUMNS.join(', ')}]`));

      // map: 으로 이름을 바꾸면 기본 이름 계산이 틀어지므로 함께 막는다.
      expect(indexLines).toEqual([`@@index([${LATEST_DEAL_COLUMNS.join(', ')}])`]);
      expect(indexName).toBe(prismaDefaultIndexName(table, LATEST_DEAL_COLUMNS));
      expect(indexName.length).toBeLessThanOrEqual(64);
    },
  );

  it('covers every sale and rent transaction table', () => {
    expect(Object.keys(LATEST_DEAL_INDEX).sort()).toEqual([
      'AptRentTransaction',
      'AptSaleTransaction',
      'OffitelRentTransaction',
      'OffitelSaleTransaction',
      'VillaRentTransaction',
      'VillaSaleTransaction',
    ]);
  });
});
