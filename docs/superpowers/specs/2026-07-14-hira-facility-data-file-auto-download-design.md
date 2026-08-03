# 병원·약국 데이터 수집: HIRA 파일 자동 다운로드 이관 설계

- **날짜**: 2026-07-14
- **상태**: 설계 승인 대기 → (승인 시) writing-plans
- **범위**: 병원·약국 enrichment(상세/보강) 데이터 소스를 "수동 xlsx"에서 "HIRA 포털 자동 다운로드"로 이관 + 미사용 파일 2종(의료장비·전문병원지정) 풍부화
- **문서 위치**: 로컬 전용(`docs/superpowers/specs`는 프로젝트 관례상 gitignore)

---

## 1. 배경 & 문제

사용자 초기 요청은 "병원·약국을 xlsx로 수집 중인데 건강보험심사평가원(HIRA) API로 교체하고 싶다"였다. 코드 조사 결과 **전제가 절반만 맞았다**:

| 레이어 | 병원 | 약국 | 현재 소스 |
|---|---|---|---|
| **basic**(이름·주소·좌표·인력수) | `syncHospital.ts` | `syncPharmacy.ts` | **이미 API** ✅ (병원=HIRA `B551182/hospInfoServicev2`, 약국=E-Gen 응급의료 `B552657`) |
| **enrichment**(진료시간·병상·과목·간호등급·약사수) | `seedHospitalDetail.ts` + `seedMedicalEnrich.ts` | `seedMedicalEnrich.ts` | **xlsx(ExcelJS)** ← 실제 이관 대상 |

즉 "xlsx → API" 이관의 진짜 대상은 **enrichment 레이어**다. 이 레이어는 오늘날 `opendata.hira.or.kr`(sno=11925)에서 **분기마다 사람이 손으로** zip을 받아 `backend/prisma/data/extra_hospital_latest/`에 풀어 넣어야 동작한다. 그리고 그 xlsx는 **gitignore(로컬 전용)** 이라 **Cafe24 서버/CI의 `syncAll`에서는 파일이 없어 enrichment가 자동 실행되지 못한다**(서버 데이터가 마지막 수동 seed 시점에 고정).

### 핵심 반전 (검증됨)

per-ykiho 상세 API로 전면 이관하려던 방향은 **HIRA 데이터 배포 구조에 역행**한다. 라이브 검증(현 `OPENAPI_SERVICE_KEY`)으로 확정한 사실:

1. **상세 API는 ykiho당 1콜뿐.** `MadmDtlInfoService2.7`의 모든 오퍼레이션(`getDtlInfo`/`getDgsbjtInfo`/`getEqpInfo`/`getTrnsprtInfo`/`getNursigGrdInfo`/`getEtcHstInfo` 등)이 단일 `ykiho`를 받고, `numOfRows>1`은 한 기관의 하위행만 페이징한다. **bulk/list 변형 없음.** → 8만 병원 상세를 API로 채우려면 수십만 콜(크론+호출예산+수일).
2. **파일 = API 동일 소스.** 상세 API 데이터는 xlsx `전국 병의원 및 약국 현황`과 **같은 HIRA 행정 데이터, 같은 분기 스냅샷**이다. 즉 API가 상세에서 더 신선하지 않다.
3. **그 파일은 인증 없이 자동 다운로드가 가능하다.** `opendata.hira.or.kr` sno=11925에서 로그인·캡차·활용신청 **전부 불필요**하게 62MB zip을 plain HTTP로 받는 것을 실증했다(§5 참조).

결론: **"xlsx를 API로 교체"보다 "손으로 받는 그 xlsx를 서버가 자동으로 받게" 하는 것이 사용자의 4개 동기(자동화·최신성·풍부화·일관성)를 모두 더 잘 만족한다.** per-ykiho API는 8만 콜 문제만 새로 만들고 얻는 게 거의 없다. (사용자 확정 방향)

---

## 2. 목표 / 비목표

