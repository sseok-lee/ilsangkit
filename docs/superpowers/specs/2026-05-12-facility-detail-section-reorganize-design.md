# 시설 상세 페이지 — 기본정보 / 시설현황 재배치 설계

날짜: 2026-05-12
대상 페이지: `frontend/pages/[category]/[id].vue`
대상 컴포넌트: `frontend/components/facility/detail/DetailBasicInfo.vue`, `frontend/components/facility/detail/DetailFacilityStatus.vue`

## 문제

현재 시설 상세 페이지의 두 섹션(`기본정보`, `시설현황`)은 명확한 분리 기준 없이 데이터가 섞여 있다.

- 운영 메타데이터(운영기관·홈페이지·설립일)가 `시설현황`에 들어가 있어서 `기본정보`가 사실상 비어 보이는 카테고리가 다수 존재한다 (school, childcare, market, park, sports).
- 동일 데이터가 양쪽에 중복 등장한다: 병원 요일별 진료시간 표(현재 시설현황) + 단일 줄(현재 기본정보), AED 요일별 이용시간 표 동일 패턴, 병원 홈페이지 중복.
- `pharmacy`는 `hasFacilityStatus=false` 처리되어 시설현황이 아예 노출되지 않지만, 약사 수(`pharmacistCnt`)는 시설 구성 정보임에도 기본정보에 들어가 있다.

## 분리 원칙

> **기본정보** = "이 시설을 방문할지 / 지금 갈 수 있는지" 판단에 쓰이는 모든 정보
> **시설현황** = "도착해서 실제로 만나는 시설의 구성·규모·설비"

이 원칙은 사용자 동선(목록 → 상세 → 길찾기/전화)과 일치한다. 방문 결정에 필요한 정보가 한곳에 모이고, 시설현황은 "여기 가면 뭘 만나는지" 보조 정보로 작동한다.

### 기본정보에 들어가는 것

- 위치: 주소(복사 버튼)
- 시간: 운영시간 단일 줄, 24시간 배지, 요일별 운영시간 표(병원/AED), 평일/토/공휴일 시간(도서관), 휴지 기간(어린이집), 휴관일
- 연락: 전화, 응급전화, 담당자 연락처
- 운영 주체: 운영기관, 관리기관, 시설유형, 종별, 학교급/설립형태/공학유형, 어린이집 유형, 시장유형, 공원유형, 체육시설 유형/구분
- 신뢰 메타: 홈페이지, 설립일/개설일/인가일/지정일, 데이터 기준일
- 카테고리별 트리거 액션: AED의 119 신고/사용법 버튼

### 시설현황에 들어가는 것

- 화장실: 칸수(남/여/소변기), CCTV·장애인·기저귀대 등 접근성, 비상벨/기저귀교환대 위치, 접근성 상세
- 와이파이: SSID, 설치 장소(상세)
- 주차장: 요금 정보, 시설 정보(주차면수·결제방법·장애인 주차·부제 등)
- 도서관: 좌석/장서/연속간행물/비도서/대출 정책, 부지·건물 면적
- AED: 설치위치(buildPlace), 제조사, 모델명
- 공원: 면적, 보유 시설(운동/놀이/편의/교양/기타)
- 학교: 학급 현황, 계열 정보
- 시장: 점포 수, 주요 판매품목, 편의시설(공중화장실·주차·상품권)
- 어린이집: 정원/현원/보육실/CCTV/놀이터/교직원/보육실 면적, 가용률, 반별 정원·현원, 직원 현황, 교사 경력 분포
- EV 충전기: `EvChargerDetail` (충전기 목록/타입/출력)
- 체육시설: 시설면적, 관람석수
- 병원: 의료진 현황, 진료과목, 병상 정보, 주차정보, 약사 수(약국 카테고리)
- 약국: 약사 수

## 카테고리별 이동 매트릭스

