# HIRA 병원·약국 파일 자동 다운로드 이관 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 병원·약국 enrichment(상세) 데이터를 수동 xlsx 다운로드에서 HIRA 포털 자동 다운로드로 이관하고(Phase 1), zip 내 미사용 파일 2종(의료장비 CT·MRI, 전문병원 지정분야)을 노출한다(Phase 2).

**Architecture:** basic sync(병원=HIRA API, 약국=E-Gen API)는 그대로 두고, 오늘날 사람이 분기마다 `opendata.hira.or.kr`(sno=11925)에서 받아 로컬에 푸는 62MB zip을 서버가 자동으로 받아 풀도록 신규 `hiraFileDownloader` 서비스를 추가한다. 기존 파서(`seedHospitalDetail`/`seedMedicalEnrich`)를 재사용하고 `syncAll`에 다운로드·상세 스텝을 편입한다. Phase 2는 새 파일 파싱 + 스키마/registry/프론트 확장.

**Tech Stack:** TypeScript(ESM) · Express 5 · Prisma(MySQL) · ExcelJS · adm-zip · iconv-lite · Node global fetch · fast-xml-parser · Vitest · Nuxt 3/Vue 3 · @vue/test-utils

## Global Constraints

- **Node 20 필수.** 의존성 추가/변경은 `nvm use 20 && npm install`만 사용. `package-lock.json`을 삭제 후 재생성 금지(semver 상향으로 native binding 오류 발생). — 단 이 플랜은 **새 의존성이 없다**(`iconv-lite`·`adm-zip` 모두 이미 설치됨).
- **ESM: 모든 로컬 import에 `.js` 확장자 필수** (예: `import prisma from '../lib/prisma.js'`).
- **PR 워크플로우**: 모든 변경은 PR 경유, `develop` 대상, CI green 후 머지. `main` 직접 커밋 금지. 이 플랜은 PR A(Phase 1)/B(의료장비)/C(전문병원)로 분할.
- **커밋 전 테스트**: backend는 `cd backend && npm run test`, frontend는 `cd frontend && npm run test`를 실행해 green 확인. 기존 실패 테스트도 즉시 수정.
- **다운로드 스텝은 fail-soft**: 실패해도 throw는 `syncCategory`가 실패로 기록하되 전체 `syncAll`은 계속. 다운로드 실패 시 기존 로컬 파일·마커·DB 데이터를 절대 삭제/오염하지 않는다.
- **DATA_DIR**: `backend/prisma/data/extra_hospital_latest/` (기존 파서가 읽는 경로, gitignore).
- **`SYNC.BATCH_SIZE` = 100** (`backend/src/constants/index.js` 배럴에서 import).
- **data.go.kr/HIRA 요청은 브라우저 User-Agent 필수**(기본 UA는 WAF 차단).

---

## File Structure

**PR A (Phase 1)**
- Create `backend/src/services/hiraFileDownloader.ts` — 포털 HTML 스크레이프 + DEXT5 다운로드 + CP949 압축해제 + 신선도 게이트 오케스트레이션. 순수 함수(`scrapeLatestFile`, `buildDext5DownloadBody`)를 export해 단위 테스트.
- Create `backend/__tests__/services/hiraFileDownloader.test.ts` — 스크레이퍼·페이로드·게이트 단위 테스트(네트워크 mock).
- Create `backend/__tests__/services/fixtures/hira-portal.html` — 실 포털 HTML 캡처 픽스처.
- Modify `backend/src/scripts/seedHospitalDetail.ts` — top-level `main()` 실행을 `export async function runHospitalDetail()` + `import.meta.url` 가드로 리팩터, 파일 선택에 숫자프리픽스 fallback 추가.
- Modify `backend/src/scripts/syncAll.ts` — `hira-file`·`hospital-detail` 스텝 추가(순서·case).
- Modify `backend/package.json` — `sync:hira-file` npm 스크립트 추가.

**PR B (의료장비)**
- Modify `backend/prisma/schema.prisma` — `model HospitalEquipment` 신규 + `Hospital.equipment` 관계.
- Modify `backend/src/scripts/seedHospitalDetail.ts` — `seedEquipment(ykihoMap)` 추가 + `runHospitalDetail`에서 호출.
- Modify `backend/src/services/facilityService.ts` — `getDetail` include + `toDetail` equipment 매핑.
- Modify `backend/components/facility/detail/DetailFacilityStatus.vue` — 보유 장비 블록.
- Modify tests: `backend/__tests__/scripts/seedHospitalEquipment.test.ts`(신규), `frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts`.

**PR C (전문병원)**
- Modify `backend/prisma/schema.prisma` — `Hospital.specialtyField`.
- Modify `backend/src/scripts/seedHospitalDetail.ts` — `seedSpecialty(ykihoMap)` 추가 + 호출.
- Modify `backend/src/services/categoryRegistry.ts` — hospital `detailFields`에 `'specialtyField'`.
- Modify `frontend/components/facility/detail/DetailBasicInfo.vue` — 전문병원 뱃지.
- Modify tests: `backend/__tests__/scripts/seedHospitalSpecialty.test.ts`(신규), `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`.

---

# PR A — Phase 1: 파일 자동 다운로드 + syncAll 편입

## Task A1: HIRA 포털 스크레이퍼 (최신 fileSno·파일경로·파일명 추출)

**Files:**
- Create: `backend/src/services/hiraFileDownloader.ts`
- Create: `backend/__tests__/services/hiraFileDownloader.test.ts`
- Create: `backend/__tests__/services/fixtures/hira-portal.html`

**Interfaces:**
- Produces: `export interface HiraFileRef { fileSno: string; filePath: string; fileName: string }`
- Produces: `export function scrapeLatestFile(html: string): HiraFileRef | null`

- [ ] **Step 1: 실 포털 HTML 픽스처 캡처**

브라우저 User-Agent로 실제 페이지를 받아 픽스처로 저장한다(스크레이퍼 정규식을 실제 구조에 맞추기 위함).

Run:
```bash
cd backend
curl -sL -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36' \
  'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925' \
  -o __tests__/services/fixtures/hira-portal.html
grep -o "fn_fileDown('[0-9]*')" __tests__/services/fixtures/hira-portal.html | sort -u | tail
grep -o "AddUploadedFile[^;]*" __tests__/services/fixtures/hira-portal.html | head -3
```
Expected: `fn_fileDown('326801')` 등 fileSno 목록과, `DEXT5UPLOAD.AddUploadedFile(...)` 호출에 서버 파일경로(`/shared/data/uploadFiles/file/<UUID>.zip`)와 표시 파일명이 담긴 것을 확인. **이 grep 출력의 실제 인자 순서/따옴표를 보고 Step 3 정규식을 맞춘다.**

- [ ] **Step 2: Write the failing test**

