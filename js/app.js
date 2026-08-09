import { createDemoCatBlob } from './demo.js';
import { initFreeSketch, initKaleidoscope, initNeonGlow, getNeonColors, getNeonBg, rebuildPalette } from './creative.js';
import { celebrate, updateProgress, showHint, showPartDone, hidePartDone, showScreen, setLoadingText } from './ui-utils.js';
import { PRESETS, renderPreset } from './presets.js';
import { detectParts, dilate, fuseLines, normalizeLineWidth, buildFillRegions } from './edge-detect.js';

const COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#a16207','#1e293b','#fef3c7','#bbf7d0','#bae6fd','#e9d5ff','#fecdd3'];
const BRUSHES = [{ s: 6, d: 8 }, { s: 14, d: 14 }, { s: 26, d: 22 }];
const SNAP_RADIUS = 30;
const TRACE_TOLERANCE = 40;
const COMPLETE_THRESHOLD = 0.90;

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
let edgeMode = 'object';
let detailLevel = 50;
let _sourceImgData = null, _sourceW = 0, _sourceH = 0;
let detailTimer = null;
let lineBoundary = null;
let _maskCvs = null, _drawCvs = null, _baseCvs = null;
let lineartOverlay = null;
let activeClip = false;
let fillLineMask = null;
let fillRegionMap = null;
let fillRegions = [];
let fillRegionsById = [];
let paintByRegion = [];

function isRegionFillColorMode() {
  return appMode === 'color' && !creativeMode && !!fillRegionMap && fillRegions.length > 0;
}

const DC = document.getElementById('drawing-canvas');
const cx = DC.getContext('2d');
const SC = document.createElement('canvas');
const sx = SC.getContext('2d');

const DEBUG_MAX_EVENTS = 120;

function debugMark(stage, extra = {}) {
  const entry = {
    at: new Date().toISOString(),
    stage,
    screen: document.querySelector('.screen.active')?.id || null,
    ...extra
  };
  const store = window.__kidsDebug ?? { events: [] };
  store.last = entry;
  store.events.push(entry);
  if (store.events.length > DEBUG_MAX_EVENTS) store.events.shift();
  window.__kidsDebug = store;
  console.log('[kids-debug]', entry);
  return entry;
}

window.addEventListener('error', (event) => {
  debugMark('window-error', {
    message: event.message,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  debugMark('unhandled-rejection', {
    reason: reason?.message || String(reason)
  });
});

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
  lineBoundary = null;
  lineartOverlay = null;
  activeClip = false;
  showScreen('upload-screen');
  document.getElementById('photo-input').value = '';
}

async function loadDemoImage() {
  debugMark('demo-start');
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
  debugMark('processPhoto-start', { blobType: blob?.type || 'unknown', blobSize: blob?.size || null });
  showScreen('processing-screen');
  setLoadingText('AI 요정이 그림을 그리고 있어요... ✨');

  const img = await createImageBitmap(blob);
  debugMark('processPhoto-imageBitmap-ready', { width: img.width, height: img.height });
  setLoadingText('선을 그리는 중... ✏️');
  convertToLineart(img);
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

  _sourceImgData = imageData.data.slice();
  _sourceW = w;
  _sourceH = h;
  detailLevel = 50;
  debugMark('convertToLineart-ready', { width: w, height: h });
  document.getElementById('detail-slider').value = 50;
  document.getElementById('detail-slider-wrap').style.display = '';

  runEdgeWorker(imageData.data, w, h, true);
}

function runEdgeWorker(rawData, w, h, isFirstRun) {
  if (edgeWorker) edgeWorker.terminate();
  edgeWorker = new Worker('./js/edge-worker.js', { type: 'module' });
  debugMark('worker-start', { width: w, height: h, isFirstRun, edgeMode, detailLevel });

  const sliderWrap = document.getElementById('detail-slider-wrap');

  edgeWorker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      debugMark('worker-progress', { step: e.data.step, message: e.data.message });
      if (isFirstRun) setLoadingText(e.data.message);
      return;
    }
    if (e.data.type === 'result') {
      debugMark('worker-result', {
        width: e.data.w,
        height: e.data.h,
        parts: e.data.parts?.length || 0,
        fillRegions: e.data.fillRegions?.regions?.length || 0
      });
      lineartData = new ImageData(new Uint8ClampedArray(e.data.lineartData), e.data.w, e.data.h);
      parts = e.data.parts;
      laW = e.data.w; laH = e.data.h;
      hydrateFillData(e.data.fillRegions);

      if (isFirstRun) {
        document.getElementById('preview-img').src = SC.toDataURL();
      }
      const lp = document.getElementById('lineart-preview');
      lp.width = laW; lp.height = laH;
      lp.getContext('2d').putImageData(lineartData, 0, 0);

      if (isFirstRun) showScreen('preview-screen');
      isProcessing = false;
      sliderWrap.classList.remove('processing');
      edgeWorker.terminate();
      edgeWorker = null;
    }
  };

  edgeWorker.onerror = (event) => {
    debugMark('worker-error', {
      message: event.message,
      lineno: event.lineno,
      colno: event.colno,
      filename: event.filename
    });
    isProcessing = false;
    sliderWrap.classList.remove('processing');
    edgeWorker = null;
    if (isFirstRun) {
      alert('변환에 실패했어요. 다시 시도해주세요!');
      goHome();
    }
  };

  edgeWorker.postMessage({ imageData: rawData, w, h, mode: edgeMode, detail: detailLevel });
}

