import { createDemoCatBlob } from './demo.js';
import { initFreeSketch, initKaleidoscope, initNeonGlow, getNeonColors, getNeonBg, rebuildPalette } from './creative.js';
import { celebrate, updateProgress, showHint, showPartDone, hidePartDone, showScreen, setLoadingText } from './ui-utils.js';
import { PRESETS, renderPreset } from './presets.js';
import { detectParts, dilate, fuseLines, normalizeLineWidth, buildFillRegions, resolvePipelineMode } from './edge-detect.js';
import { removeBackground } from './bg-remove.js';
import { exportAnalyticsSession, setAnalyticsContext, trackEvent } from './analytics.js';
import { getBuiltinPresetPack } from './packs.js';
import { pruneTraceParts } from './trace-part-quality.js';
import { FILL_TOOLS, drawRegionFill } from './color-fill-tools.js';

const COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#a16207','#1e293b','#fef3c7','#bbf7d0','#bae6fd','#e9d5ff','#fecdd3'];
const BRUSHES = [{ s: 6, d: 8 }, { s: 14, d: 14 }, { s: 26, d: 22 }];
const SNAP_RADIUS = 30;
const TRACE_TOLERANCE = 40;
const COMPLETE_THRESHOLD = 0.90;
const TRACE_REJOIN_DISTANCE = 18;
const TRACE_HINT_COOLDOWN_MS = 900;
const SMART_MISSION_IDLE_MS = 2400;
const SMART_MISSION_HINT_COOLDOWN_MS = 3200;
const ALMOST_COMPLETE_REMAINING_COUNT = 1;

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
let activeEdgeMode = 'object';
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
let paintToolByRegion = [];
let previewRegionId = 0;
let currentFillTool = 'solid';
let colorInteractionMode = 'brush';
let traceHasPendingGap = false;
let lastTraceHintAt = 0;
let traceGuideVisible = false;
let smartMissionTimer = null;
let smartMissionRegionId = 0;
let lastSmartMissionHintAt = 0;
let smartMissionPulseTimer = null;
let almostCompleteCelebrated = false;
let completeCelebrated = false;
let suppressColorHintReschedule = false;
const builtinPresetPack = getBuiltinPresetPack();

function getPipelineMode() {
  return activeEdgeMode || edgeMode;
}

function updateModeGuide(selectedMode, resolvedMode) {
  const guide = document.getElementById('mode-guide');
  if (!guide) return;
  if (selectedMode === 'object' && resolvedMode === 'illustration') {
    guide.textContent = '자동으로 그림·캐릭터 모드로 맞췄어요 🪄';
    return;
  }
  if (selectedMode === 'illustration') {
    guide.textContent = '그림·캐릭터는 선을 더 살려서 변환해요 🖼️';
    return;
  }
  if (selectedMode === 'portrait') {
    guide.textContent = '인물은 얼굴과 몸 윤곽을 중심으로 정리해요 🧒';
    return;
  }
  guide.textContent = '사물 사진도 그림처럼 보이면 자동으로 더 부드럽게 바꿔요 ✨';
}

function isRegionFillColorMode() {
  return appMode === 'color'
    && !creativeMode
    && colorInteractionMode === 'fill'
    && !!fillRegionMap
    && fillRegions.length > 0;
}

function clearSmartMissionTimer() {
  if (!smartMissionTimer) return;
  clearTimeout(smartMissionTimer);
  smartMissionTimer = null;
}

function clearSmartMissionPulse() {
  if (!smartMissionPulseTimer) return;
  clearInterval(smartMissionPulseTimer);
  smartMissionPulseTimer = null;
}

