-- 인근 단지 전세/월세 필터(getNearbyByBjd)와 카테고리별 최신 동기화 시각(getSyncStatus) 인덱스.
-- 결과는 같고 읽는 행만 줄인다. 온라인 DDL(쓰기 잠금 없음)로 만들고, 시작·끝의 메타데이터 잠금을
-- 10초 넘게 기다려야 하면 실패시킨다(실패하면 다시 적용).
SET SESSION lock_wait_timeout = 10;

-- CreateIndex
CREATE INDEX `SyncHistory_status_category_completedAt_idx` ON `SyncHistory`(`status`, `category`, `completedAt`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `AptRentTransaction_bjdCode_rentType_dongName_idx` ON `AptRentTransaction`(`bjdCode`, `rentType`, `dongName`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `VillaRentTransaction_bjdCode_rentType_dongName_idx` ON `VillaRentTransaction`(`bjdCode`, `rentType`, `dongName`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `OffitelRentTransaction_bjdCode_rentType_dongName_idx` ON `OffitelRentTransaction`(`bjdCode`, `rentType`, `dongName`) ALGORITHM=INPLACE LOCK=NONE;
