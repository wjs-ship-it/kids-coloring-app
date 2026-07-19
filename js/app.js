import { removeBackground } from './bg-remove.js';
import { createDemoCatBlob } from './demo.js';
import { initFreeSketch, initKaleidoscope, initNeonGlow, getNeonColors, getNeonBg, rebuildPalette } from './creative.js';
import { celebrate, updateProgress, showHint, showPartDone, hidePartDone, showScreen, setLoadingText } from './ui-utils.js';
import { PRESETS, renderPreset } from './presets.js';
import { detectParts } from './edge-detect.js';

const COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#a16207','#1e293b','#fef3c7','#bbf7d0','#bae6fd','#e9d5ff','#fecdd3'];
const BRUSHES = [{ s: 6, d: 8 }, { s: 14, d: 14 }, { s: 26, d: 22 }];
const SNAP_RADIUS = 30;
const TRACE_TOLERANCE = 40;
const COMPLETE_THRESHOLD = 0.88;

let appMode = 'trace', parts = [], curPartIdx = 0;
let traceZone = null, colorMask = null;
let lineartData = null, laW = 0, laH = 0, offX = 0, offY = 0;
let isDrawing = false, lastX = 0, lastY = 0;
let currentColor = '#1e293b', brushSize = 6, isEraser = false;
let historyStack = [];
let isProcessing = false;
let lastProcessTime = 0;
let edgeWorker = null;
let creativeMode = null;
let hasPhoto = false;

const DC = document.getElementById('drawing-canvas');
const cx = DC.getContext('2d');
const SC = document.createElement('canvas');
const sx = SC.getContext('2d');

function buildPalette() {
  rebuildPaletteForColors(COLORS);
  const b = document.getElementById('brush-bar');
  BRUSHES.forEach((br, i) => {
    const btn = document.createElement('button');
    btn.className = 'brush-pick' + (i === 1 ? ' active' : '');
    const dot = document.createElement('div');
    dot.className = 'bdot';
    dot.style.width = br.d + 'px';
    dot.style.height = br.d + 'px';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
      brushSize = br.s;
      document.querySelectorAll('.brush-pick').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
    });
    b.appendChild(btn);
  });
}

function pickColor(c, el) {
  currentColor = c; isEraser = false;
  document.getElementById('eraser-btn').classList.remove('active');
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
}

function toggleEraser() {
  isEraser = !isEraser;
  document.getElementById('eraser-btn').classList.toggle('active', isEraser);
  if (isEraser) document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
}


function goHome() {
  if (edgeWorker) { edgeWorker.terminate(); edgeWorker = null; }
  isProcessing = false;
  creativeMode = null;
  hasPhoto = false;
  showScreen('upload-screen');
  document.getElementById('photo-input').value = '';
}

async function loadDemoImage() {
  showScreen('processing-screen');
  const blob = await createDemoCatBlob();
  processPhoto(blob);
}

async function processPhoto(blob) {
  if (isProcessing) return;
  const now = Date.now();
  if (now - lastProcessTime < 500) return;
  lastProcessTime = now;
  isProcessing = true;
  showScreen('processing-screen');
  setLoadingText('배경을 지우는 중... 🧹');

  try {
    const cleanBlob = await removeBackground(blob);
    const img = await createImageBitmap(cleanBlob);
    setLoadingText('선을 그리는 중... ✏️');
    convertToLineart(img);
  } catch {
    const img = await createImageBitmap(blob);
    setLoadingText('선을 그리는 중... ✏️');
    convertToLineart(img);
  }
}


