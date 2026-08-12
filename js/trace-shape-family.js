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
  } = metrics || {};

  const aspect = bboxHeight / Math.max(1, bboxWidth);
  const centered = centerX > 0.33 && centerX < 0.67 && centerY > 0.28 && centerY < 0.68;

  if (
    bottomLimbCount >= 2 &&
    aspect > 0.62 &&
    aspect < 1.45 &&
    centered
  ) {
    return 'round_character';
  }

  if (
    aspect >= 1.02 &&
    (rightTailBias > 0.1 || lowerRightMass > 0.18 || topMass < 0.22)
  ) {
    return 'longneck_animal';
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
  if (family === 'round_character' || family === 'sticker_object' || family === 'illustration_generic') {
    if (drawOrder === 1) return '몸통';
    if (drawOrder === 2 || drawOrder === 3) return '손';
    if (drawOrder === 4 || drawOrder === 5) return '발';
    if (semanticCategory === 'head_feature') return '얼굴';
  }
  return semanticCategory === 'ornament' ? '장식' : '';
}
