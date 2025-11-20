import { PersonaKey, PERSONAS } from './personas';

export interface ChecklistItem {
  id: string;
  label: string;
  action?: string; // Optional action to trigger when clicked
  completed?: boolean;
}

export interface ChatStep {
  id: string;
  message: string;
  buttons?: { label: string; action: string }[];
  checklist?: ChecklistItem[];
  autoAdvance?: boolean;
}

export function getIntroStep(): ChatStep {
  return {
    id: 'intro',
    message:
      "Hi, I'm UrbanBuddy. I can take you from raw site to a data‑backed 2D/3D concept. First—who best describes you?",
    buttons: Object.values(PERSONAS).map(p => ({ label: p.label, action: `selectRole:${p.key}` })),
  };
}

export function getGoalSelectionStep(persona: PersonaKey): ChatStep {
  const p = PERSONAS[persona];
  return {
    id: 'goalSelection',
    message: `Great—${p.label}. What do you want to do first?`,
    buttons: p.defaultGoals.map(g => ({ label: g, action: `selectGoal:${g}` })),
  };
}

export function getSiteAnalysisChecklist(persona: PersonaKey): ChatStep {
  return {
    id: 'siteAnalysisChecklist',
    message: 'Site Analysis Workflow\n\nFollow these steps to complete your site analysis. Click each item to navigate:',
    checklist: [
      { id: 'step1', label: 'Demarcate the site boundary', action: 'navigateToAnalysis', completed: false },
      { id: 'step2', label: 'Tap on "Analyze Site" button', action: 'navigateToAnalysis', completed: false },
      { id: 'step3', label: 'Check the context maps (8 layers)', action: 'navigateToContextMaps', completed: false },
      { id: 'step4', label: 'Review the analysis report', action: 'navigateToAnalysis', completed: false },
      { id: 'step5', label: 'Check quantitative site analysis report', action: 'navigateToQuantitative', completed: false },
      { id: 'step6', label: 'Start concept planning', action: 'navigateToConceptPlanner', completed: false },
      { id: 'step7', label: '3D block model simulation', action: 'navigateToConceptPlanner', completed: false },
      { id: 'step8', label: 'Save the project', action: 'saveProject', completed: false },
    ],
  };
}

export function getConceptPlanningChecklist(): ChatStep {
  return {
    id: 'conceptPlanningChecklist',
    message: 'Concept Planning Workflow\n\nFollow these steps to create your design concept:',
    checklist: [
      { id: 'cp1', label: 'Open the concept planner', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp2', label: 'Select a design template', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp3', label: 'Configure building parameters', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp4', label: 'View 2D layout', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp5', label: 'Generate 3D block model', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp6', label: 'Review environmental metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'cp7', label: 'Export 3D model (GLTF/DXF)', action: 'navigateToConceptPlanner', completed: false },
      { id: 'cp8', label: 'Save the project', action: 'saveProject', completed: false },
    ],
  };
}

