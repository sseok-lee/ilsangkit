-- Additive address-level real estate summary storage for the V2 transition.
-- This script must not alter RealEstateBuildingSummary or any source transaction table.
-- It contains only additive CREATE TABLE declarations; callers must compare an
-- existing object against the expected schema before treating IF NOT EXISTS as success.

CREATE TABLE IF NOT EXISTS RealEstateBuildingSummaryV2 (
  id INT NOT NULL AUTO_INCREMENT,
  type VARCHAR(20) NOT NULL,
  buildingKey CHAR(64) NOT NULL,
  buildingName VARCHAR(200) NOT NULL,
  bjdCode VARCHAR(10) NOT NULL,
  city VARCHAR(50) NOT NULL,
  district VARCHAR(50) NOT NULL,
  dongName VARCHAR(50) NOT NULL,
  jibun VARCHAR(20) NULL,
  latestPrice BIGINT NULL,
  latestDealYear INT NULL,
  latestDealMonth INT NULL,
  latestDealDay INT NULL,
  buildYear INT NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  transactionCount INT NOT NULL DEFAULT 0,
  monthlyRent INT NULL,
  jeonseDeposit INT NULL,
  jeonseDealKey INT NULL,
  wolseDeposit INT NULL,
  wolseMonthlyRent INT NULL,
  wolseDealKey INT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY RealEstateBuildingSummaryV2_type_buildingKey_key (type, buildingKey),
  KEY RealEstateBuildingSummaryV2_type_transactionCount_idx (type, transactionCount),
  KEY RealEstateBuildingSummaryV2_type_city_district_tx_idx (type, city, district, transactionCount),
  KEY RealEstateBuildingSummaryV2_type_buildingName_idx (type, buildingName),
  KEY RealEstateBuildingSummaryV2_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
  KEY RealEstateBuildingSummaryV2_type_lat_lng_idx (type, lat, lng),
  CONSTRAINT RealEstateBuildingSummaryV2_buildingKey_hex_chk CHECK (REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c'))
);

CREATE TABLE IF NOT EXISTS RealEstateSummaryState (
  id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  runId VARCHAR(64) NOT NULL,
  sourceFingerprint CHAR(64) NOT NULL,
  report JSON NOT NULL,
  validatedAt DATETIME(3) NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT RealEstateSummaryState_singleton_chk CHECK (id = 1),
  CONSTRAINT RealEstateSummaryState_status_chk CHECK (status IN ('preparing', 'failed', 'ready')),
  CONSTRAINT RealEstateSummaryState_sourceFingerprint_hex_chk CHECK (REGEXP_LIKE(sourceFingerprint, '^[a-f0-9]{64}$', 'c'))
);
