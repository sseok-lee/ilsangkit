# 부동산 상세 URL 보존

공개 URL은 기존 `.../{건물명}`을 유지한다. 같은 경로에 다른 주소의 건물을
추가해야 할 때만 `.../{건물명}/{동명}-{지번}`을 발급한다. `buildingKey`는 내부
조회용이며 공개 URL에 붙이지 않는다. 운영에 배포하지 않은 64자리 해시 경로는
301 별칭을 만들지 않고 404로 응답한다.

기존 주소의 소유자가 확정되지 않은 동일 법정동 코드·건물명 그룹은 명시적인
`defer` 정책으로 기존 경로와 종전 그룹 조회를 유지할 수 있다. 이 경우 한 주소의
거래인 것처럼 표시하거나 임의 대표 좌표를 지정하지 않는다. 다른 지역 간 충돌은
이 예외로 해결하지 않는다.

## 준비와 활성화

1. 대상 DB를 확인하고 `prisma/migrations/202609290001_real_estate_public_url_registry/migration.sql`
   또는 동일한 `prisma/sql/20260929_real_estate_public_urls.sql`을 프로젝트의 스키마
   적용 절차로 적용한다. 두 파일을 중복 실행하지 않는다.
2. `RealEstateBuildingSummaryV2`가 검증된 상태인지 확인한다. 기존 URL의 실제 표시
   주소를 증명하는 baseline JSON에는 `provenance`와 `entries`가 필요하다.
   현재 주소별 요약을 과거 URL 소유권의 근거로 대체하지 않는다.
3. 백엔드 디렉터리에서 dry-run을 실행하고 보고서의 충돌과 보류 그룹을 검토한다.

   ```sh
   npx tsx src/scripts/realEstateUrls.ts --dry-run \
     --baseline /path/to/baseline.json \
     --report-out /path/to/url-report.json
   ```

4. 검토한 동일 입력에 보고서의 `sourceFingerprint`와 `planFingerprint`를 전달해 적용한다.

   ```sh
   npx tsx src/scripts/realEstateUrls.ts --apply \
     --baseline /path/to/baseline.json \
     --expected-fingerprint SOURCE_FINGERPRINT \
     --expected-plan-fingerprint PLAN_FINGERPRINT \
     --report-out /path/to/url-applied.json
   ```

   미확정 그룹 보존이 필요한 경우 두 명령 모두에 `--unresolved-policy defer`를
   명시한다. 기존 매핑 소유권은 재배정하지 않으며 충돌 시 적용을 중단한다.
5. 백엔드에 `REAL_ESTATE_SUMMARY_MODE=address`, `REAL_ESTATE_URL_MODE=preserved`를
   설정하고 서버를 재시작한다. 시작 검사는 검증된 매핑 상태·baseline 출처·V2 매핑
   누락을 확인한다. 매핑을 준비하지 않고 모드만 켜지 않는다.
6. 기존 경로와 동·지번 경로의 HTTP 200 및 self-canonical, 거래 유형 전환,
   알려진 해시 경로의 404, 사이트맵 경로를 확인한다.

`keyed`는 레지스트리를 사용하지 않는 준비 단계의 호환 모드다. 이 모드에서도
공개 해시 URL을 생성하지 않으며 동·지번 경로를 지원하지 않는다. 주소별 탐색을
완전히 적용하려면 위 준비 후 `preserved`를 활성화해야 한다. 코드 머지 자체가
데이터 매핑 적용이나 운영 환경의 모드 전환을 수행하지는 않는다.
주소 모드의 `/api/internal/release-readiness`는 `preserved` 활성화와 매핑 준비가
모두 확인되어야 통과한다. 준비 단계의 `keyed`로는 주소 모드 배포를 진행할 수 없다.

## 보류된 동명 단지의 주소 분리

이미 `legacy-deferred`로 준비된 그룹은 baseline만 추가하면 분리되지 않는다.
운영 상세 화면/API에서 현재 표시하는 동·지번을 캡처해 baseline에 기록한 뒤,
`--resolve-deferred`로 그 그룹의 보류를 명시적으로 해제한다. 한 단지는 기존
`/{건물명}`을 유지하고 나머지는 `/{건물명}/{동명}-{지번}`을 사용한다.
기존 경로를 주소 선택 화면으로 바꾸거나 두 단지 모두에 접미사를 붙이지 않는다.

