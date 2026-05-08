<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# data

## Purpose
Prisma 시드 및 동기화 스크립트용 원본 데이터 저장소. 공공데이터포털 CSV 다운로드, 의료기관 상세정보(HIRA) xlsx, 가이드 콘텐츠 JSON 등을 포함한다. 프로덕션에는 커밋하지 않음 (동기화 시마다 최신 데이터 다운로드).

## Key Files
| File | Description |
|------|-------------|
| `README.md` | 데이터 다운로드/동기화 가이드 (data.go.kr, HIRA, API 기반 카테고리) |
| `*.csv` | 공공데이터포털 표준데이터 (toilet, wifi, clothes, parking, library, park, market, school) |
| `guide-topics.json` | 가이드 콘텐츠 (카테고리별 정보) |
| `subscription-score-topic.txt` | 청약점수 관련 메타데이터 (선택적) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `extra_hospital_latest/` | HIRA 병원 상세정보 xlsx 파일 (진료시간, 휴진, 진료과목) |
| `.omc/` | 작업 메모 (선택적) |

## For AI Agents

### Working In This Directory
- **CSV 파일**: EUC-KR 인코딩 (자동 감지, 변환 불필요)
- **다운로드 방식**:
  1. `data.go.kr` 로그인 → 표준데이터 CSV 다운로드
  2. README.md의 URL과 파일명 테이블 참조
  3. 다운로드 파일을 이 디렉토리에 저장
- **HIRA xlsx**: 별도 신청 필요 (opendata.hira.or.kr) → zip 해제 후 `extra_hospital_latest/` 배치
- **gitignore**: 대용량 CSV/xlsx 파일은 보통 gitignored (동기화 시마다 최신 데이터 다운로드)

### Common Patterns
- 동기화 스크립트: `backend/src/scripts/sync*.ts`에서 이 디렉토리의 CSV/JSON 로드
- 배치 upsert: `batchUpsert(500건 단위)` (src/services/baseSyncService.ts)
- 카테고리별 스크립트: `syncToilet.ts`, `syncWifi.ts` 등 (기존 패턴 참조)
- 실행: `npm run sync:facilities` (backend/)

## Dependencies

### Internal
- `backend/src/scripts/sync*.ts` — CSV/JSON 데이터 로드 및 동기화
- `backend/src/services/baseSyncService.ts` — 공통 sync 파이프라인 (runSync, batchUpsert)
- `backend/prisma/schema.prisma` — DB 모델 정의

### External
- CSV/xlsx 파일 원본: `data.go.kr`, `opendata.hira.or.kr` (공공데이터 플랫폼)

<!-- MANUAL: -->
