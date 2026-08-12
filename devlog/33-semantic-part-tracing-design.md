# Semantic Part Tracing Design

## Problem
- 현재 `kids-coloring-app`의 tracing part 생성은 `raw edge fragment`를 직접 추적하던 구조에서 `단순화된 outer contour + 일부 interior contour`로 한 단계 좋아졌지만, 여전히 `그림의 의미 단위`를 이해하지는 못한다.
- 그래서 `illustration` 입력에서도 사용자는 `머리`, `손`, `발`, `꼬리`를 따라 그린다고 느끼기보다, `곡선 조각 몇 개`를 따라 그리는 느낌을 받는다.
- 최근 커비 비교 스크린샷에서 이 문제가 명확했다.
  - 우리 앱: 머리 윗부분 조각, 뜬금없는 직선 조각, 사용자가 이해하기 어려운 첫 part
  - 경쟁 예시: 공룡 `머리 → 목 → 몸통 → 다리 → 꼬리` 같은 의미 있는 part 단위

## Goal
- tracing 경로를 `contour fragment 중심`에서 `semantic part 중심`으로 바꾼다.
- 특히 `illustration` 모드에서는 사용자가 다음처럼 느끼게 한다.
  - `지금 머리부터 그리고 있구나`
  - `지금 팔/다리를 따로 그리고 있구나`
  - `마지막에 몸통/꼬리를 완성하는구나`
- 즉 목표는 `선을 잘 따라가게 한다`가 아니라, `그림을 이해한 순서로 따라가게 한다`이다.

## Non-Goal
- 비전 모델/LLM/외부 AI segmentation을 바로 붙이지 않는다.
- 사진용 `portrait`/`object` 선화 품질 개선과 본 설계는 분리한다.
- `region fill` 엔진이나 색칠 UX를 이번 설계의 직접 대상에 포함하지 않는다.

## Current State

### Current flow
```text
upload
-> bg-remove.js (portrait only)
-> edge-detect.js runFullPipeline()
-> lineart-shape.js meaningful edge pruning
-> trace-path.js detectTraceParts()
-> app.js beginTraceDirect()
```

### Current limitation in `js/trace-path.js`
- `buildOuterContourParts()`
  - 전체 edge contour를 단순화한 뒤 길이 기준으로 몇 개 segment로 분할한다.
- `buildInteriorParts()`
  - 내부 void region의 boundary를 다시 contour로 따서 score 순으로 고른다.
- 이 구조는 `큰 외곽 + 내부 장식선`에는 유효하지만, 아래를 보장하지 못한다.
  - 파트 하나가 의미 단위일 것
  - tracing 시작점이 사용자에게 자연스러울 것
  - 분할 순서가 구조적으로 이해 가능할 것

결과적으로 지금 part는 `shape-aware`이지만, 아직 `part-aware`는 아니다.

## Target UX

### Desired tracing order
`illustration` 입력에서는 아래 우선순위가 기본이다.

1. 큰 실루엣 파트
2. 명확한 부속 파트
   - 팔
   - 다리
   - 귀/꼬리/날개
3. 주요 얼굴/표정 파트
   - 눈
   - 입
   - 코/볼
4. 장식/디테일 파트

### Example: Kirby-like character
- `머리/몸통 외곽`
- `왼손`
- `오른손`
- `왼발`
- `오른발`
- `얼굴 디테일`
- `받침/별 외곽`

### Example: Dinosaur-like character
- `머리`
- `목`
- `몸통`
- `앞다리`
- `뒷다리`
- `꼬리`
- `몸통 무늬`

## Proposed Strategy

### Core shift
기존 방식:
- `contour -> simplify -> split -> parts`

바꿀 방식:
- `lineart -> candidate regions/strokes -> semantic role scoring -> part assembly -> ordered trace parts`

핵심은 contour를 자르는 게 아니라, **후보 파트를 먼저 만들고 그 뒤에 tracing path를 만들도록 순서를 뒤집는 것**이다.

## Semantic Part Model

### Part categories
`trace-path.js` 안에서 최종 part는 아래 카테고리 중 하나를 가진다.

| category | meaning |
|---|---|
| `silhouette` | 가장 큰 외곽 또는 몸통 중심 실루엣 |
| `limb` | 손/발/팔/다리/지느러미/날개처럼 몸통에 붙은 작은 부속 |
| `head_feature` | 눈/입/코/볼/귀 일부처럼 얼굴/머리의 특징선 |
| `tail_feature` | 꼬리/뿔/귀 등 후방 또는 돌출 파트 |
| `ornament` | 무늬/점/장식/배경성 디테일 |

