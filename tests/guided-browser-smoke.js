import { buildGuidedParts } from '../js/guided-trace.js?v=recovered-guides-1';

function assert(value, message) {
  if (!value) throw new Error(message);
}

function until(predicate, description) {
  const deadline = performance.now() + 5000;
  return new Promise((resolve, reject) => {
    function frame() {
      if (predicate()) return resolve();
      if (performance.now() > deadline) return reject(new Error(`Timed out: ${description}`));
      requestAnimationFrame(frame);
    }
    frame();
  });
}

// Invoke through the existing CDP browser after opening the guided dinosaur.
// Uses actual canvas mouse/touch handlers; it never calls app implementation functions.
export async function runGuidedBrowserSmoke({ touch = false, guidePath = '../assets/family-content/diplodocus-guided-v1.json' } = {}) {
  const response = await fetch(new URL(guidePath, import.meta.url));
  assert(response.ok, `Guide load failed: ${response.status}`);
  const guide = await response.json();
  const canvas = document.getElementById('drawing-canvas');
  assert(document.getElementById('part-label').textContent.startsWith(`1/${guide.steps.length}`), 'Start at guided step one');
  const size = Math.min(guide.width, canvas.width - 40, canvas.height - 160);
  const parts = buildGuidedParts(guide, size, size);
  const offset = { x: Math.floor((canvas.width - size) / 2), y: Math.floor((canvas.height - size) / 2) };
  const rect = canvas.getBoundingClientRect();
  const metrics = [];
  function send(type, point) {
    const clientX = point.x + offset.x + rect.left;
    const clientY = point.y + offset.y + rect.top;
    if (touch) {
      const eventTouch = new Touch({ identifier: 1, target: canvas, clientX, clientY });
      canvas.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [eventTouch], changedTouches: [eventTouch] }));
    } else {
      canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, buttons: type === 'mouseup' ? 0 : 1 }));
    }
  }
  for (let step = 0; step < parts.length; step++) {
    const points = parts[step].guided.points;
    await until(() => !document.getElementById('part-done-overlay').classList.contains('active')
      && document.getElementById('part-label').textContent.startsWith(`${step + 1}/${guide.steps.length}`), `step ${step + 1}`);
    send(touch ? 'touchstart' : 'mousedown', points[0]);
    // Events are deliberately sparse; the old 18px discard logic left holes here.
    for (let i = 18; i < points.length; i += 18) send(touch ? 'touchmove' : 'mousemove', points[i]);
    send(touch ? 'touchmove' : 'mousemove', points.at(-1));
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (const point of points) {
      let found = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = point.x + offset.x + dx, y = point.y + offset.y + dy;
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height && pixels[(y * canvas.width + x) * 4] < 80) found = true;
      }
      if (found) painted++;
    }
    const coverage = painted / points.length;
    assert(coverage >= 0.94, `Step ${step + 1} has gaps: ${coverage}`);
    metrics.push({ step: step + 1, name: parts[step].displayName, coverage });
    send(touch ? 'touchend' : 'mouseup', points.at(-1));
  }
  await until(() => window.__kidsAnalytics.events.some(event => event.name === 'trace_completed'), 'trace completion');
  await until(() => window.__kidsAnalytics.events.some(event => event.name === 'color_started'), 'color transition');
  return { input: touch ? 'touch' : 'mouse', width: canvas.width, steps: metrics, completed: true };
}

export async function runGuidedUndoSmoke() {
  const response = await fetch(new URL('../assets/family-content/diplodocus-guided-v1.json', import.meta.url));
  assert(response.ok, 'Guide must load');
  const guide = await response.json();
  const canvas = document.getElementById('drawing-canvas');
  const size = Math.min(600, canvas.width - 40, canvas.height - 160);
  const points = buildGuidedParts(guide, size, size)[0].guided.points;
  const offsetX = Math.floor((canvas.width - size) / 2);
  const offsetY = Math.floor((canvas.height - size) / 2);
  function send(type, index) {
    canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
      clientX: points[index].x + offsetX, clientY: points[index].y + offsetY,
      buttons: type === 'mouseup' ? 0 : 1 }));
  }
  send('mousedown', 0);
  send('mousemove', 18);
  send('mousemove', 36);
  send('mouseup', 36);
  const before = parseFloat(document.getElementById('progress-fill').style.width);
  assert(before > 0 && before < 90, `Expected partial progress, got ${before}`);
  document.getElementById('btn-undo').click();
  const after = parseFloat(document.getElementById('progress-fill').style.width);
  assert(after === 0, `Undo left stale progress ${after}`);
  return { before, after, label: document.getElementById('part-label').textContent };
}
