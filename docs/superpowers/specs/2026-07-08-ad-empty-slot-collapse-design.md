# 광고 빈 슬롯 빠른 collapse + 애드블록 감지 설계

작성일: 2026-07-08
상태: 설계 확정 (사용자 승인)
관련: [[project_adsense_ivt_remediation]](무효트래픽), [[feedback_adbanner_placement]](광고 개수·위치 불변)

---

## 1. 배경 / 문제

부동산 상세 등에서 수동 광고 슬롯이 **미할당·차단 시 몇 초간 빈칸**으로 보인다(스크린샷: 기본정보와 매매가 추이 사이 빈 공간).

원인(`AdBanner.vue`):
- CLS(레이아웃 밀림) 방지를 위해 슬롯 자리를 `min-height`로 **예약**한다.
- 그 자리는 다음 중 하나가 일어나야 접힌다: (a) `data-ad-status=unfilled`/`unfill-optimized` → CSS collapse, (b) `filled` → 광고 표시, (c) **어떤 status도 안 오면 `STATUS_TIMEOUT_MS=4000` 후 collapse**.
- **애드블록**이면 `adsbygoogle.push`가 조용히 실패하고 status가 영영 안 와서 **4초 내내 빈칸** 후 접힌다. SPA 페이지 한도 초과(`unfill-optimized` 보류)도 같은 4초 빈칸.

경쟁사 ayo 실측(2026-07-08, Playwright): ayo는 **예약 높이를 두지 않는다**(`.adsense-wr` 컨테이너·`ins` 모두 `min-height:0`). 미할당·차단 = 0높이(빈칸 없음), 대신 **광고 fill 시 콘텐츠가 밀리는 CLS를 감수**한다. 애드블록 감지는 없음.

## 2. 목표

빈칸 노출을 최소화하되 **CLS를 늘리지 않고**(예약 높이 유지) **fill률도 손해 없이**. 즉 ayo가 얻는 "차단 시 빈칸 없음"은 취하되 ayo의 CLS 비용은 피한다.

### 비목표 (YAGNI)
- ayo식 예약 높이 제거(CLS 감수)는 채택 안 함 — Lighthouse CI·CWV·IVT 이력 때문.
- 광고 개수·위치 변경 없음([[feedback_adbanner_placement]] 준수). 광고가 있을 땐 지금과 동일하게 모두 렌더.
- 새 광고 포맷/슬롯 추가 없음.

## 3. 변경 (3가지)

### 3.1 타임아웃 단축 — `frontend/components/ads/AdBanner.vue`
`STATUS_TIMEOUT_MS` **4000 → 1500ms**.
- status 미응답 슬롯(차단·미로드·SPA 한도초과)이 **1.5초 만에** collapse.
- **fill 무손해**: 광고 요청(`adsbygoogle.push`)은 그대로 발송되고, 타임아웃 collapse 후에도 **기존 MutationObserver가 살아있어** 늦은 `filled` 응답 시 `handleStatus('filled')`가 자리를 다시 펼친다(현행 로직 그대로 활용).
- 1.5초는 정상 AdSense 응답(<1s)에 충분 → 늦은 fill의 재확장 깜빡임 거의 없음.

### 3.2 애드블록 선감지 — `frontend/plugins/adsense.client.ts`
adsbygoogle 스크립트가 **실제로 로드 실패**했을 때만 보수적으로 "차단" 판정(오탐 방지):
- 주 신호: 주입한 `<script>`의 `onerror` → 차단.
- 보조 신호: `onNuxtReady` + 약 2초 뒤 `window.adsbygoogle?.loaded !== true`면 차단(일부 블로커는 빈 200 응답이라 `onerror` 미발생 → `.loaded`로 확인).
- 차단 확정 시: `useState('ads:blocked')`를 `true`로 세팅 + `sessionStorage.setItem('ads:blocked','1')`.
- 스크립트가 정상 로드되면 아무 것도 안 함(기본 false 유지).

