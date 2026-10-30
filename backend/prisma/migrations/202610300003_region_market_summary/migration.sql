-- CreateTable
CREATE TABLE `RegionMarketSummary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scope` VARCHAR(10) NOT NULL,
    `citySlug` VARCHAR(50) NOT NULL DEFAULT '',
    `districtSlug` VARCHAR(50) NOT NULL DEFAULT '',
    `label` VARCHAR(100) NOT NULL,
    `ppMedian12m` INTEGER NULL,
    `ppMedianPrev12m` INTEGER NULL,
    `dealCount12m` INTEGER NOT NULL,
    `dealCountPrev12m` INTEGER NOT NULL,
    `topDeals` JSON NOT NULL,
    `volRecent` INTEGER NOT NULL,
    `volPrev` INTEGER NOT NULL,
    `recentFrom` VARCHAR(10) NOT NULL,
    `recentTo` VARCHAR(10) NOT NULL,
    `prevFrom` VARCHAR(10) NOT NULL,
    `prevTo` VARCHAR(10) NOT NULL,
    `computedAt` DATETIME(3) NOT NULL,

    INDEX `RegionMarketSummary_scope_volRecent_idx`(`scope`, `volRecent`),
    UNIQUE INDEX `RegionMarketSummary_scope_citySlug_districtSlug_key`(`scope`, `citySlug`, `districtSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
