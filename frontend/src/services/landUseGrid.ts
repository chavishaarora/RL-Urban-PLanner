import { OSMLandUsePolygon, LandUseType, computePolygonAreaMeters, OSMAmenity, AmenityType, OSMBuildingPolygon, classifyBuildingHeight } from './osmBuildings';

export interface GridCell {
  i: number;
  j: number;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  landUse?: LandUseType | null;
  explicit?: boolean; // true when classified from explicit OSM polygons
  confidence?: number; // 0..1
  mix?: Partial<Record<LandUseType, number>>; // percentages 0..1
  entropy?: number; // 0..1 normalized
  potential?: number; // 0..1
}

export interface InferredZone { polygon: { lat: number; lng: number }[]; landUseType: LandUseType }

function metersToLat(dMeters: number) { return dMeters / 111000; }
function metersToLng(dMeters: number, lat: number) { return dMeters / (111000 * Math.cos((lat * Math.PI) / 180)); }

function pointInPolygon(pt: { lat: number; lng: number }, poly: { lat: number; lng: number }[]): boolean {
  // Ray casting
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect = ((yi > pt.lat) !== (yj > pt.lat)) && (pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildGrid(center: { lat: number; lng: number }, radiusMeters: number, cellSizeMeters = 20): { cells: GridCell[]; cols: number; rows: number } {
  // Build hexagonal grid with proper honeycomb tessellation
  // Using POINTY-TOPPED hexagons (vertices point up/down)
  const size = cellSizeMeters / 2; // distance from center to vertex
  
  // For POINTY-TOPPED hexagons:
  // Width (flat to flat) = sqrt(3) * size
  // Height (point to point) = 2 * size
  const width = Math.sqrt(3) * size;
  const height = 2 * size;
  
  // For perfect tessellation:
  // Horizontal spacing = width (full width between centers)
  // Vertical spacing = 3/4 * height (1.5 * size)
  const horizontalSpacing = width; // sqrt(3) * size
  const verticalSpacing = 1.5 * size; // 3/4 of height
  
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

  const cells: GridCell[] = [];
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Every ODD row shifts RIGHT by half of horizontal spacing
      const offsetLng = (i % 2 === 1) ? lngStep * 0.5 : 0;
      
      const centerLat = south + i * latStep;
      const centerLng = west + j * lngStep + offsetLng;
      
      const centerPt = { lat: centerLat, lng: centerLng };
      
      // Create POINTY-TOPPED hexagon with 6 vertices
      // Vertices at angles: 30°, 90°, 150°, 210°, 270°, 330° (starting from top-right)
      const sizeLatRadius = metersToLat(size);
      const sizeLngRadius = metersToLng(size, centerLat);
      
      const poly = [];
      for (let k = 0; k < 6; k++) {
        const angleDeg = 30 + 60 * k; // 30, 90, 150, 210, 270, 330
        const angleRad = (angleDeg * Math.PI) / 180;
        poly.push({
          lat: centerLat + sizeLatRadius * Math.sin(angleRad),
          lng: centerLng + sizeLngRadius * Math.cos(angleRad)
        });
      }
      poly.push(poly[0]); // Close the polygon
      
      cells.push({ i, j, center: centerPt, polygon: poly });
    }
  }
  return { cells, cols, rows };
}

