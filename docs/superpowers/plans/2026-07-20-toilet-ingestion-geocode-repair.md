# 화장실(toilet) 수집 복구 + 지오코딩 (워크스트림 B) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 새 화장실 표준데이터 CSV에서 좌표 컬럼이 사라져 `transformToiletRow`가 전량 null을 반환하던 수집 중단을 복구한다. 좌표 없이 저장하고 주소로 지오코딩하며, **기존 색인 URL(`/toilet/{id}`)을 보존**한다.

**Architecture:** toilet은 CSV 기반(EUC-KR, 한글 헤더). `syncToilets`←`parseToiletCSV`→`transformToiletRow`(csvParser.ts)→`batchUpsertRaw`(sourceId 키). URL id = `toilet-{sourceId}`이고 현재 sourceId=`MD5(name-lat-lng)`(좌표 기반)이라 좌표 소실 시 id가 바뀜. 해법: sourceId를 **개방자치단체코드+관리번호**(정부 안정키) 기반으로 바꾸고, 기존 행을 name+도로명주소로 매칭해 **sourceId만 새 키로 갱신·id 유지**(URL 불변). 좌표는 지오코딩으로 채운다.

**Tech Stack:** TS(ESM), Prisma, vitest, Kakao 지오코딩(geocodeSchool 패턴).

## Global Constraints

- Node 20. package-lock 재생성 금지. ESM `.js`. PR→develop, self-merge 금지.
- toilet은 **한글 CSV 헤더 유지**(TN 영문 API 아님) — 필드 키 변경 아님. 바꾸는 건 (1) 좌표 필수→옵션, (2) sourceId 방식, (3) 지오코딩 추가.
- **URL 보존 최우선**: 기존 행 id는 절대 안 바꾼다. 매칭된 기존 행은 sourceId만 갱신, id 유지(=`id != toilet-{sourceId}` 허용, id는 불투명 PK).
- 새 toilet sourceId = `MD5('toilet-'+개방자치단체코드+'-'+관리번호).substring(0,16)`. id(신규 행) = `toilet-{sourceId}`.
- name/도로명주소/city/district 없으면 여전히 null 반환(스킵). 좌표만 옵션화.
- 지오코딩은 `WHERE lat IS NULL` 배치, 기존 geocode 스크립트 레이트리밋 패턴 재사용.

## Tasks

### Task 1: transformToiletRow 좌표 옵션화 + sourceId 안정키

**Files:**
- Modify: `src/services/csvParser.ts` — `ToiletCSVRow`(interface), `transformToiletRow`(~L400), 신규 `generateToiletSourceId(govCode, mngNo)` 헬퍼
- Test: `__tests__/services/csvParser.toilet.test.ts` (신규)

**Interfaces:** `transformToiletRow(row: ToiletCSVRow): TransformedToilet | null` 반환 형태 불변.

- [ ] **Step 1: 실패 테스트 작성** — 좌표 없는 CSV 행(WGS84위도/경도 부재, 개방자치단체코드+관리번호 있음)이 **저장됨**(null 아님)·lat/lng=null·sourceId가 관리번호 기반임을 검증. + 좌표 있는 행은 좌표 유지 검증.

```ts
import { describe, it, expect } from 'vitest';
import { transformToiletRow } from '../csvParser.js';

const noCoord = {
  '화장실명': '중앙공원 화장실', '소재지도로명주소': '경기도 수원시 팔달구 중부대로 1',
  '소재지지번주소': '경기도 수원시 팔달구 매교동 1', '개방자치단체코드': '3740000', '관리번호': '3740000-1',
} as any; // WGS84위도/경도 없음

describe('transformToiletRow 좌표 옵션화', () => {
  it('좌표 없어도 저장하고 lat/lng=null', () => {
    const r = transformToiletRow(noCoord);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeNull();
    expect(r!.lng).toBeNull();
    expect(r!.city).toBe('경기');
    expect(r!.district).toBe('수원시');
    // sourceId/id가 좌표 아닌 관리번호 기반 → 동일 입력 재실행 시 안정
    expect(r!.id).toBe(transformToiletRow(noCoord)!.id);
  });
  it('좌표 있으면 유지', () => {
    const r = transformToiletRow({ ...noCoord, 'WGS84위도': '37.28', 'WGS84경도': '127.01' });
    expect(r!.lat).toBeCloseTo(37.28, 2); expect(r!.lng).toBeCloseTo(127.01, 2);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run __tests__/services/csvParser.toilet.test.ts` → 현재 `if(isNaN)return null`로 null 반환 FAIL
- [ ] **Step 3: 구현**
  - `ToiletCSVRow`에 `'관리번호'?: string` 추가(개방자치단체코드는 이미 있음).
  - 신규 `function generateToiletSourceId(govCode: string, mngNo: string): string { return createHash('md5').update(`toilet-${govCode}-${mngNo}`).digest('hex').substring(0,16); }`
  - `transformToiletRow`: 좌표 파싱 후 **`isNaN`이면 return null 대신 lat/lng=null 처리**(clothes/parking의 hasValidCoords 패턴). name/주소/city/district 검증은 유지. sourceId = `generateToiletSourceId(row['개방자치단체코드']||'', row['관리번호']||'')` (관리번호 없으면 기존 `generateSourceId(name, road, jibun)` 폴백). id = `toilet-{sourceId}`.