function convertToLineart(img) {
  const MAX = 800;
  let w = img.width, h = img.height;
  if (w > MAX || h > MAX) {
    const r = Math.min(MAX / w, MAX / h);
    w = Math.floor(w * r); h = Math.floor(h * r);
  }
  SC.width = w; SC.height = h;
  sx.drawImage(img, 0, 0, w, h);
  const imageData = sx.getImageData(0, 0, w, h);

  if (edgeWorker) edgeWorker.terminate();
  edgeWorker = new Worker('./js/edge-worker.js', { type: 'module' });

  edgeWorker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      setLoadingText(e.data.message);
      return;
    }
    if (e.data.type === 'result') {
      lineartData = new ImageData(new Uint8ClampedArray(e.data.lineartData), e.data.w, e.data.h);
      parts = e.data.parts;
      laW = e.data.w; laH = e.data.h;

      document.getElementById('preview-img').src = SC.toDataURL();
      const lp = document.getElementById('lineart-preview');
      lp.width = laW; lp.height = laH;
      lp.getContext('2d').putImageData(lineartData, 0, 0);
      showScreen('preview-screen');
      isProcessing = false;
      edgeWorker.terminate();
      edgeWorker = null;
    }
  };

  edgeWorker.onerror = () => {
    isProcessing = false;
    edgeWorker = null;
    alert('변환에 실패했어요. 다시 시도해주세요!');
    goHome();
  };

  edgeWorker.postMessage({ imageData: imageData.data, w, h });
}

function snapToLine(tx, ty, part) {
  let minDist = Infinity, snapX = tx, snapY = ty;
  for (let i = 0; i < part.boundaryPos.length; i += 3) {
    const pos = part.boundaryPos[i];
    const bx = (pos % laW) + offX;
    const by = Math.floor(pos / laW) + offY;
    const d = Math.sqrt((tx - bx) ** 2 + (ty - by) ** 2);
    if (d < minDist) { minDist = d; snapX = bx; snapY = by; }
  }
  if (minDist < SNAP_RADIUS) return { x: snapX, y: snapY, valid: true };
  if (minDist < TRACE_TOLERANCE) {
    const t = 0.6;
    return { x: tx + (snapX - tx) * t, y: ty + (snapY - ty) * t, valid: true };
  }
  return { x: tx, y: ty, valid: false };
}

function buildTraceZone(part) {
  const cw = DC.width, ch = DC.height;
  const zone = new Uint8Array(cw * ch);
  for (const pos of part.boundaryPos) {
    const lx = pos % laW, ly = Math.floor(pos / laW);
    const cx = lx + offX, cy = ly + offY;
    for (let dy = -TRACE_TOLERANCE; dy <= TRACE_TOLERANCE; dy++) {
      for (let dx = -TRACE_TOLERANCE; dx <= TRACE_TOLERANCE; dx++) {
        if (dx * dx + dy * dy <= TRACE_TOLERANCE * TRACE_TOLERANCE) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < cw && ny >= 0 && ny < ch) zone[ny * cw + nx] = 1;
        }
      }
    }
  }
  return zone;
}

function beginActivity() {
  DC.width = window.innerWidth; DC.height = window.innerHeight;
  cx.lineCap = 'round'; cx.lineJoin = 'round';
  offX = Math.floor((DC.width - laW) / 2);
  offY = Math.floor((DC.height - laH) / 2);
  curPartIdx = 0;
  appMode = 'trace';
  historyStack = [];
  document.getElementById('side-palette').classList.add('hidden');
  document.getElementById('brush-bar').classList.add('hidden');
  drawTraceBackground();
  showCurrentPart();
  showScreen('canvas-screen');
}

function drawTraceBackground() {
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, DC.width, DC.height);
  const ld = lineartData.data;
  cx.fillStyle = 'rgba(200,200,220,0.15)';
  for (let y = 0; y < laH; y++) {
    for (let x = 0; x < laW; x++) {
      if (ld[(y * laW + x) * 4] < 128) cx.fillRect(offX + x, offY + y, 1, 1);
    }
  }
}

