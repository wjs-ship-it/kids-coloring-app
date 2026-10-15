import { runFullPipeline, detectParts, buildFillRegions } from './edge-detect.js?v=photo-conversion-2';

self.onmessage = function(e) {
  const { imageData, w, h, mode, detail, task } = e.data;

  if (task === 'detect-parts') {
    self.postMessage({ type: 'progress', step: 'parts', message: '따라 그릴 길을 준비하는 중... ✏️' });
    const parts = detectParts(imageData, w, h, {
      mode: mode || 'object',
      detail: detail ?? 50
    });
    self.postMessage({ type: 'progress', step: 'done', message: '거의 다 됐어요! 🎨' });
    self.postMessage({
      type: 'parts-result',
      parts,
      w,
      h
    });
    return;
  }

  if (task === 'build-fill-regions') {
    self.postMessage({ type: 'progress', step: 'fill', message: '색칠 영역을 준비하는 중... 🎨' });
    const fillRegions = buildFillRegions(imageData, w, h);
    self.postMessage({ type: 'progress', step: 'done', message: '거의 다 됐어요! 🎨' });
    self.postMessage({
      type: 'fill-regions-result',
      fillRegions,
      w,
      h
    });
    return;
  }

  self.postMessage({ type: 'progress', step: 'edge', message: '선을 그리는 중... ✏️' });

  const { lineartData, parts, fillRegions } = runFullPipeline(imageData, w, h, mode || 'object', detail ?? 50);

  self.postMessage({ type: 'progress', step: 'done', message: '거의 다 됐어요! 🎨' });

  self.postMessage({
    type: 'result',
    lineartData: lineartData,
    parts: parts,
    fillRegions,
    w, h
  });
};
