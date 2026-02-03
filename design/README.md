# 일상킷 UI 디자인 목업

Stitch MCP를 사용하여 생성된 반응형 웹 디자인 목업입니다.

## Stitch 프로젝트 정보

- **Project ID**: `13520770059433682326`
- **Project Name**: 일상킷 UI 디자인
- **생성일**: 2026-02-02

## 스크린 목록

### 모바일 (Mobile First)

| 스크린 | Screen ID | 설명 |
|--------|-----------|------|
| [모바일 랜딩](./mobile_landing_page/) | `45ced88c3dfb44f48ba3939dfc0a19e2` | 홈 화면, 검색창, 카테고리 칩 |
| [검색 결과 목록](./mobile_search_list/) | `40627f81ecd84f0cbba05278579ac289` | 시설 카드 목록, 필터 |
| [검색 결과 지도](./mobile_map_view/) | `b97f33e8b0f14f5ebeb62c58425a27ca` | 전체 화면 지도, 바텀시트 |
| [시설 상세 (화장실)](./mobile_facility_detail_page_(toilet)/) | `2f6fab8c822744d2825c4bcbbaeef256` | 시설 정보, 길찾기 버튼 |

### 데스크톱 (Desktop)

| 스크린 | Screen ID | 설명 |
|--------|-----------|------|
| [데스크톱 랜딩](./desktop_landing_page/) | `2f5f528f511949e98334cdb03bd48623` | 중앙 검색, 카테고리 그리드 |
| [검색 결과 + 지도](./desktop_search_results_map_view/) | `4303feb311134da2bbc047baf83b79d4` | 2컬럼 분할 (목록 + 지도) |
| [시설 상세](./desktop_facility_detail_page/) | `35a17deac11b4ccc954db0723545a71c` | 2컬럼 분할 (정보 + 지도) |

## 디자인 토큰

```css
:root {
  /* Primary Colors */
  --color-primary: #3c83f6;
  --color-primary-dark: #2563eb;

  /* Background */
  --color-background-light: #f9fafb;
  --color-background-dark: #101722;

  /* Text */
  --color-text-primary: #111418;
  --color-text-secondary: #60708a;

  /* Category Colors */
  --color-toilet: #8b5cf6;  /* Purple */
  --color-trash: #10b981;   /* Green */
  --color-wifi: #3b82f6;    /* Blue */
  --color-clothes: #f59e0b; /* Orange */
  --color-kiosk: #8b5cf6;   /* Purple */
}
```

## 접근성 점수

- **WCAG Level**: AA
- **Score**: 85/100
- **주요 권장사항**: 폼 입력에 레이블 연결 필요

## 파일 구조

```
design/
├── README.md
├── mobile_landing_page/
│   └── screen.png
├── mobile_search_list/
│   └── screen.png
├── mobile_map_view/
│   └── screen.png
├── mobile_facility_detail_page_(toilet)/
│   └── screen.png
├── desktop_landing_page/
│   └── screen.png
├── desktop_search_results_map_view/
│   └── screen.png
└── desktop_facility_detail_page/
    └── screen.png
```

## 사용법

각 폴더의 `screen.png`는 디자인 목업 이미지입니다.
Stitch 프로젝트에서 HTML 코드를 가져오려면:

```bash
# Stitch MCP 도구 사용
mcp__stitch__fetch_screen_code --projectId 13520770059433682326 --screenId <SCREEN_ID>
```
