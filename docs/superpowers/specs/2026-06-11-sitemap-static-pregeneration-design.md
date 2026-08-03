# 사이트맵 정적 사전생성 설계

- **작성일**: 2026-06-11
- **상태**: 설계 확정 (구현 대기)
- **대상 브랜치**: `feat/sitemap-static-pregeneration` → `develop`

## 1. 배경 & 문제

### 증상
- Google Search Console: `/sitemap.xml` 인덱스는 "성공"(2026-06-03 읽음, 267,782 페이지 발견)으로 뜨지만, **"읽은 사이트맵" 목록이 0행** — 구글이 자식 sitemap을 단 하나도 못 읽고 있음. 마지막 읽은 날짜가 6-03에서 멈춰 8일째 정지.
- 네이버(Yeti)는 색인이 정상 진행 중.

### 원인
현재 자식 sitemap(`/sitemap/[...].xml`)은 **크롤 타임에 DB/API를 타고 동적 생성**된다.
- 부동산은 6개 트랜잭션 테이블 UNION + 빌딩명 필터로 cold 상태에서 8~11초 소요.
- Googlebot이 자식 sitemap 20여 개를 **동시에 fetch**하면 cold UNION 쿼리가 몰려 DB 커넥션 풀/버퍼풀을 압박(notepad의 MySQL 좀비 사건과 동일 메커니즘) → 502/타임아웃 → 구글이 자식들을 포기.
- 캐시(백엔드 모듈 6h, 프론트 in-memory 10min)는 **PM2 reload(배포)마다 소실** → 배포 직후 cold 윈도우가 항상 발생.
- 네이버가 되는 건 보통 더 느리게/순차적으로 크롤하기 때문.

### 본질
**크롤 타임에 DB를 절대 타지 않게 만든다.**

## 2. 현재 구조 (요약)

- `frontend/server/routes/sitemap.xml.ts` — 인덱스. `/api/sitemap/page-counts` 단일 호출(가볍고 통과 잘 됨).
- `frontend/server/routes/sitemap/[...].ts` — 자식 sitemap(카테고리·부동산·구독·지하철·waste 등), 페이지당 10,000 URL 분할.
- `frontend/server/routes/sitemap/static.xml.ts` — 정적/지역 조합 페이지.
- `frontend/server/utils/sitemap.ts` — fetch + in-memory 캐시(10min).
- 캐시 헤더: `nuxt.config.ts` routeRules `'/sitemap.xml'`, `'/sitemap/**'` → `swr: 86400`.
- 백엔드 `/api/sitemap/*` (`sitemapService.ts`) — 6h 모듈 캐시 + 6-테이블 UNION.
- robots.txt → `Sitemap: https://ilsangkit.co.kr/sitemap.xml`.
- 배포: GitHub Actions → Cafe24(`/home/project2`), PM2(`ilsangkit-api` :8000, `ilsangkit-web` :3000), 2 클러스터.
- sync: `.github/workflows/sync-real-estate.yml`(매일 03:00 KST 스케줄, SSH로 서버에서 `node` 스크립트 실행).
- `.output/public/`은 빌드 타임에 구워지고 배포 SCP로 덮임 → 런타임 쓰기 부적합. Nginx 설정은 레포에 없음(서버 관리).

## 3. 설계: 정적 사전생성 + 디스크 서빙

### 3.1 아키텍처 / 데이터 흐름

```
[daily sync (GH Actions 03:00 KST, 서버에서 실행)]
        ↓ sync 완료 후
[generateSitemaps.ts] ──(X-Sitemap-Regen-Token 헤더, 내부 순차 호출)──> 기존 Nitro 동적 라우트
        ↓ 응답을 임시 디렉토리에 저장 (헤더 X-Sitemap-Regen-Token)
   {SITEMAP_DIR}.tmp/*.xml
        ↓ 검증 + 개수 회귀 가드 통과 시 디렉토리 교체(rename)
   {SITEMAP_DIR}/*.xml          ← .output 바깥, 배포에 안 지워짐
        ↑ readFile
[Nitro /sitemap.xml, /sitemap/[...].ts, /sitemap/static.xml]
   ← 파일 있으면 즉시 반환, 없으면 동적 폴백
        ↑
   Googlebot / Yeti(네이버)
```

