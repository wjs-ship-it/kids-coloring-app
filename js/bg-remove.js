let bgRemovalModule = null;
let loadAttempted = false;

async function loadModule() {
  if (loadAttempted) return bgRemovalModule;
  loadAttempted = true;
  try {
    bgRemovalModule = await Promise.race([
      import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/dist/index.mjs'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]);
  } catch {
    bgRemovalModule = null;
  }
  return bgRemovalModule;
}

export function hasBackgroundRemoval() {
  return bgRemovalModule !== null;
}

export async function removeBackground(imageBlob) {
  const mod = await loadModule();
  if (!mod) return fallbackRemoveBackground(imageBlob);

  try {
    const resultBlob = await mod.removeBackground(imageBlob, {
      output: { format: 'image/png' }
    });
    return resultBlob;
  } catch {
    return fallbackRemoveBackground(imageBlob);
  }
}

async function fallbackRemoveBackground(imageBlob) {
  return imageBlob;
}
