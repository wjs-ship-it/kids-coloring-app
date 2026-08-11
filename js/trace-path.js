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
      let front = 0;
      const pixels = [];
      let touchesBorder = false;
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;
      labels[start] = nextLabel;

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

function traceBoundaryFromPixels(regionPixels, isEdge, w, h) {
  const edgeSet = new Uint8Array(w * h);
  for (const pos of regionPixels) {
    const x = pos % w;
    const y = Math.floor(pos / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && isEdge[ny * w + nx]) {
        edgeSet[ny * w + nx] = 1;
      }
    }
  }
  return traceContour(edgeSet, w, h);
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
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && edgeSet[ny * w + nx] && !visited[ny * w + nx]) {
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

function splitContour(contour, segmentCount) {
  if (segmentCount <= 1 || contour.length < segmentCount * 4) return [contour];
  const size = Math.ceil(contour.length / segmentCount);
  const chunks = [];
  for (let i = 0; i < contour.length; i += size) {
    const chunk = contour.slice(i, Math.min(contour.length, i + size));
    if (chunk.length >= 4) chunks.push(chunk);
  }
  return chunks.length ? chunks : [contour];
}

function buildPart(boundaryPos, w) {
  let sumY = 0;
  for (const pos of boundaryPos) sumY += Math.floor(pos / w);
  const sampleStep = Math.max(1, Math.floor(boundaryPos.length / 36));
  const samplePoints = [];
  for (let i = 0; i < boundaryPos.length; i += sampleStep) samplePoints.push(boundaryPos[i]);
  return {
    pixels: boundaryPos,
    boundaryPos,
    samplePoints,
    touchesBorder: false,
    isBand: true,
    traceStrategy: 'simplified',
    centerY: boundaryPos.length ? sumY / boundaryPos.length : 0,
  };
}

function buildOuterContourParts(isEdge, w, h, options = {}) {
  const { mode = 'object', detail = 50 } = options;
  const contour = traceContour(isEdge, w, h);
  if (contour.length < 16) return [];

  const tolerance = mode === 'portrait'
    ? Math.max(1.8, 4.8 - detail / 32)
    : Math.max(1.4, 4.2 - detail / 34);
  const simplified = evenlySampleContour(simplifyContour(contour, w, tolerance), mode === 'portrait' ? 180 : 220);
  const segmentCount = mode === 'portrait'
    ? Math.max(3, Math.min(5, Math.round(3 + detail / 45)))
    : Math.max(4, Math.min(6, Math.round(4 + detail / 40)));
  return splitContour(simplified, segmentCount).map((chunk) => buildPart(chunk, w));
}

function scoreRegion(region, w, h, mode) {
  const diag = Math.hypot(w, h) || 1;
  const centerX = w / 2;
  const centerY = h / 2;
  const centerDist = Math.hypot(region.centerX - centerX, region.centerY - centerY) / diag;
  const centerDx = Math.abs(region.centerX - centerX) / Math.max(1, w);
  const centerDy = Math.abs(region.centerY - centerY) / Math.max(1, h);
  const portraitFeatureBand = centerDx < 0.24 && centerDy < 0.22 && region.centerY > h * 0.12 && region.centerY < h * 0.70;
  const portraitTorsoBand = centerDx < 0.32 && centerDy < 0.34 && region.centerY >= h * 0.28 && region.centerY < h * 0.90;
  const areaWeight = region.area;
  const spanWeight = Math.max(region.width, region.height) * 12;
  const centerWeight = mode === 'portrait'
    ? (1 - centerDist) * 200 + (portraitFeatureBand ? 210 : 0) + (portraitTorsoBand ? 65 : 0)
    : (1 - centerDist) * 80;
  return areaWeight + spanWeight + centerWeight;
}

function buildInteriorParts(isEdge, w, h, options = {}) {
  const { mode = 'object', detail = 50 } = options;
  const regions = collectVoidRegions(isEdge, w, h);
  const detailBias = Math.max(0, Math.min(1, detail / 100));
  const minArea = mode === 'portrait'
    ? 24 + Math.round((1 - detailBias) * 16)
    : 28 + Math.round((1 - detailBias) * 20);
  const maxParts = mode === 'portrait'
    ? 3 + Math.round(detailBias * 2)
    : 3 + Math.round(detailBias * 2);

  return regions
    .filter((region) => !region.touchesBorder && region.area >= minArea)
    .map((region) => ({ region, score: scoreRegion(region, w, h, mode) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxParts)
    .map(({ region }) => {
      const contour = traceBoundaryFromPixels(region.pixels, isEdge, w, h);
      const tolerance = mode === 'portrait'
        ? Math.max(2.0, 4.6 - detail / 32)
        : Math.max(1.4, 3.8 - detail / 36);
      const simplified = evenlySampleContour(
        simplifyContour(contour, w, tolerance),
        mode === 'portrait' ? 96 : 100
      );
      return buildPart(simplified, w);
    })
    .filter((part) => part.boundaryPos.length >= 4);
}

export function detectTraceParts(lineartData, w, h, options = {}) {
  const { mode = 'object', detail = 50 } = options;
  const isEdge = buildEdgeMap(lineartData, w, h);
  const outerParts = buildOuterContourParts(isEdge, w, h, { mode, detail });
  const interiorParts = buildInteriorParts(isEdge, w, h, { mode, detail });
  let parts = outerParts.concat(interiorParts);

  if (parts.length === 0) return [];

  parts.sort((a, b) => a.centerY - b.centerY);
  const maxFinalParts = mode === 'portrait'
    ? Math.max(4, Math.min(7, Math.round(4 + detail / 42)))
    : Math.max(6, Math.min(9, Math.round(6 + detail / 38)));
  if (parts.length > maxFinalParts) parts = parts.slice(0, maxFinalParts);
  return parts;
}