### 3.2 핵심 결정
1. **생성 주체**: 별도 `generateSitemaps.ts`가 기존 동적 라우트를 `X-Sitemap-Regen-Token` 헤더로 호출 → URL/XML 빌드 로직 **중복 0**.
2. **저장 위치**: `SITEMAP_DIR`(env, 기본 `/home/project2/sitemaps`) — 배포 cleanup·SCP 영향권 밖.
3. **서빙**: Nitro 라우트 디스크 우선, 폴백 동적 — **Nginx 변경 불필요, URL 불변**.

### 3.3 불변 보장 (네이버 회귀 방지)
- URL 구조·파일명·robots.txt **그대로**. 재등록·재제출 불필요.
- XML 내용(`<loc>`/`lastmod`/`changefreq`/`priority`)이 동일 생성 로직 덤프라 **바이트 동일**.
- 모든 실패 모드가 **"오늘의 동적 동작으로 강등"**으로 수렴.
- 선언 URL 개수 불변(같은 카테고리·분할·`SITEMAP_FACILITY_CATEGORY_LIMITS` 적용). 구글에 **전달되는** 개수만 0 → 풀로 회복.

## 4. 변경 명세

### 신규 파일

**`frontend/server/utils/sitemapStatic.ts`**
```typescript
export function getSitemapDir(): string          // SITEMAP_DIR env, 기본 /home/project2/sitemaps
function resolveSitemapFile(path: string): string | null  // 요청 path → 파일 경로, ../ sanitize
export function isRegenRequest(event): boolean    // header X-Sitemap-Regen-Token === SITEMAP_REGEN_TOKEN
export async function tryServeStaticSitemap(event): Promise<boolean>  // 파일 있으면 응답+true, 없으면 false
```
경로 매핑: `/sitemap.xml` → `{DIR}/sitemap.xml`, `/sitemap/toilet.xml` → `{DIR}/sitemap/toilet.xml`.

**`backend/src/scripts/generateSitemaps.ts`**
- `BASE = http://127.0.0.1:3000`, 모든 호출에 헤더 `X-Sitemap-Regen-Token: <SITEMAP_REGEN_TOKEN>`.
- 순서:
  1. `sitemap.xml` GET·저장 → `<loc>` 파싱으로 자식 목록 추출.
  2. 자식들 **순차**(동시성 1) GET·저장 → `{SITEMAP_DIR}.tmp/`.
  3. 각 파일 검증: `<?xml`로 시작, non-empty.
  4. **개수 회귀 가드**: 직전 생성본 파일별 URL 개수(`{SITEMAP_DIR}/.counts.json`)와 비교, 특정 파일이 임계(기본 −20%) 이상 급감하면 **swap 거부 + 경고 로그**.
  5. 통과 시 디렉토리 **rename으로 교체**(기존 유지 + 짧은 교체 창은 동적 폴백), 새 `.counts.json` 기록. `runGeneration`은 실패 시 throw 대신 `{ok:false, error}` 반환.
- 실패 시(HTTP 에러/검증 탈락/가드 거부) **교체 안 함** → 기존 파일 유지.

### 수정 파일

**라우트 3종** — 핸들러 맨 위 6줄 추가, 기존 동적 로직 유지(regen·폴백 겸용):
- `frontend/server/routes/sitemap.xml.ts`
- `frontend/server/routes/sitemap/[...].ts`
- `frontend/server/routes/sitemap/static.xml.ts`
```typescript
if (!isRegenRequest(event)) {
  if (await tryServeStaticSitemap(event)) return  // 디스크 즉시 반환
}
// ↓ 기존 동적 생성 코드 (regen 요청 + 파일 없을 때 폴백)
```

**`frontend/nuxt.config.ts`** — sitemap routeRules `swr: 86400` 제거(또는 단축). 디스크 읽기가 origin이라 SWR 불필요, regen 후 즉시 반영 목적.

**`ecosystem.config.js`** — frontend(reader)·backend(writer) env에 `SITEMAP_DIR`, `SITEMAP_REGEN_TOKEN` 추가.

