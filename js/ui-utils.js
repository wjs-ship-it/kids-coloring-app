export function celebrate() {
  const el = document.getElementById('stars-celebration');
  el.innerHTML = ''; el.classList.add('active');
  const emojis = ['⭐', '🌟', '✨', '🎉', '🎨', '💫'];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'star-particle';
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.left = (Math.random() * 100) + '%';
    s.style.top = '-5%';
    s.style.animationDelay = (Math.random() * 0.8) + 's';
    s.style.fontSize = (24 + Math.random() * 24) + 'px';
    el.appendChild(s);
  }
  setTimeout(() => el.classList.remove('active'), 2500);
}

export function updateProgress(pct) {
  document.getElementById('progress-fill').style.width = Math.min(pct * 100, 100) + '%';
}

export function showHint(t) {
  const h = document.getElementById('hint-toast');
  h.textContent = t; h.style.display = 'block'; h.style.opacity = '1';
}

export function showPartDone(msg) {
  document.getElementById('part-done-msg').textContent = msg;
  document.getElementById('part-done-overlay').classList.add('active');
}

export function hidePartDone() {
  document.getElementById('part-done-overlay').classList.remove('active');
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

export function setLoadingText(text) {
  document.getElementById('loading-text').textContent = text;
}