function analyzeLineartInWorker(lineart, w, h, task, onDone) {
  if (edgeWorker) edgeWorker.terminate();
  edgeWorker = new Worker('./js/edge-worker.js', { type: 'module' });
  debugMark('lineart-analysis-start', { width: w, height: h, task });

  edgeWorker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      debugMark('lineart-analysis-progress', { step: e.data.step, message: e.data.message });
      setLoadingText(e.data.message);
      return;
    }
    if (e.data.type === 'parts-result') {
      parts = e.data.parts || [];
      debugMark('lineart-analysis-result', {
        parts: parts.length,
        task
      });
      edgeWorker.terminate();
      edgeWorker = null;
      onDone();
      return;
    }
    if (e.data.type === 'fill-regions-result') {
      hydrateFillData(e.data.fillRegions);
      debugMark('lineart-analysis-result', {
        fillRegions: fillRegions.length,
        task
      });
      edgeWorker.terminate();
      edgeWorker = null;
      onDone();
    }
  };

  edgeWorker.onerror = (event) => {
    debugMark('lineart-analysis-error', {
      message: event.message,
      lineno: event.lineno,
      colno: event.colno,
      filename: event.filename
    });
    edgeWorker = null;
    isProcessing = false;
    alert('프리셋 준비에 실패했어요. 다시 시도해주세요!');
    goHome();
  };

  edgeWorker.postMessage({
    task,
    imageData: lineart.data || lineart,
    w,
    h
  });
}

function ensurePresetTraceReady(onDone) {
  if (!lineartData) return;
  if (parts && parts.length > 0) {
    onDone();
    return;
  }
  showScreen('processing-screen');
  setLoadingText('따라 그릴 길을 준비하는 중... ✏️');
  analyzeLineartInWorker(lineartData, laW, laH, 'detect-parts', onDone);
}

function ensurePresetFillReady(onDone) {
  if (!lineartData) return;
  if (fillRegionMap && fillRegions.length > 0) {
    onDone();
    return;
  }
  showScreen('processing-screen');
  setLoadingText('색칠 영역을 준비하는 중... 🎨');
  analyzeLineartInWorker(lineartData, laW, laH, 'build-fill-regions', onDone);
}

