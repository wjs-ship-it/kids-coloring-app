# Phase 3: Preset Templates + UI Polish + PWA + Deploy

## Goal
프리셋 템플릿 5종, UI 마무리, PWA 완성, mukja 배포 준비.

## File Changes

### NEW: `js/presets.js` (~120 lines)
5 built-in templates as Canvas drawing functions:

1. **고양이** — 기존 데모 이미지 개선 (더 선명한 선화)
2. **강아지** — 간단한 강아지 얼굴
3. **자동차** — 귀여운 자동차 side view
4. **집** — 집 + 나무 + 해
5. **꽃** — 큰 꽃 + 나비

Each preset draws clean line art on a Canvas → **사진 업로드와 동일한 파이프라인**을 탐:
1. `drawPreset_cat(ctx, w, h)` → Canvas에 선화 그리기
2. → `detectParts()` → 파트 분리
3. → 트레이싱 모드 (점선 따라그리기 + 관대한 판정 + 자석 효과)
4. → 색칠 모드

프리셋이든 사진이든 **동일한 트레이싱/색칠 경험** 제공.
Export: `PRESETS = [{name, emoji, draw}]`

### NEW: `icons/icon-192.png`, `icons/icon-512.png`
PWA icons (generated via Canvas: colorful crayon emoji on gradient background).

### MODIFY: `index.html`
Home screen redesign — 3 entry points:

```html
<div id="home-screen" class="screen active">
  <div class="app-title">키즈 컬러링 🎨</div>
  <div class="home-buttons">
    <button class="home-btn photo-btn" id="btn-start-photo">
      <span>📸</span><span>사진으로 그리기</span>
    </button>
    <button class="home-btn preset-btn" id="btn-show-presets">
      <span>🖼️</span><span>그림 고르기</span>
    </button>
    <button class="home-btn creative-btn" id="btn-show-creative">
      <span>✨</span><span>자유롭게 놀기</span>
    </button>
    <!-- [F1 FIX] 인라인 onclick 없음 — app.js에서 addEventListener로 바인딩 -->
  </div>
</div>

<div id="preset-screen" class="screen">
  <div class="preset-grid">
    <!-- 5 preset cards with preview thumbnails -->
  </div>
</div>
```

CSS additions:
- Home screen with 3 large entry buttons (vertical stack)
- Preset grid: 2-column card layout with thumbnail previews
- Overall color scheme consistency
- Touch feedback animations

### MODIFY: `js/app.js`
- Add preset loading flow
- Home → Preset Select → Mode Select → Activity
- Home → Photo → Processing → Preview → Mode Select → Activity
- Home → Creative → Mode Select → Activity (sketch/kaleidoscope/neon)

### NEW: `sw.js` (~80 lines) — Service Worker (오프라인 캐싱)
PWA 오프라인 100% 구동을 위한 Service Worker:
- **Install 이벤트**: 핵심 파일 사전 캐싱
  - index.html, js/*.js, icons/, manifest.json
  - @imgly/background-removal WASM 모델 파일 (~30MB)
  - CDN JS 리소스
- **Fetch 이벤트**: Cache-first 전략
  - 캐시에 있으면 → 즉시 반환 (오프라인 동작)
  - 없으면 → 네트워크 fetch → 캐시에 저장
- **WASM 캐싱 주의사항**:
  - @imgly WASM은 opaque response (CORS) → `cache.put()` 시 mode 확인
  - 용량이 크므로 Cache Storage quota 체크 (모바일 ~50MB 안전)
  - 캐시 버전 관리: `CACHE_V1` → 업데이트 시 이전 캐시 삭제
- **효과**: 놀이터, 차 안, 비행기 모드에서도 완벽 동작

### MODIFY: `index.html`
Service Worker 등록 추가:
```html
<script>
// [F3 FIX] 상대 경로 사용 — 서브패스 배포 (/kids/, /coloring/) 호환
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' });
}
</script>
```

### MODIFY: `manifest.json`
```json
{
  "name": "키즈 컬러링",
  "short_name": "컬러링",
  "description": "사진을 그림으로 바꿔서 따라 그리고 색칠해요!",
  "start_url": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f0f4ff",
  "theme_color": "#667eea",
  "categories": ["kids", "education", "games"],
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

## Deployment Notes
- mukja.co.kr 서브패스: `/kids/` 또는 `/coloring/`
- Static files only (no server needed)
- CORS not needed (no external API calls in v1)
- 첫 방문 시 WASM 모델 자동 다운로드 → 이후 오프라인 가능
- 로딩 화면에 "첫 실행 시 데이터를 받아와요 📦" 안내 표시
