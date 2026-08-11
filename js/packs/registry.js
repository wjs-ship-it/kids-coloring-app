import { PRESET_PACKS } from './preset-packs.js';
import { SAMPLE_PACKS } from './sample-packs.js';
import { THEME_PACKS } from './theme-packs.js';
import { PREMIUM_PACKS } from './premium-packs.js';

const PACK_REGISTRY = [
  ...PRESET_PACKS,
  ...SAMPLE_PACKS,
  ...THEME_PACKS,
  ...PREMIUM_PACKS
];

export function getPackRegistry() {
  return PACK_REGISTRY.slice();
}

export function getBuiltinPresetPack() {
  return PRESET_PACKS[0];
}