### 3.3 차단 시 슬롯 미표시 — `frontend/composables/useAdsPolicy.ts` + `AdBanner.vue`
- `useAdsPolicy().shouldServeAds` 계산에 **`&& !blocked`** 추가(`blocked = useState('ads:blocked')`).
  - 클라이언트 init 시 `sessionStorage`에서 seed → 차단 사용자의 **두 번째 페이지부터는 처음부터 `shouldServeAds=false`** → 슬롯 div가 `v-if`로 아예 안 그려짐(ayo와 동일한 결과, CLS 없이).
  - 현재 페이지에서 차단이 감지되면 reactive `blocked=true`로 전환 → 렌더된 모든 AdBanner의 `shouldShow`가 false가 되어 collapse.
- `AdBanner`의 기존 `shouldShow = shouldServeAds.value && (!props.only || matches.value)` 계약은 그대로(추가 gate 없음, 소스는 `shouldServeAds`에만 반영).

## 4. 사용자가 보는 결과 (케이스별)

| 상황 | 현행 | 변경 후 |
|---|---|---|
| 광고 정상 fill | 예약칸 → 광고 | **동일**(무변화) |
| unfilled(광고 없음) | 예약칸 → ~1s 후 collapse | 동일(짧은 깜빡, 원래도 빠름) |
| status 보류 / SPA 한도초과 | **4s 빈칸** | **1.5s로 단축** |
| 애드블록 (첫 페이지) | 4s 빈칸 | 스크립트 로드 실패 감지 시점(대개 <1.5s)~1.5s 내 collapse |
| 애드블록 (이후 페이지) | 매 페이지 4s 빈칸 | **빈칸 0**(슬롯 미렌더, ayo 동일) |

## 5. 안전장치 / 원칙
- **fill률 무손해**: 광고 요청 그대로 발송 + 늦은 fill 복구(관측자 유지). 애드블록 판정은 스크립트 로드 실패 시에만(오탐 시 fill 기회 상실 방지).
- **CLS 무증가**: 예약 높이 유지 → 레이아웃 안 밀림. Lighthouse/CWV 현행 유지.
- **광고 개수·위치 불변**: 슬롯 수·배치 그대로. 광고가 있을 땐 지금과 동일.
- **무효트래픽 무증가**: 콘텐츠 점프로 인한 오클릭 없음(CLS 없으니).

## 6. 컴포넌트/경계
- `AdBanner.vue` — 타임아웃 상수 변경(3.1). `shouldShow`는 `shouldServeAds`를 통해 blocked 자동 반영(3.3), 컴포넌트 내 추가 로직 없음.
- `adsense.client.ts` — 스크립트 주입에 onerror/loaded 감지 추가, `ads:blocked` 세팅(3.2). 단일 책임: 스크립트 로드 + 차단 감지.
- `useAdsPolicy.ts` — `blocked` state 병합 + sessionStorage seed(3.3). 게이팅 단일 소스.
- 세 파일 모두 기존 파일 내 소규모 수정, 신규 파일 없음.

## 7. 테스트 (Vitest, happy-dom)
- `AdBanner`: (a) 1500ms 타임아웃 후 `.ad-banner--timed-out` collapse, (b) 타임아웃 후 늦은 `filled`면 복구, (c) `shouldServeAds=false`(blocked)면 슬롯 미렌더.
- `useAdsPolicy`: `blocked=true`면 `shouldServeAds=false`; sessionStorage에 `ads:blocked`가 있으면 초기부터 false로 seed.
- `adsense.client`: script `onerror` 시 blocked 세팅; 로드 후 `.loaded !== true`면 blocked 세팅; 정상 로드면 false 유지.
- 회귀: 정상 fill·unfilled 기존 동작·SSR 가드·bot 게이팅 유지. 기존 AdBanner/useAdsPolicy 테스트 green.

## 8. 미해결/확정
- 타임아웃 값 **1500ms** (사용자 확인; 필요 시 조정).
- 애드블록 보조 감지 지연 **~2초** (onerror가 대개 먼저 발동하므로 백업용).
- sessionStorage 키 `ads:blocked` (세션 한정; 새 탭/세션에서 재감지).
