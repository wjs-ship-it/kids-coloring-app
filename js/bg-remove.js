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
  const cy = canvas.height * 0.47;
  const rx = canvas.width * 0.35;
  const ry = canvas.height * 0.43;

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
    const faceBand = radial < 0.34 && y > canvas.height * 0.10 && y < canvas.height * 0.62;
    const torsoBand = radial < 0.58 && y > canvas.height * 0.18 && y < canvas.height * 0.88;
    const edgeBand = radial > 0.72;

    let whiten = 0;
    if (edgeBand) whiten += Math.min(1, (radial - 0.72) / 0.34) * 0.98;
    if (radial > 0.54 && luminance > 150 && chroma < 62) {
      whiten += Math.min(1, (radial - 0.54) / 0.32) * 0.62;
    }
    if (radial > 0.44 && luminance > 182) whiten += 0.18;
    if (y < canvas.height * 0.22 && luminance > 172) whiten += 0.28;
    if (y > canvas.height * 0.82 && luminance > 150 && chroma < 58) whiten += 0.22;

    if (faceBand) whiten *= 0.18;
    else if (torsoBand) whiten *= 0.45;
    else whiten *= 1.08;

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
