export function buildFamilyMetrics(regions, metrics) {
  const totalArea = Math.max(1, metrics.width * metrics.height);
  const bottomLimbCount = regions.filter((region) =>
    region.centerY > metrics.minY + metrics.height * 0.58 &&
    region.area > metrics.width * 0.02 &&
    region.area < totalArea * 0.14
  ).length;
  const topFeatureCount = regions.filter((region) =>
    region.centerY < metrics.minY + metrics.height * 0.42 &&
    region.area < totalArea * 0.12
  ).length;
  const rightTailMass = regions
    .filter((region) => region.centerX > metrics.minX + metrics.width * 0.68)
    .reduce((acc, region) => acc + region.area, 0);
  const leftMass = regions
    .filter((region) => region.centerX < metrics.minX + metrics.width * 0.34)
    .reduce((acc, region) => acc + region.area, 0);
  const rightMass = regions
    .filter((region) => region.centerX > metrics.minX + metrics.width * 0.66)
    .reduce((acc, region) => acc + region.area, 0);
  const lowerMass = regions
    .filter((region) => region.centerY > metrics.minY + metrics.height * 0.62)
    .reduce((acc, region) => acc + region.area, 0);
  const centerMass = regions
    .filter((region) =>
      region.centerX > metrics.minX + metrics.width * 0.28 &&
      region.centerX < metrics.minX + metrics.width * 0.72
    )
    .reduce((acc, region) => acc + region.area, 0);

  return {
    bboxWidth: metrics.width,
    bboxHeight: metrics.height,
    centerX: metrics.centerX / Math.max(1, metrics.maxX + 1),
    centerY: metrics.centerY / Math.max(1, metrics.maxY + 1),
    bottomLimbCount,
    topFeatureCount,
    rightTailBias: rightTailMass / totalArea,
    lowerRightMass: rightTailMass / totalArea,
    topMass: topFeatureCount / Math.max(1, regions.length),
    leftMassRatio: leftMass / totalArea,
    rightMassRatio: rightMass / totalArea,
    lowerMassRatio: lowerMass / totalArea,
    centerMassRatio: centerMass / totalArea,
  };
}

export function detectIllustrationShapeFamily(metrics) {
  const {
    bboxWidth = 1,
    bboxHeight = 1,
    centerX = 0,
    centerY = 0,
    bottomLimbCount = 0,
    topFeatureCount = 0,
    rightTailBias = 0,
    lowerRightMass = 0,
    topMass = 0,
    leftMassRatio = 0,
    rightMassRatio = 0,
    lowerMassRatio = 0,
    centerMassRatio = 0,
  } = metrics || {};

  const aspect = bboxHeight / Math.max(1, bboxWidth);
  const centered = centerX > 0.33 && centerX < 0.67 && centerY > 0.28 && centerY < 0.68;
  const sideBalanced = Math.abs(leftMassRatio - rightMassRatio) < 0.08;

  if (
    bottomLimbCount >= 2 &&
    aspect > 0.45 &&
    aspect < 0.95 &&
    sideBalanced &&
    topFeatureCount >= 3 &&
    lowerMassRatio > 0.025
  ) {
    return 'quadruped_animal';
  }

  if (
    bottomLimbCount >= 2 &&
    aspect > 0.62 &&
    aspect < 1.45 &&
    centered &&
    centerMassRatio > 0.12 &&
    lowerMassRatio < 0.08
  ) {
    return 'round_character';
  }

  if (
    aspect >= 1.02 &&
    (rightTailBias > 0.1 || lowerRightMass > 0.18 || topMass < 0.22)
  ) {
    return 'longneck_animal';
  }

  if (
    aspect > 0.35 &&
    aspect < 0.85 &&
    centerMassRatio > 0.18 &&
    lowerMassRatio > 0.08 &&
    topFeatureCount <= 3
  ) {
    return 'vehicle';
  }

  if (aspect > 0.7 && aspect < 1.45 && bottomLimbCount <= 1) {
    return 'sticker_object';
  }

  return 'illustration_generic';
}

