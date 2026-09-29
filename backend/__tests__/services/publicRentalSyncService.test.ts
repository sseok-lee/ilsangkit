import { describe, expect, it } from 'vitest';
import { buildPublicRentalWrite } from '../../src/services/publicRentalSyncService.js';
import type { PublicRentalNotice } from '../../src/services/publicRentalSources.js';

const notice = {
  canonicalId: '2015122300020817', houseName: '양산 국민임대', houseType: '아파트', publicRentType: '국민임대',
  regionName: '경상남도 양산시', supplyLocation: null, totalSupplyCount: 30,
  announcementDate: new Date('2026-09-15'), receptionStartDate: new Date('2026-09-29'), receptionEndDate: new Date('2026-09-29'),
  winnerDate: null, pblancUrl: 'https://apply.lh.or.kr/notice', inquiryTel: null, status: 'upcoming',
  publicRental: { provider: 'LH', sources: ['MYHOME', 'LH'], sourceIds: { myhome: ['21317', '21230'], lh: ['2015122300020817'] }, sourceStatus: '공고중', lastSyncedAt: '2026-09-22T01:00:00Z', supplies: [], isCorrection: true },
} as PublicRentalNotice;

describe('public rental persistence identity', () => {
  it('creates one canonical public notice, with source IDs separate from ApplyHome IDs', () => {
    const result = buildPublicRentalWrite(notice, []);
    expect(result.ownerId).toBe(null);
    expect(result.data).toMatchObject({ sourceType: 'PUBLIC_RENT', houseManageNo: 'LH', pblancNo: '2015122300020817', rentType: '임대주택', developerName: 'LH' });
  });

  it('keeps the existing URL and old source IDs when a correction changes its ID', () => {
    const result = buildPublicRentalWrite(notice, [{ id: 42, houseManageNo: 'LH', pblancNo: 'original', publicRental: { ...notice.publicRental, sourceIds: { myhome: ['21230', '20000'], lh: ['old-pan'] } } }]);
    expect(result.ownerId).toBe(42);
    expect(result.data.pblancNo).toBe('original');
    expect(result.data.publicRental.sourceIds.myhome).toEqual(expect.arrayContaining(['20000', '21230', '21317']));
    expect(result.data.publicRental.sourceIds.lh).toEqual(expect.arrayContaining(['old-pan', '2015122300020817']));
  });

  it('collapses independently collected aliases onto the oldest surviving URL', () => {
    const result = buildPublicRentalWrite(notice, [
      { id: 45, houseManageNo: 'LH', pblancNo: notice.canonicalId, publicRental: { ...notice.publicRental, sourceIds: { myhome: [], lh: [notice.canonicalId] } } },
      { id: 42, houseManageNo: 'MYHOME', pblancNo: '21230', publicRental: { ...notice.publicRental, sourceIds: { myhome: ['21230'], lh: [] } } },
    ]);
    expect(result.ownerId).toBe(42);
    expect(result.supersededIds).toEqual([45]);
  });

  it('does not fuzzy-merge different notices with the same title', () => {
    const result = buildPublicRentalWrite(notice, [{ id: 99, houseManageNo: 'LH', pblancNo: 'different', publicRental: { ...notice.publicRental, sourceIds: { myhome: ['other'], lh: ['other'] } } }]);
    expect(result.ownerId).toBe(null);
  });

  it('repeating an import targets the same row and does not duplicate source IDs', () => {
    const first = buildPublicRentalWrite(notice, []);
    const second = buildPublicRentalWrite(notice, [{ id: 42, ...first.data }]);
    expect(second.ownerId).toBe(42);
    expect(second.data.publicRental.sourceIds).toEqual(first.data.publicRental.sourceIds);
    expect(second.supersededIds).toEqual([]);
  });
});