### 목표
- **자동화**: 서버 `syncAll`이 사람 개입 없이 최신 분기 파일을 받아 enrichment까지 수행
- **최신성**: 분기 파일 갱신을 자동 감지해 반영(상세 데이터의 실질 최선 주기 = 분기)
- **일관성**: enrichment를 단일 자동 파이프라인으로 통합, 수동 절차 제거
- **풍부화(Phase 2)**: zip 내 미사용 파일 중 **의료장비(CT·MRI)** 와 **전문병원 지정분야**를 추가 노출

### 비목표 (이번 범위 밖)
- 병원/약국 **basic sync 재작성** (이미 API, 무변경). 저위험 폴리시(numOfRows↑·`_type=json`·주석 오표기 수정)는 별도 후속.
- **약국 소스 변경**: E-Gen(영업시간 보유) 유지. HIRA 약국정보서비스(15001673) 활용신청·전환 **안 함**.
- per-ykiho 상세 **API 도입**(크론 롤링 포함).
- 미사용 파일 중 **특수진료·교통·식대가산** 반영(감사 결과 가치·커버리지 낮음, §부록 A).

---

## 3. 설계 상세

### 3.1 Phase 1 — HIRA 파일 자동 다운로드

#### (a) 신규 다운로더 `hiraFileDownloader`
- **위치**: `backend/src/services/hiraFileDownloader.ts` (신규). Node `fetch` 기반, **Playwright 미도입**(백엔드 경량 유지).
- **공개 계약**:
  ```ts
  // 성공: 최신 분기가 이미 반영돼 있으면 { updated:false }, 새로 받아 풀었으면 { updated:true, fileSno, dir }
  // 실패: throw (호출측이 fail-soft 처리)
  async function ensureLatestHiraFiles(): Promise<{ updated: boolean; fileSno?: string; dir: string }>
  ```
- **절차**:
  1. `GET https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925` — 브라우저 User-Agent 필수(기본 curl UA는 WAF 차단). 응답에서 자동 세션쿠키(`WMONID`, `HIRAODSESSION`) 확보 + HTML 파싱.
  2. HTML의 `전국 병의원 및 약국 현황` 항목에서 **최신 분기의 `fn_fileDown('<fileSno>')`** 와 그 항목이 참조하는 **서버 파일 경로**(`/shared/data/uploadFiles/file/<UUID>.zip`)·**표시 파일명**을 추출(페이지가 DEXT5 `AddUploadedFile` 형태로 함께 emit함). 여러 분기 중 **가장 최신 fileSno** 선택.
  3. **신선도 게이트**: 추출한 최신 fileSno를 마커(`backend/prisma/data/extra_hospital_latest/.hira_filesno`)와 비교. **동일하면 다운로드·파싱 전체 스킵**하고 `{updated:false}` 반환(분기 데이터를 매일 재다운로드/재파싱하지 않음).
  4. 새 분기면: **DEXT5 `d00` 블롭 구성**(§부록 B 구조; EUC-KR/CP949 필요 시 인코딩) → `POST https://opendata.hira.or.kr/dext5upload/handler/upload.dx?callType=download&url=/op/opc/selectOpenData.do` (`customValue=<fileSno>&d00=<blob>`) → 응답 `Content-Type: application/zip` 스트림을 임시 파일로 저장.
  5. **검증**: `Content-Type=application/zip` + 크기 하한(예: ≥ 10MB) 확인. 실패 시 throw(마커 미갱신, 기존 파일 보존).
  6. **CP949 압축해제**: zip 엔트리 파일명이 EUC-KR/CP949 → 정확 디코딩해 `extra_hospital_latest/`에 전개. 성공 후에만 마커를 새 fileSno로 갱신.
- **다운로드 방식 리스크 & 대체**: `d00` 재구성이 포털 변경에 취약할 수 있음 → (1차) fetch 기반 재구성, (스파이크로 취약 확인 시) 경량 headless로 `fn_fileDown` 호출해 다운로드 이벤트 캡처(브라우저가 `d00` 자동 생성). 다운로더 내부 구현만 교체 가능하도록 계약을 추상화. **최후수단**: 새 분기(연 4회)에만 `d00`를 수동 갱신(자동화 저하이므로 비선호).

