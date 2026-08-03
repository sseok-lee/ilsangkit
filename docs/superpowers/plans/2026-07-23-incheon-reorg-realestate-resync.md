# 인천 행정구역 개편 — 부동산 데이터 재정합 (프로덕션 롤아웃 스펙/플랜)

- 작성: 2026-07-23
- 상태: 조사·파일럿 완료, 프로드 미실행
- 선행/관련: [[project_region_admin_reorg_2026]](slug/URL 복구), [[project_reform_june_duplicate_cleanup]](6월 경계 이중저장), [[project_region_jeonnamgwangju_normalization]](전남광주=별개·미채택)

---

## 1. 배경 & 문제 (이번 세션 실측 확정)

2026-07-01 인천 행정개편으로 **옛 서구·중구·동구가 완전 소멸**하고 신설 4구가 승계했으나, 부동산 실거래 데이터가 옛/신 구로 **분할 저장**돼 리스트 중복·상세 이력 단절·주소 불일치가 발생.

- **원인:** sourceId에 `bjdCode`가 임베드(`{category}-{bjdCode}-{...}`)되고 sync가 최신 월만 수집 → 개편 전 수집분은 옛 코드, 개편 후는 신 코드로 남음.
- **증상(프로드 확인):**
  - 같은 단지가 옛구·신구에 **중복 노출** (예: 청라제일풍경채2차 = 서구 242건[2023~26.06] + 서해구 15건[26.06~07]).
  - 신구 상세 페이지엔 최근 이력만 → **전체 이력 단절**.
  - **주소(구명)까지 분리** — 옛 레코드 `district=서구`, 신 레코드 `district=서해구` (동·지번 동일).
  - 2026-06 경계월이 옛/신 양쪽에 **이중저장**(인천 code-28은 지난 6월 dedup에서 제외됐음).

### 재편 매핑 (프로드 데이터로 확정 — 옛 코드 전부 7월 데이터 0 = 완전 소멸)

| 소멸 옛 구 (7월 0) | → 승계 신설구 (동별) |
|---|---|
| **서구 (28260)** | 청라·가정·가좌·신현·석남·연희·검암·심곡 → **서해구(28275)** / 원당·백석·불로·마전·당하·왕길·금곡·오류 → **검단구(28290)** |
| **중구 (28110)** | 내륙동 → **제물포구(28125)** / 영종도동 → **영종구(28155)** |
| **동구 (28140)** | → **제물포구(28125)** |

- 신설구 4개 = `28275, 28290, 28125, 28155`
- 소멸 옛구 3개 = `28260, 28110, 28140`

---

## 2. Provenance 결정 (국토부 재귀속 확정)

국토부 실거래가 API에 신/옛 코드로 **과거 월** 직접 조회 결과:

| 코드 | 2024-01 | 2025-01 | 2026-06 | 2026-07 |
|---|---|---|---|---|
| 서구(옛 28260) | 0 | 0 | 0 | 0 |
| 서해구(신 28275) | 259 | 185 | 303 | 155 |
| 중구(옛 28110) | 0 | 0 | 0 | 0 |
| 제물포구(신 28125) | 73 | 69 | 75 | 37 |

→ **국토부는 신설구가 원래부터 있었던 것처럼 과거 전체를 신 코드로 재귀속**하고 옛 코드를 완전히 버림. 따라서 우리 DB의 옛구 데이터는 **개편 전 수집한 stale 스냅샷**이며, 신 코드로 통합하는 것은 provenance 위반이 아니라 **소스 재정합(catch-up)**.

---

## 3. 파일럿 결과 (검증 완료 — 로컬 DB)

서해구(28275) apt-sale를 국토부 API에서 2023-01~2026-07 재싱크 → 로컬 DB.

- **서해구 12,531건** 기록 (69초, IndexNow 미호출).
- 청라제일풍경채2차: 재싱크 후 **서해구/28275 = 303건, 2023-01~2026-07** (완전 이력 통합). 기존 서구/28260(스테일)과 대비 확인.
- **귀속 오류 0** (전부 `인천/서해구` 정확).
- 파일럿 데이터·스크립트 정리 완료(로컬 원복).

→ **재싱크(fetch 신코드→transform→신구 귀속→upsert) 파이프라인 정상, 통합 입증.**

---

## 4. 접근 방식 결정: 재싱크 + 옛코드 삭제 (마이그레이션 아님)

| | 재싱크+삭제 (채택) | UPDATE 마이그레이션 (기각) |
|---|---|---|
| sourceId 정합 | ✅ 신 bjdCode로 재생성 → 일일 sync와 일치 | ❌ bjdCode만 바꾸면 sourceId(옛 임베드)와 불일치 → 다음 sync가 재삽입=중복 |
| 소스 충실도 | ✅ 국토부 현행 그대로(취소·정정 반영) | △ 우리 스테일 데이터 가정 |
| 비용 | API 볼륨/시간 큼 | 빠름 |

