import { detectIllustrationShapeFamily } from './trace-shape-family.js';

function buildEdgeMap(lineartData, w, h) {
  const data = lineartData.data || lineartData;
  const isEdge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) isEdge[i] = data[i * 4] < 128 ? 1 : 0;
  return isEdge;
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
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;

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
  for (let i = 0; i < contour.length; i++) if (keep[i]) simplified.push(contour[i]);
  return simplified.length >= 4 ? simplified : contour.slice();
}

function evenlySampleContour(contour, maxPoints) {
  if (contour.length <= maxPoints) return contour.slice();
  const step = contour.length / maxPoints;
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) sampled.push(contour[Math.min(contour.length - 1, Math.floor(i * step))]);
  return sampled;
}

function contourMetrics(contour, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0, sumX = 0, sumY = 0;
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
    minX, minY, maxX, maxY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
    centerX: contour.length ? sumX / contour.length : w / 2,
    centerY: contour.length ? sumY / contour.length : h / 2,
  };
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
  let sumY = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sumX = 0;
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
    y: boundaryPos.length ? sumY / boundaryPos.length : 0
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
    sourceRegionId: meta.sourceRegionId || 0,
    attachSide: meta.attachSide || 'center',
    drawOrder: meta.drawOrder || 99,
    shapeFamily: meta.shapeFamily || 'illustration_generic',
    bbox: { minX, minY, maxX, maxY },
    centroid,
  };
}

function classifyAttachSide(region, metrics) {
  const centerX = metrics.minX + metrics.width / 2;
  const centerY = metrics.minY + metrics.height / 2;
  const dx = region.centerX - centerX;
  const dy = region.centerY - centerY;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
}

function buildFamilyMetrics(regions, metrics) {
  const bottomLimbCount = regions.filter((region) =>
    region.centerY > metrics.minY + metrics.height * 0.58 &&
    region.area > metrics.width * 0.02 &&
    region.area < metrics.width * metrics.height * 0.14
  ).length;
  const topFeatureCount = regions.filter((region) =>
    region.centerY < metrics.minY + metrics.height * 0.42 &&
    region.area < metrics.width * metrics.height * 0.12
  ).length;
  const rightTailMass = regions
    .filter((region) => region.centerX > metrics.minX + metrics.width * 0.68)
    .reduce((acc, region) => acc + region.area, 0);
  return {
    bboxWidth: metrics.width,
    bboxHeight: metrics.height,
    centerX: metrics.centerX / Math.max(1, metrics.maxX + 1),
    centerY: metrics.centerY / Math.max(1, metrics.maxY + 1),
    bottomLimbCount,
    topFeatureCount,
    rightTailBias: rightTailMass / Math.max(1, metrics.width * metrics.height),
    lowerRightMass: rightTailMass / Math.max(1, metrics.width * metrics.height),
    topMass: topFeatureCount / Math.max(1, regions.length)
  };
}

function selectSemanticRegions(regions, metrics, family) {
  const areaFloor = Math.max(12, Math.round(metrics.width * metrics.height * 0.008));
  const candidates = regions.filter((region) => !region.touchesBorder && region.area >= areaFloor);

  return candidates.map((region) => {
    let semanticCategory = 'ornament';
    let drawOrder = 5;
    const attachSide = classifyAttachSide(region, metrics);

    if (family === 'round_character') {
      if (region.centerY > metrics.minY + metrics.height * 0.56) {
        semanticCategory = 'limb';
        drawOrder = 2;
      } else if (region.centerY < metrics.minY + metrics.height * 0.5) {
        semanticCategory = 'head_feature';
        drawOrder = 3;
      }
    } else if (family === 'longneck_animal') {
      if (region.centerY > metrics.minY + metrics.height * 0.54) {
        semanticCategory = 'limb';
        drawOrder = 4;
      } else if (region.centerY < metrics.minY + metrics.height * 0.24) {
        semanticCategory = 'head_feature';
        drawOrder = 2;
      } else if (region.centerX > metrics.minX + metrics.width * 0.72) {
        semanticCategory = 'tail_feature';
        drawOrder = 5;
      }
    } else if (region.centerY < metrics.minY + metrics.height * 0.45) {
      semanticCategory = 'head_feature';
      drawOrder = 3;
    }

    const edgeSet = buildEdgeSetFromRegion(region.pixels, metrics.isEdge, metrics.canvasW, metrics.canvasH);
    const contour = traceContour(edgeSet, metrics.canvasW, metrics.canvasH);
    if (contour.length < 8) return null;
    const simplified = evenlySampleContour(simplifyContour(contour, metrics.canvasW, 1.8), 88);
    return buildPart(simplified, metrics.canvasW, {
      semanticCategory,
      semanticScore: region.area,
      sourceRegionId: region.label,
      attachSide,
      drawOrder,
      shapeFamily: family,
    });
  }).filter(Boolean);
}

