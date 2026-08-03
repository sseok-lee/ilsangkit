# 오늘의 이슈(/article) — Phase 2a: 어드민 백엔드 (인증 + 어드민 API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘의 이슈 어드민의 **백엔드**를 구축한다 — 불투명 DB 세션 인증(로그인/로그아웃/세션검증, 계정 잠금, 로그인 전용 레이트리밋, sanitize 예외, CSRF), 어드민 Article API(초안 포함 목록·조회·편집·발행·발행취소·반려·삭제), 그리고 안전한 생성 트리거(단일-플라이트 + 검증된 spawn). 공개 라우트·프론트 UI는 Phase 2b/3.

**Architecture:** 신규 `backend/src/routes/admin.ts` 라우터를 `/api/admin`에 마운트. 인증은 랜덤 토큰(쿠키) ↔ `sha256(token)`을 PK로 저장하는 `AdminSession` 테이블(불투명 세션, 진짜 revocable). 브루트포스는 **DB 기반 계정 잠금**(`AdminLoginThrottle`, PM2 2-인스턴스에서 cluster-safe) + loopback 스킵 없는 로그인 전용 리미터. 어드민 라우트는 글로벌 `sanitizeInput`에서 제외(비밀번호·마크다운 훼손 방지). 생성 트리거는 `ArticleGenerationLock` 단일-플라이트 + `process.execPath` detached spawn.

**Tech Stack:** Express 5(ESM), Prisma/MySQL, `bcryptjs`(설치됨), `cookie-parser`(신규), node `crypto`(내장), `express-rate-limit`(설치됨), Zod, Vitest + `supertest`(설치됨).

## Global Constraints

- **Node 20 필수** — 모든 `npm`/`npx`/`vitest`/`db:push` 전에 `source ~/.nvm/nvm.sh && nvm use 20`. 시스템 기본 v25.5.0.
- **package-lock.json 삭제·재생성 금지.** 신규 의존성은 `cookie-parser`(+`@types/cookie-parser`) 하나뿐 — Node 20에서 기존 lock 유지한 채 `npm install cookie-parser @types/cookie-parser`.
- **ESM**: 모든 로컬 import `.js` 확장자.
- **비밀번호는 어떤 sanitizer도 통과 금지.** 어드민 라우트(`/api/admin`)는 글로벌 `sanitizeInput`에서 제외.
- **불투명 DB 세션**(JWT 아님). 쿠키엔 랜덤 토큰만, DB엔 `sha256(token)` 저장. 로그아웃=DB 행 삭제(진짜 revoke).
- **쿠키 플래그**: `httpOnly:true`, `secure: NODE_ENV==='production'`, `sameSite:'strict'`, `path:'/'`, Domain 미설정(host-scoped).
- **fail-closed**: `ADMIN_PASSWORD_HASH` 미설정 시 로그인은 503(우회 금지).
- **로그인 레이트리밋은 기존 `globalRateLimiter`/`rateLimit.ts`의 loopback-skip 리미터 재사용 금지** — prod 백엔드가 loopback 바인딩이라 무력화됨. 전용 리미터(스킵 없음) + DB 계정 잠금.
- **CSRF**: 상태 변경 어드민 라우트에 Origin/Referer allowlist 검사(SameSite=Strict는 방어심화).
- **Article 발행 상태**: publish만 `status='published'`+`publishedAt=now()`(최초 1회). draft/rejected는 publishedAt=null 유지.
- 에러는 에러 클래스 throw(`NotFoundError`/`ValidationError`/`ConflictError`) → 글로벌 핸들러가 `{success:false,error:{code,message,requestId}}`로 포맷. 라우트는 `asyncHandler`로 래핑, Zod는 `validate`.
- 환경변수(`ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_TTL_HOURS`)는 서버 `.env`(배포 시크릿), 레포 커밋 금지. `.env.example`엔 키 이름만.

---

## File Structure