function onDetailChange(val) {
  detailLevel = parseInt(val, 10);
  if (detailTimer) clearTimeout(detailTimer);

  if (!_sourceImgData && lineartData) {
    const sliderWrap = document.getElementById('detail-slider-wrap');
    sliderWrap.classList.add('processing');
    sliderWrap.querySelector('.detail-label').textContent = '🔄 적용 중...';
    detailTimer = setTimeout(() => {
      const d = lineartData.data;
      const threshold = Math.round(80 + (detailLevel / 100) * 140);
      for (let i = 0; i < d.length; i += 4) {
        const cur = d[i];
        const isLine = cur < 128;
        const v = isLine ? Math.max(10, 40 - Math.floor((detailLevel - 50) * 0.4)) : 255;
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
      }
      parts = detectParts(lineartData, laW, laH);
      recomputeFillData(lineartData, laW, laH);
      const lp = document.getElementById('lineart-preview');
      lp.width = laW; lp.height = laH;
      lp.getContext('2d').putImageData(lineartData, 0, 0);
      sliderWrap.classList.remove('processing');
      sliderWrap.querySelector('.detail-label').textContent = '🔍 디테일 조절';
      detailTimer = null;
    }, 100);
    return;
  }

  if (!_sourceImgData) return;
  if (edgeWorker) { edgeWorker.terminate(); edgeWorker = null; }
  const sliderWrap = document.getElementById('detail-slider-wrap');
  sliderWrap.classList.add('processing');
  sliderWrap.querySelector('.detail-label').textContent = '🔄 적용 중...';
  detailTimer = setTimeout(() => {
    runEdgeWorker(_sourceImgData.slice(), _sourceW, _sourceH, false);
    detailTimer = null;
  }, 300);
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
  fitLineartToCanvas();
  offX = Math.floor((DC.width - laW) / 2);
  offY = Math.floor((DC.height - laH) / 2);

  if (!parts || parts.length === 0) {
    parts = detectParts(lineartData, laW, laH);
  }

  if (!parts || parts.length === 0) {
    parts = buildEmergencyParts(lineartData, laW, laH);
  }

  parts = ensureFullCoverage(parts, lineartData, laW, laH);
  parts = limitParts(parts, 30, laW);

  curPartIdx = 0;
  appMode = 'trace';
  historyStack = [];
  document.getElementById('side-palette').classList.add('hidden');
  document.getElementById('brush-bar').classList.add('hidden');
  drawTraceBackground();
  showCurrentPart();
  showScreen('canvas-screen');
}

function buildEmergencyParts(ld, w, h) {
  const data = ld.data;
  const isEdge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) isEdge[i] = data[i * 4] < 128 ? 1 : 0;

  const contour = [];
  const visited = new Uint8Array(w * h);
  const dx8 = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy8 = [0, 1, 1, 1, 0, -1, -1, -1];

  let sx = -1, sy2 = -1;
  for (let y = 0; y < h && sx < 0; y++) {
    for (let x = 0; x < w && sx < 0; x++) {
      if (isEdge[y * w + x]) { sx = x; sy2 = y; }
    }
  }
  if (sx < 0) return [];

  let cx2 = sx, cy2 = sy2;
  for (let step = 0; step < w * h; step++) {
    const pos = cy2 * w + cx2;
    if (visited[pos]) break;
    visited[pos] = 1;
    contour.push(pos);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nx = cx2 + dx8[k], ny = cy2 + dy8[k];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && isEdge[ny * w + nx] && !visited[ny * w + nx]) {
        cx2 = nx; cy2 = ny; found = true; break;
      }
    }
    if (!found) break;
  }

  if (contour.length < 10) return [];

  const sampled = [];
  const step = Math.max(1, Math.floor(contour.length / 400));
  for (let i = 0; i < contour.length; i += step) sampled.push(contour[i]);

  const segCount = Math.min(4, Math.max(2, Math.floor(sampled.length / 30)));
  const segSize = Math.ceil(sampled.length / segCount);
  const result = [];

  for (let s = 0; s < segCount; s++) {
    const pxs = sampled.slice(s * segSize, Math.min((s + 1) * segSize, sampled.length));
    if (pxs.length < 3) continue;
    let sy = 0;
    for (const pos of pxs) sy += Math.floor(pos / w);
    result.push({
      pixels: pxs,
      boundaryPos: pxs,
      samplePoints: pxs.filter((_, i) => i % 3 === 0),
      touchesBorder: false,
      isBand: true,
      centerY: sy / pxs.length
    });
  }
  return result;
}

