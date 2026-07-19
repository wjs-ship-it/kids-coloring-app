function drawPresetCat(ctx, w, h) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.25, h * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w * 0.18, cy - h * 0.18);
  ctx.lineTo(cx - w * 0.12, cy - h * 0.32);
  ctx.lineTo(cx - w * 0.04, cy - h * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.18, cy - h * 0.18);
  ctx.lineTo(cx + w * 0.12, cy - h * 0.32);
  ctx.lineTo(cx + w * 0.04, cy - h * 0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - w * 0.08, cy - h * 0.04, w * 0.03, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + w * 0.08, cy - h * 0.04, w * 0.03, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.06, w * 0.03, h * 0.02, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.1, w * 0.06, 0.1, Math.PI - 0.1);
  ctx.stroke();

  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.06, cy + h * 0.04 + i * h * 0.025);
      ctx.lineTo(cx + side * w * 0.22, cy + h * 0.02 + i * h * 0.03);
      ctx.stroke();
    }
  }
}

function drawPresetDog(ctx, w, h) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx - w * 0.18, cy - h * 0.08, w * 0.08, h * 0.14, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.18, cy - h * 0.08, w * 0.08, h * 0.14, 0.3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - w * 0.07, cy - h * 0.04, w * 0.03, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + w * 0.07, cy - h * 0.04, w * 0.03, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.06, w * 0.05, h * 0.035, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.14, w * 0.08, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.12, w * 0.04, h * 0.02, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawPresetCar(ctx, w, h) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.55;

  ctx.beginPath();
  ctx.roundRect(cx - w * 0.35, cy - h * 0.06, w * 0.7, h * 0.14, 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, cy - h * 0.06);
  ctx.lineTo(cx - w * 0.12, cy - h * 0.2);
  ctx.lineTo(cx + w * 0.12, cy - h * 0.2);
  ctx.lineTo(cx + w * 0.2, cy - h * 0.06);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - w * 0.2, cy + h * 0.08, w * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + w * 0.2, cy + h * 0.08, w * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(cx - w * 0.1, cy - h * 0.18, w * 0.09, h * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx + w * 0.01, cy - h * 0.18, w * 0.09, h * 0.1);
  ctx.stroke();
}

function drawPresetHouse(ctx, w, h) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, base = h * 0.7;

  ctx.beginPath();
  ctx.rect(cx - w * 0.25, base - h * 0.3, w * 0.5, h * 0.3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, base - h * 0.3);
  ctx.lineTo(cx, base - h * 0.5);
  ctx.lineTo(cx + w * 0.3, base - h * 0.3);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(cx - w * 0.06, base - h * 0.15, w * 0.12, h * 0.15);
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(cx - w * 0.2, base - h * 0.24, w * 0.08, h * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx + w * 0.12, base - h * 0.24, w * 0.08, h * 0.08);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.15, w * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.75, base);
  ctx.lineTo(w * 0.75, base - h * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w * 0.75, base - h * 0.26, w * 0.06, h * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPresetFlower(ctx, w, h) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.45;

  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const px = cx + Math.cos(angle) * w * 0.12;
    const py = cy + Math.sin(angle) * w * 0.12;
    ctx.beginPath();
    ctx.ellipse(px, py, w * 0.06, w * 0.04, angle, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx, cy + w * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.03, h * 0.65, cx, h * 0.8);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx - w * 0.08, h * 0.62, w * 0.06, h * 0.03, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.08, h * 0.55, w * 0.06, h * 0.03, 0.3, 0, Math.PI * 2);
  ctx.stroke();

  const bx = w * 0.75, by = h * 0.35;
  ctx.beginPath();
  ctx.ellipse(bx, by, w * 0.04, h * 0.03, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - w * 0.04, by);
  ctx.quadraticCurveTo(bx - w * 0.08, by - h * 0.04, bx - w * 0.03, by - h * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.04, by);
  ctx.quadraticCurveTo(bx + w * 0.08, by - h * 0.04, bx + w * 0.03, by - h * 0.05);
  ctx.stroke();
}

export const PRESETS = [
  { name: '고양이', emoji: '🐱', draw: drawPresetCat },
  { name: '강아지', emoji: '🐶', draw: drawPresetDog },
  { name: '자동차', emoji: '🚗', draw: drawPresetCar },
  { name: '집', emoji: '🏠', draw: drawPresetHouse },
  { name: '꽃', emoji: '🌸', draw: drawPresetFlower }
];

export function renderPreset(preset, canvas, ctx) {
  const size = 600;
  canvas.width = size; canvas.height = size;
  preset.draw(ctx, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const outData = new Uint8ClampedArray(size * size * 4);
  const d = imageData.data;
  for (let i = 0; i < size * size; i++) {
    const j = i * 4;
    const lum = 0.299 * d[j] + 0.587 * d[j+1] + 0.114 * d[j+2];
    const v = lum < 200 ? 40 : 255;
    outData[j] = v; outData[j+1] = v; outData[j+2] = v; outData[j+3] = 255;
  }
  const lineartData = new ImageData(outData, size, size);
  return { lineartData, outData, size };
}
