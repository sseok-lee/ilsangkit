CREATE TABLE `RealEstatePublicUrl` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(20) NOT NULL,
  `buildingKey` CHAR(64) NOT NULL,
  `bjdCode` VARCHAR(10) NOT NULL,
  `buildingName` VARCHAR(200) NOT NULL,
  `basePath` TEXT NOT NULL,
  `basePathHash` CHAR(64) NOT NULL,
  `canonicalPath` TEXT NOT NULL,
  `pathHash` CHAR(64) NOT NULL,
  `dongName` VARCHAR(50) NULL,
  `jibun` VARCHAR(20) NULL,
  `addressSnapshot` JSON NOT NULL,
  `evidence` JSON NOT NULL,
  `sourceFingerprint` CHAR(64) NOT NULL,
  `baselineProvenance` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `RealEstatePublicUrl_type_buildingKey_key`(`type`, `buildingKey`),
  INDEX `RealEstatePublicUrl_pathHash_idx`(`pathHash`),
  INDEX `RealEstatePublicUrl_type_basePathHash_idx`(`type`, `basePathHash`),
  INDEX `RealEstatePublicUrl_type_buildingKey_basePathHash_idx`(`type`, `buildingKey`, `basePathHash`),
  INDEX `RealEstatePublicUrl_type_bjdCode_buildingName_idx`(`type`, `bjdCode`, `buildingName`),
  INDEX `RealEstatePublicUrl_sourceFingerprint_idx`(`sourceFingerprint`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RealEstatePublicUrlState` (
  `id` INTEGER NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `sourceFingerprint` CHAR(64) NOT NULL,
  `baselineProvenance` VARCHAR(255) NULL,
  `report` JSON NOT NULL,
  `validatedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
