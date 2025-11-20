// Service to fetch OSM building footprints + selected attributes for 2D analysis maps
// Implements caching for improved performance

import { getCachedData, setCachedData } from './osmCache';

export interface OSMBuildingPolygon {
  id: string;
  nodes: { lat: number; lng: number }[]; // closed ring
  tags: Record<string, any>;
}

export interface OSMBuildingFetchResult {
  buildings: OSMBuildingPolygon[];
  bbox: { south: number; west: number; north: number; east: number };
  center: { lat: number; lng: number };
}

// Construct an Overpass query for buildings + selected attributes
function buildQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  return `[
    out:json][timeout:15];
    (
      way["building"](${south},${west},${north},${east});
      relation["building"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;`;
}

interface RawElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Record<string, any>;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function tryFetch(query: string): Promise<any | null> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ data: query })
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.elements?.length) return json;
    } catch (_) {
      // try next
    }
  }
  return null;
}

export async function fetchOSMBuildingsAround(
  center: { lat: number; lng: number },
  radiusMeters = 600
): Promise<OSMBuildingFetchResult | null> {
  // Check cache first
  const cached = getCachedData<OSMBuildingFetchResult>(center, radiusMeters, 'buildings');
  if (cached) return cached;

  // Convert radius to lat/lng deltas (approximate)
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };

  const query = buildQuery(bbox);
  const data = await tryFetch(query);
  if (!data) return null;

  const elements: RawElement[] = data.elements;
  const nodeMap: Record<number, { lat: number; lng: number }> = {};
  const ways: Record<number, RawElement> = {};
  const relations: RawElement[] = [];

  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap[el.id] = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way') {
      ways[el.id] = el;
    } else if (el.type === 'relation') {
      relations.push(el);
    }
  }

  const buildings: OSMBuildingPolygon[] = [];

  // Process simple way polygons
  Object.values(ways).forEach(w => {
    if (!w.nodes || w.nodes.length < 4) return; // need at least triangle + repeat
    const coords = w.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (coords.length < 4) return;
    // Ensure closed ring
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) coords.push({ ...first });
    buildings.push({ id: `w${w.id}`, nodes: coords, tags: w.tags || {} });
  });

  // Process relation multipolygons (only outer for now)
  relations.forEach(rel => {
    if (!rel.members) return;
    const outers = rel.members.filter(m => m.role === 'outer' && m.type === 'way');
    if (!outers.length) return;
    // Naively stitch each outer independently
    outers.forEach(o => {
      const w = ways[o.ref];
      if (!w?.nodes || w.nodes.length < 4) return;
      const coords = w.nodes.map(id => nodeMap[id]).filter(Boolean);
      if (coords.length < 4) return;
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first.lat !== last.lat || first.lng !== last.lng) coords.push({ ...first });
      buildings.push({ id: `r${rel.id}w${w.id}`, nodes: coords, tags: { ...(rel.tags || {}), ...(w.tags || {}) } });
    });
  });

  const result = { buildings, bbox, center };
  
  // Cache the result
  setCachedData(center, radiusMeters, 'buildings', result);
  
  return result;
}

// --- Classification Helpers ---

export type BuildingType = 'Residential' | 'Commercial' | 'School/University' | 'Office' | 'Other';

export function classifyBuildingType(tags: Record<string, any>): BuildingType {
  const amenity = tags.amenity || '';
  const building = tags.building || '';
  const schoolish = ['school', 'college', 'university'];
  if (schoolish.includes(amenity) || schoolish.includes(building)) return 'School/University';
  if (/residential|apart|house|detached|terrace/i.test(building)) return 'Residential';
  if (/office/i.test(building) || amenity === 'office') return 'Office';
  if (/retail|commercial|supermarket|mall|shop/i.test(building) || /shop/.test(amenity)) return 'Commercial';
  return 'Other';
}

