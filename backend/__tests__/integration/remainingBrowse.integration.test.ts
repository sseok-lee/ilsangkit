import './housingSetup.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma from '../../src/lib/prisma.js';
import { browseFacilities } from '../../src/services/facilityBrowseService.js';
import { getTransactions } from '../../src/services/landService.js';
import { getItems } from '../../src/services/auctionService.js';
import type { BrowseCategory } from '../../src/schemas/facilityBrowse.js';

const prefix = `rm${randomUUID().slice(0, 8)}`;
const district = `${prefix}구`;
const city = '서울특별시';
const dongName = `${prefix}동`;
let bjdCode = '';
let regionId: number | undefined;
const parkingIds = Array.from({ length: 5 }, (_, i) => `${prefix}-p${i}`);
const wifiIds = Array.from({ length: 3 }, (_, i) => `${prefix}-w${i}`);
const evIds = Array.from({ length: 3 }, (_, i) => `${prefix}-e${i}`);
const hospitalIds = [`${prefix}-h0`, `${prefix}-h1`];
const subwayId = `${prefix}-station`;
const trashIds: number[] = [];
const landIds: number[] = [];
const auctionIds: number[] = [];
const base = { city, district, address: '테스트 주소', lat: 37.5, lng: 127.0 };
const facility = (id: string, name: string) => ({ ...base, id, sourceId: id, name });
const list = async (category: BrowseCategory, options: Record<string, unknown> = {}) => {
  const result = await browseFacilities({ city: 'seoul', district: prefix, category, page: 1, limit: 20, ...options });
  if (result.mode !== 'list') throw new Error('expected list');
  return result;
};

beforeAll(async () => {
  const regions = await prisma.region.findMany({ where: { bjdCode: { startsWith: '99' } }, select: { bjdCode: true } });
  const used = new Set(regions.map(row => row.bjdCode));
  bjdCode = Array.from({ length: 1000 }, (_, i) => String(99000 + i)).find(code => !used.has(code))!;
  if (!bjdCode) throw new Error('No free synthetic test region code');
  regionId = (await prisma.region.create({ data: { city, district, slug: prefix, bjdCode, lat: 37.5, lng: 127 } })).id;
  await prisma.parking.createMany({ data: parkingIds.map((id, i) => facility(id, `주차 ${i}`)) });
  await prisma.wifi.createMany({ data: wifiIds.map((id, i) => ({ ...facility(id, i < 2 ? '같은 장소' : '문자 % 장소'), groupId: `${prefix}-wg${i < 2 ? 0 : 1}` })) });
  await prisma.evCharger.createMany({ data: evIds.map((id, i) => ({ ...facility(id, i < 2 ? '같은 충전소' : '문자 % 충전소'), statId: `${prefix}-eg${i < 2 ? 0 : 1}`, chgerId: String(i), output: i === 0 ? '100' : '7' })) });
  await prisma.hospital.createMany({ data: hospitalIds.map(id => facility(id, '진료 병원')) });
  await prisma.hospitalDepartment.createMany({ data: [{ hospitalId: hospitalIds[0], dgsbjtCdNm: '내과' }, { hospitalId: hospitalIds[0], dgsbjtCdNm: '정형외과' }, { hospitalId: hospitalIds[1], dgsbjtCdNm: '내과' }] });
  await prisma.subwayStation.create({ data: { ...facility(subwayId, '환승 테스트'), nameSlug: subwayId, line: '2호선', transferLines: '["신분당선"]', regionSlug: 'seoul' } });
  for (let i = 0; i < 4; i++) trashIds.push((await prisma.wasteSchedule.create({ data: { city, district, sourceId: `${prefix}-t${i}`, targetRegion: `배출 ${i}` } })).id);
  for (let i = 0; i < 5; i++) landIds.push((await prisma.landSaleTransaction.create({ data: { city, district, bjdCode, dongName, sourceId: `${prefix}-l${i}`, dealAmount: 10000n, dealYear: 2026, dealMonth: 9, dealDay: i + 1, jibun: '123-4', jimok: i === 3 ? '전' : '대', landUse: '주거지역', cancelDealDay: i === 4 ? '20260920' : null } })).id);
  for (const [i, status] of ['ongoing', 'ongoing', 'scheduled', 'closed', 'sold', 'failed', 'cancelled'].entries()) {
    auctionIds.push((await prisma.auctionItem.create({ data: { city, district, bjdCode, sourceId: `${prefix}-a${i}`, cltrMngNo: `${prefix}-a${i}`, pbctCdtnNo: '1', address: '검색 % 대상', usage: '대지', usageGroup: 'land', status, isClosed: ['sold', 'failed', 'cancelled'].includes(status), bidCloseDtm: new Date(`2026-09-${10 + i}T00:00:00Z`) } })).id);
  }
});