#### (b) 압축해제 & 파일 배치
- 전개 대상: 기존 `DATA_DIR = backend/prisma/data/extra_hospital_latest/`(파서가 이미 이 경로를 읽음).
- **파일 선택 인코딩 안전화**: `seedMedicalEnrich`는 이미 숫자프리픽스 `^N\.`로 파일을 고르므로 인코딩 무관. `seedHospitalDetail`은 파일명에 한글(`세부정보`/`진료과목`)이 포함되는지로 고르므로 **CP949 디코딩이 정확해야 함** → 방어적으로 **숫자프리픽스(`4.`/`5.`) 매칭을 병용**하도록 선택 로직을 소폭 보강(디코딩 실패에도 견고).
- 디스크: zip ~62MB + 전개 ~65MB. Cafe24 서버 여유 충분. 전개 전 이전 파일 정리, 단 **다운로드 실패 시엔 기존 파일 미삭제**(데이터 보존).

#### (c) `syncAll` 편입
- `backend/src/scripts/syncAll.ts`:
  - `CATEGORIES` 배열(현 line 71)에 **`'hira-file'`** 스텝 추가, 그리고 현재 수동 전용인 **`seedHospitalDetail`을 `'hospital-detail'` 스텝으로 승격**. 단 `seedHospitalDetail`은 현재 top-level 실행 스크립트이므로, **`seedMedicalEnrich`의 `runMedicalEnrich()`처럼 실행 로직을 export 함수(예: `runHospitalDetail()`)로 추출**하고 기존 CLI 진입점(`seed:hospital-detail`)은 그 함수를 호출하도록 리팩터한다.
  - **실행 순서**(배열 순): `... hospital, pharmacy, hira-file, hospital-detail, medical-enrich, parking ...`
    - `hospital`/`pharmacy` 먼저(ykiho·hpid 확보) → `hira-file`(파일 준비/신선도 게이트) → `hospital-detail`(진료시간·주차·과목) → `medical-enrich`(병상·간호등급·약사수·약국 ykiho 매칭).
  - `syncCategory` switch에 `case 'hira-file'`(→ `ensureLatestHiraFiles()`), `case 'hospital-detail'`(→ `seedHospitalDetail`의 export 함수) 추가.
- **Fail-soft**: `hira-file`이 throw해도 `syncCategory`의 기존 try/catch가 실패로 기록하고 **전체 sync는 계속**(다른 카테고리 영향 없음). 파일이 없으면 `hospital-detail`/`medical-enrich`는 기존처럼 스킵/무변경(기존 데이터 보존). `installRuntimeGuard maxMinutes:120` 내 수행(다운로드+파싱은 새 분기일 때만 무거움).
- **npm 스크립트**: 기존 `seed:hospital-detail`/`seed:medical-enrich` 유지. 다운로더 단독 실행용 `sync:hira-file`(→ `hiraFileDownloader`) 추가(운영 수동 트리거·디버그용).

#### (d) 안 바뀌는 것
- 병원/약국 **basic sync**(이미 API), 약국 **E-Gen 유지**(영업시간 강점).
- 파일 `2.약국정보서비스` 시트로 **pharmacy `ykiho` fuzzy 매칭(이름+좌표 ~500m) → 약사수 enrichment** 계속 동작(`seedMedicalEnrich` 기존 로직). **활용신청 추가·80k콜 없음.**
- 기존 파서 컬럼 매핑·스키마·프론트 로직 유지(공급원만 수동→자동).

### 3.2 Phase 2 — 풍부화 (의료장비 · 전문병원)

감사(§부록 A)로 선정된 2종만 반영.

