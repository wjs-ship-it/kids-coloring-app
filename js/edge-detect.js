export function applyCLAHE(gray, w, h, tileSize = 8, clipLimit = 2.0) {
  const out = new Float32Array(w * h);
  const tw = Math.ceil(w / tileSize);
  const th = Math.ceil(h / tileSize);
  const maps = [];

  for (let ty = 0; ty < th; ty++) {
    maps[ty] = [];
    for (let tx = 0; tx < tw; tx++) {
      const x0 = tx * tileSize, y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, w), y1 = Math.min(y0 + tileSize, h);
      const bins = new Float32Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          bins[Math.min(255, Math.max(0, Math.round(gray[y * w + x])))]++;
          count++;
        }
      }
      const limit = Math.max(1, (clipLimit * count) / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (bins[i] > limit) { excess += bins[i] - limit; bins[i] = limit; }
      }
      const inc = excess / 256;
      for (let i = 0; i < 256; i++) bins[i] += inc;
      const cdf = new Float32Array(256);
      cdf[0] = bins[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + bins[i];
      const scale = count > 0 ? 255 / count : 0;
      const lut = new Float32Array(256);
      for (let i = 0; i < 256; i++) lut[i] = cdf[i] * scale;
      maps[ty][tx] = lut;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = Math.min(255, Math.max(0, Math.round(gray[y * w + x])));
      const fx = (x + 0.5) / tileSize - 0.5;
      const fy = (y + 0.5) / tileSize - 0.5;
      const tx0 = Math.max(0, Math.floor(fx));
      const ty0 = Math.max(0, Math.floor(fy));
      const tx1 = Math.min(tw - 1, tx0 + 1);
      const ty1 = Math.min(th - 1, ty0 + 1);
      const ax = fx - tx0, ay = fy - ty0;
      out[y * w + x] =
        (1 - ay) * ((1 - ax) * maps[ty0][tx0][val] + ax * maps[ty0][tx1][val]) +
        ay * ((1 - ax) * maps[ty1][tx0][val] + ax * maps[ty1][tx1][val]);
    }
  }
  return out;
}

export function bilateralFilter(gray, w, h, r = 9, sigC = 75, sigS = 75) {
  const out = new Float32Array(w * h);
  const sc2 = -0.5 / (sigC * sigC);
  const ss2 = -0.5 / (sigS * sigS);
  const halfR = Math.floor(r / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const center = gray[y * w + x];
      let sum = 0, wSum = 0;
      for (let dy = -halfR; dy <= halfR; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -halfR; dx <= halfR; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const val = gray[ny * w + nx];
          const dSq = dx * dx + dy * dy;
          const dC = val - center;
          const weight = Math.exp(dSq * ss2 + dC * dC * sc2);
          sum += val * weight;
          wSum += weight;
        }
      }
      out[y * w + x] = wSum > 0 ? sum / wSum : center;
    }
  }
  return out;
}

export function cannyEdge(gray, w, h, thHigh = 0.12, thLow = 0.04) {
  const sX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const mag = new Float32Array(w * h);
  const dir = new Float32Array(w * h);
  let maxMag = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const v = gray[(y + ky) * w + (x + kx)];
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += v * sX[ki];
          gy += v * sY[ki];
        }
      }
      const m = Math.sqrt(gx * gx + gy * gy);
      mag[y * w + x] = m;
      dir[y * w + x] = Math.atan2(gy, gx);
      if (m > maxMag) maxMag = m;
    }
  }

  const nms = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const angle = (dir[y * w + x] * 180 / Math.PI + 180) % 180;
      const m = mag[y * w + x];
      let m1 = 0, m2 = 0;
      if (angle < 22.5 || angle >= 157.5) {
        m1 = mag[y * w + (x + 1)]; m2 = mag[y * w + (x - 1)];
      } else if (angle < 67.5) {
        m1 = mag[(y - 1) * w + (x + 1)]; m2 = mag[(y + 1) * w + (x - 1)];
      } else if (angle < 112.5) {
        m1 = mag[(y - 1) * w + x]; m2 = mag[(y + 1) * w + x];
      } else {
        m1 = mag[(y - 1) * w + (x - 1)]; m2 = mag[(y + 1) * w + (x + 1)];
      }
      nms[y * w + x] = (m >= m1 && m >= m2) ? m : 0;
    }
  }

  const hi = maxMag * thHigh, lo = maxMag * thLow;
  const edges = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    edges[i] = nms[i] >= hi ? 2 : (nms[i] >= lo ? 1 : 0);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (edges[y * w + x] !== 1) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (edges[(y + dy) * w + (x + dx)] === 2) {
              edges[y * w + x] = 2;
              changed = true;
            }
          }
        }
      }
    }
  }
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) result[i] = edges[i] === 2 ? 1 : 0;
  return result;
}

