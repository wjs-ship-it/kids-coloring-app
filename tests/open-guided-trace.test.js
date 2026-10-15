import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuidedParts, startGuidedStroke, advanceGuidedStroke, getGuidedProgress } from '../js/guided-trace.js';

// U-shaped open stroke: endpoints are nearby but separated by a long valid arc.
const points = [];
for (let y = 20; y <= 180; y += 2) points.push([30, y]);
for (let x = 32; x <= 70; x += 2) points.push([x, 180]);
for (let y = 178; y >= 20; y -= 2) points.push([70, y]);
const guide = { version: 1, width: 200, height: 200, steps: [{ name: '열린 선', closed: false, points }] };

test('open guides retain their endpoints and cannot wrap across the empty gap', () => {
  const part = buildGuidedParts(guide, 200, 200)[0];
  assert.equal(part.boundaryPos.length, points.length);
  assert.notEqual(part.boundaryPos[0], part.boundaryPos.at(-1));
  startGuidedStroke(part, part.guided.points[0]);
  assert.deepEqual(advanceGuidedStroke(part, part.guided.points.at(-1)), []);
  assert.equal(getGuidedProgress(part), 0);
});

test('open guides complete in either direction without a closing stroke', () => {
  for (const reverse of [false, true]) {
    const part = buildGuidedParts(guide, 200, 200)[0];
    const ordered = reverse ? [...part.guided.points].reverse() : part.guided.points;
    startGuidedStroke(part, ordered[0]);
    for (let i = 1; i < ordered.length; i++) advanceGuidedStroke(part, ordered[i]);
    assert.equal(getGuidedProgress(part), 1);
  }
});
