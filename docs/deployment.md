# Deployment Architecture

일상킷(ilsangkit)의 프로덕션 배포 아키텍처를 설명합니다.

## 인프라 개요

### 서버 환경
- **호스팅 제공자**: Cafe24 가상서버 (VPS)
- **OS**: Linux (Ubuntu)
- **Web Server**: Nginx (리버스 프록시)
- **Process Manager**: PM2 (클러스터 모드)
- **Database**: MySQL 8.0
- **Node.js**: 20.x LTS

### 아키텍처 다이어그램

```
Internet
   ↓
[Nginx 리버스 프록시 - port 80/443]
   ↓
   ├─→ [Frontend 인스턴스 1 - port 3000] (Nuxt SSR/SSG)
   ├─→ [Frontend 인스턴스 2 - port 3001] (Nuxt SSR/SSG)
   │
   └─→ [Backend 인스턴스 1 - port 8000] (Express API)
       └─→ [Backend 인스턴스 2 - port 8001] (Express API)
           ↓
       [MySQL Database - port 3306]
```

---

## Nginx 리버스 프록시 설정

Nginx는 클라이언트 요청을 프론트엔드 및 백엔드로 라우팅합니다.

### 기본 설정 구조

```nginx
# /etc/nginx/nginx.conf 또는 /etc/nginx/sites-available/ilsangkit

# Upstream 서버 그룹 정의
upstream frontend {
  least_conn;  # 최소 연결 수 기반 로드 밸런싱
  server localhost:3000 max_fails=3 fail_timeout=30s;
  server localhost:3001 max_fails=3 fail_timeout=30s;
  keepalive 32;
}

upstream backend {
  least_conn;
  server localhost:8000 max_fails=3 fail_timeout=30s;
  server localhost:8001 max_fails=3 fail_timeout=30s;
  keepalive 32;
}

# HTTP → HTTPS 리다이렉트
server {
  listen 80;
  server_name ilsangkit.com *.ilsangkit.com;
  return 301 https://$server_name$request_uri;
}

# HTTPS 서버 블록
server {
  listen 443 ssl http2;
  server_name ilsangkit.com *.ilsangkit.com;

  # SSL 인증서 설정
  ssl_certificate /etc/letsencrypt/live/ilsangkit.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ilsangkit.com/privkey.pem;

  # SSL 보안 설정
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # 보안 헤더
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # Gzip 압축
  gzip on;
  gzip_vary on;
  gzip_proxied any;
  gzip_comp_level 6;
  gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

  # 정적 파일 캐싱 (성능 최적화)
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    proxy_pass http://frontend;
    proxy_cache_valid 200 30d;
  }

  # 마크 엔드포인트 (정적 콘텐츠)
  location /sitemap.xml {
    proxy_pass http://backend;
    proxy_cache_valid 200 1h;
    add_header Cache-Control "public, max-age=3600";
  }

  # API 엔드포인트
  location /api/ {
    # API는 캐싱하지 않음
    proxy_pass http://backend;
    proxy_http_version 1.1;

    # Keep-alive 연결 유지
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $request_id;

    # 타임아웃 설정 (장시간 연산용)
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # 프론트엔드 (기본 라우트)
  location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;

    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $request_id;
  }

  # 헬스 체크 (로드 밸런서 모니터링)
  location /health {
    access_log off;
    return 200 "OK\n";
    add_header Content-Type text/plain;
  }
}
```

### Nginx 설정 검증 및 재로드

```bash
# 설정 문법 검사
sudo nginx -t

# 설정 재로드 (무중단)
sudo systemctl reload nginx

# 상태 확인
sudo systemctl status nginx
```

---

## PM2 클러스터 구성

PM2는 Node.js 애플리케이션을 여러 인스턴스로 자동 관리합니다.

### ecosystem.config.js

```javascript
// 프로젝트 루트의 ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'ilsangkit-api',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 2,           // 2개 인스턴스 (CPU 코어 수에 맞춰 조정)
      exec_mode: 'cluster',   // 클러스터 모드 (자동 로드 밸런싱)
      watch: false,
      max_memory_restart: '500M',

      // 개발 환경 설정
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },

      // 프로덕션 환경 설정
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      },

      // 로깅 설정
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // 자동 재시작 설정
      ignore_watch: ['node_modules', 'logs', '.git'],
      max_restarts: 10,          // 1시간 내 최대 10회 재시작
      min_uptime: '10s',         // 10초 이상 실행되어야 정상
      autorestart: true,

      // 그레이스풀 셧다운
      kill_timeout: 5000,        // 5초 이내에 종료되지 않으면 강제 종료
      listen_timeout: 3000
    },

    {
      name: 'ilsangkit-web',
      cwd: './frontend',
      script: '.output/server/index.mjs',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',

      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      ignore_watch: ['node_modules', 'logs', '.git'],
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
      kill_timeout: 5000,
      listen_timeout: 3000
    }
  ],

  // PM2+ 모니터링 설정 (선택사항)
  monitor_interval: 3000,       // 3초마다 모니터링

  // 클러스터 간 무중단 재로드
  merge_logs: false             // 각 인스턴스의 로그를 별도로 유지
};
```