**결론: 재싱크+삭제.** sourceId 정합·소스 충실·일일 sync와 무충돌이 결정적.

**전남광주와의 차이:** 전남광주는 D1(통합명 미채택·옛 slug 유지, 표시단 resolveCitySlug로 code-12→gwangju/jeonnam)로 처리. 인천은 D2(신설구 채택)이므로 **신 코드로 통합**이 정합.

---

## 5. 스코프

### 대상 테이블 (bjdCode sourceId·동일 분할 메커니즘)
- 부동산 6종: `AptSaleTransaction, AptRentTransaction, VillaSaleTransaction, VillaRentTransaction, OffitelSaleTransaction, OffitelRentTransaction`
  - 각 sync 스크립트 동일 인터페이스: `npm run sync:<type> -- --lawd <code> --from <YYYYMM> --to <YYYYMM>`
- **토지(LandSaleTransaction):** 동일 원리(별도 스크립트 `syncLandSale`, LandAreaSummary 별도). 스코프 포함하되 요약 갱신 경로 다름.
- **공매(AuctionItem):** 스냅샷(거래월 없음)·만료 처리 → 옛코드 매물은 자연 만료. **별도/후속**(이번 롤아웃 제외, 옛코드 매물 정리만 선택).

### 재싱크 범위 (월)
- ⚠️ **반드시 앱의 기존 옛구 커버리지 시작월부터** 재싱크해야 데이터 손실 없음(신 코드를 2023부터만 재싱크하면 그 이전 옛구 데이터가 삭제 후 사라짐).
- Step 0에서 프로드 서버 쿼리로 확정: 각 유형 옛코드(28260/28110/28140)의 `MIN(dealYear*100+dealMonth)` → 그 월부터 `202607`까지.

---

## 6. 롤아웃 절차

> 원칙: **재싱크(신) → 검증 → 백업 → 삭제(옛) → 요약갱신 → 프론트 배포 → 라이브검증.** 삭제 전 재싱크로 신구에 완전본을 먼저 채워 무결 구간 없앰.

### Step 0 — 사전 (서버 SSH)
1. **백업:** 삭제 대상 옛코드 행을 백업. June-dup 교훈대로 **id 백업 후 PK 삭제**가 빠름:
   ```sql
   CREATE TABLE _reorg_bak_AptSale_20260723 AS
     SELECT id FROM AptSaleTransaction WHERE bjdCode IN ('28260','28110','28140');
   -- 7개 테이블 반복. 또는 mysqldump로 전체 행 백업.
   ```
2. **커버리지 시작월 확정(유형별):**
   ```sql
   SELECT MIN(dealYear*100+dealMonth) FROM AptSaleTransaction WHERE bjdCode IN ('28260','28110','28140');
   ```
3. **Region 테이블에 신 코드 매핑 존재 확인**(프로드 이미 있음): 28275→인천/서해구 등. `regionMap`이 `prisma.region.findMany()`로 로드되므로 필수.

### Step 1 — 신 코드 재싱크 (서버 SSH, 유형별)
각 유형 × 신코드 4개 × [시작월~202607]. IndexNow 폭주 방지 위해 **`main()` 그대로 쓰되 소량 배치**로 나누거나 per-lawd 래퍼 사용. 예(apt-sale):
```bash
cd backend
for CODE in 28275 28290 28125 28155; do
  npm run sync:apt-sale -- --lawd $CODE --from <START> --to 202607
done
# apt-rent / villa-sale / villa-rent / offitel-sale / offitel-rent / land-sale 반복
```
- ⚠️ 각 sync는 완료 후 IndexNow로 최근 2h 동기화분 URL 제출 → 신구 URL이 제출됨(정상, 바람직). 옛구 URL은 제출 안 됨.
- 볼륨 감(파일럿): 서해구 apt-sale 43개월=12,531건/69초. 전 범위(가정 ~15년=180월)×4코드×7유형 ≈ 수만~십만 건, **수 시간**. 유형/코드별 순차·모니터링.

### Step 2 — 재싱크 검증 (삭제 전)
- 신구 4개 각 유형 total 급증 확인.
- 샘플 단지 이력 완전성: 청라제일풍경채2차(서해구), 검단 대표단지 등 = 옛구 기간 포함 연속.
- 신구 레코드 빈 city/district 귀속 오류 0.

### Step 3 — 옛 코드 삭제 (백업 확인 후)
```sql
DELETE FROM AptSaleTransaction WHERE bjdCode IN ('28260','28110','28140');
-- 7개 테이블(6부동산+토지) 반복. bjdCode 필터라 빠름(self-join 아님).
```
- 삭제 전 `SELECT COUNT(*)`로 규모 로깅. 2026-06 옛/신 이중저장도 이 삭제로 해소.

### Step 4 — 요약 갱신
- `refreshAllSummaries`(6 building types, June-dup 때 ~661s). `RealEstateBuildingSummary` 재생성.
- 토지: `LandAreaSummary` 별도 갱신.
- 홈 localMarket LRU(1h)는 자동 만료.

