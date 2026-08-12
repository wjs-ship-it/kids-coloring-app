export const ILLUSTRATION_FIXTURES = [
  {
    id: 'sticker-face-legacy',
    name: 'Sticker Face Sample',
    sourcePath: './tmp-dino-semantic-check.jpg',
    mode: 'illustration',
    detail: 50,
    verificationKind: 'semantic_fixture',
    expectedFamily: 'sticker_object',
    expectedFirstPart: '몸통',
  },
  {
    id: 'rounded-car',
    name: 'Rounded Car Sample',
    sourcePath: './tmp-vehicle-semantic-check.png',
    mode: 'illustration',
    detail: 50,
    verificationKind: 'semantic_fixture',
    expectedFamily: 'vehicle',
    expectedFirstPart: '몸체',
  },
];
