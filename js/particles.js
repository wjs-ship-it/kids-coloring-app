const RAINBOW = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#4dabf7','#9775fa','#f06595','#20c997'];

function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.38;
    if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
}

function heartPath(ctx, s) {
  const r = s * 0.5;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = r * Math.pow(Math.sin(t), 3);
    const y = -r * (0.8125 * Math.cos(t) - 0.3125 * Math.cos(2 * t) - 0.125 * Math.cos(3 * t) - 0.0625 * Math.cos(4 * t));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function flowerDraw(ctx, r, color) {
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fffbe6';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5 - 1.5;
    this.life = 1.0;
    this.decay = 0.016 + Math.random() * 0.024;
    this.size = 5 + Math.random() * 9;
    this.rot = Math.random() * Math.PI * 2;
    this.rotV = (Math.random() - 0.5) * 0.12;
    this.color = color || RAINBOW[Math.floor(Math.random() * RAINBOW.length)];
    this.shape = Math.floor(Math.random() * 4);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.06;
    this.vx *= 0.98;
    this.life -= this.decay;
    this.rot += this.rotV;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const s = this.size * this.life;
    if (s < 0.5) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    if (this.shape === 0) { starPath(ctx, s); ctx.fill(); }
    else if (this.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
    else if (this.shape === 2) { heartPath(ctx, s); ctx.fill(); }
    else { flowerDraw(ctx, s, this.color); }
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pool = [];
    this.active = false;
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawn(x, y, count = 3, color = null) {
    for (let i = 0; i < count; i++) this.pool.push(new Particle(x, y, color));
    if (!this.active) this._run();
  }

  burst(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
      const p = new Particle(x, y, null);
      p.vx *= 2.5; p.vy *= 2.5; p.size *= 1.6;
      this.pool.push(p);
    }
    if (!this.active) this._run();
  }

  _run() {
    this.active = true;
    const step = () => {
      this.pool = this.pool.filter(p => p.life > 0);
      if (this.pool.length === 0) {
        this.active = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (const p of this.pool) { p.update(); p.draw(this.ctx); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  clear() {
    this.pool = [];
    this.active = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