```sh
npx tsx src/scripts/realEstateUrls.ts --dry-run --resolve-deferred \
  --baseline /path/to/captured-baseline.json \
  --report-out /path/to/resolution-report.json --plan-out /path/to/resolution-plan.jsonl

npx tsx src/scripts/realEstateUrls.ts --apply --resolve-deferred \
  --baseline /path/to/captured-baseline.json \
  --expected-fingerprint SOURCE_FINGERPRINT \
  --expected-plan-fingerprint PLAN_FINGERPRINT \
  --report-out /path/to/resolution-applied.json
```

- baseline에 없는 보류 그룹과 이미 확정된 매핑은 변경하지 않는다.
- 전체 그룹의 기존 매핑과 현재 후보가 일치하고, 기존 경로의 소유자가 단 하나로
  확인되며, 나머지 주소의 접미사가 유일할 때만 분리한다. 일부 주소가 빠졌거나
  새 주소가 추가되었다면 먼저 일반 준비 절차로 후보·매핑을 맞추고 다시 검토한다.
- 분리 실패를 다시 `defer`로 숨기지 않는다. 충돌은 적용을 차단한다.
- 보고서의 `toUpdate`는 기존 경로 소유자의 보류 해제를 포함한 수정 행 수다.
  그룹별 트랜잭션으로 변경하고 검증이 끝난 뒤 준비 상태를 `ready`로 기록한다.
- 적용은 URL 레지스트리만 수정한다. 원본 거래와 요약 집계는 다시 쓰지 않는다.
  운영 반영은 배포 준비 절차에서 별도로 수행하며 로컬 검증을 운영 적용으로
  보고하지 않는다.

## 표시 주소가 섞인 그룹의 일회성 대표 주소 선정

운영 함수의 표시 주소가 실제 최신 거래 주소와 충돌하는 그룹에 한해,
승인된 `approved-fixed-owner-policy-v1` 정책으로 기존 URL 소유자를 준비한다.

1. 기존 대표 동 안에서 거래 수가 가장 많은 동·지번을 선택한다.
2. 거래 수가 같으면 최상위 동률 주소 중 최신 거래일이 가장 늦은 주소를 선택한다.
   최신 날짜도 같으면 행 ID나 정렬 순서로 임의 결정하지 않고 보류한다.
3. 날짜를 추가 조회한 경우 전체 주소 집합과 거래 수가 최초 관측과 일치해야 한다.
   주소 누락, 원본/매핑 불일치, 같은 도로명의 여러 지번 등 다른 보류 사유에는
   이 정책을 적용하지 않는다.

이 기준은 과거 URL 소유권을 확인한 사실과 구분한다. 정책으로 선정한 baseline의
`provenance`는 `approved-fixed-owner-policy-v1 `로 시작하며, 레지스트리 근거는
`approved-fixed-owner-policy`로 기록한다. 실제 관측으로 확인한 소유자는 기존
`legacy-exact-address` 근거를 유지한다.

선정은 오프라인 매핑 준비 시 한 번 수행한다. 적용된 레지스트리가 URL 소유권의
기준이며 이후 거래 수·최신 날짜·baseline이 달라져도 이미 확정된 URL은 재배정하지
않는다. 자동 수집이나 요청 처리 경로에서 대표 주소를 다시 계산하지 않는다.

## 검증

- 양쪽 패키지의 `npm run test`, `npm run lint`, `npm run build`
- 전용 로컬 `*_test` DB와 `REAL_ESTATE_URL_TEST_DATABASE_URL`을 사용한
  `npx vitest run --config vitest.real-estate-url-integration.config.ts`
- 프런트엔드의 `npx playwright test --config playwright.seo.config.ts tests/e2e/real-estate-mode-navigation.spec.ts`

통합 테스트는 테이블을 생성·초기화하므로 개발 데이터나 운영 DB를 사용하지 않는다.