### PM2 명령어

```bash
# 프로덕션 환경에서 시작
pm2 start ecosystem.config.js --env production

# 프로덕션 환경에서 재로드 (무중단)
pm2 reload ecosystem.config.js --env production

# 프로덕션 환경에서 재시작 (서비스 중단)
pm2 restart ecosystem.config.js --env production

# 상태 확인
pm2 status

# 모니터링 (실시간)
pm2 monit

# 로그 확인
pm2 logs ilsangkit-api
pm2 logs ilsangkit-web

# 특정 로그 파일 보기
pm2 logs ilsangkit-api --lines 100

# PM2 데몬 시작/중지
pm2 kill                        # PM2 데몬 종료 (모든 앱 중지)
pm2 resurrect                   # 마지막 저장된 목록 복구

# PM2 저장 및 부팅 시 자동 시작
pm2 save                        # 현재 목록 저장
pm2 startup                     # 서버 부팅 시 자동 시작 설정
```

### PM2 메모리 관리

각 인스턴스는 500MB 메모리 초과 시 자동 재시작됩니다:
- `max_memory_restart: '500M'`

모니터링:
```bash
pm2 monit
```

---

## GitHub Actions CI/CD 파이프라인

### 1. 테스트 워크플로우 (test.yml)

모든 커밋 및 PR에 대해 자동 실행됩니다.

```yaml
name: Test
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: ilsangkit_test
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    env:
      DATABASE_URL: mysql://root:testpassword@localhost:3306/ilsangkit_test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npx prisma db push --skip-generate
      - run: cd backend && npm run lint
      - run: cd backend && npm run test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npx nuxt prepare
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test
      - run: cd frontend && npm run build
```

**주요 포인트:**
- MySQL 서비스 컨테이너로 데이터베이스 테스트 지원
- 린트, 테스트, 빌드를 순차 실행
- 실패 시 배포 단계로 진행하지 않음

### 2. 배포 워크플로우 (deploy.yml)

테스트가 성공했을 때만 배포됩니다.

```yaml
name: Deploy to Cafe24

on:
  workflow_run:
    workflows: ["Test"]
    branches: [main]
    types:
      - completed

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Build Backend
        run: |
          cd backend
          npm ci
          npm run build

      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          NUXT_PUBLIC_API_BASE: ${{ secrets.NUXT_PUBLIC_API_BASE }}
          NUXT_PUBLIC_KAKAO_MAP_KEY: ${{ secrets.NUXT_PUBLIC_KAKAO_MAP_KEY }}
          NUXT_PUBLIC_GA_ID: ${{ secrets.NUXT_PUBLIC_GA_ID }}

      - name: Deploy to Cafe24 Server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          password: ${{ secrets.SERVER_PASSWORD }}
          source: "backend/dist,backend/package*.json,backend/prisma,frontend/.output,ecosystem.config.js"
          target: "/home/project2"
          strip_components: 0

      - name: Install Dependencies and Restart Services
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          password: ${{ secrets.SERVER_PASSWORD }}
          script: |
            cd /home/project2/backend
            npm ci --production

            # Prisma 클라이언트 생성
            npx prisma generate

            # PM2로 백엔드 재시작 (또는 첫 실행)
            pm2 describe ilsangkit-backend > /dev/null
            if [ $? -eq 0 ]; then
              pm2 restart ilsangkit-backend
            else
              pm2 start dist/server.js --name ilsangkit-backend
            fi

            # PM2로 프론트엔드 재시작 (또는 첫 실행)
            cd /home/project2/frontend
            pm2 describe ilsangkit-frontend > /dev/null
            if [ $? -eq 0 ]; then
              pm2 restart ilsangkit-frontend
            else
              pm2 start .output/server/index.mjs --name ilsangkit-frontend
            fi

            # PM2 설정 저장 (서버 재시작 시 자동 복구)
            pm2 save

      - name: Deployment Status
        run: echo "✅ Deployment completed successfully!"
```

**배포 단계:**
1. 코드 체크아웃
2. Node.js 환경 설정
3. 백엔드 빌드 (TypeScript → JavaScript)
4. 프론트엔드 빌드 (Nuxt SSR)
5. SCP로 파일 업로드
6. SSH로 원격 서버 명령 실행
7. PM2 앱 재시작

**시크릿 설정 (GitHub Settings):**
```
SERVER_HOST           = ilsangkit.com
SERVER_USER           = username
SERVER_PASSWORD       = password
NUXT_PUBLIC_API_BASE  = https://api.ilsangkit.com
NUXT_PUBLIC_KAKAO_MAP_KEY = your-key
NUXT_PUBLIC_GA_ID     = G-XXXXXXXXXX
```

### 3. Lighthouse 성능 게이트 (lighthouse.yml)