export function classifyGridCells(
  cells: GridCell[],
  explicitPolys: OSMLandUsePolygon[],
  inferredZones: InferredZone[]
): GridCell[] {
  // Index polygons by simple bbox for quick reject (optional micro-optimization omitted for brevity)
  cells.forEach(cell => {
    // 1) explicit wins
    const explicit = explicitPolys.find(p => pointInPolygon(cell.center, p.nodes));
    if (explicit) {
      cell.landUse = explicit.landUseType;
      cell.explicit = true;
      cell.confidence = 0.9;
      return;
    }
    // 2) inferred majority
    const votes: Partial<Record<LandUseType, number>> = {};
    inferredZones.forEach(z => {
      if (pointInPolygon(cell.center, z.polygon)) {
        votes[z.landUseType] = (votes[z.landUseType] || 0) + 1;
      }
    });
    const winner = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    if (winner) {
      cell.landUse = winner[0] as LandUseType;
      cell.explicit = false;
      const totalVotes = Object.values(votes).reduce((s, v) => s + (v || 0), 0) || 1;
      cell.confidence = Math.min(0.85, (winner[1] as number) / totalVotes * 0.8 + 0.2);
    } else {
      cell.landUse = null;
      cell.explicit = false;
      cell.confidence = 0.0;
    }
  });
  return cells;
}

export function smoothGrid(cells: GridCell[], rows: number, cols: number): GridCell[] {
  const at = (i: number, j: number) => cells[i * cols + j];
  const copy = cells.map(c => ({ ...c }));
  
  // First pass: smooth existing classifications
  for (let i = 1; i < rows - 1; i++) {
    for (let j = 1; j < cols - 1; j++) {
      const idx = i * cols + j;
      const c = cells[idx];
      if (!c.landUse) continue;
      const neighbors = [at(i-1,j), at(i+1,j), at(i,j-1), at(i,j+1)];
      const votes: Partial<Record<LandUseType, number>> = {};
      neighbors.forEach(n => { if (n?.landUse) votes[n.landUse] = (votes[n.landUse] || 0) + 1; });
      const best = Object.entries(votes).sort((a,b)=> (b[1] as number) - (a[1] as number))[0];
      if (best && best[0] !== c.landUse && (best[1] as number) >= 3) {
        copy[idx].landUse = best[0] as LandUseType;
        copy[idx].explicit = false;
        copy[idx].confidence = Math.min(0.8, (best[1] as number)/4 * 0.6 + 0.2);
      }
    }
  }
  
  // Second pass: fill in unclassified cells using neighbor inference
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx = i * cols + j;
      const c = copy[idx];
      if (c.landUse) continue; // Already classified
      
      // Check all neighbors (including diagonals for better coverage)
      const neighbors = [];
      for (let di = -2; di <= 2; di++) {
        for (let dj = -2; dj <= 2; dj++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
            const neighbor = at(ni, nj);
            if (neighbor?.landUse) neighbors.push(neighbor);
          }
        }
      }
      
      if (neighbors.length > 0) {
        // Vote based on nearby cells
        const votes: Partial<Record<LandUseType, number>> = {};
        neighbors.forEach(n => {
          const weight = (n.confidence || 0.5);
          votes[n.landUse!] = (votes[n.landUse!] || 0) + weight;
        });
        const winner = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        if (winner) {
          copy[idx].landUse = winner[0] as LandUseType;
          copy[idx].explicit = false;
          copy[idx].confidence = Math.min(0.5, (winner[1] as number) / neighbors.length);
        }
      } else {
        // Default fallback: assume Residential in urban context
        copy[idx].landUse = 'Residential';
        copy[idx].explicit = false;
        copy[idx].confidence = 0.2;
      }
    }
  }
  
  return copy;
}

