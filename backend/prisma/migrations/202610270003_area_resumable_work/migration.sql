ALTER TABLE `RealEstateAreaSummaryState` ADD COLUMN `incrementalJob` JSON NULL;

CREATE TABLE `RealEstateAreaSummaryWork` (
  `type` VARCHAR(20) NOT NULL,
  `buildingKey` CHAR(64) NOT NULL,
  PRIMARY KEY (`type`, `buildingKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