function ensureFullCoverage(parts, ld, w, h) {
  const data = ld.data;
  const isEdge = new Uint8Array(w * h);
  let totalEdge = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4] < 128) { isEdge[i] = 1; totalEdge++; }
  }
  if (totalEdge < 20) return parts;

  const covered = new Uint8Array(w * h);
  let coveredCount = 0;
  for (const p of parts) {
    for (const pos of p.boundaryPos) {
      if (isEdge[pos] && !covered[pos]) { covered[pos] = 1; coveredCount++; }
    }
  }

  if (coveredCount / totalEdge >= 0.7) return parts;

  const dx8 = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy8 = [0, 1, 1, 1, 0, -1, -1, -1];
  const visited = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (covered[i]) visited[i] = 1;

  for (let i = 0; i < w * h; i++) {
    if (!isEdge[i] || visited[i]) continue;
    const contour = [];
    let cx = i % w, cy = Math.floor(i / w);
    for (let step = 0; step < w * h; step++) {
      const pos = cy * w + cx;
      if (visited[pos]) break;
      visited[pos] = 1;
      contour.push(pos);
      let found = false;
      for (let k = 0; k < 8; k++) {
        const nx = cx + dx8[k], ny = cy + dy8[k];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && isEdge[ny * w + nx] && !visited[ny * w + nx]) {
          cx = nx; cy = ny; found = true; break;
        }
      }
      if (!found) break;
    }
    if (contour.length < 10) continue;

    const step = Math.max(1, Math.floor(contour.length / 400));
    const sampled = [];
    for (let j = 0; j < contour.length; j += step) sampled.push(contour[j]);

    let sy = 0;
    for (const pos of sampled) sy += Math.floor(pos / w);
    parts.push({
      pixels: sampled,
      boundaryPos: sampled,
      samplePoints: sampled.filter((_, idx) => idx % 5 === 0),
      touchesBorder: false,
      isBand: true,
      centerY: sy / sampled.length
    });
  }

  return parts;
}

function limitParts(parts, maxParts, w) {
  if (parts.length <= maxParts) return parts;

  while (parts.length > maxParts) {
    let minSize = Infinity, minIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].boundaryPos.length < minSize) {
        minSize = parts[i].boundaryPos.length;
        minIdx = i;
      }
    }
    if (minIdx < 0) break;

    const small = parts[minIdx];
    const sCY = small.centerY;
    const sCX = small.boundaryPos.length > 0 ? (small.boundaryPos[0] % w) : 0;

    let bestDist = Infinity, bestIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (i === minIdx) continue;
      const p = parts[i];
      const pCX = p.boundaryPos.length > 0 ? (p.boundaryPos[0] % w) : 0;
      const d = Math.sqrt((sCX - pCX) ** 2 + (sCY - p.centerY) ** 2);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx < 0) break;

    const target = parts[bestIdx];
    target.boundaryPos = target.boundaryPos.concat(small.boundaryPos);
    target.samplePoints = target.samplePoints.concat(small.samplePoints);
    target.pixels = (target.pixels || []).concat(small.pixels || []);
    let sy = 0;
    for (const pos of target.boundaryPos) sy += Math.floor(pos / w);
    target.centerY = target.boundaryPos.length > 0 ? sy / target.boundaryPos.length : 0;

    parts.splice(minIdx, 1);
  }

  parts.sort((a, b) => a.centerY - b.centerY);
  return parts;
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
  const R = 8;
  for (const pos of part.samplePoints) {
    const x = pos % laW + offX, y = Math.floor(pos / laW) + offY;
    if (x < 0 || x >= DC.width || y < 0 || y >= DC.height) continue;
    let found = false;
    for (let dy = -R; dy <= R && !found; dy++) {
      for (let dx = -R; dx <= R && !found; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
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
  paintByRegion = [];
  buildLineBoundary();
  createLineartOverlay();
  redrawColorScene();
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
  fitLineartToCanvas();
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

function fitLineartToCanvas() {
  const pad = 40;
  const maxW = DC.width - pad;
  const maxH = DC.height - pad * 4;
  if (laW <= maxW && laH <= maxH) return;

  const scale = Math.min(maxW / laW, maxH / laH);
  const newW = Math.floor(laW * scale);
  const newH = Math.floor(laH * scale);

  const tmp = document.createElement('canvas');
  tmp.width = laW; tmp.height = laH;
  tmp.getContext('2d').putImageData(lineartData, 0, 0);

  const sc = document.createElement('canvas');
  sc.width = newW; sc.height = newH;
  const sCtx = sc.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(tmp, 0, 0, newW, newH);

  const sd = sCtx.getImageData(0, 0, newW, newH);
  const d = sd.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < 128 ? 40 : 255;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }

  lineartData = sd;
  laW = newW;
  laH = newH;
  parts = detectParts(sd, newW, newH);
  recomputeFillData(sd, newW, newH);
}

function hydrateFillData(fillData) {
  if (!fillData) {
    fillLineMask = null;
    fillRegionMap = null;
    fillRegions = [];
    fillRegionsById = [];
    paintByRegion = [];
    return;
  }

  fillLineMask = fillData.lineMask ? new Uint8Array(fillData.lineMask) : null;
  fillRegionMap = fillData.regionMap ? new Int32Array(fillData.regionMap) : null;
  fillRegions = Array.isArray(fillData.regions) ? fillData.regions : [];
  fillRegionsById = [];
  paintByRegion = [];
  for (const region of fillRegions) {
    fillRegionsById[region.id] = region;
  }
}

function recomputeFillData(ld, w, h) {
  hydrateFillData(buildFillRegions(ld, w, h));
}

function buildLineBoundary() {
  if (!lineartData) { lineBoundary = null; return; }
  const cw = DC.width, ch = DC.height;
  lineBoundary = new Uint8Array(cw * ch);
  const ld = lineartData.data;
  for (let y = 0; y < laH; y++) {
    for (let x = 0; x < laW; x++) {
      if (ld[(y * laW + x) * 4] < 128) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bx = offX + x + dx, by = offY + y + dy;
            if (bx >= 0 && bx < cw && by >= 0 && by < ch) {
              lineBoundary[by * cw + bx] = 1;
            }
          }
        }
      }
    }
  }
}

