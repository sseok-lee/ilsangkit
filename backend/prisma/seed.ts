// @TASK P12-T1 - DB 시드 스크립트 (개발 환경 초기화용)
// @SPEC 로컬 개발을 위한 최소 데이터셋 제공

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Category 시드 (7개 카테고리)
  console.log('📂 Seeding categories...');
  const categories = [
    { id: 'toilet', name: '공공화장실', icon: '🚻', description: '공공 화장실 위치 정보', sortOrder: 1, isActive: true },
    { id: 'wifi', name: '무료와이파이', icon: '📶', description: '무료 와이파이 존', sortOrder: 2, isActive: true },
    { id: 'clothes', name: '의류수거함', icon: '👕', description: '의류 수거함 위치', sortOrder: 3, isActive: true },
    { id: 'parking', name: '공영주차장', icon: '🅿️', description: '공영 주차장 정보', sortOrder: 4, isActive: true },
    { id: 'aed', name: '자동심장충격기', icon: '❤️', description: 'AED(제세동기) 위치', sortOrder: 5, isActive: true },
    { id: 'library', name: '공공도서관', icon: '📚', description: '공공 도서관 정보', sortOrder: 6, isActive: true },
    { id: 'park', name: '공원', icon: '🌳', description: '공원 위치 정보', sortOrder: 7, isActive: true },
    { id: 'school', name: '학교', icon: '🏫', description: '학교 위치 정보', sortOrder: 8, isActive: true },
    { id: 'market', name: '전통시장', icon: '🏪', description: '전통시장 위치 정보', sortOrder: 9, isActive: true },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }
  console.log(`✅ Created ${categories.length} categories`);

  // 2. Region 시드 (10개 지역)
  console.log('📍 Seeding regions...');
  const regions = [
    { bjdCode: '11110', city: '서울특별시', district: '종로구', slug: 'jongno', lat: new Decimal('37.5735207'), lng: new Decimal('126.9788341') },
    { bjdCode: '11140', city: '서울특별시', district: '중구', slug: 'jung', lat: new Decimal('37.5641104'), lng: new Decimal('126.9979466') },
    { bjdCode: '11170', city: '서울특별시', district: '용산구', slug: 'yongsan', lat: new Decimal('37.5326098'), lng: new Decimal('126.9903009') },
    { bjdCode: '11200', city: '서울특별시', district: '성동구', slug: 'seongdong', lat: new Decimal('37.5636452'), lng: new Decimal('127.0363719') },
    { bjdCode: '11230', city: '서울특별시', district: '광진구', slug: 'gwangjin', lat: new Decimal('37.5384843'), lng: new Decimal('127.0822806') },
    { bjdCode: '41111', city: '경기도', district: '수원시', slug: 'suwon', lat: new Decimal('37.2635727'), lng: new Decimal('127.0286009') },
    { bjdCode: '41131', city: '경기도', district: '성남시', slug: 'seongnam', lat: new Decimal('37.4201556'), lng: new Decimal('127.1262092') },
    { bjdCode: '41150', city: '경기도', district: '안양시', slug: 'anyang', lat: new Decimal('37.3943823'), lng: new Decimal('126.9568311') },
    { bjdCode: '26110', city: '부산광역시', district: '중구', slug: 'jung', lat: new Decimal('35.1065209'), lng: new Decimal('129.0322365') },
    { bjdCode: '26140', city: '부산광역시', district: '서구', slug: 'seo', lat: new Decimal('35.0972247'), lng: new Decimal('129.0244314') },
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: { bjdCode: region.bjdCode },
      update: region,
      create: region,
    });
  }
  console.log(`✅ Created ${regions.length} regions`);

  // 3. Toilet 시드 (10건)
  console.log('🚻 Seeding toilets...');
  const toilets = [
    { id: 'toilet-seed-1', name: '시청역 공공화장실', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-toilet-1', operatingHours: '24시간', maleToilets: 3, maleUrinals: 4, femaleToilets: 5, hasDisabledToilet: true, managingOrg: '중구청' },
    { id: 'toilet-seed-2', name: '광화문광장 화장실', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-toilet-2', operatingHours: '06:00-22:00', maleToilets: 4, maleUrinals: 5, femaleToilets: 6, hasDisabledToilet: true, managingOrg: '종로구청' },
    { id: 'toilet-seed-3', name: '용산역 공공화장실', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-toilet-3', operatingHours: '05:00-01:00', maleToilets: 5, maleUrinals: 6, femaleToilets: 7, hasDisabledToilet: true, managingOrg: '용산구청' },
    { id: 'toilet-seed-4', name: '성동구청 공공화장실', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-toilet-4', operatingHours: '09:00-18:00', maleToilets: 2, maleUrinals: 3, femaleToilets: 4, hasDisabledToilet: true, managingOrg: '성동구청' },
    { id: 'toilet-seed-5', name: '건대입구역 화장실', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-toilet-5', operatingHours: '24시간', maleToilets: 3, maleUrinals: 4, femaleToilets: 5, hasDisabledToilet: true, managingOrg: '광진구청' },
    { id: 'toilet-seed-6', name: '수원역 공공화장실', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-toilet-6', operatingHours: '05:30-00:30', maleToilets: 4, maleUrinals: 5, femaleToilets: 6, hasDisabledToilet: true, managingOrg: '수원시청' },
    { id: 'toilet-seed-7', name: '성남시청 화장실', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-toilet-7', operatingHours: '09:00-18:00', maleToilets: 3, maleUrinals: 4, femaleToilets: 5, hasDisabledToilet: true, managingOrg: '성남시청' },
    { id: 'toilet-seed-8', name: '안양시청 공공화장실', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-toilet-8', operatingHours: '09:00-18:00', maleToilets: 2, maleUrinals: 3, femaleToilets: 4, hasDisabledToilet: true, managingOrg: '안양시청' },
    { id: 'toilet-seed-9', name: '부산 중구청 화장실', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-toilet-9', operatingHours: '09:00-18:00', maleToilets: 3, maleUrinals: 4, femaleToilets: 5, hasDisabledToilet: true, managingOrg: '부산 중구청' },
    { id: 'toilet-seed-10', name: '부산 서구청 화장실', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-toilet-10', operatingHours: '09:00-18:00', maleToilets: 2, maleUrinals: 3, femaleToilets: 4, hasDisabledToilet: true, managingOrg: '부산 서구청' },
  ];

  for (const toilet of toilets) {
    await prisma.toilet.upsert({
      where: { sourceId: toilet.sourceId },
      update: toilet,
      create: toilet,
    });
  }
  console.log(`✅ Created ${toilets.length} toilets`);

  // 4. Wifi 시드 (10건)
  console.log('📶 Seeding wifi...');
  const wifis = [
    { id: 'wifi-seed-1', name: '시청 공공와이파이', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-wifi-1', ssid: 'Seoul_Free_WiFi', installDate: '2020-03-15', serviceProvider: 'SK브로드밴드', installLocation: '시청역 광장', managementAgency: '중구청', phoneNumber: '02-3396-5000' },
    { id: 'wifi-seed-2', name: '광화문 무료 와이파이', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-wifi-2', ssid: 'Gwanghwamun_WiFi', installDate: '2019-05-20', serviceProvider: 'KT', installLocation: '광화문광장', managementAgency: '종로구청', phoneNumber: '02-2148-1000' },
    { id: 'wifi-seed-3', name: '용산역 공공 와이파이', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-wifi-3', ssid: 'Yongsan_Free_WiFi', installDate: '2021-07-10', serviceProvider: 'LG U+', installLocation: '용산역 광장', managementAgency: '용산구청', phoneNumber: '02-2199-7000' },
    { id: 'wifi-seed-4', name: '성동구청 와이파이', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-wifi-4', ssid: 'Seongdong_WiFi', installDate: '2020-11-05', serviceProvider: 'SK브로드밴드', installLocation: '성동구청 앞', managementAgency: '성동구청', phoneNumber: '02-2286-5000' },
    { id: 'wifi-seed-5', name: '건대입구역 무료 와이파이', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-wifi-5', ssid: 'Gwangjin_Free_WiFi', installDate: '2019-08-30', serviceProvider: 'KT', installLocation: '건대입구역 광장', managementAgency: '광진구청', phoneNumber: '02-450-7114' },
    { id: 'wifi-seed-6', name: '수원역 공공 와이파이', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-wifi-6', ssid: 'Suwon_Free_WiFi', installDate: '2020-02-15', serviceProvider: 'LG U+', installLocation: '수원역 광장', managementAgency: '수원시청', phoneNumber: '031-228-2114' },
    { id: 'wifi-seed-7', name: '성남시청 와이파이', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-wifi-7', ssid: 'Seongnam_WiFi', installDate: '2021-03-20', serviceProvider: 'SK브로드밴드', installLocation: '성남시청 로비', managementAgency: '성남시청', phoneNumber: '031-729-2114' },
    { id: 'wifi-seed-8', name: '안양시청 공공 와이파이', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-wifi-8', ssid: 'Anyang_Free_WiFi', installDate: '2019-12-10', serviceProvider: 'KT', installLocation: '안양시청 광장', managementAgency: '안양시청', phoneNumber: '031-8045-2114' },
    { id: 'wifi-seed-9', name: '부산 중구청 와이파이', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-wifi-9', ssid: 'Busan_Jung_WiFi', installDate: '2020-06-25', serviceProvider: 'LG U+', installLocation: '중구청 앞', managementAgency: '부산 중구청', phoneNumber: '051-600-4000' },
    { id: 'wifi-seed-10', name: '부산 서구청 와이파이', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-wifi-10', ssid: 'Busan_Seo_WiFi', installDate: '2021-01-18', serviceProvider: 'SK브로드밴드', installLocation: '서구청 로비', managementAgency: '부산 서구청', phoneNumber: '051-240-4000' },
  ];

  for (const wifi of wifis) {
    await prisma.wifi.upsert({
      where: { sourceId: wifi.sourceId },
      update: wifi,
      create: wifi,
    });
  }
  console.log(`✅ Created ${wifis.length} wifi spots`);

  // 5. Clothes 시드 (10건)
  console.log('👕 Seeding clothes bins...');
  const clothes = [
    { id: 'clothes-seed-1', name: '시청역 의류수거함', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-clothes-1', managementAgency: '아름다운가게', phoneNumber: '02-2115-7044', dataDate: '2024-01-01', detailLocation: '시청역 1번 출구 앞' },
    { id: 'clothes-seed-2', name: '광화문 의류수거함', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-clothes-2', managementAgency: '굿윌스토어', phoneNumber: '02-2648-8620', dataDate: '2024-01-01', detailLocation: '광화문광장 동측' },
    { id: 'clothes-seed-3', name: '용산역 의류수거함', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-clothes-3', managementAgency: '아름다운가게', phoneNumber: '02-2115-7044', dataDate: '2024-01-01', detailLocation: '용산역 광장' },
    { id: 'clothes-seed-4', name: '성동구청 의류수거함', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-clothes-4', managementAgency: '굿윌스토어', phoneNumber: '02-2648-8620', dataDate: '2024-01-01', detailLocation: '성동구청 주차장' },
    { id: 'clothes-seed-5', name: '건대입구역 의류수거함', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-clothes-5', managementAgency: '아름다운가게', phoneNumber: '02-2115-7044', dataDate: '2024-01-01', detailLocation: '건대입구역 2번 출구' },
    { id: 'clothes-seed-6', name: '수원역 의류수거함', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-clothes-6', managementAgency: '굿윌스토어', phoneNumber: '031-8019-8620', dataDate: '2024-01-01', detailLocation: '수원역 광장' },
    { id: 'clothes-seed-7', name: '성남시청 의류수거함', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-clothes-7', managementAgency: '아름다운가게', phoneNumber: '031-752-7044', dataDate: '2024-01-01', detailLocation: '성남시청 앞 광장' },
    { id: 'clothes-seed-8', name: '안양시청 의류수거함', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-clothes-8', managementAgency: '굿윌스토어', phoneNumber: '031-8045-8620', dataDate: '2024-01-01', detailLocation: '안양시청 주차장' },
    { id: 'clothes-seed-9', name: '부산 중구청 의류수거함', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-clothes-9', managementAgency: '아름다운가게', phoneNumber: '051-630-7044', dataDate: '2024-01-01', detailLocation: '중구청 앞' },
    { id: 'clothes-seed-10', name: '부산 서구청 의류수거함', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-clothes-10', managementAgency: '굿윌스토어', phoneNumber: '051-240-8620', dataDate: '2024-01-01', detailLocation: '서구청 주차장' },
  ];

  for (const cloth of clothes) {
    await prisma.clothes.upsert({
      where: { sourceId: cloth.sourceId },
      update: cloth,
      create: cloth,
    });
  }
  console.log(`✅ Created ${clothes.length} clothes bins`);

  // 6. Parking 시드 (10건)
  console.log('🅿️ Seeding parking lots...');
  const parkings = [
    { id: 'parking-seed-1', name: '시청 공영주차장', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-parking-1', parkingType: '공영', lotType: '노외', capacity: 150, baseFee: 2000, baseTime: 30, additionalFee: 500, additionalTime: 10, dailyMaxFee: 20000, monthlyFee: 150000, operatingHours: '24시간', phone: '02-120', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-2', name: '광화문 공영주차장', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-parking-2', parkingType: '공영', lotType: '노외', capacity: 200, baseFee: 2500, baseTime: 30, additionalFee: 600, additionalTime: 10, dailyMaxFee: 25000, monthlyFee: 180000, operatingHours: '24시간', phone: '02-2148-2000', paymentMethod: '신용카드, 현금, 교통카드', hasDisabledParking: true },
    { id: 'parking-seed-3', name: '용산역 공영주차장', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-parking-3', parkingType: '공영', lotType: '노외', capacity: 180, baseFee: 2000, baseTime: 30, additionalFee: 500, additionalTime: 10, dailyMaxFee: 18000, monthlyFee: 140000, operatingHours: '24시간', phone: '02-2199-8000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-4', name: '성동구청 공영주차장', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-parking-4', parkingType: '공영', lotType: '노외', capacity: 100, baseFee: 1500, baseTime: 30, additionalFee: 400, additionalTime: 10, dailyMaxFee: 15000, monthlyFee: 120000, operatingHours: '08:00-20:00', phone: '02-2286-6000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-5', name: '건대입구역 공영주차장', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-parking-5', parkingType: '공영', lotType: '노외', capacity: 120, baseFee: 2000, baseTime: 30, additionalFee: 500, additionalTime: 10, dailyMaxFee: 20000, monthlyFee: 150000, operatingHours: '24시간', phone: '02-450-8000', paymentMethod: '신용카드, 현금, 교통카드', hasDisabledParking: true },
    { id: 'parking-seed-6', name: '수원역 공영주차장', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-parking-6', parkingType: '공영', lotType: '노외', capacity: 250, baseFee: 1800, baseTime: 30, additionalFee: 450, additionalTime: 10, dailyMaxFee: 18000, monthlyFee: 130000, operatingHours: '24시간', phone: '031-228-3000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-7', name: '성남시청 공영주차장', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-parking-7', parkingType: '공영', lotType: '노외', capacity: 150, baseFee: 1500, baseTime: 30, additionalFee: 400, additionalTime: 10, dailyMaxFee: 15000, monthlyFee: 120000, operatingHours: '08:00-20:00', phone: '031-729-3000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-8', name: '안양시청 공영주차장', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-parking-8', parkingType: '공영', lotType: '노외', capacity: 130, baseFee: 1500, baseTime: 30, additionalFee: 400, additionalTime: 10, dailyMaxFee: 15000, monthlyFee: 110000, operatingHours: '08:00-20:00', phone: '031-8045-3000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-9', name: '부산 중구청 공영주차장', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-parking-9', parkingType: '공영', lotType: '노외', capacity: 110, baseFee: 1500, baseTime: 30, additionalFee: 400, additionalTime: 10, dailyMaxFee: 14000, monthlyFee: 110000, operatingHours: '08:00-20:00', phone: '051-600-5000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
    { id: 'parking-seed-10', name: '부산 서구청 공영주차장', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-parking-10', parkingType: '공영', lotType: '노외', capacity: 90, baseFee: 1500, baseTime: 30, additionalFee: 400, additionalTime: 10, dailyMaxFee: 14000, monthlyFee: 100000, operatingHours: '08:00-20:00', phone: '051-240-5000', paymentMethod: '신용카드, 현금', hasDisabledParking: true },
  ];

  for (const parking of parkings) {
    await prisma.parking.upsert({
      where: { sourceId: parking.sourceId },
      update: parking,
      create: parking,
    });
  }
  console.log(`✅ Created ${parkings.length} parking lots`);

  // 8. Aed 시드 (10건)
  console.log('❤️ Seeding AEDs...');
  const aeds = [
    { id: 'aed-seed-1', name: '시청역 AED', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-aed-1', buildPlace: '시청역 1번 출구 벽면', org: '서울교통공사', clerkTel: '02-6110-1234', mfg: '필립스', model: 'HeartStart HS1', monSttTme: '0000', monEndTme: '2400', tueSttTme: '0000', tueEndTme: '2400', wedSttTme: '0000', wedEndTme: '2400', thuSttTme: '0000', thuEndTme: '2400', friSttTme: '0000', friEndTme: '2400', satSttTme: '0000', satEndTme: '2400', sunSttTme: '0000', sunEndTme: '2400', holSttTme: '0000', holEndTme: '2400' },
    { id: 'aed-seed-2', name: '광화문 AED', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-aed-2', buildPlace: '광화문 D타워 1층 로비', org: '종로구청', clerkTel: '02-2148-1234', mfg: '메드트로닉', model: 'Lifepak CR Plus', monSttTme: '0800', monEndTme: '2000', tueSttTme: '0800', tueEndTme: '2000', wedSttTme: '0800', wedEndTme: '2000', thuSttTme: '0800', thuEndTme: '2000', friSttTme: '0800', friEndTme: '2000', satSttTme: '0900', satEndTme: '1800', sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
    { id: 'aed-seed-3', name: '용산역 AED', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-aed-3', buildPlace: '용산역 대합실 안내데스크 옆', org: '한국철도공사', clerkTel: '1544-7788', mfg: '필립스', model: 'HeartStart FRx', monSttTme: '0000', monEndTme: '2400', tueSttTme: '0000', tueEndTme: '2400', wedSttTme: '0000', wedEndTme: '2400', thuSttTme: '0000', thuEndTme: '2400', friSttTme: '0000', friEndTme: '2400', satSttTme: '0000', satEndTme: '2400', sunSttTme: '0000', sunEndTme: '2400', holSttTme: '0000', holEndTme: '2400' },
    { id: 'aed-seed-4', name: '성동구청 AED', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-aed-4', buildPlace: '성동구청 민원실 입구', org: '성동구청', clerkTel: '02-2286-5678', mfg: '큐알디', model: 'AED Plus', monSttTme: '0900', monEndTme: '1800', tueSttTme: '0900', tueEndTme: '1800', wedSttTme: '0900', wedEndTme: '1800', thuSttTme: '0900', thuEndTme: '1800', friSttTme: '0900', friEndTme: '1800', satSttTme: null, satEndTme: null, sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
    { id: 'aed-seed-5', name: '건대입구역 AED', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-aed-5', buildPlace: '건대입구역 2번 출구 벽면', org: '서울교통공사', clerkTel: '02-6110-2345', mfg: '필립스', model: 'HeartStart HS1', monSttTme: '0000', monEndTme: '2400', tueSttTme: '0000', tueEndTme: '2400', wedSttTme: '0000', wedEndTme: '2400', thuSttTme: '0000', thuEndTme: '2400', friSttTme: '0000', friEndTme: '2400', satSttTme: '0000', satEndTme: '2400', sunSttTme: '0000', sunEndTme: '2400', holSttTme: '0000', holEndTme: '2400' },
    { id: 'aed-seed-6', name: '수원역 AED', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-aed-6', buildPlace: '수원역 대합실 매표소 옆', org: '한국철도공사', clerkTel: '1544-7788', mfg: '메드트로닉', model: 'Lifepak 1000', monSttTme: '0000', monEndTme: '2400', tueSttTme: '0000', tueEndTme: '2400', wedSttTme: '0000', wedEndTme: '2400', thuSttTme: '0000', thuEndTme: '2400', friSttTme: '0000', friEndTme: '2400', satSttTme: '0000', satEndTme: '2400', sunSttTme: '0000', sunEndTme: '2400', holSttTme: '0000', holEndTme: '2400' },
    { id: 'aed-seed-7', name: '성남시청 AED', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-aed-7', buildPlace: '성남시청 민원실', org: '성남시청', clerkTel: '031-729-2345', mfg: '큐알디', model: 'AED Plus', monSttTme: '0900', monEndTme: '1800', tueSttTme: '0900', tueEndTme: '1800', wedSttTme: '0900', wedEndTme: '1800', thuSttTme: '0900', thuEndTme: '1800', friSttTme: '0900', friEndTme: '1800', satSttTme: null, satEndTme: null, sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
    { id: 'aed-seed-8', name: '안양시청 AED', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-aed-8', buildPlace: '안양시청 1층 로비', org: '안양시청', clerkTel: '031-8045-2345', mfg: '필립스', model: 'HeartStart FRx', monSttTme: '0900', monEndTme: '1800', tueSttTme: '0900', tueEndTme: '1800', wedSttTme: '0900', wedEndTme: '1800', thuSttTme: '0900', thuEndTme: '1800', friSttTme: '0900', friEndTme: '1800', satSttTme: null, satEndTme: null, sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
    { id: 'aed-seed-9', name: '부산 중구청 AED', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-aed-9', buildPlace: '중구청 민원실', org: '부산 중구청', clerkTel: '051-600-4567', mfg: '메드트로닉', model: 'Lifepak CR Plus', monSttTme: '0900', monEndTme: '1800', tueSttTme: '0900', tueEndTme: '1800', wedSttTme: '0900', wedEndTme: '1800', thuSttTme: '0900', thuEndTme: '1800', friSttTme: '0900', friEndTme: '1800', satSttTme: null, satEndTme: null, sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
    { id: 'aed-seed-10', name: '부산 서구청 AED', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-aed-10', buildPlace: '서구청 민원실', org: '부산 서구청', clerkTel: '051-240-4567', mfg: '큐알디', model: 'AED Plus', monSttTme: '0900', monEndTme: '1800', tueSttTme: '0900', tueEndTme: '1800', wedSttTme: '0900', wedEndTme: '1800', thuSttTme: '0900', thuEndTme: '1800', friSttTme: '0900', friEndTme: '1800', satSttTme: null, satEndTme: null, sunSttTme: null, sunEndTme: null, holSttTme: null, holEndTme: null },
  ];

  for (const aed of aeds) {
    await prisma.aed.upsert({
      where: { sourceId: aed.sourceId },
      update: aed,
      create: aed,
    });
  }
  console.log(`✅ Created ${aeds.length} AEDs`);

  // 9. Library 시드 (10건)
  console.log('📚 Seeding libraries...');
  const libraries = [
    { id: 'library-seed-1', name: '서울시립 중구도서관', address: '서울특별시 중구 세종대로 110', roadAddress: '서울특별시 중구 세종대로 110', lat: new Decimal('37.5663901'), lng: new Decimal('126.9784147'), city: '서울특별시', district: '중구', bjdCode: '11140', sourceId: 'seed-library-1', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 250, bookCount: 50000, serialCount: 150, nonBookCount: 3000, loanableBooks: 5, loanableDays: 14, phoneNumber: '02-3396-5600', homepageUrl: 'https://junglib.seoul.kr', operatingOrg: '서울특별시 중구청' },
    { id: 'library-seed-2', name: '종로도서관', address: '서울특별시 종로구 세종대로 172', roadAddress: '서울특별시 종로구 세종대로 172', lat: new Decimal('37.5719505'), lng: new Decimal('126.9767758'), city: '서울특별시', district: '종로구', bjdCode: '11110', sourceId: 'seed-library-2', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '21:00', saturdayOpenTime: '09:00', saturdayCloseTime: '18:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 300, bookCount: 70000, serialCount: 200, nonBookCount: 5000, loanableBooks: 5, loanableDays: 14, phoneNumber: '02-2148-3000', homepageUrl: 'https://jongnolib.seoul.kr', operatingOrg: '서울특별시 종로구청' },
    { id: 'library-seed-3', name: '용산도서관', address: '서울특별시 용산구 한강대로23길 55', roadAddress: '서울특별시 용산구 한강대로23길 55', lat: new Decimal('37.5294591'), lng: new Decimal('126.9645304'), city: '서울특별시', district: '용산구', bjdCode: '11170', sourceId: 'seed-library-3', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 200, bookCount: 45000, serialCount: 120, nonBookCount: 2500, loanableBooks: 5, loanableDays: 14, phoneNumber: '02-2199-7800', homepageUrl: 'https://yongsanlib.seoul.kr', operatingOrg: '서울특별시 용산구청' },
    { id: 'library-seed-4', name: '성동구립도서관', address: '서울특별시 성동구 고산자로 270', roadAddress: '서울특별시 성동구 고산자로 270', lat: new Decimal('37.5631012'), lng: new Decimal('127.0365145'), city: '서울특별시', district: '성동구', bjdCode: '11200', sourceId: 'seed-library-4', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 180, bookCount: 40000, serialCount: 100, nonBookCount: 2000, loanableBooks: 5, loanableDays: 14, phoneNumber: '02-2286-5800', homepageUrl: 'https://sdlib.seoul.kr', operatingOrg: '서울특별시 성동구청' },
    { id: 'library-seed-5', name: '광진구립도서관', address: '서울특별시 광진구 능동로 110', roadAddress: '서울특별시 광진구 능동로 110', lat: new Decimal('37.5400456'), lng: new Decimal('127.0696799'), city: '서울특별시', district: '광진구', bjdCode: '11230', sourceId: 'seed-library-5', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '21:00', saturdayOpenTime: '09:00', saturdayCloseTime: '18:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 220, bookCount: 55000, serialCount: 130, nonBookCount: 3500, loanableBooks: 5, loanableDays: 14, phoneNumber: '02-450-1900', homepageUrl: 'https://gjlib.seoul.kr', operatingOrg: '서울특별시 광진구청' },
    { id: 'library-seed-6', name: '수원시립 중앙도서관', address: '경기도 수원시 팔달구 덕영대로 924', roadAddress: '경기도 수원시 팔달구 덕영대로 924', lat: new Decimal('37.2660737'), lng: new Decimal('127.0014581'), city: '경기도', district: '수원시', bjdCode: '41111', sourceId: 'seed-library-6', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 350, bookCount: 80000, serialCount: 250, nonBookCount: 6000, loanableBooks: 5, loanableDays: 14, phoneNumber: '031-228-4700', homepageUrl: 'https://suwonlib.go.kr', operatingOrg: '수원시청' },
    { id: 'library-seed-7', name: '성남시립 중앙도서관', address: '경기도 성남시 중원구 성남대로 997', roadAddress: '경기도 성남시 중원구 성남대로 997', lat: new Decimal('37.4212251'), lng: new Decimal('127.1265149'), city: '경기도', district: '성남시', bjdCode: '41131', sourceId: 'seed-library-7', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 280, bookCount: 65000, serialCount: 180, nonBookCount: 4000, loanableBooks: 5, loanableDays: 14, phoneNumber: '031-729-4300', homepageUrl: 'https://snlib.go.kr', operatingOrg: '성남시청' },
    { id: 'library-seed-8', name: '안양시립 도서관', address: '경기도 안양시 만안구 안양로 122', roadAddress: '경기도 안양시 만안구 안양로 122', lat: new Decimal('37.3948644'), lng: new Decimal('126.9567571'), city: '경기도', district: '안양시', bjdCode: '41150', sourceId: 'seed-library-8', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 230, bookCount: 50000, serialCount: 140, nonBookCount: 3000, loanableBooks: 5, loanableDays: 14, phoneNumber: '031-8045-4500', homepageUrl: 'https://anyanglib.go.kr', operatingOrg: '안양시청' },
    { id: 'library-seed-9', name: '부산시립 중구도서관', address: '부산광역시 중구 중앙대로 120', roadAddress: '부산광역시 중구 중앙대로 120', lat: new Decimal('35.1030212'), lng: new Decimal('129.0327968'), city: '부산광역시', district: '중구', bjdCode: '26110', sourceId: 'seed-library-9', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 200, bookCount: 45000, serialCount: 110, nonBookCount: 2500, loanableBooks: 5, loanableDays: 14, phoneNumber: '051-600-4800', homepageUrl: 'https://busanlib.go.kr', operatingOrg: '부산광역시 중구청' },
    { id: 'library-seed-10', name: '부산시립 서구도서관', address: '부산광역시 서구 구덕로 120', roadAddress: '부산광역시 서구 구덕로 120', lat: new Decimal('35.0969678'), lng: new Decimal('129.0244085'), city: '부산광역시', district: '서구', bjdCode: '26140', sourceId: 'seed-library-10', libraryType: '공립 공공도서관', closedDays: '월요일, 법정공휴일', weekdayOpenTime: '09:00', weekdayCloseTime: '20:00', saturdayOpenTime: '09:00', saturdayCloseTime: '17:00', holidayOpenTime: null, holidayCloseTime: null, seatCount: 180, bookCount: 40000, serialCount: 100, nonBookCount: 2000, loanableBooks: 5, loanableDays: 14, phoneNumber: '051-240-4900', homepageUrl: 'https://busanseolib.go.kr', operatingOrg: '부산광역시 서구청' },
  ];

  for (const library of libraries) {
    await prisma.library.upsert({
      where: { sourceId: library.sourceId },
      update: library,
      create: library,
    });
  }
  console.log(`✅ Created ${libraries.length} libraries`);

  // 10. WasteSchedule 시드 (5건)
  console.log('🗑️ Seeding waste schedules...');
  const wasteSchedules = [
    { city: '서울특별시', district: '중구', targetRegion: '명동, 을지로, 회현동 일대', emissionPlace: '각 집합건물 지정 장소', details: { emissionDays: ['월요일', '목요일'], emissionTime: '20:00-24:00', wasteTypes: ['일반쓰레기', '음식물쓰레기', '재활용'], remarks: '배출시간 엄수' }, sourceId: 'seed-waste-schedule-1', sourceUrl: 'https://www.data.go.kr/data/15155080' },
    { city: '서울특별시', district: '종로구', targetRegion: '광화문, 종로1가~6가 일대', emissionPlace: '각 건물 앞 지정 장소', details: { emissionDays: ['화요일', '금요일'], emissionTime: '19:00-23:00', wasteTypes: ['일반쓰레기', '음식물쓰레기', '재활용'], remarks: '대형폐기물은 별도 신고' }, sourceId: 'seed-waste-schedule-2', sourceUrl: 'https://www.data.go.kr/data/15155080' },
    { city: '서울특별시', district: '용산구', targetRegion: '이촌동, 용산동, 한남동 일대', emissionPlace: '아파트 지정 수거장', details: { emissionDays: ['월요일', '수요일', '금요일'], emissionTime: '18:00-22:00', wasteTypes: ['일반쓰레기', '음식물쓰레기', '재활용'], remarks: '음식물 물기 제거 필수' }, sourceId: 'seed-waste-schedule-3', sourceUrl: 'https://www.data.go.kr/data/15155080' },
    { city: '경기도', district: '수원시', targetRegion: '팔달구, 영통구, 권선구 일대', emissionPlace: '각 동별 지정 수거함', details: { emissionDays: ['월요일', '목요일'], emissionTime: '20:00-24:00', wasteTypes: ['일반쓰레기', '음식물쓰레기', '재활용', '대형폐기물'], remarks: '분리수거 철저' }, sourceId: 'seed-waste-schedule-4', sourceUrl: 'https://www.data.go.kr/data/15155080' },
    { city: '부산광역시', district: '중구', targetRegion: '남포동, 광복동, 중앙동 일대', emissionPlace: '각 건물 앞 지정 장소', details: { emissionDays: ['화요일', '금요일'], emissionTime: '19:00-23:00', wasteTypes: ['일반쓰레기', '음식물쓰레기', '재활용'], remarks: '배출봉투 사용 필수' }, sourceId: 'seed-waste-schedule-5', sourceUrl: 'https://www.data.go.kr/data/15155080' },
  ];

  for (const schedule of wasteSchedules) {
    await prisma.wasteSchedule.upsert({
      where: { city_district_sourceId: { city: schedule.city, district: schedule.district, sourceId: schedule.sourceId } },
      update: schedule,
      create: schedule,
    });
  }
  console.log(`✅ Created ${wasteSchedules.length} waste schedules`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