export function computeMix(cells: GridCell[], explicitPolys: OSMLandUsePolygon[], inferredZones: InferredZone[]): GridCell[] {
  const K: LandUseType[] = ['Residential','Commercial','Industrial','Park/Green','Institutional','Agricultural','Water','Other'];
  cells.forEach(cell => {
    const counts: Partial<Record<LandUseType, number>> = {};
    // explicit first
    const explicit = explicitPolys.find(p => pointInPolygon(cell.center, p.nodes));
    if (explicit) {
      counts[explicit.landUseType] = (counts[explicit.landUseType] || 0) + 1.5; // weight explicit
    }
    inferredZones.forEach(z => { if (pointInPolygon(cell.center, z.polygon)) counts[z.landUseType] = (counts[z.landUseType] || 0) + 1; });
    const total = Object.values(counts).reduce((s,v)=> s + (v||0), 0);
    if (total > 0) {
      const mix: Partial<Record<LandUseType, number>> = {};
      K.forEach(k => { if (counts[k]) mix[k] = (counts[k] as number) / total; });
      cell.mix = mix;
      // entropy
      const probs = Object.values(mix) as number[];
      const H = -probs.reduce((s,p)=> s + (p>0 ? p*Math.log(p) : 0), 0);
      const Hmax = Math.log(probs.length || 1);
      cell.entropy = Hmax > 0 ? H/Hmax : 0;
      // set dominant as landUse for rendering if absent
      const dom = Object.entries(mix).sort((a,b)=> (b[1] as number) - (a[1] as number))[0];
      if (dom) {
        cell.landUse = dom[0] as LandUseType;
        cell.confidence = (dom[1] as number);
      }
    }
  });
  return cells;
}

export function computeDevelopmentPotential(
  cells: GridCell[],
  buildings: OSMBuildingPolygon[],
  amenities: OSMAmenity[],
  cellAreaMeters: number
): GridCell[] {
  // Precompute building attributes
  const buildingInfo = buildings.map(b => {
    const area = computePolygonAreaMeters(b.nodes);
    const h = classifyBuildingHeight(b.tags);
    const meters = h.meters ?? 10; // default low-rise
    const floors = Math.max(1, Math.round(meters / 3.5));
    const centroid = {
      lat: b.nodes.reduce((s,n)=> s+n.lat, 0)/b.nodes.length,
      lng: b.nodes.reduce((s,n)=> s+n.lng, 0)/b.nodes.length,
    };
    return { area, floors, centroid };
  });
  function dist(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
    const dx = (a.lng - b.lng) * Math.cos((a.lat*Math.PI)/180);
    const dy = (a.lat - b.lat);
    return Math.sqrt(dx*dx + dy*dy) * 111000; // meters approx
  }

  cells.forEach(cell => {
    // buildings in cell
    const bInCell = buildingInfo.filter(b =>
      b.centroid.lat >= Math.min(cell.polygon[0].lat, cell.polygon[2].lat) &&
      b.centroid.lat <= Math.max(cell.polygon[0].lat, cell.polygon[2].lat) &&
      b.centroid.lng >= Math.min(cell.polygon[0].lng, cell.polygon[2].lng) &&
      b.centroid.lng <= Math.max(cell.polygon[0].lng, cell.polygon[2].lng)
    );
    const currentFAR = bInCell.reduce((s,b)=> s + b.area * b.floors, 0) / (cellAreaMeters || 1);

    // context height within 120m
    const neighborHeights = buildingInfo.filter(b => dist(cell.center, b.centroid) <= 120).map(b => b.floors*3.5);
    const avgH = neighborHeights.length ? neighborHeights.reduce((s,v)=>s+v,0)/neighborHeights.length : 10;
    let targetFAR = 1.5;
    if (avgH > 30) targetFAR = 6;
    else if (avgH > 15) targetFAR = 3.5;

    let score = Math.max(0, (targetFAR - currentFAR) / targetFAR);

    // commercial adjacency boost within 80m (simple proxy)
    const commercialNearby = cells.filter(c => c.landUse === 'Commercial' && dist(c.center, cell.center) <= 80).length;
    if (commercialNearby >= 2) score += 0.15;

    // transit adjacency within 150m
    const transitNearby = amenities.some(a => a.amenityType === 'Transit' && dist(cell.center, {lat:a.lat,lng:a.lng}) <= 150);
    if (transitNearby) score += 0.10;

    // park proximity dampen
    const parkNearby = cells.filter(c => c.landUse === 'Park/Green' && dist(c.center, cell.center) <= 60).length;
    if (parkNearby >= 1) score -= 0.10;

    cell.potential = Math.max(0, Math.min(1, score));
  });
  return cells;
}
