/**
 * 카테고리 레지스트리 — 모든 시설 카테고리 설정의 단일 진실 공급원
 * 다른 서비스들이 이 파일을 import하여 순환 의존성을 방지
 */

import prisma from '../lib/prisma.js';

// 카테고리 타입
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy' | 'park' | 'school' | 'market' | 'childcare' | 'ev-charger' | 'sports';

export const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'];

interface CategoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: () => any;
  listFields: string[];
  detailFields: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CATEGORY_REGISTRY: Record<FacilityCategory, CategoryConfig> = {
  toilet: {
    model: () => prisma.toilet,
    listFields: ['operatingHours', 'hasDisabledToilet'],
    detailFields: ['operatingHours', 'maleToilets', 'maleUrinals', 'femaleToilets', 'hasDisabledToilet', 'openTime', 'managingOrg', 'phoneNumber', 'installDate', 'ownershipType', 'sewageTreatment', 'hasEmergencyBell', 'emergencyBellLocation', 'hasCCTV', 'hasDiaperChangingTable', 'diaperChangingLocation', 'maleDisabledToilets', 'maleDisabledUrinals', 'maleChildToilets', 'maleChildUrinals', 'femaleDisabledToilets', 'femaleChildToilets', 'remodelingDate', 'facilityType', 'legalBasis', 'govCode', 'dataDate'],
  },
  wifi: {
    model: () => prisma.wifi,
    listFields: ['ssid', 'installLocation'],
    detailFields: ['ssid', 'installDate', 'serviceProvider', 'installLocation', 'managementAgency', 'phoneNumber', 'installLocationDetail', 'govCode', 'dataDate'],
  },
  clothes: {
    model: () => prisma.clothes,
    listFields: ['detailLocation'],
    detailFields: ['managementAgency', 'phoneNumber', 'dataDate', 'detailLocation', 'providerCode', 'providerName'],
  },
  parking: {
    model: () => prisma.parking,
    listFields: ['capacity', 'baseFee', 'feeType'],
    detailFields: ['parkingType', 'lotType', 'capacity', 'baseFee', 'baseTime', 'additionalFee', 'additionalTime', 'dailyMaxFee', 'monthlyFee', 'operatingHours', 'phone', 'paymentMethod', 'remarks', 'hasDisabledParking', 'zoneClass', 'alternateParking', 'operatingDays', 'feeType', 'dailyMaxFeeHours', 'managingOrg', 'dataDate', 'providerCode', 'providerName'],
  },
  aed: {
    model: () => prisma.aed,
    listFields: ['buildPlace', 'org'],
    detailFields: ['buildPlace', 'org', 'clerkTel', 'mfg', 'model', 'monSttTme', 'monEndTme', 'tueSttTme', 'tueEndTme', 'wedSttTme', 'wedEndTme', 'thuSttTme', 'thuEndTme', 'friSttTme', 'friEndTme', 'satSttTme', 'satEndTme', 'sunSttTme', 'sunEndTme', 'holSttTme', 'holEndTme', 'dataDate'],
  },
  library: {
    model: () => prisma.library,
    listFields: ['weekdayOpenTime', 'weekdayCloseTime', 'seatCount'],
    detailFields: ['libraryType', 'closedDays', 'weekdayOpenTime', 'weekdayCloseTime', 'saturdayOpenTime', 'saturdayCloseTime', 'holidayOpenTime', 'holidayCloseTime', 'seatCount', 'bookCount', 'serialCount', 'nonBookCount', 'loanableBooks', 'loanableDays', 'phoneNumber', 'homepageUrl', 'operatingOrg', 'lotArea', 'buildingArea', 'dataDate', 'providerCode', 'providerName'],
  },
  hospital: {
    model: () => prisma.hospital,
    listFields: ['clCdNm', 'phone', 'drTotCnt',
      'trmtMonStart', 'trmtMonEnd', 'trmtTueStart', 'trmtTueEnd',
      'trmtWedStart', 'trmtWedEnd', 'trmtThuStart', 'trmtThuEnd',
      'trmtFriStart', 'trmtFriEnd', 'trmtSatStart', 'trmtSatEnd',
      'trmtSunStart', 'trmtSunEnd', 'lunchWeek', 'noTrmtSun', 'noTrmtHoli'],
    detailFields: ['phone', 'homepage', 'postNo', 'estbDd', 'ykiho', 'clCd', 'clCdNm', 'sidoCd', 'sgguCd', 'emdongNm', 'drTotCnt', 'mdeptSdrCnt', 'mdeptGdrCnt', 'mdeptIntnCnt', 'mdeptResdntCnt', 'detySdrCnt', 'detyGdrCnt', 'detyIntnCnt', 'detyResdntCnt', 'cmdcSdrCnt', 'cmdcGdrCnt', 'cmdcIntnCnt', 'cmdcResdntCnt', 'pnursCnt', 'dataDate', 'trmtMonStart', 'trmtMonEnd', 'trmtTueStart', 'trmtTueEnd', 'trmtWedStart', 'trmtWedEnd', 'trmtThuStart', 'trmtThuEnd', 'trmtFriStart', 'trmtFriEnd', 'trmtSatStart', 'trmtSatEnd', 'trmtSunStart', 'trmtSunEnd', 'lunchWeek', 'lunchSat', 'noTrmtSun', 'noTrmtHoli', 'parkQty', 'parkEtc', 'detailSyncedAt'],
  },
  pharmacy: {
    model: () => prisma.pharmacy,
    listFields: ['phone', 'dutyTime1s', 'dutyTime1c'],
    detailFields: ['phone', 'dutyTel3', 'hpid', 'postCdn1', 'postCdn2', 'dutyTime1s', 'dutyTime1c', 'dutyTime2s', 'dutyTime2c', 'dutyTime3s', 'dutyTime3c', 'dutyTime4s', 'dutyTime4c', 'dutyTime5s', 'dutyTime5c', 'dutyTime6s', 'dutyTime6c', 'dutyTime7s', 'dutyTime7c', 'dutyTime8s', 'dutyTime8c', 'dutyMapimg', 'dutyInf', 'dutyEtc', 'dataDate'],
  },
  park: {
    model: () => prisma.park,
    listFields: ['parkType', 'area'],
    detailFields: ['parkType', 'area', 'exerciseFacilities', 'playFacilities', 'convenienceFacilities', 'cultureFacilities', 'otherFacilities', 'designatedDate', 'managingOrg', 'phoneNumber', 'dataDate', 'providerCode', 'providerName'],
  },
  school: {
    model: () => prisma.school,
    listFields: ['schoolLevel', 'operationStatus', 'phoneNumber', 'coeducationType', 'highSchoolType'],
    detailFields: ['schoolLevel', 'foundedDate', 'foundationType', 'branchType', 'operationStatus', 'sidoEduCode', 'sidoEduName', 'localEduCode', 'localEduName', 'createdDate', 'modifiedDate', 'dataDate', 'providerCode', 'providerName', 'neisEduCode', 'phoneNumber', 'faxNumber', 'homepageUrl', 'coeducationType', 'highSchoolType', 'dayNightType'],
  },
  market: {
    model: () => prisma.market,
    listFields: ['marketType', 'storeCount'],
    detailFields: ['marketType', 'openingCycle', 'storeCount', 'products', 'giftCertificates', 'homepageUrl', 'hasPublicToilet', 'hasParking', 'foundedYear', 'phoneNumber', 'dataDate', 'providerCode', 'providerName'],
  },
  childcare: {
    model: () => prisma.childcare,
    listFields: ['crtypename', 'crcapat', 'crchcnt'],
    detailFields: ['crtypename', 'crstatusname', 'zipcode', 'crtelno', 'crfaxno', 'crhome', 'crrepname', 'nrtrroomcnt', 'nrtrroomsize', 'plgrdco', 'cctvinstlcnt', 'chcrtescnt', 'crcapat', 'crchcnt', 'crcargbname', 'crcnfmdt', 'crpausebegindt', 'crpauseenddt', 'crabldt', 'datastdrdt', 'crspec', 'classCnt00', 'classCnt01', 'classCnt02', 'classCnt03', 'classCnt04', 'classCnt05', 'classCntM2', 'classCntM5', 'classCntSp', 'classCntTot', 'childCnt00', 'childCnt01', 'childCnt02', 'childCnt03', 'childCnt04', 'childCnt05', 'childCntM2', 'childCntM5', 'childCntSp', 'childCntTot', 'emCnt0y', 'emCnt1y', 'emCnt2y', 'emCnt4y', 'emCnt6y', 'emCntA1', 'emCntA2', 'emCntA3', 'emCntA4', 'emCntA5', 'emCntA6', 'emCntA10', 'emCntA7', 'emCntA8', 'emCntTot', 'ewCnt00', 'ewCnt01', 'ewCnt02', 'ewCnt03', 'ewCnt04', 'ewCnt05', 'ewCntM6', 'ewCntTot'],
  },
  'ev-charger': {
    model: () => prisma.evCharger,
    listFields: ['chgerType', 'output', 'busiNm', 'stat'],
    detailFields: ['statId', 'chgerId', 'chgerType', 'addrDetail', 'location', 'useTime', 'busiId', 'bnm', 'busiNm', 'busiCall', 'stat', 'statUpdDt', 'lastTsdt', 'lastTedt', 'nowTsdt', 'powerType', 'output', 'method', 'zcode', 'zscode', 'kind', 'kindDetail', 'parkingFree', 'note', 'limitYn', 'limitDetail', 'delYn', 'delDetail', 'trafficYn', 'year', 'floorNum', 'floorType', 'maker'],
  },
  sports: {
    model: () => prisma.sports,
    listFields: ['ftypeNm', 'fcobNm', 'faciGbNm'],
    detailFields: ['faciGbNm', 'fcobNm', 'ftypeNm', 'fmngCpNm', 'fmngCpbNm', 'faciGfa', 'standCptPsnCnt', 'faciHomepage', 'faciStatCd', 'addrCtpvNm', 'addrCpbNm', 'addrEmdNm', 'nationYn', 'fmngTypeGbNm', 'delYn', 'rowNum'],
  },
};
