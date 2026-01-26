-- @TASK T0.4 - 초기 데이터베이스 마이그레이션
-- @SPEC docs/planning/04-database-design.md

-- CreateEnum for FacilityCategory
CREATE TYPE `FacilityCategory` ENUM ('toilet', 'trash', 'wifi', 'clothes', 'battery', 'kiosk');

-- CreateEnum for SyncStatus
CREATE TYPE `SyncStatus` ENUM ('running', 'success', 'failed');

-- CreateTable Facility
CREATE TABLE `Facility` (
    `id` VARCHAR(50) NOT NULL,
    `category` ENUM('toilet', 'trash', 'wifi', 'clothes', 'battery', 'kiosk') NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `address` VARCHAR(500),
    `roadAddress` VARCHAR(500),
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `city` VARCHAR(50) NOT NULL,
    `district` VARCHAR(50) NOT NULL,
    `bjdCode` VARCHAR(5),
    `details` JSON,
    `sourceId` VARCHAR(100) NOT NULL,
    `sourceUrl` VARCHAR(500),
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Facility_category_sourceId_key`(`category`, `sourceId`),
    INDEX `Facility_category_city_district_idx`(`category`, `city`, `district`),
    INDEX `Facility_lat_lng_idx`(`lat`, `lng`),
    INDEX `Facility_city_district_idx`(`city`, `district`),
    INDEX `Facility_bjdCode_idx`(`bjdCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Category
CREATE TABLE `Category` (
    `id` VARCHAR(20) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(10) NOT NULL,
    `description` VARCHAR(200),
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Region
CREATE TABLE `Region` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bjdCode` VARCHAR(5) NOT NULL,
    `city` VARCHAR(50) NOT NULL,
    `district` VARCHAR(50) NOT NULL,
    `slug` VARCHAR(50) NOT NULL,
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,

    UNIQUE INDEX `Region_bjdCode_key`(`bjdCode`),
    UNIQUE INDEX `Region_city_district_key`(`city`, `district`),
    UNIQUE INDEX `Region_city_slug_key`(`city`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SearchLog
CREATE TABLE `SearchLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` VARCHAR(32) NOT NULL,
    `keyword` VARCHAR(200),
    `category` VARCHAR(20),
    `city` VARCHAR(50),
    `district` VARCHAR(50),
    `lat` DECIMAL(10, 7),
    `lng` DECIMAL(10, 7),
    `resultCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SearchLog_createdAt_idx`(`createdAt`),
    INDEX `SearchLog_keyword_idx`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SyncHistory
CREATE TABLE `SyncHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(20) NOT NULL,
    `status` ENUM('running', 'success', 'failed') NOT NULL,
    `totalRecords` INTEGER NOT NULL DEFAULT 0,
    `newRecords` INTEGER NOT NULL DEFAULT 0,
    `updatedRecords` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` TEXT,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
