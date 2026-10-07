ALTER TABLE `AffiliateBanner` ADD COLUMN `disclosureOverride` TEXT NULL;

CREATE TABLE `AffiliateProviderDisclosure` (
  `provider` ENUM('coupang', 'ali', 'toss') NOT NULL,
  `defaultDisclosureText` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`provider`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
