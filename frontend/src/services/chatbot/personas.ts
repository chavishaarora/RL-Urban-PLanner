export type PersonaKey =
  | 'architect'
  | 'urbanStrategist'
  | 'cityOfficial'
  | 'projectDeveloper'
  | 'learner';

export interface Persona {
  key: PersonaKey;
  label: string;
  description: string;
  tone: 'visual' | 'systems' | 'formal' | 'commercial' | 'educational';
  priorities: string[]; // ordered list of what to surface first
  defaultGoals: string[]; // button labels
  preferredExports: string[]; // identifiers of export bundles
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  architect: {
    key: 'architect',
    label: 'Architectural Designer',
    description: 'Design-focused guidance with fast paths from site constraints to 2D/3D massing.',
    tone: 'visual',
    priorities: [
      'Constraints',
      'Microclimate',
      'Massing',
      'Context Maps',
      'Quantitative KPIs',
    ],
    defaultGoals: [
      'Site Analysis',
      'Concept Planning',
      'Environmental Metrics',
      'Export Report',
    ],
    preferredExports: ['excel', 'cardsZip', 'gltf'],
  },
  urbanStrategist: {
    key: 'urbanStrategist',
    label: 'Urban Strategist',
    description: 'Systems perspective emphasizing accessibility, equity, and growth patterns.',
    tone: 'systems',
    priorities: ['Accessibility', 'Density', 'Demographics', 'Mobility', 'Growth'],
    defaultGoals: [
      'Site Analysis',
      'Accessibility & Mobility',
      'Growth Analysis',
      'Export Report',
    ],
    preferredExports: ['mapsBundle', 'excelRationale'],
  },
  cityOfficial: {
    key: 'cityOfficial',
    label: 'City Official / Civic Authority',
    description: 'Compliance-oriented summaries, environmental risk and utilities emphasis.',
    tone: 'formal',
    priorities: [
      'FAR/Height/Setbacks',
      'Environmental Risk',
      'Utilities',
      'Public Realm',
    ],
    defaultGoals: [
      'Compliance Review',
      'Environmental Risk',
      'Public Realm',
      'Export Compliance Pack',
    ],
    preferredExports: ['excelCompliance', 'mapsBundle', 'pdfCompliance'],
  },
  projectDeveloper: {
    key: 'projectDeveloper',
    label: 'Project Developer',
    description: 'Commercial clarity: viability, demand, and risk/opportunity scoring.',
    tone: 'commercial',
    priorities: ['Market', 'Costs', 'Risk & Opportunity', 'KPIs'],
    defaultGoals: [
      'Site Analysis',
      'Market & Cost',
      'Risk & Opportunity',
      'Full Report',
    ],
    preferredExports: ['excelKPIs', 'costEstimate', 'mapsBundle'],
  },
  learner: {
    key: 'learner',
    label: 'Learner / Emerging Practitioner',
    description: 'Educational tone with definitions and gradual reveal of tools.',
    tone: 'educational',
    priorities: ['Definitions', 'Walkthrough', 'Examples'],
    defaultGoals: [
      'Explore a Sample',
      'Run Site Analysis',
      'Learn the Metrics',
      'Try Concept Planner',
    ],
    preferredExports: ['lightPack'],
  },
};

export const DEFAULT_PERSONA: Persona = PERSONAS.architect;