function ensureOffscreen(cw, ch) {
  if (!_maskCvs) {
    _maskCvs = document.createElement('canvas');
    _drawCvs = document.createElement('canvas');
    _baseCvs = document.createElement('canvas');
  }
  if (_maskCvs.width !== cw || _maskCvs.height !== ch) {
    _maskCvs.width = cw; _maskCvs.height = ch;
    _drawCvs.width = cw; _drawCvs.height = ch;
    _baseCvs.width = cw; _baseCvs.height = ch;
  }
}

function createLineartOverlay() {
  if (!lineartData) { lineartOverlay = null; return; }
  const oc = document.createElement('canvas');
  oc.width = DC.width; oc.height = DC.height;
  const tmp = document.createElement('canvas');
  tmp.width = laW; tmp.height = laH;
  const tc = tmp.getContext('2d');
  const id = tc.createImageData(laW, laH);
  const ld = lineartData.data;
  const dd = id.data;
  for (let i = 0; i < laW * laH; i++) {
    if (ld[i * 4] < 128) {
      const j = i * 4;
      dd[j] = 30; dd[j + 1] = 41; dd[j + 2] = 59; dd[j + 3] = 255;
    }
  }
  tc.putImageData(id, 0, 0);
  oc.getContext('2d').drawImage(tmp, offX, offY);
  lineartOverlay = oc;
}

function buildColorMask(startX, startY) {
  const cw = DC.width, ch = DC.height;
  if (startX < 0 || startX >= cw || startY < 0 || startY >= ch) return null;

  if (fillRegionMap && fillRegions.length > 0) {
    const lx = Math.floor(startX - offX);
    const ly = Math.floor(startY - offY);
    if (lx < 0 || lx >= laW || ly < 0 || ly >= laH) return null;

    const regionId = fillRegionMap[ly * laW + lx];
    if (regionId <= 0) return null;

    const region = fillRegionsById[regionId];
    if (!region || !region.bounds) return null;

    const mask = new Uint8Array(cw * ch);
    const { minX, maxX, minY, maxY } = region.bounds;
    for (let y = minY; y <= maxY; y++) {
      const rowBase = y * laW;
      for (let x = minX; x <= maxX; x++) {
        if (fillRegionMap[rowBase + x] !== regionId) continue;
        const px = x + offX;
        const py = y + offY;
        if (px >= 0 && px < cw && py >= 0 && py < ch) {
          mask[py * cw + px] = 1;
        }
      }
    }
    return mask;
  }

  if (lineBoundary) {
    if (lineBoundary[startY * cw + startX]) return null;
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
        if (mask[np] || lineBoundary[np]) continue;
        mask[np] = 1;
        queue.push([nx, ny]);
      }
    }
    return mask;
  }

  const id = cx.getImageData(0, 0, cw, ch), d = id.data;
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

