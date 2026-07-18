# Phase 1: Architecture Refactor + Canny Edge Detection + Tracing Engine

## Goal
단일 index.html(560줄)을 모듈로 분리하고, Sobel → Canny 엣지 검출로 교체하고, 트레이싱 엔진을 유아 친화적으로 개선.

## File Changes

### NEW: `js/edge-worker.js` (~200 lines) ⭐ Web Worker (Module Worker)
모든 무거운 CV 연산을 백그라운드 스레드에서 처리:
- **[F2 FIX] Module Worker로 생성**: `new Worker('js/edge-worker.js', {type: 'module'})`
  - Worker 내에서 ES `import { cannyEdge, ... } from './edge-detect.js'` 사용 가능
  - edge-detect.js는 표준 ES export 유지 → app.js와 worker 모두 동일하게 import
- CLAHE, Bilateral Filter 2-pass, Sobel, NMS, Hysteresis, 형태학적 후처리
- Main thread → Worker: `postMessage({imageData, w, h})`
- Worker → Main thread: `postMessage({lineartData, parts, progress})`
- 모바일에서 2~3초 소요되더라도 메인 스레드 프리징 없음
- 처리 중 귀여운 로딩 애니메이션 유지

### NEW: `js/edge-detect.js` (~150 lines)
Worker에서 호출하는 순수 함수 모음:
- `applyCLAHE(gray, w, h, tileSize=8, clipLimit=2.0) → Float32Array`
- `bilateralFilter(gray, w, h, r=9, sigC=75, sigS=75) → Float32Array`
- `cannyEdge(gray, w, h, thHigh, thLow) → Uint8Array`
- `dualPassEdge(gray, w, h) → Uint8Array` (이목구비 보존)
- `morphClose(edges, w, h, kernelSize) → Uint8Array`
- `removeSmallComponents(edges, w, h, minArea=30) → Uint8Array`
- `normalizeLineWidth(edges, w, h, targetWidth=2) → Uint8Array`
- `validateFloodFillIntegrity(edges, w, h) → {leakCount, leakPositions}`
- `detectParts(lineartData, w, h) → Part[]`

### NEW: `js/bg-remove.js` (~60 lines)
@imgly/background-removal 연동:
- **[F5 FIX] 메인 스레드에서 실행** (Worker 내부 아님)
  - @imgly는 내부적으로 자체 WASM worker를 생성 → 커스텀 Worker 중첩 시 제약
  - 파이프라인: 메인에서 bg-remove 완료 → 결과 ImageData를 Worker에 전달 → Worker가 CLAHE~후처리
- CDN: `https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/dist/index.mjs`
  (구현 시 실제 CDN URL 검증 필수 — audit에서 외부 검증 불가)
- `removeBackground(imageBlob) → Promise<ImageData>`
- 초기 로딩 시 모델 다운로드 → 이후 캐시에서 즉시
- 실패 시 fallback: dominant-color 배경 감지 → 흰색 치환
- 사용자 인터랙션 불필요 (GrabCut처럼 박스 안 그어도 됨)
- Export: `hasBackgroundRemoval() → boolean`

### NEW: `js/ai-bridge.js` (~40 lines)
AI integration placeholder:
- `convertWithAI(imageBlob) → Promise<ImageData|null>`
- Checks for API key in localStorage
- If no key: returns null (fallback to Canny)
- If key exists: calls OpenAI API via fetch
- Export: `hasAICapability() → boolean`

### NEW: `js/app.js` (~250 lines)
Main app logic extracted from index.html <script>:
- State management (appMode, parts, colors, brushes)
- Screen navigation
- Drawing handlers (touch/mouse) + snap-to-line 자석 효과
- Trace completion checking (관대한 판정)
- Color mode (flood fill mask, brush painting)
- Undo/save/celebrate
- Worker 관리: `new Worker('js/edge-worker.js', { type: 'module' })`
- **Worker 요청 Debounce/Guard**:
  - `isProcessing` 플래그 — Worker 작업 중이면 새 요청 무시
  - 연속 사진 촬영 시 최소 500ms debounce
  - 동시 Worker 인스턴스 1개로 제한 (기존 Worker 종료 후 재생성)
  - 모바일 발열/배터리 과부하 방지
- Import from bg-remove.js, ai-bridge.js

