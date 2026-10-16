import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFillRegions } from '../js/edge-detect.js';
import { drawRegionFill } from '../js/color-fill-tools.js';

test('separate edge-connected backgrounds can be painted without crossing a dividing line', () => {
  const w = 40, h = 40;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) data.set([0, 0, 0, 255], (y * w + 20) * 4);
  const { regions, regionMap } = buildFillRegions(data, w, h);
  const left = regionMap[10 * w + 5], right = regionMap[10 * w + 30];
  assert.ok(left > 0 && right > 0);
  assert.notEqual(left, right);
  assert.equal(regions.length, 2);
  assert.ok(regions.every(region => region.isBackground));
  const painted = new Set();
  const ctx = { fillRect(x, y) { painted.add(y * w + x); } };
  assert.equal(drawRegionFill(ctx, regions.find(region => region.id === left), regionMap,
    w, { offX: 0, offY: 0 }, '#ff0000'), true);
  assert.equal(painted.size, 20 * h);
  assert.ok(painted.has(10 * w + 5));
  assert.ok(!painted.has(10 * w + 20));
  assert.ok(!painted.has(10 * w + 30));
});
