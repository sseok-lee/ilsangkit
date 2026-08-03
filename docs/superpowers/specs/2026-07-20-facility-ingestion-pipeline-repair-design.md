# 시설 수집 파이프라인 복구 설계

**작성일**: 2026-07-20
**상태**: 승인됨 → 플랜
**성격**: 운영 버그 수리 (개편 명칭 정리와 별개, 선행)

## 배경 / 문제

전 시설 수집 감사(2026-07-20, 읽기전용 프로덕션 실측) 결과, **7개 시설 카테고리가 매일 "success"로 기록되면서 실제론 0건 저장** — 조용히 수집이 중단돼 DB 데이터가 붕괴 이전 시점으로 **동결**돼 있음. `SyncHistory`에서 newRecords=0·updatedRecords=0로 확인, 근본원인은 직접 재현·실호출로 검증.

**중요**: 이 카테고리들이 "옛명칭"인 것은 2026 행정개편이나 파서 왜곡 탓이 아니라 **수집 자체가 멈췄기 때문.** (감사에서 "우리 코드가 개편명을 왜곡"하는 사례는 0건으로 확인됨.)

## Ground-truth (검증됨)

| 카테고리 | 근본원인 | 검증 방법 |
|---|---|---|
| **toilet** | 새 toilet.csv에 **좌표 컬럼(위도/경도) 삭제됨**(34컬럼 전부 주소·시설정보). csvParser가 좌표 필수 검증에서 전량 null | CSV 헤더 직접 확인·transform 재현 |
| **clothes·parking·library·park·market** | data.go.kr TN 표준데이터 API가 **영문 필드명으로 전환**(`prkplceNm`·`rdnmadr`·`latitude`·`ctpvNm`…). 코드는 옛 한글 헤더 기대 → 전량 null. + 코드가 `http://`로 호출해 매 요청 **301 리다이렉트** | parking API 실호출(영문 필드+`latitude`/`longitude` 확인) |
| **ev-charger** | 상류 API **502/504/타임아웃**, 51만 행 대용량 페이지네이션에서 abort | SyncHistory status=failed(7/14~)·에러메시지 |

**핵심 사실**: TN API는 **좌표를 제공**(`latitude`/`longitude`) → 5종은 필드명 매핑만 고치면 됨(지오코딩 불필요). toilet은 소스에 좌표가 **없음** → 지오코딩 필요.

## Scope

**대상**: 위 7개 카테고리의 수집 파이프라인 복구만.
**비목표**:
- 개편 명칭 정규화(전남광주통합특별시)·slug/URL·중복정리 — **별도 프로젝트**(이 복구 후 재sync된 최신 데이터 위에서 진행).
- 정상 동작 카테고리(wifi·hospital·school·childcare·sports·subway·pharmacy·aed·trash) 변경 없음.
- ev-charger의 개편 zcode(이미 12로 완전전환) 처리는 로직상 정상 — 복구는 수집 성공만.

## 워크스트림

### A. TN 표준데이터 API 5종 — 필드명 마이그레이션

**대상**: clothes(`tn_pubr_public_clothing_collect_bins_api`)·parking(`tn_pubr_prkplce_info_api`)·library(`tn_pubr_public_lbrry_api`)·park(`tn_pubr_public_cty_park_info_api`)·market(`tn_pubr_public_trdit_mrkt_api`).

**수리**:
1. 각 카테고리 sync/transform의 필드 접근을 **영문 키로 교체**(예: `소재지도로명주소`→`rdnmadr`, `위도`→`latitude`, `경도`→`longitude`, `시도명`→`ctpvNm`, 시설명 필드 등). 정확한 매핑은 각 API 실응답에서 도출(플랜에서 카테고리별 확정).
2. API 호출을 **`https://`로 직접**(301 왕복 제거).
3. 좌표는 제공되므로 기존 좌표 검증 경로 유지(지오코딩 추가 없음).

**검증**: 각 카테고리 재sync 시 transform 성공률 >0, DB 신규/갱신 건수 증가, 좌표 유효 범위.

### B. toilet — 좌표 지오코딩

**수리**:
1. toilet 파싱을 **좌표 없이 허용**(csvParser의 "좌표 없어도 저장(null)" 경로로 전환) → 전량 null 탈락 방지.
2. 저장된 주소(`소재지도로명주소`/`지번주소`)로 **기존 지오코딩 인프라**(Kakao)로 좌표 채움. 좌표 없는 행은 지오코딩 큐/후속 단계로.

**검증**: toilet 재sync 시 5만+행 저장, 지오코딩 후 좌표 보유율.

### C. ev-charger — fetch 견고화

**수리**(resume + 백오프):
1. **502/504에 백오프 재시도**(현 abort 즉시실패 → 지수 백오프).
2. **페이지 축소** 및/또는 **resume-from-page**(진행 페이지 체크포인트 → 재실행 시 이어받기)로 51만 행 완주.
3. 타임아웃 값 재조정.

**검증**: ev-charger 전체 sync가 status=success로 완주, DB 갱신.

## 실행 / 검증

- 각 워크스트림 수리 후 **해당 카테고리 1회 재sync**(프로덕션 or 스테이징)로 수집 성공 확인 — SyncHistory newRecords/updatedRecords >0.
- 회귀 방지: 정상 카테고리 미변경 확인.
- **모니터링 추가 권장**(비목표지만 명시): sync가 tot>0인데 new=0·updated=0면 경보 — 이번 "조용한 실패"가 재발하지 않도록.

## 리스크

- **TN 필드 매핑 누락/오류** → 부분 null. 카테고리별 실응답 대조로 확정, 재sync 성공률로 검증.
- **toilet 지오코딩 부하**(5만+행) → 배치·레이트리밋(기존 지오코딩 패턴 재사용, 신규 부하 아님).
- **ev-charger 상류 불안정** → 우리 견고화로 완화하되 상류 장애 시 부분 실패 가능(재개로 다음 실행 이어받기).
- 프로덕션 재sync는 데이터 대량 갱신 → 배포·타이밍 주의(기존 daily sync 창 활용).

## 후속

복구·재sync 완료 후 시설들이 현재(신/구 혼재) 데이터를 수집 → 그 위에서 **Region 정규화(전남광주통합특별시)** 프로젝트 진행.
