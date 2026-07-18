let bgRemovalModule = null;
let loadAttempted = false;

async function loadModule() {
  if (loadAttempted) return bgRemovalModule;
  loadAttempted = true;
  try {
    bgRemovalModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/dist/index.mjs');
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
  const img = await createImageBitmap(imageBlob);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const px = id.data;

  const corners = [
    [0, 0], [img.width - 1, 0],
    [0, img.height - 1], [img.width - 1, img.height - 1]
  ];
  let rSum = 0, gSum = 0, bSum = 0;
  for (const [x, y] of corners) {
    const i = (y * img.width + x) * 4;
    rSum += px[i]; gSum += px[i + 1]; bSum += px[i + 2];
  }
  const bgR = rSum / 4, bgG = gSum / 4, bgB = bSum / 4;
  const threshold = 50;

  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bgR, dg = px[i + 1] - bgG, db = px[i + 2] - bgB;
    if (Math.sqrt(dr * dr + dg * dg + db * db) < threshold) {
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}
