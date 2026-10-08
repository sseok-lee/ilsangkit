# 운영 DB migration 절차

Node 20, Prisma 6.19.2, MySQL 8을 사용한다. SQL과 검사 도구는 같은 검증된 Git SHA에서 가져온다. 운영 데이터와 동결된 migration 이력을 보존하며, DB 검증이 성공한 후에만 앱을 교체한다.

## 도입 순서

1. **준비 릴리스:** 기준선, 검사/백업/복구 도구와 필수 Test job을 배포한다. 이 단계의 일반 앱 배포는 DB gate를 호출하지 않는다.
2. **운영 정합화:** 동일한 main SHA의 Test와 기존 앱 배포 성공을 확인하고 Database maintenance Actions의 `audit`를 실행한다. 관측 database/server UUID, 구조 차이, 기존 ledger, MySQL CLI/권한/디스크 조건을 검토한다. 차이가 0인 audit ID로 `reconcile`을 실행한다.
3. **활성 앱 기록:** reconcile 성공 뒤 같은 Actions가 준비 릴리스의 full SHA와 로컬 readiness·공개 health 응답의 release ID를 확인하고 `active-app.json`을 초기화한다. 불일치하면 이 단계는 실패하며 앱 배포 상태를 확인한 후 같은 검증 자료로 재시도한다. 기존 다른 SHA 기록은 덮어쓰지 않는다. 서버 UUID는 검토한 audit 값으로 `baseline.json`에 고정한다. 파일을 추측해서 작성하지 않는다.
4. **활성화 릴리스:** 정합화 증거를 갖춘 뒤 별도 활성화 변경을 main에 승격한다. 첫 실행은 pending 0을 확인한다. 이후 확장 migration은 CI→백업→DB 적용/검증→앱 교체 순서로 자동 실행한다.

로컬 구현/fixture 통과는 운영 정합화를 대신하지 않는다. 준비 코드 작성만으로 audit/reconcile이나 운영 배포를 실행하지 않는다.

## 개발과 운영 명령

| 목적 | 명령/경로 |
|---|---|
| 개발 SQL 생성 | 격리 개발 DB에서 `cd backend && npm run db:migrate` (`prisma migrate dev`) |
| Client 생성 | `cd backend && npx prisma generate` |
| CI 재생 | Test workflow의 `test-migrations` |
| 운영 정합화/복구 | Database maintenance Actions의 audit/reconcile/recover |
| 활성화 후 일반 적용 | 고정 배포 잠금 아래 `db-migration-gate.mjs deploy` |
| 같은 SHA 재검증 | 같은 잠금 아래 `db-migration-gate.mjs verify` |

운영에서 `db push`, `migrate dev`, `migrate reset`, ledger 삭제, 과거 SQL 전체 재실행을 하지 않는다. 실패한 SQL을 무조건 `resolve --applied`로 덮지 않는다.

## 새 migration 계약

`backend/prisma/migrations/<정렬되는 새 이름>/migration.sql`과 `policy.json`을 함께 검토한다. 기준선과 초기 5개 SQL은 변경하지 않는다.

- 첫 SQL은 `SET SESSION lock_wait_timeout = 5;`다. 이 설정은 DDL과 같은 Prisma 연결에서 실행된다.
- 허용 범위는 새 테이블과 기존 테이블의 단일 nullable 컬럼 추가다. 삭제/rename/타입 변경/기존 제약 및 인덱스 재구성/DML은 별도 설계가 필요하다.
- policy에는 `sqlSha256`, `creates`, `addsNullable`, `backupTables`, `previousCompatibleShas`, `compatibilityTests`, `postconditions`를 선언한다. SQL의 실제 대상과 선언이 일치해야 한다.
- `previousCompatibleShas`는 실제 활성화할 수 있는 이전 앱의 full SHA다. main 부모 커밋을 운영 버전으로 추측하지 않는다.
- 호환성 테스트는 후보 저장소의 실제 파일이다. `MIGRATION_COMPAT_BACKEND_DIR`의 생성 Client와 `dist` 서비스 코드를 불러오고, 전달된 격리 `DATABASE_URL`에서 읽기/쓰기와 관련 공개 조회를 검증한다. 이전 앱은 각 migration 전/부분 적용/후, 후보 앱은 최종 DB에서 실행한다.
- 이전 앱이 활성 SHA 목록에 없거나 검사/checkout/build가 실패하면 배포를 차단한다. 성공으로 표시한 가짜 결과 JSON으로 우회하지 않는다.

준비 릴리스의 비교 출발점은 `cd32fcc04d1bf16ec472a69b683be06d1eda61ed`다. 이전 backend를 별도로 받아 그 lockfile로 설치/Client 생성/빌드하고 후보 backend와 분리하여 실행한다.

## Actions 입력과 검증 자료

Database maintenance는 `operation`, `tested_sha`, `test_run_id`, 그리고 작업에 따라 `audit_id` 또는 `recovery_id`만 받는다. 접속 URL/비밀번호/자유 SQL 입력은 없다.

입력 run은 같은 저장소의 `.github/workflows/test.yml`이고 main push의 완료/성공 실행이어야 한다. SHA와 성공한 run attempt를 확인한 뒤 `db-evidence-<full-sha>-<attempt>`를 **그 run에서** 받는다. 내부 manifest의 SHA/sourceTestRunId/sourceTestRunAttempt, 정책/SQL/스키마 파일 checksum까지 일치해야 한다.

artifact에는 구조와 검사 결과만 포함한다. 운영 dump/행 데이터/URL/비밀번호/원본 DB 출력은 업로드하지 않는다. artifact가 유실되면 해당 SHA의 Test 전체를 다시 실행하고 새 run/attempt의 자료를 사용한다. 서버에서 즉석 재생성하지 않는다.

