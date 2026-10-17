-- 전국 충전소 목록(evChargerStationSearch) 페이지 선택용 인덱스. 결과는 같고 행 대신 인덱스만 읽는다.
-- 온라인 DDL(쓰기 잠금 없음)로 만들고, 시작·끝의 메타데이터 잠금을 10초 넘게 기다려야 하면 실패시킨다.
SET SESSION lock_wait_timeout = 10;

-- CreateIndex
CREATE INDEX `EvCharger_statId_name_idx` ON `EvCharger`(`statId`, `name`) ALGORITHM=INPLACE LOCK=NONE;