- **Modify** `backend/prisma/schema.prisma` — `AdminSession`, `AdminLoginThrottle`, `ArticleGenerationLock` 모델 추가.
- **Create** `backend/src/config/adminConfig.ts` — 어드민 env 읽기 + fail-closed 헬퍼.
- **Create** `backend/src/services/adminSessionService.ts` — 세션 생성/검증/폐기(토큰 해시).
- **Create** `backend/src/services/adminThrottleService.ts` — 로그인 실패 기록/잠금 판정.
- **Create** `backend/src/services/adminArticleService.ts` — 어드민 Article CRUD(초안 포함).
- **Create** `backend/src/middlewares/adminAuth.ts` — `requireAdmin`, `requireSameOrigin`, `adminLoginRateLimiter`.
- **Create** `backend/src/routes/admin.ts` — `/api/admin` 라우터(login/logout/session + articles CRUD + generate).
- **Create** `backend/src/schemas/admin.ts` — Zod 스키마(login/patch/list/generate).
- **Create** `backend/src/lib/articleGenerationLock.ts` — 단일-플라이트 락 acquire/release.
- **Modify** `backend/src/middlewares/security.ts` — `sanitizeInput`이 `/api/admin` 스킵.
- **Modify** `backend/src/app.ts` — `cookie-parser` + `/api/admin` 라우터 마운트.
- **Modify** `backend/.env.example` — 어드민 env 키 이름 추가.
- **Create** `backend/__tests__/**` — 각 서비스/미들웨어/라우트 테스트.

---

## Task 1: 어드민 설정 모듈 + cookie-parser + sanitize 예외

**Files:** Create `backend/src/config/adminConfig.ts`; Modify `backend/src/middlewares/security.ts`, `backend/src/app.ts`, `backend/.env.example`, `backend/package.json`(dep).

**Interfaces — Produces:** `getAdminPasswordHash():string|null`, `isAdminConfigured():boolean`, `SESSION_COOKIE_NAME='admin_session'`, `getSessionTtlMs():number`.

- [ ] **Step 1: cookie-parser 설치 (Node 20)**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd backend && npm install cookie-parser @types/cookie-parser
```
Expected: `cookie-parser` dependencies에 추가, lock 갱신(삭제·재생성 아님). 다른 패키지 버전 변동 없어야 함.

- [ ] **Step 2: `adminConfig.ts` 작성**

```ts
// 어드민 인증 설정 (env 단일 소스, fail-closed)
export const SESSION_COOKIE_NAME = 'admin_session';

export function getAdminPasswordHash(): string | null {
  const h = process.env.ADMIN_PASSWORD_HASH;
  return h && h.trim().length > 0 ? h : null;
}

export function isAdminConfigured(): boolean {
  return getAdminPasswordHash() !== null;
}

export function getSessionTtlMs(): number {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? '12');
  const safe = Number.isFinite(hours) && hours > 0 ? Math.min(168, hours) : 12;
  return safe * 60 * 60 * 1000;
}
```

- [ ] **Step 3: `sanitizeInput`이 `/api/admin` 스킵**

`backend/src/middlewares/security.ts`의 `sanitizeInput` 함수 본문 맨 앞에 추가:
```ts
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // 어드민 라우트는 제외: 비밀번호(bcrypt 비교 대상)·마크다운 본문(< 포함)이 DOMPurify로 훼손되면 안 됨.
  if (req.path.startsWith('/api/admin')) {
    next();
    return;
  }
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}
```

- [ ] **Step 4: `app.ts`에 cookie-parser 추가**

`backend/src/app.ts`에서 import 추가(상단):
```ts
import cookieParser from 'cookie-parser';
```
`app.use(express.urlencoded({ extended: true }));`(line 41) 다음, `app.use(sanitizeInput);`(line 42) 앞에 삽입:
```ts
app.use(cookieParser());
```
(어드민 라우터 마운트는 Task 4에서.)

- [ ] **Step 5: `.env.example`에 키 추가**

`backend/.env.example` 끝에 추가:
```
# 어드민 (오늘의 이슈 발행) — 실제 값은 서버 .env, 커밋 금지
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_TTL_HOURS=12
```

- [ ] **Step 6: 타입체크·린트**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && cd backend && npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
cd backend && git add package.json package-lock.json src/config/adminConfig.ts src/middlewares/security.ts src/app.ts .env.example
git commit -m "feat(admin): 어드민 설정 모듈 + cookie-parser + sanitize 예외(/api/admin)"
```

---

## Task 2: 어드민 스키마 (AdminSession · AdminLoginThrottle)

**Files:** Modify `backend/prisma/schema.prisma`.

**Interfaces — Produces:** `prisma.adminSession`(id=토큰 sha256, expiresAt), `prisma.adminLoginThrottle`(단일행, failedAttempts, lockedUntil).

- [ ] **Step 1: 모델 추가** (`Article` 모델 뒤)

```prisma
// 어드민 불투명 세션 — id = sha256(랜덤 토큰). 쿠키엔 raw 토큰, DB엔 해시만.
model AdminSession {
  id        String   @id @db.VarChar(64) // sha256 hex
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}

// 어드민 로그인 브루트포스 잠금 (단일 관리자, 고정 id='admin'). cluster-safe.
model AdminLoginThrottle {
  id             String    @id @db.VarChar(20) // 'admin' 고정
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?
  updatedAt      DateTime  @updatedAt
}
```

