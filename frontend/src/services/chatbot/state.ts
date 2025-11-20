export type ChatbotUIAction =
  | { type: 'openSiteSelector' }
  | { type: 'openContextMaps' }
  | { type: 'openQuantitativeData' }
  | { type: 'openConceptPlanner' }
  | { type: 'openAnalysisReport' };

export type SessionPhase =
  | 'onboarding.init'
  | 'onboarding.roleSelected'
  | 'onboarding.goalSelected'
  | 'analysis.pending'
  | 'analysis.complete'
  | 'concept.enabled'
  | 'recommending.nextActions';

export interface ChatbotSessionState {
  phase: SessionPhase;
  persona?: string; // PersonaKey, kept as string to avoid direct import cycle
  goals: string[];
  analysisId?: string;
  capabilities: {
    boundarySet: boolean;
    quantitativeReady: boolean;
    conceptReady: boolean;
  };
  lastSuggestedActions: string[];
}

export type ChatEvent =
  | { type: 'SELECT_ROLE'; persona: string }
  | { type: 'SELECT_GOAL'; goal: string }
  | { type: 'BOUNDARY_SET' }
  | { type: 'RUN_ANALYSIS' }
  | { type: 'ANALYSIS_STARTED'; analysisId: string }
  | { type: 'ANALYSIS_COMPLETE'; analysisId: string }
  | { type: 'ENABLE_CONCEPT' }
  | { type: 'SUGGEST_ACTIONS'; actions: string[] }
  | { type: 'RESET' };

export const initialSessionState: ChatbotSessionState = {
  phase: 'onboarding.init',
  goals: [],
  capabilities: {
    boundarySet: false,
    quantitativeReady: false,
    conceptReady: false,
  },
  lastSuggestedActions: [],
};

export function reduceSessionState(
  state: ChatbotSessionState,
  event: ChatEvent
): ChatbotSessionState {
  switch (event.type) {
    case 'SELECT_ROLE':
      return { ...state, phase: 'onboarding.roleSelected', persona: event.persona };
    case 'SELECT_GOAL':
      return {
        ...state,
        phase: 'onboarding.goalSelected',
        goals: [...state.goals, event.goal],
      };
    case 'BOUNDARY_SET':
      return { ...state, capabilities: { ...state.capabilities, boundarySet: true } };
    case 'RUN_ANALYSIS':
      return { ...state, phase: 'analysis.pending' };
    case 'ANALYSIS_STARTED':
      return { ...state, phase: 'analysis.pending', analysisId: event.analysisId };
    case 'ANALYSIS_COMPLETE':
      return {
        ...state,
        phase: 'analysis.complete',
        analysisId: event.analysisId,
        capabilities: { ...state.capabilities, quantitativeReady: true },
      };
    case 'ENABLE_CONCEPT':
      return {
        ...state,
        phase: 'concept.enabled',
        capabilities: { ...state.capabilities, conceptReady: true },
      };
    case 'SUGGEST_ACTIONS':
      return { ...state, phase: 'recommending.nextActions', lastSuggestedActions: event.actions };
    case 'RESET':
      return initialSessionState;
    default:
      return state;
  }
}
