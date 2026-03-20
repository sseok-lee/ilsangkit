-- Lighthouse T7: 시설 모델 name 인덱스 추가 (keyword 검색 최적화)
-- 프로덕션 DB에서 직접 실행

CREATE INDEX `Toilet_name_idx` ON `Toilet`(`name`);
CREATE INDEX `Wifi_name_idx` ON `Wifi`(`name`);
CREATE INDEX `Clothes_name_idx` ON `Clothes`(`name`);
CREATE INDEX `Park_name_idx` ON `Park`(`name`);
CREATE INDEX `School_name_idx` ON `School`(`name`);
CREATE INDEX `Childcare_name_idx` ON `Childcare`(`name`);
CREATE INDEX `Market_name_idx` ON `Market`(`name`);
CREATE INDEX `Parking_name_idx` ON `Parking`(`name`);
CREATE INDEX `Aed_name_idx` ON `Aed`(`name`);
CREATE INDEX `Library_name_idx` ON `Library`(`name`);
CREATE INDEX `EvCharger_name_idx` ON `EvCharger`(`name`);
CREATE INDEX `Sports_name_idx` ON `Sports`(`name`);
CREATE INDEX `Hospital_name_idx` ON `Hospital`(`name`);
CREATE INDEX `Pharmacy_name_idx` ON `Pharmacy`(`name`);