function resetColorMissionState() {
  smartMissionRegionId = 0;
  clearSmartMissionTimer();
  clearSmartMissionPulse();
  almostCompleteCelebrated = false;
  completeCelebrated = false;
  suppressColorHintReschedule = false;
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

function getLargestFillRegionArea(fillData) {
  const regions = fillData?.regions || [];
  let max = 0;
  for (const region of regions) {
    if ((region?.area || 0) > max) max = region.area || 0;
  }
  return max;
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

function buildFillToolBar() {
  const bar = document.getElementById('fill-tool-bar');
  if (!bar) return;
  bar.innerHTML = '';
  for (const tool of FILL_TOOLS) {
    const btn = document.createElement('button');
    btn.className = `fill-tool-pick${tool.id === currentFillTool ? ' active' : ''}`;
    btn.textContent = tool.label;
    btn.addEventListener('click', () => {
      currentFillTool = tool.id;
      document.querySelectorAll('.fill-tool-pick').forEach((node) => node.classList.remove('active'));
      btn.classList.add('active');
      if (previewRegionId > 0) renderColorPreview(previewRegionId);
    });
    bar.appendChild(btn);
  }
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
  activeEdgeMode = edgeMode;
  resetColorMissionState();
  lineBoundary = null;
  lineartOverlay = null;
  activeClip = false;
  paintToolByRegion = [];
  currentFillTool = 'solid';
  updateModeGuide(edgeMode, edgeMode);
  showScreen('upload-screen');
  document.getElementById('photo-input').value = '';
}

async function loadDemoImage() {
  debugMark('demo-start');
  activeEdgeMode = 'illustration';
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
  trackEvent('upload_started', {
    mimeType: blob?.type || 'unknown',
    fileSize: blob?.size || null
  });
  debugMark('processPhoto-start', { blobType: blob?.type || 'unknown', blobSize: blob?.size || null });
  showScreen('processing-screen');
  setLoadingText('AI 요정이 그림을 그리고 있어요... ✨');

  let workingBlob = blob;
  if (edgeMode === 'portrait') {
    setLoadingText('배경을 정리하는 중... ✂️');
    try {
      workingBlob = await removeBackground(blob);
      debugMark('processPhoto-background-ready', {
        originalSize: blob?.size || null,
        processedSize: workingBlob?.size || null
      });
    } catch (error) {
      debugMark('processPhoto-background-failed', { message: error?.message || String(error) });
      workingBlob = blob;
    }
  }

  const img = await createImageBitmap(workingBlob);
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
  const { resolvedMode, profile } = resolvePipelineMode(edgeMode, imageData, w, h);
  activeEdgeMode = resolvedMode;
  setAnalyticsContext({
    selectedMode: edgeMode,
    resolvedMode,
    detail: detailLevel
  });
  if (profile) {
    debugMark('edge-mode-resolved', {
      selectedMode: edgeMode,
      resolvedMode,
      whiteRatio: Number(profile.whiteRatio.toFixed(3)),
      darkRatio: Number(profile.darkRatio.toFixed(3)),
      vividRatio: Number(profile.vividRatio.toFixed(3)),
      paletteBuckets: profile.paletteBuckets,
      textureScore: Number(profile.textureScore.toFixed(2))
    });
    trackEvent('pipeline_resolved', {
      whiteRatio: Number(profile.whiteRatio.toFixed(3)),
      darkRatio: Number(profile.darkRatio.toFixed(3)),
      vividRatio: Number(profile.vividRatio.toFixed(3)),
      paletteBuckets: profile.paletteBuckets,
      textureScore: Number(profile.textureScore.toFixed(2))
    });
  }
  updateModeGuide(edgeMode, resolvedMode);

  _sourceImgData = imageData.data.slice();
  _sourceW = w;
  _sourceH = h;
  detailLevel = 50;
  debugMark('convertToLineart-ready', { width: w, height: h, activeEdgeMode });
  if (activeEdgeMode === 'illustration') {
    setLoadingText('그림 선을 정리하는 중... 🪄');
  }
  document.getElementById('detail-slider').value = 50;
  document.getElementById('detail-slider-wrap').style.display = '';

  runEdgeWorker(imageData.data, w, h, true);
}

function runEdgeWorker(rawData, w, h, isFirstRun) {
  if (edgeWorker) edgeWorker.terminate();
  edgeWorker = new Worker('./js/edge-worker.js', { type: 'module' });
  debugMark('worker-start', { width: w, height: h, isFirstRun, edgeMode: getPipelineMode(), detailLevel });

  const sliderWrap = document.getElementById('detail-slider-wrap');
  const startedAt = performance.now();

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
      const runtimeMs = Number((performance.now() - startedAt).toFixed(1));
      trackEvent('lineart_completed', {
        detail: detailLevel,
        parts: parts?.length || 0,
        fillRegions: e.data.fillRegions?.regions?.length || 0,
        largestRegion: getLargestFillRegionArea(e.data.fillRegions),
        runtimeMs
      });

      if (isFirstRun) {
        document.getElementById('preview-img').src = SC.toDataURL();
      }
      const lp = document.getElementById('lineart-preview');
      lp.width = laW; lp.height = laH;
      lp.getContext('2d').putImageData(lineartData, 0, 0);

      if (isFirstRun) {
        showScreen('preview-screen');
        trackEvent('preview_opened', {
          detail: detailLevel
        });
      }
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

  edgeWorker.postMessage({ imageData: rawData, w, h, mode: getPipelineMode(), detail: detailLevel });
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
    h,
    mode: getPipelineMode(),
    detail: detailLevel
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
      parts = detectParts(lineartData, laW, laH, {
        mode: getPipelineMode(),
        detail: detailLevel
      });
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
  const snapRadius = Math.max(12, Math.round(SNAP_RADIUS * (part?.toleranceMultiplier || 1)));
  const traceTolerance = Math.max(snapRadius + 4, Math.round(TRACE_TOLERANCE * (part?.toleranceMultiplier || 1)));
  let minDist = Infinity, snapX = tx, snapY = ty;
  const tracePoints = getTraceCanvasPoints(part, {
    maxStep: Math.max(4, Math.round(traceTolerance * 0.45))
  });
  for (let i = 0; i < tracePoints.length; i += 2) {
    const point = tracePoints[i];
    const d = Math.sqrt((tx - point.x) ** 2 + (ty - point.y) ** 2);
    if (d < minDist) { minDist = d; snapX = point.x; snapY = point.y; }
  }
  if (minDist < snapRadius) return { x: snapX, y: snapY, valid: true };
  if (minDist < traceTolerance) {
    const t = 0.6;
    return { x: tx + (snapX - tx) * t, y: ty + (snapY - ty) * t, valid: true };
  }
  return { x: tx, y: ty, valid: false };
}

function buildTraceZone(part) {
  const cw = DC.width, ch = DC.height;
  const zone = new Uint8Array(cw * ch);
  const traceTolerance = Math.max(14, Math.round(TRACE_TOLERANCE * (part?.toleranceMultiplier || 1)));
  const tracePoints = getTraceCanvasPoints(part, {
    maxStep: Math.max(4, Math.round(traceTolerance * 0.4))
  });
  for (const point of tracePoints) {
    const cx = point.x;
    const cy = point.y;
    for (let dy = -traceTolerance; dy <= traceTolerance; dy++) {
      for (let dx = -traceTolerance; dx <= traceTolerance; dx++) {
        if (dx * dx + dy * dy <= traceTolerance * traceTolerance) {
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
    parts = detectParts(lineartData, laW, laH, {
      mode: getPipelineMode(),
      detail: detailLevel
    });
  }

  if (!parts || parts.length === 0) {
    parts = buildEmergencyParts(lineartData, laW, laH);
  }

  parts = ensureFullCoverage(parts, lineartData, laW, laH);
  parts = pruneTraceParts(parts, laW, laH, { mode: getPipelineMode() });
  parts = limitParts(parts, 30, laW);

  curPartIdx = 0;
  appMode = 'trace';
  trackEvent('trace_started', {
    parts: parts.length,
    traceStrategy: parts[0]?.traceStrategy || 'legacy'
  });
  historyStack = [];
  document.getElementById('side-palette').classList.add('hidden');
  document.getElementById('brush-bar').classList.add('hidden');
  document.getElementById('fill-tool-bar').classList.add('hidden');
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
  if (parts.length > 0 && parts.every((part) => part.traceStrategy === 'simplified' || part.traceStrategy === 'semantic')) {
    return parts;
  }

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

function projectBoundaryToCanvas(boundaryPos) {
  return boundaryPos.map((pos) => ({
    x: (pos % laW) + offX,
    y: Math.floor(pos / laW) + offY
  }));
}

function getTraceCanvasPoints(part, options = {}) {
  if (!part || !Array.isArray(part.boundaryPos) || part.boundaryPos.length === 0) return [];

  const traceTolerance = Math.max(14, Math.round(TRACE_TOLERANCE * (part?.toleranceMultiplier || 1)));
  const maxStep = Math.max(3, options.maxStep ?? Math.round(traceTolerance * 0.35));
  const breakThreshold = Math.max(
    traceTolerance * 2.4,
    options.breakThreshold ?? Math.round(traceTolerance * 3.2)
  );
  const cacheKey = `${maxStep}:${breakThreshold}:${offX}:${offY}`;
  if (part._traceCanvasPointCacheKey === cacheKey && Array.isArray(part._traceCanvasPoints)) {
    return part._traceCanvasPoints;
  }

  const projected = projectBoundaryToCanvas(part.boundaryPos);
  const expanded = [projected[0]];
  for (let i = 1; i < projected.length; i++) {
    const prev = projected[i - 1];
    const point = projected[i];
    const distance = Math.hypot(point.x - prev.x, point.y - prev.y);
    if (distance > breakThreshold) {
      expanded.push(point);
      continue;
    }
    const steps = Math.max(1, Math.ceil(distance / maxStep));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      expanded.push({
        x: Math.round(prev.x + (point.x - prev.x) * t),
        y: Math.round(prev.y + (point.y - prev.y) * t)
      });
    }
  }

  part._traceCanvasPointCacheKey = cacheKey;
  part._traceCanvasPoints = expanded;
  return expanded;
}

function collapseDenseTracePoints(points, gapThreshold) {
  if (points.length <= 2) return points;
  const collapsed = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = collapsed[collapsed.length - 1];
    const point = points[i];
    if (Math.hypot(point.x - prev.x, point.y - prev.y) >= 3.5) {
      collapsed.push(point);
    }
  }
  collapsed.push(points[points.length - 1]);
  return collapsed;
}

function strokeSmoothTraceSegment(points) {
  if (points.length < 2) return;
  if (points.length === 2) {
    cx.moveTo(points[0].x, points[0].y);
    cx.lineTo(points[1].x, points[1].y);
    return;
  }

  cx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    cx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  cx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
}

function strokeTracePart(boundaryPos, {
  strokeStyle,
  lineWidth,
  lineDash = [],
  alpha = 1,
  gapMultiplier = 1.15
}) {
  if (!Array.isArray(boundaryPos) || boundaryPos.length < 2) return;

  const gapThreshold = Math.max(16, TRACE_TOLERANCE * gapMultiplier);
  const projected = getTraceCanvasPoints({ boundaryPos }, {
    maxStep: Math.max(4, Math.round(gapThreshold * 0.28)),
    breakThreshold: Math.max(gapThreshold * 2.2, 96)
  });
  cx.save();
  cx.strokeStyle = strokeStyle;
  cx.lineWidth = lineWidth;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  cx.globalAlpha = alpha;
  cx.setLineDash(lineDash);
  cx.beginPath();

  let segment = [projected[0]];
  for (let i = 1; i < projected.length; i++) {
    const prev = projected[i - 1];
    const point = projected[i];
    if (Math.hypot(point.x - prev.x, point.y - prev.y) > gapThreshold) {
      strokeSmoothTraceSegment(collapseDenseTracePoints(segment, gapThreshold));
      segment = [point];
      continue;
    }
    segment.push(point);
  }
  strokeSmoothTraceSegment(collapseDenseTracePoints(segment, gapThreshold));

  cx.stroke();
  cx.restore();
}

function showCurrentPart() {
  if (curPartIdx >= parts.length) { transitionToColor(); return; }
  const part = parts[curPartIdx];
  traceZone = buildTraceZone(part);

  strokeTracePart(part.boundaryPos, {
    strokeStyle: '#647eea',
    lineWidth: 8,
    lineDash: [18, 10],
    alpha: 0.75
  });

  for (let i = 0; i < curPartIdx; i++) {
    strokeTracePart(parts[i].boundaryPos, {
      strokeStyle: '#1e293b',
      lineWidth: 5,
      alpha: 0.95
    });
  }

  saveState();
  updateProgress(0);
  const semanticEmoji = {
    silhouette: '🧩',
    limb: '🦶',
    head_feature: '😊',
    tail_feature: '🦕',
    ornament: '✨'
  };
  const semanticLabel = part.traceStrategy === 'semantic' ? (part.displayName || part.semanticLabel || '') : '';
  const suffix = part.traceStrategy === 'semantic'
    ? ` ${semanticEmoji[part.semanticCategory] || '⭐'}${semanticLabel ? ` ${semanticLabel}` : ''}`
    : ' ⭐';
  document.getElementById('part-label').textContent = `${curPartIdx + 1}/${parts.length}${suffix}`;
  showHint(part.hint || (semanticLabel ? `${semanticLabel}부터 따라 그려봐요! ✏️` : '점선을 따라 그려봐요! ✏️'));
  currentColor = '#1e293b'; brushSize = 6; isEraser = false;
}

function checkTraceCompletion() {
  if (curPartIdx >= parts.length) return;
  const part = parts[curPartIdx];
  const id = cx.getImageData(0, 0, DC.width, DC.height), d = id.data;
  let covered = 0;
  const R = Math.max(6, Math.round(8 * (part?.toleranceMultiplier || 1)));
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
  strokeTracePart(parts[curPartIdx].boundaryPos, {
    strokeStyle: '#1e293b',
    lineWidth: 5,
    alpha: 0.95
  });
  const burstX = lastX;
  const burstY = lastY;
  curPartIdx++;
  if (curPartIdx >= parts.length) {
    trackEvent('trace_completed', {
      parts: parts.length
    });
    showPartDone('잘했어요! 🌟');
    setTimeout(transitionToColor, 1500);
  } else {
    showPartDone('⭐');
    setTimeout(() => { hidePartDone(); showCurrentPart(); }, 1000);
  }
  spawnParticles(burstX, burstY, 12, {
    color: currentColor,
    speedBoost: 0.8,
    sizeBoost: 1.4
  });
  celebrate();
}

function transitionToColor() {
  hidePartDone();
  hideTraceGuide();
  previewRegionId = 0;
  resetColorMissionState();
  appMode = 'color';
  trackEvent('color_started', {
    fillRegions: fillRegions.length
  });
  historyStack = [];
  paintByRegion = [];
  paintToolByRegion = [];
  colorInteractionMode = 'brush';
  buildLineBoundary();
  createLineartOverlay();
  redrawColorScene();
  saveState();
  document.getElementById('side-palette').classList.remove('hidden');
  document.getElementById('brush-bar').classList.remove('hidden');
  document.getElementById('fill-tool-bar').classList.add('hidden');
  currentFillTool = 'solid';
  buildFillToolBar();
  updateProgress(1);
  updateColorModeLabel('🎨 색칠!');
  showHint('터치해서 색칠해봐요! 🎨');
  setTimeout(() => document.getElementById('hint-toast').style.display = 'none', 3000);
  currentColor = '#ef4444'; brushSize = 14; isEraser = false;
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  document.querySelector('.cdot').classList.add('active');
  traceZone = null; colorMask = null;
  scheduleSmartMissionHint({ announce: true });
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
  scheduleSmartMissionHint({ announce: true });
}

function startCreativeMode(mode) {
  showScreen('canvas-screen');
  hideTraceGuide();
  previewRegionId = 0;
  resetColorMissionState();
  historyStack = [];
  colorInteractionMode = 'brush';
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
  document.getElementById('fill-tool-bar').classList.add('hidden');
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
  parts = detectParts(sd, newW, newH, {
    mode: getPipelineMode(),
    detail: detailLevel
  });
  recomputeFillData(sd, newW, newH);
}

function hydrateFillData(fillData) {
  if (!fillData) {
    fillLineMask = null;
    fillRegionMap = null;
    fillRegions = [];
    fillRegionsById = [];
    paintByRegion = [];
    paintToolByRegion = [];
    previewRegionId = 0;
    return;
  }

  fillLineMask = fillData.lineMask ? new Uint8Array(fillData.lineMask) : null;
  fillRegionMap = fillData.regionMap ? new Int32Array(fillData.regionMap) : null;
  fillRegions = Array.isArray(fillData.regions) ? fillData.regions : [];
  fillRegionsById = [];
  paintByRegion = [];
  paintToolByRegion = [];
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
  return drawRegionFill(cx, region, fillRegionMap, laW, { offX, offY }, color, paintToolByRegion[regionId] || 'solid');
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

function renderColorPreview(regionId) {
  if (regionId <= 0) {
    redrawColorScene();
    return;
  }

  redrawColorScene();
  cx.save();
  cx.globalAlpha = getPreviewAlpha(regionId);
  drawRegionFill(cx, fillRegionsById[regionId], fillRegionMap, laW, { offX, offY }, currentColor, currentFillTool);
  cx.restore();
  if (lineartOverlay) cx.drawImage(lineartOverlay, 0, 0);
}

function setPreviewRegion(regionId) {
  const nextRegionId = regionId > 0 ? regionId : 0;
  if (previewRegionId === nextRegionId) return;
  clearSmartMissionPulse();
  previewRegionId = nextRegionId;
  renderColorPreview(previewRegionId);
  ensureSmartMissionPulse(previewRegionId);
}

function clearPreviewRegion() {
  clearSmartMissionPulse();
  if (!previewRegionId) return;
  previewRegionId = 0;
  redrawColorScene();
}

function updateColorModeLabel(text = '🎨 색칠!') {
  document.getElementById('part-label').textContent = text;
}

function getRemainingColorRegionCount() {
  let remaining = 0;
  for (const region of fillRegions) {
    if (!region || paintByRegion[region.id]) continue;
    remaining++;
  }
  return remaining;
}

function getNextSmartMissionRegionId() {
  let bestRegion = null;
  for (const region of fillRegions) {
    if (!region || paintByRegion[region.id]) continue;
    if (!bestRegion || region.area > bestRegion.area) bestRegion = region;
  }
  return bestRegion?.id || 0;
}

function refreshSmartMissionRegion() {
  smartMissionRegionId = getNextSmartMissionRegionId();
  return smartMissionRegionId;
}

function showSmartMissionHint(message, options = {}) {
  const { force = false } = options;
  const now = Date.now();
  if (!force && now - lastSmartMissionHintAt < SMART_MISSION_HINT_COOLDOWN_MS) return;
  lastSmartMissionHintAt = now;
  showHint(message);
  setTimeout(() => {
    const hint = document.getElementById('hint-toast');
    if (hint.textContent === message) hint.style.display = 'none';
  }, 2200);
}

function triggerAlmostCompleteCelebration(regionId) {
  const region = fillRegionsById[regionId];
  if (!region?.bounds) return;
  const anchor = getRegionBurstAnchor(region, offX, offY);
  spawnParticles(anchor.x, anchor.y, 18, {
    color: '#facc15',
    speedBoost: 1.2,
    sizeBoost: 2.1
  });
  spawnParticles(anchor.x, anchor.y, 10, {
    color: '#fb7185',
    speedBoost: 0.9,
    sizeBoost: 1.55
  });
  showSmartMissionHint('마지막 한 곳만 더 칠해요! 🌈', { force: true });
  showPartDone('거의 다 왔어요! 🌈');
  setTimeout(hidePartDone, 900);
}

function triggerCompleteCelebration() {
  const centerX = DC.width / 2;
  const centerY = DC.height / 2;
  const colors = ['#facc15', '#fb7185', '#60a5fa', '#34d399', '#c084fc'];

  for (let i = 0; i < colors.length; i++) {
    spawnParticles(centerX, centerY, 14, {
      color: colors[i],
      speedBoost: 1.25 + i * 0.08,
      sizeBoost: 1.9
    });
  }

  showPartDone('완성했어요! 🎉');
  setTimeout(hidePartDone, 1200);
}

function getPreviewAlpha(regionId) {
  const baseAlpha = paintByRegion[regionId] ? 0.18 : 0.34;
  if (regionId !== smartMissionRegionId) return baseAlpha;
  return baseAlpha + ((Math.sin(Date.now() / 180) + 1) * 0.08);
}

function ensureSmartMissionPulse(regionId) {
  if (regionId !== smartMissionRegionId || regionId <= 0) {
    clearSmartMissionPulse();
    return;
  }
  if (smartMissionPulseTimer) return;
  smartMissionPulseTimer = setInterval(() => {
    if (previewRegionId !== smartMissionRegionId || !isRegionFillColorMode() || isDrawing) {
      clearSmartMissionPulse();
      return;
    }
    renderColorPreview(previewRegionId);
  }, 120);
}

function scheduleSmartMissionHint(options = {}) {
  const { immediate = false, announce = false } = options;
  clearSmartMissionTimer();
  if (!isRegionFillColorMode() || !document.getElementById('canvas-screen').classList.contains('active')) return;

  const run = () => {
    if (!isRegionFillColorMode() || isDrawing) return;
    const regionId = refreshSmartMissionRegion();
    const remainingCount = getRemainingColorRegionCount();
    if (remainingCount <= 0) {
      updateColorModeLabel('🎉 완성!');
      if (announce && !completeCelebrated) {
        completeCelebrated = true;
        showSmartMissionHint('완성했어요! 🎉', { force: true });
        triggerCompleteCelebration();
        celebrate();
      }
      clearPreviewRegion();
      return;
    }

    completeCelebrated = false;

    if (remainingCount === ALMOST_COMPLETE_REMAINING_COUNT && regionId > 0) {
      updateColorModeLabel('🌈 거의 완성!');
      if (!previewRegionId) setPreviewRegion(regionId);
      if (!almostCompleteCelebrated) {
        almostCompleteCelebrated = true;
        triggerAlmostCompleteCelebration(regionId);
      }
      if (announce) showSmartMissionHint('마지막 한 곳만 더 칠해요! 🌈', { force: true });
      return;
    }

    almostCompleteCelebrated = false;

    updateColorModeLabel('🎨 색칠! · 🎯 추천');
    if (!previewRegionId) setPreviewRegion(regionId);
    if (announce) showSmartMissionHint('큰 부분부터 칠해봐요! 🎯');
  };

  if (immediate) {
    run();
    return;
  }

  smartMissionTimer = setTimeout(run, SMART_MISSION_IDLE_MS);
}

function getRegionBurstAnchor(region, fallbackX, fallbackY) {
  if (!region?.bounds) return { x: fallbackX, y: fallbackY };
  const { minX, maxX, minY, maxY } = region.bounds;
  const centerX = offX + Math.floor((minX + maxX) / 2);
  const centerY = offY + Math.floor((minY + maxY) / 2);
  return { x: centerX, y: centerY };
}

function triggerFillBurst(region, color, tapX, tapY) {
  if (!region?.bounds) return;
  const anchor = getRegionBurstAnchor(region, tapX, tapY);
  const area = region.area || 0;
  const count = Math.max(8, Math.min(22, Math.round(area / 1800) + 8));

  spawnParticles(tapX, tapY, Math.max(6, Math.floor(count * 0.55)), {
    color,
    speedBoost: 0.5,
    sizeBoost: 1.25
  });

  const dist = Math.hypot(anchor.x - tapX, anchor.y - tapY);
  spawnParticles(anchor.x, anchor.y, count, {
    color,
    speedBoost: dist > 24 ? 0.9 : 0.65,
    sizeBoost: dist > 24 ? 1.8 : 1.5
  });
}

function fillRegionAtCanvasPoint(x, y, color) {
  const regionId = getRegionIdAtCanvasPoint(x, y);
  if (regionId <= 0) return null;

  const region = fillRegionsById[regionId];
  if (!region || !region.bounds) return null;

  const prevColor = paintByRegion[regionId] || null;
  const prevTool = paintToolByRegion[regionId] || 'solid';
  if (prevColor === color) {
    return { regionId, prevColor, prevTool, nextColor: color, nextTool: currentFillTool, changed: false };
  }

  paintByRegion[regionId] = color;
  paintToolByRegion[regionId] = currentFillTool;
  previewRegionId = 0;
  drawFilledRegion(regionId, color);
  if (lineartOverlay) cx.drawImage(lineartOverlay, 0, 0);
  triggerFillBurst(region, color, x, y);
  if (smartMissionRegionId === regionId) smartMissionRegionId = 0;
  trackEvent('fill_action', {
    regionId,
    regionArea: region.area || 0,
    color,
    fillTool: currentFillTool,
    burstTriggered: true
  });
  return { regionId, prevColor, prevTool, nextColor: color, nextTool: currentFillTool, changed: true };
}

function saveRegionFillAction(regionId, prevColor, prevTool, nextColor, nextTool) {
  historyStack.push({
    kind: 'region-fill',
    regionId,
    prevColor,
    prevTool,
    nextColor,
    nextTool
  });
  if (historyStack.length > 10) historyStack.shift();
}

function getPos(e) {
  const r = DC.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

function getTracePart() {
  return parts[curPartIdx] || null;
}

function showTraceHint(message) {
  const now = Date.now();
  if (now - lastTraceHintAt < TRACE_HINT_COOLDOWN_MS) return;
  lastTraceHintAt = now;
  showHint(message);
}

function showTraceGuide(x, y, valid) {
  traceGuideVisible = true;
  TG.style.display = 'block';
  TG.style.transform = `translate(${x}px, ${y}px) scale(${valid ? 1 : 0.72})`;
  TG.style.borderColor = valid ? 'rgba(59,130,246,0.92)' : 'rgba(251,146,60,0.92)';
  TG.style.background = valid ? 'rgba(191,219,254,0.22)' : 'rgba(254,215,170,0.18)';
  TG.style.boxShadow = valid
    ? '0 0 0 6px rgba(191,219,254,0.18), 0 8px 18px rgba(59,130,246,0.28)'
    : '0 0 0 6px rgba(254,215,170,0.16), 0 8px 18px rgba(249,115,22,0.22)';
}

function hideTraceGuide() {
  traceGuideVisible = false;
  TG.style.display = 'none';
}

function beginTraceStroke(x, y) {
  const part = getTracePart();
  if (!part) return false;

  const snap = snapToLine(x, y, part);
  if (!snap.valid) return false;

  isDrawing = true;
  lastX = snap.x;
  lastY = snap.y;
  traceHasPendingGap = false;
  return true;
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
    if (isRegionFillColorMode()) {
      const fillAction = fillRegionAtCanvasPoint(px, py, currentColor);
      if (fillAction?.changed) {
        suppressColorHintReschedule = true;
        saveRegionFillAction(fillAction.regionId, fillAction.prevColor, fillAction.prevTool, fillAction.nextColor, fillAction.nextTool);
        scheduleSmartMissionHint({ announce: true });
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
    if (!traceZone || !traceZone[py * DC.width + px]) {
      showTraceHint('선 가까이에서 시작해봐요! ✏️');
      return;
    }
    if (!beginTraceStroke(px, py)) {
      showTraceHint('점선 위에서 천천히 그려봐요! ✨');
      return;
    }
    return;
  }
  isDrawing = true; lastX = p.x; lastY = p.y;
}

function onMove(e) {
  e.preventDefault();
  const p = getPos(e);
  const px = Math.floor(p.x), py = Math.floor(p.y);

  if (!isDrawing) {
    if (appMode === 'trace' && document.getElementById('canvas-screen').classList.contains('active')) {
      const part = getTracePart();
      if (!part) {
        hideTraceGuide();
        return;
      }
      const snap = snapToLine(px, py, part);
      if (snap.valid) {
        showTraceGuide(snap.x, snap.y, true);
      } else if (traceZone && traceZone[py * DC.width + px]) {
        showTraceGuide(px, py, false);
      } else {
        hideTraceGuide();
      }
    } else if (isRegionFillColorMode() && document.getElementById('canvas-screen').classList.contains('active')) {
      scheduleSmartMissionHint();
      const hoveredRegionId = getRegionIdAtCanvasPoint(px, py);
      if (hoveredRegionId > 0) {
        setPreviewRegion(hoveredRegionId);
      } else if (smartMissionRegionId > 0) {
        setPreviewRegion(smartMissionRegionId);
      } else {
        clearPreviewRegion();
      }
    } else {
      clearPreviewRegion();
    }
    return;
  }

  if (appMode === 'trace') {
    const part = getTracePart();
    if (!part) return;

    const snap = snapToLine(px, py, part);
    if (!snap.valid) {
      traceHasPendingGap = true;
      showTraceHint('선을 따라 다시 이어가봐요! ✏️');
      return;
    }

    const dist = Math.hypot(snap.x - lastX, snap.y - lastY);
    if (traceHasPendingGap || dist > TRACE_REJOIN_DISTANCE) {
      lastX = snap.x;
      lastY = snap.y;
      traceHasPendingGap = false;
      return;
    }

    cx.globalCompositeOperation = 'source-over';
    cx.strokeStyle = currentColor;
    cx.lineWidth = brushSize;
    cx.beginPath(); cx.moveTo(lastX, lastY); cx.lineTo(snap.x, snap.y); cx.stroke();
    const now = Date.now();
    if (now - particleThrottle > 80) {
      spawnParticles(snap.x, snap.y, 2 + Math.floor(Math.random() * 2), {
        color: currentColor,
        speedBoost: 0.3
      });
      particleThrottle = now;
    }
    lastX = snap.x; lastY = snap.y;
    traceHasPendingGap = false;
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
  if (!isDrawing) {
    hideTraceGuide();
    clearPreviewRegion();
    if (isRegionFillColorMode()) {
      if (suppressColorHintReschedule) {
        suppressColorHintReschedule = false;
        return;
      }
      scheduleSmartMissionHint();
    }
    return;
  }
  isDrawing = false;
  activeClip = false;
  colorMask = null;
  traceHasPendingGap = false;
  hideTraceGuide();
  saveState();
  if (appMode === 'trace') checkTraceCompletion();
  if (isRegionFillColorMode()) scheduleSmartMissionHint();
}

// --- Particle Effect System (overlay canvas) ---
const PARTICLE_COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
const particles = [];
let particleAnimId = null;

const PC = document.createElement('canvas');
PC.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
document.body.appendChild(PC);
const pcx = PC.getContext('2d');

const TG = document.createElement('div');
TG.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:28px;height:28px;border-radius:999px;border:3px solid rgba(59,130,246,0.92);background:rgba(191,219,254,0.22);transform:translate(-9999px,-9999px) scale(1);pointer-events:none;z-index:9998;display:none;transition:transform .08s linear, box-shadow .12s ease, border-color .12s ease, background .12s ease';
document.body.appendChild(TG);

function resizeParticleCanvas() { PC.width = window.innerWidth; PC.height = window.innerHeight; }
resizeParticleCanvas();
window.addEventListener('resize', resizeParticleCanvas);

class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3 + (options.speedBoost || 0);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5;
    this.size = (1.5 + Math.random() * 2) * (options.sizeBoost || 1);
    this.color = options.color || PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
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

function spawnParticles(x, y, count, options = {}) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, options));
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
      paintToolByRegion[lastEntry.regionId] = lastEntry.prevTool || 'solid';
    } else {
      delete paintByRegion[lastEntry.regionId];
      delete paintToolByRegion[lastEntry.regionId];
    }
    redrawColorScene();
    clearSmartMissionPulse();
    scheduleSmartMissionHint({ immediate: true, announce: true });
    trackEvent('undo_used', {
      mode: appMode,
      regionFillUndo: true
    });
    return;
  }

  if (historyStack.length > 1) {
    historyStack.pop();
    const snapshotEntry = historyStack[historyStack.length - 1];
    if (snapshotEntry?.kind === 'snapshot') {
      cx.putImageData(snapshotEntry.imageData, 0, 0);
    }
    trackEvent('undo_used', {
      mode: appMode,
      regionFillUndo: false
    });
  }
}

function saveImage() {
  const link = document.createElement('a');
  link.download = 'coloring-' + Date.now() + '.png';
  link.href = DC.toDataURL();
  link.click();
  trackEvent('save_image', {
    mode: appMode
  });
  const t = document.getElementById('save-toast');
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
  celebrate();
}

function exportSession() {
  exportAnalyticsSession();
  const t = document.getElementById('save-toast');
  t.textContent = '📤 세션 저장 완료!';
  t.style.display = 'block';
  setTimeout(() => {
    t.style.display = 'none';
    t.textContent = '💾 저장 완료!';
  }, 2000);
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
document.getElementById('btn-export').addEventListener('click', exportSession);
document.getElementById('btn-creative').addEventListener('click', () => { hasPhoto = false; showScreen('mode-screen'); });
document.getElementById('btn-mode-back').addEventListener('click', () => {
  showScreen(hasPhoto ? 'preview-screen' : 'upload-screen');
});

document.querySelectorAll('.mtbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    edgeMode = btn.dataset.edge;
    activeEdgeMode = edgeMode;
    setAnalyticsContext({
      selectedMode: edgeMode,
      resolvedMode: edgeMode,
      detail: detailLevel
    });
    document.querySelectorAll('.mtbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateModeGuide(edgeMode, edgeMode);
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
  const items = builtinPresetPack?.items || [];
  items.forEach((item) => {
    const preset = PRESETS[item.presetIndex];
    if (!preset) return;
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.innerHTML = `<span class="preset-emoji">${preset.emoji}</span><span class="preset-name">${preset.name}</span>`;
    card.addEventListener('click', () => loadPreset(item.presetIndex));
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
    activeEdgeMode = 'illustration';
    setAnalyticsContext({
      selectedMode: 'illustration',
      resolvedMode: 'illustration',
      detail: detailLevel
    });
    parts = [];
    hydrateFillData(null);
    const lp = document.getElementById('lineart-preview');
    lp.width = result.size; lp.height = result.size;
    lp.getContext('2d').putImageData(lineartData, 0, 0);
    document.getElementById('preview-img').src = SC.toDataURL();
    hasPhoto = true;
    isProcessing = false;
    showScreen('mode-screen');
    trackEvent('preview_opened', {
      detail: detailLevel,
      source: 'preset',
      presetName: PRESETS[idx]?.name || null
    });
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
