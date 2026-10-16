# Installed APK image audit — 2026-10-15

## Scope and evidence

- Source: /home/sang/Projects/kids-coloring-app/reference-apks/com.bimiboo.kids.drawing/base.apk
- SHA-256: 053a238b6ddb6be62930de6f03044b30b483b549831297d3ad20a62f56f429ce
- REA open_binary confirmed the artifact identity and APK format. Image counts below are from a separate UnityPy static inventory, not REA image-analysis evidence.
- All 221 .bundle members and assets/bin/Data/data.unity3d were parsed, including shared and onboarding resources.
- Inventory: image-inventory.json records bundle names, object IDs, names and dimensions.
- Counted 601 Texture2D objects and 1,005 Sprite objects. These overlap, include UI/fonts/brushes, and are NOT counts of distinct playable drawings. Shared duplicates have not been deduplicated.
- The ZIP also contains 111 PNG and 10 WebP members; these are outside the Unity texture count and include Android/SDK UI resources.

## Additional visible artwork

- extra-artwork.jpg: 24 selected Sprite assets from the core Unity data, including a rocking-horse outline, fire-engine outline, dragonfly, squid, two bee variants, cow/robot/burger cards, mascot characters and seasonal app icons.
- These are onboarding/promotional/interface images. Some contain frames, partially painted areas, or very pale outlines. Their existence does not establish a playable drawing or authored tracing sequence.
- category-icons.jpg: 69 category icon assets, including the dinosaur, farm, ocean, jungle, alphabet, numbers and robot cards seen in the user's screenshot. Repeated placeholder artwork is included; 69 is an asset count, not 69 unique illustrations.
- gallery-backgrounds.jpg: 29 themed gallery background assets, such as dinosaurs, forest, ocean, space, farm and vehicles. These are menu backgrounds, not tracing worksheets.
- selected-images.json maps each pictured item to its exact APK member and Unity object ID.

## Authored-path distinction

- Diplodocus: existing ten-step authored mask atlas.
- stars-snake: five path attachments and five masks, stored inside the shared duplicateassetisolation bundle rather than a named content folder. This was missed by the earlier 28-content-folder report.
- stars-polar-bear: nine path attachments with matching atlas texture; a separate stars-drawing mode.
- Moon-bear: eleven Bezier paths and eleven dot nodes in InformationAboutLine, a separate dot-to-dot mode.
- No additional dinosaur body/path asset was identified by this full Unity payload inventory and the earlier TextAsset/path scan. Other dinosaur names remain catalog registrations in the available APK evidence.
- Static observations do not establish paid/unlocked availability or behavior on the running phone. No new website conversion or deployment was performed.

## Correction to earlier coverage

The older report inspected 28 named content bundles. That is not an exhaustive image inventory of the APK: shared bundles, the core Unity data, category icons and gallery backgrounds contain additional artwork. Menu imagery and playable body/path resources must be reported separately.