// Predictive inference: guess building type from nearest tagged neighbors
export function inferBuildingType(
  polygon: OSMBuildingPolygon,
  allBuildings: OSMBuildingPolygon[]
): BuildingType {
  const directType = classifyBuildingType(polygon.tags);
  if (directType !== 'Other') return directType;

  // Compute centroid of this building
  const centroid = {
    lat: polygon.nodes.reduce((sum, n) => sum + n.lat, 0) / polygon.nodes.length,
    lng: polygon.nodes.reduce((sum, n) => sum + n.lng, 0) / polygon.nodes.length,
  };

  // Find nearest 5 classified neighbors
  const neighbors = allBuildings
    .filter(b => b.id !== polygon.id)
    .map(b => {
      const bCenter = {
        lat: b.nodes.reduce((sum, n) => sum + n.lat, 0) / b.nodes.length,
        lng: b.nodes.reduce((sum, n) => sum + n.lng, 0) / b.nodes.length,
      };
      const dist = Math.sqrt(
        Math.pow(bCenter.lat - centroid.lat, 2) + Math.pow(bCenter.lng - centroid.lng, 2)
      );
      return { building: b, distance: dist, type: classifyBuildingType(b.tags) };
    })
    .filter(n => n.type !== 'Other')
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  if (!neighbors.length) return 'Residential'; // default fallback

  // Vote: most common type among neighbors
  const votes: Record<string, number> = {};
  neighbors.forEach(n => {
    votes[n.type] = (votes[n.type] || 0) + 1;
  });
  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return (winner ? winner[0] : 'Residential') as BuildingType;
}

export interface AgeBucketResult { bucket: AgeBucket; year: number | null }
export type AgeBucket = '<1960' | '1960-1975' | '1975-1990' | '1990-2005' | '>2005' | 'Unknown';

export function classifyBuildingAge(tags: Record<string, any>): AgeBucketResult {
  const raw = tags.start_date || tags['building:year'] || tags.constructed || tags['start_year'];
  if (!raw) return { bucket: 'Unknown', year: null };
  const match = String(raw).match(/(19\d{2}|20\d{2})/);
  if (!match) return { bucket: 'Unknown', year: null };
  const year = parseInt(match[1], 10);
  if (isNaN(year)) return { bucket: 'Unknown', year: null };
  if (year < 1960) return { bucket: '<1960', year };
  if (year < 1975) return { bucket: '1960-1975', year };
  if (year < 1990) return { bucket: '1975-1990', year };
  if (year < 2005) return { bucket: '1990-2005', year };
  return { bucket: '>2005', year };
}

// Predictive inference for building age using ML-style heuristics
export function inferBuildingAge(
  polygon: OSMBuildingPolygon,
  allBuildings: OSMBuildingPolygon[]
): AgeBucketResult {
  // First try direct classification
  const direct = classifyBuildingAge(polygon.tags);
  if (direct.bucket !== 'Unknown') return direct;

  // Compute centroid
  const centroid = {
    lat: polygon.nodes.reduce((sum, n) => sum + n.lat, 0) / polygon.nodes.length,
    lng: polygon.nodes.reduce((sum, n) => sum + n.lng, 0) / polygon.nodes.length,
  };

  // Calculate building footprint area for morphological analysis
  const area = computePolygonAreaMeters(polygon.nodes);

  // Find nearest 8 dated neighbors
  const neighbors = allBuildings
    .filter(b => b.id !== polygon.id)
    .map(b => {
      const bCenter = {
        lat: b.nodes.reduce((sum, n) => sum + n.lat, 0) / b.nodes.length,
        lng: b.nodes.reduce((sum, n) => sum + n.lng, 0) / b.nodes.length,
      };
      const dist = Math.sqrt(
        Math.pow(bCenter.lat - centroid.lat, 2) + Math.pow(bCenter.lng - centroid.lng, 2)
      );
      const age = classifyBuildingAge(b.tags);
      return { building: b, distance: dist, age };
    })
    .filter(n => n.age.bucket !== 'Unknown')
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);

  // Heuristic-based prediction using morphological features
  const buildingType = classifyBuildingType(polygon.tags);
  const heightInfo = classifyBuildingHeight(polygon.tags);

  // Prediction logic based on urban morphology patterns:
  
  // 1. Neighborhood voting (weighted by proximity)
  let predictedBucket: AgeBucket = '>2005'; // default to modern
  
  if (neighbors.length >= 3) {
    // Weighted voting: closer buildings have more influence
    const bucketScores: Record<string, number> = {};
    neighbors.forEach((n, idx) => {
      const weight = 1 / (idx + 1); // Closer = higher weight
      bucketScores[n.age.bucket] = (bucketScores[n.age.bucket] || 0) + weight;
    });
    const winner = Object.entries(bucketScores).sort((a, b) => b[1] - a[1])[0];
    if (winner) predictedBucket = winner[0] as AgeBucket;
  }

  // 2. Morphological adjustments based on building characteristics
  
  // Very small footprints (<80m²) in dense areas → likely older
  if (area < 80 && neighbors.length > 5) {
    const olderEras: AgeBucket[] = ['<1960', '1960-1975', '1975-1990'];
    if (!olderEras.includes(predictedBucket)) {
      predictedBucket = '1975-1990';
    }
  }

  // Large footprints (>500m²) with modern construction indicators
  if (area > 500) {
    const type = polygon.tags.building || '';
    // Malls, supermarkets, large offices → modern
    if (/retail|supermarket|mall|warehouse|industrial/.test(type)) {
      predictedBucket = '>2005';
    }
  }

  // Height-based inference
  if (heightInfo.meters !== null) {
    // Very tall buildings (>30m / ~10 floors) → likely modern
    if (heightInfo.meters > 30) {
      predictedBucket = '>2005';
    }
    // Low-rise in residential areas → could be older
    if (heightInfo.meters < 10 && buildingType === 'Residential' && area < 200) {
      const olderEras: AgeBucket[] = ['<1960', '1960-1975', '1975-1990', '1990-2005'];
      if (!olderEras.includes(predictedBucket)) {
        predictedBucket = '1975-1990';
      }
    }
  }

  // Schools and universities: historical analysis
  if (buildingType === 'School/University') {
    // Educational institutions often have older cores
    if (area > 1000) {
      // Large campus buildings could be older
      predictedBucket = '1960-1975';
    } else {
      // Smaller annexes likely modern
      predictedBucket = '1990-2005';
    }
  }

  // Commercial in prime locations: weighted toward renewal periods
  if (buildingType === 'Commercial' && area > 300) {
    // Commercial redevelopment waves
    predictedBucket = '>2005';
  }

  // 3. Regional/historical context (fallback heuristic)
  // If still no strong signal, use statistical likelihood
  if (neighbors.length === 0) {
    // Urban density proxy: small old core vs sprawling new suburbs
    if (area < 150) {
      predictedBucket = '1975-1990'; // Compact = likely older fabric
    } else {
      predictedBucket = '>2005'; // Spacious = likely modern development
    }
  }

  // Return predicted age with null year (since it's inferred)
  return { bucket: predictedBucket, year: null };
}

