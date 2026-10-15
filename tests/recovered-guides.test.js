import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGuidedParts, startGuidedStroke, advanceGuidedStroke, guidedStepComplete } from '../js/guided-trace.js';

for (const [id, steps, open] of [['snake', 5, 3], ['polar-bear', 9, 4]]) {
  test(`${id}: recovered source paths stay continuous and completable in both directions`, () => {
    const guide = JSON.parse(fs.readFileSync(new URL(`../assets/recovered-guides/${id}.json`, import.meta.url)));
    assert.equal(guide.steps.length, steps);
    assert.equal(guide.steps.filter(step => !step.closed).length, open);
    for (const size of [280, 350, 600]) for (const reverse of [false, true]) {
      for (const part of buildGuidedParts(guide, size, size)) {
        const points = reverse ? [...part.guided.points].reverse() : part.guided.points;
        startGuidedStroke(part, points[0]);
        for (let i = 12; i < points.length; i += 12) advanceGuidedStroke(part, points[i]);
        advanceGuidedStroke(part, points.at(-1));
        assert.ok(guidedStepComplete(part), `${id}: ${part.displayName} at ${size}px`);
      }
    }
  });
}
