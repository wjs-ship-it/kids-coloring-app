import {
  applyFamilyOrdering,
  buildFamilyMetrics,
  detectIllustrationShapeFamily,
  getFamilyPartCap,
} from './trace-shape-family.js';
import { collectEdgeComponents } from './lineart-shape.js';
import {
  buildMascotSilhouetteParts,
  buildLongneckSilhouetteParts,
  buildQuadrupedContourParts,
  buildQuadrupedSilhouetteParts,
  buildRoundCharacterContourParts,
  buildRoundCharacterSilhouette,
  buildVehicleContourParts,
  buildVehicleSilhouetteParts,
  selectSemanticRegions,
} from './trace-semantic-builders.js';

function buildEdgeMap(lineartData, w, h) {
  const data = lineartData.data || lineartData;
  const isEdge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) isEdge[i] = data[i * 4] < 128 ? 1 : 0;
  return isEdge;
}

function buildEdgeSetFromComponent(labels, componentId, w, h) {
  const edgeSet = new Uint8Array(w * h);
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === componentId) edgeSet[i] = 1;
  }
  return edgeSet;
}

function selectPrimaryEdgeComponent(isEdge, w, h) {
  const { labels, components } = collectEdgeComponents(isEdge, w, h);
  if (components.length === 0) return null;

  const centerX = w / 2;
  const centerY = h / 2;
  const diag = Math.hypot(w, h) || 1;
  const ranked = components
    .map((component) => {
      const span = Math.max(component.width, component.height);
      const coverage = (component.width * component.height) / Math.max(1, w * h);
      const centerDist = Math.hypot(component.centerX - centerX, component.centerY - centerY) / diag;
      const score = component.area + span * 10 + coverage * 10000 + (1 - centerDist) * 140 - (component.touchesBorder ? 60 : 0);
      return { component, score };
    })
    .sort((a, b) => b.score - a.score);

  return { labels, component: ranked[0].component };
}

function collectVoidRegions(isEdge, w, h) {
  const labels = new Int32Array(w * h);
  const regions = [];
  let nextLabel = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (isEdge[start] || labels[start] !== 0) continue;

      const queue = [[x, y]];
      labels[start] = nextLabel;
      let front = 0;
      const pixels = [];
      let touchesBorder = false;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;

      while (front < queue.length) {
        const [cx, cy] = queue[front++];
        const pos = cy * w + cx;
        pixels.push(pos);
        sumX += cx;
        sumY += cy;
        if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) touchesBorder = true;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const np = ny * w + nx;
          if (!isEdge[np] && labels[np] === 0) {
            labels[np] = nextLabel;
            queue.push([nx, ny]);
          }
        }
      }

      regions.push({
        label: nextLabel,
        pixels,
        area: pixels.length,
        touchesBorder,
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: sumX / pixels.length,
        centerY: sumY / pixels.length,
      });
      nextLabel++;
    }
  }

  return regions;
}