// --- Enhanced Age Inference with historical context + confidence ---
export interface AgeInferenceEnhanced extends AgeBucketResult {
  inferred: boolean;           // true if inferred
  confidence: number;          // 0..1 confidence score
  reasoning?: string;          // brief string
}

function computeLocalEraDistribution(all: OSMBuildingPolygon[]): Record<AgeBucket, number> {
  const counts: Record<AgeBucket, number> = {
    '<1960': 0,
    '1960-1975': 0,
    '1975-1990': 0,
    '1990-2005': 0,
    '>2005': 0,
    'Unknown': 0,
  };
  all.forEach(b => {
    const c = classifyBuildingAge(b.tags);
    if (c.bucket !== 'Unknown') counts[c.bucket]++;
  });
  const total = counts['<1960'] + counts['1960-1975'] + counts['1975-1990'] + counts['1990-2005'] + counts['>2005'];
  if (total === 0) {
    // Generic prior if no dated buildings locally
    return {
      '<1960': 0.15,
      '1960-1975': 0.18,
      '1975-1990': 0.22,
      '1990-2005': 0.20,
      '>2005': 0.25,
      'Unknown': 0,
    };
  }
  return {
    '<1960': counts['<1960'] / total,
    '1960-1975': counts['1960-1975'] / total,
    '1975-1990': counts['1975-1990'] / total,
    '1990-2005': counts['1990-2005'] / total,
    '>2005': counts['>2005'] / total,
    'Unknown': 0,
  };
}

