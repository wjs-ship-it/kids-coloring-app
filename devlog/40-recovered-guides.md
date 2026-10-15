# Recovered snake and polar bear tracing

## Scope and source

- User wants the whole gallery to support tracing eventually, with already recovered authored paths first. This change handles the two remaining authored Spine drawing sets; other unreviewed worksheets remain coloring-only.
- Reuse the existing guided canvas, palette, activity transitions and gallery. C2 content/renderer extension; no new inference model, server or dependency.
- Inspected the existing diplodocus importer, guided-trace.js, app.js consumers, gallery pack and browser smoke before implementation. The existing closed-loop-only engine required a small extension for real open strokes.
- Source files: /home/sang/Downloads/1122/assets/aa/Android/duplicateassetisolation_assets_all_dcf2c3f47057e8fb42760721421ef433.bundle and /home/sang/Downloads/1122/assets/active/android/bundles/stars-polar-bear/stars-polar-bear.bundle.
- Format references checked 2026-10-16: https://us.esotericsoftware.com/spine-json-format and the official PathConstraint runtime at https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-libgdx/spine-libgdx/src/com/esotericsoftware/spine/PathConstraint.java . The supplied sources themselves are Spine 3.8.99; the cubic endpoint/handle structure and source weights were checked directly. An attempted obsolete 4.0 TS source URL returned 404 and was not used as evidence.

## Open-stroke engine

- js/guided-trace.js accepts step.closed=false; omitted values retain the original closed-loop behavior.
- Open strokes retain both endpoints, validate only consecutive segments and traverse only the interval between two samples. They cannot take a wrapped shortcut across the endpoints.
- tests/open-guided-trace.test.js uses a U-shaped stroke whose endpoints are close but whose intervening arc is long. It proves no automatic closure or teleport shortcut and complete bidirectional tracing.

## Conversion and integration

- scripts/import-spine-path-guides.py decodes weighted cubic path controls through the setup bone transforms, samples continuous curves and applies one shared projection to paths and static face assets. Unexpected non-unit setup scale, invalid weights, vertex counts and unsupported static atlas transforms fail explicitly.
- Snake: five steps, three open. Polar bear: nine steps, four open. Source path identifiers are retained in generated JSON; static eyes are monochrome and excluded from tracing.
- Artwork layering hides behind-head lines. This is a simplified line-art reconstruction, not a recreation of the native app's animation or stars mode.
- assets/recovered-guides contains the two matching PNG/JSON pairs; js/packs/recovered-content.js composes them into the family gallery. Total gallery items: 141; reviewed guided items: six (long-neck dinosaur, three original dinosaurs, snake, polar bear).
- Updated module version queries and cache v8 because the browser initially retained old modules despite a new document URL. New original/recovered guide assets and modules are included in precache.

## Verification

- All 14 Node tests passed: existing long-neck dinosaur regressions, original dinosaurs, open-stroke edge cases and both recovered datasets. Recovered paths were completed at 280/350/600px in both directions.
- Headless Chrome at 390x844: actual canvas synthetic-touch smoke completed snake 5/5 and polar bear 9/9; each step had 100% rendered coverage; both transitioned to coloring. Browser tests use the same versioned engine import as the app, after correcting the test's stale import.
- Viewed both generated PNGs and the real app's initial tracing screens. Screenshot paths: /home/sang/.cli-jaw/screenshots/screenshot_1792102541143.png and /home/sang/.cli-jaw/screenshots/screenshot_1792102565428.png.
- Node syntax checks passed for the engine, app, new pack and service worker. All 40 precache URLs returned HTTP 200 locally; git diff --check passed.
- Physical-device interaction and native animation equivalence were not tested. The previously documented mobile coloring palette overlap remains outside this content slice.
- Local implementation only. No git push or public deployment performed; same-turn explicit push authorization is required by the user's AGENTS.md.