- [ ] **Step 2: DB 반영**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && cd backend && npm run db:push && npm run db:generate`
Expected: 두 테이블 생성, 클라이언트 재생성, 에러 없음.

- [ ] **Step 3: 스모크**

Run:
```bash
cd backend && node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.adminSession.count(),p.adminLoginThrottle.count()]).then(r=>{console.log('sessions,throttle:',r);return p.\$disconnect();}).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: `sessions,throttle: [ 0, 0 ]`.

- [ ] **Step 4: 커밋**

```bash
cd backend && git add prisma/schema.prisma
git commit -m "feat(admin): AdminSession·AdminLoginThrottle 모델"
```

---

## Task 3: 어드민 세션·잠금 서비스 (TDD)

**Files:** Create `backend/src/services/adminSessionService.ts`, `backend/src/services/adminThrottleService.ts`; Test `backend/__tests__/services/adminSessionService.test.ts`, `backend/__tests__/services/adminThrottleService.test.ts`.

**Interfaces — Produces:**
- `createSession():Promise<{token:string; expiresAt:Date}>` — 랜덤 토큰 발급, sha256 저장.
- `verifySession(token:string):Promise<boolean>` — 유효+미만료면 true, 아니면 false(만료 행은 삭제).
- `revokeSession(token:string):Promise<void>`.
- `hashToken(token:string):string` (sha256 hex, export for test).
- `recordLoginFailure():Promise<void>`, `clearLoginFailures():Promise<void>`, `isLockedOut():Promise<boolean>`.

- [ ] **Step 1: 실패 테스트 — adminSessionService**

`backend/__tests__/services/adminSessionService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockCreate, mockFindUnique, mockDelete, mockDeleteMany } = vi.hoisted(() => ({
  mockCreate: vi.fn(), mockFindUnique: vi.fn(), mockDelete: vi.fn(), mockDeleteMany: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  default: { adminSession: { create: mockCreate, findUnique: mockFindUnique, delete: mockDelete, deleteMany: mockDeleteMany } },
}));
import { createSession, verifySession, revokeSession, hashToken } from '../../src/services/adminSessionService.js';

beforeEach(() => { mockCreate.mockReset(); mockFindUnique.mockReset(); mockDelete.mockReset(); mockDeleteMany.mockReset(); });

describe('adminSessionService', () => {
  it('createSession: raw 토큰 반환하되 DB엔 sha256(token)을 id로 저장', async () => {
    mockCreate.mockResolvedValue({});
    const { token, expiresAt } = await createSession();
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(expiresAt).toBeInstanceOf(Date);
    const arg = mockCreate.mock.calls[0][0].data;
    expect(arg.id).toBe(hashToken(token));
    expect(arg.id).not.toBe(token); // raw 토큰이 저장되지 않음
  });

  it('verifySession: 미만료 세션이면 true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', expiresAt: new Date(Date.now() + 60000) });
    expect(await verifySession('tok')).toBe(true);
    expect(mockFindUnique.mock.calls[0][0].where.id).toBe(hashToken('tok'));
  });

  it('verifySession: 만료 세션이면 false + 행 삭제', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', expiresAt: new Date(Date.now() - 1000) });
    mockDelete.mockResolvedValue({});
    expect(await verifySession('tok')).toBe(false);
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('verifySession: 없는 세션이면 false', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await verifySession('tok')).toBe(false);
  });

  it('revokeSession: 해시로 삭제(없어도 throw 안 함)', async () => {
    mockDelete.mockRejectedValue(new Error('not found'));
    await expect(revokeSession('tok')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: RED 확인** — `npx vitest run __tests__/services/adminSessionService.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: `adminSessionService.ts` 구현**

```ts
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { getSessionTtlMs } from '../config/adminConfig.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getSessionTtlMs());
  await prisma.adminSession.create({ data: { id: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.adminSession.findUnique({ where: { id: hashToken(token) } });
  if (!row) return false;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }
  return true;
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await prisma.adminSession.delete({ where: { id: hashToken(token) } }).catch(() => {});
}
```

- [ ] **Step 4: 실패 테스트 — adminThrottleService**