export function inferBuildingAgeEnhanced(
  polygon: OSMBuildingPolygon,
  allBuildings: OSMBuildingPolygon[]
): AgeInferenceEnhanced {
  // Direct tag wins
  const direct = classifyBuildingAge(polygon.tags);
  if (direct.bucket !== 'Unknown') {
    return { ...direct, inferred: false, confidence: 0.95, reasoning: 'Direct OSM tag' };
  }

  const centroid = {
    lat: polygon.nodes.reduce((s, n) => s + n.lat, 0) / polygon.nodes.length,
    lng: polygon.nodes.reduce((s, n) => s + n.lng, 0) / polygon.nodes.length,
  };
  const area = computePolygonAreaMeters(polygon.nodes);

  const neighbors = allBuildings
    .filter(b => b.id !== polygon.id)
    .map(b => {
      const bCenter = {
        lat: b.nodes.reduce((s, n) => s + n.lat, 0) / b.nodes.length,
        lng: b.nodes.reduce((s, n) => s + n.lng, 0) / b.nodes.length,
      };
      const dist = Math.sqrt(
        Math.pow(bCenter.lat - centroid.lat, 2) + Math.pow(bCenter.lng - centroid.lng, 2)
      );
      const age = classifyBuildingAge(b.tags);
      return { building: b, distance: dist, age };
    })
    .filter(n => n.age.bucket !== 'Unknown')
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  const buildingType = classifyBuildingType(polygon.tags);
  const heightInfo = classifyBuildingHeight(polygon.tags);
  let predictedBucket: AgeBucket = '>2005';
  const reasoning: string[] = [];

  if (neighbors.length >= 3) {
    const bucketScores: Record<string, number> = {};
    neighbors.forEach((n, idx) => {
      const weight = 1 / (idx + 1);
      bucketScores[n.age.bucket] = (bucketScores[n.age.bucket] || 0) + weight;
    });
    const winner = Object.entries(bucketScores).sort((a, b) => b[1] - a[1])[0];
    if (winner) {
      predictedBucket = winner[0] as AgeBucket;
      reasoning.push(`Neighbor vote → ${predictedBucket}`);
    }
    const eraDist = computeLocalEraDistribution(allBuildings);
    const current = eraDist[predictedBucket] || 0;
    let alt: { bucket: AgeBucket; prob: number } | null = null;
    (Object.keys(eraDist) as AgeBucket[]).forEach(k => {
      if (k === 'Unknown') return;
      if (!alt || eraDist[k] > alt.prob) alt = { bucket: k, prob: eraDist[k] };
    });
    if (alt && alt.bucket !== predictedBucket && alt.prob > current * 1.5) {
      reasoning.push(`Era prior adjusts ${predictedBucket} → ${alt.bucket}`);
      predictedBucket = alt.bucket;
    }
  }

  if (area < 80 && neighbors.length > 5) {
    const older: AgeBucket[] = ['<1960', '1960-1975', '1975-1990'];
    if (!older.includes(predictedBucket)) {
      predictedBucket = '1975-1990';
      reasoning.push('Small dense footprint → older');
    }
  }
  if (area > 500) {
    const type = polygon.tags.building || '';
    if (/retail|supermarket|mall|warehouse|industrial/.test(type)) {
      predictedBucket = '>2005';
      reasoning.push('Large specialized footprint → modern');
    }
  }
  if (heightInfo.meters !== null) {
    if (heightInfo.meters > 30) {
      predictedBucket = '>2005';
      reasoning.push('Height >30m → modern');
    }
    if (heightInfo.meters < 10 && buildingType === 'Residential' && area < 200) {
      const older: AgeBucket[] = ['<1960', '1960-1975', '1975-1990', '1990-2005'];
      if (!older.includes(predictedBucket)) {
        predictedBucket = '1975-1990';
        reasoning.push('Low-rise small residential → older');
      }
    }
  }
  if (buildingType === 'School/University') {
    if (area > 1000) {
      predictedBucket = '1960-1975';
      reasoning.push('Large campus → mid-century');
    } else {
      predictedBucket = '1990-2005';
      reasoning.push('Small campus annex → contemporary');
    }
  }
  if (buildingType === 'Commercial' && area > 300) {
    predictedBucket = '>2005';
    reasoning.push('Large commercial → modern redevelopment');
  }
  if (neighbors.length === 0) {
    if (area < 150) {
      predictedBucket = '1975-1990';
      reasoning.push('No neighbors; compact footprint proxy → older');
    } else {
      predictedBucket = '>2005';
      reasoning.push('No neighbors; large footprint proxy → modern');
    }
  }

  // Confidence
  const neighborCountFactor = Math.min(neighbors.length / 12, 1);
  let consensusFactor = 0.3;
  if (neighbors.length) {
    const scores: Record<string, number> = {};
    neighbors.forEach((n, idx) => {
      const w = 1 / (idx + 1);
      scores[n.age.bucket] = (scores[n.age.bucket] || 0) + w;
    });
    const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
    const win = scores[predictedBucket] || 0;
    consensusFactor = win / total;
  }
  const morphPenalty = reasoning.length > 6 ? 0.15 : reasoning.length > 3 ? 0.1 : 0;
  let confidence = (0.55 * neighborCountFactor) + (0.35 * consensusFactor) + 0.10;
  confidence -= morphPenalty;
  confidence = Math.max(0.05, Math.min(confidence, 0.9));

  return { bucket: predictedBucket, year: null, inferred: true, confidence, reasoning: reasoning.join('; ') };
}


