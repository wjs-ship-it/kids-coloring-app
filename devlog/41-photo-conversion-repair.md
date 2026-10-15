# Photo-to-coloring conversion repair

## Observed defect and root cause

- Public-site demo at 390x844 completed conversion but lost the cat's body/ears, retained only facial fragments, and reported zero fill regions.
- The flat orange/blue demo was classified as object because illustration detection required substantial white paper. The photograph-oriented grayscale smoothing then lost low-luminance-contrast color boundaries.
- Explicit illustration extraction also compared luminance only: different RGB colors with identical luminance could produce no enclosed coloring region.
- Added tests before implementation: colored-background classification and equal-brightness circle containment both failed. Explicit portrait-mode preservation passed.

## Changes and scope

- C2 targeted correction; reuse the browser worker, existing RGB reader, illustration extractor, fill-region builder and clipping brush. No new model, service or dependency.
- js/config.js owns the new flat-color classification thresholds and ink saturation setting.
- js/edge-detect.js recognizes low-texture, limited-palette vivid artwork without requiring white paper. For this colored-background class, compare RGB neighbor differences and avoid treating saturated filled areas as solid black ink.
- Applying this to every illustration initially regressed 3/5 semantic fixtures. A fresh comparison using HEAD's original pipeline passed 5/5; the final fix therefore restricts the new extraction behavior to flat artwork with at most 20% white paper. Existing white-paper line-art extraction is unchanged; all five semantic fixtures pass again.
- The edge-detect module already exceeded the file-size guideline before this patch. This patch stays within its existing classifier/extractor owners rather than introducing an unrelated full pipeline refactor; the existing size debt remains.
- App, worker and verification harness reference the same versioned edge module. Cache v9 includes the versioned config, worker and pipeline so previously cached scripts cannot mask the repair.
- No local-AI/tunnel integration or generic tracing-part inference change is included.

## Verification evidence

- tests/photo-conversion.test.js: four cases covering flat colored backgrounds, equal-brightness red/green boundaries with enclosed foreground and excluded exterior, explicit portrait mode, and a textured multicolor negative.
- Initial test correction: buildFillRegions deliberately encodes the exterior as -2, not 0. The test now asserts that existing contract; its foreground enclosure assertion failed before the production fix.
- node --experimental-default-type=module --test tests/*.test.js: 18/18 passed after final changes. Node syntax checks and git diff --check passed.
- tests/photo-conversion-browser-smoke.js runs the real demo upload -> conversion -> preview -> mode selection -> coloring flow, then dispatches synthetic touch brush events across the boundary and reads actual canvas pixels.
- Final Chrome smoke at 390x844: illustration mode; five fill regions; conversion runtime 286.1ms; body pixel [239,68,68,255], exterior [255,255,255,255]. No background bleed.
- Existing verification harness: 5/5 preset fill/undo checks and 5/5 semantic illustration fixtures passed with the final pipeline.
- Preview screenshot inspected: /home/sang/.cli-jaw/screenshots/screenshot_1792105982809.png. Brush containment screenshot inspected: /home/sang/.cli-jaw/screenshots/screenshot_1792106106033.png.
- A manual click initially targeted a hidden paint tool and timed out; no forced click was used. The actual default brush was tested instead. The browser smoke's upload screen ID was corrected to the real DOM ID before its successful runs.

## Limits

- Verified the reported flat-artwork failure and existing fixtures; this does not promise ideal outlines for every natural photograph or physical phone.
- Generic auto-tracing still detects no parts for this demo; this change repairs the coloring conversion and bounded brush behavior, not inferred semantic tracing.
- All work remains local and committed. No push or public deployment was performed without explicit authorization.
