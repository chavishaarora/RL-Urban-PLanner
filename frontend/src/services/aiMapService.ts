import { PedestrianSpace } from './pedestrianSpaces';
import { fetchCompetitors, Competitor } from './marketAnalysis';

export type MapActionType = 'osm_layer' | 'analysis' | 'amenity' | 'clear' | 'unknown';

export interface MapAction {
  type: MapActionType;
  layer?: string; // e.g., 'parks', 'roads', 'water'
  amenityType?: string; // e.g., 'Cafe', 'Restaurant'
  analysisMode?: 'solar' | 'wind' | 'shadow' | 'comfort';
  style?: {
    fillColor?: string;
    strokeColor?: string;
  };
  message: string; // Response message to user
}

// Simple keyword-based "AI" for prototype
export const parseUserQuery = async (query: string): Promise<MapAction> => {
  const q = query.toLowerCase();

  // 1. Analysis Requests
  if (q.includes('solar') || q.includes('radiation') || q.includes('sun')) {
    return {
      type: 'analysis',
      analysisMode: 'solar',
      message: 'Generating solar radiation map based on current weather conditions...'
    };
  }
  
  if (q.includes('wind') || q.includes('breeze') || q.includes('air')) {
    return {
      type: 'analysis',
      analysisMode: 'wind',
      message: 'Simulating wind flow patterns and comfort levels...'
    };
  }

  if (q.includes('shadow') || q.includes('shade')) {
    return {
      type: 'analysis',
      analysisMode: 'shadow',
      message: 'Calculating building shadows for the current time of day...'
    };
  }

  if (q.includes('comfort') || q.includes('thermal') || q.includes('heat')) {
    return {
      type: 'analysis',
      analysisMode: 'comfort',
      message: 'Analyzing outdoor thermal comfort (UTCI/PET)...'
    };
  }

  // 2. Amenity Requests (New)
  if (q.includes('cafe') || q.includes('coffee')) {
    return {
      type: 'amenity',
      amenityType: 'Cafe',
      message: 'Finding cafes and coffee shops nearby...'
    };
  }

  if (q.includes('restaurant') || q.includes('food') || q.includes('eat')) {
    return {
      type: 'amenity',
      amenityType: 'Restaurant',
      message: 'Locating restaurants and dining spots...'
    };
  }

  if (q.includes('school') || q.includes('education')) {
    return {
      type: 'amenity',
      amenityType: 'School & Kindergarten',
      message: 'Showing schools and educational institutions...'
    };
  }

  if (q.includes('office') || q.includes('work') || q.includes('business')) {
    return {
      type: 'amenity',
      amenityType: 'Professional Services',
      message: 'Highlighting offices and professional services...'
    };
  }

  if (q.includes('shop') || q.includes('store') || q.includes('buy')) {
    return {
      type: 'amenity',
      amenityType: 'Supermarket & Grocery', // Defaulting to grocery for now, could be broader
      message: 'Showing local shops and stores...'
    };
  }

  // 3. OSM Layer Requests
  if (q.includes('park') || q.includes('green') || q.includes('garden')) {
    return {
      type: 'osm_layer',
      layer: 'parks',
      style: { fillColor: '#4ade80', strokeColor: '#166534' },
      message: 'Highlighting all parks and green spaces in the area.'
    };
  }

  if (q.includes('road') || q.includes('street') || q.includes('traffic')) {
    return {
      type: 'osm_layer',
      layer: 'roads',
      style: { fillColor: '#94a3b8', strokeColor: '#475569' },
      message: 'Showing the road network hierarchy.'
    };
  }

  if (q.includes('water') || q.includes('river') || q.includes('lake')) {
    return {
      type: 'osm_layer',
      layer: 'water',
      style: { fillColor: '#60a5fa', strokeColor: '#1e40af' },
      message: 'Mapping water bodies and waterways.'
    };
  }
  
  if (q.includes('building') || q.includes('structure')) {
    return {
      type: 'osm_layer',
      layer: 'buildings',
      style: { fillColor: '#cbd5e1', strokeColor: '#64748b' },
      message: 'Displaying building footprints.'
    };
  }

  // 4. Clear/Reset
  if (q.includes('clear') || q.includes('reset') || q.includes('remove')) {
    return {
      type: 'clear',
      message: 'Clearing the map.'
    };
  }

  // Default / Unknown
  return {
    type: 'unknown',
    message: "I'm not sure how to map that yet. Try asking for 'parks', 'cafes', 'solar radiation', or 'wind analysis'."
  };
};
