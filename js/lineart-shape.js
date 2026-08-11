function collectEdgeComponents(edges, w, h) {
  const labels = new Int32Array(w * h);
  const components = [];
  const queue = new Int32Array(w * h);
  let nextId = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!edges[start] || labels[start]) continue;

      let head = 0;
      let tail = 0;
      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;
      let touchesBorder = false;

      labels[start] = nextId;
      queue[tail++] = start;

      while (head < tail) {
        const pos = queue[head++];
        const cx = pos % w;
        const cy = (pos / w) | 0;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) touchesBorder = true;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const next = ny * w + nx;
            if (!edges[next] || labels[next]) continue;
            labels[next] = nextId;
            queue[tail++] = next;
          }
        }
      }

      components.push({
        id: nextId,
        area,
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: sumX / area,
        centerY: sumY / area,
        touchesBorder
      });
      nextId++;
    }
  }

  return { labels, components };
}

export function selectMeaningfulEdges(edges, w, h, options = {}) {
  const { mode = 'object', detail = 50 } = options;
  const { labels, components } = collectEdgeComponents(edges, w, h);
  if (components.length === 0) return edges;

  const detailBias = Math.max(0, Math.min(1, detail / 100));
  const diag = Math.hypot(w, h) || 1;
  const centerX = w / 2;
  const centerY = h / 2;
  const maxComponents = mode === 'portrait'
    ? 18 + Math.round(detailBias * 8)
    : 12 + Math.round(detailBias * 6);
  const minArea = mode === 'portrait'
    ? 10 + Math.round((1 - detailBias) * 10)
    : 20 + Math.round((1 - detailBias) * 22);
  const minSpan = mode === 'portrait'
    ? 10 + Math.round((1 - detailBias) * 6)
    : 16 + Math.round((1 - detailBias) * 8);

  let silhouetteId = 0;
  let silhouetteArea = -1;
  for (const component of components) {
    if (component.touchesBorder && component.area > silhouetteArea) {
      silhouetteArea = component.area;
      silhouetteId = component.id;
    }
  }

  const ranked = components.map((component) => {
    const span = Math.max(component.width, component.height);
    const bboxArea = component.width * component.height;
    const coverage = bboxArea / (w * h);
    const centerDist = Math.hypot(component.centerX - centerX, component.centerY - centerY) / diag;
    const centerWeight = mode === 'portrait' ? (1 - centerDist) * 120 : (1 - centerDist) * 50;
    const borderWeight = component.touchesBorder ? 220 : 0;
    const score = component.area + span * 10 + coverage * 9000 + centerWeight + borderWeight;
    return { ...component, span, centerDist, score };
  }).sort((a, b) => b.score - a.score);

  const keep = new Set();
  if (silhouetteId) keep.add(silhouetteId);

  for (const component of ranked) {
    const centralFeature = mode === 'portrait' && component.centerDist < 0.24 && component.area >= 8;
    const broadStructure = component.area >= minArea || component.span >= minSpan;
    if (centralFeature || broadStructure) keep.add(component.id);
    if (keep.size >= maxComponents) break;
  }

  const result = new Uint8Array(w * h);
  for (let i = 0; i < labels.length; i++) {
    if (keep.has(labels[i])) result[i] = 1;
  }
  return result;
}
