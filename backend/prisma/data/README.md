# CSV 데이터 파일 가이드

동기화 스크립트는 이 디렉토리의 CSV 파일을 사용합니다.
data.go.kr에서 표준데이터를 다운로드하여 아래 파일명으로 저장하세요.

## 다운로드 URL

| 카테고리 | data.go.kr URL | 파일명 |
|---------|---------------|--------|
| 공공화장실 | https://www.data.go.kr/data/15012892/standard.do | `toilet.csv` |
| 무료와이파이 | https://www.data.go.kr/data/15013116/standard.do | `wifi.csv` |
| 의류수거함 | https://www.data.go.kr/data/15139214/standard.do | `clothes.csv` |
| 공영주차장 | https://www.data.go.kr/data/15012896/standard.do | `parking.csv` |
| 공공도서관 | https://www.data.go.kr/data/15013109/standard.do | `library.csv` |

## 다운로드 방법

1. 위 URL에서 data.go.kr 로그인
2. "CSV" 형식 선택하여 다운로드
3. 다운로드된 파일을 이 디렉토리(`backend/prisma/data/`)에 위 파일명으로 저장
4. EUC-KR 인코딩 파일 그대로 사용 (자동 감지됨)

## 동기화 실행

```bash
npm run sync:toilet     # 공공화장실
npm run sync:wifi       # 무료와이파이
npm run sync:clothes    # 의류수거함
npm run sync:parking    # 공영주차장
npm run sync:library    # 공공도서관 (추가 예정)
npm run sync:facilities # 전체 동기화
```

clothes, parking, library는 `--mode api` 옵션으로 API 모드도 사용 가능합니다.

## 병원 상세정보 (extra_hospital_latest)

병원 진료시간·진료과목 등 상세정보 시딩에는 HIRA(건강보험심사평가원) xlsx 데이터가 필요합니다.

### 다운로드 방법

1. [HIRA 공공데이터개방포털](https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925) 접속
2. **"전국 병의원 및 약국 현황"** 최신 zip 파일 다운로드 (예: `전국 병의원 및 약국 현황 2025.12.zip`)
3. zip 압축 해제 후 xlsx 파일들을 `backend/prisma/data/extra_hospital_latest/` 디렉토리에 배치

### 필요한 파일

| 파일 | 용도 |
|------|------|
| `4.의료기관별상세정보서비스_02_세부정보 *.xlsx` | 진료시간, 점심시간, 휴진 안내 등 |
| `5.의료기관별상세정보서비스_03_진료과목정보 *.xlsx` | 진료과목별 의사 수 |

### 시딩 실행

```bash
npm run seed:hospital-detail
```
