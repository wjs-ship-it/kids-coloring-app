# Family Content Gallery

## Request and scope

- User requested adding the reference drawing content for their child.
- C2 frontend product slice: extend the existing preset gallery and reuse the existing tracing/coloring engines.
- Added 131 playable source drawings, preserving the 5 original presets (136 choices total).
- User authorized headless verification and GitHub Pages push/deployment on 2026-10-15 at 20:25 KST.

## Source discovery correction

- In addition to the recent APK and device cache, the existing fixture README points to an older complete local extraction at `/home/sang/Downloads/1122_extracted_all`.
- That extraction contains 149 `stroke.png` files. The import retains 130 nonblank source drawings and excludes 19 blank/very faint canvas images.
- One additional scholar bear outline was extracted from the current APK.
- The earlier analysis of 28 packaged content IDs remains specific to the current APK; it did not inventory the older extraction.
- Content is adapted into web coloring sheets. Original Unity animations, numbered coloring rules, scratch mechanics, and paid catalogs are not imported.

## Content categories

| Category | Added |
|---|---:|
| Animals and friends, including scene drawings | 25 |
| Objects and toys | 30 |
| Faces and hearts | 20 |
| Clothes | 20 |
| Alphabet | 26 |
| Numbers | 10 |
| Total | 131 |

## Implementation

- `/home/sang/Projects/kids-coloring-app/assets/family-content/`: normalized 600px coloring sheets, white background, stronger outlines. Source alpha is composited before conversion. Colored scene decoration is suppressed where possible. Minimal line connection joins dotted boundaries.
- `/home/sang/Projects/kids-coloring-app/js/packs/family-content.js`: content manifest, categories, canvas size and activity hints.
- `/home/sang/Projects/kids-coloring-app/js/packs/registry.js`: registers the new content pack.
- `/home/sang/Projects/kids-coloring-app/js/preset-gallery.js`: filterable image cards, lazy thumbnails, keyboard buttons, loading/error status, image decoding and rendering.
- `/home/sang/Projects/kids-coloring-app/js/app.js`: adapter to existing drawing state. Clears stale photo buffers, preserves original presets and returns from mode selection to the gallery. Letters/numbers start tracing directly. The ghost scene starts coloring because the current tracing engine rejects its paths.
- `/home/sang/Projects/kids-coloring-app/index.html`: actual picture thumbnails, six content categories plus original presets, responsive 2/4-column grid, sticky back button, focus states and status announcements.
- `/home/sang/Projects/kids-coloring-app/sw.js`: cache version v6 and new gallery/pack scripts included in core precaching. Images are cached on use by the existing fetch handler; the full content pack is not guaranteed offline before first use.
- Existing `app.js` is already over the module size guideline; this slice keeps state integration there and places new gallery responsibilities in a 100-line separate module rather than performing an unrelated application rewrite.

## Search and reuse evidence

- Searched `pack`, `preset`, `loadImage`, `selectPreset`, `drawImage`, `gallery`, `ensurePreset`, `buildPresetGrid`, `buildFillRegions` and `fuseLines`.
- Read existing preset renderer, pack registry and definitions, gallery markup, mode selection, worker analysis and service worker.
- Reused `renderPreset`, preset pack metadata, `ensurePresetTraceReady`, `ensurePresetFillReady`, `detectParts`, `buildFillRegions`, activity canvas, palettes and save flow.
- Configuration alone could not render raster source content or provide category navigation, so a focused gallery module and image renderer were added.

## Verification

- Decoded all 131 generated PNGs and ran the actual `buildFillRegions` and `detectParts` engines on their RGBA pixels.
- At 600×600: all 95 non-letter/number drawings have selectable fill regions; 130 drawings have trace parts. The remaining ghost scene uses coloring directly.
- All 36 alphabet/number drawings produce trace paths at source size. This does not yet establish rendered/mobile tracing quality after resizing.
- Verified unique content IDs, five original presets, and new pack registry membership.
- `node --check` passed for all five changed/new JavaScript files.
- All 24 service-worker core asset paths exist locally.
- `git diff --check` passed.
- Browser launch with `cli-jaw browser start --agent` failed with `Missing X server or $DISPLAY`. Asked user before switching to headless, following the instance's stop-on-tool-failure rule. Rendered browser/mobile/error-state verification is pending that answer.
- A temporary diagnostic script had a parenthesis typo; corrected before the successful final engine checks. It was not shipped.

## Remaining delivery

- Run headless browser verification after the user answers the pending approach question.
- Verify gallery filters, content selection, representative tracing/coloring, back navigation, original presets and failed image loading at mobile/tablet/desktop sizes.
- Public GitHub Pages update requires explicit Git push authorization under the user's instance instructions.

## Headless verification and delivery follow-up

- Headless Chrome launched successfully after user authorization.
- Verified the gallery at 390×844, 768×1024 and 1440×900, with no horizontal overflow. Mobile uses two columns and tablet/desktop use four.
- Screenshots: `/home/sang/.cli-jaw/screenshots/screenshot_1792063618694.png`, `/home/sang/.cli-jaw/screenshots/screenshot_1792063699063.png`, `/home/sang/.cli-jaw/screenshots/screenshot_1792063699316.png`.
- Gallery count: 136. Alphabet filter: 26. Original preset filter: five; original cat opens mode selection and Back returns to the gallery.
- Princess coloring: canvas pixel (190,490) changed from [255,255,255,255] to [239,68,68,255] after a brush gesture at mobile size.
- Alphabet F tracing: mobile canvas opened with two semantic trace parts and the label `1/2`; body-part names and hints are suppressed for letters/numbers.
- An experimental object-mode mapping for letters yielded zero mobile trace parts. Removed that mapping; the verified final version retains illustration analysis and adjusts labels only.
- Deliberately substituted a missing image URL in browser memory: the gallery stayed open, showed its retry message, cleared aria-busy and re-enabled all cards. Reload restored the original manifest.
- Detected stale app HTTP cache on the reused local origin. Added `?v=family-content-1` to the app module URL and matching service-worker precache entry.
- Fresh `node --check` for changed scripts and `git diff --check` passed before delivery.
