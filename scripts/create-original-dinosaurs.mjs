// Original artwork: SVG and tracing points share this source of truth.
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../assets/original-dinosaurs/', import.meta.url);
const ellipse = (x, y, rx, ry) => `M ${x-rx} ${y} C ${x-rx} ${y-ry*1.34} ${x+rx} ${y-ry*1.34} ${x+rx} ${y} C ${x+rx} ${y+ry*1.34} ${x-rx} ${y+ry*1.34} ${x-rx} ${y} Z`;
const drawings = [
  {
    id: 'trex', name: '티라노',
    steps: [
      ['몸통과 꼬리', 'M 310 280 C 250 275 245 345 200 370 C 150 390 100 365 70 345 C 105 415 185 440 245 410 C 325 440 395 390 390 320 C 385 280 345 270 310 280 Z'],
      ['왼쪽 다리', 'M 270 375 C 240 380 240 420 245 450 L 215 470 C 210 485 225 490 245 490 L 295 490 C 310 480 310 465 295 455 L 305 405 C 305 385 290 375 270 375 Z'],
      ['오른쪽 다리', 'M 350 365 C 320 370 315 405 325 440 L 310 470 C 305 485 320 490 340 490 L 390 490 C 410 480 400 465 380 460 L 380 405 C 380 380 370 370 350 365 Z'],
      ['머리', 'M 325 185 C 345 135 405 125 455 150 C 480 160 475 185 500 190 C 540 195 550 220 535 250 C 525 280 465 290 420 275 L 390 320 C 365 335 335 305 345 280 C 310 260 305 220 325 185 Z'],
      ['작은 팔', 'M 365 320 C 380 310 395 325 395 340 L 425 345 C 440 350 435 370 420 370 L 380 365 C 365 360 360 340 365 320 Z'],
      ['배 무늬', ellipse(335, 370, 22, 30)],
      ['볼 무늬', ellipse(475, 247, 15, 10)]
    ],
    face: '<circle cx="425" cy="198" r="9" fill="#30343b"/><path d="M 469 226 C 493 240 516 233 526 222" fill="none"/>'
  },
  {
    id: 'triceratops', name: '트리케라톱스',
    steps: [
      ['몸통과 꼬리', 'M 290 265 C 220 245 165 290 160 340 L 75 330 C 100 370 125 385 170 385 C 215 430 325 425 375 375 C 415 330 365 270 290 265 Z'],
      ['뒤쪽 다리', 'M 195 365 C 180 370 180 405 180 440 C 180 465 220 465 225 440 L 230 385 C 230 365 210 355 195 365 Z'],
      ['앞쪽 다리', 'M 300 365 C 280 375 285 405 285 445 C 285 470 330 470 330 445 L 335 385 C 335 365 315 355 300 365 Z'],
      ['넓은 목 장식', 'M 360 220 L 375 185 L 410 198 L 435 175 L 460 200 L 495 195 L 505 230 L 530 250 L 512 280 L 520 310 L 490 330 C 440 365 380 340 350 300 L 335 265 L 360 250 Z'],
      ['얼굴', 'M 405 260 C 440 240 475 270 480 300 C 490 325 530 320 530 350 C 530 390 465 405 420 385 C 380 365 370 300 405 260 Z'],
      ['위쪽 뿔', 'M 425 270 C 420 245 425 220 435 210 C 440 240 450 255 450 275 C 440 285 430 283 425 270 Z'],
      ['옆쪽 뿔', 'M 472 285 C 480 255 490 240 500 235 C 500 265 500 285 490 300 C 480 300 475 295 472 285 Z'],
      ['코의 뿔', 'M 510 337 L 540 310 C 545 330 540 350 530 360 Z'],
      ['몸의 무늬', ellipse(265, 310, 25, 18)]
    ],
    face: '<circle cx="435" cy="315" r="9" fill="#30343b"/><path d="M 469 367 C 482 376 500 375 510 367" fill="none"/>'
  },
  {
    id: 'stegosaurus', name: '스테고사우루스',
    steps: [
      ['꼬리', 'M 205 325 C 150 315 100 295 60 270 C 80 335 130 375 205 375 C 230 365 230 340 205 325 Z'],
      ['몸통', 'M 165 335 C 165 260 245 235 330 255 C 390 270 425 315 420 365 C 400 410 220 425 180 380 C 170 365 165 350 165 335 Z'],
      ['뒤쪽 다리', 'M 215 370 C 195 370 195 415 195 445 C 195 470 235 470 240 445 L 245 390 C 245 375 230 365 215 370 Z'],
      ['앞쪽 다리', 'M 350 370 C 330 375 330 420 330 450 C 330 475 375 475 375 450 L 380 395 C 380 375 365 365 350 370 Z'],
      ['머리', 'M 420 325 C 450 305 480 320 490 340 C 520 335 545 350 540 375 C 535 405 485 415 455 400 L 415 380 C 400 365 400 340 420 325 Z'],
      ['등판 1', 'M 180 290 L 160 245 L 185 215 L 215 245 L 210 275 Z'],
      ['등판 2', 'M 225 260 L 220 205 L 255 175 L 285 210 L 275 253 Z'],
      ['등판 3', 'M 295 255 L 305 200 L 345 185 L 365 230 L 345 270 Z'],
      ['등판 4', 'M 365 280 L 390 235 L 425 240 L 435 280 L 400 315 Z']
    ],
    face: '<circle cx="472" cy="356" r="8" fill="#30343b"/><path d="M 495 385 C 507 391 521 386 525 380" fill="none"/>'
  }
];

