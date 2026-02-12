# 환경 변수 가이드

일상킷(ilsangkit) 프로젝트의 모든 환경 변수를 문서화합니다.

## 개요

- **Backend**: Express API 서버 설정
- **Frontend**: Nuxt SSR/SSG 애플리케이션 설정
- **공개 변수**: `NUXT_PUBLIC_*` 접두사로 클라이언트에 노출
- **비공개 변수**: 서버에서만 사용되는 민감한 정보

## Backend 환경 변수

백엔드는 `backend/.env` 파일에서 환경 변수를 읽습니다.

### 필수 변수

| 변수 | 설명 | 예시 | 사용 |
|------|------|------|------|
| `DATABASE_URL` | MySQL 데이터베이스 연결 문자열 | `mysql://user:password@host:port/dbname` | Prisma ORM |
| `OPENAPI_SERVICE_KEY` | 공공데이터 API 인증 키 (data.go.kr) | `your-api-key` | 공공 데이터 동기화 |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 (역지오코딩) | `your-kakao-rest-api-key` | 주소 역변환 서비스 |

### 선택 변수

| 변수 | 기본값 | 설명 | 사용 |
|------|--------|------|------|
| `PORT` | `8000` | API 서버 포트 | Express 서버 |
| `CORS_ORIGIN` | `http://localhost:3000` | CORS 허용 출처 (쉼표 구분) | 보안 미들웨어 |
| `NODE_ENV` | `development` | 실행 환경 (`development`, `production`, `test`) | 로깅, 에러 처리 |

### Backend .env 예시

```bash
# 데이터베이스 (로컬 Docker MySQL)
DATABASE_URL=mysql://ilsangkit:ilsangkit123@localhost:3307/ilsangkit

# 서버 설정
PORT=8000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# 공공데이터 API (data.go.kr)
OPENAPI_SERVICE_KEY=your-api-key-here

# 카카오 지도 API
KAKAO_REST_API_KEY=your-kakao-rest-api-key-here
```

### DATABASE_URL 형식

MySQL 데이터베이스 연결 문자열 형식:

```
mysql://[username]:[password]@[host]:[port]/[database]
```

**개발 환경 (Docker)**:
```
mysql://ilsangkit:ilsangkit123@localhost:3307/ilsangkit
```

**프로덕션**:
```
mysql://ilsangkit:your-secure-password@cafe24-host:3306/ilsangkit
```

### CORS_ORIGIN 설정

여러 출처를 허용하려면 쉼표로 구분:

```bash
CORS_ORIGIN=http://localhost:3000,https://example.com,https://www.example.com
```

## Frontend 환경 변수

프론트엔드는 `frontend/.env` 파일에서 환경 변수를 읽습니다.

**중요**: `NUXT_PUBLIC_*` 접두사로 시작하는 변수만 클라이언트에 노출됩니다.

### 필수 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `NUXT_PUBLIC_API_BASE` | 백엔드 API URL | `http://localhost:8000` 또는 `https://api.example.com` |
| `NUXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JavaScript API 키 | `your-kakao-map-api-key` |

### 선택 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NUXT_PUBLIC_GA_ID` | (없음) | Google Analytics 4 측정 ID (GTM-xxxxx 형식) |
| `NUXT_PUBLIC_DISABLE_MSW` | `false` | Mock Service Worker 비활성화 플래그 |

### Frontend .env 예시

```bash
# API 백엔드 연결
NUXT_PUBLIC_API_BASE=http://localhost:8000

# 카카오맵 API
NUXT_PUBLIC_KAKAO_MAP_KEY=your-kakao-map-api-key

# Google Analytics (선택사항)
NUXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# MSW 비활성화 (백엔드 사용 시)
NUXT_PUBLIC_DISABLE_MSW=false
```

## API 키 취득 방법

### 1. 공공데이터 API 키 (OPENAPI_SERVICE_KEY)