DB 작업은 `cafe24-db` concurrency (`cancel-in-progress: false`)와 서버 `/home/project2/run/fixed-deploy.lock`을 공유한다. 후보 CLI 의존성만 준비하며 유지보수 작업은 앱 파일이나 프로세스를 바꾸지 않는다. 도구가 없거나 권한/공간이 부족하면 중단하고 관리 절차로 준비한다. 운영에서 도구를 자동 설치하지 않는다.

## 영속 상태와 백업

`/home/project2/run/db-migrations`는 앱/staging 정리 대상 밖에 둔다. 디렉터리는 700, 파일은 600이다.

| 경로 | 내용 |
|---|---|
| `audits/` | 대상 identity, 구조/이력 검토 증거 |
| `baseline.json` | 검증된 최초 정합화와 DB UUID |
| `active-app.json` | 공개 검증을 마친 앱 full SHA와 release ID |
| `backups/` | 적용 전 스키마/ledger/필요한 기존 데이터, checksum |
| `attempts/` | 적용 SHA/run/attempt, pending, 백업 참조, 프로세스 증거와 상태 |

pending이 없으면 데이터 dump/DDL을 생략하고 검증한다. pending이 있으면 변경 대상 기존 테이블과 복원에 필요한 전이적 FK 부모를 일관되게 백업한다. 새 테이블 생성만 있으면 기존 사용자 데이터 dump는 생략한다. 복원은 CI의 격리 DB에서만 리허설하며 운영에 자동 덮어쓰지 않는다.

총 백업 제한은 10분, migration 명령 대기는 5분, 개별 metadata lock 대기는 5초다. timeout이 SQL rollback을 뜻하지 않는다. 성공 백업은 최소 30일 보존하고 실패/미복구 자료는 자동 삭제하지 않는다. 이 도구는 보관 자료를 자동 정리하지 않는다.

## 실패와 복구

`applying`을 원자적으로 저장한 후 SQL을 시작한다. 프로세스/SSH가 종료되면 남은 `applying`, `failed`, `unknown`이 모든 후속 SHA를 차단한다. 시간 경과나 재시도로 지우지 않는다.

1. 기존 앱을 유지하고 해당 attempt와 private 로그/백업을 보존한다.
2. 원래 OS 프로세스와 DB 작업이 끝났는지 확인하고 실제 ledger/구조를 대조한다.
3. 원인과 복구 증거/기대 상태를 `backend/prisma/recovery/<recovery_id>/recovery.json`에 남긴다. `targetAttemptId`, `targetSha`, 실제 검토한 구조의 `beforeFingerprint`, migration 이름/checksum, outcome(`applied` 또는 `reverted`), 검증할 `targetPrefixLength`를 고정한다. SQL 파일이 필요하면 같은 디렉터리에 두고 `sqlFile`과 `sqlSha256`으로 묶는다. 현재 복구 PR SHA는 해당 Test artifact에서 검증한다. 필요한 데이터/스키마 보정은 별도 검토한다. 자유 입력 SQL을 자동 실행하지 않는다.
4. 해당 PR의 main Test 성공 자료로 `recover`를 실행한다. 실제 적용 완료 또는 실제 되돌림이 입증된 경우에만 resolve 및 `recovered` 기록을 허용한다. 기존 attempt를 삭제하지 않는다.
5. 다음 배포는 정상 사전 검증을 다시 수행한다.

DB 성공 후 앱 공개 검사가 실패하면 기존 앱을 복구하고 확장된 DB는 유지한다. DB down migration은 자동 실행하지 않는다. active-app 기록은 공개 검사 성공 후 갱신하며 rollback에서는 이전 값을 보존한다.

`TEST_RUN_*`/`EVIDENCE_*`는 검증 자료 출처·무결성, `BASELINE_*`/`DB_IDENTITY_*`는 초기 전환·대상 DB, `UNRESOLVED_ATTEMPT`는 미복구 실행, `POLICY_*`는 허용 범위·호환성, `BACKUP_*`는 백업, `SCHEMA_*`/`PRISMA_*`는 구조·CLI 실패를 뜻한다. 고정 오류 코드로 분류하고 원본 자료는 서버의 private 파일에서 확인한다.

## 로컬 검증

기존 개발 DB와 구분한 loopback MySQL 8의 `/mysql` admin URL을 `MIGRATION_TEST_ADMIN_URL`로 지정한다. fixture는 자신이 만든 `ilsangkit_migration_test_*` DB만 생성/삭제한다. 환경이 없으면 MySQL 검사는 skip 대신 실패한다.

```sh
node --test --test-concurrency=1 scripts/deploy/db-baseline.mysql.test.mjs scripts/deploy/db-schema.mysql.test.mjs scripts/deploy/db-backup.mysql.test.mjs scripts/deploy/db-migration-gate.mysql.test.mjs scripts/deploy/db-maintenance.mysql.test.mjs scripts/deploy/db-compatibility.mysql.test.mjs
node scripts/deploy/db-compatibility.mjs
node scripts/deploy/db-evidence.mjs build
```

호환성 실행 결과는 `COMPATIBILITY_EVIDENCE_FILE`과 `PREPARATION_COMPATIBILITY_FILE`로 저장하고 evidence build에 같은 경로를 전달한다.

CI build에는 `GITHUB_SHA`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `MIGRATION_EVIDENCE_DIR`, `MIGRATION_COMPAT_WORK_DIR`가 필요하다. 로컬 검증 값은 테스트 전용으로 지정하고 운영 증거로 사용하지 않는다.