#### (a) 의료장비 — `HospitalEquipment` 신규 테이블
- 소스: `7.의료기관별상세정보서비스_05_의료장비정보` — 병원당 N행, **고유 병원 42,005 (전체의 53%)**.
- 컬럼: `암호화요양기호(ykiho)`, `요양기관명`, `장비코드`, `장비코드명`(초음파영상진단기/CT/MRI 등), `장비대수`.
- **Prisma 모델**(`HospitalDepartment` 패턴 미러):
  ```prisma
  model HospitalEquipment {
    id         Int      @id @default(autoincrement())
    hospitalId String   @db.VarChar(50)
    hospital   Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
    eqpCd      String   @db.VarChar(20)   // 장비코드
    eqpCdNm    String   @db.VarChar(100)  // 장비코드명
    eqpCnt     Int?                        // 장비대수
    @@unique([hospitalId, eqpCd])
    @@index([hospitalId])
  }
  ```
  `Hospital`에 `equipment HospitalEquipment[]` 관계 추가.
- **파서**: `seedHospitalDetail`(또는 신설 `seedHospitalEquipment`)에서 file 7을 ykiho→hospital.id 맵으로 조인해 `(hospitalId, eqpCd)` 기준 upsert. `db:push` 마이그레이션.
- **registry**: `categoryRegistry.ts` hospital `detailFields`에 관계 노출을 추가하고, `facilityService.ts`의 hospital include에 `equipment`를 `departments`와 동일 패턴으로 주입.
- **프론트**: `frontend/components/facility/detail/DetailFacilityStatus.vue` 병원 섹션에 **"보유 장비"**(장비명 + 대수) 목록 추가(진료과목/병상 섹션과 동일 스타일). SSR 텍스트 노출(크롤러 가시).

#### (b) 전문병원 지정분야 — `Hospital.specialtyField`
- 소스: `11.의료기관별상세정보서비스_09_전문병원지정분야` — **고유 병원 110곳**(실측 병원당 ~1개 분야).
- 컬럼: `암호화요양기호`, `요양기관명`, `검색코드`, `검색코드명`(척추/관절/안과/수지접합 등 지정분야).
- **Prisma**: `Hospital`에 `specialtyField String? @db.VarChar(100)`(지정분야명) 1필드 추가(다분야 가능성 대비 콤마 조인 허용). `db:push`.
- **파서**: `seedMedicalEnrich`(또는 file 4/5 파싱과 같은 배치)에서 file 11을 ykiho로 조인해 `Hospital.specialtyField` 업데이트.
- **registry**: hospital `detailFields`에 `specialtyField` 추가.
- **프론트**: 상세 헤더/기본정보에 **"보건복지부 지정 {분야} 전문병원" 뱃지**(값 있을 때만). 신뢰 신호로 노출.

---

## 4. 데이터 모델 변경 요약 (`backend/prisma/schema.prisma`)

- **신규** `model HospitalEquipment`(§3.2a) + `Hospital.equipment HospitalEquipment[]`
- **신규 필드** `Hospital.specialtyField String? @db.VarChar(100)`
- 반영: `npm run db:push`(dev), 배포 파이프라인의 `prisma db push`가 서버 반영.
- basic/enrichment 기존 컬럼·`Pharmacy`·`HospitalDepartment` **무변경**.

---

## 5. 다운로드 실증 근거 (요약)

- data.go.kr `15051059`는 **바로가기(link) 타입** — data.go.kr가 파일을 호스팅하지 않고 `opendata.hira.or.kr?sno=11925`로 넘김. data.go.kr 직다운로드 엔드포인트는 `atchFileId:null`이라 사용 불가.
- **실동작 경로(HIRA 포털)**: 페이지 GET(세션쿠키) → `fn_fileDown('<fileSno>')` = DEXT5 `DownloadFile` → 단일 `POST /dext5upload/handler/upload.dx?callType=download`(body `customValue=<fileSno>&d00=<blob>`) → `application/zip`.
- **실측**: plain curl(세션쿠키 + 재구성 `d00`)로 `2026.6` 분기 zip **64,452,916 bytes** 수신, `unzip -l` = 12 XLSX. 로그인·캡차·활용신청 불필요. 신규 headless 컨텍스트에서도 동일 성공.
- **분기 갱신**: `등록주기=분기`. 현재 `2023.12 ~ 2026.6`까지 분기 스냅샷 존재. 새 분기마다 **새 fileSno + 새 파일 UUID** → 스케줄러는 **매 실행 시 최신 fileSno를 스크레이프**(하드코딩 금지).