export function dualPassEdge(gray, w, h, outerHi = 0.15, outerLo = 0.06, innerHi = 0.06, innerLo = 0.02, roiScale = 0.4) {
  const outer = cannyEdge(gray, w, h, outerHi, outerLo);
  const inner = cannyEdge(gray, w, h, innerHi, innerLo);

  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const rw = Math.floor(w * roiScale), rh = Math.floor(h * roiScale);
  const result = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inROI = Math.abs(x - cx) < rw && Math.abs(y - cy) < rh;
      result[y * w + x] = inROI ? (outer[y * w + x] | inner[y * w + x]) : outer[y * w + x];
    }
  }
  return result;
}

export function morphClose(edges, w, h, kernelSize = 3) {
  const half = Math.floor(kernelSize / 2);
  const dilated = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      for (let dy = -half; dy <= half && !found; dy++) {
        for (let dx = -half; dx <= half && !found; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && edges[ny * w + nx]) found = true;
        }
      }
      dilated[y * w + x] = found ? 1 : 0;
    }
  }
  const result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allSet = true;
      for (let dy = -half; dy <= half && allSet; dy++) {
        for (let dx = -half; dx <= half && allSet; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            if (!dilated[ny * w + nx]) allSet = false;
          }
        }
      }
      result[y * w + x] = allSet ? 1 : 0;
    }
  }
  return result;
}

export function removeSmallComponents(edges, w, h, minArea = 30) {
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const result = new Uint8Array(edges);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edges[y * w + x] || labels[y * w + x]) continue;
      const queue = [[x, y]];
      let front = 0;
      const pixels = [];
      labels[y * w + x] = nextLabel;
      while (front < queue.length) {
        const [cx, cy] = queue[front++];
        pixels.push(cy * w + cx);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && edges[ny * w + nx] && !labels[ny * w + nx]) {
            labels[ny * w + nx] = nextLabel;
            queue.push([nx, ny]);
          }
        }
      }
      if (pixels.length < minArea) {
        for (const pos of pixels) result[pos] = 0;
      }
      nextLabel++;
    }
  }
  return result;
}

export function normalizeLineWidth(edges, w, h, targetWidth = 2) {
  const dilated = new Uint8Array(w * h);
  const half = Math.floor(targetWidth / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edges[y * w + x]) continue;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) dilated[ny * w + nx] = 1;
        }
      }
    }
  }
  return dilated;
}

export function dilate(edges, w, h, radius = 2) {
  const result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edges[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) result[ny * w + nx] = 1;
        }
      }
    }
  }
  return result;
}

export function fuseLines(edges, w, h, blurRadius = 2, threshold = 0.15) {
  const buf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) buf[i] = edges[i] ? 1.0 : 0.0;

  const k = blurRadius * 2 + 1;
  const sigma = blurRadius * 0.8;
  const kernel = new Float32Array(k);
  let kSum = 0;
  for (let i = 0; i < k; i++) {
    const d = i - blurRadius;
    kernel[i] = Math.exp(-0.5 * (d * d) / (sigma * sigma));
    kSum += kernel[i];
  }
  for (let i = 0; i < k; i++) kernel[i] /= kSum;

  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < k; i++) {
        const nx = Math.min(w - 1, Math.max(0, x + i - blurRadius));
        s += buf[y * w + nx] * kernel[i];
      }
      tmp[y * w + x] = s;
    }
  }
  const blurred = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let i = 0; i < k; i++) {
        const ny = Math.min(h - 1, Math.max(0, y + i - blurRadius));
        s += tmp[ny * w + x] * kernel[i];
      }
      blurred[y * w + x] = s;
    }
  }

  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    result[i] = blurred[i] > threshold ? 1 : 0;
  }
  return result;
}