`backend/__tests__/services/hiraFileDownloader.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeLatestFile } from '../../src/services/hiraFileDownloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'fixtures/hira-portal.html'), 'utf-8');

describe('scrapeLatestFile', () => {
  it('가장 큰 fileSno(최신 분기)를 골라 fileSno·filePath·fileName을 추출한다', () => {
    const ref = scrapeLatestFile(html);
    expect(ref).not.toBeNull();
    expect(ref!.fileSno).toMatch(/^\d+$/);
    expect(ref!.filePath).toMatch(/\/shared\/data\/uploadFiles\/file\/.+\.zip$/);
    expect(ref!.fileName).toContain('병의원');
  });

  it('링크가 없으면 null', () => {
    expect(scrapeLatestFile('<html><body>no downloads</body></html>')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts`
Expected: FAIL — `scrapeLatestFile is not a function` (모듈/함수 미존재).

- [ ] **Step 4: Write minimal implementation**

`backend/src/services/hiraFileDownloader.ts` (신규):
```typescript
import 'dotenv/config';

export interface HiraFileRef {
  fileSno: string;
  filePath: string; // /shared/data/uploadFiles/file/<UUID>.zip
  fileName: string; // 표시 파일명 (예: 전국 병의원 및 약국 현황 2026.6.zip)
}

// 포털 HTML에서 전국 병의원 및 약국 현황의 최신 분기(최대 fileSno)를 추출한다.
// Step 1에서 캡처한 실제 HTML 구조에 맞춰 정규식을 조정할 것.
export function scrapeLatestFile(html: string): HiraFileRef | null {
  // 1) fileSno 후보 수집: javascript:fn_fileDown('<digits>')
  const snoMatches = [...html.matchAll(/fn_fileDown\('(\d+)'\)/g)].map((m) => m[1]);
  if (snoMatches.length === 0) return null;

  // 2) 각 fileSno에 매핑된 서버 경로 + 파일명 수집: DEXT5UPLOAD.AddUploadedFile 인자
  //    실제 인자 순서는 Step 1 grep으로 확인해 맞춘다. (경로, 파일명, fileSno 를 포함)
  const refBySno = new Map<string, { filePath: string; fileName: string }>();
  const addRe = /AddUploadedFile\(([^)]*)\)/g;
  for (const m of html.matchAll(addRe)) {
    const args = m[1];
    const pathM = args.match(/(\/shared\/data\/uploadFiles\/file\/[^'"]+\.zip)/);
    const snoM = args.match(/(\d{5,})/g);
    const nameM = args.match(/'([^']*\.zip)'/);
    if (!pathM || !snoM) continue;
    const sno = snoM[snoM.length - 1]; // fileSno가 인자 중 하나로 등장
    refBySno.set(sno, {
      filePath: pathM[1],
      fileName: nameM ? nameM[1] : `${sno}.zip`,
    });
  }

  // 3) 최신 = 최대 fileSno (숫자 비교)
  const latest = snoMatches
    .filter((s) => refBySno.has(s))
    .sort((a, b) => Number(b) - Number(a))[0];
  if (!latest) return null;

  const ref = refBySno.get(latest)!;
  return { fileSno: latest, filePath: ref.filePath, fileName: ref.fileName };
}
```

> 참고: Step 1의 실제 grep 출력에 따라 `AddUploadedFile` 인자 파싱(경로/파일명/fileSno 위치)을 반드시 검증·수정한다. 픽스처 기반 테스트가 이 정규식이 실제 HTML과 맞는지 보장한다.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts`
Expected: PASS (실패 시 Step 4 정규식을 픽스처 실제 구조에 맞게 조정).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/hiraFileDownloader.ts backend/__tests__/services/hiraFileDownloader.test.ts backend/__tests__/services/fixtures/hira-portal.html
git commit -m "feat(sync): HIRA 포털 최신 분기 파일 스크레이퍼 추가"
```

---

## Task A2: DEXT5 다운로드 페이로드 + zip 다운로드

**Files:**
- Modify: `backend/src/services/hiraFileDownloader.ts`
- Modify: `backend/__tests__/services/hiraFileDownloader.test.ts`

**Interfaces:**
- Consumes: `HiraFileRef` (Task A1)
- Produces: `export function buildDext5DownloadBody(ref: HiraFileRef): string` — `customValue=...&d00=...` 폼 바디
- Produces: `export async function downloadHiraZip(ref: HiraFileRef, cookie: string): Promise<Buffer>`

- [ ] **Step 1: 실 다운로드로 d00 프레이밍 확정(그라운드 트루스)**

curl로 세션 쿠키를 얻고, 브라우저가 만드는 `d00`의 정확한 프레이밍(필드 키·구분자·단일/이중 base64)을 확인한다. 검증 조사에서 plain curl로 62MB zip 수신이 실증됐으므로 재현 가능하다.

Run:
```bash
cd backend
# 1) 세션 쿠키 확보
curl -s -c /tmp/hira_cookies.txt -A 'Mozilla/5.0 ... Chrome/125.0 Safari/537.36' \
  'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925' -o /tmp/hira_page.html
# 2) 최신 fileSno + 서버경로 + 파일명 확인
grep -o "fn_fileDown('[0-9]*')" /tmp/hira_page.html | sort -u | tail -1
grep -o "/shared/data/uploadFiles/file/[^'\"]*\.zip" /tmp/hira_page.html | tail -1
```
그런 다음 브라우저 devtools(또는 검증 조사에서 캡처한 값)로 실제 `d00` 문자열을 하나 확보해 base64 디코딩하고, 필드 프레이밍을 기록한다:
```bash
# <captured_d00> 를 실제 캡처값으로 치환
echo '<captured_d00>' | base64 -d | xxd | head -40
```
Expected: 디코드 결과에 `downloadRequest`, 서버경로(`/shared/data/uploadFiles/file/<UUID>.zip`), 파일명(EUC-KR), 토큰 GUID가 `\t`/`\v` 구분자로 담긴 구조 확인. **이 정확한 프레이밍을 Step 3 `buildDext5DownloadBody`에 반영한다.**

- [ ] **Step 2: Write the failing test**

