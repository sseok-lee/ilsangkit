<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/prisma

## Purpose
Prisma ORM 스키마와 시드 데이터. 15개 시설 카테고리 + 6개 부동산 + 청약/가이드/리뷰/지역/동기화 이력 모델을 정의한다.

## Key Files
| File | Description |
|------|-------------|
| `schema.prisma` | MySQL 스키마 정의 (1300+ 줄, 약 30+ 모델) |
| `seed.ts` | `npm run db:seed`가 실행하는 시드 스크립트 |
| `dev.db` | 로컬 SQLite dev 파일 (사용 시) — 현재 기본은 Docker MySQL |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | Prisma 마이그레이션 (초기 단계로 `migration_lock.toml`만 존재 — `db:push` 위주 사용) |
| `data/` | 공공데이터 원본 CSV/JSON (동기화 스크립트 입력) |

## For AI Agents

### Working In This Directory
- **dev는 `npm run db:push`** — 즉시 스키마 반영, 마이그레이션 파일 생성 안 함
- **prod 보존용은 `npm run db:migrate`** — 의미 있는 변경은 이걸로
- 스키마 변경 후 반드시 `npm run db:generate` 실행해 Prisma Client 재생성
- `sourceId` 유니크 필드가 공공데이터 원천 키 — 중복 업서트 기준
- 부동산 테이블은 BigInt/Decimal 다수 — 서비스에서 `serializeRow()` 필수

### Testing Requirements
- 스키마 변경 시: `npx prisma validate`
- DB 필요 테스트는 `docker compose up -d` 후 `npm run db:push`

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
