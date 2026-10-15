# Original dinosaur SVG and guide pilot

## Scope

- C2 content addition: original Tyrannosaurus, Triceratops and Stegosaurus drawings, requested for the user's child without using paid reference assets.
- Reuse the existing declared-guide renderer, gallery, painting tools and completion logic. No new inference engine or dependency is needed.
- Existing owners inspected: scripts/import-diplodocus-guide.py, js/guided-trace.js, js/preset-gallery.js, js/packs/family-content.js and tests/guided-browser-smoke.js.
- The existing gallery/pack arrangement is retained. The new pack is composed into the family pack and exposed through a new Korean dinosaur filter.

## Implementation

- scripts/create-original-dinosaurs.mjs is the source of truth for all three original illustrations. Named closed SVG curves produce both vector artwork and sampled JSON guides. Run with Node on the user's PC.
- assets/original-dinosaurs contains generated SVG/JSON pairs, with 7, 9 and 9 tracing parts respectively. Static eyes and smiles are included in the artwork.
- js/packs/original-dinosaurs.js declares the three items. The gallery now contains 139 items, including the previous 136.
- tests/original-dinosaurs.test.js verifies all paths at 280, 350 and 600 pixels, clockwise and counterclockwise, using sparse pointer movement and the real guided-progress implementation.
- The existing browser smoke now accepts a guide path and uses each guide's actual step count; its completion and rendered-coverage assertions remain unchanged.

## Verification

- Generation: trex 7 steps; triceratops 9 steps; stegosaurus 9 steps.
- Existing guided-trace tests: 7/7 passed after updating only the expected reviewed-content count from one to four.
- Original dinosaur tests: 3/3 passed, covering all 25 steps at three sizes in both directions.
- Actual rendered/browser verification is pending: cli-jaw browser start --agent failed because there is no X server / DISPLAY. User was asked before switching to headless in accordance with their failure-routing rule.
- These are original pilot drawings. Unit completion does not establish visual quality or physical-phone usability. No push or deployment is authorized in this turn.