export function validateFloodFillIntegrity(edges, w, h) {
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  const centerX = Math.floor(w / 2), centerY = Math.floor(h / 2);
  const centerR = Math.floor(Math.min(w, h) * 0.25);
  const leaks = [];

  for (const [sx, sy] of corners) {
    if (edges[sy * w + sx]) continue;
    const visited = new Uint8Array(w * h);
    const queue = [[sx, sy]];
    let front = 0;
    visited[sy * w + sx] = 1;
    let reachedCenter = false;

    while (front < queue.length) {
      const [cx, cy] = queue[front++];
      if (Math.abs(cx - centerX) < centerR && Math.abs(cy - centerY) < centerR) {
        reachedCenter = true;
        leaks.push({ x: cx, y: cy, fromCorner: [sx, sy] });
        break;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !edges[ny * w + nx] && !visited[ny * w + nx]) {
          visited[ny * w + nx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }
  return { leakCount: leaks.length, leakPositions: leaks };
}

export function adaptiveClose(edges, w, h) {
  let result = morphClose(edges, w, h, 3);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { leakCount, leakPositions } = validateFloodFillIntegrity(result, w, h);
    if (leakCount === 0) break;
    for (const leak of leakPositions) {
      const r = 5;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = leak.y + dy, nx = leak.x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && edges[ny * w + nx]) {
            for (let py = -2; py <= 2; py++) {
              for (let px = -2; px <= 2; px++) {
                const fy = ny + py, fx = nx + px;
                if (fy >= 0 && fy < h && fx >= 0 && fx < w) result[fy * w + fx] = 1;
              }
            }
          }
        }
      }
    }
  }
  return result;
}

export function bridgeEndpoints(edges, w, h, maxGap = 12) {
  const result = new Uint8Array(edges);
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  const endpoints = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!edges[y * w + x]) continue;
      let nCount = 0;
      let nx1 = 0, ny1 = 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + dx8[k], ny = y + dy8[k];
        if (edges[ny * w + nx]) {
          nCount++;
          nx1 = dx8[k]; ny1 = dy8[k];
        }
      }
      if (nCount === 1) {
        endpoints.push({ x, y, dx: -nx1, dy: -ny1 });
      }
    }
  }

  const used = new Set();
  for (let i = 0; i < endpoints.length; i++) {
    if (used.has(i)) continue;
    const ep = endpoints[i];
    let bestJ = -1, bestDist = maxGap + 1;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (used.has(j)) continue;
      const ep2 = endpoints[j];
      const ddx = ep2.x - ep.x, ddy = ep2.y - ep.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist > maxGap || dist < 2) continue;

      const len = dist || 1;
      const ux = ddx / len, uy = ddy / len;
      const dot1 = ep.dx * ux + ep.dy * uy;
      const dot2 = ep2.dx * (-ux) + ep2.dy * (-uy);

      if (dot1 > -0.3 && dot2 > -0.3 && dist < bestDist) {
        bestDist = dist;
        bestJ = j;
      }
    }
    if (bestJ !== -1) {
      used.add(i);
      used.add(bestJ);
      const ep2 = endpoints[bestJ];
      const steps = Math.ceil(bestDist);
      for (let s = 0; s <= steps; s++) {
        const t = s / (steps || 1);
        const px = Math.round(ep.x + (ep2.x - ep.x) * t);
        const py = Math.round(ep.y + (ep2.y - ep.y) * t);
        if (px >= 0 && px < w && py >= 0 && py < h) {
          result[py * w + px] = 1;
        }
      }
    }
  }
  return result;
}

export function multiPassClose(edges, w, h, passes = 2) {
  let result = edges;
  for (let i = 0; i < passes; i++) {
    result = bridgeEndpoints(result, w, h, 15 - i * 3);
    result = morphClose(result, w, h, 3);
  }
  return result;
}

