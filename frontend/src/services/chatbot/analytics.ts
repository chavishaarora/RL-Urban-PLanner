export type AnalyticsEventName =
  | 'roleSelected'
  | 'goalSelected'
  | 'toolInvoked'
  | 'toolCompleted'
  | 'toolFailed'
  | 'stepCompleted'
  | 'chatAbandoned';

export function logEvent(name: AnalyticsEventName, props?: Record<string, unknown>) {
  try {
    window.dispatchEvent(new CustomEvent('ue-analytics', { detail: { name, props, ts: Date.now() } }));
  } catch {
    // noop in SSR or restricted environments
  }
}