---

## 6. 엣지케이스 & 리스크

| 리스크 | 대응 |
|---|---|
| DEXT5 `d00` 재구성이 포털 변경에 취약 | 계약 추상화 + 스파이크로 취약 확인 시 headless 대체 + **fail-soft**(전체 sync 안 죽음, 기존 데이터 보존) |
| zip 엔트리 파일명 CP949 → 파서 파일선택 실패 | CP949 정확 디코딩 + `seedHospitalDetail` 선택 로직에 **숫자프리픽스 병용**(인코딩 무관 fallback) |
| 다운로드 부분 실패/손상 | Content-Type·크기 하한 검증 실패 시 throw, **마커 미갱신·기존 파일 미삭제** |
| 신규 개설 병원이 아직 파일에 없음 | 다음 분기 파일에 자동 포함(별도 처리 불필요; per-record 실시간이 필요하면 향후 hybrid로 확장 가능) |
| 20MB xlsx ExcelJS 파싱 메모리·긴 트랜잭션 (notepad의 MySQL zombie 이력) | 기존과 동일하게 **스트리밍 리더 + 배치 트랜잭션(`SYNC.BATCH_SIZE`, statement timeout)** 유지, per-item 루프 지양 |
| `hira-file`이 매 sync마다 62MB 재다운로드 | **신선도 게이트(fileSno 마커)** 로 새 분기에만 다운로드/파싱 |
| iconv/CP949 인코딩 의존성 | Node 내장 `TextDecoder('euc-kr')`(full-icu)로 디코딩; EUC-KR 인코딩이 필요하면 `iconv-lite` 추가(경량). **의존성 추가 시 반드시 `nvm use 20 && npm install`**(lock 재생성 금지 — 프로젝트 메모리 준수) |

---

## 7. 테스트 전략

- **다운로더 단위**: HTML 픽스처에서 최신 fileSno·파일경로·파일명 파싱, 신선도 게이트(동일 fileSno → 스킵), `d00` 구성, Content-Type/크기 검증 실패 경로. 네트워크는 mock(실제 HIRA 호출은 통합/수동으로 격리).
- **파서 단위**: 소형 xlsx 픽스처(의료장비·전문병원 샘플)로 `(hospitalId, eqpCd)` upsert·`specialtyField` 업데이트·미매칭 ykiho 스킵 검증.
- **registry/프론트**: hospital 상세 응답에 `equipment[]`·`specialtyField` 포함, `DetailFacilityStatus.vue` 장비 섹션·전문병원 뱃지 렌더(값 없을 때 미표시). 기존 테스트 setup(`tests/setup.ts` 글로벌 mock) 준수.
- **회귀**: 커밋 전 backend/frontend `vitest run` 전체 green(프로젝트 규칙).

---

## 8. 롤아웃 (PR 분할)

프로젝트 PR 워크플로우(모든 변경 PR 경유, `develop`→CI green→머지, main 승격 별도) 준수.

- **PR A (Phase 1 코어)**: `hiraFileDownloader` + CP949 전개 + 신선도 게이트 + `syncAll` 편입(`hira-file`·`hospital-detail` 스텝) + fail-soft + 단위 테스트. 배포 후 **서버에서 `sync:hira-file` 실동작·최신 분기 자동 반영 라이브 검증**.
- **PR B (Phase 2 의료장비)**: `HospitalEquipment` 모델 + 파서 + registry + 상세 장비 섹션 + 테스트.
- **PR C (Phase 2 전문병원)**: `Hospital.specialtyField` + 파서 + registry + 뱃지 + 테스트.
- 각 PR: `db:push` 필요 여부 명시, opus 최종 리뷰(코드리뷰어) 후 승격. 라이브 검증(SSR HTML에 장비/뱃지 노출, 신선도 게이트 재다운로드 없음) 체크리스트 수행.

