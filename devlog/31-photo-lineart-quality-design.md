# Photo Lineart Quality Design

## Problem
- 현재 사진 변환 결과는 `그림을 이해한 선화`보다 `명암 에지를 모두 살린 윤곽 추출`에 가깝다.
- 그래서 트레이싱 경로가 조각난 외곽선 일부를 따라가고, 얼굴/눈/입 같은 핵심 특징은 뭉개지거나 검은 덩어리처럼 합쳐진다.
- 사용자 체감은 `선을 잘라놓은 느낌`, `그리기가 뭉개짐`, `형태 이해 없이 단순 edge만 추종`이다.

## Goal
- 기존 CPU Canny 기반은 유지하되, 후처리를 `모든 선 유지`에서 `그릴 만한 선만 남기기`로 전환한다.
- 최종 목표는 `사진을 단순히 edge로 바꾸는 것`이 아니라 `유아가 따라 그릴 수 있는 선화`를 만드는 것이다.

## Phase 1 Strategy
1. `주요 윤곽 우선 보존`
   - 가장 큰 외곽 윤곽은 반드시 유지
   - 의미 없는 미세 컴포넌트와 짧은 질감선은 제거
2. `중심부 특징선 선택 보존`
   - portrait 모드에서는 중앙 ROI의 작은 특징선(눈/입/코 후보)을 일부 남긴다
   - object 모드에서는 넓은 윤곽과 구조선 위주로 단순화한다
3. `선 두께 완화`
   - 최종 normalize target을 낮춰 검은 덩어리처럼 보이는 인상을 줄인다
4. `연결은 유지하되 blob은 줄이기`
   - bridge/close는 유지하지만, 마지막 단계에서 contour score 기반 pruning을 수행한다

## Implementation Notes
- 새 보조 모듈에서 edge connected-component를 분석해 `area`, `span`, `border-touch`, `center distance` 기반 score를 계산한다.
- 가장 큰 border-touch contour는 silhouette로 강제 보존한다.
- 모드별 허용 component 수와 최소 면적을 다르게 둔다.
- 이 pruning은 `buildFillRegions()` 이전이 아니라 최종 lineart 직전에 적용해 fill 안정성은 최대한 유지한다.

## Expected Result
- 불필요한 점/털/질감선이 줄어든다
- 얼굴/몸통 같은 큰 형태가 더 명확하게 남는다
- 트레이싱 경로가 자잘한 조각보다 큰 윤곽을 더 잘 따라간다
- 결과적으로 `뭉개진 먹물` 느낌이 줄고, `그릴 수 있는 선화`에 가까워진다

## Phase 2 Candidate
- contour spline 단순화
- portrait/object별 ROI 규칙 강화
- subject segmentation 또는 salient contour ranking 도입

## Regression Gates
- `verify-fill-regions.html` preset gate
  - parts `1+`
  - largest region `100px+`
  - fill pixels `> 0`
  - undo diff `0`
- photo gate: `portrait`
  - dark ratio `< 0.70`
  - parts `3~10`
  - fill regions `4+`
- photo gate: `object`
  - dark ratio `< 0.55`
  - parts `3+`
  - fill regions `4+`

## Implemented on 2026-08-11
- `js/lineart-shape.js`를 추가해 edge connected-component를 score 기반으로 선별하도록 했다.
- 가장 큰 border-touch contour는 silhouette로 강제 보존하고, 작은 질감선/잔선을 우선 제거한다.
- object 모드는 덜 공격적으로 fuse하고 최종 선 두께를 `2px`로 낮춰 `먹물 덩어리` 느낌을 줄였다.
- portrait 모드에서 RGB만 보던 grayscale 변환을 alpha-aware 합성으로 바꿨다. 투명 배경은 흰색으로 합성해 edge 입력에 덜 섞이게 한다.
- `bg-remove.js`의 fallback을 no-op 원본 반환에서 `중앙 인물 보존 + 가장자리 백화` 휴리스틱으로 교체했다.
- 실제 인물 사진 업로드 검증에서 `lineart-preview` dark ratio가 `0.93 → 0.47`로 내려가 검정판 현상이 크게 줄었다.
- `js/trace-path.js`를 추가해 trace path 생성을 `raw edge 조각`에서 `단순화된 outer contour + 내부 특징선` 조합으로 교체했다.
- `detectParts()`는 이제 `mode/detail` 옵션을 받아 path 단순화 강도와 part 수를 조절한다. worker/app 경로에도 이 옵션을 전부 연결했다.
- 새 simplified trace part가 생긴 뒤 `ensureFullCoverage()`가 다시 30개 파트까지 부풀리던 문제를 막아, portrait trace가 `1/30`이 아니라 실제 `1/6` 파트로 시작되도록 수정했다.
- 실제 브라우저 검증에서 portrait 업로드 trace는 `1/6`, preset trace는 `1/5`로 시작했고, detail `20 → 80` 변경 시 worker 결과가 `parts 6 → 7`, `fillRegions 15 → 27`로 다시 계산되는 것을 확인했다.
- `verify-fill-regions.html`를 preset/photo 이중 섹션 구조로 정리하고, 현재 회귀 기준 수치를 화면과 문서에 동시에 노출했다.
- portrait fallback background removal은 `중앙 얼굴/상반신 보호`, `가장자리/상하 밝은 배경 백화` 방향으로 한 번 더 조정했다.
- portrait trace interior 선별은 `얼굴 상단 중심부`를 더 우선 보존하고, 내부 파트 수와 샘플링 수를 줄여 `잘린 조각` 느낌을 더 완화하도록 조정했다.
- portrait lineart가 여전히 과하게 어두우면, `runFullPipeline()` 안에서 더 높은 임계값/큰 최소 면적/짧은 bridge 거리로 한 번 더 보수적인 variant를 재시도하는 adaptive density guard를 추가했다.
- flat illustration / character 입력은 photo edge 규칙으로 망가질 가능성이 높아서, `illustration` 전용 lane을 추가했다. object 선택 상태에서도 흰 배경 비율, palette bucket 수, texture score를 보고 illustration-like 입력이면 내부적으로 `illustration` 모드로 자동 전환한다.
- illustration lane은 `dark pixel + local contrast` 기반 선 추출을 우선 사용하고, line width / trace part 분할 / meaningful edge selection도 더 보존적으로 조정했다. verify 하네스에도 `illustration` 모드를 추가해 dark ratio `< 0.35`, parts `3~8`, fill regions `4+`를 gate로 둔다.