### MODIFY: `index.html` (~180 lines, down from 560)
- Remove all <script> content (moved to js/app.js)
- Add `<script type="module" src="js/app.js"></script>`
- **[F1 FIX] 인라인 onclick 전부 제거**: 모든 `onclick="goHome()"` 등을
  `id="btn-xxx"` 로 변경. `app.js`에서 `document.getElementById().addEventListener()`로 바인딩.
  - 이유: `type="module"` 스코프는 전역이 아니므로 인라인 핸들러에서
    모듈 내 함수를 호출할 수 없음 (ReferenceError)
  - 영향: loadDemoImage, beginActivity, goHome, undo, saveImage + Phase 2/3 추가 버튼 모두
- 로딩 화면 개선: 단순 "변환 중..." → 귀여운 다단계 진행 애니메이션
  - "배경을 지우는 중... 🧹" → "선을 그리는 중... ✏️" → "거의 다 됐어요! 🎨"

### MODIFY: `manifest.json`
- Phase 1에서는 `categories` 추가만
- ⚠️ [F4 FIX] icon-512 항목은 Phase 3에서 아이콘 파일 생성 후 추가 (시기 불일치 방지)

## Edge Detection: Full Pipeline (유아 캐릭터 사진 최적화)

### Before (현재, 문제점):
```js
const MAX=500;  // 해상도 너무 낮음
// 3x3 Gaussian만 → 질감 노이즈 잔뜩
// 단일 threshold (15%) → 그림자가 먹물 덩어리로
// 이목구비 날아감 → 아이가 뭔지 못 알아봄
```

### After (10단계 파이프라인):
```
=== 전처리 (Pre-processing) ===

0. 해상도 정규화: MAX=800px (현재 500 → 800)
   - 4K 사진도 파라미터 일관성 보장
   - 디테일은 살리되 노이즈는 줄이는 최적 크기

1. CLAHE (Contrast Limited Adaptive Histogram Equalization)
   - 그레이스케일 변환 후 적용
   - 국부적 명암비 균일화 → 그림자 영역의 외곽선 살림
   - JS 구현: 8x8 타일, clipLimit=2.0
   - 효과: 코 밑 그림자, 팔 아래 그림자 → 먹물 아닌 깔끔한 선

2. 강한 Bilateral Filter (질감 뭉개기)
   - 반경 9px, σ_color=75, σ_space=75
   - 경계선(윤곽)은 보존하면서 내부 질감만 밀어버림
   - 복슬복슬 인형 → 매끄러운 표면으로 변환 후 선 추출
   - 2-pass 적용 (더 강한 스무딩)

=== 엣지 추출 (Edge Detection) ===

3. Sobel gradient magnitude + direction angle

4. Non-maximum suppression (1px 얇은 선)

5. Double threshold + Hysteresis
   - strong=0.12, weak=0.04 of max
   - weak edge가 strong에 연결되면 유지

=== 후처리 (Post-processing) ===

6. 이목구비 보존 패스 (Dual-pass edge)
   - 1차 패스: 외곽 실루엣 (높은 threshold)
   - 2차 패스: 얼굴 내부 디테일 (낮은 threshold, 중심부 ROI만)
   - 두 결과 합성 → 실루엣 + 이목구비 모두 살림

7. Morphological close (적응적 커널, 선 끊김 메우기)
   ⚠️ 커널 밸런스 최적화 (Leakage vs Detail 트레이드오프):
   - 커널이 작으면 (3x3): 틈 남음 → flood fill 번짐 (Leakage)
   - 커널이 크면 (7x7): 이목구비 뭉개짐
   - 전략: 적응적 2단계 closing
     Step A: 3x3 closing (기본 — 디테일 보존)
     Step B: flood fill 무결성 검증 (validateFloodFillIntegrity)
     Step C: leak 발견 시 → leak 위치 주변만 5x5 국소 closing
   - [9] 선 두께 정규화와 연계: closing 후 2px 정규화가
     추가 gap을 메워주므로, closing은 보수적으로 시작

8. 소규모 컴포넌트 제거 (<30px 면적)
   - 그림자/반사에서 오인된 자잘한 점들 제거
   - 빛 반사로 생긴 가짜 엣지 제거

9. 선 두께 정규화 + Flood Fill 검증
   - 모든 선을 2px 균일 두께로 정규화
   - 정규화 후 2차 flood fill 무결성 검증
   - leak 발견 시: 해당 위치 dilation 1px 추가 패치
   - 최종 보장: 모든 닫힌 영역이 flood fill safe
```

### 성능 및 브라우저 아키텍처:
- **Web Worker 필수**: 전체 파이프라인(CLAHE + bilateral 2-pass + Canny + 후처리)을
  `js/edge-worker.js`에서 실행. 모바일 2~3초 소요되어도 UI 프리징 없음.
  - Main → Worker: `postMessage({imageData, w, h})`
  - Worker → Main: `postMessage({lineartData, parts, progress})`
  - progress 메시지로 다단계 로딩 텍스트 업데이트