---

## 부록 A — 미사용 파일 감사 (2026.6 기준, 전체 병원 ~79,741)

| 파일 | 행수 / 고유병원 | 컬럼 | 판정 |
|---|---|---|---|
| 7 의료장비 | 63,157 / **42,005 (53%)** | ykiho, 요양기관명, 장비코드, **장비코드명(CT·MRI·초음파)**, 장비대수 | ✅ 포함(1순위) |
| 11 전문병원지정 | 110 / **110** | ykiho, 요양기관명, 검색코드, **검색코드명(척추·관절·안과…)** | ✅ 포함(값쌈·강한 신뢰 뱃지) |
| 10 특수진료 | 65,420 / 34,685 (44%) | ykiho, 요양기관명, 검색코드, 검색코드명(국가예방접종 참여 등) | ➖ 제외(코드 선별 품·이번 범위 밖) |
| 6 교통 | 23,262 / 6,284 (8%) | ykiho, 교통편명, 노선번호, 하차지점, 방향, 거리, 비고 | ✖ 제외(커버리지 8%·지도 중복) |
| 8 식대가산 | 15,626 | ykiho, 유형코드명(영양사·조리사), 가산여부, 산정인원수 | ✖ 제외(정산 내부정보) |

(참고: 이미 사용 중 — 1 병원기본, 2 약국(ykiho매칭), 3 시설/병상, 4 세부(시간/주차), 5 진료과목, 9 간호등급, 12 기타인력(약사수).)

## 부록 B — DEXT5 다운로드 `d00` 구조 (실측)

- 엔드포인트: `POST https://opendata.hira.or.kr/dext5upload/handler/upload.dx?callType=download&url=/op/opc/selectOpenData.do`
- body: `customValue=<fileSno>&d00=<base64 DEXT5 요청 블롭>`
- `d00` 디코드 시 포함: `callType=downloadRequest`, `d25=<서버파일경로 /shared/data/uploadFiles/file/<UUID>.zip>`, `d26=<표시 파일명(EUC-KR)>`, `d07=<토큰 GUID>` (필드 구분자 `\t`/`\v`).
- 특성: `d00`은 **세션 비종속**(다른 세션에서도 동작)이나 **파일 종속**(분기/UUID 바뀌면 재생성 필요). 정적 경로 `/shared/data/uploadFiles/file/<UUID>.zip` 직접 GET은 404(핸들러 POST로만 서빙).

## 부록 C — HIRA API 참고 (도입 안 하지만 근거·향후용)

- 병원 basic: `B551182/hospInfoServicev2/getHospBasisList`(이미 사용, `XPos`=경도/`YPos`=위도 포함, totalCount 79,741).
- 상세(per-ykiho only): `B551182/MadmDtlInfoService2.7` — `getDtlInfo`(진료시간/주차/응급실), `getDgsbjtInfo`(과목별 전문의수), `getEqpInfo`(병상—이름과 달리 병상), `getNursigGrdInfo`(간호등급 `careGrd`, 보험유형별), `getEtcHstInfo`(인력 `dtlGnlNopCdNm="약사"` `gnlNopCnt`), `getTrnsprtInfo`(교통). 간호등급·약사수는 API에도 있으나 **per-ykiho라 대량엔 파일이 우월**.
- 약국 basic 대안: HIRA `pharmacyInfoService/getParmacyBasisList`(15001673)는 **활용신청 미완(403)**·영업시간 없음 → E-Gen 유지.
- 병원 basic 저위험 폴리시(후속): `numOfRows` 1000→10000, `_type=json`, 주석 오표기 수정(`mdept*`=의과, `pnursCnt`=조산사).