### Required fields
각 semantic part는 기존 `part` 구조를 유지하되 메타데이터를 확장한다.

```js
{
  pixels,
  boundaryPos,
  samplePoints,
  traceStrategy: 'semantic',
  semanticCategory: 'limb',
  semanticScore: 0.84,
  sourceRegionId: 12,
  bbox: { minX, minY, maxX, maxY },
  centroid: { x, y },
  attachSide: 'left' | 'right' | 'top' | 'bottom' | 'center',
  drawOrder: 3
}
```

## Part Extraction Pipeline

### Phase A. Candidate extraction
입력 lineart에서 아래 두 종류를 먼저 뽑는다.

1. `closed interior candidates`
- 현재 `collectVoidRegions()` 결과를 재활용
- 닫힌 영역 또는 반닫힌 돌출 구조 후보를 수집

2. `outer silhouette anchors`
- 현재 `traceContour(isEdge)` 결과를 기반으로 body-scale contour를 확보
- 단순화 전후 길이, curvature, width/height, centroid를 기록

### Phase B. Structural clustering
candidate들을 바로 tracing part로 쓰지 않고, 먼저 구조 단위로 묶는다.

규칙:
- 큰 외곽과 매우 가까운 작은 region은 `부속 파트` 후보
- 중심선 부근의 작은 닫힌 region은 `얼굴 디테일` 후보
- 하단부의 둥근 닫힌 region은 `발/다리` 후보
- 좌우 대칭 쌍은 하나의 semantic layer로 취급 가능

### Phase C. Role scoring
각 candidate에 대해 semantic score를 준다.

예시 feature:
- `area ratio`
- `bbox aspect ratio`
- `centroid position normalized`
- `distance to silhouette`
- `touch count with silhouette`
- `left/right symmetry pair 존재 여부`
- `top-half / bottom-half / center-band 여부`
- `curvature density`

예시 판단:
- 큰 중심 외곽 = `silhouette`
- 아래쪽에 있는 유사 크기 두 region = `limb`
- 중심 상단의 작은 두 region = `head_feature`
- 한쪽 끝으로 길게 돌출 = `tail_feature`

## Part Assembly Rules

### 1. Silhouette first, but not always full body first
경쟁 예시처럼 항상 전체 외곽 한 번으로 시작할 필요는 없다. 다만 사용자가 이해 가능한 큰 구조가 먼저 나와야 한다.

권장 기본:
- `illustration.character_round`
  - 머리/몸통 외곽
  - limbs
  - 얼굴 디테일
- `illustration.animal_longneck`
  - 머리
  - 목
  - 몸통
  - 다리
  - 꼬리

즉 semantic type에 따라 첫 part가 달라질 수 있다.

### 2. One part = one understandable gesture
각 part는 가능하면 사용자가 한 붓으로 이해할 수 있어야 한다.

금지:
- 짧은 contour 조각 3개를 따로따로 첫 part로 노출
- 의미 없는 윗곡선 일부만 독립 part로 분리

허용:
- 하나의 limb 외곽 전체
- 얼굴 outline의 절반 이상
- 몸통 바깥 contour의 명확한 한 구간

### 3. Symmetry-aware ordering
좌우 발/손이 비슷한 형태면:
- 왼쪽 → 오른쪽
- 위 → 아래
- 바깥 → 안쪽
중 하나의 일관된 규칙으로 정렬한다.

커비 같은 입력에서는 `발 2개`, `손 2개`가 같은 깊이 레이어로 보여야 한다.

## Mode-specific Rules

### `illustration`
본 설계의 주 적용 대상.
- semantic decomposition 적극 사용
- contour fragment 직접 분할 최소화
- 닫힌 단순 도형과 symmetry를 강하게 활용

### `object`
- 즉시 full semantic으로 가지 않는다.
- 큰 외곽 + 뚜렷한 부속 파트까지만 적용
- 사진 계열 사물은 의미 단위 추정 오탐이 많을 수 있으므로 보수적으로 둔다.

### `portrait`
- 이번 설계에서는 직접 적용하지 않는다.
- 얼굴 특징선 semantic decomposition은 따로 난이도가 높다.
- portrait는 이후 별도 phase에서 다룬다.

