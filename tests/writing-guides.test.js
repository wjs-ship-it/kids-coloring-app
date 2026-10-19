import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FAMILY_CONTENT_PACK } from '../js/packs/family-content.js';
import { buildGuidedParts, startGuidedStroke, advanceGuidedStroke, guidedStepComplete } from '../js/guided-trace.js';

const writing = FAMILY_CONTENT_PACK.items.filter(item => ['letters', 'numbers'].includes(item.category));
test('A–Z and 0–10 each pair their own artwork with writing paths', () => {
  assert.equal(writing.length, 37);
  assert.equal(new Set(writing.map(item => item.id)).size, 37);
  assert.deepEqual(writing.filter(item=>item.category==='numbers').map(item=>Number(item.name.split(' ').at(-1))),
    Array.from({length:11},(_,i)=>i));
  for (const item of writing) {
    const guide = JSON.parse(fs.readFileSync(new URL(`../${item.traceSrc}`, import.meta.url)));
    assert.equal(item.name.split(' ').at(-1), guide.character);
    assert.equal(guide.directional, true);
    assert.ok(fs.existsSync(new URL(`../${item.src}`, import.meta.url)));
    assert.ok(guide.steps.every(step => step.closed === false));
  }
});

for (const item of writing) {
  test(`${item.name}: ordered strokes complete at mobile/tablet sizes`, () => {
    const guide = JSON.parse(fs.readFileSync(new URL(`../${item.traceSrc}`, import.meta.url)));
    for (const size of [280,350,600]) for (const part of buildGuidedParts(guide,size,size)) {
      const points = part.guided.points;
      assert.ok(startGuidedStroke(part, points[0]));
      for (let i=10;i<points.length;i+=10) advanceGuidedStroke(part,points[i]);
      advanceGuidedStroke(part,points.at(-1));
      assert.ok(guidedStepComplete(part), `${size}px ${part.displayName}`);
    }
  });
}

test('writing rejects wrong starts, shortcuts, reverse movement and skipping after lift', () => {
  const item=writing.find(item=>item.name==='알파벳 A');
  const guide=JSON.parse(fs.readFileSync(new URL(`../${item.traceSrc}`,import.meta.url)));
  const part=buildGuidedParts(guide,350,350)[0], points=part.guided.points;
  assert.equal(startGuidedStroke(part,points.at(-1)),null);
  startGuidedStroke(part,points[0]);
  assert.deepEqual(advanceGuidedStroke(part,points.at(-1)),[]);
  advanceGuidedStroke(part,points[20]);
  assert.deepEqual(advanceGuidedStroke(part,points[0]),[]);
  assert.equal(startGuidedStroke(part,points.at(-1)),null);
  assert.ok(startGuidedStroke(part,points[20]));
});