function samplePath(path) {
  const tokens = path.match(/[MCLZ]|-?\d+(?:\.\d+)?/g);
  let cursor = 0, current, start;
  const points = [];
  const pair = () => [Number(tokens[cursor++]), Number(tokens[cursor++])];
  function append(target, controls) {
    const from = current;
    const polygon = [from, ...(controls || []), target];
    const length = polygon.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0]-polygon[i][0], p[1]-polygon[i][1]), 0);
    const count = Math.ceil(length / 2);
    for (let i = 1; i <= count; i++) {
      const t = i/count, u = 1-t;
      const p = controls ? [0, 1].map(axis => u*u*u*from[axis] + 3*u*u*t*controls[0][axis] + 3*u*t*t*controls[1][axis] + t*t*t*target[axis])
        : [from[0]+t*(target[0]-from[0]), from[1]+t*(target[1]-from[1])];
      points.push(p.map(n => Number(n.toFixed(2))));
    }
    current = target;
  }
  while (cursor < tokens.length) {
    const command = tokens[cursor++];
    if (command === 'M') { current = pair(); start = current; points.push(current); }
    else if (command === 'L') append(pair());
    else if (command === 'C') { const a = pair(), b = pair(); append(pair(), [a, b]); }
    else if (command === 'Z') append(start);
    else throw new Error(`Unsupported SVG command ${command}`);
  }
  return points;
}

try {
  await mkdir(output, { recursive: true });
  for (const drawing of drawings) {
    const guide = { version: 1, width: 600, height: 600, source: 'Original artwork authored for Kids Coloring',
      steps: drawing.steps.map(([name, path]) => ({ name, points: samplePath(path) })) };
    const paths = drawing.steps.map(([, path]) => `<path d="${path}"/>`).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><title>${drawing.name}</title><rect width="600" height="600" fill="white"/><g fill="white" stroke="#30343b" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${paths}${drawing.face}</g></svg>\n`;
    await writeFile(new URL(`${drawing.id}.svg`, output), svg);
    await writeFile(new URL(`${drawing.id}.json`, output), JSON.stringify(guide));
    console.log(`${drawing.id}: ${guide.steps.length} authored steps`);
  }
} catch (error) {
  console.error('Original dinosaur generation failed:', error);
  process.exitCode = 1;
}