`backend/__tests__/services/adminThrottleService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockUpsert, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockUpsert: vi.fn(), mockFindUnique: vi.fn(), mockUpdate: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  default: { adminLoginThrottle: { upsert: mockUpsert, findUnique: mockFindUnique, update: mockUpdate } },
}));
import { recordLoginFailure, clearLoginFailures, isLockedOut, MAX_ATTEMPTS } from '../../src/services/adminThrottleService.js';

beforeEach(() => { mockUpsert.mockReset(); mockFindUnique.mockReset(); mockUpdate.mockReset(); });

describe('adminThrottleService', () => {
  it('isLockedOut: lockedUntil 미래면 true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });
    expect(await isLockedOut()).toBe(true);
  });
  it('isLockedOut: lockedUntil 과거면 false', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() - 1000) });
    expect(await isLockedOut()).toBe(false);
  });
  it('isLockedOut: 행 없으면 false', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await isLockedOut()).toBe(false);
  });
  it('recordLoginFailure: MAX 도달 시 lockedUntil 설정', async () => {
    mockUpsert.mockResolvedValue({ id: 'admin', failedAttempts: MAX_ATTEMPTS, lockedUntil: null });
    mockUpdate.mockResolvedValue({});
    await recordLoginFailure();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledOnce(); // 잠금 설정
    expect(mockUpdate.mock.calls[0][0].data.lockedUntil).toBeInstanceOf(Date);
  });
  it('recordLoginFailure: MAX 미만이면 잠금 없음', async () => {
    mockUpsert.mockResolvedValue({ id: 'admin', failedAttempts: 2, lockedUntil: null });
    await recordLoginFailure();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  it('clearLoginFailures: 카운터·잠금 리셋', async () => {
    mockUpsert.mockResolvedValue({});
    await clearLoginFailures();
    expect(mockUpsert.mock.calls[0][0].update).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});
```

- [ ] **Step 5: RED 확인** → FAIL.

- [ ] **Step 6: `adminThrottleService.ts` 구현**

```ts
import prisma from '../lib/prisma.js';

export const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const ID = 'admin';

export async function isLockedOut(): Promise<boolean> {
  const row = await prisma.adminLoginThrottle.findUnique({ where: { id: ID } });
  if (!row || !row.lockedUntil) return false;
  return row.lockedUntil.getTime() > Date.now();
}

export async function recordLoginFailure(): Promise<void> {
  const row = await prisma.adminLoginThrottle.upsert({
    where: { id: ID },
    create: { id: ID, failedAttempts: 1 },
    update: { failedAttempts: { increment: 1 } },
  });
  if (row.failedAttempts >= MAX_ATTEMPTS) {
    await prisma.adminLoginThrottle.update({
      where: { id: ID },
      data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
  }
}

export async function clearLoginFailures(): Promise<void> {
  await prisma.adminLoginThrottle.upsert({
    where: { id: ID },
    create: { id: ID, failedAttempts: 0 },
    update: { failedAttempts: 0, lockedUntil: null },
  });
}
```

- [ ] **Step 7: GREEN** — 두 테스트 파일 통과. Run: `npx vitest run __tests__/services/adminSessionService.test.ts __tests__/services/adminThrottleService.test.ts`

- [ ] **Step 8: 커밋**

```bash
cd backend && git add src/services/adminSessionService.ts src/services/adminThrottleService.ts __tests__/services/adminSessionService.test.ts __tests__/services/adminThrottleService.test.ts
git commit -m "feat(admin): 세션(토큰 해시)·로그인 잠금 서비스 + 테스트"
```

---

## Task 4: 인증 미들웨어 + 인증 라우트 (login/logout/session) — TDD

**Files:** Create `backend/src/middlewares/adminAuth.ts`, `backend/src/schemas/admin.ts`, `backend/src/routes/admin.ts`(auth 부분); Modify `backend/src/app.ts`(마운트); Test `backend/__tests__/routes/adminAuth.test.ts`.

**Interfaces:**
- Consumes: adminConfig, adminSessionService, adminThrottleService, `bcryptjs`.
- Produces: `requireAdmin` 미들웨어(401 아니면 next), `requireSameOrigin` 미들웨어, `adminLoginRateLimiter`, 라우트 `POST /api/admin/login`·`/logout`·`GET /api/admin/session`.

- [ ] **Step 1: `adminAuth.ts` — 미들웨어**

```ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { SESSION_COOKIE_NAME } from '../config/adminConfig.js';
import { verifySession } from '../services/adminSessionService.js';

function isAllowedOrigin(value: string | undefined): boolean {
  if (!value) return false;
  const allowed = (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000']).map((s) => s.trim());
  try {
    const originOfValue = new URL(value).origin;
    return allowed.includes(originOfValue);
  } catch {
    return false;
  }
}

// CSRF 방어심화: 상태 변경 요청은 Origin(또는 Referer)이 allowlist에 있어야 함.
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? req.headers.referer;
  if (!isAllowedOrigin(typeof origin === 'string' ? origin : undefined)) {
    next(Object.assign(new Error('교차 출처 요청은 허용되지 않습니다'), { statusCode: 403, code: 'FORBIDDEN' }));
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
  const ok = await verifySession(token);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다', requestId: req.requestId } });
    return;
  }
  next();
}

// 로그인 전용 리미터 — 기존 rateLimit.ts와 달리 loopback 스킵 없음.
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '로그인 시도가 많습니다. 잠시 후 다시 시도하세요.', requestId: req.requestId } });
  },
});
```
(주: `requireSameOrigin`의 에러는 글로벌 핸들러가 `AppError`가 아니면 500으로 처리하므로, `AppError` 서브클래스 `ForbiddenError`를 `lib/errors.ts`에 추가해 throw하는 편이 낫다 — Step 1b 참조.)

- [ ] **Step 1b: `ForbiddenError` 추가** — `backend/src/lib/errors.ts`에:
```ts
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}
```
그리고 `requireSameOrigin`에서 `next(new ForbiddenError('교차 출처 요청은 허용되지 않습니다'));`로 교체(위 인라인 Object.assign 대신).

- [ ] **Step 2: `schemas/admin.ts` — Zod**

```ts
import { z } from 'zod';
export const AdminLoginSchema = z.object({ password: z.string().min(1).max(200) });
```

- [ ] **Step 3: 실패 테스트 — 인증 플로우(supertest)**

`backend/__tests__/routes/adminAuth.test.ts` — 최소 express 앱에 admin 라우터만 마운트, prisma·bcrypt 목:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const { mockSessionCreate, mockSessionFind, mockSessionDelete, mockThrottleFind, mockThrottleUpsert, mockThrottleUpdate, mockCompare } = vi.hoisted(() => ({
  mockSessionCreate: vi.fn(), mockSessionFind: vi.fn(), mockSessionDelete: vi.fn(),
  mockThrottleFind: vi.fn().mockResolvedValue(null), mockThrottleUpsert: vi.fn().mockResolvedValue({ failedAttempts: 1 }), mockThrottleUpdate: vi.fn(),
  mockCompare: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({ default: {
  adminSession: { create: mockSessionCreate, findUnique: mockSessionFind, delete: mockSessionDelete },
  adminLoginThrottle: { findUnique: mockThrottleFind, upsert: mockThrottleUpsert, update: mockThrottleUpdate },
}}));
vi.mock('bcryptjs', () => ({ default: { compare: mockCompare }, compare: mockCompare }));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError } from '../../src/lib/errors.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use('/api/admin', adminRouter);
  // 간이 에러 핸들러
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const s = err instanceof AppError ? err.statusCode : 500;
    res.status(s).json({ success: false, error: { code: err instanceof AppError ? err.code : 'INTERNAL' } });
  });
  return app;
}

beforeEach(() => { vi.clearAllMocks(); mockThrottleFind.mockResolvedValue(null); mockThrottleUpsert.mockResolvedValue({ failedAttempts: 1 }); });

describe('admin auth', () => {
  it('로그인 성공 시 httpOnly·SameSite=Strict 쿠키 발급', async () => {
    mockCompare.mockResolvedValue(true); mockSessionCreate.mockResolvedValue({});
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'correct' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/admin_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('비밀번호 틀리면 401 + 실패 기록', async () => {
    mockCompare.mockResolvedValue(false);
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(mockThrottleUpsert).toHaveBeenCalled(); // recordLoginFailure
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('잠금 상태면 429', async () => {
    mockThrottleFind.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'x' });
    expect(res.status).toBe(429);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('교차 출처 로그인은 403', async () => {
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'https://evil.com').send({ password: 'x' });
    expect(res.status).toBe(403);
  });

  it('세션 없이 GET /session은 401', async () => {
    mockSessionFind.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/admin/session');
    expect(res.status).toBe(401);
  });

  it('비밀번호에 < 포함돼도 훼손 없이 bcrypt.compare에 전달', async () => {
    mockCompare.mockResolvedValue(true); mockSessionCreate.mockResolvedValue({});
    await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'p<a>ss' });
    expect(mockCompare.mock.calls[0][0]).toBe('p<a>ss'); // sanitize 안 됨(라우터 자체엔 sanitize 없음)
  });
});
```

- [ ] **Step 4: RED 확인** → FAIL(admin 라우터 없음).

- [ ] **Step 5: `routes/admin.ts` — auth 라우트 구현**

```ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { AppError } from '../lib/errors.js';
import { AdminLoginSchema } from '../schemas/admin.js';
import { SESSION_COOKIE_NAME, getAdminPasswordHash, getSessionTtlMs } from '../config/adminConfig.js';
import { createSession, revokeSession } from '../services/adminSessionService.js';
import { isLockedOut, recordLoginFailure, clearLoginFailures } from '../services/adminThrottleService.js';
import { requireAdmin, requireSameOrigin, adminLoginRateLimiter } from '../middlewares/adminAuth.js';

const router = Router();

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: getSessionTtlMs() };
}