function showCurrentPart() {
  if (curPartIdx >= parts.length) { transitionToColor(); return; }
  const part = parts[curPartIdx];
  traceZone = buildTraceZone(part);

  const ld = lineartData.data;
  cx.fillStyle = 'rgba(100,126,234,0.5)';
  for (const pos of part.boundaryPos) {
    const x = pos % laW, y = Math.floor(pos / laW);
    if ((x + y) % 6 < 4) cx.fillRect(offX + x, offY + y, 2, 2);
  }

  for (let i = 0; i < curPartIdx; i++) {
    cx.fillStyle = '#1e293b';
    for (const pos of parts[i].boundaryPos) {
      const x = pos % laW, y = Math.floor(pos / laW);
      cx.fillRect(offX + x, offY + y, 1, 1);
    }
  }

  saveState();
  updateProgress(0);
  document.getElementById('part-label').textContent = `${curPartIdx + 1}/${parts.length} ⭐`;
  showHint('점선을 따라 그려봐요! ✏️');
  currentColor = '#1e293b'; brushSize = 6; isEraser = false;
}

function checkTraceCompletion() {
  if (curPartIdx >= parts.length) return;
  const part = parts[curPartIdx];
  const id = cx.getImageData(0, 0, DC.width, DC.height), d = id.data;
  let covered = 0;
  for (const pos of part.samplePoints) {
    const x = pos % laW + offX, y = Math.floor(pos / laW) + offY;
    if (x < 0 || x >= DC.width || y < 0 || y >= DC.height) continue;
    let found = false;
    for (let dy = -15; dy <= 15 && !found; dy++) {
      for (let dx = -15; dx <= 15 && !found; dx++) {
        const px = x + dx, py = y + dy;
        if (px >= 0 && px < DC.width && py >= 0 && py < DC.height) {
          const idx = (py * DC.width + px) * 4;
          if (d[idx] < 80 && d[idx + 3] > 200) found = true;
        }
      }
    }
    if (found) covered++;
  }
  const pct = part.samplePoints.length > 0 ? covered / part.samplePoints.length : 1;
  updateProgress(pct);
  if (pct >= COMPLETE_THRESHOLD) advancePart();
}

function advancePart() {
  cx.fillStyle = '#1e293b';
  for (const pos of parts[curPartIdx].boundaryPos) {
    const x = pos % laW, y = Math.floor(pos / laW);
    cx.fillRect(offX + x, offY + y, 1, 1);
  }
  curPartIdx++;
  if (curPartIdx >= parts.length) {
    showPartDone('잘했어요! 🌟');
    setTimeout(transitionToColor, 1500);
  } else {
    showPartDone('⭐');
    setTimeout(() => { hidePartDone(); showCurrentPart(); }, 1000);
  }
  celebrate();
}

function transitionToColor() {
  hidePartDone();
  appMode = 'color';
  historyStack = [];
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, DC.width, DC.height);
  const ld = lineartData.data;
  cx.fillStyle = '#1e293b';
  for (let y = 0; y < laH; y++) {
    for (let x = 0; x < laW; x++) {
      if (ld[(y * laW + x) * 4] < 128) cx.fillRect(offX + x, offY + y, 1, 1);
    }
  }
  saveState();
  document.getElementById('side-palette').classList.remove('hidden');
  document.getElementById('brush-bar').classList.remove('hidden');
  updateProgress(1);
  document.getElementById('part-label').textContent = '🎨 색칠!';
  showHint('터치해서 색칠해봐요! 🎨');
  setTimeout(() => document.getElementById('hint-toast').style.display = 'none', 3000);
  currentColor = '#ef4444'; brushSize = 14; isEraser = false;
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  document.querySelector('.cdot').classList.add('active');
  traceZone = null; colorMask = null;
}

function beginColorDirect() {
  if (!lineartData) { beginActivity(); return; }
  DC.width = window.innerWidth; DC.height = window.innerHeight;
  cx.lineCap = 'round'; cx.lineJoin = 'round';
  offX = Math.floor((DC.width - laW) / 2);
  offY = Math.floor((DC.height - laH) / 2);
  creativeMode = null;
  transitionToColor();
  showScreen('canvas-screen');
}

