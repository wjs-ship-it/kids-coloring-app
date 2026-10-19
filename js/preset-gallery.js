import { PRESETS, renderPreset } from './presets.js';
import { FAMILY_CONTENT_PACK } from './packs/family-content.js?v=writing-1';

export async function renderContentPreset(item, canvas, ctx) {
  const size = FAMILY_CONTENT_PACK.canvasSize;
  const image = new Image();
  image.src = item.src;
  await image.decode();
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  let guide = null;
  if (item.traceSrc) {
    const response = await fetch(item.traceSrc);
    if (!response.ok) throw new Error(`Drawing guide unavailable: ${response.status}`);
    guide = await response.json();
  }
  return { lineartData: ctx.getImageData(0, 0, size, size), size, guide };
}

function getStarterItems(pack) {
  return pack.items.map(item => {
    const preset = PRESETS[item.presetIndex];
    const canvas = document.createElement('canvas');
    renderPreset(preset, canvas, canvas.getContext('2d'));
    return { ...item, category: 'starter', src: canvas.toDataURL() };
  });
}

export function mountPresetGallery(pack, onSelect) {
  const grid = document.getElementById('preset-grid');
  const filters = document.getElementById('preset-filters');
  const status = document.getElementById('preset-status');
  const items = [...FAMILY_CONTENT_PACK.items, ...getStarterItems(pack)];
  const categories = [
    { id: 'all', title: '모두' },
    { id: 'guided', title: '따라그리기' },
    ...FAMILY_CONTENT_PACK.categories,
    { id: 'starter', title: '기본 그림' }
  ];
  let selected = 'all';
  let loading = false;

  async function selectItem(item) {
    if (loading) return;
    loading = true;
    grid.setAttribute('aria-busy', 'true');
    status.textContent = `${item.name} 그림을 준비하고 있어요`;
    grid.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await onSelect(item);
      status.textContent = `${items.length}개의 그림이 있어요`;
    } catch (error) {
      console.error('그림을 불러오지 못했습니다.', item.id, error);
      status.textContent = '그림을 불러오지 못했어요. 다시 눌러 주세요.';
    } finally {
      loading = false;
      grid.setAttribute('aria-busy', 'false');
      grid.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }

  function renderItems() {
    const visible = items.filter(item => selected === 'all'
      || (selected === 'guided' ? Boolean(item.traceSrc) : item.category === selected));
    grid.replaceChildren();
    status.textContent = `${visible.length}개의 그림이 있어요`;
    for (const item of visible) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'preset-card';
      card.dataset.contentId = item.id;
      card.dataset.guided = String(Boolean(item.traceSrc));
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 160;
      image.height = 160;
      const label = document.createElement('span');
      label.className = 'preset-name';
      label.textContent = item.name;
      const activity = document.createElement('small');
      activity.className = 'preset-activity';
      activity.textContent = item.traceSrc ? '따라그리기 · 색칠하기' : '색칠하기';
      card.append(image, label, activity);
      card.addEventListener('click', () => selectItem(item));
      grid.append(card);
    }
  }

  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-filter';
    button.textContent = category.title;
    button.setAttribute('aria-pressed', String(selected === category.id));
    button.addEventListener('click', () => {
      if (loading) return;
      selected = category.id;
      filters.querySelectorAll('button').forEach(filter => {
        filter.setAttribute('aria-pressed', String(filter === button));
      });
      renderItems();
      grid.scrollLeft = 0;
      document.getElementById('preset-screen').scrollTop = 0;
    });
    filters.append(button);
  }
  renderItems();
}
