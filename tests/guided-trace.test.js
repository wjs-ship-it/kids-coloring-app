import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGuidedParts, startGuidedStroke, advanceGuidedStroke, getGuidedProgress, guidedStepComplete } from '../js/guided-trace.js';
import { FAMILY_CONTENT_PACK } from '../js/packs/family-content.js';

const guide = JSON.parse(fs.readFileSync(new URL('../assets/family-content/diplodocus-guided-v1.json', import.meta.url)));

test('only content with declared paths offers tracing', () => {
  const traced = FAMILY_CONTENT_PACK.items.filter(item => item.activity === 'trace');
  assert.equal(traced.length, 4);
  assert.ok(traced.every(item => item.traceSrc));
  assert.equal(FAMILY_CONTENT_PACK.items.find(item => item.id === 'cbn-wild-animals-3').activity, 'color');
});

test('all ten source steps stay continuous after mobile and desktop scaling', () => {
  for (const size of [280, 350, 600]) {
    const parts = buildGuidedParts(guide, size, size);
    assert.equal(parts.length, 10);
    assert.equal(parts[0].displayName, '머리');
    assert.equal(parts[1].displayName, '목과 몸통, 꼬리');
    for (const part of parts) {
      assert.equal(getGuidedProgress(part), 0);
      assert.equal(part.boundaryPos[0], part.boundaryPos.at(-1));
    }
  }
});

test('sparse pointer events paint every intermediate path point and complete all steps', () => {
  for (const size of [280, 350, 600]) {
    for (const part of buildGuidedParts(guide, size, size)) {
      const points = part.guided.points;
      assert.ok(startGuidedStroke(part, points[0]));
      for (let index = 18; index < points.length; index += 18) {
        const painted = advanceGuidedStroke(part, points[index]);
        assert.ok(painted.length > 1, `${size}: ${part.displayName} at ${index}`);
        for (let i = 1; i < painted.length; i++) {
          assert.ok(Math.hypot(painted[i].x - painted[i - 1].x, painted[i].y - painted[i - 1].y) <= 12);
        }
      }
      advanceGuidedStroke(part, points.at(-1));
      assert.ok(guidedStepComplete(part), `${size}: ${part.displayName} progress ${getGuidedProgress(part)}`);
    }
  }
});

test('leaving the guide neither paints a shortcut nor prevents rejoining', () => {
  const part = buildGuidedParts(guide, 350, 350)[0];
  const points = part.guided.points;
  startGuidedStroke(part, points[0]);
  assert.deepEqual(advanceGuidedStroke(part, { x: -300, y: -300 }), []);
  const painted = advanceGuidedStroke(part, points[24]);
  assert.ok(painted.length > 20);
  assert.ok(getGuidedProgress(part) < 0.5);
});

test('a child can trace each loop in either direction', () => {
  for (const part of buildGuidedParts(guide, 350, 350)) {
    const points = part.guided.points;
    startGuidedStroke(part, points[0]);
    for (let index = points.length - 1; index > 0; index -= 12) advanceGuidedStroke(part, points[index]);
    advanceGuidedStroke(part, points[0]);
    assert.ok(guidedStepComplete(part), part.displayName);
  }
});

test('a single touch or remote move cannot complete an entire loop', () => {
  const part = buildGuidedParts(guide, 600, 600)[1];
  startGuidedStroke(part, part.guided.points[0]);
  advanceGuidedStroke(part, { x: 580, y: 580 });
  assert.ok(getGuidedProgress(part) < 0.1);
  assert.equal(guidedStepComplete(part), false);
});

test('malformed coordinates and disconnected guides fail visibly', () => {
  assert.throws(() => buildGuidedParts({ ...guide, steps: [{ name: 'bad', points: [[NaN, 10]] }] }, 350, 350));
  assert.throws(() => buildGuidedParts({ ...guide, steps: [{ name: 'jump', points: [[0, 0], [600, 600], [0, 0]] }] }, 350, 350));
});