## Shape Family Presets

`illustration` 내부에서도 입력 형상군을 구분해야 한다.

### Family candidates
| family | heuristic |
|---|---|
| `round_character` | 큰 원형 몸통, 하단 limb 쌍, 작은 얼굴 feature |
| `longneck_animal` | 상단 소형 head + 세로 neck + 대형 torso + tail |
| `quadruped_simple` | torso + 다리 4개 + tail |
| `sticker_object` | 단일 외곽 + 소수 interior feature |

### Why this matters
커비와 공룡의 이상적인 part ordering은 다르다.
- 커비: 몸통/얼굴/손발
- 공룡: 머리/목/몸통/다리/꼬리

따라서 `semantic family classifier`가 필요하다. 모델이 아니라 휴리스틱으로 먼저 시작한다.

## Proposed Module Boundary

### Existing files
```text
/home/sang/Projects/kids-coloring-app/js/edge-detect.js
/home/sang/Projects/kids-coloring-app/js/trace-path.js
/home/sang/Projects/kids-coloring-app/js/app.js
```

### Recommended split
```text
/home/sang/Projects/kids-coloring-app/js/trace-path.js
/home/sang/Projects/kids-coloring-app/js/trace-semantic.js
/home/sang/Projects/kids-coloring-app/js/trace-shape-family.js
```

### Ownership
- `trace-path.js`
  - public entry 유지
  - `detectTraceParts()` orchestration만 담당
- `trace-semantic.js`
  - candidate extraction
  - role scoring
  - semantic part assembly
- `trace-shape-family.js`
  - `illustration` 입력의 family 분류
  - `round_character`, `longneck_animal` 등 규칙 테이블 보유

이렇게 나누면 기존 public API를 깨지 않고 내부 알고리즘을 교체할 수 있다.

## Rollout Plan

### Phase 1. Illustration semantic-only prototype
- `illustration` 모드에서만 semantic tracing 활성화
- family 2종만 지원
  - `round_character`
  - `longneck_animal`
- 기존 `simplified` part와 A/B 비교 가능하도록 유지

### Phase 2. Ordered part UX
- `partLabel`을 단순 `1/7`이 아니라 의미 라벨 실험 가능하도록 준비
  - 예: `1/7 · 머리`
  - 예: `2/7 · 다리`
- 내부 debug only로 먼저 노출 가능

### Phase 3. Verification harness extension
- `verify-fill-regions.html`에 tracing section 추가
- 수치 gate뿐 아니라 semantic gate를 추가
  - first part overlap with silhouette/body/head expected zone
  - isolated fragment ratio
  - tiny first-part penalty

## Acceptance Criteria

### UX criteria
- 커비류 입력에서 첫 part가 `머리/몸통 외곽`으로 인식 가능해야 한다.
- 공룡류 입력에서 첫 3개 part가 최소한 `머리/목/몸통` 또는 그에 준하는 큰 구조여야 한다.
- 사용자가 “왜 여기만 점선이지?”보다 “아 지금 이 부분이구나”를 느껴야 한다.

### Technical gates
- `illustration` 모드에서 첫 part bbox가 전체 bbox의 `8%` 미만이면 실패
- first 3 parts 중 2개 이상이 `semanticCategory !== ornament` 이어야 함
- isolated fragment count를 현재 대비 유의미하게 줄여야 함
- 기존 `fillRegions` gate는 유지

## Risks
- 휴리스틱 semantic 분류는 캐릭터 스타일 편차에 취약할 수 있다.
- 공룡에는 잘 맞아도 커비류 둥근 캐릭터에서는 과분할 또는 오분류 가능성이 있다.
- portrait에 같은 규칙을 섣불리 적용하면 악화될 수 있다.

그래서 rollout은 반드시 `illustration only`로 시작해야 한다.

## Decision
- 다음 tracing 진화의 핵심은 선화 품질 추가 개선이 아니라, `part decomposition 철학`을 contour fragment 중심에서 semantic part 중심으로 바꾸는 것이다.
- 구현은 기존 `detectTraceParts()` API를 유지한 채 내부에 `semantic part lane`을 추가하는 방식으로 진행한다.
- 1차 적용 대상은 `illustration`이며, 커비/공룡처럼 이미 정리된 캐릭터 입력에서 먼저 성공시킨다.