PR에서 프론트엔드 성능을 자동 검사합니다.

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/lighthouse.yml'
      - 'lighthouserc.js'

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      # ... (위의 파일 참고)
```

**성능 임계값:**
- Performance ≥ 90
- Accessibility ≥ 85
- Best Practices ≥ 80
- SEO ≥ 90

---

## 환경별 설정

### 개발 환경 (로컬)

```bash
# Docker Compose로 MySQL 시작
docker compose up -d

# 환경 변수 설정 (.env)
DATABASE_URL=mysql://ilsangkit:ilsangkit123@localhost:3307/ilsangkit
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# 백엔드 개발 서버
cd backend
npm run dev

# 프론트엔드 개발 서버 (별도 터미널)
cd frontend
npm run dev

# 접속: http://localhost:3000
```

### 프로덕션 환경 (Cafe24)

**디렉토리 구조:**
```
/home/project2/
├── backend/
│   ├── dist/              # TypeScript 빌드 결과
│   ├── prisma/            # DB 스키마
│   ├── package.json
│   ├── package-lock.json
│   └── logs/
│       ├── api-error.log
│       └── api-out.log
├── frontend/
│   ├── .output/           # Nuxt 빌드 결과
│   └── logs/
│       ├── web-error.log
│       └── web-out.log
└── ecosystem.config.js
```

**환경 변수 (.env):**
```bash
DATABASE_URL=mysql://ilsangkit:password@localhost:3306/ilsangkit
PORT=8000
NODE_ENV=production
CORS_ORIGIN=https://ilsangkit.com
OPENAPI_SERVICE_KEY=your-api-key
```

**시작 명령어:**
```bash
# PM2로 시작 (자동 재시작 포함)
pm2 start ecosystem.config.js --env production
```

---

## 모니터링 및 로깅

### 헬스 체크 엔드포인트

각 서비스는 헬스 체크 엔드포인트를 제공합니다:

**백엔드:**
```
GET http://ilsangkit.com/api/health

응답:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600.5
}
```

**프론트엔드:**
```
GET http://ilsangkit.com/health

응답:
200 OK
```

Nginx에서 주기적으로 헬스 체크하여 장애 인스턴스를 자동으로 제외합니다.

### PM2 로그

```bash
# 실시간 모니터링
pm2 monit

# 백엔드 로그
pm2 logs ilsangkit-api
pm2 logs ilsangkit-api --lines 100
pm2 logs ilsangkit-api --err

# 프론트엔드 로그
pm2 logs ilsangkit-web
pm2 logs ilsangkit-web --err

# 로그 파일 직접 확인
tail -f /home/project2/backend/logs/api-error.log
tail -f /home/project2/frontend/logs/web-error.log
```

### 프로세스 상태

```bash
# 현재 상태
pm2 status

# 상세 정보
pm2 info ilsangkit-api

# 실시간 CPU/메모리
pm2 monit
```

---

## 무중단 배포 (Zero-Downtime Deployment)

### 프론트엔드 무중단 배포

```bash
# 클러스터 모드에서 인스턴스 1, 2를 순차 재시작
pm2 reload ilsangkit-web --update-env

# 클라이언트 요청은 활성 인스턴스로 라우팅되므로 서비스 중단 없음
```

### 백엔드 무중단 배포

```bash
# API 요청이 다른 인스턴스로 자동 전환
pm2 reload ilsangkit-api --update-env
```

**Nginx는 헬스 체크로 죽은 인스턴스를 감지하고 요청을 살아있는 인스턴스로 라우팅합니다.**

---

## 문제 해결 (Troubleshooting)

### 배포 실패

```bash
# 1. PM2 프로세스 상태 확인
pm2 status

# 2. 로그 확인
pm2 logs ilsangkit-api --err

# 3. 파일 권한 확인
ls -la /home/project2/backend/dist/

# 4. 환경 변수 확인
cat /home/project2/backend/.env

# 5. 데이터베이스 연결 확인
mysql -u ilsangkit -p ilsangkit
```

### 높은 메모리 사용

```bash
# 메모리 모니터링
pm2 monit

# 인스턴스 수 조정
# ecosystem.config.js에서 instances 감소
pm2 reload ecosystem.config.js --env production
```

### Nginx 오류

```bash
# 설정 검증
sudo nginx -t

# 로그 확인
sudo tail -f /var/log/nginx/error.log

# 재로드
sudo systemctl reload nginx
```

---

## 보안 체크리스트

- [ ] HTTPS/SSL 인증서 설정 (Let's Encrypt)
- [ ] Nginx 보안 헤더 설정 (CSP, HSTS, X-Frame-Options)
- [ ] Rate Limiting 활성화
- [ ] CORS 설정 검증
- [ ] 환경 변수 보호 (GitHub Secrets)
- [ ] 데이터베이스 암호 강력함
- [ ] 방화벽 설정 (필요한 포트만 개방)

---

## 참고 자료

- [PM2 공식 문서](https://pm2.keymetrics.io/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Nuxt 배포 가이드](https://nuxt.com/docs/getting-started/deployment)
- [Express 프로덕션 체크리스트](https://expressjs.com/en/advanced/best-practice-performance.html)