| 카테고리 | 기본정보로 이동 | 시설현황으로 이동 | 중복 제거 |
|---|---|---|---|
| toilet | 소유구분(ownershipType) | — | — |
| wifi | — | — (현재 기본정보엔 SSID 없음, 시설현황 SSID 유지) | — |
| clothes | — (수거 품목 가이드는 기본정보 유지) | — | — |
| parking | — | — (현재 분리 양호) | — |
| library | — (현재 분리 양호) | — | — |
| aed | 요일별 이용시간 표, 담당자 연락처(clerkTel) | — | 시설현황의 요일별 표·담당자 연락처 마크업 제거 |
| hospital | 요일별 진료시간 표, 홈페이지 일원화 | — | 시설현황의 요일별 표·홈페이지 마크업 제거 |
| pharmacy | — | 약사 수(pharmacistCnt) | — (`hasFacilityStatus`에서 pharmacy 제외 해제) |
| park | 공원유형, 지정일, 관리기관, 연락처 | — (면적/보유시설은 시설현황 유지) | — |
| school | 학교급, 설립형태, 남녀공학, 고교유형, 본/분교, 운영상태, 설립일, 연락처, 팩스, 홈페이지, 관할 교육청 | — (학급 현황·계열만 시설현황) | — |
| market | 시장유형, 개설주기, 개설연도, 홈페이지 | — (점포수·판매품목·편의시설은 시설현황) | — |
| childcare | 어린이집 유형, 운영 상태, 휴지 기간, 인가일, 대표자, 연락처, 팩스, 통학차량, 홈페이지, 특이사항, 데이터 기준일 | — (정원/시설/반별/직원/경력은 시설현황) | — |
| ev-charger | — (EvChargerDetail 그대로) | — | — |
| sports | 시설유형(ftypeNm), 시설구분(faciGbNm), 국가대표시설(nationYn), 업종명(fcobNm) | — (시설면적·관람석수는 시설현황) | — |
| trash | N/A (별도 페이지) | N/A | — |

가장 변화가 큰 카테고리: `school`, `childcare`, `aed`, `hospital`, `park`, `sports`, `market`.

## 컴포넌트 변경 요약

### `DetailBasicInfo.vue`

표준 골격:
1. `OperatingStatusBanner` (기존 위치)
2. 주소 + 복사 버튼
3. 운영시간(단일 줄, 24시간 배지) — 요일별 표가 있는 카테고리에서는 자동 숨김
4. 요일별 운영시간 표 (병원, AED) — `DetailFacilityStatus`에서 이동
5. 도서관 평일/토/공휴일 시간 (현재 위치 유지)
6. 전화 + 응급전화 + 담당자 연락처
7. 카테고리별 메타 그룹 — 기존 행 패턴(`label : value`)으로 확장

신규/이동 블록:
- park: `공원유형 / 지정일 / 관리기관 / 연락처`
- school: 카드형 메타(학교급/설립형태/공학/고교유형/본분교/운영상태) + `설립일 / 연락처 / 팩스 / 홈페이지 / 시도교육청 / 교육지원청`
- market: `시장유형 / 개설주기 / 개설연도 / 홈페이지`
- childcare: `어린이집 유형 / 운영 상태` 카드 + 휴지 기간 알림 + `인가일 / 대표자 / 연락처 / 팩스 / 통학차량 / 홈페이지 / 특이사항 / 데이터 기준일`
- sports: 카드형 메타(`시설유형 / 시설구분 / 국가대표시설`) + `업종명`
- toilet: `소유구분` 추가

### `DetailFacilityStatus.vue`

제거할 블록:
- aed: 요일별 이용시간 표 마크업, 담당자 연락처 행
- hospital: 요일별 진료시간 표 마크업, 홈페이지 행
- school: 학교급/설립형태/공학/고교유형/본분교/운영상태 카드 그리드, 설립일/연락처/팩스 행, 홈페이지 섹션, 관할 교육청 섹션
- market: 시장유형/개설주기 카드, 개설연도 행, 홈페이지 섹션
- childcare: 어린이집 유형/운영상태 카드, 휴지 기간 알림, "기본 정보" 테이블 전체, 특이사항, 데이터 기준일
- park: 공원유형 카드, 지정일/관리기관/연락처 행 (면적·보유 시설만 남김)
- sports: 시설유형/시설구분/국가대표 카드, 업종명 행
- wifi: 시설현황에 SSID는 남기되 기본정보에 별도로 노출하던 SSID 행 제거 검토 (현재는 기본정보에 SSID 노출 없음 — 확인만)
- toilet: 소유구분 행 (기본정보로 이전)
- pharmacy: `hasFacilityStatus`에서 pharmacy 제외 해제, `pharmacistCnt`가 있을 때만 시설현황 섹션 노출

