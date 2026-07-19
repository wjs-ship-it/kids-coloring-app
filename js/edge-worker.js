import { runFullPipeline } from './edge-detect.js';

self.onmessage = function(e) {
  const { imageData, w, h, mode, detail } = e.data;

  self.postMessage({ type: 'progress', step: 'edge', message: '선을 그리는 중... ✏️' });

  const { lineartData, parts } = runFullPipeline(imageData, w, h, mode || 'object', detail ?? 50);

  self.postMessage({ type: 'progress', step: 'done', message: '거의 다 됐어요! 🎨' });

  self.postMessage({
    type: 'result',
    lineartData: lineartData,
    parts: parts,
    w, h
  });
};