export function getSemanticLabel(family, semanticCategory, drawOrder) {
  if (family === 'longneck_animal') {
    if (drawOrder === 1) return '머리';
    if (drawOrder === 2) return '목';
    if (drawOrder === 3) return '몸통';
    if (semanticCategory === 'limb') return '다리';
    if (semanticCategory === 'tail_feature') return '꼬리';
  }
  if (family === 'quadruped_animal') {
    if (drawOrder === 1) return '몸통';
    if (drawOrder === 2) return '머리';
    if (drawOrder === 3) return '앞다리';
    if (drawOrder === 4) return '뒷다리';
    if (semanticCategory === 'tail_feature') return '꼬리';
    if (semanticCategory === 'head_feature') return '얼굴';
  }
  if (family === 'vehicle') {
    if (drawOrder === 1) return '몸체';
    if (drawOrder === 2) return '창문';
    if (drawOrder === 3) return '바퀴';
    if (semanticCategory === 'tail_feature') return '불꽃';
  }
  if (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic') {
    if (drawOrder === 1) return '몸통';
    if (drawOrder === 2 || drawOrder === 3) return '손';
    if (drawOrder === 4 || drawOrder === 5) return '발';
    if (semanticCategory === 'head_feature') return '얼굴';
  }
  return semanticCategory === 'ornament' ? '장식' : '';
}

function relabelRoundLikePart(part, metrics) {
  if (part.semanticCategory === 'silhouette') return '몸통';
  if (part.semanticCategory === 'head_feature') return '얼굴';
  if (part.semanticCategory === 'ornament') return '장식';
  if (part.semanticCategory !== 'limb') return part.semanticLabel || '';

  const centerX = metrics.minX + metrics.width / 2;
  const midY = metrics.minY + metrics.height * 0.56;
  const isLeft = part.centroid.x < centerX;
  const isUpper = part.centroid.y < midY;
  if (isUpper) return isLeft ? '왼손' : '오른손';
  return isLeft ? '왼발' : '오른발';
}

function relabelLongneckPart(part, metrics) {
  if (part.semanticCategory === 'tail_feature') return '꼬리';
  if (part.semanticCategory === 'ornament') return '장식';
  if (part.semanticCategory === 'head_feature') return '얼굴';
  if (part.semanticCategory === 'limb') {
    const centerX = metrics.minX + metrics.width / 2;
    return part.centroid.x < centerX ? '앞다리' : '뒷다리';
  }
  if (part.semanticCategory === 'silhouette') {
    const topCut = metrics.minY + metrics.height * 0.24;
    const neckCut = metrics.minY + metrics.height * 0.5;
    if (part.centroid.y <= topCut) return '머리';
    if (part.centroid.y <= neckCut) return '목';
    return '몸통';
  }
  return part.semanticLabel || '';
}

function relabelQuadrupedPart(part, metrics) {
  if (part.semanticCategory === 'tail_feature') return '꼬리';
  if (part.semanticCategory === 'head_feature') return '얼굴';
  if (part.semanticCategory === 'ornament') return '장식';
  if (part.semanticCategory === 'silhouette') {
    const headCut = metrics.minX + metrics.width * 0.26;
    return part.centroid.x <= headCut ? '머리' : '몸통';
  }
  if (part.semanticCategory === 'limb') {
    const centerX = metrics.minX + metrics.width / 2;
    return part.centroid.x < centerX ? '앞다리' : '뒷다리';
  }
  return part.semanticLabel || '';
}

function relabelVehiclePart(part, metrics) {
  if (part.semanticCategory === 'tail_feature') return '불꽃';
  if (part.semanticCategory === 'head_feature') return '창문';
  if (part.semanticCategory === 'ornament') return '장식';
  if (part.semanticCategory === 'silhouette') return '몸체';
  if (part.semanticCategory === 'limb') {
    const centerX = metrics.minX + metrics.width / 2;
    return part.centroid.x < centerX ? '앞바퀴' : '뒷바퀴';
  }
  return part.semanticLabel || '';
}