남길 블록:
- toilet: 칸수 그리드, 접근성 상세, 비상벨/기저귀교환대 위치, 편의시설 그리드
- parking: 요금 정보, 시설 정보 (전체)
- library: 좌석/장서/대출 정책, 시설 규모
- aed: 설치위치/제조사/모델
- hospital: 의료진 현황, 진료과목, 병상 정보, 주차정보
- ev-charger: `EvChargerDetail`
- sports: 시설면적, 관람석수
- park: 면적, 보유 시설
- market: 점포 수, 주요 판매품목, 편의시설
- school: 학급 현황, 계열 정보
- childcare: 정원/시설 현황 그리드, 가용률, 반별 정원·현원, 직원 현황, 교사 경력 분포

### `frontend/pages/[category]/[id].vue`

- 요일별 시간 계산 로직(`hospitalWeeklyHours`, `aedWeeklyHours`, `hospitalOperatingHours`, `aedOperatingHours`, `pharmacyOperatingHours`)은 페이지 레벨에서 그대로 유지
- `DetailBasicInfo` props에 `hospitalWeeklyHours`, `aedWeeklyHours`를 추가 (요일별 표 마크업이 이전되므로). 기존 `hospitalOperatingHours`/`aedOperatingHours`/`pharmacyOperatingHours`는 fallback 표시용으로 유지
- `DetailFacilityStatus` props에서 더 이상 안 쓰는 시간 props 제거

## 예외 케이스 / 결정 사항

- **`hideOperatingHours`**: 요일별 표가 기본정보에 들어오면, 단일 운영시간 줄은 기존처럼 숨김 처리 유지 (hospital/aed에서 `*WeeklyHours.length > 0`일 때)
- **`OperatingStatusBanner`**: 기본정보 최상단 유지
- **`clothes` 수거 품목 가이드**: 시설 규모가 아닌 일반 안내 → 기본정보 유지
- **`childcare` 휴지 기간 알림**: 방문 가능 여부 직결 → 기본정보 상단(운영 상태 바로 아래) 배치
- **`childcare` 데이터 기준일**: 기본정보 푸터로 이동
- **`pharmacy` 시설현황**: `pharmacistCnt > 0`일 때만 섹션 노출 (빈 섹션 방지)
- **테스트**: `frontend/tests/components/facility/details/*` 의 기존 unit 테스트가 깨지면 즉시 수정. E2E 셀렉터 변경 없음

## 작업 분량

- `DetailBasicInfo.vue`: 추가 +250~300줄 (요일별 표 마크업, 신규 카테고리 메타 블록)
- `DetailFacilityStatus.vue`: 삭제 −300~400줄
- 페이지: props 정리 수준 (변경 미미)

## 롤백 / 분할 전략

PR은 하나로 묶되 커밋은 카테고리별로 분할:

1. 기본정보 골격 정비 + 요일별 표 이전 인프라
2. toilet (소유구분 이동)
3. wifi (SSID 정리)
4. park
5. aed (요일별 표·담당자 연락처 이동, 시설현황 정리)
6. hospital (요일별 표·홈페이지 이동, 시설현황 정리)
7. pharmacy (약사 수 이동, 시설현황 활성화)
8. school
9. market
10. childcare
11. sports
12. 잔여 props 정리 + 페이지 통합 검수

각 커밋에서 해당 카테고리 시설 페이지를 수동 확인.

## Out of Scope

- 시각 디자인(섹션 헤더 스타일·간격) 변경 없음. 기존 마크업 패턴 그대로 사용
- `trash` 페이지 (별도 페이지, 영향 없음)
- 부동산 실거래가 페이지 (별도 페이지, 영향 없음)
- 시설현황의 `hasGridContent`/`facilityAmenities` 로직은 그대로 유지
- 새로운 카테고리 메타 필드 수집/스키마 변경 없음 — 이미 응답에 있는 필드만 재배치
