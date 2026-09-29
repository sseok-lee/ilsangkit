-- Additive change; apply once before deploying the public rental collector/API.
-- Existing Subscription rows and identifiers are preserved.
ALTER TABLE `Subscription` ADD COLUMN `publicRental` JSON NULL;
ALTER TABLE `Subscription` ADD COLUMN `supersededById` INTEGER NULL;
CREATE INDEX `Subscription_supersededById_idx` ON `Subscription` (`supersededById`);