function getRegionIdAtCanvasPoint(x, y) {
  if (!fillRegionMap || fillRegions.length === 0) return 0;
  const lx = Math.floor(x - offX);
  const ly = Math.floor(y - offY);
  if (lx < 0 || lx >= laW || ly < 0 || ly >= laH) return 0;
  return fillRegionMap[ly * laW + lx] || 0;
}

function drawFilledRegion(regionId, color) {
  const region = fillRegionsById[regionId];
  if (!region || !region.bounds) return false;

  cx.fillStyle = color;
  const { minX, maxX, minY, maxY } = region.bounds;
  for (let iy = minY; iy <= maxY; iy++) {
    const rowBase = iy * laW;
    for (let ix = minX; ix <= maxX; ix++) {
      if (fillRegionMap[rowBase + ix] !== regionId) continue;
      const px = ix + offX;
      const py = iy + offY;
      if (px >= 0 && px < DC.width && py >= 0 && py < DC.height) {
        cx.fillRect(px, py, 1, 1);
      }
    }
  }
  return true;
}

function redrawColorScene() {
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, DC.width, DC.height);
  for (let regionId = 1; regionId < paintByRegion.length; regionId++) {
    const color = paintByRegion[regionId];
    if (!color) continue;
    drawFilledRegion(regionId, color);
  }
  if (lineartOverlay) cx.drawImage(lineartOverlay, 0, 0);
}

function fillRegionAtCanvasPoint(x, y, color) {
  const regionId = getRegionIdAtCanvasPoint(x, y);
  if (regionId <= 0) return null;

  const region = fillRegionsById[regionId];
  if (!region || !region.bounds) return null;

  const prevColor = paintByRegion[regionId] || null;
  if (prevColor === color) {
    return { regionId, prevColor, nextColor: color, changed: false };
  }

  paintByRegion[regionId] = color;
  drawFilledRegion(regionId, color);
  if (lineartOverlay) cx.drawImage(lineartOverlay, 0, 0);
  return { regionId, prevColor, nextColor: color, changed: true };
}

function saveRegionFillAction(regionId, prevColor, nextColor) {
  historyStack.push({
    kind: 'region-fill',
    regionId,
    prevColor,
    nextColor
  });
  if (historyStack.length > 10) historyStack.shift();
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
    if (fillRegionMap && fillRegions.length > 0) {
      const fillAction = fillRegionAtCanvasPoint(px, py, currentColor);
      if (fillAction?.changed) {
        saveRegionFillAction(fillAction.regionId, fillAction.prevColor, fillAction.nextColor);
      }
      return;
    }

    colorMask = buildColorMask(px, py);
    if (!colorMask) return;

    const cw = DC.width, ch = DC.height;
    ensureOffscreen(cw, ch);

    const mc = _maskCvs.getContext('2d');
    mc.clearRect(0, 0, cw, ch);
    const mId = mc.createImageData(cw, ch);
    const md = mId.data;
    for (let i = 0; i < colorMask.length; i++) {
      if (colorMask[i]) {
        const j = i * 4;
        md[j] = 255; md[j + 1] = 255; md[j + 2] = 255; md[j + 3] = 255;
      }
    }
    mc.putImageData(mId, 0, 0);

    const dc = _drawCvs.getContext('2d');
    dc.clearRect(0, 0, cw, ch);
    dc.lineCap = 'round'; dc.lineJoin = 'round';

    _baseCvs.getContext('2d').drawImage(DC, 0, 0);

    activeClip = true;
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
    const now = Date.now();
    if (now - particleThrottle > 80) {
      spawnParticles(snap.x, snap.y, 1 + Math.floor(Math.random() * 2));
      particleThrottle = now;
    }
    lastX = snap.x; lastY = snap.y;
    return;
  }

  if (activeClip) {
    const dc = _drawCvs.getContext('2d');
    dc.globalCompositeOperation = 'source-over';
    dc.strokeStyle = currentColor;
    dc.lineWidth = brushSize;
    dc.beginPath(); dc.moveTo(lastX, lastY); dc.lineTo(p.x, p.y); dc.stroke();

    dc.globalCompositeOperation = 'destination-in';
    dc.drawImage(_maskCvs, 0, 0);
    dc.globalCompositeOperation = 'source-over';

    cx.clearRect(0, 0, DC.width, DC.height);
    cx.drawImage(_baseCvs, 0, 0);
    cx.drawImage(_drawCvs, 0, 0);
    if (lineartOverlay) cx.drawImage(lineartOverlay, 0, 0);

    lastX = p.x; lastY = p.y;
    return;
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
  activeClip = false;
  colorMask = null;
  saveState();
  if (appMode === 'trace') checkTraceCompletion();
}

