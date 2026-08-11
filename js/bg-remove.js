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
  const bmp = await createImageBitmap(imageBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.46;
  const rx = canvas.width * 0.34;
  const ry = canvas.height * 0.42;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);

    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    const radial = Math.sqrt(nx * nx + ny * ny);

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    let whiten = 0;
    if (radial > 0.78) whiten += Math.min(1, (radial - 0.78) / 0.42) * 0.9;
    if (radial > 0.58 && luminance > 165 && chroma < 55) {
      whiten += Math.min(1, (radial - 0.58) / 0.36) * 0.55;
    }
    if (y < canvas.height * 0.18 && luminance > 175) whiten += 0.25;

    whiten = Math.min(0.97, whiten);
    if (whiten <= 0) continue;

    data[i] = Math.round(r * (1 - whiten) + 255 * whiten);
    data[i + 1] = Math.round(g * (1 - whiten) + 255 * whiten);
    data[i + 2] = Math.round(b * (1 - whiten) + 255 * whiten);
    data[i + 3] = Math.round(255 * (1 - whiten * 0.92));
  }

  ctx.putImageData(imageData, 0, 0);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