export const BUILDING_TYPE_COLORS: Record<BuildingType, string> = {
  Residential: '#0d9488', // teal-600
  Commercial: '#eab308', // amber-500
  'School/University': '#dc2626', // red-600
  Office: '#059669', // emerald-600
  Other: '#94a3b8', // slate-400
};

export const AGE_BUCKET_COLORS: Record<AgeBucket, string> = {
  '<1960': '#854d0e',      // amber-900 - Historical/Pre-war (warm brown)
  '1960-1975': '#ea580c',  // orange-600 - Post-war boom (burnt orange)
  '1975-1990': '#eab308',  // yellow-500 - Late modernism (golden yellow)
  '1990-2005': '#14b8a6',  // teal-500 - Contemporary transition (teal)
  '>2005': '#0d9488',      // teal-600 - Modern/New (deep teal)
  'Unknown': '#cbd5e1',    // slate-300 - (should never appear with inference)
};

// --- Road Network ---

export interface OSMRoadSegment {
  id: string;
  nodes: { lat: number; lng: number }[];
  tags: Record<string, any>;
  roadType: RoadType;
}

export type RoadType = 'motorway' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service' | 'other';

export function classifyRoadType(tags: Record<string, any>): RoadType {
  const highway = tags.highway || '';
  if (/motorway|trunk/.test(highway)) return 'motorway';
  if (/primary/.test(highway)) return 'primary';
  if (/secondary/.test(highway)) return 'secondary';
  if (/tertiary/.test(highway)) return 'tertiary';
  if (/residential|living_street/.test(highway)) return 'residential';
  if (/service|track/.test(highway)) return 'service';
  return 'other';
}

export const ROAD_TYPE_COLORS: Record<RoadType, string> = {
  motorway: '#334155', // slate-700
  primary: '#475569', // slate-600
  secondary: '#64748b', // slate-500
  tertiary: '#94a3b8', // slate-400
  residential: '#cbd5e1', // slate-300
  service: '#e2e8f0', // slate-200
  other: '#f1f5f9', // slate-100
};

export const ROAD_TYPE_WIDTHS: Record<RoadType, number> = {
  motorway: 6,
  primary: 5,
  secondary: 4,
  tertiary: 3,
  residential: 2.5,
  service: 1.5,
  other: 1.5,
};

function buildRoadQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:15];
    (
      way["highway"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;`;
}

export async function fetchOSMRoadsAround(
  center: { lat: number; lng: number },
  radiusMeters = 700
): Promise<OSMRoadSegment[]> {
  // Check cache first
  const cached = getCachedData<OSMRoadSegment[]>(center, radiusMeters, 'roads');
  if (cached) return cached;

  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };

  const query = buildRoadQuery(bbox);
  const data = await tryFetch(query);
  if (!data) return [];

  const elements: RawElement[] = data.elements;
  const nodeMap: Record<number, { lat: number; lng: number }> = {};
  const ways: RawElement[] = [];

  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap[el.id] = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way') {
      ways.push(el);
    }
  }

  const roads: OSMRoadSegment[] = [];
  ways.forEach(w => {
    if (!w.nodes || w.nodes.length < 2) return;
    const coords = w.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (coords.length < 2) return;
    const roadType = classifyRoadType(w.tags || {});
    roads.push({ id: `w${w.id}`, nodes: coords, tags: w.tags || {}, roadType });
  });

  // Cache the result
  setCachedData(center, radiusMeters, 'roads', roads);

  return roads;
}

// --- Land Use Classification ---

export interface OSMLandUsePolygon {
  id: string;
  nodes: { lat: number; lng: number }[];
  tags: Record<string, any>;
  landUseType: LandUseType;
}

export type LandUseType = 'Residential' | 'Commercial' | 'Industrial' | 'Park/Green' | 'Water' | 'Agricultural' | 'Institutional' | 'Other';

export function classifyLandUse(tags: Record<string, any>): LandUseType {
  const landuse = tags.landuse || '';
  const leisure = tags.leisure || '';
  const natural = tags.natural || '';
  const amenity = tags.amenity || '';
  
  if (/park|garden|recreation|pitch|playground/.test(leisure) || /grass|forest|wood/.test(natural)) return 'Park/Green';
  if (/water|riverbank|lake/.test(natural) || tags.water) return 'Water';
  if (/residential/.test(landuse)) return 'Residential';
  if (/commercial|retail/.test(landuse)) return 'Commercial';
  if (/industrial|construction/.test(landuse)) return 'Industrial';
  if (/farmland|farmyard|meadow|orchard/.test(landuse)) return 'Agricultural';
  if (/school|university|hospital/.test(amenity) || /institutional/.test(landuse)) return 'Institutional';
  return 'Other';
}

// Predictive inference for land use - leverages createInferredLandUseZones already implemented
// We'll keep explicit tagged data and let inference fill gaps via the inferred zones
// No additional neighbor logic needed here as it's handled by buffered zones

export const LANDUSE_TYPE_COLORS: Record<LandUseType, string> = {
  'Residential': '#14b8a6', // teal-500
  'Commercial': '#f59e0b', // amber-500
  'Industrial': '#64748b', // slate-500
  'Park/Green': '#10b981', // emerald-500
  'Water': '#3b82f6', // blue-500
  'Agricultural': '#84cc16', // lime-500
  'Institutional': '#8b5cf6', // violet-500
  'Other': '#94a3b8', // slate-400
};

function buildLandUseQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:15];
    (
      way["landuse"](${south},${west},${north},${east});
      way["leisure"](${south},${west},${north},${east});
      way["natural"~"water|wood|forest|grass"](${south},${west},${north},${east});
      relation["landuse"](${south},${west},${north},${east});
      relation["leisure"](${south},${west},${north},${east});
    );
    (._;>;);
    out body;`;
}

export async function fetchOSMLandUseAround(
  center: { lat: number; lng: number },
  radiusMeters = 700
): Promise<OSMLandUsePolygon[]> {
  // Check cache first
  const cached = getCachedData<OSMLandUsePolygon[]>(center, radiusMeters, 'landuse');
  if (cached) return cached;

  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };

  const query = buildLandUseQuery(bbox);
  const data = await tryFetch(query);
  if (!data) return [];

  const elements: RawElement[] = data.elements;
  const nodeMap: Record<number, { lat: number; lng: number }> = {};
  const ways: Record<number, RawElement> = {};

  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodeMap[el.id] = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way') {
      ways[el.id] = el;
    }
  }

  const landUsePolygons: OSMLandUsePolygon[] = [];

  Object.values(ways).forEach(w => {
    if (!w.nodes || w.nodes.length < 4) return;
    const coords = w.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (coords.length < 4) return;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) coords.push({ ...first });
    const landUseType = classifyLandUse(w.tags || {});
    landUsePolygons.push({ id: `w${w.id}`, nodes: coords, tags: w.tags || {}, landUseType });
  });

  // Cache the result
  setCachedData(center, radiusMeters, 'landuse', landUsePolygons);

  return landUsePolygons;
}

// Helper function to create buffered zones around buildings (top-level export)
export function createInferredLandUseZones(buildings: OSMBuildingPolygon[]): { polygon: { lat: number; lng: number }[]; landUseType: LandUseType }[] {
  const zones: { polygon: { lat: number; lng: number }[]; landUseType: LandUseType }[] = [];

  buildings.forEach(building => {
    const buildingType = classifyBuildingType(building.tags);
    let landUseType: LandUseType = 'Other';

    if (buildingType === 'Residential') landUseType = 'Residential';
    else if (buildingType === 'Commercial') landUseType = 'Commercial';
    else if (buildingType === 'School/University') landUseType = 'Institutional';
    else if (buildingType === 'Office') landUseType = 'Commercial';
    else return; // Skip 'Other' buildings entirely (no inference)

    // Create a simple square buffered zone around the building (~15m)
    const center = {
      lat: building.nodes.reduce((sum, n) => sum + n.lat, 0) / building.nodes.length,
      lng: building.nodes.reduce((sum, n) => sum + n.lng, 0) / building.nodes.length,
    };
    const buffer = 0.00015; // approx 15 meters in degrees
    const bufferedPolygon = [
      { lat: center.lat - buffer, lng: center.lng - buffer },
      { lat: center.lat - buffer, lng: center.lng + buffer },
      { lat: center.lat + buffer, lng: center.lng + buffer },
      { lat: center.lat + buffer, lng: center.lng - buffer },
      { lat: center.lat - buffer, lng: center.lng - buffer },
    ];

    zones.push({ polygon: bufferedPolygon, landUseType });
  });

  return zones;
}

// --- Amenities & POIs ---

export interface OSMAmenity {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, any>;
  amenityType: AmenityType;
}

export type AmenityType = 'Education' | 'Healthcare' | 'Retail' | 'Food & Drink' | 'Transit' | 'Culture' | 'Recreation' | 'Other';