export function getEnvironmentalMetricsChecklist(): ChatStep {
  return {
    id: 'environmentalMetricsChecklist',
    message: 'Environmental Analysis Workflow\n\nFollow these steps to analyze environmental factors:',
    checklist: [
      { id: 'em1', label: 'Run site analysis first', action: 'navigateToAnalysis', completed: false },
      { id: 'em2', label: 'Check microclimate data', action: 'navigateToContextMaps', completed: false },
      { id: 'em3', label: 'Review wind rose analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'em4', label: 'Check solar exposure maps', action: 'navigateToContextMaps', completed: false },
      { id: 'em5', label: 'Review environmental KPIs', action: 'navigateToQuantitative', completed: false },
      { id: 'em6', label: 'Check sustainability metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'em7', label: 'Export environmental report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getAccessibilityMobilityChecklist(): ChatStep {
  return {
    id: 'accessibilityMobilityChecklist',
    message: 'Accessibility & Mobility Workflow\n\nFollow these steps to analyze site accessibility:',
    checklist: [
      { id: 'am1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'am2', label: 'Check road network map', action: 'navigateToContextMaps', completed: false },
      { id: 'am3', label: 'Review accessibility heatmap', action: 'navigateToContextMaps', completed: false },
      { id: 'am4', label: 'Check public transit proximity', action: 'navigateToContextMaps', completed: false },
      { id: 'am5', label: 'Review walkability scores', action: 'navigateToQuantitative', completed: false },
      { id: 'am6', label: 'Check connectivity metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'am7', label: 'Export mobility report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getComplianceReviewChecklist(): ChatStep {
  return {
    id: 'complianceReviewChecklist',
    message: 'Compliance Review Workflow\n\nFollow these steps to review regulatory compliance:',
    checklist: [
      { id: 'cr1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'cr2', label: 'Check building regulations', action: 'navigateToQuantitative', completed: false },
      { id: 'cr3', label: 'Review FAR and height limits', action: 'navigateToQuantitative', completed: false },
      { id: 'cr4', label: 'Check setback requirements', action: 'navigateToQuantitative', completed: false },
      { id: 'cr5', label: 'Review parking requirements', action: 'navigateToQuantitative', completed: false },
      { id: 'cr6', label: 'Check environmental regulations', action: 'navigateToQuantitative', completed: false },
      { id: 'cr7', label: 'Export compliance report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getMarketCostChecklist(): ChatStep {
  return {
    id: 'marketCostChecklist',
    message: 'Market & Cost Analysis Workflow\n\nFollow these steps to analyze project viability:',
    checklist: [
      { id: 'mc1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'mc2', label: 'Check population density map', action: 'navigateToContextMaps', completed: false },
      { id: 'mc3', label: 'Review demographic data', action: 'navigateToQuantitative', completed: false },
      { id: 'mc4', label: 'Check land use patterns', action: 'navigateToContextMaps', completed: false },
      { id: 'mc5', label: 'Generate cost estimates', action: 'navigateToQuantitative', completed: false },
      { id: 'mc6', label: 'Review project KPIs', action: 'navigateToQuantitative', completed: false },
      { id: 'mc7', label: 'Export financial report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getExportReportChecklist(): ChatStep {
  return {
    id: 'exportReportChecklist',
    message: 'Export Report Workflow\n\nFollow these steps to export your analysis:',
    checklist: [
      { id: 'er1', label: 'Complete site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'er2', label: 'Review all context maps', action: 'navigateToContextMaps', completed: false },
      { id: 'er3', label: 'Check quantitative metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'er4', label: 'Export context maps (PNG/SVG)', action: 'navigateToContextMaps', completed: false },
      { id: 'er5', label: 'Export Excel report', action: 'navigateToQuantitative', completed: false },
      { id: 'er6', label: 'Download all analysis cards', action: 'navigateToAnalysis', completed: false },
      { id: 'er7', label: 'Save the project', action: 'saveProject', completed: false },
    ],
  };
}

export function getLearnMetricsChecklist(): ChatStep {
  return {
    id: 'learnMetricsChecklist',
    message: 'Learn the Metrics Workflow\n\nFollow these steps to understand site analysis metrics:',
    checklist: [
      { id: 'lm1', label: 'Run a site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'lm2', label: 'Explore context maps overview', action: 'navigateToContextMaps', completed: false },
      { id: 'lm3', label: 'Review building analysis metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'lm4', label: 'Check land use patterns', action: 'navigateToContextMaps', completed: false },
      { id: 'lm5', label: 'Understand density metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'lm6', label: 'Learn about accessibility scores', action: 'navigateToQuantitative', completed: false },
      { id: 'lm7', label: 'Practice with concept planner', action: 'navigateToConceptPlanner', completed: false },
    ],
  };
}

export function getGrowthAnalysisChecklist(): ChatStep {
  return {
    id: 'growthAnalysisChecklist',
    message: 'Growth Analysis Workflow\n\nFollow these steps to analyze urban growth patterns:',
    checklist: [
      { id: 'ga1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'ga2', label: 'Check building age map', action: 'navigateToContextMaps', completed: false },
      { id: 'ga3', label: 'Review land use patterns', action: 'navigateToContextMaps', completed: false },
      { id: 'ga4', label: 'Check population density trends', action: 'navigateToContextMaps', completed: false },
      { id: 'ga5', label: 'Review development intensity', action: 'navigateToQuantitative', completed: false },
      { id: 'ga6', label: 'Analyze growth opportunities', action: 'navigateToQuantitative', completed: false },
      { id: 'ga7', label: 'Export growth analysis report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getEnvironmentalRiskChecklist(): ChatStep {
  return {
    id: 'environmentalRiskChecklist',
    message: 'Environmental Risk Assessment Workflow\n\nFollow these steps to assess environmental risks:',
    checklist: [
      { id: 'eris1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'eris2', label: 'Check environmental context maps', action: 'navigateToContextMaps', completed: false },
      { id: 'eris3', label: 'Review climate data', action: 'navigateToAnalysis', completed: false },
      { id: 'eris4', label: 'Check flood risk areas', action: 'navigateToContextMaps', completed: false },
      { id: 'eris5', label: 'Review environmental constraints', action: 'navigateToQuantitative', completed: false },
      { id: 'eris6', label: 'Assess mitigation requirements', action: 'navigateToQuantitative', completed: false },
      { id: 'eris7', label: 'Export risk assessment report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getPublicRealmChecklist(): ChatStep {
  return {
    id: 'publicRealmChecklist',
    message: 'Public Realm Analysis Workflow\n\nFollow these steps to analyze public spaces:',
    checklist: [
      { id: 'pr1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'pr2', label: 'Check amenities coverage map', action: 'navigateToContextMaps', completed: false },
      { id: 'pr3', label: 'Review open space distribution', action: 'navigateToContextMaps', completed: false },
      { id: 'pr4', label: 'Check pedestrian accessibility', action: 'navigateToContextMaps', completed: false },
      { id: 'pr5', label: 'Review public realm metrics', action: 'navigateToQuantitative', completed: false },
      { id: 'pr6', label: 'Assess community amenities', action: 'navigateToQuantitative', completed: false },
      { id: 'pr7', label: 'Export public realm report', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getRiskOpportunityChecklist(): ChatStep {
  return {
    id: 'riskOpportunityChecklist',
    message: 'Risk & Opportunity Analysis Workflow\n\nFollow these steps to identify project risks and opportunities:',
    checklist: [
      { id: 'ro1', label: 'Run site analysis', action: 'navigateToAnalysis', completed: false },
      { id: 'ro2', label: 'Review all context maps', action: 'navigateToContextMaps', completed: false },
      { id: 'ro3', label: 'Check site constraints', action: 'navigateToQuantitative', completed: false },
      { id: 'ro4', label: 'Identify development opportunities', action: 'navigateToQuantitative', completed: false },
      { id: 'ro5', label: 'Assess market conditions', action: 'navigateToQuantitative', completed: false },
      { id: 'ro6', label: 'Review risk factors', action: 'navigateToQuantitative', completed: false },
      { id: 'ro7', label: 'Export opportunity analysis', action: 'navigateToQuantitative', completed: false },
    ],
  };
}

export function getPostAnalysisActions(): ChatStep {
  return {
    id: 'postAnalysis',
    message:
      'Great! Your analysis is ready. Here\'s what you can explore next:',
    buttons: [
      { label: 'View Context Maps', action: 'navigateToContextMaps' },
      { label: 'View Metrics & KPIs', action: 'navigateToQuantitative' },
      { label: 'Open Concept Planner', action: 'navigateToConceptPlanner' },
      { label: 'Ask me questions', action: 'openChat' },
    ],
  };
}

export function getFallbackStep(): ChatStep {
  return {
    id: 'fallback',
    message:
      "I'm here to help you navigate the app. Where would you like to go?",
    buttons: [
      { label: 'Analysis Page', action: 'navigateToAnalysis' },
      { label: 'Context Maps', action: 'navigateToContextMaps' },
      { label: 'Metrics & KPIs', action: 'navigateToQuantitative' },
      { label: 'Concept Planner', action: 'navigateToConceptPlanner' },
    ],
  };
}
