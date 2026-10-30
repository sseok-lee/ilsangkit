-- CreateTable
CREATE TABLE `BusStop` (
    `nodeId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `mobileId` VARCHAR(10) NULL,
    `cityCode` VARCHAR(5) NULL,
    `cityName` VARCHAR(50) NULL,
    `adminName` VARCHAR(50) NULL,
    `collectedAt` VARCHAR(10) NULL,
    `sourceVersion` VARCHAR(8) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BusStop_lat_idx`(`lat`),
    INDEX `BusStop_lng_idx`(`lng`),
    INDEX `BusStop_sourceVersion_idx`(`sourceVersion`),
    PRIMARY KEY (`nodeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
