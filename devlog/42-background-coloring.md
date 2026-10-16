# Background coloring

- Request: allow painting the outer background while preserving region boundaries.
- Reused buildFillRegions and existing brush masks/region fill renderer. Removed the exterior exclusion pass; each edge-connected component now gets its own positive region ID and isBackground metadata. No new service or dependency.
- Background regions bypass foreground size filtering, but remain optional in smart missions and completion counts. The small-interior retry still checks foreground regions only.
- Updated cache to v10 and pipeline URLs to background-color-1 so installed clients receive matching scripts.
- Existing edge-detect.js and app.js exceed file-size limits before this work. Kept changes in their existing owners and reduced edge-detect.js by removing duplicate exterior traversal; broader splitting is outside this fix.
- Verification: 19 Node tests passed, including separately paintable backgrounds divided by a line and selectable foreground/background color boundaries. Browser smoke at 390x844 produced six regions in 299.1 ms; red foreground stroke left exterior white, orange background stroke left foreground red. Screenshot inspected at /home/sang/.cli-jaw/screenshots/screenshot_1792126096437.png. Syntax checks and git diff --check passed.
- Scope: background within the imported image bounds; blank canvas margins outside the image are unchanged. Open outlines remain connected wherever pixels have no separating line. No push performed.