### Step 5 — 프론트 동반 수정 (PR → develop → main)
1. **허브 목록 갭 수정**(이번 세션 발견): `frontend/shared/regionSlugs.ts` `REGIONS['인천']`에 신설 4구 추가(또는 land 허브처럼 **data-driven** 전환 — 재발방지 권장).
2. **301 리다이렉트**(`frontend/server/middleware/real-estate-redirect.ts` 확장):
   - 단지 URL `/real-estate/{type}/incheon/{seo|jung|dong}/{building}` → 해당 단지의 **현행 구**로 301. 삭제 후 옛구엔 데이터 없음 → 단지→현행구 조회(동→신코드 맵 또는 building lookup)로 목적지 결정.
   - 구 허브 `/real-estate/{type}/incheon/{seo|jung|dong}` → `/real-estate/{type}/incheon`(서구는 2구로 분리라 단일 목적지 불가).
   - ⚠️ `seo/jung/dong` slug는 타 시(부산 서구 등)와 공유 → **반드시 `incheon` 스코프로 한정**.
3. `DISTRICT_SLUG_MAP`의 서구/중구/동구 매핑은 **리다이렉트 해석용으로 유지**(제거 금지).

### Step 6 — 배포 & 캐시
- 프론트 PR develop→main→Cafe24 배포. nginx/nitro 캐시 퍼지. 백엔드 데이터는 이미 반영(재싱크/삭제).

### Step 7 — 라이브 검증 (Playwright/curl)
- 신구 상세: 청라제일풍경채2차 = 서해구에서 **전체 이력**(2023~), 서구 URL 404 아님(301).
- 리스트 중복 해소: 서구∩서해구 단지명 중복 0.
- 옛구 데이터 0: `/api/real-estate/*/complexes?city=인천&district=서구` = total 0.
- 사이트맵: 옛구 단지 URL 제거(요약 기반이라 자동), 신구 URL 존재.
- 허브: `/real-estate/apt-sale/incheon`에 서해·검단·제물포·영종 노출.
- 301: `/incheon/seo/{청라단지}` → `/incheon/seohae/{단지}` 200.

---

## 7. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 프로드 데이터 삭제(비가역) | **id 백업 + mysqldump 선행**, 삭제 규모 로깅, 롤백 절차 |
| 재싱크 볼륨/시간(수시간) | 유형·코드별 순차, 진행 로깅, 서버 부하 시간대 회피 |
| **SEO(네이버 민감)** — 옛구 URL 색인 다수 | 단지 단위 **정확한 301**(building→현행구), GSC/사이트맵 갱신, 색인 URL 보존율 모니터 |
| 커버리지 시작월 오판정 → 과거 손실 | Step 0에서 유형별 MIN 확정 **후** 재싱크(삭제 전 완전본 확인) |
| refreshSummary 장시간 | 저부하 시간대, 진행 모니터 |
| 취소/정정 등 옛코드에만 있던 희귀행 | 백업 보존(며칠), 필요시 개별 복원 |
| 일일 sync가 옛코드 재수집 시도 | 옛코드는 API 0 반환→무해. 선택: `getAllLawdCodes`/Region에서 옛코드 3개 제외로 낭비 제거 |

---

## 8. 롤백
- 데이터: 백업 테이블/덤프에서 옛코드 행 복원 + refreshSummary 재실행. (재싱크한 신구 행은 유지해도 무해 — 롤백 시엔 다시 분할 상태로 복귀.)
- 프론트: PR revert + 재배포.

---

## 9. 미결/후속
- **공매(AuctionItem)** 옛코드 매물 정리(스냅샷·만료라 별도).
- **토지 LandAreaSummary** 갱신 경로 확인.
- **다음 개편 재발방지(근본):** sourceId의 bjdCode 임베드 + 경계월 이중저장 구조가 개편마다 재발 → [[project_real_estate_property_normalization]]/Region 정규화로 근본 해결(별도 대형 과제).
- **일일 sync 옛코드 제외** 반영(선택, 낭비 제거).
- 허브 **data-driven 전환**(정적 REGIONS stale 클래스 버그 근절).

---

## 10. 검증 체크리스트 (완료 판정)
- [ ] 신구 4개 × 7유형 재싱크 total 급증, 샘플 단지 이력 연속
- [ ] 옛구(28260/28110/28140) 3코드 × 7유형 데이터 0
- [ ] 서구∩서해구 등 단지명 중복 0
- [ ] 2026-06 옛/신 이중저장 0
- [ ] 신구 상세 = 전체 이력, 주소=현행 구
- [ ] 옛구 단지 URL 301 정확(building→현행구), 허브 URL→/incheon
- [ ] 사이트맵 옛구 제거·신구 존재
- [ ] 허브에 신설 4구 노출
- [ ] 백업 보존 확인, 롤백 절차 리허설
