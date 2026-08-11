# Product Ops & Content Architecture v2

## Why
- `kids-coloring-app`은 선화/trace/fill 엔진과 회귀 하네스는 강해졌지만, 운영 데이터와 콘텐츠 구조는 아직 가볍다.
- 참고 대상인 `1122`는 Unity 기반 상용 앱으로, analytics / paywall / review / notification / Addressables 기반 콘텐츠 분리가 붙어 있다.
- 우리 앱은 Unity 전환이 아니라, 현재 웹/PWA 구조를 유지한 채 `운영 계측`과 `content pack 구조`를 추가하는 것이 맞다.

## Goal
- 사진/그림 입력 품질과 실제 사용 흐름을 운영 데이터로 볼 수 있게 한다.
- preset/sample/theme/premium 자산을 pack 단위로 분리해 콘텐츠 확장 구조를 만든다.
- 알고리즘 개선과 제품 운영 개선이 서로 연결되는 v2 로드맵을 만든다.

## Current Strengths
- 선화 품질 파이프라인:
  - `js/bg-remove.js`
  - `js/edge-detect.js`
  - `js/lineart-shape.js`
  - `js/trace-path.js`
- 상호작용/UX:
  - `js/app.js`
  - `js/particles.js`
  - `js/ui-utils.js`
- 검증 하네스:
  - `verify-fill-regions.html`

## Gaps
- 실제 업로드 사용 흐름에 대한 운영 데이터가 없다.
- `preset`과 `mode`가 코드 중심으로 묶여 있어, free/premium/theme/sample 확장이 어렵다.
- 검증 하네스는 강하지만, 그 결과를 실사용 데이터와 연결하지 못한다.

## Analytics Event Plan

### Principles
- 1단계는 경량 로컬 큐 또는 콘솔 이벤트로 시작한다.
- 2단계에서만 원격 수집(endpoint or analytics tool)을 붙인다.
- 이벤트는 `selectedMode`와 `resolvedMode`를 항상 함께 남겨, `object -> illustration` 자동 전환 같은 중요한 분기를 잃지 않는다.

### Core Events

| Event | Trigger | Required Fields |
|------|---------|-----------------|
| `upload_started` | 사용자가 파일 선택 후 처리 시작 | `selectedMode`, `mimeType`, `fileSize` |
| `pipeline_resolved` | `resolvePipelineMode()` 완료 | `selectedMode`, `resolvedMode`, `whiteRatio`, `darkRatio`, `vividRatio`, `paletteBuckets`, `textureScore` |
| `lineart_completed` | `runFullPipeline()` 완료 | `resolvedMode`, `detail`, `parts`, `fillRegions`, `largestRegion`, `runtimeMs` |
| `preview_opened` | preview 화면 활성화 | `resolvedMode`, `detail` |
| `trace_started` | 따라그리기 시작 | `resolvedMode`, `parts`, `traceStrategy` |
| `trace_completed` | trace 완료 후 color 전환 또는 완주 | `resolvedMode`, `parts`, `elapsedMs` |
| `color_started` | 색칠하기 모드 진입 | `resolvedMode`, `fillRegions` |
| `fill_action` | 영역 색칠 성공 | `regionId`, `regionArea`, `color`, `burstTriggered` |
| `undo_used` | undo 실행 | `mode`, `resolvedMode`, `regionFillUndo` |
| `save_image` | 저장 성공 | `mode`, `resolvedMode` |
| `verification_failed` | 하네스 gate 실패 | `selectedMode`, `resolvedMode`, `darkRatio`, `parts`, `fillRegions`, `reason` |

### Suggested Hook Points
- `js/edge-detect.js`
  - `resolvePipelineMode()`
  - `runFullPipeline()`
- `js/app.js`
  - upload 처리 시작 지점
  - preview 진입
  - `beginTraceDirect()`
  - `beginColorDirect()`
  - `fillRegionAtCanvasPoint()`
  - `undo()`
  - `saveImage()`
- `verify-fill-regions.html`
  - portrait/object/illustration gate 실패 시점

### Minimal Data Model
```json
{
  "name": "lineart_completed",
  "ts": 1786450000000,
  "selectedMode": "object",
  "resolvedMode": "illustration",
  "detail": 50,
  "darkRatio": 0.128,
  "parts": 6,
  "fillRegions": 6,
  "runtimeMs": 157.9
}
```

### Rollout
1. Local queue + debug console
2. Hidden diagnostics panel or exported JSON session dump
3. Optional remote collection with privacy-safe payloads only

## Content Pack Architecture

### Why Packs
- 현재는 `presets.js`와 앱 로직이 강하게 묶여 있다.
- 앞으로는 `theme`, `sample`, `guide`, `premium`을 데이터 중심으로 늘릴 수 있어야 한다.
- `1122`의 Addressables처럼 운영형 콘텐츠 확장을 하고 싶지만, 웹 구조에 맞는 가벼운 pack 레이어로 시작한다.

