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

## Implemented on 2026-08-11
- `js/lineart-shape.js`를 추가해 edge connected-component를 score 기반으로 선별하도록 했다.
- 가장 큰 border-touch contour는 silhouette로 강제 보존하고, 작은 질감선/잔선을 우선 제거한다.
- object 모드는 덜 공격적으로 fuse하고 최종 선 두께를 `2px`로 낮춰 `먹물 덩어리` 느낌을 줄였다.
