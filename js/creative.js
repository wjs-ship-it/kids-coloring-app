const NEON_COLORS = ['#ff006e','#00b4d8','#80ed99','#ffbe0b','#9b5de5','#f15bb5'];
const NEON_BG = '#1a1a2e';

export function initFreeSketch(canvas, ctx) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { type: 'sketch', drawStroke: null };
}

export function initKaleidoscope(canvas, ctx, segments = 6) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angleStep = (2 * Math.PI) / segments;

  function drawMirroredStroke(x1, y1, x2, y2, color, size) {
    for (let i = 0; i < segments; i++) {
      const angle = angleStep * i;
      const cos = Math.cos(angle), sin = Math.sin(angle);

      const rx1 = cx + (x1 - cx) * cos - (y1 - cy) * sin;
      const ry1 = cy + (x1 - cx) * sin + (y1 - cy) * cos;
      const rx2 = cx + (x2 - cx) * cos - (y2 - cy) * sin;
      const ry2 = cy + (x2 - cx) * sin + (y2 - cy) * cos;

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(rx1, ry1);
      ctx.lineTo(rx2, ry2);
      ctx.stroke();

      const mx1 = cx + (x1 - cx) * cos + (y1 - cy) * sin;
      const my1 = cy - (x1 - cx) * sin + (y1 - cy) * cos;
      const mx2 = cx + (x2 - cx) * cos + (y2 - cy) * sin;
      const my2 = cy - (x2 - cx) * sin + (y2 - cy) * cos;

      ctx.beginPath();
      ctx.moveTo(mx1, my1);
      ctx.lineTo(mx2, my2);
      ctx.stroke();
    }
  }

  return { type: 'kaleidoscope', drawStroke: drawMirroredStroke };
}

export function initNeonGlow(canvas, ctx) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = NEON_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function drawGlowStroke(x1, y1, x2, y2, color, size) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.shadowBlur = 40;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = size * 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { type: 'neon', drawStroke: drawGlowStroke };
}

export function getNeonColors() { return NEON_COLORS; }
export function getNeonBg() { return NEON_BG; }

export function rebuildPalette(colors, pickColorFn, toggleEraserFn) {
  const p = document.getElementById('side-palette');
  p.innerHTML = '';
  colors.forEach((c, i) => {
    const d = document.createElement('button');
    d.className = 'cdot' + (i === 0 ? ' active' : '');
    d.style.background = c;
    d.addEventListener('click', () => pickColorFn(c, d));
    p.appendChild(d);
  });
  const e = document.createElement('button');
  e.className = 'eraser-dot';
  e.id = 'eraser-btn';
  e.textContent = '🧹';
  e.addEventListener('click', toggleEraserFn);
  p.appendChild(e);
}