function traceContour(edgeSet, w, h) {
  const visited = new Uint8Array(w * h);
  const dx8 = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy8 = [0, 1, 1, 1, 0, -1, -1, -1];
  let start = -1;
  for (let i = 0; i < edgeSet.length; i++) {
    if (edgeSet[i]) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];

  const contour = [];
  let cx = start % w;
  let cy = Math.floor(start / w);

  for (let step = 0; step < w * h; step++) {
    const pos = cy * w + cx;
    if (visited[pos]) break;
    visited[pos] = 1;
    contour.push(pos);

    let found = false;
    for (let k = 0; k < 8; k++) {
      const nx = cx + dx8[k];
      const ny = cy + dy8[k];
      const np = ny * w + nx;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && edgeSet[np] && !visited[np]) {
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return contour;
}

function buildEdgeSetFromRegion(regionPixels, isEdge, w, h) {
  const edgeSet = new Uint8Array(w * h);
  for (const pos of regionPixels) {
    const x = pos % w;
    const y = Math.floor(pos / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const np = ny * w + nx;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && isEdge[np]) edgeSet[np] = 1;
    }
  }
  return edgeSet;
}

function perpendicularDistance(point, start, end, w) {
  const px = point % w;
  const py = Math.floor(point / w);
  const sx = start % w;
  const sy = Math.floor(start / w);
  const ex = end % w;
  const ey = Math.floor(end / w);
  if (sx === ex && sy === ey) return Math.hypot(px - sx, py - sy);
  const num = Math.abs((ey - sy) * px - (ex - sx) * py + ex * sy - ey * sx);
  const den = Math.hypot(ey - sy, ex - sx);
  return den > 0 ? num / den : 0;
}

function simplifyContour(contour, w, tolerance) {
  if (contour.length <= 8) return contour.slice();
  const keep = new Uint8Array(contour.length);
  keep[0] = 1;
  keep[contour.length - 1] = 1;
  const stack = [[0, contour.length - 1]];

  while (stack.length) {
    const [startIdx, endIdx] = stack.pop();
    let maxDist = 0;
    let splitIdx = -1;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistance(contour[i], contour[startIdx], contour[endIdx], w);
      if (dist > maxDist) {
        maxDist = dist;
        splitIdx = i;
      }
    }
    if (splitIdx >= 0 && maxDist > tolerance) {
      keep[splitIdx] = 1;
      stack.push([startIdx, splitIdx], [splitIdx, endIdx]);
    }
  }

  const simplified = [];
  for (let i = 0; i < contour.length; i++) {
    if (keep[i]) simplified.push(contour[i]);
  }
  return simplified.length >= 4 ? simplified : contour.slice();
}

function evenlySampleContour(contour, maxPoints) {
  if (contour.length <= maxPoints) return contour.slice();
  const step = contour.length / maxPoints;
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(contour[Math.min(contour.length - 1, Math.floor(i * step))]);
  }
  return sampled;
}

function contourMetrics(contour, w, h) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  for (const pos of contour) {
    const x = pos % w;
    const y = Math.floor(pos / w);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sumX += x;
    sumY += y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
    centerX: contour.length ? sumX / contour.length : w / 2,
    centerY: contour.length ? sumY / contour.length : h / 2,
  };
}

function promoteMascotFamily(initialFamily, regions, metrics) {
  if (initialFamily === 'quadruped_animal' || initialFamily === 'longneck_animal' || initialFamily === 'vehicle') {
    return initialFamily;
  }
  const innerRegions = regions.filter((region) => !region.touchesBorder);
  if (innerRegions.length < 4) return initialFamily;

  const upperFaceRegions = innerRegions.filter((region) =>
    region.centerY < metrics.minY + metrics.height * 0.46 &&
    region.area < metrics.width * metrics.height * 0.035 &&
    region.centerX > metrics.minX + metrics.width * 0.24 &&
    region.centerX < metrics.minX + metrics.width * 0.76
  );
  const lowerRoundedRegions = innerRegions.filter((region) =>
    region.centerY > metrics.minY + metrics.height * 0.46 &&
    region.area > metrics.width * metrics.height * 0.025 &&
    region.centerX > metrics.minX + metrics.width * 0.18 &&
    region.centerX < metrics.minX + metrics.width * 0.82
  );
  const aspect = metrics.height / Math.max(1, metrics.width);
  const centeredX = metrics.centerX > metrics.minX + metrics.width * 0.36 &&
    metrics.centerX < metrics.minX + metrics.width * 0.64;

  if (upperFaceRegions.length >= 2 && lowerRoundedRegions.length >= 2 && aspect > 0.7 && aspect < 1.7 && centeredX) {
    return 'mascot_character';
  }

  return initialFamily;
}

