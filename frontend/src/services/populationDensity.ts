// Population density estimation service (enhanced)
// We approximate using building footprints + inferred floors (OSM) and dynamic occupancy factors per building type.
// Also compute separate day vs night activity proxies and expose percentile ranks for adaptive legends.
// NOT official census data; relative visualization only.

import { fetchOSMBuildingsAround, OSMBuildingPolygon, classifyBuildingType, classifyBuildingHeight, computePolygonAreaMeters } from './osmBuildings';

export interface DensityCell {
  i: number; j: number;
  center: { lat:number; lng:number };
  polygon: { lat: number; lng: number }[]; // hexagon vertices
  areaM2: number;
  residentialPersons: number; // night focus
  dayActivityPersons: number; // commercial/educational/retail heuristic occupants
  nightActivityPersons: number; // residential + lodging
  blendedPersons: number; // combined metric (weighted)
  densityPpkm2: number; // base residential per km2
  percentile: number; // 0..1 percentile of blended
  resBuildingCount: number;
}

// Occupancy factors (persons per m2 GFA) - coarse heuristics
const OCCUPANCY_FACTORS: Record<string, number> = {
  Residential: 0.035, // ~28.5 m2/person
  Apartments: 0.04, // slightly denser multi-unit
  Commercial: 0.06, // offices daytime density
  Retail: 0.08, // higher turnover/occupancy
  Educational: 0.05,
  Healthcare: 0.07,
  Industrial: 0.02,
  Institutional: 0.045,
  Lodging: 0.05,
  Default: 0.035
};

function metersToLat(d: number){ return d / 111000; }
function metersToLng(d: number, lat: number){ return d / (111000 * Math.cos(lat*Math.PI/180)); }

export async function estimatePopulationGrid(center: {lat:number; lng:number}, radiusMeters = 700, cellSizeMeters = 20) {
  const buildingData = await fetchOSMBuildingsAround(center, radiusMeters);
  if(!buildingData) return { cells: [] as DensityCell[], buildings: [] as OSMBuildingPolygon[] };
  const buildings = buildingData.buildings;

  const enriched = buildings.map(b => {
    const type = classifyBuildingType(b.tags);
    const height = classifyBuildingHeight(b.tags);
    const area = computePolygonAreaMeters(b.nodes);
    const floors = height.meters ? Math.max(1, Math.round(height.meters / 3.2)) : 3;
    const factor = OCCUPANCY_FACTORS[type] ?? OCCUPANCY_FACTORS.Default;
    return { b, type, area, floors, factor };
  });

  // Build hexagonal grid (same as land use map)
  const size = cellSizeMeters / 2; // distance from center to vertex
  const width = Math.sqrt(3) * size;
  const height = 2 * size;
  const horizontalSpacing = width;
  const verticalSpacing = 1.5 * size;
  
  const latStep = metersToLat(verticalSpacing);
  const lngStep = metersToLng(horizontalSpacing, center.lat);
  
  const latDelta = metersToLat(radiusMeters);
  const lngDelta = metersToLng(radiusMeters, center.lat);
  const south = center.lat - latDelta;
  const west = center.lng - lngDelta;
  const north = center.lat + latDelta;
  const east = center.lng + lngDelta;

  const rows = Math.ceil((north - south) / latStep) + 2;
  const cols = Math.ceil((east - west) / lngStep) + 2;

  const cells: DensityCell[] = [];
  const hexagonAreaM2 = (3 * Math.sqrt(3) / 2) * (size * size); // area of regular hexagon
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Every ODD row shifts RIGHT by half of horizontal spacing
      const offsetLng = (i % 2 === 1) ? lngStep * 0.5 : 0;
      
      const centerLat = south + i * latStep;
      const centerLng = west + j * lngStep + offsetLng;
      const centerPt = { lat: centerLat, lng: centerLng };
      
      // Create POINTY-TOPPED hexagon with 6 vertices
      const sizeLatRadius = metersToLat(size);
      const sizeLngRadius = metersToLng(size, centerLat);
      
      const polygon = [];
      for (let k = 0; k < 6; k++) {
        const angleDeg = 30 + 60 * k;
        const angleRad = (angleDeg * Math.PI) / 180;
        polygon.push({
          lat: centerLat + sizeLatRadius * Math.sin(angleRad),
          lng: centerLng + sizeLngRadius * Math.cos(angleRad)
        });
      }
      polygon.push(polygon[0]); // Close the polygon

      let residentialPersons = 0;
      let dayActivityPersons = 0;
      let nightActivityPersons = 0;
      let resBuildingCount = 0;

      enriched.forEach(rec => {
        const cLat = rec.b.nodes.reduce((s,n)=>s+n.lat,0)/rec.b.nodes.length;
        const cLng = rec.b.nodes.reduce((s,n)=>s+n.lng,0)/rec.b.nodes.length;
        
        // Check if building centroid is within hexagon (simple bbox check + point-in-polygon)
        const minLat = Math.min(...polygon.map(p => p.lat));
        const maxLat = Math.max(...polygon.map(p => p.lat));
        const minLng = Math.min(...polygon.map(p => p.lng));
        const maxLng = Math.max(...polygon.map(p => p.lng));
        
        if(cLat >= minLat && cLat <= maxLat && cLng >= minLng && cLng <= maxLng){
          const grossFloor = rec.area * rec.floors;
          const persons = grossFloor * rec.factor;
          switch(rec.type){
            case 'Residential':
              residentialPersons += persons; nightActivityPersons += persons; resBuildingCount++; break;
            case 'Office':
              dayActivityPersons += persons; break;
            case 'Commercial':
              dayActivityPersons += persons * 1.05; break;
            case 'School/University':
              dayActivityPersons += persons * 1.15; break;
            default:
              dayActivityPersons += persons * 0.25;
          }
        }
      });

      const blendedPersons = residentialPersons + 0.6 * dayActivityPersons + 0.3 * (nightActivityPersons - residentialPersons);
      const densityPpkm2 = (residentialPersons / hexagonAreaM2) * 1_000_000;

      cells.push({ 
        i, j, 
        center: centerPt, 
        polygon,
        areaM2: hexagonAreaM2, 
        residentialPersons, 
        dayActivityPersons, 
        nightActivityPersons, 
        blendedPersons, 
        densityPpkm2, 
        percentile: 0, 
        resBuildingCount 
      });
    }
  }

  // Compute percentile ranks for blendedPersons
  const sorted = [...cells].sort((a,b)=> a.blendedPersons - b.blendedPersons);
  const total = sorted.length;
  const valueToPercentile = new Map<number, number>();
  sorted.forEach((c, idx) => {
    valueToPercentile.set(c.blendedPersons, idx / (total - 1 || 1));
  });
  cells.forEach(c => { c.percentile = valueToPercentile.get(c.blendedPersons) ?? 0; });

  return { cells, buildings };
}

export function classifyDensity(ppkm2: number){
  if(ppkm2 < 3000) return 'Very Low';
  if(ppkm2 < 8000) return 'Low';
  if(ppkm2 < 15000) return 'Moderate';
  if(ppkm2 < 25000) return 'High';
  return 'Very High';
}

export const DENSITY_COLORS: Record<string,string> = {
  'Very Low':'#d1fae5',     // emerald-100
  'Low':'#6ee7b7',          // emerald-300
  'Moderate':'#14b8a6',     // teal-500
  'High':'#0d9488',         // teal-600
  'Very High':'#115e59'     // teal-800
};
