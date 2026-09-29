CREATE TABLE `WasteStagedSchedule` (
  `scheduleId` INTEGER NOT NULL,

  PRIMARY KEY (`scheduleId`),
  CONSTRAINT `WasteStagedSchedule_scheduleId_fkey`
    FOREIGN KEY (`scheduleId`) REFERENCES `WasteSchedule`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteGeneration` (
  `id` VARCHAR(36) NOT NULL,
  `baseGenerationId` VARCHAR(36) NULL,
  `status` ENUM('staging', 'ready', 'published', 'failed') NOT NULL,
  `referenceVersion` VARCHAR(128) NOT NULL,
  `inputHash` VARCHAR(64) NOT NULL,
  `reportHash` VARCHAR(64) NOT NULL,
  `sourceComplete` BOOLEAN NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  INDEX `WasteGeneration_baseGenerationId_idx`(`baseGenerationId`),
  INDEX `WasteGeneration_status_idx`(`status`),
  INDEX `WasteGeneration_inputHash_idx`(`inputHash`),
  CONSTRAINT `WasteGeneration_baseGenerationId_fkey`
    FOREIGN KEY (`baseGenerationId`) REFERENCES `WasteGeneration`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WastePublication` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `activeGenerationId` VARCHAR(36) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  CONSTRAINT `WastePublication_activeGenerationId_fkey`
    FOREIGN KEY (`activeGenerationId`) REFERENCES `WasteGeneration`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `WastePublication_singleton_chk` CHECK (`id` = 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteArea` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `kind` ENUM('administrative', 'legal') NOT NULL,
  `code` VARCHAR(20) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `WasteArea_kind_code_key`(`kind`, `code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteAreaEntry` (
  `generationId` VARCHAR(36) NOT NULL,
  `areaId` INTEGER NOT NULL,
  `level` ENUM('province', 'district', 'dong', 'ri') NOT NULL,
  `city` VARCHAR(50) NOT NULL,
  `district` VARCHAR(50) NOT NULL,
  `districtCode` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NULL,
  `evidence` JSON NOT NULL,
  `indexEligible` BOOLEAN NOT NULL DEFAULT false,
  `indexReason` VARCHAR(255) NULL,
  `contentFingerprint` VARCHAR(64) NOT NULL,
  `contentUpdatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`generationId`, `areaId`),
  INDEX `WasteAreaEntry_generationId_city_district_name_idx`(`generationId`, `city`, `district`, `name`),
  INDEX `WasteAreaEntry_areaId_idx`(`areaId`),
  CONSTRAINT `WasteAreaEntry_generationId_fkey`
    FOREIGN KEY (`generationId`) REFERENCES `WasteGeneration`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WasteAreaEntry_areaId_fkey`
    FOREIGN KEY (`areaId`) REFERENCES `WasteArea`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteAreaRelation` (
  `generationId` VARCHAR(36) NOT NULL,
  `relationKey` VARCHAR(64) NOT NULL,
  `fromAreaId` INTEGER NULL,
  `alias` VARCHAR(100) NULL,
  `toAreaId` INTEGER NOT NULL,
  `evidence` JSON NOT NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NULL,

  PRIMARY KEY (`generationId`, `relationKey`),
  INDEX `WasteAreaRelation_generationId_fromAreaId_idx`(`generationId`, `fromAreaId`),
  INDEX `WasteAreaRelation_generationId_toAreaId_idx`(`generationId`, `toAreaId`),
  INDEX `WasteAreaRelation_toAreaId_idx`(`toAreaId`),
  CONSTRAINT `WasteAreaRelation_generationId_fkey`
    FOREIGN KEY (`generationId`) REFERENCES `WasteGeneration`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WasteAreaRelation_fromEntry_fkey`
    FOREIGN KEY (`generationId`, `fromAreaId`) REFERENCES `WasteAreaEntry`(`generationId`, `areaId`)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `WasteAreaRelation_toEntry_fkey`
    FOREIGN KEY (`generationId`, `toAreaId`) REFERENCES `WasteAreaEntry`(`generationId`, `areaId`)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `WasteAreaRelation_toAreaId_fkey`
    FOREIGN KEY (`toAreaId`) REFERENCES `WasteArea`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WasteAreaRelation_source_chk` CHECK (
    (`fromAreaId` IS NOT NULL AND `alias` IS NULL)
    OR (`fromAreaId` IS NULL AND `alias` IS NOT NULL)
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteScheduleRevision` (
  `generationId` VARCHAR(36) NOT NULL,
  `scheduleId` INTEGER NOT NULL,
  `city` VARCHAR(50) NOT NULL,
  `district` VARCHAR(50) NOT NULL,
  `sourceId` VARCHAR(100) NOT NULL,
  `targetRegion` TEXT NULL,
  `emissionPlace` VARCHAR(100) NULL,
  `details` JSON NULL,
  `sourceUrl` VARCHAR(500) NULL,
  `govCode` VARCHAR(20) NULL,
  `rawPayload` JSON NULL,
  `provenance` ENUM('legacy', 'raw') NOT NULL,
  `contentHash` VARCHAR(64) NOT NULL,
  `sourceModifiedAt` DATETIME(3) NULL,
  `observedAt` DATETIME(3) NOT NULL,
  `contentUpdatedAt` DATETIME(3) NOT NULL,
  `state` ENUM('active', 'inactive', 'conflict') NOT NULL,
  `missingCompleteRuns` INTEGER NOT NULL,
  `terminationEvidence` JSON NULL,

  PRIMARY KEY (`generationId`, `scheduleId`),
  INDEX `WasteScheduleRevision_generationId_city_district_state_idx`(`generationId`, `city`, `district`, `state`),
  INDEX `WasteScheduleRevision_scheduleId_idx`(`scheduleId`),
  CONSTRAINT `WasteScheduleRevision_generationId_fkey`
    FOREIGN KEY (`generationId`) REFERENCES `WasteGeneration`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WasteScheduleRevision_scheduleId_fkey`
    FOREIGN KEY (`scheduleId`) REFERENCES `WasteSchedule`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WasteScheduleCoverage` (
  `generationId` VARCHAR(36) NOT NULL,
  `scheduleId` INTEGER NOT NULL,
  `coverageKey` VARCHAR(64) NOT NULL,
  `areaId` INTEGER NULL,
  `districtCode` VARCHAR(20) NULL,
  `scope` ENUM('whole', 'partial', 'conditional') NOT NULL,
  `conditionText` TEXT NOT NULL,
  `state` ENUM('verified', 'unresolved', 'conflict') NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `evidence` JSON NOT NULL,

  PRIMARY KEY (`generationId`, `scheduleId`, `coverageKey`),
  INDEX `WasteScheduleCoverage_generationId_areaId_state_idx`(`generationId`, `areaId`, `state`),
  INDEX `WasteScheduleCoverage_generationId_districtCode_state_idx`(`generationId`, `districtCode`, `state`),
  CONSTRAINT `WasteScheduleCoverage_revision_fkey`
    FOREIGN KEY (`generationId`, `scheduleId`) REFERENCES `WasteScheduleRevision`(`generationId`, `scheduleId`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WasteScheduleCoverage_areaEntry_fkey`
    FOREIGN KEY (`generationId`, `areaId`) REFERENCES `WasteAreaEntry`(`generationId`, `areaId`)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `WasteScheduleCoverage_verified_target_chk` CHECK (
    `state` <> 'verified'
    OR ((`areaId` IS NOT NULL AND `districtCode` IS NULL) OR (`areaId` IS NULL AND `districtCode` IS NOT NULL))
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