function startCreativeMode(mode) {
  showScreen('canvas-screen');
  historyStack = [];
  traceZone = null; colorMask = null;

  if (mode === 'sketch') {
    creativeMode = initFreeSketch(DC, cx);
    appMode = 'color';
    currentColor = '#1e293b'; brushSize = 14; isEraser = false;
    rebuildPaletteForColors(COLORS);
  } else if (mode === 'kaleidoscope') {
    creativeMode = initKaleidoscope(DC, cx, 6);
    appMode = 'color';
    currentColor = '#667eea'; brushSize = 6; isEraser = false;
    rebuildPaletteForColors(COLORS);
  } else if (mode === 'neon') {
    creativeMode = initNeonGlow(DC, cx);
    appMode = 'color';
    currentColor = getNeonColors()[0]; brushSize = 8; isEraser = false;
    rebuildPaletteForColors(getNeonColors());
  }

  document.getElementById('side-palette').classList.remove('hidden');
  document.getElementById('brush-bar').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('part-label').textContent = mode === 'neon' ? '✨' : mode === 'kaleidoscope' ? '🔮' : '🖍️';
  saveState();
}

function rebuildPaletteForColors(colors) {
  rebuildPalette(colors, pickColor, toggleEraser);
}

function buildColorMask(startX, startY) {
  const cw = DC.width, ch = DC.height;
  const id = cx.getImageData(0, 0, cw, ch), d = id.data;
  if (startX < 0 || startX >= cw || startY < 0 || startY >= ch) return null;
  const si = (startY * cw + startX) * 4;
  if (d[si] < 50 && d[si + 1] < 50 && d[si + 2] < 50) return null;
  const mask = new Uint8Array(cw * ch);
  const queue = [[startX, startY]]; let front = 0;
  mask[startY * cw + startX] = 1;
  const maxPx = cw * ch * 0.4; let cnt = 0;
  while (front < queue.length && cnt < maxPx) {
    const [x, y] = queue[front++]; cnt++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= cw || ny < 0 || ny >= ch) continue;
      const np = ny * cw + nx;
      if (mask[np]) continue;
      const idx = np * 4;
      if (d[idx] < 50 && d[idx + 1] < 50 && d[idx + 2] < 50) continue;
      mask[np] = 1;
      queue.push([nx, ny]);
    }
  }
  return mask;
}

function getPos(e) {
  const r = DC.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

function onStart(e) {
  e.preventDefault();
  const p = getPos(e);
  const px = Math.floor(p.x), py = Math.floor(p.y);

  if (creativeMode) {
    isDrawing = true; lastX = p.x; lastY = p.y;
    return;
  }

  if (appMode === 'color' && !isEraser) {
    colorMask = buildColorMask(px, py);
    if (!colorMask) return;
    isDrawing = true; lastX = p.x; lastY = p.y;
    return;
  }

  if (appMode === 'trace') {
    if (!traceZone || !traceZone[py * DC.width + px]) return;
  }
  isDrawing = true; lastX = p.x; lastY = p.y;
}

function onMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  const p = getPos(e);
  const px = Math.floor(p.x), py = Math.floor(p.y);

  if (appMode === 'trace') {
    const snap = snapToLine(px, py, parts[curPartIdx]);
    if (!snap.valid) { lastX = p.x; lastY = p.y; return; }
    cx.globalCompositeOperation = 'source-over';
    cx.strokeStyle = currentColor;
    cx.lineWidth = brushSize;
    cx.beginPath(); cx.moveTo(lastX, lastY); cx.lineTo(snap.x, snap.y); cx.stroke();
    lastX = snap.x; lastY = snap.y;
    return;
  }

  if (appMode === 'color' && colorMask) {
    if (px < 0 || px >= DC.width || py < 0 || py >= DC.height || !colorMask[py * DC.width + px]) {
      lastX = p.x; lastY = p.y; return;
    }
  }

  if (creativeMode && creativeMode.drawStroke && !isEraser) {
    creativeMode.drawStroke(lastX, lastY, p.x, p.y, currentColor, brushSize);
    lastX = p.x; lastY = p.y;
    return;
  }

  cx.globalCompositeOperation = 'source-over';
  const eraserColor = (creativeMode && creativeMode.type === 'neon') ? getNeonBg() : '#ffffff';
  cx.strokeStyle = isEraser ? eraserColor : currentColor;
  cx.lineWidth = isEraser ? brushSize * 3 : brushSize;
  cx.beginPath(); cx.moveTo(lastX, lastY); cx.lineTo(p.x, p.y); cx.stroke();
  lastX = p.x; lastY = p.y;
}

