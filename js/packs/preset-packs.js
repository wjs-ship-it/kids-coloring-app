import { PRESETS } from '../presets.js';

export const PRESET_PACKS = [
  {
    id: 'builtin-starter-presets',
    type: 'preset-pack',
    title: '기본 프리셋',
    premium: false,
    modeHints: ['illustration'],
    items: PRESETS.map((preset, presetIndex) => ({
      id: `preset-${presetIndex}`,
      presetIndex,
      name: preset.name,
      emoji: preset.emoji,
      resolvedMode: 'illustration'
    }))
  }
];
