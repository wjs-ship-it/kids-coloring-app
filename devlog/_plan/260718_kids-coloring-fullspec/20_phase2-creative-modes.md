# Phase 2: Creative Modes + Mode Selection UI

## Goal
3가지 창의적 모드 추가 + 모드 선택 화면 구현.

## File Changes

### NEW: `js/creative.js` (~200 lines)
Three creative modes:

#### 1. Free Sketch (자유 스케치)
- White canvas, no template
- Full color palette + brush sizes
- Same drawing engine as color mode but no boundary constraints
- Export: `initFreeSketch(canvas, ctx)`

#### 2. Kaleidoscope Mirror (만화경)
- User draws in one sector
- Drawing is mirrored/rotated across N axes (default 6)
- Implementation: on each stroke, replicate at 360/N degree rotations
- Center point = canvas center
- Export: `initKaleidoscope(canvas, ctx, segments=6)`

#### 3. Neon Glow (네온 글로우)
- Dark background (#1a1a2e)
- Bright neon colors with glow effect
- Implementation: draw stroke normally, then draw same stroke with larger width + low opacity (simulated glow via shadowBlur)
- Neon palette: hot pink, electric blue, lime green, bright yellow, purple
- Export: `initNeonGlow(canvas, ctx)`

### MODIFY: `index.html`
Add mode selection screen between preview and canvas:

```html
<div id="mode-screen" class="screen">
  <div class="app-title">어떻게 놀까?</div>
  <div class="mode-grid">
    <button class="mode-card" data-mode="trace">
      <span class="mode-icon">✏️</span>
      <span class="mode-name">따라 그리기</span>
    </button>
    <button class="mode-card" data-mode="color">
      <span class="mode-icon">🎨</span>
      <span class="mode-name">색칠하기</span>
    </button>
    <button class="mode-card" data-mode="sketch">
      <span class="mode-icon">🖍️</span>
      <span class="mode-name">자유 그리기</span>
    </button>
    <button class="mode-card" data-mode="kaleidoscope">
      <span class="mode-icon">🔮</span>
      <span class="mode-name">만화경</span>
    </button>
    <button class="mode-card" data-mode="neon">
      <span class="mode-icon">✨</span>
      <span class="mode-name">네온 매직</span>
    </button>
  </div>
</div>
```

CSS for mode cards: large rounded buttons in a 2-column grid, colorful backgrounds, bouncy tap animation.

### MODIFY: `js/app.js`
- Add mode selection logic
- Route to appropriate mode initializer
- Import creative.js modes
- trace/color modes: require photo (existing flow)
- sketch/kaleidoscope/neon modes: direct to canvas (no photo needed)

## Flow Change

### Before:
```
Upload → Processing → Preview → [Trace → Color]
```

### After:
```
Home → Upload photo OR choose preset OR creative mode
  ├─ Photo/Preset → Processing → Preview → Mode Select → [Trace | Color | Skip to Color]
  └─ Creative (no photo) → Mode Select → [Sketch | Kaleidoscope | Neon]
```
