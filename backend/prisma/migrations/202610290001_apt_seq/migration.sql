-- 국토부 실거래 단지 일련번호(aptSeq) 저장 시작. 아파트 매매·전월세 API 응답에 공통으로 있다.
-- 컬럼만 추가(ALGORITHM=INSTANT: 테이블 재작성·행 복사 없음, 메타데이터만 변경). 조회 인덱스는 활용 시점에 따로 만든다.
-- 시작·끝 메타데이터 잠금을 10초 넘게 기다려야 하면 실패시킨다(실패하면 다시 적용).
SET SESSION lock_wait_timeout = 10;

-- AlterTable
ALTER TABLE `AptSaleTransaction` ADD COLUMN `aptSeq` VARCHAR(20) NULL, ALGORITHM=INSTANT;

-- AlterTable
ALTER TABLE `AptRentTransaction` ADD COLUMN `aptSeq` VARCHAR(20) NULL, ALGORITHM=INSTANT;
