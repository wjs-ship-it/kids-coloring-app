import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORIGINAL_DINOSAURS } from '../js/packs/original-dinosaurs.js';
import { buildGuidedParts, startGuidedStroke, advanceGuidedStroke, guidedStepComplete } from '../js/guided-trace.js';

for (const item of ORIGINAL_DINOSAURS) {
  test(`${item.name}: original artwork has continuous, completable paths at child screen sizes`, () => {
    const guide = JSON.parse(fs.readFileSync(new URL(`../${item.traceSrc}`, import.meta.url)));
    assert.equal(guide.source, 'Original artwork authored for Kids Coloring');
    for (const size of [280, 350, 600]) for (const direction of [1, -1]) {
      for (const part of buildGuidedParts(guide, size, size)) {
        const points = direction === 1 ? part.guided.points : [...part.guided.points].reverse();
        startGuidedStroke(part, points[0]);
        for (let i = 18; i < points.length; i += 18) advanceGuidedStroke(part, points[i]);
        advanceGuidedStroke(part, points.at(-1));
        assert.ok(guidedStepComplete(part), `${size}px ${direction}: ${part.displayName}`);
      }
    }
  });
}