function extractLongestRun(contour, w, predicate) {
  if (!contour.length) return [];
  const doubled = contour.concat(contour);
  let best = [];
  let current = [];
  for (let i = 0; i < doubled.length; i++) {
    const pos = doubled[i];
    const x = pos % w;
    const y = Math.floor(pos / w);
    if (predicate(x, y, pos)) {
      current.push(pos);
      if (current.length > best.length) best = current.slice();
    } else {
      current = [];
    }
  }
  if (best.length > contour.length) best = best.slice(0, contour.length);
  const unique = [];
  const seen = new Set();
  for (const pos of best) {
    const key = String(pos);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(pos);
    }
  }
  return unique;
}

function sampleForPart(boundaryPos) {
  const sampleStep = Math.max(1, Math.floor(boundaryPos.length / 36));
  const samplePoints = [];
  for (let i = 0; i < boundaryPos.length; i += sampleStep) samplePoints.push(boundaryPos[i]);
  return samplePoints;
}

function buildPart(boundaryPos, w, meta = {}) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const pos of boundaryPos) {
    const x = pos % w;
    const y = Math.floor(pos / w);
    sumX += x;
    sumY += y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const centroid = {
    x: boundaryPos.length ? sumX / boundaryPos.length : 0,
    y: boundaryPos.length ? sumY / boundaryPos.length : 0,
  };

  return {
    pixels: boundaryPos,
    boundaryPos,
    samplePoints: sampleForPart(boundaryPos),
    touchesBorder: false,
    isBand: true,
    traceStrategy: 'semantic',
    centerY: centroid.y,
    semanticCategory: meta.semanticCategory || 'ornament',
    semanticScore: meta.semanticScore || 0,
    semanticLabel: meta.semanticLabel || '',
    sourceRegionId: meta.sourceRegionId || 0,
    attachSide: meta.attachSide || 'center',
    drawOrder: meta.drawOrder || 99,
    semanticId: meta.semanticId || '',
    displayName: meta.displayName || '',
    hint: meta.hint || '',
    toleranceMultiplier: meta.toleranceMultiplier || 1,
    shapeFamily: meta.shapeFamily || 'illustration_generic',
    bbox: { minX, minY, maxX, maxY },
    centroid,
  };
}

