-- CreateTable
CREATE TABLE `AffiliateBanner` (
    `id` CHAR(36) NOT NULL,
    `provider` ENUM('coupang', 'ali', 'toss') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `imageSourceType` ENUM('upload', 'url') NOT NULL,
    `imageAssetId` CHAR(36) NULL,
    `externalImageUrl` TEXT NULL,
    `targetUrl` TEXT NOT NULL,
    `altText` VARCHAR(200) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AffiliateBanner_imageAssetId_key`(`imageAssetId`),
    INDEX `AffiliateBanner_provider_isEnabled_updatedAt_idx`(`provider`, `isEnabled`, `updatedAt`),
    INDEX `AffiliateBanner_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateBannerAsset` (
    `id` CHAR(36) NOT NULL,
    `storageKey` VARCHAR(128) NOT NULL,
    `mimeType` VARCHAR(32) NOT NULL,
    `byteSize` INTEGER NOT NULL,
    `status` ENUM('pending', 'ready', 'deleting') NOT NULL DEFAULT 'pending',
    `unlinkedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AffiliateBannerAsset_storageKey_key`(`storageKey`),
    INDEX `AffiliateBannerAsset_status_unlinkedAt_idx`(`status`, `unlinkedAt`),
    INDEX `AffiliateBannerAsset_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AffiliateBanner` ADD CONSTRAINT `AffiliateBanner_imageAssetId_fkey` FOREIGN KEY (`imageAssetId`) REFERENCES `AffiliateBannerAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