`backend/__tests__/services/hiraFileDownloader.test.ts`에 추가:
```typescript
import { buildDext5DownloadBody, downloadHiraZip } from '../../src/services/hiraFileDownloader.js';

describe('buildDext5DownloadBody', () => {
  it('customValue와 d00을 포함한 폼 바디를 만든다', () => {
    const body = buildDext5DownloadBody({
      fileSno: '326801',
      filePath: '/shared/data/uploadFiles/file/ABCD-1234.zip',
      fileName: '전국 병의원 및 약국 현황 2026.6.zip',
    });
    const params = new URLSearchParams(body);
    expect(params.get('customValue')).toBe('326801');
    const d00 = params.get('d00')!;
    expect(d00.length).toBeGreaterThan(0);
    // d00 디코드 시 서버 경로가 포함되어야 함
    const decoded = Buffer.from(d00, 'base64').toString('binary');
    expect(decoded).toContain('/shared/data/uploadFiles/file/ABCD-1234.zip');
  });
});

describe('downloadHiraZip', () => {
  it('application/zip 응답을 Buffer로 반환한다', async () => {
    const fakeZip = Buffer.from('PKfakezipbody');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/zip' }),
      arrayBuffer: () => Promise.resolve(fakeZip.buffer.slice(0, fakeZip.length)),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;
    const buf = await downloadHiraZip(
      { fileSno: '1', filePath: '/shared/data/uploadFiles/file/x.zip', fileName: 'x.zip' },
      'WMONID=abc; HIRAODSESSION=def',
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/dext5upload/handler/upload.dx'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('content-type이 zip이 아니면 throw', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;
    await expect(
      downloadHiraZip({ fileSno: '1', filePath: '/x.zip', fileName: 'x.zip' }, 'c=1'),
    ).rejects.toThrow();
  });
});
```
파일 상단에 `import { describe, it, expect, vi } from 'vitest';` 가 있어야 한다(없으면 추가; `globals:true`라 없어도 되지만 명시 권장).

- [ ] **Step 3: Write minimal implementation**

