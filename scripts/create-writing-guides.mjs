// Original manuscript glyphs: displayed outlines and centerline guides share paths.
import { mkdir, writeFile } from 'node:fs/promises';

const glyphs = {
  A: ['M 300 120 L 170 480', 'M 300 120 L 430 480', 'M 220 350 L 380 350'],
  B: ['M 180 120 L 180 480', 'M 180 120 L 300 120 C 460 120 460 290 300 290 L 180 290', 'M 180 290 L 310 290 C 480 290 480 480 310 480 L 180 480'],
  C: ['M 440 175 C 350 70 160 110 160 300 C 160 490 350 530 440 425'],
  D: ['M 180 120 L 180 480', 'M 180 120 L 260 120 C 510 120 510 480 260 480 L 180 480'],
  E: ['M 190 120 L 190 480', 'M 190 120 L 430 120', 'M 190 300 L 390 300', 'M 190 480 L 430 480'],
  F: ['M 190 120 L 190 480', 'M 190 120 L 430 120', 'M 190 300 L 390 300'],
  G: ['M 440 175 C 350 70 160 110 160 300 C 160 490 350 530 440 425 L 440 320 L 320 320'],
  H: ['M 180 120 L 180 480', 'M 420 120 L 420 480', 'M 180 300 L 420 300'],
  I: ['M 300 120 L 300 480', 'M 190 120 L 410 120', 'M 190 480 L 410 480'],
  J: ['M 420 120 L 420 370 C 420 530 180 530 180 390', 'M 280 120 L 470 120'],
  K: ['M 180 120 L 180 480', 'M 430 120 L 180 320', 'M 290 230 L 440 480'],
  L: ['M 190 120 L 190 480 L 430 480'],
  M: ['M 150 120 L 150 480', 'M 150 120 L 300 340', 'M 450 120 L 300 340', 'M 450 120 L 450 480'],
  N: ['M 180 120 L 180 480', 'M 180 120 L 420 480', 'M 420 120 L 420 480'],
  O: ['M 300 120 C 110 120 110 480 300 480 C 490 480 490 120 300 120'],
  P: ['M 180 120 L 180 480', 'M 180 120 L 310 120 C 480 120 480 310 310 310 L 180 310'],
  Q: ['M 300 120 C 110 120 110 480 300 480 C 490 480 490 120 300 120', 'M 330 380 L 460 510'],
  R: ['M 180 120 L 180 480', 'M 180 120 L 310 120 C 480 120 480 300 310 300 L 180 300', 'M 300 300 L 440 480'],
  S: ['M 430 170 C 350 65 170 100 170 210 C 170 320 430 280 430 395 C 430 510 240 540 160 435'],
  T: ['M 150 120 L 450 120', 'M 300 120 L 300 480'],
  U: ['M 180 120 L 180 370 C 180 520 420 520 420 370 L 420 120'],
  V: ['M 160 120 L 300 480 L 440 120'],
  W: ['M 110 120 L 205 480 L 300 260 L 395 480 L 490 120'],
  X: ['M 170 120 L 430 480', 'M 430 120 L 170 480'],
  Y: ['M 170 120 L 300 300', 'M 430 120 L 300 300 L 300 480'],
  Z: ['M 170 120 L 430 120 L 170 480 L 430 480'],
  0: ['M 300 120 C 130 120 130 480 300 480 C 470 480 470 120 300 120'],
  1: ['M 240 180 L 300 120 L 300 480'],
  2: ['M 180 210 C 180 70 430 70 430 210 C 430 290 300 340 170 480 L 440 480'],
  3: ['M 180 160 C 360 40 510 260 300 290 C 520 290 460 560 180 450'],
  4: ['M 350 120 L 160 350 L 450 350', 'M 350 120 L 350 480'],
  5: ['M 420 120 L 200 120 L 180 290 C 400 210 500 390 390 470 C 310 530 210 480 170 440'],
  6: ['M 400 130 C 180 130 100 470 280 480 C 470 500 470 270 290 280 C 160 280 160 450 260 480'],
  7: ['M 160 120 L 440 120 L 240 480'],
  8: ['M 300 120 C 130 120 160 260 300 300 C 480 350 470 480 300 480 C 130 480 120 350 300 300 C 440 260 470 120 300 120'],
  9: ['M 410 270 C 410 70 160 70 160 240 C 160 390 410 390 410 240 C 440 410 340 480 200 480']
};

function sample(path) {
  const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g);
  let i = 0, current;
  const points = [];
  const pair = () => [Number(tokens[i++]), Number(tokens[i++])];
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') { current = pair(); points.push(current); continue; }
    const a = pair(), b = command === 'C' ? pair() : null, end = b ? pair() : a;
    const length = b ? Math.hypot(a[0]-current[0],a[1]-current[1]) + Math.hypot(b[0]-a[0],b[1]-a[1]) + Math.hypot(end[0]-b[0],end[1]-b[1]) : Math.hypot(end[0]-current[0],end[1]-current[1]);
    const n = Math.ceil(length / 2);
    for (let j = 1; j <= n; j++) {
      const t = j/n, u = 1-t;
      points.push([0,1].map(k => Number((b ? u*u*u*current[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t*t*t*end[k] : current[k]+t*(end[k]-current[k])).toFixed(2))));
    }
    current = end;
  }
  return points;
}

try {
  const out = new URL('../assets/writing-guides/', import.meta.url);
  await mkdir(out, { recursive: true });
  const entries = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...Array.from({length:11}, (_, i) => String(i))];
  for (const character of entries) {
    const category = /^[A-Z]$/.test(character) ? 'letters' : 'numbers';
    const paths = character === '10' ? [...glyphs[1], ...glyphs[0]] : glyphs[character];
    let steps = paths.map((path, index) => {
      let points = sample(path);
      if (character === '10') points = points.map(([x,y]) => [x*0.55+(index===0?0:280),y]);
      return { name: `${character} · ${index+1}획`, closed: false, points };
    });
    const guide = {version:1,width:600,height:600,source:'Original manuscript writing guides',directional:true,character,category,steps};
    const strokes = steps.map(s => `<path d="M ${s.points.map(p=>p.join(' ')).join(' L ')}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><title>${character} 쓰기</title><rect width="600" height="600" fill="white"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#30343b" stroke-width="38">${strokes}</g><g stroke="white" stroke-width="30">${strokes}</g></g></svg>`;
    await writeFile(new URL(`${character}.svg`,out),svg);
    await writeFile(new URL(`${character}.json`,out),JSON.stringify(guide));
  }
  console.log(`Generated ${entries.length} manuscript guides`);
} catch (error) {
  console.error('Writing guide generation failed:',error);
  process.exitCode=1;
}
