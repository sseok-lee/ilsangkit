ALTER TABLE `WasteScheduleRevision` MODIFY `state` ENUM('active', 'inactive', 'conflict', 'duplicate') NOT NULL,
    ADD COLUMN `duplicateOfScheduleId` INTEGER NULL;
