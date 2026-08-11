const MAX_EVENTS = 250;

const analyticsState = {
  context: {
    selectedMode: 'object',
    resolvedMode: 'object',
    detail: 50
  },
  events: []
};

function publishAnalyticsState() {
  window.__kidsAnalytics = {
    context: { ...analyticsState.context },
    events: analyticsState.events.slice(),
    clear: clearAnalyticsEvents,
    snapshot: getAnalyticsSnapshot
  };
}

export function setAnalyticsContext(patch = {}) {
  analyticsState.context = {
    ...analyticsState.context,
    ...patch
  };
  publishAnalyticsState();
}

export function trackEvent(name, payload = {}) {
  const entry = {
    name,
    ts: Date.now(),
    ...analyticsState.context,
    ...payload
  };
  analyticsState.events.push(entry);
  if (analyticsState.events.length > MAX_EVENTS) analyticsState.events.shift();
  publishAnalyticsState();
  console.log('[kids-analytics]', entry);
  return entry;
}

export function clearAnalyticsEvents() {
  analyticsState.events.length = 0;
  publishAnalyticsState();
}

export function getAnalyticsSnapshot() {
  return {
    context: { ...analyticsState.context },
    events: analyticsState.events.slice()
  };
}

publishAnalyticsState();
