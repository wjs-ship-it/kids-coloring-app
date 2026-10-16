function assert(value, message) {
  if (!value) throw new Error(message);
}

function waitFor(predicate) {
  const deadline = performance.now() + 15000;
  return new Promise((resolve, reject) => {
    function frame() {
      if (predicate()) return resolve();
      if (performance.now() > deadline) return reject(new Error('Photo conversion timed out'));
      requestAnimationFrame(frame);
    }
    frame();
  });
}

// Run at the real home screen, through CDP. Exercises public DOM/canvas handlers.
export async function runPhotoConversionSmoke() {
  assert(document.querySelector('.screen.active')?.id === 'upload-screen', 'Start at photo upload');
  const started = window.__kidsAnalytics.events.length;
  document.getElementById('btn-demo').click();
  await waitFor(() => document.getElementById('preview-screen').classList.contains('active'));
  const conversion = window.__kidsAnalytics.events.slice(started).find(e => e.name === 'lineart_completed');
  assert(conversion?.fillRegions >= 3, 'Demo must contain selectable enclosed regions');
  assert(conversion.resolvedMode === 'illustration', 'Flat colored artwork must use color boundaries');
  document.getElementById('btn-begin').click();
  document.querySelector('[data-mode="color"]').click();
  await waitFor(() => document.getElementById('canvas-screen').classList.contains('active'));
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  const size = Math.min(400, canvas.width - 40, canvas.height - 160);
  const origin = { x: Math.floor((canvas.width-size)/2), y: Math.floor((canvas.height-size)/2) };
  const x = Math.floor(origin.x+size*.5), y = Math.floor(origin.y+size*.64);
  const outsideX = origin.x+4;
  const rect = canvas.getBoundingClientRect();
  function send(type, px, py = y) {
    const touch = new Touch({ identifier: 1, target: canvas, clientX: rect.left+px, clientY: rect.top+py });
    canvas.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
  }
  send('touchstart', x);
  for (let px = x; px >= outsideX; px -= 4) send('touchmove', px);
  send('touchend', outsideX);
  const body = [...ctx.getImageData(x, y, 1, 1).data];
  const outside = [...ctx.getImageData(outsideX, y, 1, 1).data];
  assert(body[0] === 239 && body[1] === 68 && body[2] === 68, 'Body must receive red brush paint');
  assert(outside.slice(0, 3).every(value => value === 255), 'Brush must not leak into the background');
  const otherColor = [...document.querySelectorAll('#side-palette .cdot')].find(node => !node.classList.contains('active'));
  assert(otherColor, 'A second brush color must be available');
  otherColor.click();
  send('touchstart', outsideX);
  for (let px = outsideX; px <= x; px += 4) send('touchmove', px);
  send('touchend', x);
  const paintedBackground = [...ctx.getImageData(outsideX, y, 1, 1).data];
  const preservedBody = [...ctx.getImageData(x, y, 1, 1).data];
  assert(paintedBackground.slice(0, 3).some(value => value !== 255), 'Background must accept brush paint');
  assert(preservedBody.every((value, index) => value === body[index]), 'Background stroke must not repaint the body');
  const marginY = Math.max(110, origin.y - 30);
  send('touchstart', 30, marginY);
  send('touchmove', 40, marginY);
  send('touchend', 40, marginY);
  const margin = [...ctx.getImageData(35, marginY, 1, 1).data];
  assert(margin.slice(0, 3).some(value => value !== 255), 'Paper outside the imported image must accept paint');
  return { width: canvas.width, fillRegions: conversion.fillRegions, runtimeMs: conversion.runtimeMs,
    body, outside, paintedBackground, preservedBody, margin, contained: true };
}