// POST /api/admin/login
router.post('/login', requireSameOrigin, adminLoginRateLimiter, validate(AdminLoginSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const hash = getAdminPasswordHash();
    if (!hash) throw new AppError(503, '어드민이 설정되지 않았습니다', 'ADMIN_NOT_CONFIGURED'); // fail-closed
    if (await isLockedOut()) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '로그인이 일시 잠겼습니다. 잠시 후 다시 시도하세요.', requestId: req.requestId } });
      return;
    }
    const { password } = req.body as { password: string };
    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      await recordLoginFailure();
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '비밀번호가 올바르지 않습니다', requestId: req.requestId } });
      return;
    }
    await clearLoginFailures();
    const { token } = await createSession();
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    res.json({ success: true, data: { authenticated: true } });
  })
);

// POST /api/admin/logout
router.post('/logout', requireSameOrigin, asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
  await revokeSession(token);
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ success: true, data: { authenticated: false } });
}));

// GET /api/admin/session — 프론트 가드
router.get('/session', requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, data: { authenticated: true } });
});

export default router;
```

- [ ] **Step 6: GREEN** — Run: `npx vitest run __tests__/routes/adminAuth.test.ts` → PASS.

- [ ] **Step 7: `app.ts`에 어드민 라우터 마운트** — import + `app.use('/api/admin', adminRouter);`(다른 라우터 마운트 구역, line 83 근처).

- [ ] **Step 8: 전체 스위트·린트·타입체크** — `npm run test && npm run lint && npx tsc --noEmit` → 무회귀.

- [ ] **Step 9: 커밋**
```bash
cd backend && git add src/middlewares/adminAuth.ts src/schemas/admin.ts src/routes/admin.ts src/lib/errors.ts src/app.ts __tests__/routes/adminAuth.test.ts
git commit -m "feat(admin): 세션 인증 미들웨어 + login/logout/session 라우트(잠금·CSRF·전용 리미터)"
```

---

## Task 5: 어드민 Article CRUD API (TDD)

**Files:** Create `backend/src/services/adminArticleService.ts`; Modify `backend/src/routes/admin.ts`, `backend/src/schemas/admin.ts`; Test `backend/__tests__/routes/adminArticles.test.ts`.

**Interfaces — Produces (service):** `listAdminArticles(q)`, `getAdminArticle(id)`, `updateAdminArticle(id, patch)`, `publishArticle(id)`, `unpublishArticle(id)`, `rejectArticle(id)`, `deleteAdminArticle(id)`. 라우트는 전부 `requireAdmin`(+변경계열 `requireSameOrigin`).

- [ ] **Step 1: Zod 스키마 추가** (`schemas/admin.ts`)
```ts
export const AdminArticleListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'published', 'rejected']).optional(),
  category: z.string().optional(),
});
export const AdminArticleIdSchema = z.object({ id: z.string().min(1).max(40) });
export const AdminArticlePatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(500).optional(),
  keywords: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: '수정할 필드가 없습니다' });