`hiraFileDownloader.ts`에 추가(Step 1에서 확정한 프레이밍 반영):
```typescript
import * as iconv from 'iconv-lite';

const HANDLER_URL =
  'https://opendata.hira.or.kr/dext5upload/handler/upload.dx?callType=download&url=/op/opc/selectOpenData.do';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// DEXT5 다운로드 요청 블롭(d00) 구성.
// 프레이밍(필드 키/구분자/인코딩)은 Task A2 Step 1에서 캡처한 실제 값으로 확정한다.
export function buildDext5DownloadBody(ref: HiraFileRef): string {
  const TAB = '\t';
  // 필드: callType, 서버경로(d25), 파일명(d26, EUC-KR), 토큰(d07)
  const fields = [
    `callType${TAB}downloadRequest`,
    `d25${TAB}${ref.filePath}`,
    `d26${TAB}${ref.fileName}`,
    `d07${TAB}${ref.fileSno}`,
  ].join('\v');
  // 파일명이 EUC-KR로 프레이밍되어야 하면 iconv로 인코딩한 버퍼를 base64. (Step 1 결과에 맞춰 조정)
  const d00 = iconv.encode(fields, 'euc-kr').toString('base64');
  const params = new URLSearchParams();
  params.set('customValue', ref.fileSno);
  params.set('d00', d00);
  return params.toString();
}

export async function downloadHiraZip(ref: HiraFileRef, cookie: string): Promise<Buffer> {
  const res = await fetch(HANDLER_URL, {
    method: 'POST',
    headers: {
      'User-Agent': BROWSER_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: buildDext5DownloadBody(ref),
  });
  if (!res.ok) throw new Error(`HIRA download HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('zip') && !ct.includes('octet-stream')) {
    throw new Error(`HIRA download unexpected content-type: ${ct}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000_000) throw new Error(`HIRA zip too small: ${buf.length} bytes`);
  return buf;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts`
Expected: PASS. (다운로드 테스트의 크기 하한 때문에 `fakeZip`이 10MB 미만이면 실패 → 테스트는 content-type 분기·호출 URL만 검증하도록 크기 하한은 실제 다운로드에만 적용됨을 유의; 필요 시 테스트용 buffer를 크게 만들거나 하한을 downloadHiraZip 밖 orchestrator로 옮긴다.)

> 구현 노트: 크기 하한 검증은 mock 테스트를 방해하므로, **하한 검증을 `downloadHiraZip` 대신 Task A4 orchestrator로 옮기는 것을 권장**. 그러면 이 테스트의 `fakeZip`(작은 버퍼)도 통과한다. 위 코드에서 `if (buf.length < 10_000_000)` 줄을 삭제하고 A4에서 검증.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/hiraFileDownloader.ts backend/__tests__/services/hiraFileDownloader.test.ts
git commit -m "feat(sync): DEXT5 다운로드 페이로드 + zip 다운로더"
```

---

## Task A3: CP949 압축해제 to DATA_DIR

**Files:**
- Modify: `backend/src/services/hiraFileDownloader.ts`
- Modify: `backend/__tests__/services/hiraFileDownloader.test.ts`

**Interfaces:**
- Produces: `export function extractZipToDir(zip: Buffer, destDir: string): string[]` — 전개된 파일명 목록 반환(한글 정확 디코딩)

- [ ] **Step 1: Write the failing test**

`hiraFileDownloader.test.ts`에 추가. adm-zip으로 EUC-KR 파일명을 담은 zip을 만들어 라운드트립 검증:
```typescript
import AdmZip from 'adm-zip';
import os from 'os';

describe('extractZipToDir', () => {
  it('CP949 파일명을 정확히 디코딩해 전개한다', () => {
    const zip = new AdmZip();
    // adm-zip은 엔트리명을 raw bytes로 저장 — CP949 바이트로 넣는다
    const cp949Name = iconv.encode('7.의료장비정보.xlsx', 'euc-kr');
    zip.addFile(cp949Name.toString('binary'), Buffer.from('dummy'));
    const buf = zip.toBuffer();

    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'hira-'));
    const names = extractZipToDir(buf, dest);
    expect(names.some((n) => n.normalize('NFC').includes('의료장비'))).toBe(true);
    expect(fs.readdirSync(dest).some((n) => n.normalize('NFC').includes('의료장비'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts -t extractZipToDir`
Expected: FAIL — `extractZipToDir is not a function`.

- [ ] **Step 3: Write minimal implementation**

`hiraFileDownloader.ts`에 추가:
```typescript
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

// zip을 destDir에 전개하되, EUC-KR/CP949로 저장된 엔트리 파일명을 UTF-8로 디코딩한다.
export function extractZipToDir(zip: Buffer, destDir: string): string[] {
  fs.mkdirSync(destDir, { recursive: true });
  const admzip = new AdmZip(zip);
  const written: string[] = [];
  for (const entry of admzip.getEntries()) {
    if (entry.isDirectory) continue;
    // adm-zip의 rawEntryName은 원본 바이트 — CP949로 디코딩
    const raw = entry.rawEntryName; // Buffer
    let name = iconv.decode(raw, 'euc-kr');
    // 이미 UTF-8이면(플래그 11 set) 그대로 사용
    if (name.includes('�')) name = raw.toString('utf-8');
    const base = path.basename(name).normalize('NFC');
    const out = path.join(destDir, base);
    fs.writeFileSync(out, entry.getData());
    written.push(base);
  }
  return written;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts -t extractZipToDir`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/hiraFileDownloader.ts backend/__tests__/services/hiraFileDownloader.test.ts
git commit -m "feat(sync): CP949 파일명 정확 디코딩 zip 전개"
```

---

## Task A4: `ensureLatestHiraFiles()` 오케스트레이션 + 신선도 게이트

**Files:**
- Modify: `backend/src/services/hiraFileDownloader.ts`
- Modify: `backend/__tests__/services/hiraFileDownloader.test.ts`

**Interfaces:**
- Consumes: `scrapeLatestFile`, `downloadHiraZip`, `extractZipToDir`
- Produces: `export async function ensureLatestHiraFiles(): Promise<{ updated: boolean; fileSno?: string }>`
- Produces: `export const DATA_DIR: string`, `export const MARKER_PATH: string`

- [ ] **Step 1: Write the failing test**

게이트 로직(동일 fileSno면 스킵)을 마커 파일로 검증. 네트워크는 mock:
```typescript
import { ensureLatestHiraFiles, MARKER_PATH } from '../../src/services/hiraFileDownloader.js';

describe('ensureLatestHiraFiles freshness gate', () => {
  it('마커 fileSno와 최신이 같으면 다운로드 없이 updated:false', async () => {
    // 최신 fileSno=326801을 반환하도록 포털 GET을 mock, 마커에도 326801 기록
    fs.mkdirSync(path.dirname(MARKER_PATH), { recursive: true });
    fs.writeFileSync(MARKER_PATH, '326801');
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/hira-portal.html'), 'utf-8');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'set-cookie': 'WMONID=x' }),
      text: () => Promise.resolve(html),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;

    const result = await ensureLatestHiraFiles();
    // 최신 fileSno가 마커와 같다는 전제 하에 스킵 (픽스처 최신 fileSno에 맞게 마커값 조정)
    expect(result.updated).toBe(false);
    // 다운로드(POST handler)는 호출되지 않아야 함
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/dext5upload/handler/upload.dx'),
      expect.anything(),
    );
  });
});
```
> 주의: 마커값 `'326801'`은 캡처한 픽스처의 실제 최신 fileSno로 맞춘다.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts -t "freshness gate"`
Expected: FAIL — `ensureLatestHiraFiles is not a function`.

- [ ] **Step 3: Write minimal implementation**

`hiraFileDownloader.ts`에 추가:
```typescript
import { fileURLToPath } from 'url';

const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname2, '../../prisma/data/extra_hospital_latest');
export const MARKER_PATH = path.join(DATA_DIR, '.hira_filesno');
const PORTAL_URL = 'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925';

function readMarker(): string | null {
  try {
    return fs.readFileSync(MARKER_PATH, 'utf-8').trim();
  } catch {
    return null;
  }
}

export async function ensureLatestHiraFiles(): Promise<{ updated: boolean; fileSno?: string }> {
  // 1) 포털 GET → 쿠키 + HTML
  const res = await fetch(PORTAL_URL, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`HIRA portal HTTP ${res.status}`);
  const cookie = (res.headers.get('set-cookie') || '')
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  const html = await res.text();

  const ref = scrapeLatestFile(html);
  if (!ref) throw new Error('HIRA 포털에서 다운로드 파일을 찾지 못했습니다.');

  // 2) 신선도 게이트
  if (readMarker() === ref.fileSno) {
    console.log(`[HIRA] 최신 파일(${ref.fileSno}) 이미 반영됨 — 스킵`);
    return { updated: false, fileSno: ref.fileSno };
  }

  // 3) 다운로드 → 검증 → 전개
  console.log(`[HIRA] 새 분기 파일 다운로드: ${ref.fileName} (fileSno=${ref.fileSno})`);
  const zip = await downloadHiraZip(ref, cookie);
  if (zip.length < 10_000_000) throw new Error(`HIRA zip too small: ${zip.length} bytes`);
  const names = extractZipToDir(zip, DATA_DIR);
  console.log(`[HIRA] 전개 완료: ${names.length}개 파일`);

  // 4) 성공 후에만 마커 갱신
  fs.writeFileSync(MARKER_PATH, ref.fileSno);
  return { updated: true, fileSno: ref.fileSno };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/services/hiraFileDownloader.test.ts`
Expected: PASS (전체 파일).

- [ ] **Step 5: 실 다운로드 스모크(수동, 선택)**

Run:
```bash
cd backend && npx tsx -e "import('./src/services/hiraFileDownloader.js').then(m=>m.ensureLatestHiraFiles()).then(r=>console.log(r))"
```
Expected: 첫 실행 `{ updated: true, fileSno: '<최신>' }` + `extra_hospital_latest/`에 12개 xlsx + `.hira_filesno` 생성. 재실행 시 `{ updated: false }`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/hiraFileDownloader.ts backend/__tests__/services/hiraFileDownloader.test.ts
git commit -m "feat(sync): ensureLatestHiraFiles 오케스트레이션 + 신선도 게이트"
```

---

## Task A5: `seedHospitalDetail` → `runHospitalDetail()` export 리팩터 + 파일선택 하드닝

**Files:**
- Modify: `backend/src/scripts/seedHospitalDetail.ts:332-427`

**Interfaces:**
- Produces: `export async function runHospitalDetail(): Promise<void>`

- [ ] **Step 1: `main()`을 `runHospitalDetail()`로 이름 변경 + export**

`seedHospitalDetail.ts` line 332의 `async function main(): Promise<void> {` 를 다음으로 변경:
```typescript
export async function runHospitalDetail(): Promise<void> {
```
그리고 함수 본문 내 `process.exit(1)` 호출들(파일 없음/디렉토리 없음/매핑 없음 분기, 대략 line 343/344/350-354/360-361/376-378/384-386)을 **throw로 교체**한다. 예:
```typescript
// 변경 전:  console.error(`파일 없음: ${filePath}`); process.exit(1);
// 변경 후:
console.error(`파일 없음: ${filePath}`);
throw new Error(`파일 없음: ${filePath}`);
```
(programmatic 호출 시 프로세스를 죽이면 안 되므로 exit → throw. syncAll의 try/catch가 fail-soft로 받는다.)

- [ ] **Step 2: 파일 선택에 숫자프리픽스 fallback 추가**

line 372-373 을 다음으로 교체(CP949 디코딩 실패에도 견고하게 — 한글 substring 우선, 숫자프리픽스 4./5. fallback):
```typescript
  const detailFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('세부정보'))
    || xlsxFiles.find(f => /(^|\/)4\./.test(path.basename(f)));
  const deptFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('진료과목'))
    || xlsxFiles.find(f => /(^|\/)5\./.test(path.basename(f)));
```

- [ ] **Step 3: top-level 실행을 import.meta.url 가드로 교체**

line 418-427의 unconditional `main().then(...).catch(...)` 블록을 `seedMedicalEnrich.ts`(lines 528-535)와 동일 패턴으로 교체:
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  runHospitalDetail()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('시딩 실패:', error);
      process.exit(1);
    });
}
```

- [ ] **Step 4: 기존 CLI 동작 확인**

Run: `cd backend && npx tsx src/scripts/seedHospitalDetail.ts --file backend/prisma/data/extra_hospital_latest/`
(또는 DATA_DIR에 파일이 있는 상태에서) `npx tsx src/scripts/seedHospitalDetail.ts`
Expected: 기존과 동일하게 세부정보/진료과목 시딩 완료 로그. import.meta.url 가드로 CLI 직접 실행이 그대로 동작.

- [ ] **Step 5: 타입체크 + 커밋**

```bash
cd backend && npx tsc --noEmit
```
Expected: 에러 없음.
```bash
git add backend/src/scripts/seedHospitalDetail.ts
git commit -m "refactor(sync): seedHospitalDetail을 runHospitalDetail() export + import.meta 가드"
```

---

## Task A6: `syncAll` 편입 (hira-file · hospital-detail 스텝)

**Files:**
- Modify: `backend/src/scripts/syncAll.ts:29-31,71,129-156`
- Modify: `backend/package.json` (scripts)

**Interfaces:**
- Consumes: `ensureLatestHiraFiles` (A4), `runHospitalDetail` (A5), `runMedicalEnrich` (기존)

- [ ] **Step 1: import 추가**

`syncAll.ts` line 31 `import { runMedicalEnrich } from './seedMedicalEnrich.js';` 아래에 추가:
```typescript
import { runHospitalDetail } from './seedHospitalDetail.js';
import { ensureLatestHiraFiles } from '../services/hiraFileDownloader.js';
```

- [ ] **Step 2: CATEGORIES 배열에 스텝 추가(순서 중요)**

line 71의 배열에서 `'pharmacy', 'medical-enrich'` 부분을 다음으로 교체 — hospital/pharmacy(ykiho 확보) 다음에 hira-file(파일 준비) → hospital-detail(진료시간/과목) → medical-enrich(병상/간호등급/약사수):
```typescript
const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'hospital', 'pharmacy', 'hira-file', 'hospital-detail', 'medical-enrich', 'parking', 'aed', 'library', 'park', 'school', 'school-geocode', 'school-department', 'school-enrollment', 'market', 'childcare', 'ev-charger', 'sports', 'subway'] as const;
```

- [ ] **Step 3: switch에 case 추가**

line 149-156의 `case 'medical-enrich':` 바로 위에 두 case 추가:
```typescript
      case 'hira-file': {
        const result = await ensureLatestHiraFiles();
        return {
          category,
          success: true,
          count: result.updated ? 1 : 0,
          duration: Date.now() - start,
        };
      }

      case 'hospital-detail': {
        await runHospitalDetail();
        return {
          category,
          success: true,
          duration: Date.now() - start,
        };
      }
```

- [ ] **Step 4: package.json 스크립트 추가**

`backend/package.json`의 scripts에 추가(기존 `seed:hospital-detail` 근처):
```json
"sync:hira-file": "tsx src/scripts/runHiraFile.ts",
```
그리고 `backend/src/scripts/runHiraFile.ts`(신규) 생성:
```typescript
import 'dotenv/config';
import { ensureLatestHiraFiles } from '../services/hiraFileDownloader.js';

ensureLatestHiraFiles()
  .then((r) => {
    console.log('[HIRA] 결과:', r);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[HIRA] 실패:', err);
    process.exit(1);
  });
```

- [ ] **Step 5: 컴파일 + 부분 실행 확인**

Run:
```bash
cd backend && npx tsc --noEmit
npx tsx src/scripts/syncAll.ts --only hira-file
```
Expected: 타입 에러 없음. `--only hira-file`이 다운로드/게이트만 수행(2회 실행 시 2번째는 `updated:false`). fail-soft 확인: DATA_DIR 접근 불가를 강제(예: 잘못된 URL)해도 syncAll 전체가 죽지 않고 해당 스텝만 실패 기록.

- [ ] **Step 6: 전체 테스트 + 커밋**

Run: `cd backend && npm run test && npm run lint`
Expected: green.
```bash
git add backend/src/scripts/syncAll.ts backend/src/scripts/runHiraFile.ts backend/package.json
git commit -m "feat(sync): syncAll에 hira-file·hospital-detail 스텝 편입 + sync:hira-file 스크립트"
```

- [ ] **Step 7: PR A 오픈**

```bash
git push -u origin feat/hira-file-auto-download
gh pr create --base develop --head feat/hira-file-auto-download \
  --title "feat(sync): HIRA 병원·약국 파일 자동 다운로드 이관(Phase 1)" \
  --body "수동 xlsx 다운로드를 opendata.hira.or.kr 자동 다운로드로 이관. 스크레이퍼+DEXT5 다운로드+CP949 전개+신선도 게이트+syncAll 편입(hira-file/hospital-detail 스텝). Playwright 미도입(Node fetch). 배포 후 서버에서 npm run sync:hira-file 라이브 검증 예정."
```
CI green 확인 후 머지. **배포 후 라이브 검증**: 서버에서 `npm run sync:hira-file` → 최신 분기 자동 반영 + 재실행 시 스킵(게이트) 확인.

---

# PR B — Phase 2: 의료장비 (HospitalEquipment)

## Task B1: `HospitalEquipment` 모델 + `Hospital.equipment` 관계

**Files:**
- Modify: `backend/prisma/schema.prisma:968,979-989`

**Interfaces:**
- Produces: Prisma `HospitalEquipment { id, hospitalId, eqpCd, eqpCdNm, eqpCnt }`, `Hospital.equipment`

- [ ] **Step 1: Hospital에 관계 필드 추가**

`schema.prisma` line 968 `departments HospitalDepartment[]` 아래에 추가:
```prisma
  equipment   HospitalEquipment[]
```

- [ ] **Step 2: HospitalEquipment 모델 추가**

`model HospitalDepartment { ... }` 블록(line 989 닫힘) 바로 아래에 추가(HospitalDepartment 미러):
```prisma
// 병원 의료장비 테이블 (1:N — xlsx 파일 7 medicInsttDetailInfo_05)
model HospitalEquipment {
  id         Int      @id @default(autoincrement())
  hospitalId String   @db.VarChar(50)
  hospital   Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  eqpCd      String   @db.VarChar(20)
  eqpCdNm    String   @db.VarChar(100)
  eqpCnt     Int?

  @@unique([hospitalId, eqpCd])
  @@index([hospitalId])
}
```

- [ ] **Step 3: DB 반영 + 클라이언트 재생성**

Run:
```bash
cd backend && nvm use 20
npm run db:push
npm run db:generate
```
Expected: `HospitalEquipment` 테이블 생성, Prisma Client에 `prisma.hospitalEquipment` + `hospital.include({ equipment: true })` 타입 생성. (기존 데이터 무손실 — 신규 테이블/nullable 관계.)

- [ ] **Step 4: 타입체크 + 커밋**

Run: `cd backend && npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): HospitalEquipment 모델 + Hospital.equipment 관계 추가"
```

---

## Task B2: 의료장비 파서 `seedEquipment` + `runHospitalDetail` 연결

**Files:**
- Modify: `backend/src/scripts/seedHospitalDetail.ts`
- Create: `backend/__tests__/scripts/seedHospitalEquipment.test.ts`

**Interfaces:**
- Consumes: `buildYkihoMap` (기존), `findSheet`/`buildColumnMapping`/`rowToObject`/`safeString`/`safeInt` (기존 헬퍼)
- Produces: `seedEquipment(workbook, ykihoMap)` (모듈 내부), `runHospitalDetail`이 파일 7 처리

- [ ] **Step 1: Write the failing test**

`backend/__tests__/scripts/seedHospitalEquipment.test.ts` (신규). ExcelJS로 소형 워크북을 만들어 파서가 `(hospitalId, eqpCd)` upsert 데이터를 만드는지 검증한다. 실 DB 대신 mapping 로직 검증(파서 함수를 export해 테스트):
```typescript
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapEquipmentRows } from '../../src/scripts/seedHospitalDetail.js';

async function makeSheet(rows: string[][]): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('medicInsttDetailInfo_05');
  ws.addRow(['암호화요양기호', '요양기관명', '장비코드', '장비코드명', '장비대수']);
  rows.forEach((r) => ws.addRow(r));
  return ws;
}

describe('mapEquipmentRows', () => {
  it('ykiho→hospitalId 매핑 후 (hospitalId, eqpCd) 레코드 생성', async () => {
    const ws = await makeSheet([
      ['YK1', 'A병원', 'B302', '초음파영상진단기', '2'],
      ['YK2', 'B병원', 'C201', 'CT', '1'],
      ['UNKNOWN', 'C병원', 'D101', 'MRI', '1'],
    ]);
    const ykihoMap = new Map([['YK1', 'hospital-1'], ['YK2', 'hospital-2']]);
    const recs = mapEquipmentRows(ws, ykihoMap);
    expect(recs).toEqual([
      { hospitalId: 'hospital-1', eqpCd: 'B302', eqpCdNm: '초음파영상진단기', eqpCnt: 2 },
      { hospitalId: 'hospital-2', eqpCd: 'C201', eqpCdNm: 'CT', eqpCnt: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/scripts/seedHospitalEquipment.test.ts`
Expected: FAIL — `mapEquipmentRows is not a function`.

- [ ] **Step 3: Write minimal implementation**

`seedHospitalDetail.ts`에 추가. 상단 상수에 시트/컬럼 정의 추가:
```typescript
const EQUIP_SHEET_NAMES = ['medicInsttDetailInfo_05', '의료장비정보'];
const EQUIP_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '장비코드': 'eqpCd',
  '장비코드명': 'eqpCdNm',
  '장비대수': 'eqpCnt',
};
```
순수 매핑 함수(테스트 대상) + DB 시더:
```typescript
export interface EquipmentRecord { hospitalId: string; eqpCd: string; eqpCdNm: string; eqpCnt: number | null }

export function mapEquipmentRows(sheet: ExcelJS.Worksheet, ykihoMap: Map<string, string>): EquipmentRecord[] {
  const mapping = buildColumnMapping(sheet, EQUIP_COLUMN_MAP);
  if (!mapping.size) return [];
  const out: EquipmentRecord[] = [];
  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const obj = rowToObject(sheet.getRow(i), mapping);
    const ykiho = safeString(obj.ykiho);
    if (!ykiho) continue;
    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) continue;
    const eqpCd = safeString(obj.eqpCd);
    const eqpCdNm = safeString(obj.eqpCdNm);
    if (!eqpCd || !eqpCdNm) continue;
    out.push({ hospitalId, eqpCd, eqpCdNm, eqpCnt: safeInt(obj.eqpCnt) });
  }
  return out;
}

async function seedEquipment(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, EQUIP_SHEET_NAMES);
  if (!sheet) { console.log('의료장비 시트를 찾을 수 없습니다.'); return 0; }
  const recs = mapEquipmentRows(sheet, ykihoMap);
  const BATCH_SIZE = SYNC.BATCH_SIZE;
  let upserted = 0;
  for (let i = 0; i < recs.length; i += BATCH_SIZE) {
    const batch = recs.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.hospitalEquipment.upsert({
          where: { hospitalId_eqpCd: { hospitalId: r.hospitalId, eqpCd: r.eqpCd } },
          create: r,
          update: { eqpCdNm: r.eqpCdNm, eqpCnt: r.eqpCnt },
        })
      )
    );
    upserted += batch.length;
  }
  console.log(`의료장비 완료: ${upserted}건 upsert`);
  return upserted;
}
```
`runHospitalDetail()` 안에서 진료과목 처리 뒤에 파일 7 처리를 추가한다(파일 선택은 substring `의료장비` 또는 프리픽스 `7.`):
```typescript
  const equipFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('의료장비'))
    || xlsxFiles.find(f => /(^|\/)7\./.test(path.basename(f)));
  if (equipFile) {
    console.log(`\n의료장비 파일 처리 중: ${path.basename(equipFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(equipFile);
    await seedEquipment(workbook, ykihoMap);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/scripts/seedHospitalEquipment.test.ts`
Expected: PASS.

- [ ] **Step 5: 타입체크 + 커밋**

Run: `cd backend && npx tsc --noEmit`
```bash
git add backend/src/scripts/seedHospitalDetail.ts backend/__tests__/scripts/seedHospitalEquipment.test.ts
git commit -m "feat(sync): 의료장비(파일 7) 파서 seedEquipment + runHospitalDetail 연결"
```

---

## Task B3: backend 상세 응답에 equipment 노출

**Files:**
- Modify: `backend/src/services/facilityService.ts:826,762-767`

**Interfaces:**
- Consumes: Prisma `equipment` 관계 (B1)
- Produces: 상세 응답 `details.equipment: { eqpCdNm, eqpCnt }[]`

- [ ] **Step 1: include에 equipment 추가**

`facilityService.ts`의 `getDetail` 내 hospital 분기(line 825-827):
```typescript
  if (category === 'hospital') {
    findOptions.include = { departments: true, equipment: true };
  }
```

- [ ] **Step 2: toDetail에 equipment 매핑 추가**

`toDetail`의 hospital departments 매핑(line 762-767) 바로 아래에 추가:
```typescript
  if (category === 'hospital' && record.equipment) {
    details.equipment = record.equipment.map((e: { eqpCdNm: string; eqpCnt: number | null }) => ({
      eqpCdNm: e.eqpCdNm,
      eqpCnt: e.eqpCnt,
    }));
  }
```

- [ ] **Step 3: 기존 테스트 + 커밋**

Run: `cd backend && npm run test`
Expected: green (기존 hospital 상세 테스트 무회귀).
```bash
git add backend/src/services/facilityService.ts
git commit -m "feat(api): 병원 상세 응답에 equipment 관계 노출"
```

---

## Task B4: 프론트 "보유 장비" 블록

**Files:**
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue:519,628-667`
- Modify: `frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts`

**Interfaces:**
- Consumes: `facility.details.equipment: { eqpCdNm, eqpCnt }[]`

- [ ] **Step 1: Write the failing test**

`DetailFacilityStatus.test.ts`에 추가(기존 makeFacility·globalConfig 재사용):
```typescript
  it('hospital: 보유 장비 목록을 렌더한다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('hospital', {
          equipment: [{ eqpCdNm: 'CT', eqpCnt: 2 }, { eqpCdNm: 'MRI', eqpCnt: 1 }],
        }),
      },
      global: globalConfig,
    })
    const text = wrapper.text()
    expect(text).toContain('보유 장비')
    expect(text).toContain('CT')
    expect(text).toContain('MRI')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailFacilityStatus.test.ts -t "보유 장비"`
Expected: FAIL — 텍스트 '보유 장비' 없음.

- [ ] **Step 3: computed 추가 (script setup)**

`DetailFacilityStatus.vue` `<script setup>`에 `hospitalDeptBadges`(line 563-569) 아래 추가:
```typescript
const hospitalEquipRows = computed(() => {
  const eq = details.value?.equipment as Array<{ eqpCdNm: string; eqpCnt?: number | null }> | undefined
  return (eq || []).map(e => ({
    label: e.eqpCdNm,
    value: e.eqpCnt != null ? `${e.eqpCnt}대` : '보유',
  }))
})
```

- [ ] **Step 4: 템플릿 블록 추가**

hospital 진료과목 블록(line 515-519) 아래에 추가(병상 블록과 동일 2열 스타일):
```vue
        <!-- Hospital Equipment -->
        <div v-if="hospitalEquipRows.length > 0" class="mt-5 border-t border-slate-100 pt-5">
          <h3 class="text-sm font-bold text-slate-900 mb-3">보유 장비</h3>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div v-for="row in hospitalEquipRows" :key="row.label" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ row.label }}</span>
              <span class="text-sm font-medium text-slate-900">{{ row.value }}</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailFacilityStatus.test.ts`
Expected: PASS.

- [ ] **Step 6: 전체 테스트 + 커밋 + PR B**

Run: `cd frontend && npm run test && npm run lint`
```bash
git add frontend/components/facility/detail/DetailFacilityStatus.vue frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts
git commit -m "feat(ui): 병원 상세 '보유 장비'(CT·MRI) 블록"
git push -u origin feat/hira-hospital-equipment
gh pr create --base develop --head feat/hira-hospital-equipment \
  --title "feat: 병원 의료장비(CT·MRI) 풍부화(Phase 2)" \
  --body "HospitalEquipment 테이블 + 파일 7 파서 + 상세 응답/보유 장비 블록. db push 필요."
