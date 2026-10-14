# Bimi Boo Diplodocus REA Findings

## Purpose
- Record the reverse-engineering observations from the Bimi Boo Android reference app that affect semantic tracing in `kids-coloring-app`.
- Keep this as implementation evidence only. Extracted APK assets are reference material and must not be shipped or copied into the product.

## Source Artifacts
- APK:
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/base.apk`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/split_config.arm64_v8a.apk`
- Focus bundles extracted from the APK:
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/diplodocus.bundle`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/diplodocus-icon.bundle`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/finish-picture-5-(diplodocus).bundle`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/drawingpagesgameplay.prefab_543f551058b6643b6447d66b93a67774.bundle`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/starsdrawinggameplay.prefab_76c003232610df5513fb2a86e249da58.bundle`
- UnityPy exports inspected:
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/unitypy-export/diplodocus__diplodocus.png`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/unitypy-export/_diplodocus_parts_sheet.png`
  - `/home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/unitypy-export/finish-picture-5-(diplodocus)__stroke.png`

## Observed Structure
- The APK uses Unity Addressables. `assets/aa/catalog.json` exists and the APK inventory includes `assets/active/android/bundles/diplodocus/diplodocus.bundle`.
- The diplodocus drawing asset is atlas-backed, not a single plain line-art file.
- The exported atlas separates at least three visual layers:
  - `step_*`: active tracing step marks.
  - `mask_*`: per-step reveal or completion masks.
  - `back_*`: inactive/background step marks.
- The contact sheet shows `step_0_0` through `step_9_0`, so the reference diplodocus uses about 10 trace units for the atlas.
- The final stroke image shows a child-facing long-neck dinosaur scene where the dinosaur body is white with dotted grey tracing marks, while background plants are already colored. This supports treating the target figure and decorative/background content differently.

## Product Takeaways
- Semantic tracing should keep the target object as the trace surface and avoid turning background decoration into early trace parts.
- Long-neck animals need more than a single outer contour:
  - head or head/neck
  - neck
  - body
  - front legs
  - back legs
  - tail
  - body spots or final ornaments
- Bimi Boo appears to reveal one part at a time with a current-step, mask, and inactive-step layer. Our web implementation should approximate this with:
  - current part emphasis
  - completed part visual feedback
  - next part kept visually smaller than the active part
- The reference has roughly 10 atlas steps, but our current 6-8 part target remains reasonable for web tracing because the goal is semantic clarity, not exact asset replication.

## Current Code Match
- `/home/sang/Projects/kids-coloring-app/js/trace-shape-family.js` already detects `longneck_animal`, `quadruped_animal`, and `vehicle`.
- `/home/sang/Projects/kids-coloring-app/js/trace-semantic-builders.js` already builds long-neck head, neck, body, tail, limb, and interior semantic regions.
- `/home/sang/Projects/kids-coloring-app/js/trace-semantic.js` already enriches parts with `displayName`, `hint`, `toleranceMultiplier`, and `shapeFamily`.
- `/home/sang/Projects/kids-coloring-app/verify-fill-regions.html` already has semantic gates for first part, family, name coverage, ordering, recognizability, ornament-last, and face-late.

## Gaps To Close
- Add a fixture or generated test source that better resembles the Bimi Boo diplodocus layout without copying the extracted artwork.
- Add a fixture-level semantic gate for background suppression: decorative/background regions should not appear before the target animal's first two semantic parts.
- Add a long-neck-specific QA expectation for body spots or ornaments appearing late.
- Consider showing completed semantic parts with a distinct completed-state tint so the UI approximates the reference `step/mask/back` separation.

## Implementation Follow-Up

### /home/sang/Projects/kids-coloring-app/verify-fill-regions.html — target-first semantic gate
- Changes: Split the existing first-two-parts recognizability check from the new `Target First 2` gate. The recognizability gate now checks that the first two semantic parts are named, while `Target First 2` checks that they are not `ornament`.
- Impact: Semantic QA now reports `semantic_background_too_early` when a decorative/background region appears before the target drawing is established.
- Verification: `cli-jaw browser navigate "http://127.0.0.1:4177/verify-fill-regions.html"` followed by `Run Fixture Verification` returned `5/5 fixtures passed`, showed `Target First 2: yes` for every fixture, and reported no console entries. Screenshot evidence: `/home/sang/.cli-jaw/screenshots/screenshot_1791988231093.png`.

### /home/sang/Projects/kids-coloring-app/js/trace-semantic.js — Korean topic particle in part hints
- Changes: Added a small Hangul final-consonant check for head-feature hints so labels render as `얼굴은` instead of `얼굴는`.
- Impact: Semantic trace hints remain natural when the part label ends with a final consonant.
- Verification: `cli-jaw browser navigate "http://127.0.0.1:4177/index.html?no-sw=1&sw-reset=1&v=particle-fix"` then cat preset → trace mode → complete the first trace part. The second trace part displayed `얼굴은 나중에 또렷하게 그려봐요!` with no console entries. Screenshot evidence: `/home/sang/.cli-jaw/screenshots/screenshot_1791988907777.png`.

## Verification Evidence
- `unzip -l /home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/base.apk` showed the Addressables catalog, drawing gameplay prefab bundle, `diplodocus.bundle`, and `finish-picture-5-(diplodocus).bundle`.
- `file /home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/unitypy-export/*diplodocus*.png /home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/extracted-focus/unitypy-export/*stroke.png` confirmed:
  - `diplodocus__diplodocus.png`: `2048 x 2048` RGBA PNG.
  - `_diplodocus_parts_sheet.png`: `1820 x 510` RGB PNG.
  - `finish-picture-5-(diplodocus)__stroke.png`: `917 x 947` RGBA PNG.
- Palette sampling of `diplodocus__diplodocus.png` found dominant white, red, grey, dashed-dark, cyan, and black groups, matching separated atlas layers rather than a flattened final illustration.
