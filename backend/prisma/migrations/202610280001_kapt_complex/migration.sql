-- CreateTable
CREATE TABLE `KaptComplex` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kaptCode` VARCHAR(20) NOT NULL,
    `sido` VARCHAR(30) NOT NULL,
    `sigungu` VARCHAR(30) NOT NULL,
    `eupmyeon` VARCHAR(30) NULL,
    `dongri` VARCHAR(30) NULL,
    `name` VARCHAR(200) NOT NULL,
    `complexType` VARCHAR(30) NULL,
    `lawAddress` TEXT NULL,
    `roadAddress` VARCHAR(300) NULL,
    `zipcode` VARCHAR(10) NULL,
    `saleType` VARCHAR(30) NULL,
    `useApprovalDate` VARCHAR(8) NULL,
    `dongCount` INTEGER NULL,
    `householdCount` INTEGER NULL,
    `saleHouseholdCount` INTEGER NULL,
    `rentHouseholdCount` INTEGER NULL,
    `managementType` VARCHAR(30) NULL,
    `heatingType` VARCHAR(30) NULL,
    `corridorType` VARCHAR(30) NULL,
    `builder` VARCHAR(200) NULL,
    `developer` VARCHAR(200) NULL,
    `buildingStructure` VARCHAR(100) NULL,
    `topFloor` INTEGER NULL,
    `topFloorLedger` INTEGER NULL,
    `basementFloors` INTEGER NULL,
    `totalParking` INTEGER NULL,
    `groundParking` INTEGER NULL,
    `undergroundParking` INTEGER NULL,
    `cctvCount` INTEGER NULL,
    `managementArea` DECIMAL(14, 2) NULL,
    `exclusiveAreaTotal` DECIMAL(14, 2) NULL,
    `raw` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KaptComplex_kaptCode_key`(`kaptCode`),
    INDEX `KaptComplex_sigungu_dongri_idx`(`sigungu`, `dongri`),
    INDEX `KaptComplex_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KaptComplexParcel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kaptCode` VARCHAR(20) NOT NULL,
    `pnu` CHAR(19) NOT NULL,
    `sggCode` CHAR(5) NOT NULL,
    `bjdCode` CHAR(10) NOT NULL,
    `isMountain` BOOLEAN NOT NULL DEFAULT false,
    `mainNo` INTEGER NOT NULL,
    `subNo` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KaptComplexParcel_sggCode_mainNo_subNo_idx`(`sggCode`, `mainNo`, `subNo`),
    INDEX `KaptComplexParcel_pnu_idx`(`pnu`),
    UNIQUE INDEX `KaptComplexParcel_kaptCode_pnu_key`(`kaptCode`, `pnu`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KaptComplexArea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kaptCode` VARCHAR(20) NOT NULL,
    `exclusiveArea` DECIMAL(10, 4) NOT NULL,
    `householdCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KaptComplexArea_kaptCode_exclusiveArea_key`(`kaptCode`, `exclusiveArea`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KaptSourceFile` (
    `dataset` VARCHAR(20) NOT NULL,
    `fileDate` DATE NOT NULL,
    `postSeq` INTEGER NOT NULL,
    `fileName` VARCHAR(200) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`dataset`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