```
CI green 후 머지. 배포 후 라이브: 장비 있는 병원 상세 SSR HTML에 '보유 장비' 노출 확인.

---

# PR C — Phase 2: 전문병원 지정분야 (specialtyField)

## Task C1: `Hospital.specialtyField` 컬럼

**Files:**
- Modify: `backend/prisma/schema.prisma` (Hospital 스칼라 필드 블록)

- [ ] **Step 1: 필드 추가**

`schema.prisma` Hospital의 `nurseGrade String? @db.VarChar(10)`(line 112 부근) 아래에 추가:
```prisma
  // 전문병원 지정분야 (xlsx 파일 11 — medicInsttDetailInfo_09, 보건복지부 지정)
  specialtyField String? @db.VarChar(100)
```

- [ ] **Step 2: DB 반영 + 커밋**

Run:
```bash
cd backend && nvm use 20 && npm run db:push && npm run db:generate && npx tsc --noEmit
```
Expected: `specialtyField` 컬럼 추가, 타입 에러 없음.
```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): Hospital.specialtyField(전문병원 지정분야) 추가"
```

---

## Task C2: 전문병원 파서 `seedSpecialty` + 연결

**Files:**
- Modify: `backend/src/scripts/seedHospitalDetail.ts`
- Create: `backend/__tests__/scripts/seedHospitalSpecialty.test.ts`

**Interfaces:**
- Produces: `mapSpecialtyRows(sheet, ykihoMap): { hospitalId, specialtyField }[]`, `seedSpecialty` DB 시더

- [ ] **Step 1: Write the failing test**

`backend/__tests__/scripts/seedHospitalSpecialty.test.ts` (신규). 파일 11은 리치텍스트 셀이 있을 수 있으므로 `rowToObject`(readCell 처리)를 신뢰:
```typescript
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapSpecialtyRows } from '../../src/scripts/seedHospitalDetail.js';

