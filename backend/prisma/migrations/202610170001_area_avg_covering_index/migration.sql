-- 지역 허브 평균 집계(areaService.aggregateRealEstate) 커버링 인덱스.
-- 결과는 같고 본 테이블 대신 인덱스만 읽는다. 온라인 DDL(쓰기 잠금 없음)로 생성하며,
-- 온라인으로 만들 수 없으면 잠그지 않고 실패한다.
-- 시작·끝의 짧은 메타데이터 잠금이 긴 SELECT 뒤에서 기다리며 다른 쿼리를 막지 않도록
-- 10초 이상 기다려야 하면 실패시킨다(실패하면 저트래픽 시간에 다시 적용).
SET SESSION lock_wait_timeout = 10;

-- CreateIndex
CREATE INDEX `AptSaleTransaction_bjdCode_dealAmount_idx` ON `AptSaleTransaction`(`bjdCode`, `dealAmount`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `AptRentTransaction_bjdCode_deposit_idx` ON `AptRentTransaction`(`bjdCode`, `deposit`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `VillaSaleTransaction_bjdCode_dealAmount_idx` ON `VillaSaleTransaction`(`bjdCode`, `dealAmount`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `VillaRentTransaction_bjdCode_deposit_idx` ON `VillaRentTransaction`(`bjdCode`, `deposit`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `OffitelSaleTransaction_bjdCode_dealAmount_idx` ON `OffitelSaleTransaction`(`bjdCode`, `dealAmount`) ALGORITHM=INPLACE LOCK=NONE;

-- CreateIndex
CREATE INDEX `OffitelRentTransaction_bjdCode_deposit_idx` ON `OffitelRentTransaction`(`bjdCode`, `deposit`) ALGORITHM=INPLACE LOCK=NONE;
