-- CreateTable
CREATE TABLE `BuildingRegisterTitle` (
    `mgmPk` VARCHAR(33) NOT NULL,
    `sggCode` CHAR(5) NOT NULL,
    `bjdongCode` CHAR(5) NOT NULL,
    `platGbCd` CHAR(1) NOT NULL,
    `bun` CHAR(4) NOT NULL,
    `ji` CHAR(4) NOT NULL,
    `bldNm` VARCHAR(200) NULL,
    `dongNm` VARCHAR(100) NULL,
    `regstrGbCd` CHAR(1) NOT NULL,
    `regstrKindCd` CHAR(1) NOT NULL,
    `mainAtchGbCd` CHAR(1) NOT NULL,
    `mainPurpsCd` VARCHAR(10) NULL,
    `mainPurpsCdNm` VARCHAR(100) NULL,
    `etcPurps` VARCHAR(500) NULL,
    `hhldCnt` INTEGER NULL,
    `fmlyCnt` INTEGER NULL,
    `hoCnt` INTEGER NULL,
    `grndFlrCnt` INTEGER NULL,
    `ugrndFlrCnt` INTEGER NULL,
    `elevatorCnt` INTEGER NULL,
    `parkingCnt` INTEGER NULL,
    `useAprDay` CHAR(8) NULL,
    `strctCdNm` VARCHAR(100) NULL,
    `sourceMonth` CHAR(7) NOT NULL,
    `raw` JSON NOT NULL,

    INDEX `BuildingRegisterTitle_sggCode_bjdongCode_platGbCd_bun_ji_idx`(`sggCode`, `bjdongCode`, `platGbCd`, `bun`, `ji`),
    INDEX `BuildingRegisterTitle_sourceMonth_idx`(`sourceMonth`),
    PRIMARY KEY (`mgmPk`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildingRegisterRecap` (
    `mgmPk` VARCHAR(33) NOT NULL,
    `sggCode` CHAR(5) NOT NULL,
    `bjdongCode` CHAR(5) NOT NULL,
    `platGbCd` CHAR(1) NOT NULL,
    `bun` CHAR(4) NOT NULL,
    `ji` CHAR(4) NOT NULL,
    `bldNm` VARCHAR(200) NULL,
    `mainPurpsCdNm` VARCHAR(100) NULL,
    `hhldCnt` INTEGER NULL,
    `fmlyCnt` INTEGER NULL,
    `hoCnt` INTEGER NULL,
    `mainBldCnt` INTEGER NULL,
    `totPkngCnt` INTEGER NULL,
    `useAprDay` CHAR(8) NULL,
    `sourceMonth` CHAR(7) NOT NULL,
    `raw` JSON NOT NULL,

    INDEX `BuildingRegisterRecap_sggCode_bjdongCode_platGbCd_bun_ji_idx`(`sggCode`, `bjdongCode`, `platGbCd`, `bun`, `ji`),
    INDEX `BuildingRegisterRecap_sourceMonth_idx`(`sourceMonth`),
    PRIMARY KEY (`mgmPk`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildingRegisterUnitCount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sggCode` CHAR(5) NOT NULL,
    `bjdongCode` CHAR(5) NOT NULL,
    `platGbCd` CHAR(1) NOT NULL,
    `bun` CHAR(4) NOT NULL,
    `ji` CHAR(4) NOT NULL,
    `bldNm` VARCHAR(200) NOT NULL,
    `dongNm` VARCHAR(100) NOT NULL,
    `offitelUnits` INTEGER NOT NULL,
    `totalUnits` INTEGER NOT NULL,
    `sourceMonth` CHAR(7) NOT NULL,

    INDEX `BuildingRegisterUnitCount_sourceMonth_idx`(`sourceMonth`),
    UNIQUE INDEX `BuildingRegisterUnitCount_sggCode_bjdongCode_platGbCd_bun_ji_key`(`sggCode`, `bjdongCode`, `platGbCd`, `bun`, `ji`, `bldNm`, `dongNm`, `sourceMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildingRegisterDong` (
    `sggCode` CHAR(5) NOT NULL,
    `bjdongCode` CHAR(5) NOT NULL,
    `dongName` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`sggCode`, `dongName`, `bjdongCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildingRegisterSourceFile` (
    `taskCode` VARCHAR(4) NOT NULL,
    `sourceMonth` CHAR(7) NOT NULL,
    `fileId` VARCHAR(40) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `skippedCount` INTEGER NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`taskCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