describe('mapSpecialtyRows', () => {
  it('ykiho→hospitalId 매핑 후 지정분야명을 뽑는다(동일 병원 다분야는 콤마 조인)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('medicInsttDetailInfo_09');
    ws.addRow(['암호화요양기호', '요양기관명', '검색코드', '검색코드명']);
    ws.addRow(['YK1', 'A병원', '50', '척추']);
    ws.addRow(['YK1', 'A병원', '43', '관절']);
    ws.addRow(['UNK', 'B병원', '38', '안과']);
    const ykihoMap = new Map([['YK1', 'hospital-1']]);
    const recs = mapSpecialtyRows(ws, ykihoMap);
    expect(recs).toEqual([{ hospitalId: 'hospital-1', specialtyField: '척추, 관절' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/scripts/seedHospitalSpecialty.test.ts`
Expected: FAIL — `mapSpecialtyRows is not a function`.

- [ ] **Step 3: Write minimal implementation**

`seedHospitalDetail.ts` 상수 추가:
```typescript
const SPECIALTY_SHEET_NAMES = ['medicInsttDetailInfo_09', '전문병원지정분야'];
const SPECIALTY_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '검색코드명': 'specialtyField',
};
```
매핑 함수 + 시더:
```typescript
export interface SpecialtyRecord { hospitalId: string; specialtyField: string }

export function mapSpecialtyRows(sheet: ExcelJS.Worksheet, ykihoMap: Map<string, string>): SpecialtyRecord[] {
  const mapping = buildColumnMapping(sheet, SPECIALTY_COLUMN_MAP);
  if (!mapping.size) return [];
  const byHospital = new Map<string, string[]>();
  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const obj = rowToObject(sheet.getRow(i), mapping);
    const ykiho = safeString(obj.ykiho);
    if (!ykiho) continue;
    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) continue;
    const field = safeString(obj.specialtyField);
    if (!field) continue;
    const arr = byHospital.get(hospitalId) ?? [];
    if (!arr.includes(field)) arr.push(field);
    byHospital.set(hospitalId, arr);
  }
  return [...byHospital.entries()].map(([hospitalId, fields]) => ({
    hospitalId,
    specialtyField: fields.join(', '),
  }));
}

async function seedSpecialty(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, SPECIALTY_SHEET_NAMES);
  if (!sheet) { console.log('전문병원지정 시트를 찾을 수 없습니다.'); return 0; }
  const recs = mapSpecialtyRows(sheet, ykihoMap);
  for (const r of recs) {
    await prisma.hospital.update({ where: { id: r.hospitalId }, data: { specialtyField: r.specialtyField } });
  }
  console.log(`전문병원지정 완료: ${recs.length}건`);
  return recs.length;
}
```
`runHospitalDetail()`의 equipment 처리 뒤에 파일 11 처리 추가:
```typescript
  const specialtyFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('전문병원'))
    || xlsxFiles.find(f => /(^|\/)11\./.test(path.basename(f)));
  if (specialtyFile) {
    console.log(`\n전문병원지정 파일 처리 중: ${path.basename(specialtyFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(specialtyFile);
    await seedSpecialty(workbook, ykihoMap);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/scripts/seedHospitalSpecialty.test.ts`
Expected: PASS.

- [ ] **Step 5: 타입체크 + 커밋**

```bash
cd backend && npx tsc --noEmit
git add backend/src/scripts/seedHospitalDetail.ts backend/__tests__/scripts/seedHospitalSpecialty.test.ts
git commit -m "feat(sync): 전문병원지정(파일 11) 파서 seedSpecialty + 연결"
```

---

## Task C3: registry에 specialtyField 노출

**Files:**
- Modify: `backend/src/services/categoryRegistry.ts:56-63` (hospital detailFields)

- [ ] **Step 1: detailFields에 추가**

hospital `detailFields` 배열 끝(`'isolationBeds', 'sterileBeds'` 뒤)에 `'specialtyField'` 추가:
```typescript
      'isolationBeds', 'sterileBeds', 'specialtyField'],
```

- [ ] **Step 2: 기존 테스트 + 커밋**

Run: `cd backend && npm run test`
Expected: green. (getDetail이 select 없이 findUnique하므로 스칼라는 자동 조회 — detailFields에 추가하면 응답 details에 포함됨.)
```bash
git add backend/src/services/categoryRegistry.ts
git commit -m "feat(api): 병원 상세 detailFields에 specialtyField 노출"
```

---

## Task C4: 프론트 "보건복지부 지정 전문병원" 뱃지

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue:336`
- Modify: `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`

**Interfaces:**
- Consumes: `facility.details.specialtyField: string`

- [ ] **Step 1: Write the failing test**

`DetailBasicInfo.test.ts`에 추가(기존 makeFacility·baseProps·useAnalytics mock 재사용):
```typescript
  it('hospital: specialtyField 있으면 전문병원 뱃지를 렌더', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('hospital', { specialtyField: '관절', clCdNm: '병원' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    const text = wrapper.text()
    expect(text).toContain('전문병원')
    expect(text).toContain('관절')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts -t "전문병원 뱃지"`
Expected: FAIL — '전문병원' 텍스트 없음.

- [ ] **Step 3: 템플릿 뱃지 추가**

`DetailBasicInfo.vue` hospital 섹션 시작(line 336 `<template v-if="facility.category === 'hospital'">` 직후)에 추가(종별 pill 스타일 클론):
```vue
        <template v-if="details?.specialtyField">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">보건복지부 지정 전문병원</span>
            <span class="text-sm font-medium text-slate-900">{{ details.specialtyField }}</span>
          </div>
        </template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts`
Expected: PASS.

- [ ] **Step 5: 전체 테스트 + 커밋 + PR C**

Run: `cd frontend && npm run test && npm run lint`
```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/tests/components/facility/detail/DetailBasicInfo.test.ts
git commit -m "feat(ui): 병원 상세 '보건복지부 지정 전문병원' 뱃지"
git push -u origin feat/hira-specialty-hospital
gh pr create --base develop --head feat/hira-specialty-hospital \
  --title "feat: 전문병원 지정분야 뱃지 풍부화(Phase 2)" \
  --body "Hospital.specialtyField + 파일 11 파서 + detailFields + 뱃지. db push 필요."
```
CI green 후 머지. 배포 후 라이브: 전문병원(예: 척추/관절) 상세 SSR HTML에 뱃지 노출 확인.

---

## 배포 & 라이브 검증 (전 PR 공통)

각 PR 머지 후 main 승격 → Cafe24 배포(Deploy 워크플로우) → `prisma db push` 반영. 배포 후:
1. 서버에서 `cd /path/backend && npm run sync:hira-file` → 최신 분기 자동 다운로드+전개, `.hira_filesno` 생성, 재실행 시 `updated:false`.
2. `npm run sync:facilities -- --only hospital,pharmacy,hira-file,hospital-detail,medical-enrich` → enrichment 무인 실행 확인.
3. 장비 있는 병원 상세 페이지 SSR HTML에 '보유 장비', 전문병원 상세에 뱃지 노출(curl + 브라우저 UA, nginx 캐시 우회 cache-bust).

---

## Self-Review

**1. Spec coverage:**
- 다운로더(스크레이프·DEXT5·CP949·게이트·fail-soft) → Task A1–A4 ✅
- seedHospitalDetail export 리팩터 → A5 ✅
- syncAll 편입(hira-file·hospital-detail 순서) → A6 ✅
- HospitalEquipment(파일 7) + 상세/프론트 → B1–B4 ✅
- Hospital.specialtyField(파일 11) + registry/프론트 → C1–C4 ✅
- 안 바뀌는 것(basic sync·약국 E-Gen·ykiho 매칭) → 손대지 않음(플랜에 태스크 없음 = 무변경) ✅
- 비목표(특수진료·교통·식대가산) → 태스크 없음 ✅

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. 단 Task A1/A2는 **실 HTML/`d00` 그라운드 트루스 캡처 스텝**을 명시(플레이스홀더 아님 — 구체 curl 명령 + 픽스처 기반 테스트로 검증). DEXT5 `d00` 프레이밍은 캡처값에 맞춰 조정하는 지점이 명확히 표기됨.

**3. Type consistency:** `HiraFileRef`(A1) → A2/A4에서 동일 필드 사용. `ensureLatestHiraFiles`/`runHospitalDetail`(A4/A5) → A6에서 동일 시그니처 호출. `mapEquipmentRows`→`EquipmentRecord`(eqpCd/eqpCdNm/eqpCnt) 스키마(B1)·프론트(eqpCdNm/eqpCnt, B4) 일치. `specialtyField`(C1)·registry(C3)·프론트(C4) 일치. `hospitalEquipRows`/`hospitalEquipBadges` — B4에서 `hospitalEquipRows`로 통일(2열 스타일). ✅

**알려진 리스크(스펙 §6과 동일):** DEXT5 다운로드가 포털 변경에 취약 → A1/A2의 캡처-검증 스텝 + fail-soft로 완화. 최후수단은 헤드리스 대체(스펙 §3.1a).