```

- [ ] **Step 2: 실패 테스트** — `backend/__tests__/routes/adminArticles.test.ts` (supertest, 인증은 세션 목으로 통과시키고 CRUD 동작 검증). 핵심 케이스:
  - `GET /api/admin/articles`가 status 필터 없이 **draft 포함 전체**를 반환(공개 API와 달리 published 강제 아님).
  - `POST /:id/publish`가 `status:'published'`+`publishedAt` 설정(재-publish 시 publishedAt 유지=최초값), 이미 없는 id는 404.
  - `POST /:id/unpublish` → `status:'draft'`.
  - `POST /:id/reject` → `status:'rejected'`.
  - `PATCH /:id`가 허용 필드만 업데이트, 빈 본문 422.
  - `DELETE /:id`가 레코드 삭제 + 썸네일 파일 안전 정리(경로가 stored thumbnailUrl에서만 유도, articles 디렉터리 밖이면 unlink 안 함).
  - 인증 없으면 401(위 requireAdmin 재확인 1케이스).

  (테스트는 `verifySession`을 목해 인증 통과: `vi.mock('../../src/services/adminSessionService.js', ...)`로 `verifySession: async()=>true` + `prisma.article` 목.)

- [ ] **Step 3: RED 확인** → FAIL.

- [ ] **Step 4: `adminArticleService.ts` 구현** — `prisma.article` 기반. 발행:
```ts
export async function publishArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true, publishedAt: true, title: true, summary: true, content: true, thumbnailUrl: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');
  if (!existing.title || !existing.summary || !existing.content || !existing.thumbnailUrl) {
    throw new ValidationError('발행에 필요한 필드(제목·요약·본문·썸네일)가 비어 있습니다');
  }
  return prisma.article.update({
    where: { id },
    data: { status: 'published', publishedAt: existing.publishedAt ?? new Date() }, // 최초 1회만
  });
}
```
목록은 status/category 필터 + `orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]`, published/rejected 강제 없음. 삭제는 레코드 조회 → `path.basename(thumbnailUrl)` → 고정 articles 디렉터리 resolve → 그 안이면 unlink(밖이면 스킵) → `prisma.article.delete`. reject/unpublish는 status만 변경(발행취소 시 publishedAt은 유지할지 null로 되돌릴지: **draft로 되돌리되 publishedAt=null**로 통일 — 재발행 시 새 발행일).

- [ ] **Step 5: `routes/admin.ts`에 CRUD 라우트 추가** — 전부 `requireAdmin`, 변경계열(POST/PATCH/DELETE)엔 `requireSameOrigin`, Zod `validate`. `asyncHandler` + 서비스 호출 + `{success:true,data}`.

- [ ] **Step 6: GREEN** — `npx vitest run __tests__/routes/adminArticles.test.ts` → PASS.

- [ ] **Step 7: 전체 스위트·린트·타입체크** → 무회귀.

- [ ] **Step 8: 커밋**
```bash
cd backend && git add src/services/adminArticleService.ts src/routes/admin.ts src/schemas/admin.ts __tests__/routes/adminArticles.test.ts
git commit -m "feat(admin): 어드민 Article CRUD API(목록·조회·편집·발행·발행취소·반려·삭제)"
```

---

## Task 6: 생성 트리거 (단일-플라이트 + 안전 spawn) — TDD

**Files:** Modify `backend/prisma/schema.prisma`(`ArticleGenerationLock`), Create `backend/src/lib/articleGenerationLock.ts`; Modify `backend/src/routes/admin.ts`, `backend/src/schemas/admin.ts`; Test `backend/__tests__/routes/adminGenerate.test.ts`.

**Interfaces — Produces:** `acquireGenerationLock():Promise<boolean>`, `releaseGenerationLock():Promise<void>`; 라우트 `POST /api/admin/articles/generate`(202/409/503), `POST /api/admin/articles/:id/regenerate`.

- [ ] **Step 1: `ArticleGenerationLock` 모델 + db push**
```prisma
// 생성 단일-플라이트 락 (고정 id='singleton'). stale-timeout 재확보.
model ArticleGenerationLock {
  id        String   @id @db.VarChar(20)
  running   Boolean  @default(false)
  startedAt DateTime @default(now())
}
```
Run: `npm run db:push && npm run db:generate`.

- [ ] **Step 2: `articleGenerationLock.ts`** — stale 10분 재확보. acquire: `updateMany({ where: { id:'singleton', OR:[{running:false},{startedAt:{lt: staleThreshold}}] }, data:{running:true,startedAt:now} })` → count===1이면 true. 사전에 `upsert`로 singleton 행 보장. release: `updateMany({ where:{id:'singleton'}, data:{running:false} })`.

- [ ] **Step 3: Zod** (`schemas/admin.ts`)
```ts
import { GUIDE_CATEGORIES } from '../services/articleGenerationCore.js';
export const AdminGenerateSchema = z.object({
  count: z.coerce.number().int().min(1).max(3).default(3),
  category: z.enum(GUIDE_CATEGORIES).optional(),
});
```
(`z.enum(GUIDE_CATEGORIES)` — GUIDE_CATEGORIES는 `as const` 튜플이라 enum 입력으로 사용 가능. 안 되면 `z.string().refine(isGuideCategory)`.)

- [ ] **Step 4: 실패 테스트** — `adminGenerate.test.ts` (인증 목 통과):
  - `POST /generate` 정상: 락 확보 + `child_process.spawn` 호출(execFileSync 아님), 202 반환. spawn 인자 검증: `process.execPath`, args에 `--count 3`, category 미지정 시 category 인자 없음.
  - 락 이미 running이면 409, spawn 호출 안 됨.
  - `category:'invalid'` → 422(Zod), spawn 안 됨.
  - `count:99` → 3으로 clamp.
  - 키(OPENAI_API_KEY) 없으면 503, spawn 안 됨.
  - dist 스크립트 없으면 500(존재 확인 실패) — `fs.existsSync` 목.
  (spawn·fs 목: `vi.mock('child_process')`, `vi.mock('fs')`.)

- [ ] **Step 5: RED** → FAIL.

- [ ] **Step 6: `POST /generate` 구현** (routes/admin.ts) — `requireAdmin`+`requireSameOrigin`+전용 레이트리밋(시간당 소수)+`validate(AdminGenerateSchema)`:
```ts
router.post('/articles/generate', requireAdmin, requireSameOrigin, adminGenerateRateLimiter, validate(AdminGenerateSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!process.env.OPENAI_API_KEY || !process.env.NAVER_CLIENT_ID) {
      throw new AppError(503, '생성 키가 설정되지 않았습니다', 'GENERATION_NOT_CONFIGURED');
    }
    const { count, category } = req.body as { count: number; category?: string };
    const scriptPath = path.resolve(__dirname, '../scripts/generateArticle.js'); // dist 기준
    if (!fs.existsSync(scriptPath)) throw new AppError(500, '생성 스크립트를 찾을 수 없습니다(빌드 필요)', 'SCRIPT_MISSING');
    const acquired = await acquireGenerationLock();
    if (!acquired) throw new ConflictError('이미 생성이 진행 중입니다');
    const args = [scriptPath, '--count', String(count)];
    if (category) args.push('--category', category);
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' });
    child.on('exit', () => { void releaseGenerationLock(); });
    child.unref();
    res.status(202).json({ success: true, data: { started: true, count, category: category ?? null } });
  })
);
```
(dev(tsx src) 환경에선 dist 없음 → 500; dev용은 category/count로 직접 `npm run generate:article` 안내. prod/CI는 dist 존재. `__dirname`은 ESM `fileURLToPath` 패턴.)
`regenerate`: `rejectArticle(id)` 후 해당 category로 동일 spawn 경로(단일-플라이트). 대상 없으면 404.

- [ ] **Step 7: GREEN** → PASS. **Step 8: 전체 스위트·린트·타입체크** → 무회귀.

- [ ] **Step 9: 커밋**
```bash
cd backend && git add prisma/schema.prisma src/lib/articleGenerationLock.ts src/routes/admin.ts src/schemas/admin.ts __tests__/routes/adminGenerate.test.ts
git commit -m "feat(admin): 생성 트리거(단일-플라이트 락 + 검증된 안전 spawn) + regenerate"
```

---

## Self-Review (spec Phase 2 백엔드 대비)

- 세션 쿠키 인증(불투명 DB, revocable, httpOnly·Secure·SameSite=Strict·host-scoped) → Task 3·4. ✅
- fail-closed(ADMIN_PASSWORD_HASH 미설정 503) → Task 4 login. ✅
- 브루트포스: loopback-skip 리미터 재사용 금지 + 전용 리미터 + **DB 계정 잠금(cluster-safe)** → Task 3·4. ✅
- sanitizeInput 예외(/api/admin) → Task 1. ✅ / 비밀번호 훼손 없음 테스트 → Task 4. ✅
- CSRF Origin/Referer allowlist → `requireSameOrigin` 변경계열 전체. ✅
- 어드민 Article CRUD(초안 포함 목록·편집·발행·발행취소·반려·삭제) → Task 5. ✅
- DELETE 썸네일 경로 탈출 방지(basename+디렉터리 confine) → Task 5. ✅
- 생성 트리거 Zod(count 1..3·category allowlist)+단일-플라이트+안전 spawn(execPath·detached·unref·stdio ignore·dist 존재확인·키 503) → Task 6. ✅
- cookie-parser 신규 dep(Node 20, lock 유지) → Task 1. ✅

## Out of Scope (이 PR)
프론트 어드민 UI·로그인 페이지·route 미들웨어·robots.txt Disallow·E2E(=**Phase 2b**). Nitro 프록시 Cookie/Set-Cookie 왕복 검증(=Phase 2b 통합 테스트). 공개 `/article` 라우트(=Phase 3).

## Phase 완료 기준(DoD)
- `npm run test`(백엔드) green(신규 어드민 테스트 포함)·`npm run lint` 0 errors·`npx tsc --noEmit` clean(Node 20).
- 로그인→세션→보호 라우트 401/200, 잠금 429, CSRF 403, 발행/반려/삭제 동작이 테스트로 검증.
- 기존 스위트 무회귀. 공개 노출·프론트 없음(의도).
