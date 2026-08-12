function buildPartMetrics(part, w) {
  const boundary = part?.boundaryPos || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const pos of boundary) {
    const x = pos % w;
    const y = Math.floor(pos / w);
    sumX += x;
    sumY += y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const width = boundary.length ? maxX - minX + 1 : 0;
  const height = boundary.length ? maxY - minY + 1 : 0;
  return {
    boundaryCount: boundary.length,
    sampleCount: (part?.samplePoints || []).length,
    width,
    height,
    reach: Math.max(width, height),
    centroidX: boundary.length ? sumX / boundary.length : 0,
    centroidY: boundary.length ? sumY / boundary.length : 0,
  };
}

function getThresholds(mode, part, w, h) {
  const minCanvasSpan = Math.max(12, Math.round(Math.min(w, h) * 0.04));
  const semanticCategory = part?.semanticCategory || '';
  const semantic = part?.traceStrategy === 'semantic';

  if (semantic && semanticCategory === 'silhouette') {
    return { minBoundary: 18, minSamples: 5, minReach: minCanvasSpan };
  }
  if (semantic && (semanticCategory === 'head_feature' || semanticCategory === 'tail_feature')) {
    return { minBoundary: 14, minSamples: 4, minReach: Math.max(10, Math.round(minCanvasSpan * 0.7)) };
  }
  if (mode === 'illustration') {
    return { minBoundary: 18, minSamples: 5, minReach: minCanvasSpan };
  }
  if (mode === 'portrait') {
    return { minBoundary: 14, minSamples: 4, minReach: Math.max(10, Math.round(minCanvasSpan * 0.72)) };
  }
  return { minBoundary: 16, minSamples: 4, minReach: Math.max(10, Math.round(minCanvasSpan * 0.82)) };
}

function recalcPartGeometry(part, w) {
  const boundaryPos = part.boundaryPos || [];
  let sumY = 0;
  for (const pos of boundaryPos) sumY += Math.floor(pos / w);
  const sampleStep = Math.max(1, Math.floor(boundaryPos.length / 36));
  const samplePoints = [];
  for (let i = 0; i < boundaryPos.length; i += sampleStep) samplePoints.push(boundaryPos[i]);
  return {
    ...part,
    pixels: boundaryPos.slice(),
    samplePoints,
    centerY: boundaryPos.length ? sumY / boundaryPos.length : part.centerY || 0,
  };
}

function mergeWeakPart(parts, weakIndex, w) {
  const weakPart = parts[weakIndex];
  const weakMetrics = buildPartMetrics(weakPart, w);
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < parts.length; i++) {
    if (i === weakIndex) continue;
    const candidate = parts[i];
    const candidateMetrics = buildPartMetrics(candidate, w);
    const semanticPenalty = (
      weakPart.traceStrategy === 'semantic' &&
      candidate.traceStrategy === 'semantic' &&
      weakPart.semanticCategory !== candidate.semanticCategory
    ) ? 20 : 0;
    const distance = Math.hypot(
      weakMetrics.centroidX - candidateMetrics.centroidX,
      weakMetrics.centroidY - candidateMetrics.centroidY
    ) + semanticPenalty;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return parts.filter((_, index) => index !== weakIndex);

  const target = parts[bestIndex];
  const merged = recalcPartGeometry({
    ...target,
    boundaryPos: target.boundaryPos.concat(weakPart.boundaryPos || []),
  }, w);

  return parts
    .map((part, index) => {
      if (index === bestIndex) return merged;
      if (index === weakIndex) return null;
      return part;
    })
    .filter(Boolean);
}

export function pruneTraceParts(parts, w, h, options = {}) {
  const mode = options.mode || 'object';
  if (!Array.isArray(parts) || parts.length === 0) return [];

  let current = parts.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < current.length; index++) {
      const part = current[index];
      const metrics = buildPartMetrics(part, w);
      const thresholds = getThresholds(mode, part, w, h);
      const preserveSemanticCore = part.traceStrategy === 'semantic' && (
        part.semanticCategory === 'silhouette' ||
        part.semanticCategory === 'head_feature'
      );
      const weak = (
        metrics.boundaryCount < thresholds.minBoundary ||
        metrics.sampleCount < thresholds.minSamples ||
        metrics.reach < thresholds.minReach
      );
      if (!weak || preserveSemanticCore) continue;
      current = mergeWeakPart(current, index, w);
      changed = true;
      break;
    }
  }

  return current.map((part) => recalcPartGeometry(part, w));
}
