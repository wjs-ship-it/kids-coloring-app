# Guided tracing repair

## Report and root causes

- User reported the owl's eye being called a hand, a dinosaur neck called a body, invented connecting guides, and fragmented black strokes.
- The imported owl was a color-by-number sheet; the previous dinosaur image was a finish-picture sheet. Both were incorrectly routed through generic semantic tracing.
- Weak-part merging concatenates independent point lists. The renderer can interpolate across these jumps; the 18px rejoin rule then drops drawing movement rather than traversing the path.
- Previous verification checked nonempty paths and representative screen opening; it did not prove a complete, faithful traced drawing.

## Implementation direction

- Keep the 136-item gallery. Imported sheets without reviewed tracing data open coloring, with an explicit activity label. The five original presets retain their existing choices.
- The dinosaur gets ten declared, continuous paths derived from the original Spine `mask_0_0` through `mask_9_0`.
- Decode bone transforms and the body's weighted mesh UV triangles. Treating the body as a flat region produces incorrect placement, so the importer explicitly handles the mesh.
- Skeletonize each original mask and verify every centerline pixel has degree two and belongs to one closed ring. Any discontinuity fails conversion.
- Draw and guide from the same coordinates; source slot layering hides overlapping head/leg edges in the final coloring sheet.
- Preserve declared paths during mobile resizing. Never reclassify, concatenate, or prune these paths with the generic semantic engine.
- Sparse pointer events paint the intervening ordered path; they never draw a chord across the figure. Bound arc travel and snap radius to avoid teleporting to another section.
- Track visited path samples independently of canvas pixels so completed parts cannot falsely complete a new part. Taps alone do not mark a path as painted. Undo restores visited state within the current step.

## Files and reuse

- `/home/sang/Projects/kids-coloring-app/scripts/import-diplodocus-guide.py`: deterministic local conversion from the existing reference bundle; UnityPy, OpenCV and scikit-image were already installed.
- `/home/sang/Projects/kids-coloring-app/assets/family-content/diplodocus-guided-v1.json`: ten fixed paths and readable step labels.
- `/home/sang/Projects/kids-coloring-app/assets/family-content/diplodocus-guided-v1.png`: matching coloring sheet with static face details.
- `/home/sang/Projects/kids-coloring-app/js/config.js`: guided tracing thresholds.
- `/home/sang/Projects/kids-coloring-app/js/guided-trace.js`: path scaling/validation, snapping, bounded arc traversal and coverage.
- `/home/sang/Projects/kids-coloring-app/js/app.js`: focused adapters for declared paths, stroke rendering and completion; existing large app is not otherwise reorganized.
- `/home/sang/Projects/kids-coloring-app/js/preset-gallery.js`: fetch the declared guide and show activity labels.
- `/home/sang/Projects/kids-coloring-app/js/packs/family-content.js`: coloring-only for unreviewed imported sheets and the declared dinosaur guide.
- `/home/sang/Projects/kids-coloring-app/index.html` and `/home/sang/Projects/kids-coloring-app/sw.js`: versioned gallery/app scripts and v7 cache for the correction.
- Searched and inspected `snapToLine`, `boundaryPos`, `samplePoints`, `getTraceCanvasPoints`, `strokeTracePart`, `fitLineartToCanvas`, `pruneTraceParts`, `beginTraceStroke`, `onMove`, `checkTraceCompletion`, `saveState` and `undo` before editing.
- Reuse existing canvas, activity lifecycle, palette, gallery, coloring and original presets. Generic image inference cannot reconstruct the original authored steps, so declared guide support is necessary.

## Verification

- `node --experimental-default-type=module --test /home/sang/Projects/kids-coloring-app/tests/guided-trace.test.js`: 7/7 passed. Tests cover mobile/desktop scaling, sparse movement, both tracing directions, rejoining without shortcuts, no completion by tap/teleport, and rejection of malformed/disconnected paths.
- `/home/sang/Projects/kids-coloring-app/tests/guided-browser-smoke.js` drives actual canvas mouse/touch event handlers through CDP. It waits for visible step transitions and checks rendered black pixels rather than only internal path counts.
- At 390×844, mouse and synthetic touch both completed all ten steps. Every step had 100% rendered path coverage before advancing; final trace completion transitioned into coloring.
- Owl opens coloring directly with 41 fill regions and zero trace-start events. Its bogus `left hand` guide is no longer offered.
- Starting dinosaur screenshot: `/home/sang/.cli-jaw/screenshots/screenshot_1792067159288.png`.
- Completed dinosaur coloring screenshot: `/home/sang/.cli-jaw/screenshots/screenshot_1792067228951.png`.
- Owl coloring screenshot: `/home/sang/.cli-jaw/screenshots/screenshot_1792067236962.png`.
- At 768×1024, synthetic touch completed ten steps at 100% rendered coverage each and transitioned to coloring. This exercises the full 600px guide as well as mobile scaling.
- Mobile undo smoke: partial path progress 17.3709% returned to 0%, remaining at `1/10 머리`.
- Original browser regression harness: `5/5 presets passed` and `5/5 fixtures passed`.
- Seven changed/new JavaScript files passed syntax checking. All 28 service-worker precache paths exist. `git diff --check` passed.

## Limits and deployment

- This repairs the imported-content route and the declared dinosaur. It does not claim that all 131 sheets now have faithful authored tracing.
- Browser-generated touch events exercise real touch handlers; they are not a physical-device human usability test.
- Current request authorizes fixing and committing. No push is performed without the same-turn explicit Git push authorization required by the user's instance instructions.