### 배경 제거:
- **@imgly/background-removal** (WASM 기반, 브라우저 100% 동작)
  - CDN: `https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/dist/index.mjs` (ESM)
  - 모델 ~30MB, 브라우저 캐시 활용 → 2회차부터 즉시
  - 사용자 인터랙션 불필요 (GrabCut처럼 박스 안 그려도 됨)
  - 메인 스레드에서 실행 (Worker 내부 아님, F5 참조)
  - 실패/미지원 시 fallback: dominant-color 배경 감지 → 흰색 치환
- **rembg**: U²-Net 170MB → AI 서버 옵션으로만 (미래)

### JS 직접 구현:
- **CLAHE**: 타일 기반 히스토그램 이퀄라이제이션 (Worker 내)
- **Bilateral Filter**: O(n*r²), r=9 → Worker에서 ~200ms @800px
- **Flood Fill 무결성 검증 (Dummy Flood Fill)**:
  Worker 내부에서 메인 스레드 반환 전에 자동 실행:
  1. 이미지 4모서리 (0,0), (w-1,0), (0,h-1), (w-1,h-1)에서 가상 flood fill 실행
  2. 모서리 fill이 캐릭터 내부 영역(이미지 중심부 50% 범위)까지 침투 시 → leak 판정
  3. leak 지점 역추적 → 해당 위치 주변 5x5 국소 closing 패치
  4. 패치 후 재검증 (최대 3회 반복, 이후 통과 처리)
  5. 검증 결과를 progress 메시지로 전달: "선을 보강하는 중... 🔧"

### 테스트 이미지 가이드 (Phase 1 검증용):
1. **밝은 조명 캐릭터** — 기본 케이스
2. **그림자 있는 인형** — CLAHE + bilateral 검증
3. **복슬복슬 텍스처** — bilateral 강도 검증
4. **고해상도 4K 사진** — 해상도 정규화 검증
5. **이목구비 복잡한 캐릭터** — dual-pass 검증

## Tracing Engine Upgrade: 유아 친화적 개선

### 현재 문제:
```js
const TRACE_RADIUS = 15;  // 판정 반경이 작음
// 손가락이 zone 밖이면 그리기 중단 → 유아에게 좌절감
// 그린 선이 손가락 위치 그대로 → 삐뚤삐뚤하게 보임
```

### 개선 1: 관대한 판정 (Wide Tolerance Zone)
```
Before: TRACE_RADIUS = 15px (좁은 원형)
After:  TRACE_TOLERANCE = 40px (넓은 투명 복도)
```
- 점선 경로를 따라 40px 폭의 투명 폴리곤(두꺼운 Path) 생성
- 아이 손가락이 이 영역 안에만 있으면 "잘하고 있다"로 판정
- 완성 체크도 넓은 범위 (samplePoint 주변 ±8px → ±15px)
- 영역 밖으로 나가도 그리기를 즉시 끊지 않고, 부드럽게 무시 (stroke 끊김 방지)

### 개선 2: 자석 효과 (Snap-to-Line)
```
사용자 터치 좌표 (tx, ty)
    ↓
점선 경로에서 가장 가까운 점 (sx, sy) 찾기
    ↓
거리 d = dist(touch, snap)
    ↓
if d < SNAP_RADIUS(30px):
  실제 그려지는 좌표 = snap point (sx, sy)  ← 점선 위에 예쁘게
else if d < TOLERANCE(40px):
  실제 그려지는 좌표 = lerp(touch, snap, 0.6) ← 부분 보정
else:
  그리기 무시 (너무 멀리 벗어남)
```
- 아이가 대충 점선 근처만 따라가도 선이 윤곽선 위에 깔끔하게 그려짐
- 결과물이 예쁘게 나와서 **성취감 극대화**
- snap point 계산: boundaryPos를 미리 정렬된 배열로 저장, 가장 가까운 점 탐색

### 개선 3: 시각적 피드백 강화
- 현재 파트의 점선을 **반짝이는 애니메이션**으로 표시 (static → animated dash)
- 완성된 파트는 **무지개 색 축하 라인**으로 변경 (단순 검정 → 그라데이션)
- 진행률 바에 **별 이모지 증가** (⭐ → ⭐⭐ → ⭐⭐⭐)

### 구현 위치:
- `js/app.js`의 `onMove()`, `onStart()`, `checkTraceCompletion()` 함수 수정
- `buildTraceZone()` → `buildTraceZoneWide()` (40px tolerance)
- 새 함수: `snapToLine(touchX, touchY, part) → {x, y}` (자석 효과)