afterAll(async () => {
  await prisma.hospitalDepartment.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.parking.deleteMany({ where: { id: { in: parkingIds } } });
  await prisma.wifi.deleteMany({ where: { id: { in: wifiIds } } });
  await prisma.evCharger.deleteMany({ where: { id: { in: evIds } } });
  await prisma.subwayStation.deleteMany({ where: { id: subwayId } });
  await prisma.wasteSchedule.deleteMany({ where: { id: { in: trashIds } } });
  await prisma.landSaleTransaction.deleteMany({ where: { id: { in: landIds } } });
  await prisma.auctionItem.deleteMany({ where: { id: { in: auctionIds } } });
  if (regionId !== undefined) await prisma.region.delete({ where: { id: regionId } });
  await prisma.$disconnect();
});

describe('remaining browse actual MySQL parity', () => {
  it('group counts/previews use each category unit and cap at three', async () => {
    const result = await browseFacilities({ city: 'seoul', district: prefix, page: 1, limit: 20 });
    if (result.mode !== 'grouped') throw new Error('expected grouped');
    expect(result.groups.map(group => [group.category, group.count, group.unit])).toEqual([
      ['parking', 5, '시설'], ['trash', 4, '일정'], ['wifi', 2, '장소'], ['hospital', 2, '시설'], ['ev-charger', 2, '충전소'], ['subway', 1, '역'],
    ]);
    expect(result.groups.every(group => group.items.length === Math.min(3, group.count))).toBe(true);
  });
  it('parking page two/count equal independent SQL', async () => {
    const result = await list('parking', { page: 2, limit: 3 });
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM Parking WHERE city IN ('서울', '서울특별시') AND district = ${district} ORDER BY name ASC, id ASC LIMIT 3 OFFSET 3`;
    expect(result.total).toBe(5); expect(result.items.map(row => row.id)).toEqual(rows.map(row => row.id));
  });
  it('WiFi groups APs and literal percent does not match everything', async () => {
    const result = await list('wifi');
    expect(result.total).toBe(2);
    expect(result.items.find(item => item.name === '같은 장소')?.extras.accessPointCount).toBe(2);
    const literal = await list('wifi', { keyword: '%' });
    expect(literal.total).toBe(1); expect(literal.items[0].name).toBe('문자 % 장소');
  });
  it('EV counts stations, retains chargers, and searches literal percent', async () => {
    const result = await list('ev-charger');
    expect(result.total).toBe(2);
    expect(result.items.find(item => item.name === '같은 충전소')?.extras).toMatchObject({ totalChargers: 2, rapidCount: 1, slowCount: 1 });
    expect((await list('ev-charger', { keyword: '%' })).total).toBe(1);
  });
  it('hospital departments combine with AND', async () => {
    const result = await list('hospital', { departments: ['내과', '정형외과'] });
    expect(result.total).toBe(1); expect(result.items[0].id).toBe(hospitalIds[0]);
  });
  it('subway transfer lines retain one station unit', async () => {
    const result = await list('subway');
    expect(result.total).toBe(1); expect(result.items[0].id).toBe(subwayId);
    expect(result.items[0].extras.lines).toEqual(expect.arrayContaining(['2호선', '신분당선']));
  });
  it('trash page two counts schedules and has no coordinates', async () => {
    const result = await list('trash', { page: 2, limit: 3 });
    expect(result.total).toBe(4); expect(result.items.map(row => row.id)).toEqual([String(trashIds[3])]);
    expect(result.items[0]).toMatchObject({ lat: null, lng: null, name: '배출 3' });
  });
  it('land AND filters count/list exclude canceled trades', async () => {
    const result = await getTransactions({ bjdCode, dongName, keyword: '123', jimok: '대', landUse: '주거지역', page: 2, limit: 2 });
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM LandSaleTransaction WHERE bjdCode = ${bjdCode} AND dongName = ${dongName} AND cancelDealDay IS NULL AND jibun LIKE '%123%' AND jimok = '대' AND landUse = '주거지역' ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC LIMIT 2 OFFSET 2`;
    expect(result.total).toBe(3); expect(result.items.map(row => row.id)).toEqual(rows.map(row => row.id));
    expect(result.filterOptions.jimok).toEqual(expect.arrayContaining(['대', '전']));
  });
  it('auction exact/legacy and literal keyword match SQL count and ordered rows', async () => {
    for (const [status, statusMode, expected] of [['ongoing', 'legacy', 3], ['ongoing', 'exact', 2], ['closed', 'legacy', 4], ['closed', 'exact', 1], ['scheduled', 'exact', 1]] as const) {
      const result = await getItems({ city, district, usage: 'land', keyword: '%', status, statusMode, sort: 'deadline', page: 1, limit: 20 });
      expect(result.total).toBe(expected); expect(result.items).toHaveLength(expected);
    }
    const result = await getItems({ city, district, usage: 'land', keyword: '%', status: 'ongoing', page: 2, limit: 2 });
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM AuctionItem WHERE city IN ('서울', '서울특별시') AND district = ${district} AND usageGroup = 'land' AND status IN ('ongoing', 'scheduled') AND LOCATE('%', address) > 0 ORDER BY CASE WHEN status = 'ongoing' THEN 0 ELSE 1 END, (bidCloseDtm IS NULL), bidCloseDtm ASC, id ASC LIMIT 2 OFFSET 2`;
    expect(result.items.map(row => row.id)).toEqual(rows.map(row => row.id));
  });
});
