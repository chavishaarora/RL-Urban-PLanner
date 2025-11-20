// Road network accessibility and connectivity analysis
import { fetchOSMRoadsAround, OSMRoadSegment } from './osmBuildings';

export interface Intersection {
  lat: number;
  lng: number;
  roadCount: number; // number of roads meeting here
  importance: 'critical' | 'major' | 'minor';
  connectedRoadTypes: string[];
}

export interface AccessibilityCell {
  i: number;
  j: number;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  walkScore: number; // 0-100: proximity to road network (pedestrian)
  driveScore: number; // 0-100: connectivity to major roads
  intersectionProximity: number; // distance to nearest intersection
  category: AccessibilityLevel;
}

export type AccessibilityLevel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';

function metersToLat(d: number) { return d / 111000; }
function metersToLng(d: number, lat: number) { return d / (111000 * Math.cos(lat * Math.PI / 180)); }

function distance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findIntersections(roads: OSMRoadSegment[]): Intersection[] {
  const nodeMap: Map<string, { lat: number; lng: number; roads: OSMRoadSegment[] }> = new Map();

  // Index all nodes
  roads.forEach(road => {
    road.nodes.forEach(node => {
      const key = `${node.lat.toFixed(6)},${node.lng.toFixed(6)}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, { lat: node.lat, lng: node.lng, roads: [] });
      }
      nodeMap.get(key)!.roads.push(road);
    });
  });

  // Find intersections (nodes where 3+ roads meet)
  const intersections: Intersection[] = [];
  nodeMap.forEach((data, key) => {
    if (data.roads.length < 2) return; // skip dead ends
    const uniqueRoads = Array.from(new Set(data.roads.map(r => r.id)));
    if (uniqueRoads.length < 2) return; // same road passing through

    const roadTypes = Array.from(new Set(data.roads.map(r => r.roadType)));
    let importance: 'critical' | 'major' | 'minor' = 'minor';
    if (data.roads.length >= 4 || roadTypes.includes('motorway') || roadTypes.includes('primary')) {
      importance = 'critical';
    } else if (data.roads.length >= 3 || roadTypes.includes('secondary')) {
      importance = 'major';
    }

    intersections.push({
      lat: data.lat,
      lng: data.lng,
      roadCount: uniqueRoads.length,
      importance,
      connectedRoadTypes: roadTypes
    });
  });

  return intersections;
}

export async function analyzeAccessibility(
  center: { lat: number; lng: number },
  radiusMeters = 700,
  cellSizeMeters = 20
) {
  const roads = await fetchOSMRoadsAround(center, radiusMeters);
  const intersections = findIntersections(roads);

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

  const cells: AccessibilityCell[] = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Every ODD row shifts RIGHT by half of horizontal spacing
      const offsetLng = (i % 2 === 1) ? lngStep * 0.5 : 0;
      
      const centerLat = south + i * latStep;
      const centerLng = west + j * lngStep + offsetLng;
      const cellCenter = { lat: centerLat, lng: centerLng };
      
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

      // Distance to nearest road (any type)
      let minRoadDist = Infinity;
      roads.forEach(road => {
        road.nodes.forEach(node => {
          const d = distance(cellCenter, node);
          if (d < minRoadDist) minRoadDist = d;
        });
      });

      // Distance to major road (motorway/primary/secondary)
      let minMajorRoadDist = Infinity;
      roads.filter(r => ['motorway', 'primary', 'secondary'].includes(r.roadType)).forEach(road => {
        road.nodes.forEach(node => {
          const d = distance(cellCenter, node);
          if (d < minMajorRoadDist) minMajorRoadDist = d;
        });
      });

      // Distance to nearest intersection
      let minIntersectionDist = Infinity;
      intersections.forEach(inter => {
        const d = distance(cellCenter, inter);
        if (d < minIntersectionDist) minIntersectionDist = d;
      });

      // Walk score: inverse of distance to any road (max 200m walk)
      const walkScore = Math.max(0, Math.min(100, 100 - (minRoadDist / 200) * 100));

      // Drive score: inverse of distance to major road (max 500m drive)
      const driveScore = Math.max(0, Math.min(100, 100 - (minMajorRoadDist / 500) * 100));

      // Combined accessibility
      const combined = (walkScore * 0.6) + (driveScore * 0.4);
      let category: AccessibilityLevel = 'Very Poor';
      if (combined >= 80) category = 'Excellent';
      else if (combined >= 60) category = 'Good';
      else if (combined >= 40) category = 'Fair';
      else if (combined >= 20) category = 'Poor';

      cells.push({
        i, j,
        center: cellCenter,
        polygon,
        walkScore,
        driveScore,
        intersectionProximity: minIntersectionDist,
        category
      });
    }
  }

  return { cells, intersections, roads };
}

export const ACCESSIBILITY_COLORS: Record<AccessibilityLevel, string> = {
  'Excellent': '#10b981',    // emerald-500
  'Good': '#34d399',         // emerald-400
  'Fair': '#fbbf24',         // amber-400
  'Poor': '#f97316',         // orange-500
  'Very Poor': '#ef4444'     // red-500
};

export const INTERSECTION_COLORS = {
  critical: '#7c3aed',  // violet-600
  major: '#a78bfa',     // violet-400
  minor: '#c4b5fd'      // violet-300
};