- [ ] **Step 4: 통과 확인** + `npx vitest run __tests__/services/csvParser.test.ts` 회귀 확인 + `npx tsc --noEmit` clean
- [ ] **Step 5: 커밋** — `fix(toilet): 좌표 옵션화 + sourceId 관리번호 기반`

### Task 2: 기존 행 sourceId 리매핑 마이그레이션 스크립트 (URL 보존)

**Files:** Create `src/scripts/remapToiletSourceIds.ts` (dry-run 기본 + `--apply`)

**목적:** 기존 DB toilet 행을 새 CSV에 name+도로명주소로 매칭 → 그 CSV 행의 신 sourceId를 계산 → **기존 행의 sourceId만 UPDATE, id 유지**. 그래야 고친 sync가 sourceId로 매칭→인-플레이스 업데이트→URL 불변.

- [ ] **Step 1: 스크립트 작성**
  - CSV(`prisma/data/toilet.csv`, EUC-KR) 파싱(기존 `parseToiletCSV` 재사용) → `Map<name|roadAddress, {govCode,mngNo}>` 구축. **name+roadAddress 중복 키는 제외**(ambiguous — 매칭 스킵).
  - 기존 `Toilet` 전 행 조회(id, name, roadAddress, sourceId). 각 행의 `name|roadAddress`로 맵 조회 → 있으면 `newSourceId=generateToiletSourceId(...)`. 이미 그 값이면 스킵.
  - **충돌 가드**: newSourceId가 다른 기존 행에 이미 존재하면 스킵(unique 위반 방지).
  - dry-run: 매칭/미매칭/충돌/변경예정 카운트 출력. `--apply`: 배치 UPDATE(id 불변, sourceId만).
- [ ] **Step 2: 로컬/드라이런 검증** — 카운트 리포트가 합리적인지(매칭률, 충돌 소수). 단위테스트 or dry-run 로그.
- [ ] **Step 3: 커밋** — `feat(toilet): sourceId 리매핑 마이그레이션(URL 보존)`

*운영 실행은 배포 후 op: dry-run→apply→고친 sync→geocode 순.*

### Task 3: geocodeToilets 스크립트 + syncAll 단계

**Files:** Create `src/scripts/geocodeToilets.ts` (geocodeSchool 미러); Modify `src/scripts/syncAll.ts`(CATEGORIES에 `toilet-geocode` 추가 + case), `package.json`(`sync:toilet:geocode`)

- [ ] **Step 1: geocodeToilets 작성** — `Toilet WHERE lat IS NULL` 조회 → roadAddress(없으면 address)로 Kakao 주소검색(geocodeSchool의 searchByAddress/searchByKeyword 패턴·레이트리밋·재시도 재사용) → lat/lng UPDATE. 실패는 스킵(다음 실행 재시도). 반환 `{total, updated, failed}`.
- [ ] **Step 2: syncAll 배선** — `CATEGORIES`에 `'toilet-geocode'` 추가, `case 'toilet-geocode': { const r = await geocodeToilets(); ... }`. `toilet` 직후 순서 권장.
- [ ] **Step 3: 테스트/타입** — `npx tsc --noEmit` clean. 지오코딩은 외부 API라 단위테스트는 로직 경계만(선택).
- [ ] **Step 4: 커밋** — `feat(toilet): geocodeToilets + syncAll 단계`

### Task 4: 전체 검증 + PR

- [ ] **Step 1: 전체 테스트** — `npm run test` green, `npm run lint`, `tsc` 0
- [ ] **Step 2: PR 생성** — develop 대상. 본문에 운영 실행 순서 명시: (1) 배포 (2) `remapToiletSourceIds --apply`(dry-run 확인 후) (3) toilet 재sync (4) `geocodeToilets` (5) 검증(newRecords>0·매칭 행 id/URL 불변·좌표 채움률).

## Self-Review 체크

- 좌표 없는 행이 저장되는가(null 반환 안 함). sourceId가 좌표 비의존(관리번호)인가. 기존 행 id는 마이그레이션에서 안 바뀌는가(sourceId만). name+주소 중복·sourceId 충돌 스킵 가드 있는가. geocodeToilets가 `lat IS NULL`만 대상인가. syncAll 배선 정확한가.

## 리스크

- **name+도로명주소 매칭 불완전(~96%)** → 미매칭 기존 행은 sync가 안 건드려 stale 잔존(옛 URL 유지·데이터 옛것) + 신규 id로 새 행 생성 가능(중복). 마이그레이션 리포트로 미매칭 규모 파악 후 필요시 후속 정리. **프로퍼 CSV 파서로 매칭률 재측정**(콤마-인용부호).
- 지오코딩 5.3만 행 → Kakao 레이트리밋·시간(기존 geocode 패턴이 감당). per-run 상한/재개 고려.
- sourceId 충돌(관리번호 비유일 소수) → 스킵 가드로 unique 위반 방지, 스킵분은 새 id.
