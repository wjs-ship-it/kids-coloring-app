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
    aspect > 0.72 &&
    aspect < 1.38 &&
    centered &&
    topFeatureCount >= 1
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