**`.github/workflows/sync-real-estate.yml`** — sync·워밍 뒤 스텝 추가: `cd backend && node dist/scripts/generateSitemaps.js`.

**`.github/workflows/deploy.yml`** — 워밍 루프 뒤 동일 생성 1회(첫 롤아웃/빈 `SITEMAP_DIR` 대비). GH Secret에 `SITEMAP_REGEN_TOKEN` 등록.

### 건드리지 않는 것
`sitemapService.ts`, `facilityService.getAllIds()`, 백엔드 `/api/sitemap/*` — 동적 폴백·regen이 그대로 사용.

### 보안·안전
- regen은 **HTTP 헤더 `X-Sitemap-Regen-Token` 단일 게이트** → 토큰이 쿼리스트링에 안 실려 nginx/PM2 로그에 노출 안 됨. (loopback은 nginx 프록시가 모든 요청을 127.0.0.1로 보여 무의미하므로 제외.) 외부가 헤더를 흉내내도 토큰 불일치 → 일반 요청 취급(DoS 불가).
- path sanitize로 `../`·null byte·과도한 길이 차단.
- regen 스크립트 **동시성 1 순차** → MySQL 좀비(notepad 사건) 재현 방지.
- 토큰은 **GH Secret + deploy 셸 export**로만 운영 frontend에 주입(ecosystem.config.js는 deploy가 미사용 → 편집 무효). sync workflow의 `set -x` 구간은 토큰 export를 `set +x`로 감쌈.

## 5. 테스트 전략

- **단위 `sitemapStatic.test.ts`**: 파일 있으면 서빙·없으면 false(폴백), `../` sanitize 차단, regen 헤더 게이트 통과/거부.
- **단위 `generateSitemaps.test.ts`**: fetch mock → 자식 파싱, 디렉토리 교체, 개수 회귀 가드(−20% 급감 시 거부), fetch/검증 실패 시 `{ok:false}` + 기존 유지.
- **회귀**: 기존 sitemap 라우트 테스트 전부 통과(폴백 경로 = 옛 동작).
- 백엔드/프론트 `vitest run` 둘 다 커밋 전 필수.
- **로컬 동치 검증**: 동적 출력 vs 디스크 출력 byte-diff로 내용 동일 증명.

## 6. 롤아웃

1. `feat/sitemap-static-pregeneration` 브랜치(Node 20, lock 유지).
2. 로컬 byte-diff 동치 검증.
3. 테스트 통과 → PR → CI green → develop 머지.
4. 배포 시 워밍 뒤 `generateSitemaps.js` 1회 → `SITEMAP_DIR` 채움.
5. 이후 매일 sync 끝에 자동 재생성.

> 파일 생기기 전엔 폴백으로 오늘과 동일, 생긴 뒤부터 빨라짐. 깨질 구간 없음.

### 배포 후 스모크
- `curl -sI https://ilsangkit.co.kr/sitemap/toilet.xml` → 200, `content-type: application/xml`, 응답 200ms 이내.
- `/sitemap.xml` 자식 `<loc>` 개수 = 기대치.
- `.counts.json` 개수 회귀 가드 동작 확인.

## 7. 성공 지표 (GSC, 수일~2주)

- "읽은 사이트맵" 목록 0행 → 채워짐.
- 발견 페이지가 "발견됨(미색인)" → "색인됨"으로 이동 시작.
- 재제출 불필요(URL 불변), GSC 수동 재요청으로 가속 가능.

## 8. 롤백

- 1차: `SITEMAP_DIR` env 해제 → 즉시 전면 동적 폴백(코드 변경 없이).
- 2차: PR revert.
- 어느 쪽이든 오늘의 동작으로 즉시 복귀.

## 9. 가정 · 열린 항목

- 생성 시 프론트 Nitro(:3000)가 가동 중이어야 함 — sync 시점 PM2 상시 가동으로 충족.
- `SITEMAP_REGEN_TOKEN`은 GH Secret + PM2 env 동기화 필요(배포 체크리스트 명시).
- `SITEMAP_DIR`은 backend(writer)·frontend(reader) 양쪽에서 동일 경로 접근 가능해야 함(동일 서버 `/home/project2`).