function buildRoundCharacterSilhouette(contour, metrics, w, detail, family = 'round_character') {
  const simplified = evenlySampleContour(
    simplifyContour(contour, w, Math.max(1.0, 2.8 - detail / 42)),
    180
  );
  return buildPart(simplified, w, {
    semanticCategory: 'silhouette',
    semanticScore: simplified.length,
    drawOrder: 1,
    shapeFamily: family,
  });
}

function buildRoundCharacterContourParts(contour, metrics, w, detail, family = 'round_character') {
  const leftX = metrics.minX + metrics.width * 0.28;
  const rightX = metrics.minX + metrics.width * 0.72;
  const upperY = metrics.minY + metrics.height * 0.36;
  const midY = metrics.minY + metrics.height * 0.56;
  const lowerY = metrics.minY + metrics.height * 0.68;
  const centerX = metrics.minX + metrics.width / 2;
  const defs = [
    [extractLongestRun(contour, w, (x, y) => x <= leftX && y > upperY && y < lowerY), 'limb', 2],
    [extractLongestRun(contour, w, (x, y) => x >= rightX && y > upperY && y < lowerY), 'limb', 3],
    [extractLongestRun(contour, w, (x, y) => y >= midY && x < centerX), 'limb', 4],
    [extractLongestRun(contour, w, (x, y) => y >= midY && x >= centerX), 'limb', 5],
  ];
  const parts = [];
  for (const [boundaryPos, semanticCategory, drawOrder] of defs) {
    if (boundaryPos.length < 10) continue;
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.0, 2.5 - detail / 45)),
      72
    );
    parts.push(buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      drawOrder,
      shapeFamily: family,
    }));
  }
  return parts;
}

function buildLongneckSilhouetteParts(contour, metrics, w, detail) {
  const topCut = metrics.minY + metrics.height * 0.24;
  const neckCut = metrics.minY + metrics.height * 0.5;
  const bodyCut = metrics.minY + metrics.height * 0.44;
  const tailX = metrics.minX + metrics.width * 0.72;
  const centerBand = metrics.minX + metrics.width * 0.17;
  const centerX = metrics.minX + metrics.width / 2;

  const headRun = extractLongestRun(contour, w, (_x, y) => y <= topCut);
  const neckRun = extractLongestRun(contour, w, (x, y) =>
    y > topCut && y <= neckCut && Math.abs(x - centerX) <= centerBand
  );
  const bodyRun = extractLongestRun(contour, w, (x, y) =>
    y >= bodyCut && x < tailX
  );
  const tailRun = extractLongestRun(contour, w, (x, y) =>
    x >= tailX || (y >= metrics.minY + metrics.height * 0.66 && x >= centerX)
  );

  const result = [];
  for (const [boundaryPos, semanticCategory, drawOrder] of [
    [headRun, 'silhouette', 1],
    [neckRun, 'silhouette', 2],
    [bodyRun, 'silhouette', 3],
    [tailRun, 'tail_feature', 5],
  ]) {
    if (boundaryPos.length < 12) continue;
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.1, 3.0 - detail / 40)),
      semanticCategory === 'tail_feature' ? 72 : 96
    );
    result.push(buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      drawOrder,
      shapeFamily: 'longneck_animal',
    }));
  }
  return result;
}

function sortSemanticParts(parts) {
  const categoryRank = {
    silhouette: 0,
    limb: 1,
    head_feature: 2,
    tail_feature: 3,
    ornament: 4,
  };
  return parts
    .slice()
    .sort((a, b) =>
      a.drawOrder - b.drawOrder ||
      (categoryRank[a.semanticCategory] || 9) - (categoryRank[b.semanticCategory] || 9) ||
      a.centroid.x - b.centroid.x ||
      a.centroid.y - b.centroid.y
    );
}

export function detectSemanticTraceParts(lineartData, w, h, options = {}) {
  const { detail = 50 } = options;
  const isEdge = buildEdgeMap(lineartData, w, h);
  const contour = traceContour(isEdge, w, h);
  if (contour.length < 24) return [];

  const metrics = contourMetrics(contour, w, h);
  metrics.isEdge = isEdge;
  metrics.canvasW = w;
  metrics.canvasH = h;
  const regions = collectVoidRegions(isEdge, w, h);
  const family = detectIllustrationShapeFamily(buildFamilyMetrics(regions, metrics));

  let silhouetteParts = [];
  if (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic') {
    silhouetteParts = [buildRoundCharacterSilhouette(contour, metrics, w, detail, family)];
  } else if (family === 'longneck_animal') {
    silhouetteParts = buildLongneckSilhouetteParts(contour, metrics, w, detail);
  }

  const contourParts = (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic')
    ? buildRoundCharacterContourParts(contour, metrics, w, detail, family)
    : [];
  const semanticRegions = selectSemanticRegions(regions, metrics, family);
  const parts = sortSemanticParts(silhouetteParts.concat(contourParts, semanticRegions));
  const maxParts = family === 'round_character' ? 7 : family === 'longneck_animal' ? 7 : 6;
  return parts.filter((part) => part.boundaryPos.length >= 4).slice(0, maxParts);
}
