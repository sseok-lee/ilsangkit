<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/prisma

## Purpose
Prisma ORM 스키마와 시드 데이터. 15개 시설 카테고리 + 6개 부동산 + 청약/가이드/리뷰/지역/동기화 이력 모델을 정의한다.

## Key Files
| File | Description |
|------|-------------|
| `schema.prisma` | MySQL 스키마 정의 |
| `migration-contract.json` | 기준선과 기존 5개 migration의 변경 불가 checksum 및 ngram 계약 |
| `seed.ts` | `npm run db:seed`가 실행하는 시드 스크립트 |
| `dev.db` | 로컬 SQLite dev 파일 (사용 시) — 현재 기본은 Docker MySQL |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | 전체 기준선과 순서대로 재생하는 Prisma migration SQL |
| `data/` | 공공데이터 원본 CSV/JSON (동기화 스크립트 입력) |

## For AI Agents

### Working In This Directory
- **개발용 `npm run db:migrate`는 `prisma migrate dev`**다. 운영에서 실행하지 않는다. 검토할 SQL은 개발/격리 DB에서 생성한다.
- `db:push`는 폐기 가능한 로컬/테스트 DB 전용이다. 운영 DB와 운영 shadow DB에서는 사용하지 않는다.
- 운영 일반 적용은 검증한 배포 gate를 통한 `prisma migrate deploy`만 허용한다. 최초 이력 정합화/검토한 복구의 `migrate resolve`는 별도 Database maintenance Actions가 맡는다.
- 기준선과 기존 5개 SQL의 이름/byte/checksum을 수정하지 않는다. 변경은 새 migration으로 추가한다.
- 후속 migration은 `SET SESSION lock_wait_timeout = 5;`로 시작하고 같은 디렉터리에 `policy.json`을 둔다. 새 테이블/기존 nullable 컬럼 추가 범위와 실제 이전 앱 호환성·백업·확인 조건을 선언한다.
- 운영 준비→audit/reconcile→활성화 순서와 실패 복구는 [DB-MIGRATIONS.md](../../scripts/deploy/DB-MIGRATIONS.md)를 따른다. 운영 접속 정보/백업을 Git이나 Actions artifact에 넣지 않는다.
- 스키마 변경 후 반드시 `npm run db:generate` 실행해 Prisma Client 재생성
- `sourceId` 유니크 필드가 공공데이터 원천 키 — 중복 업서트 기준
- 부동산 테이블은 BigInt/Decimal 다수 — 서비스에서 `serializeRow()` 필수

### Testing Requirements
- 스키마 변경 시: `npx prisma validate`
- DB 필요 일반 테스트는 전용 테스트 DB에서 실행한다. migration 변경은 Test의 필수 `test-migrations` job에서 실제 MySQL 8 재생/diff/백업 복원/중단/구·신 앱 호환성 검증을 통과해야 한다.

### Common Patterns
- 시설 공통 필드: `id`, `name`, `address`/`roadAddress`, `lat`/`lng`, `city`, `district`, `bjdCode`, `sourceId`, `viewCount`, `createdAt`/`updatedAt`/`syncedAt`
- `SyncHistory`/`SyncStatus` enum으로 동기화 상태 추적
- 부동산 트랜잭션 모델은 카테고리별 분리 (`ApartmentSaleTransaction`, `VillaRentTransaction` 등)

## Dependencies

### Internal
- `../src/services/` — 모든 서비스가 생성된 Prisma Client 사용
- `../src/scripts/sync*.ts` — 스키마 기반 upsert

### External
- `prisma`, `@prisma/client`, MySQL 8
