import { getSemanticLabel } from './trace-shape-family.js';

function classifyAttachSide(region, metrics) {
  const centerX = metrics.minX + metrics.width / 2;
  const centerY = metrics.minY + metrics.height / 2;
  const dx = region.centerX - centerX;
  const dy = region.centerY - centerY;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
}

export function selectSemanticRegions(regions, metrics, family, helpers) {
  const { buildEdgeSetFromRegion, traceContour, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const areaFloor = Math.max(12, Math.round(metrics.width * metrics.height * 0.008));
  const candidates = regions.filter((region) => !region.touchesBorder && region.area >= areaFloor);

  return candidates.map((region) => {
    let semanticCategory = 'ornament';
    let drawOrder = 5;
    const attachSide = classifyAttachSide(region, metrics);

    if (family === 'mascot_character') {
      if (region.centerY > metrics.minY + metrics.height * 0.54) {
        semanticCategory = 'limb';
        drawOrder = region.centerX < metrics.minX + metrics.width / 2 ? 6 : 7;
      } else if (region.centerY < metrics.minY + metrics.height * 0.44) {
        semanticCategory = 'head_feature';
        drawOrder = 8;
      } else if (
        region.centerX < metrics.minX + metrics.width * 0.22 ||
        region.centerX > metrics.minX + metrics.width * 0.78
      ) {
        semanticCategory = 'limb';
        drawOrder = region.centerX < metrics.minX + metrics.width / 2 ? 2 : 3;
      }
    } else if (family === 'round_character') {
      if (region.centerY > metrics.minY + metrics.height * 0.56) {
        semanticCategory = 'limb';
        drawOrder = 2;
      } else if (region.centerY < metrics.minY + metrics.height * 0.5) {
        semanticCategory = 'head_feature';
        drawOrder = 3;
      }
    } else if (family === 'quadruped_animal') {
      if (region.centerX < metrics.minX + metrics.width * 0.24) {
        semanticCategory = 'head_feature';
        drawOrder = 2;
      } else if (region.centerX > metrics.minX + metrics.width * 0.76) {
        semanticCategory = 'tail_feature';
        drawOrder = 5;
      } else if (region.centerY > metrics.minY + metrics.height * 0.56) {
        semanticCategory = 'limb';
        drawOrder = region.centerX < metrics.minX + metrics.width / 2 ? 3 : 4;
      }
    } else if (family === 'vehicle') {
      if (region.centerY > metrics.minY + metrics.height * 0.62) {
        semanticCategory = 'limb';
        drawOrder = 3;
      } else if (region.centerY < metrics.minY + metrics.height * 0.48) {
        semanticCategory = 'head_feature';
        drawOrder = 2;
      } else if (region.centerX > metrics.minX + metrics.width * 0.78) {
        semanticCategory = 'tail_feature';
        drawOrder = 4;
      }
    } else if (family === 'longneck_animal') {
      if (region.centerY > metrics.minY + metrics.height * 0.54) {
        semanticCategory = 'limb';
        drawOrder = 4;
      } else if (region.centerY < metrics.minY + metrics.height * 0.24) {
        semanticCategory = 'head_feature';
        drawOrder = 2;
      } else if (region.centerX > metrics.minX + metrics.width * 0.72) {
        semanticCategory = 'tail_feature';
        drawOrder = 5;
      }
    } else if (region.centerY < metrics.minY + metrics.height * 0.45) {
      semanticCategory = 'head_feature';
      drawOrder = 3;
    }

    const edgeSet = buildEdgeSetFromRegion(region.pixels, metrics.isEdge, metrics.canvasW, metrics.canvasH);
    const contour = traceContour(edgeSet, metrics.canvasW, metrics.canvasH);
    if (contour.length < 8) return null;
    const simplified = evenlySampleContour(simplifyContour(contour, metrics.canvasW, 1.8), 88);
    return buildPart(simplified, metrics.canvasW, {
      semanticCategory,
      semanticScore: region.area,
      semanticLabel: getSemanticLabel(family, semanticCategory, drawOrder),
      sourceRegionId: region.label,
      attachSide,
      drawOrder,
      shapeFamily: family,
    });
  }).filter(Boolean);
}

export function buildMascotSilhouetteParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const headTopY = metrics.minY + metrics.height * 0.28;
  const midY = metrics.minY + metrics.height * 0.50;
  const lowerY = metrics.minY + metrics.height * 0.72;
  const leftStarX = metrics.minX + metrics.width * 0.28;
  const rightBodyX = metrics.minX + metrics.width * 0.64;
  const rightStarX = metrics.minX + metrics.width * 0.76;
  const centerLeft = metrics.minX + metrics.width * 0.28;
  const centerRight = metrics.minX + metrics.width * 0.72;
  const defs = [
    [
      extractLongestRun(contour, w, (x, y) =>
        y <= headTopY && x >= centerLeft && x <= centerRight
      ),
      'silhouette',
      1,
      '머리윗선',
    ],
    [
      extractLongestRun(contour, w, (x, y) =>
        x >= rightBodyX && y > headTopY && y <= midY
      ),
      'silhouette',
      2,
      '오른쪽몸통',
    ],
    [
      extractLongestRun(contour, w, (x, y) =>
        x >= rightStarX && y > midY
      ),
      'tail_feature',
      3,
      '오른쪽별',
    ],
    [
      extractLongestRun(contour, w, (_x, y) =>
        y >= lowerY
      ),
      'silhouette',
      4,
      '아래별',
    ],
    [
      extractLongestRun(contour, w, (x, y) =>
        x <= leftStarX && y > midY
      ),
      'tail_feature',
      5,
      '왼쪽별',
    ],
  ];

  return defs.flatMap(([boundaryPos, semanticCategory, drawOrder, semanticLabel]) => {
    if (boundaryPos.length < 10) return [];
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.0, 2.4 - detail / 48)),
      72
    );
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel,
      drawOrder,
      shapeFamily: 'mascot_character',
    })];
  });
}