export function applyFamilyOrdering(parts, family, metrics) {
  const cloned = parts.map((part) => ({ ...part }));

  if (family === 'longneck_animal') {
    const categoryRank = { silhouette: 0, limb: 1, head_feature: 2, tail_feature: 3, ornament: 4 };
    cloned.sort((a, b) =>
      (categoryRank[a.semanticCategory] ?? 9) - (categoryRank[b.semanticCategory] ?? 9) ||
      a.centroid.y - b.centroid.y ||
      a.centroid.x - b.centroid.x
    );
    return cloned.map((part, index) => ({
      ...part,
      drawOrder: index + 1,
      semanticLabel: relabelLongneckPart(part, metrics),
    }));
  }

  if (family === 'quadruped_animal') {
    const categoryRank = { silhouette: 0, limb: 1, tail_feature: 2, head_feature: 3, ornament: 4 };
    const centerX = metrics.minX + metrics.width / 2;
    cloned.sort((a, b) =>
      (categoryRank[a.semanticCategory] ?? 9) - (categoryRank[b.semanticCategory] ?? 9) ||
      (a.semanticCategory === 'limb' && b.semanticCategory === 'limb' ? a.centroid.x - b.centroid.x : 0) ||
      Math.abs(a.centroid.x - centerX) - Math.abs(b.centroid.x - centerX) ||
      a.centroid.x - b.centroid.x
    );
    return cloned.map((part, index) => ({
      ...part,
      drawOrder: index + 1,
      semanticLabel: relabelQuadrupedPart(part, metrics),
    }));
  }

  if (family === 'vehicle') {
    const categoryRank = { silhouette: 0, head_feature: 1, limb: 2, tail_feature: 3, ornament: 4 };
    cloned.sort((a, b) =>
      (categoryRank[a.semanticCategory] ?? 9) - (categoryRank[b.semanticCategory] ?? 9) ||
      a.centroid.y - b.centroid.y ||
      a.centroid.x - b.centroid.x
    );
    return cloned.map((part, index) => ({
      ...part,
      drawOrder: index + 1,
      semanticLabel: relabelVehiclePart(part, metrics),
    }));
  }

  const roundLike = family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic';
  if (roundLike) {
    const categoryRank = { silhouette: 0, limb: 1, head_feature: 2, ornament: 3, tail_feature: 4 };
    const centerX = metrics.minX + metrics.width / 2;
    const midY = metrics.minY + metrics.height * 0.56;
    cloned.sort((a, b) => {
      const rankDiff = (categoryRank[a.semanticCategory] ?? 9) - (categoryRank[b.semanticCategory] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      if (a.semanticCategory === 'limb' && b.semanticCategory === 'limb') {
        const aUpper = a.centroid.y < midY ? 0 : 1;
        const bUpper = b.centroid.y < midY ? 0 : 1;
        if (aUpper !== bUpper) return aUpper - bUpper;
        const aLeft = a.centroid.x < centerX ? 0 : 1;
        const bLeft = b.centroid.x < centerX ? 0 : 1;
        if (aLeft !== bLeft) return aLeft - bLeft;
      }
      if (a.semanticCategory === 'head_feature' && b.semanticCategory === 'head_feature') {
        if (a.centroid.y !== b.centroid.y) return a.centroid.y - b.centroid.y;
      }
      return a.centroid.x - b.centroid.x || a.centroid.y - b.centroid.y;
    });
    return cloned.map((part, index) => ({
      ...part,
      drawOrder: index + 1,
      semanticLabel: relabelRoundLikePart(part, metrics),
    }));
  }

  return cloned;
}

export function getFamilyPartCap(family) {
  if (family === 'round_character') return 7;
  if (family === 'longneck_animal') return 7;
  if (family === 'quadruped_animal') return 7;
  if (family === 'vehicle') return 6;
  return 6;
}
