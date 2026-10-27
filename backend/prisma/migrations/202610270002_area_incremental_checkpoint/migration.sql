ALTER TABLE `RealEstateAreaSummaryState`
  ADD COLUMN `incrementalThrough` DATETIME(3) NULL,
  ADD COLUMN `incrementalDateThrough` CHAR(10) NULL;