export function classifyAmenity(tags: Record<string, any>): AmenityType {
  const amenity = tags.amenity || '';
  const shop = tags.shop || '';
  
  if (/school|college|university|kindergarten|library/.test(amenity)) return 'Education';
  if (/hospital|clinic|doctors|pharmacy|dentist/.test(amenity)) return 'Healthcare';
  if (shop || /marketplace/.test(amenity)) return 'Retail';
  if (/restaurant|cafe|bar|pub|fast_food/.test(amenity)) return 'Food & Drink';
  if (/bus_station|subway|train/.test(amenity) || tags.public_transport) return 'Transit';
  if (/theatre|cinema|arts_centre|museum/.test(amenity)) return 'Culture';
  if (/sports_centre|swimming_pool|playground/.test(amenity)) return 'Recreation';
  return 'Other';
}

export const AMENITY_TYPE_COLORS: Record<AmenityType, string> = {
  'Education': '#3b82f6', // blue-500
  'Healthcare': '#ef4444', // red-500
  'Retail': '#f59e0b', // amber-500
  'Food & Drink': '#ec4899', // pink-500
  'Transit': '#8b5cf6', // violet-500
  'Culture': '#06b6d4', // cyan-500
  'Recreation': '#10b981', // emerald-500
  'Other': '#6b7280', // gray-500
};

function buildAmenityQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:15];
    (
      node["amenity"](${south},${west},${north},${east});
      node["shop"](${south},${west},${north},${east});
    );
    out body;`;
}

export async function fetchOSMAmenitiesAround(
  center: { lat: number; lng: number },
  radiusMeters = 700
): Promise<OSMAmenity[]> {
  // Check cache first
  const cached = getCachedData<OSMAmenity[]>(center, radiusMeters, 'amenities');
  if (cached) return cached;

  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };

  const query = buildAmenityQuery(bbox);
  const data = await tryFetch(query);
  if (!data) return [];

  const amenities: OSMAmenity[] = [];
  const elements: RawElement[] = data.elements;

  elements.forEach(el => {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      const amenityType = classifyAmenity(el.tags || {});
      amenities.push({
        id: `n${el.id}`,
        lat: el.lat,
        lng: el.lon,
        tags: el.tags || {},
        amenityType,
      });
    }
  });

  // Cache the result
  setCachedData(center, radiusMeters, 'amenities', amenities);

  return amenities;
}

// --- Building Height Classification ---

export type HeightRange = '<10m' | '10-20m' | '20-30m' | '30-50m' | '>50m' | 'Unknown';

export function classifyBuildingHeight(tags: Record<string, any>): { range: HeightRange; meters: number | null } {
  let heightMeters: number | null = null;
  
  // Try height tag first
  if (tags.height) {
    const match = String(tags.height).match(/(\d+\.?\d*)/);
    if (match) heightMeters = parseFloat(match[1]);
  }
  
  // Fallback to building:levels with average 3.5m per floor
  if (heightMeters === null && tags['building:levels']) {
    const levels = parseInt(tags['building:levels'], 10);
    if (!isNaN(levels)) heightMeters = levels * 3.5;
  }
  
  if (heightMeters === null) return { range: 'Unknown', meters: null };
  
  if (heightMeters < 10) return { range: '<10m', meters: heightMeters };
  if (heightMeters < 20) return { range: '10-20m', meters: heightMeters };
  if (heightMeters < 30) return { range: '20-30m', meters: heightMeters };
  if (heightMeters < 50) return { range: '30-50m', meters: heightMeters };
  return { range: '>50m', meters: heightMeters };
}

// Predictive inference: estimate height from nearest tagged neighbors
export function inferBuildingHeight(
  polygon: OSMBuildingPolygon,
  allBuildings: OSMBuildingPolygon[]
): { range: HeightRange; meters: number | null } {
  const direct = classifyBuildingHeight(polygon.tags);
  if (direct.range !== 'Unknown') return direct;

  const centroid = {
    lat: polygon.nodes.reduce((sum, n) => sum + n.lat, 0) / polygon.nodes.length,
    lng: polygon.nodes.reduce((sum, n) => sum + n.lng, 0) / polygon.nodes.length,
  };

  const neighbors = allBuildings
    .filter(b => b.id !== polygon.id)
    .map(b => {
      const bCenter = {
        lat: b.nodes.reduce((sum, n) => sum + n.lat, 0) / b.nodes.length,
        lng: b.nodes.reduce((sum, n) => sum + n.lng, 0) / b.nodes.length,
      };
      const dist = Math.sqrt(
        Math.pow(bCenter.lat - centroid.lat, 2) + Math.pow(bCenter.lng - centroid.lng, 2)
      );
      return { building: b, distance: dist, height: classifyBuildingHeight(b.tags) };
    })
    .filter(n => n.height.range !== 'Unknown' && n.height.meters !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  if (!neighbors.length) return { range: '10-20m', meters: 15 }; // default 2-3 stories

  // Average heights
  const avgHeight = neighbors.reduce((sum, n) => sum + (n.height.meters || 0), 0) / neighbors.length;
  
  if (avgHeight < 10) return { range: '<10m', meters: avgHeight };
  if (avgHeight < 20) return { range: '10-20m', meters: avgHeight };
  if (avgHeight < 30) return { range: '20-30m', meters: avgHeight };
  if (avgHeight < 50) return { range: '30-50m', meters: avgHeight };
  return { range: '>50m', meters: avgHeight };
}

export const HEIGHT_RANGE_COLORS: Record<HeightRange, string> = {
  '<10m': '#fef3c7', // amber-100
  '10-20m': '#fde047', // yellow-300
  '20-30m': '#facc15', // yellow-400
  '30-50m': '#f59e0b', // amber-500
  '>50m': '#dc2626', // red-600
  'Unknown': '#e2e8f0', // slate-200
};

// --- Building Coverage/Density Classification ---

export type CoverageLevel = 'Low' | 'Medium' | 'High' | 'Very High' | 'Unknown';

// This is a simplistic proxy: we can't compute plot area without cadastral data,
// but we can use building footprint size as a rough indicator
export function classifyBuildingCoverage(tags: Record<string, any>, footprintArea?: number): CoverageLevel {
  // If we have footprint area (in m²), use it as proxy
  if (footprintArea !== undefined) {
    if (footprintArea < 100) return 'Low';
    if (footprintArea < 300) return 'Medium';
    if (footprintArea < 600) return 'High';
    return 'Very High';
  }
  return 'Unknown';
}

// Predictive inference for footprint/coverage - uses k-NN spatial averaging
export function inferBuildingCoverage(polygon: OSMBuildingPolygon, allBuildings: OSMBuildingPolygon[]): CoverageLevel {
  const center = {
    lat: polygon.nodes.reduce((sum, n) => sum + n.lat, 0) / polygon.nodes.length,
    lng: polygon.nodes.reduce((sum, n) => sum + n.lng, 0) / polygon.nodes.length,
  };
  
  // Find 5 nearest neighbors with known coverage (not 'Unknown')
  const distances = allBuildings
    .filter(b => b.id !== polygon.id)
    .map(b => {
      const bCenter = {
        lat: b.nodes.reduce((sum, n) => sum + n.lat, 0) / b.nodes.length,
        lng: b.nodes.reduce((sum, n) => sum + n.lng, 0) / b.nodes.length,
      };
      const dist = Math.sqrt(
        Math.pow(bCenter.lat - center.lat, 2) + Math.pow(bCenter.lng - center.lng, 2)
      );
      const area = computePolygonAreaMeters(b.nodes);
      const coverage = classifyBuildingCoverage(b.tags, area);
      return { building: b, dist, coverage, area };
    })
    .filter(d => d.coverage !== 'Unknown')
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);
  
  if (distances.length === 0) return 'Medium'; // default fallback
  
  // Average the footprint areas of nearest neighbors
  const avgArea = distances.reduce((sum, d) => sum + d.area, 0) / distances.length;
  
  // Classify based on average
  if (avgArea < 100) return 'Low';
  if (avgArea < 300) return 'Medium';
  if (avgArea < 600) return 'High';
  return 'Very High';
}

export const COVERAGE_LEVEL_COLORS: Record<CoverageLevel, string> = {
  Low: '#d1fae5', // emerald-100
  Medium: '#6ee7b7', // emerald-300
  High: '#10b981', // emerald-500
  'Very High': '#047857', // emerald-700
  Unknown: '#f1f5f9', // slate-100
};

// Helper to compute polygon area (approximate, in m²)
export function computePolygonAreaMeters(nodes: { lat: number; lng: number }[]): number {
  if (nodes.length < 3) return 0;
  
  // Use spherical excess formula (simplified for small areas)
  let area = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const p1 = nodes[i];
    const p2 = nodes[i + 1];
    area += (p2.lng - p1.lng) * (p2.lat + p1.lat);
  }
  area = Math.abs(area) / 2;
  
  // Convert to approximate m² (very rough, assumes small area near equator)
  const latMeters = 111000;
  const lngMeters = 111000 * Math.cos((nodes[0].lat * Math.PI) / 180);
  return area * latMeters * lngMeters;
}
