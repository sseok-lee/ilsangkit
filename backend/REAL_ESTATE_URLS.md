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

## 검증

- 양쪽 패키지의 `npm run test`, `npm run lint`, `npm run build`
- 전용 로컬 `*_test` DB와 `REAL_ESTATE_URL_TEST_DATABASE_URL`을 사용한
  `npx vitest run --config vitest.real-estate-url-integration.config.ts`
- 프런트엔드의 `npx playwright test --config playwright.seo.config.ts tests/e2e/real-estate-mode-navigation.spec.ts`

통합 테스트는 테이블을 생성·초기화하므로 개발 데이터나 운영 DB를 사용하지 않는다.
