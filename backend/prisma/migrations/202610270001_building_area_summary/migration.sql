-- 지도 필터 요청에서 거래 테이블 스캔을 제거한다. MySQL 8.
CREATE TABLE `RealEstateBuildingAreaSummary` (
  `type` VARCHAR(20) NOT NULL,
  `buildingKey` CHAR(64) NOT NULL,
  `areaBand` INTEGER NOT NULL,
  `buildingName` VARCHAR(200) NOT NULL,
  `bjdCode` VARCHAR(10) NOT NULL,
  `city` VARCHAR(50) NOT NULL,
  `district` VARCHAR(50) NOT NULL,
  `dongName` VARCHAR(50) NOT NULL,
  `jibun` VARCHAR(20) NULL,
  `lat` DECIMAL(10,7) NULL,
  `lng` DECIMAL(10,7) NULL,
  `transactionCount` INTEGER NOT NULL DEFAULT 0,
  `saleAmount` BIGINT NULL,
  `jeonseDeposit` INTEGER NULL,
  `wolseMonthlyRent` INTEGER NULL,
  `latestDeals` JSON NOT NULL,
  `refreshRunId` CHAR(36) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`type`, `buildingKey`, `areaBand`),
  KEY `re_area_type_band_lat_lng_idx` (`type`, `areaBand`, `lat`, `lng`, `saleAmount`, `jeonseDeposit`, `wolseMonthlyRent`, `transactionCount`),
  KEY `re_area_type_bjd_key_idx` (`type`, `bjdCode`, `buildingKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RealEstateAreaSummaryState` (
  `type` VARCHAR(20) NOT NULL,
  `scope` VARCHAR(10) NOT NULL,
  `runId` CHAR(36) NOT NULL,
  `lastBuildingKey` CHAR(64) NOT NULL,
  `dateThrough` CHAR(10) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `readyAt` DATETIME(3) NULL,
  PRIMARY KEY (`type`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