### Pack Types
| Type | Purpose |
|------|---------|
| `preset-pack` | 내장 프리셋 묶음 |
| `sample-pack` | photo/object/illustration 예시 샘플 |
| `guide-pack` | onboarding, trace lesson, smart mission guide |
| `theme-pack` | animals, vehicles, shapes, space 같은 카테고리 |
| `premium-pack` | 나중에 paywall과 연결할 확장 팩 |

### Proposed File Structure
```text
/home/sang/Projects/kids-coloring-app/js/packs.js
/home/sang/Projects/kids-coloring-app/js/packs/
  registry.js
  preset-packs.js
  sample-packs.js
  theme-packs.js
  premium-packs.js
```

### Pack Metadata Shape
```json
{
  "id": "animals-basic",
  "type": "theme-pack",
  "title": "동물 기본팩",
  "premium": false,
  "modeHints": ["illustration", "object"],
  "items": 24,
  "cover": "animals-basic-cover.png",
  "gates": {
    "illustration": { "darkRatioMax": 0.35, "partsMin": 3, "partsMax": 8 },
    "object": { "darkRatioMax": 0.55, "partsMin": 3 }
  }
}
```

### Ownership
- `js/presets.js`
  - 단기적으로는 기존 프리셋 소스 유지
  - 중기적으로는 `preset-pack` 데이터를 읽는 thin adapter로 축소
- `js/app.js`
  - pack 선택/로딩 상태만 관리
- `verify-fill-regions.html`
  - pack별 regression gate를 시각화하는 뷰로 확장 가능

### Immediate Benefits
- free / premium 구분 준비
- illustration 전용 pack 운영 가능
- seasonal pack, brand pack, lesson pack 추가가 쉬워짐
- photo sample QA 세트를 pack처럼 관리 가능

## Product Roadmap v2

### M1. Instrumentation Baseline
- analytics 이벤트 최소 세트 추가
- verification 결과를 session 단위 JSON으로 저장 가능하게 함
- 목적: 품질 회귀와 실제 사용 흐름을 같은 언어로 보게 만들기

### M2. Pack Registry Introduction
- `presets.js`를 유지하되, pack registry 초안을 추가
- sample/theme/preset의 데이터 경계를 먼저 분리
- 목적: 콘텐츠 운영 기반 만들기

### M3. Guided Content Layer
- trace lesson / smart mission sample / onboarding sample을 `guide-pack`으로 분리
- 목적: 엔진 기능을 콘텐츠 경험으로 연결

### M4. Premium-Ready Data Model
- `premium-pack` 메타데이터만 먼저 도입
- 실제 결제는 나중에 붙여도, 데이터 구조는 미리 분리
- 목적: 1122처럼 제품 확장 가능한 구조 준비

### M5. Validation-Driven Release Gate
- `verify-fill-regions.html` 결과를 pack별 기준치와 연결
- portrait/object/illustration pack이 모두 gate를 통과해야 release 후보로 간주
- 목적: 콘텐츠 양이 늘어나도 품질 하락을 막기

## Recommended Order
1. `M1 Instrumentation Baseline`
2. `M2 Pack Registry Introduction`
3. `M5 Validation-Driven Release Gate`
4. `M3 Guided Content Layer`
5. `M4 Premium-Ready Data Model`

## Decision
- 알고리즘 축은 현재 CPU Canny 기반 + mode-aware 후처리 방향을 유지한다.
- 제품 구조 축은 Unity로 옮기지 않고, 웹/PWA에 맞는 `analytics + pack registry + validation gate`를 쌓는다.
- `1122`에서 배울 것은 엔진이 아니라 `운영 구조와 콘텐츠 분리 방식`이다.

## Acceptance for This Design
- 이벤트 이름과 필드가 구현 가능한 수준으로 구체적일 것
- pack 구조가 현재 파일 구조를 깨지 않고 도입 가능할 것
- v2 로드맵이 `엔진 품질`과 `제품 운영` 둘 다 연결할 것

## Implemented on 2026-08-11
- `js/analytics.js`를 추가해 경량 이벤트 큐와 `window.__kidsAnalytics` 디버그 스냅샷을 도입했다.
- `js/app.js`에 `upload_started`, `pipeline_resolved`, `lineart_completed`, `preview_opened`, `trace_started`, `trace_completed`, `color_started`, `fill_action`, `undo_used`, `save_image` 이벤트를 최소 침습으로 연결했다.
- `js/packs.js`와 `js/packs/` 아래 registry/preset/sample/theme/premium pack 파일을 추가했다.
- 기존 `js/presets.js`는 그대로 두고, `preset-pack`이 이를 감싸는 thin adapter 방식으로 연결했다.