export function buildRoundCharacterSilhouette(contour, metrics, w, detail, family, helpers) {
  const { simplifyContour, evenlySampleContour, buildPart } = helpers;
  const simplified = evenlySampleContour(simplifyContour(contour, w, Math.max(1.0, 2.8 - detail / 42)), 180);
  return buildPart(simplified, w, {
    semanticCategory: 'silhouette',
    semanticScore: simplified.length,
    semanticLabel: getSemanticLabel(family, 'silhouette', 1),
    drawOrder: 1,
    shapeFamily: family,
  });
}

export function buildRoundCharacterContourParts(contour, metrics, w, detail, family, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const leftX = metrics.minX + metrics.width * 0.28;
  const rightX = metrics.minX + metrics.width * 0.72;
  const faceLeftX = metrics.minX + metrics.width * 0.3;
  const faceRightX = metrics.minX + metrics.width * 0.7;
  const upperY = metrics.minY + metrics.height * 0.36;
  const midY = metrics.minY + metrics.height * 0.56;
  const lowerY = metrics.minY + metrics.height * 0.68;
  const centerX = metrics.minX + metrics.width / 2;
  const defs = [
    [
      extractLongestRun(contour, w, (x, y) =>
        x >= faceLeftX && x <= faceRightX && y >= upperY && y <= midY
      ),
      'head_feature',
      2
    ],
    [extractLongestRun(contour, w, (x, y) => x <= leftX && y > upperY && y < lowerY), 'limb', 3],
    [extractLongestRun(contour, w, (x, y) => x >= rightX && y > upperY && y < lowerY), 'limb', 4],
    [extractLongestRun(contour, w, (x, y) => y >= midY && x < centerX), 'limb', 5],
    [extractLongestRun(contour, w, (x, y) => y >= midY && x >= centerX), 'limb', 6],
  ];
  return defs.flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    const minBoundary = semanticCategory === 'head_feature' ? 6 : 10;
    if (boundaryPos.length < minBoundary) return [];
    const simplified = evenlySampleContour(simplifyContour(boundaryPos, w, Math.max(1.0, 2.5 - detail / 45)), 72);
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel(family, semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: family,
    })];
  });
}

export function buildLongneckSilhouetteParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const topCut = metrics.minY + metrics.height * 0.24;
  const neckCut = metrics.minY + metrics.height * 0.5;
  const bodyCut = metrics.minY + metrics.height * 0.44;
  const tailX = metrics.minX + metrics.width * 0.72;
  const centerBand = metrics.minX + metrics.width * 0.17;
  const centerX = metrics.minX + metrics.width / 2;
  const headRun = extractLongestRun(contour, w, (_x, y) => y <= topCut);
  const neckRun = extractLongestRun(contour, w, (x, y) => y > topCut && y <= neckCut && Math.abs(x - centerX) <= centerBand);
  const bodyRun = extractLongestRun(contour, w, (x, y) => y >= bodyCut && x < tailX);
  const tailRun = extractLongestRun(contour, w, (x, y) => x >= tailX || (y >= metrics.minY + metrics.height * 0.66 && x >= centerX));
  return [
    [headRun, 'silhouette', 1],
    [neckRun, 'silhouette', 2],
    [bodyRun, 'silhouette', 3],
    [tailRun, 'tail_feature', 5],
  ].flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    if (boundaryPos.length < 12) return [];
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.1, 3.0 - detail / 40)),
      semanticCategory === 'tail_feature' ? 72 : 96
    );
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel('longneck_animal', semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: 'longneck_animal',
    })];
  });
}

export function buildQuadrupedSilhouetteParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const headX = metrics.minX + metrics.width * 0.28;
  const bodyStartX = metrics.minX + metrics.width * 0.18;
  const bodyEndX = metrics.minX + metrics.width * 0.82;
  const tailX = metrics.minX + metrics.width * 0.76;
  const midY = metrics.minY + metrics.height * 0.52;
  const headRun = extractLongestRun(contour, w, (x, y) => x <= headX && y <= midY);
  const bodyRun = extractLongestRun(contour, w, (x) => x >= bodyStartX && x <= bodyEndX);
  const tailRun = extractLongestRun(contour, w, (x) => x >= tailX);
  return [
    [bodyRun, 'silhouette', 1],
    [headRun, 'silhouette', 2],
    [tailRun, 'tail_feature', 5],
  ].flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    if (boundaryPos.length < 10) return [];
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.1, 2.8 - detail / 42)),
      semanticCategory === 'tail_feature' ? 72 : 96
    );
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel('quadruped_animal', semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: 'quadruped_animal',
    })];
  });
}

export function buildQuadrupedContourParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const frontBand = metrics.minX + metrics.width * 0.46;
  const backBand = metrics.minX + metrics.width * 0.68;
  const legY = metrics.minY + metrics.height * 0.60;
  return [
    [extractLongestRun(contour, w, (x, y) => y >= legY && x <= frontBand), 'limb', 3],
    [extractLongestRun(contour, w, (x, y) => y >= legY && x >= backBand), 'limb', 4],
  ].flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    if (boundaryPos.length < 10) return [];
    const simplified = evenlySampleContour(simplifyContour(boundaryPos, w, Math.max(1.0, 2.4 - detail / 45)), 72);
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel('quadruped_animal', semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: 'quadruped_animal',
    })];
  });
}

export function buildVehicleSilhouetteParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const roofY = metrics.minY + metrics.height * 0.42;
  const flameX = metrics.minX + metrics.width * 0.80;
  const bodyRun = extractLongestRun(contour, w, (_x, y) => y >= roofY);
  const flameRun = extractLongestRun(contour, w, (x, y) => x >= flameX && y >= metrics.minY + metrics.height * 0.32);
  return [
    [bodyRun, 'silhouette', 1],
    [flameRun, 'tail_feature', 4],
  ].flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    if (boundaryPos.length < 10) return [];
    const simplified = evenlySampleContour(
      simplifyContour(boundaryPos, w, Math.max(1.0, 2.5 - detail / 45)),
      semanticCategory === 'tail_feature' ? 72 : 100
    );
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel('vehicle', semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: 'vehicle',
    })];
  });
}

export function buildVehicleContourParts(contour, metrics, w, detail, helpers) {
  const { extractLongestRun, simplifyContour, evenlySampleContour, buildPart } = helpers;
  const wheelY = metrics.minY + metrics.height * 0.62;
  const centerX = metrics.minX + metrics.width / 2;
  const upperBand = metrics.minY + metrics.height * 0.46;
  return [
    [extractLongestRun(contour, w, (x, y) => y >= wheelY && x < centerX), 'limb', 3],
    [extractLongestRun(contour, w, (x, y) => y >= wheelY && x >= centerX), 'limb', 3],
    [extractLongestRun(contour, w, (_x, y) => y < upperBand), 'head_feature', 2],
  ].flatMap(([boundaryPos, semanticCategory, drawOrder]) => {
    if (boundaryPos.length < 10) return [];
    const simplified = evenlySampleContour(simplifyContour(boundaryPos, w, Math.max(1.0, 2.3 - detail / 45)), 72);
    return [buildPart(simplified, w, {
      semanticCategory,
      semanticScore: simplified.length,
      semanticLabel: getSemanticLabel('vehicle', semanticCategory, drawOrder),
      drawOrder,
      shapeFamily: 'vehicle',
    })];
  });
}
