import { getPaintStyle } from './paint-textures.js?v=textures-1';

export const FILL_TOOLS = [
  { id: 'solid', label: '단색' },
  { id: 'marker', label: '붓' },
  { id: 'pencil', label: '연필' },
  { id: 'crayon', label: '크레용' },
  { id: 'glitter', label: '반짝이' },
  { id: 'rainbow', label: '무지개' },
  { id: 'rainbow-glitter', label: '무지개 반짝이' },
  { id: 'hearts', label: '하트' },
  { id: 'stars', label: '별' },
  { id: 'dots', label: '물방울' },
];

function hexToRgb(hex) {
  const normalized = (hex || '').replace('#', '').trim();
  if (normalized.length !== 6) return { r: 30, g: 41, b: 59 };
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mix(rgb, target, ratio) {
  return {
    r: Math.round(rgb.r * (1 - ratio) + target.r * ratio),
    g: Math.round(rgb.g * (1 - ratio) + target.g * ratio),
    b: Math.round(rgb.b * (1 - ratio) + target.b * ratio),
  };
}

function toCss(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function getToolPalette(color, tool) {
  const rgb = hexToRgb(color);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 20, g: 24, b: 38 };

  if (tool === 'marker') {
    return {
      base: toCss(mix(rgb, white, 0.14)),
      accent: toCss(mix(rgb, black, 0.08)),
      accentPredicate: (x, y) => ((x + y) % 5) < 2,
    };
  }

  if (tool === 'pencil') {
    return {
      base: toCss(mix(rgb, white, 0.52)),
      accent: toCss(mix(rgb, black, 0.18)),
      accentPredicate: (x, y) => ((x * 3 + y * 2) % 7 === 0) || ((x + y) % 11 === 0),
    };
  }

  return {
    base: color,
    accent: color,
    accentPredicate: null,
  };
}

export function drawRegionFill(ctx, region, regionMap, lineWidth, offset, color, tool = 'solid') {
  if (!region?.bounds || !regionMap) return false;
  const { minX, maxX, minY, maxY } = region.bounds;
  const { offX, offY } = offset;
  const palette = getToolPalette(color, tool);

  ctx.fillStyle = ['solid','marker','pencil'].includes(tool) ? palette.base : getPaintStyle(ctx,color,tool);
  for (let iy = minY; iy <= maxY; iy++) {
    const rowBase = iy * lineWidth;
    for (let ix = minX; ix <= maxX; ix++) {
      if (regionMap[rowBase + ix] !== region.id) continue;
      const px = ix + offX;
      const py = iy + offY;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  if (!palette.accentPredicate) return true;

  ctx.fillStyle = palette.accent;
  for (let iy = minY; iy <= maxY; iy++) {
    const rowBase = iy * lineWidth;
    for (let ix = minX; ix <= maxX; ix++) {
      if (regionMap[rowBase + ix] !== region.id) continue;
      if (!palette.accentPredicate(ix, iy)) continue;
      const px = ix + offX;
      const py = iy + offY;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  return true;
}