function toSemanticId(label, category, drawOrder) {
  const source = label || `${category}_${drawOrder}`;
  return source
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function getTopicParticle(label) {
  const last = String(label || '').trim().at(-1);
  if (!last) return '는';
  const code = last.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return '는';
  return (code - 0xAC00) % 28 === 0 ? '는' : '은';
}

function getPartHint(label, family, category) {
  if (!label) return '점선을 따라 그려봐요! ✏️';
  if (category === 'head_feature') return `${label}${getTopicParticle(label)} 나중에 또렷하게 그려봐요! ✏️`;
  if (category === 'ornament') return `${label}으로 마무리해봐요! ✨`;
  if (category === 'tail_feature') return `${label} 쪽으로 길게 이어 그려봐요! ✏️`;
  if (family === 'longneck_animal' && label === '목') return '목을 길게 이어서 따라 그려봐요! ✏️';
  return `${label}부터 따라 그려봐요! ✏️`;
}

function getToleranceMultiplier(family, category, label) {
  if (category === 'silhouette') return family === 'longneck_animal' ? 1.2 : 1.16;
  if (category === 'limb') return label === '앞다리' || label === '뒷다리' ? 1.08 : 1.1;
  if (category === 'tail_feature') return 1.08;
  if (category === 'head_feature') return 1.04;
  if (category === 'ornament') return 1;
  return 1.05;
}

function enrichSemanticPresentation(parts, family) {
  return parts.map((part) => {
    const displayName = part.semanticLabel || getSemanticLabel(family, part.semanticCategory, part.drawOrder);
    return {
      ...part,
      semanticId: toSemanticId(displayName, part.semanticCategory, part.drawOrder),
      displayName,
      hint: getPartHint(displayName, family, part.semanticCategory),
      toleranceMultiplier: getToleranceMultiplier(family, part.semanticCategory, displayName),
    };
  });
}

function sortSemanticParts(parts, family, metrics) {
  const categoryRank = {
    silhouette: 0,
    limb: 1,
    head_feature: 2,
    tail_feature: 3,
    ornament: 4,
  };
  const sorted = parts
    .slice()
    .sort((a, b) =>
      a.drawOrder - b.drawOrder ||
      (categoryRank[a.semanticCategory] ?? 9) - (categoryRank[b.semanticCategory] ?? 9) ||
      a.centroid.x - b.centroid.x ||
      a.centroid.y - b.centroid.y
    );
  return applyFamilyOrdering(sorted, family, metrics);
}

function normalizeFamilyParts(parts, family) {
  if (family !== 'quadruped_animal' && family !== 'vehicle' && family !== 'mascot_character') return parts;

  const deduped = [];
  const seenLabels = new Set();
  for (const part of parts) {
    const label = part.semanticLabel || `${part.semanticCategory}:${part.drawOrder}`;
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    deduped.push(part);
  }
  return deduped;
}

function buildSemanticHelpers() {
  return {
    buildEdgeSetFromRegion,
    traceContour,
    simplifyContour,
    evenlySampleContour,
    extractLongestRun,
    buildPart,
  };
}

export function detectSemanticTraceParts(lineartData, w, h, options = {}) {
  const { detail = 50 } = options;
  const isEdge = buildEdgeMap(lineartData, w, h);
  const primary = selectPrimaryEdgeComponent(isEdge, w, h);
  if (!primary?.component) return [];

  const contour = traceContour(buildEdgeSetFromComponent(primary.labels, primary.component.id, w, h), w, h);
  if (contour.length < 24) return [];

  const metrics = contourMetrics(contour, w, h);
  metrics.minX = primary.component.minX;
  metrics.minY = primary.component.minY;
  metrics.maxX = primary.component.maxX;
  metrics.maxY = primary.component.maxY;
  metrics.width = primary.component.width;
  metrics.height = primary.component.height;
  metrics.centerX = primary.component.centerX;
  metrics.centerY = primary.component.centerY;
  metrics.isEdge = isEdge;
  metrics.canvasW = w;
  metrics.canvasH = h;
  const regions = collectVoidRegions(isEdge, w, h);
  const familyMetrics = buildFamilyMetrics(regions, metrics);
  const detectedFamily = detectIllustrationShapeFamily(familyMetrics);
  const family = promoteMascotFamily(detectedFamily, regions, metrics);
  const helpers = buildSemanticHelpers();

  let silhouetteParts = [];
  if (family === 'mascot_character') {
    silhouetteParts = buildMascotSilhouetteParts(contour, metrics, w, detail, helpers);
  } else if (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic') {
    silhouetteParts = [buildRoundCharacterSilhouette(contour, metrics, w, detail, family, helpers)];
  } else if (family === 'longneck_animal') {
    silhouetteParts = buildLongneckSilhouetteParts(contour, metrics, w, detail, helpers);
  } else if (family === 'quadruped_animal') {
    silhouetteParts = buildQuadrupedSilhouetteParts(contour, metrics, w, detail, helpers);
  } else if (family === 'vehicle') {
    silhouetteParts = buildVehicleSilhouetteParts(contour, metrics, w, detail, helpers);
  }

  let contourParts = [];
  if (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic') {
    contourParts = buildRoundCharacterContourParts(contour, metrics, w, detail, family, helpers);
  } else if (family === 'quadruped_animal') {
    contourParts = buildQuadrupedContourParts(contour, metrics, w, detail, helpers);
  } else if (family === 'vehicle') {
    contourParts = buildVehicleContourParts(contour, metrics, w, detail, helpers);
  }

  const semanticRegions = selectSemanticRegions(regions, metrics, family, helpers);
  const parts = normalizeFamilyParts(sortSemanticParts(
    silhouetteParts.concat(contourParts, semanticRegions),
    family,
    metrics
  ), family);
  const maxParts = getFamilyPartCap(family);
  return enrichSemanticPresentation(
    parts.filter((part) => part.boundaryPos.length >= 4).slice(0, maxParts),
    family
  );
}
