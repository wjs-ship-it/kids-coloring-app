function assert(value, message) {
  if (!value) throw new Error(message);
}

async function until(predicate, description) {
  const end = performance.now() + 15000;
  await new Promise((resolve, reject) => {
    function check() {
      if (predicate()) return resolve();
      if (performance.now() > end) return reject(new Error(description));
      requestAnimationFrame(check);
    }
    check();
  });
}

// Run on the real upload screen. Select every rendered gallery card by stable ID.
export async function runGalleryBackgroundSmoke() {
  document.getElementById('btn-presets').click();
  const ids = [...document.querySelectorAll('.preset-card')].map(card => card.dataset.contentId);
  assert(ids.length >= 141, 'Full gallery must be available');
  const results = [];
  for (const id of ids) {
    await until(() => document.getElementById('preset-grid').getAttribute('aria-busy') !== 'true', 'Gallery busy');
    const card = [...document.querySelectorAll('.preset-card')].find(node => node.dataset.contentId === id);
    assert(card, `Missing card: ${id}`);
    const name = card.querySelector('.preset-name').textContent;
    card.click();
    await until(() => document.getElementById('preset-grid').getAttribute('aria-busy') !== 'true', `Load ${id}`);
    await until(() => ['mode-screen', 'canvas-screen'].includes(document.querySelector('.screen.active')?.id), `Open ${id}`);
    if (document.querySelector('.screen.active').id === 'mode-screen') {
      document.querySelector('[data-mode="color"]').click();
    }
    await until(() => document.querySelector('.screen.active')?.id === 'canvas-screen', `Color ${id}`);
    await until(() => !document.getElementById('side-palette').classList.contains('hidden'), `Color tools ${id}`);
    const canvas = document.getElementById('drawing-canvas');
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    // Above the centered 350px artwork, below the controls.
    const y = 170;
    for (const [type, x] of [['touchstart', 30], ['touchmove', 40], ['touchend', 40]]) {
      const touch = new Touch({ identifier: 1, target: canvas, clientX: rect.left + x, clientY: rect.top + y });
      canvas.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
    }
    const pixel = [...ctx.getImageData(35, y, 1, 1).data];
    assert(pixel[0] === 239 && pixel[1] === 68 && pixel[2] === 68, `Unpaintable margin: ${id}`);
    results.push({ id, name, marginPainted: true });
    window.__galleryBackgroundResults = results;
    document.getElementById('btn-back').click();
    document.getElementById('btn-presets').click();
  }
  return { total: ids.length, passed: results.length, results };
}