**출처**: [data.go.kr](https://www.data.go.kr)

1. 회원가입 및 로그인
2. "마이페이지" → "개인 API 인증키 신청"
3. API 인증키 발급 (즉시 사용 가능)

**사용하는 데이터**:
- 공공화장실 정보 (15012892)
- 생활쓰레기배출지 (15155080)
- 무료와이파이 정보 (15013116)
- 의류수거함 정보 (15139214)
- 무인민원발급기 정보 (15154774)

### 2. 카카오 Map REST API 키 (KAKAO_REST_API_KEY)

**출처**: [kakao developers](https://developers.kakao.com)

1. 카카오 계정으로 로그인
2. "내 애플리케이션" → "앱 추가" (마다 새로운 앱 추가)
3. "Key" 탭에서 **REST API 키** 복사
4. "웹 플랫폼" 설정에 도메인 추가

**역지오코딩 API 용도**: 주소를 좌표로 변환할 때 사용

### 3. 카카오 Map JavaScript API 키 (NUXT_PUBLIC_KAKAO_MAP_KEY)

**출처**: [kakao developers](https://developers.kakao.com)

1. 같은 애플리케이션에서 **JavaScript 키** 복사
2. "웹 플랫폼" 설정에 도메인 추가 (필수)
3. 프론트엔드 `.env`에 설정

**사용 목적**: 웹 지도 표시 및 위치 검색

### 4. Google Analytics ID (NUXT_PUBLIC_GA_ID)

**출처**: [Google Analytics](https://analytics.google.com)

1. Google Analytics 4 계정 생성
2. 웹 스트림 생성
3. 측정 ID (G-로 시작) 복사

**형식**: `G-XXXXXXXXXX`

## 개발 환경 설정

### 로컬 개발 (Mac/Linux)

```bash
# 백엔드 설정
cd backend
cp .env.example .env
# .env 파일을 편집하여 API 키 입력

# 프론트엔드 설정
cd frontend
cp .env.example .env
# .env 파일을 편집하여 API 키 입력

# Docker MySQL 시작
docker compose up -d

# 데이터베이스 초기화
cd backend
npx prisma db push

# 개발 서버 시작
npm run dev
```

### Windows (WSL 사용 권장)

Windows Subsystem for Linux (WSL)에서 위의 Mac/Linux 명령어 동일하게 사용

## 프로덕션 환경 설정

### GitHub Actions Secrets

자동 배포를 위해 GitHub 저장소 Settings → Secrets and variables → Actions에 등록:

```
NUXT_PUBLIC_API_BASE          → 프로덕션 API URL
NUXT_PUBLIC_KAKAO_MAP_KEY     → 카카오맵 API 키
NUXT_PUBLIC_GA_ID             → Google Analytics ID
SERVER_HOST                   → Cafe24 서버 IP
SERVER_USER                   → SSH 사용자명
SERVER_PASSWORD               → SSH 비밀번호
```

### 서버 환경 변수 (Cafe24)

Cafe24 가상서버에서 PM2 프로세스 실행 전 설정:

```bash
# PM2 ecosystem.config.js 또는 .env 파일에 설정
export DATABASE_URL=mysql://ilsangkit:secure-password@localhost:3306/ilsangkit
export OPENAPI_SERVICE_KEY=production-api-key
export KAKAO_REST_API_KEY=production-kakao-rest-key
export CORS_ORIGIN=https://example.com
export NODE_ENV=production
export PORT=8000
```

## 보안 주의사항

### .env 파일 보안

```bash
# .gitignore 설정 (이미 적용됨)
.env              # 실제 환경 변수 파일 (커밋 금지)
.env.test         # 테스트 환경 변수 (커밋 금지)
!.env.example     # 예시 파일만 커밋
```

### 비밀키 관리 방법

| 환경 | 관리 방법 | 사용 위치 |
|------|---------|----------|
| **로컬 개발** | 로컬 `.env` 파일 | 개발 머신만 |
| **GitHub CI** | GitHub Secrets | Actions 워크플로우 |
| **프로덕션** | 서버 환경 변수 | PM2/Nginx 설정 |

### 주의사항

- **절대 커밋하지 마세요**: `.env` 파일은 절대 Git에 커밋하면 안 됨
- **주기적 갱신**: 키가 노출된 경우 즉시 data.go.kr, Kakao에서 재발급
- **최소 권한**: 각 키는 최소 필요한 권한만 설정
- **로깅 주의**: 환경 변수를 로그에 출력하지 않음

## 환경 변수 검증

### 필수 변수 확인

```bash
# Backend
cd backend
npm run dev  # DATABASE_URL, OPENAPI_SERVICE_KEY 누락 시 에러 발생

# Frontend
cd frontend
npm run dev  # NUXT_PUBLIC_API_BASE, NUXT_PUBLIC_KAKAO_MAP_KEY 누락 시 에러 발생
```

### 변수 값 확인 (개발 환경)

```bash
# Backend
cd backend
echo $DATABASE_URL
echo $OPENAPI_SERVICE_KEY
echo $NODE_ENV

# Frontend
cd frontend
echo $NUXT_PUBLIC_API_BASE
echo $NUXT_PUBLIC_KAKAO_MAP_KEY
```

## 환경별 설정 예시

### 개발 (Development)

```bash
# backend/.env
DATABASE_URL=mysql://ilsangkit:ilsangkit123@localhost:3307/ilsangkit
PORT=8000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
OPENAPI_SERVICE_KEY=dev-api-key
KAKAO_REST_API_KEY=dev-kakao-rest-key

# frontend/.env
NUXT_PUBLIC_API_BASE=http://localhost:8000
NUXT_PUBLIC_KAKAO_MAP_KEY=dev-kakao-map-key
NUXT_PUBLIC_GA_ID=
```

### 테스트 (Test - GitHub Actions)

```bash
# backend (CI 환경에서 자동 설정)
DATABASE_URL=mysql://root:testpassword@localhost:3306/ilsangkit_test
NODE_ENV=test
# OPENAPI_SERVICE_KEY는 테스트에서 Mock 사용
```

### 프로덕션 (Production - Cafe24)

```bash
# backend/.env 또는 PM2 환경변수
DATABASE_URL=mysql://ilsangkit:secure-password@cafe24-host:3306/ilsangkit
PORT=8000
CORS_ORIGIN=https://example.com,https://www.example.com
NODE_ENV=production
OPENAPI_SERVICE_KEY=production-api-key
KAKAO_REST_API_KEY=production-kakao-rest-key

# frontend (GitHub Actions에서 배포 시 주입)
NUXT_PUBLIC_API_BASE=https://api.example.com
NUXT_PUBLIC_KAKAO_MAP_KEY=production-kakao-map-key
NUXT_PUBLIC_GA_ID=G-PRODUCTION_ID
```

## 문제 해결

### "DATABASE_URL is not set" 에러

```bash
# 원인: backend/.env 파일이 없거나 DATABASE_URL이 설정되지 않음
# 해결
cd backend
cp .env.example .env
# .env 파일 편집하여 유효한 DATABASE_URL 설정
```

### "OPENAPI_SERVICE_KEY environment variable is not set" 에러

```bash
# 원인: 공공데이터 API 키가 설정되지 않음
# 해결: https://www.data.go.kr에서 API 키 발급 후 설정
```

### "NUXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다" 경고

```bash
# 원인: 카카오맵 JavaScript API 키가 설정되지 않음
# 해결: https://developers.kakao.com에서 JavaScript 키 발급 후 설정
cd frontend
echo "NUXT_PUBLIC_KAKAO_MAP_KEY=your-key" >> .env
```

### CORS 에러

```bash
# 원인: 프론트엔드 URL이 backend의 CORS_ORIGIN에 등록되지 않음
# 해결: backend/.env에서 CORS_ORIGIN 수정
CORS_ORIGIN=http://localhost:3000,https://example.com
```

## 참고 문서

- [Nuxt Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config)
- [Prisma Environment Variables](https://www.prisma.io/docs/reference/database-reference/connection-urls)
- [공공데이터포털](https://www.data.go.kr)
- [카카오 Developers](https://developers.kakao.com)
- [Google Analytics Setup](https://support.google.com/analytics/answer/1008080)

## 체크리스트

프로젝트 설정 시 다음을 확인하세요:

- [ ] Backend `.env` 파일 생성 및 필수 변수 설정
  - [ ] DATABASE_URL
  - [ ] OPENAPI_SERVICE_KEY
  - [ ] KAKAO_REST_API_KEY
- [ ] Frontend `.env` 파일 생성 및 필수 변수 설정
  - [ ] NUXT_PUBLIC_API_BASE
  - [ ] NUXT_PUBLIC_KAKAO_MAP_KEY
- [ ] Docker MySQL 컨테이너 실행 확인
- [ ] 데이터베이스 초기화 (`npx prisma db push`)
- [ ] 개발 서버 정상 실행 확인
- [ ] 프로덕션 배포 시 GitHub Secrets 설정 확인
