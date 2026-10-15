import { GUIDED_TRACE_CONFIG as config } from './config.js';

export function buildGuidedParts(guide, width, height) {
  if (guide.version !== 1 || !Array.isArray(guide.steps) || !guide.steps.length) {
    throw new Error('Invalid guided drawing data');
  }
  return guide.steps.map((step, index) => {
    if (!step.points?.length || !step.points.every(point =>
      point.length === 2 && point.every(Number.isFinite)
      && point[0] >= 0 && point[0] <= guide.width
      && point[1] >= 0 && point[1] <= guide.height)) {
      throw new Error(`Invalid drawing path: ${index}`);
    }
    const boundaryPos = [];
    for (const [x, y] of step.points) {
      const px = Math.min(width - 1, Math.round(x / guide.width * width));
      const py = Math.min(height - 1, Math.round(y / guide.height * height));
      const pos = py * width + px;
      if (boundaryPos.at(-1) !== pos) boundaryPos.push(pos);
    }
    const closed = step.closed !== false;
    if (closed && boundaryPos[0] !== boundaryPos.at(-1)) boundaryPos.push(boundaryPos[0]);
    const samples = closed ? boundaryPos.slice(0, -1) : boundaryPos;
    const points = samples.map(pos => ({ x: pos % width, y: Math.floor(pos / width) }));
    if (points.length < 3 || points.some((point, i) =>
      (closed || i < points.length - 1) && Math.hypot(point.x - points[(i + 1) % points.length].x,
        point.y - points[(i + 1) % points.length].y) > config.continuityLimit)) {
      throw new Error(`Discontinuous drawing path: ${index}`);
    }
    return {
      boundaryPos, pixels: boundaryPos.slice(), samplePoints: samples.slice(),
      traceStrategy: 'guided', displayName: step.name,
      hint: `${step.name} 선을 따라 그려봐요!`, toleranceMultiplier: 1,
      guided: { points, closed, visited: new Uint8Array(points.length), index: null }
    };
  });
}

function route(points, from, to, direction) {
  const indices = [from];
  let length = 0;
  for (let index = from; index !== to;) {
    const next = (index + direction + points.length) % points.length;
    length += Math.hypot(points[index].x - points[next].x, points[index].y - points[next].y);
    indices.push(next);
    index = next;
  }
  return { indices, length };
}

function shortestRoute(points, from, to, closed) {
  if (!closed) return route(points, from, to, to >= from ? 1 : -1);
  const forward = route(points, from, to, 1);
  const backward = route(points, from, to, -1);
  return forward.length <= backward.length ? forward : backward;
}

export function startGuidedStroke(part, target) {
  const points = part.guided.points;
  let best = { distance: Infinity, index: 0 };
  for (let i = 0; i < points.length; i++) {
    const distance = Math.hypot(target.x - points[i].x, target.y - points[i].y);
    if (distance < best.distance) best = { distance, index: i };
  }
  if (best.distance > config.snapRadius) return null;
  part.guided.index = best.index;
  return points[best.index];
}

export function advanceGuidedStroke(part, target) {
  const state = part.guided;
  if (state.index === null) return [];
  const previous = state.points[state.index];
  const movement = Math.hypot(target.x - previous.x, target.y - previous.y);
  const maxArc = Math.max(config.minArcAdvance, Math.min(config.maxArcAdvance,
    movement * config.movementMultiplier + config.movementAllowance));
  let best = null;
  for (let i = 0; i < state.points.length; i++) {
    const point = state.points[i];
    const distance = Math.hypot(target.x - point.x, target.y - point.y);
    if (distance > config.snapRadius || (best && distance >= best.distance)) continue;
    const walk = shortestRoute(state.points, state.index, i, state.closed);
    if (walk.length <= maxArc) best = { distance, index: i, walk };
  }
  if (!best || best.index === state.index) return [];
  for (const index of best.walk.indices) state.visited[index] = 1;
  state.index = best.index;
  return best.walk.indices.map(index => state.points[index]);
}

export function getGuidedProgress(part) {
  const state = part.guided;
  return state.visited.reduce((sum, value) => sum + value, 0) / state.visited.length;
}

export function guidedStepComplete(part) {
  return getGuidedProgress(part) >= config.completionThreshold;
}