export function detectParts(lineartData, w, h) {
  const isEdge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) isEdge[i] = lineartData[i * 4] < 128 ? 1 : 0;

  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const regions = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pos = y * w + x;
      if (isEdge[pos] || labels[pos] !== 0) continue;
      const queue = [[x, y]];
      let front = 0;
      const pixels = [];
      let touchesBorder = false;
      labels[pos] = nextLabel;
      while (front < queue.length) {
        const [cx, cy] = queue[front++];
        pixels.push(cx + cy * w);
        if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) touchesBorder = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const np = ny * w + nx;
            if (!isEdge[np] && labels[np] === 0) {
              labels[np] = nextLabel;
              queue.push([nx, ny]);
            }
          }
        }
      }
      regions.push({ label: nextLabel, pixels, touchesBorder });
      nextLabel++;
    }
  }

  let meaningful = regions.filter(r => !r.touchesBorder && r.pixels.length > 150);
  if (meaningful.length < 2) {
    meaningful = [];
    const bandCount = 4, bandH = Math.floor(h / bandCount);
    for (let b = 0; b < bandCount; b++) {
      const pxs = [];
      const y0 = b * bandH, y1 = Math.min((b + 1) * bandH, h);
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < w; x++) {
          if (isEdge[y * w + x]) pxs.push(x + y * w);
        }
      }
      if (pxs.length > 50) meaningful.push({ pixels: pxs, touchesBorder: false, isBand: true });
    }
  }

  for (const reg of meaningful) {
    if (reg.isBand) {
      reg.boundaryPos = reg.pixels;
    } else {
      const boundary = new Set();
      for (const pos of reg.pixels) {
        const x = pos % w, y = Math.floor(pos / w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && isEdge[ny * w + nx]) boundary.add(ny * w + nx);
        }
      }
      reg.boundaryPos = [...boundary];
    }
    let sy = 0;
    for (const pos of reg.boundaryPos) sy += Math.floor(pos / w);
    reg.centerY = sy / reg.boundaryPos.length;

    reg.samplePoints = [];
    for (let i = 0; i < reg.boundaryPos.length; i += 5) reg.samplePoints.push(reg.boundaryPos[i]);
  }

  meaningful.sort((a, b) => a.centerY - b.centerY);
  if (meaningful.length > 8) meaningful = meaningful.slice(0, 8);
  return meaningful;
}

export function runFullPipeline(imageData, w, h, mode = 'object', detail = 50) {
  const px = imageData;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
  }

  const t = detail / 100;

  let smoothed;
  if (mode === 'portrait') {
    const sigC = 120 - t * 60;
    const sigS = 120 - t * 60;
    const s1 = applyCLAHE(gray, w, h, 8, 1.5);
    const s2 = bilateralFilter(s1, w, h, 13, sigC, sigS);
    smoothed = bilateralFilter(s2, w, h, 13, sigC, sigS);
  } else {
    const s1 = applyCLAHE(gray, w, h);
    const s2 = bilateralFilter(s1, w, h);
    smoothed = bilateralFilter(s2, w, h);
  }

  const baseHi = mode === 'portrait' ? 0.12 : 0.10;
  const baseLo = mode === 'portrait' ? 0.03 : 0.02;
  const thHi = baseHi * (1.5 - t * 0.9);
  const thLo = baseLo * (1.5 - t * 0.9);

  let rawEdge;
  if (mode === 'portrait') {
    const innerHi = thHi * 0.35;
    const innerLo = thLo * 0.35;
    rawEdge = dualPassEdge(smoothed, w, h, thHi, thLo, innerHi, innerLo, 0.45);
  } else {
    rawEdge = cannyEdge(smoothed, w, h, thHi, thLo);
  }

  const d1 = dilate(rawEdge, w, h, 2);
  const fused = fuseLines(d1, w, h, 3, 0.12);
  const bridged = bridgeEndpoints(fused, w, h, 18);
  const closed = morphClose(bridged, w, h, 5);
  const bridged2 = bridgeEndpoints(closed, w, h, 12);

  const minArea = mode === 'portrait' ? (60 - t * 40) : 20;
  const cleaned = removeSmallComponents(bridged2, w, h, Math.max(8, minArea));
  let final = normalizeLineWidth(cleaned, w, h, 4);

  const { leakCount } = validateFloodFillIntegrity(final, w, h);
  if (leakCount > 0) {
    const d2 = dilate(cleaned, w, h, 3);
    const fused2 = fuseLines(d2, w, h, 2, 0.10);
    final = normalizeLineWidth(fused2, w, h, 4);
  }

  const outData = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = final[i] ? 40 : 255;
    outData[i * 4] = v;
    outData[i * 4 + 1] = v;
    outData[i * 4 + 2] = v;
    outData[i * 4 + 3] = 255;
  }

  const parts = detectParts(outData, w, h);
  return { lineartData: outData, parts };
}
