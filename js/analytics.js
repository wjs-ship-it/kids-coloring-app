const MAX_EVENTS = 250;

const analyticsState = {
  context: {
    selectedMode: 'object',
    resolvedMode: 'object',
    detail: 50
  },
  events: []
};

function buildSessionPayload() {
  return {
    exportedAt: new Date().toISOString(),
    context: { ...analyticsState.context },
    events: analyticsState.events.slice()
  };
}

function publishAnalyticsState() {
  window.__kidsAnalytics = {
    context: { ...analyticsState.context },
    events: analyticsState.events.slice(),
    clear: clearAnalyticsEvents,
    snapshot: getAnalyticsSnapshot,
    exportJson: exportAnalyticsSession
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
  return buildSessionPayload();
}

export function exportAnalyticsSession(filename = null) {
  const payload = buildSessionPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `kids-analytics-session-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  trackEvent('analytics_session_exported', {
    eventCount: payload.events.length
  });
  return payload;
}

publishAnalyticsState();
