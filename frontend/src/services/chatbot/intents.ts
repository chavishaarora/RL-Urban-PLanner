export type IntentName =
  | 'navigateToAnalysis'
  | 'navigateToContextMaps'
  | 'navigateToQuantitative'
  | 'navigateToConceptPlanner'
  | 'helpBoundary'
  | 'helpGeneral'
  | 'unknown';

export interface DetectedIntent {
  intent: IntentName;
  params?: Record<string, unknown>;
}

const patterns: Array<{ intent: IntentName; regex: RegExp; pick?: (m: RegExpMatchArray) => any }> = [
  { intent: 'navigateToAnalysis', regex: /(go to|open|show|start).*(analysis|draw|boundary|site)/i },
  { intent: 'navigateToContextMaps', regex: /(go to|open|show|view).*(context|maps?|layers)/i },
  { intent: 'navigateToQuantitative', regex: /(go to|open|show|view).*(quantitative|metrics|kpi|data|stats)/i },
  { intent: 'navigateToConceptPlanner', regex: /(go to|open|show|start).*(concept|planner|design|3d|2d)/i },
  { intent: 'helpBoundary', regex: /(help|how).*(draw|boundary|site|polygon)/i },
  { intent: 'helpGeneral', regex: /(help|what can|how do)/i },
];

export function detectIntent(input: string): DetectedIntent {
  for (const p of patterns) {
    const m = input.match(p.regex);
    if (m) {
      return { intent: p.intent, params: p.pick ? p.pick(m) : undefined };
    }
  }
  return { intent: 'unknown' };
}
