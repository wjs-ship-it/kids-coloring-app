import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePipelineMode, runFullPipeline } from '../js/edge-detect.js';

function flatPicture(foreground = [255, 0, 0], background = [0, 130, 0]) {
  const size = 120, data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const color = Math.hypot(x - 60, y - 60) < 36 ? foreground : background;
    data.set([...color, 255], (y * size + x) * 4);
  }
  return { data, width: size, height: size };
}

test('colored-background artwork is recognized without requiring white paper', () => {
  const image = flatPicture();
  assert.equal(resolvePipelineMode('object', image.data, 120, 120).resolvedMode, 'illustration');
});

test('equal-brightness color boundaries produce a closed, selectable coloring region', () => {
  const image = flatPicture();
  const { lineartData, fillRegions } = runFullPipeline(image.data, 120, 120, 'illustration', 50);
  const center = fillRegions.regionMap[60 * 120 + 60];
  assert.ok(center > 0, 'The colored circle must enclose a selectable region');
  const background = fillRegions.regionMap[5 * 120 + 5];
  assert.ok(background > 0, 'Outside background must be selectable');
  assert.notEqual(background, center, 'Background and foreground must remain separate');
  assert.equal(fillRegions.regions.find(region => region.id === background).isBackground, true);
  assert.ok(fillRegions.regions.find(region => region.id === center).area > 2500);
  for (const [x, y] of [[24, 60], [96, 60], [60, 24], [60, 96]]) {
    let dark = false;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (lineartData[((y + dy) * 120 + x + dx) * 4] < 80) dark = true;
    }
    assert.ok(dark, `Missing circle outline at ${x},${y}`);
  }
});

test('explicit portrait mode remains explicit', () => {
  const image = flatPicture();
  assert.equal(resolvePipelineMode('portrait', image.data, 120, 120).resolvedMode, 'portrait');
});

test('a textured multicolor input is not classified as flat artwork', () => {
  const data = new Uint8ClampedArray(120 * 120 * 4);
  let seed = 17;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = i % 4 === 3 ? 255 : seed >>> 24;
  }
  assert.equal(resolvePipelineMode('object', data, 120, 120).resolvedMode, 'object');
});