function onEnd() {
  if (!isDrawing) return;
  isDrawing = false;
  colorMask = null;
  saveState();
  if (appMode === 'trace') checkTraceCompletion();
}


function saveState() {
  historyStack.push(cx.getImageData(0, 0, DC.width, DC.height));
  if (historyStack.length > 10) historyStack.shift();
}

function undo() {
  if (historyStack.length > 1) {
    historyStack.pop();
    cx.putImageData(historyStack[historyStack.length - 1], 0, 0);
  }
}

function saveImage() {
  const link = document.createElement('a');
  link.download = 'coloring-' + Date.now() + '.png';
  link.href = DC.toDataURL();
  link.click();
  const t = document.getElementById('save-toast');
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
  celebrate();
}


// Event bindings (no inline onclick)
document.getElementById('photo-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  processPhoto(f);
});

document.getElementById('btn-upload').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});
document.getElementById('btn-demo').addEventListener('click', loadDemoImage);
document.getElementById('btn-begin').addEventListener('click', () => { hasPhoto = true; showScreen('mode-screen'); });
document.getElementById('btn-other-photo').addEventListener('click', goHome);
document.getElementById('btn-back').addEventListener('click', goHome);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-save').addEventListener('click', saveImage);
document.getElementById('btn-creative').addEventListener('click', () => { hasPhoto = false; showScreen('mode-screen'); });
document.getElementById('btn-mode-back').addEventListener('click', () => {
  showScreen(hasPhoto ? 'preview-screen' : 'upload-screen');
});

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'trace') { beginActivity(); return; }
    if (mode === 'color') { beginColorDirect(); return; }
    if (mode === 'sketch') { startCreativeMode('sketch'); return; }
    if (mode === 'kaleidoscope') { startCreativeMode('kaleidoscope'); return; }
    if (mode === 'neon') { startCreativeMode('neon'); return; }
  });
});

document.getElementById('btn-presets').addEventListener('click', () => showScreen('preset-screen'));
document.getElementById('btn-preset-back').addEventListener('click', () => showScreen('upload-screen'));

function buildPresetGrid() {
  const grid = document.getElementById('preset-grid');
  PRESETS.forEach((preset, idx) => {
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.innerHTML = `<span class="preset-emoji">${preset.emoji}</span><span class="preset-name">${preset.name}</span>`;
    card.addEventListener('click', () => loadPreset(idx));
    grid.appendChild(card);
  });
}

function loadPreset(idx) {
  const result = renderPreset(PRESETS[idx], SC, sx);
  lineartData = result.lineartData;
  laW = result.size; laH = result.size;
  parts = detectParts(result.outData, result.size, result.size);
  const lp = document.getElementById('lineart-preview');
  lp.width = result.size; lp.height = result.size;
  lp.getContext('2d').putImageData(lineartData, 0, 0);
  document.getElementById('preview-img').src = SC.toDataURL();
  hasPhoto = true;
  showScreen('mode-screen');
}

DC.addEventListener('touchstart', onStart, { passive: false });
DC.addEventListener('mousedown', onStart);
DC.addEventListener('touchmove', onMove, { passive: false });
DC.addEventListener('mousemove', onMove);
DC.addEventListener('touchend', onEnd);
DC.addEventListener('mouseup', onEnd);
DC.addEventListener('mouseleave', onEnd);

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!document.getElementById('canvas-screen').classList.contains('active')) return;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const saved = cx.getImageData(0, 0, DC.width, DC.height);
    DC.width = window.innerWidth; DC.height = window.innerHeight;
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, DC.width, DC.height);
    cx.putImageData(saved, 0, 0);
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    resizeTimer = null;
  }, 250);
});

buildPalette();
buildPresetGrid();