// --- Particle Effect System (overlay canvas) ---
const PARTICLE_COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
const particles = [];
let particleAnimId = null;

const PC = document.createElement('canvas');
PC.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
document.body.appendChild(PC);
const pcx = PC.getContext('2d');

function resizeParticleCanvas() { PC.width = window.innerWidth; PC.height = window.innerHeight; }
resizeParticleCanvas();
window.addEventListener('resize', resizeParticleCanvas);

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5;
    this.size = 1.5 + Math.random() * 2;
    this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    this.life = 0.8;
    this.decay = 0.04 + Math.random() * 0.04;
    this.gravity = 0.08;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.size *= 0.96;
  }
  draw(ctx) {
    if (this.life <= 0 || this.size < 0.3) return;
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  if (!particleAnimId) particleLoop();
}

function particleLoop() {
  pcx.clearRect(0, 0, PC.width, PC.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(pcx);
    if (particles[i].life <= 0 || particles[i].size < 0.3) particles.splice(i, 1);
  }
  if (particles.length > 0) {
    particleAnimId = requestAnimationFrame(particleLoop);
  } else {
    pcx.clearRect(0, 0, PC.width, PC.height);
    particleAnimId = null;
  }
}

let particleThrottle = 0;
// --- End Particle System ---

function saveState() {
  historyStack.push({
    kind: 'snapshot',
    imageData: cx.getImageData(0, 0, DC.width, DC.height)
  });
  if (historyStack.length > 10) historyStack.shift();
}

function undo() {
  if (historyStack.length === 0) return;

  const lastEntry = historyStack[historyStack.length - 1];
  if (isRegionFillColorMode() && lastEntry?.kind === 'region-fill') {
    historyStack.pop();
    if (lastEntry.prevColor) {
      paintByRegion[lastEntry.regionId] = lastEntry.prevColor;
    } else {
      delete paintByRegion[lastEntry.regionId];
    }
    redrawColorScene();
    return;
  }

  if (historyStack.length > 1) {
    historyStack.pop();
    const snapshotEntry = historyStack[historyStack.length - 1];
    if (snapshotEntry?.kind === 'snapshot') {
      cx.putImageData(snapshotEntry.imageData, 0, 0);
    }
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

document.querySelectorAll('.mtbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    edgeMode = btn.dataset.edge;
    document.querySelectorAll('.mtbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'trace') {
      if (hasPhoto && lineartData) {
        ensurePresetTraceReady(() => beginActivity());
        return;
      }
      beginActivity();
      return;
    }
    if (mode === 'color') {
      if (hasPhoto && lineartData) {
        ensurePresetFillReady(() => beginColorDirect());
        return;
      }
      beginColorDirect();
      return;
    }
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
  debugMark('preset-click', { index: idx, name: PRESETS[idx]?.name || null });
  try {
    const result = renderPreset(PRESETS[idx], SC, sx);
    debugMark('preset-rendered', { size: result.size });
    lineartData = result.lineartData;
    laW = result.size; laH = result.size;
    parts = [];
    hydrateFillData(null);
    const lp = document.getElementById('lineart-preview');
    lp.width = result.size; lp.height = result.size;
    lp.getContext('2d').putImageData(lineartData, 0, 0);
    document.getElementById('preview-img').src = SC.toDataURL();
    hasPhoto = true;
    isProcessing = false;
    showScreen('mode-screen');
    debugMark('preset-mode-screen-ready', { hasPhoto });
  } catch (error) {
    debugMark('preset-error', { message: error?.message || String(error) });
    throw error;
  }
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

document.getElementById('detail-slider').addEventListener('input', (e) => {
  onDetailChange(e.target.value);
});

buildPalette();
buildPresetGrid();
