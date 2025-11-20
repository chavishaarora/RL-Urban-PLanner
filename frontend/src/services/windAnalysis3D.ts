// 3D Wind Flow Analysis Service
// Simplified CFD-style wind simulation for urban environments

import * as THREE from 'three';

export interface WindFlowPoint {
  position: THREE.Vector3;
  velocity: THREE.Vector3; // m/s in x, y, z
  speed: number; // magnitude in m/s
  pressure: number; // Pa
  comfort: 'comfortable' | 'acceptable' | 'uncomfortable' | 'dangerous';
}

export interface WindComfortZone {
  polygon: THREE.Vector3[];
  comfort: 'comfortable' | 'acceptable' | 'uncomfortable' | 'dangerous';
  averageSpeed: number;
  description: string;
}

export interface WindFlowField {
  points: WindFlowPoint[];
  vectors: THREE.ArrowHelper[];
  comfortZones: WindComfortZone[];
  streamlines: THREE.Vector3[][];
}

export interface WindAnalysisParams {
  prevailingWindDirection: number; // degrees (0 = north)
  windSpeed: number; // m/s at reference height
  referenceHeight: number; // meters (typically 10m)
  temperature: number; // Celsius
  season: 'winter' | 'summer' | 'spring' | 'fall';
}

/**
 * Wind comfort criteria (Lawson Comfort Criteria)
 */
const WIND_COMFORT_THRESHOLDS = {
  comfortable: 5,      // < 5 m/s - sitting/standing comfortable
  acceptable: 10,      // 5-10 m/s - walking acceptable
  uncomfortable: 15,   // 10-15 m/s - uncomfortable
  dangerous: Infinity  // > 15 m/s - dangerous
};

/**
 * Categorize wind comfort level
 */
function categorizeWindComfort(speed: number): 'comfortable' | 'acceptable' | 'uncomfortable' | 'dangerous' {
  if (speed < WIND_COMFORT_THRESHOLDS.comfortable) return 'comfortable';
  if (speed < WIND_COMFORT_THRESHOLDS.acceptable) return 'acceptable';
  if (speed < WIND_COMFORT_THRESHOLDS.uncomfortable) return 'uncomfortable';
  return 'dangerous';
}

/**
 * Calculate wind speed at different height using power law
 */
function windSpeedAtHeight(
  speedAtReference: number,
  heightReference: number,
  targetHeight: number,
  terrainRoughness: number = 0.3 // urban area
): number {
  const alpha = terrainRoughness; // Power law exponent
  return speedAtReference * Math.pow(targetHeight / heightReference, alpha);
}

/**
 * Calculate wind flow around a single building (simplified)
 */
function calculateBuildingWindEffect(
  windVelocity: THREE.Vector3,
  buildingBounds: THREE.Box3,
  testPoint: THREE.Vector3
): THREE.Vector3 {
  const buildingCenter = new THREE.Vector3();
  buildingBounds.getCenter(buildingCenter);
  const buildingSize = new THREE.Vector3();
  buildingBounds.getSize(buildingSize);
  
  // Vector from building center to test point
  const toPoint = testPoint.clone().sub(buildingCenter);
  const distance = toPoint.length();
  
  // Normalize wind direction
  const windDir = windVelocity.clone().normalize();
  
  // Check if point is in wind shadow (downwind)
  const dotProduct = toPoint.normalize().dot(windDir);
  
  if (dotProduct > 0) {
    // Downwind - create wake/turbulence zone
    const wakeLength = buildingSize.z * 5; // Wake extends ~5x building depth
    const wakeWidth = buildingSize.x * 1.5;
    
    if (distance < wakeLength && Math.abs(toPoint.x) < wakeWidth) {
      // In wake zone - reduced and turbulent wind
      const wakeFactor = 1 - (distance / wakeLength) * 0.7; // Up to 70% reduction
      return windVelocity.clone().multiplyScalar(wakeFactor);
    }
  } else if (dotProduct < -0.5) {
    // Upwind - acceleration zone around building edges
    const distanceToEdge = Math.abs(toPoint.x) - buildingSize.x / 2;
    
    if (distanceToEdge < buildingSize.x * 0.5 && distanceToEdge > -buildingSize.x * 0.2) {
      // Corner acceleration effect
      const accelerationFactor = 1.3; // 30% increase
      return windVelocity.clone().multiplyScalar(accelerationFactor);
    }
    
    // Downwash effect (wind pushed down at building face)
    if (distance < buildingSize.y && Math.abs(toPoint.x) < buildingSize.x / 2) {
      const downwashVelocity = windVelocity.clone();
      downwashVelocity.y -= windVelocity.length() * 0.3; // Downward component
      return downwashVelocity;
    }
  }
  
  // Street canyon effect (between parallel buildings)
  // Simplified: if surrounded by buildings, create vortex
  
  return windVelocity.clone(); // No modification
}

/**
 * Generate wind flow field for entire area
 */
export function generateWindFlowField(
  buildings: THREE.Mesh[],
  params: WindAnalysisParams,
  gridSize: { width: number; height: number; resolution: number }
): WindFlowField {
  const points: WindFlowPoint[] = [];
  const vectors: THREE.ArrowHelper[] = [];
  
  // Convert wind direction to vector
  const windAngle = (params.prevailingWindDirection - 90) * Math.PI / 180; // Convert to radians
  const baseWindVelocity = new THREE.Vector3(
    Math.cos(windAngle) * params.windSpeed,
    0,
    Math.sin(windAngle) * params.windSpeed
  );
  
  const { width, height, resolution } = gridSize;
  const stepX = width / resolution;
  const stepZ = height / resolution;
  
  // Calculate building bounding boxes
  const buildingBounds = buildings.map(b => {
    const box = new THREE.Box3().setFromObject(b);
    return box;
  });
  
  // Generate flow field at multiple heights
  const heights = [2, 5, 10]; // Pedestrian, mid, high levels
  
  heights.forEach(testHeight => {
    for (let x = -width / 2; x < width / 2; x += stepX) {
      for (let z = -height / 2; z < height / 2; z += stepZ) {
        const testPoint = new THREE.Vector3(x, testHeight, z);
        
        // Start with base wind at this height
        let windAtPoint = baseWindVelocity.clone();
        const speedAtHeight = windSpeedAtHeight(
          params.windSpeed,
          params.referenceHeight,
          testHeight
        );
        windAtPoint.setLength(speedAtHeight);
        
        // Apply building effects
        buildingBounds.forEach(bounds => {
          // Skip if point is inside building
          if (bounds.containsPoint(testPoint)) return;
          
          const effect = calculateBuildingWindEffect(windAtPoint, bounds, testPoint);
          windAtPoint = effect;
        });
        
        // Calculate pressure (simplified Bernoulli)
        const dynamicPressure = 0.5 * 1.225 * Math.pow(windAtPoint.length(), 2); // ρ = 1.225 kg/m³ (air)
        
        const point: WindFlowPoint = {
          position: testPoint.clone(),
          velocity: windAtPoint,
          speed: windAtPoint.length(),
          pressure: dynamicPressure,
          comfort: categorizeWindComfort(windAtPoint.length())
        };
        
        points.push(point);
        
        // Create arrow helper for visualization (only at pedestrian level)
        if (testHeight === 2) {
          const arrowLength = Math.min(windAtPoint.length() * 0.5, stepX * 0.8);
          const arrowColor = getWindSpeedColor(windAtPoint.length());
          
          const arrow = new THREE.ArrowHelper(
            windAtPoint.normalize(),
            testPoint,
            arrowLength,
            arrowColor,
            arrowLength * 0.2,
            arrowLength * 0.15
          );
          vectors.push(arrow);
        }
      }
    }
  });
  
  // Generate comfort zones
  const comfortZones = generateComfortZones(points, resolution);
  
  // Generate streamlines
  const streamlines = generateStreamlines(points, baseWindVelocity, 10);
  
  return {
    points,
    vectors,
    comfortZones,
    streamlines
  };
}

/**
 * Get color for wind speed visualization
 */
function getWindSpeedColor(speed: number): number {
  if (speed < 5) return 0x00ff00;       // Green - comfortable
  if (speed < 10) return 0xffff00;      // Yellow - acceptable
  if (speed < 15) return 0xff9900;      // Orange - uncomfortable
  return 0xff0000;                      // Red - dangerous
}

/**
 * Generate comfort zones from wind flow points
 */
function generateComfortZones(
  points: WindFlowPoint[],
  resolution: number
): WindComfortZone[] {
  const zones: WindComfortZone[] = [];
  const grouped = new Map<string, WindFlowPoint[]>();
  
  // Group points by comfort level (only pedestrian level y=2)
  points.filter(p => p.position.y === 2).forEach(point => {
    const comfort = point.comfort;
    if (!grouped.has(comfort)) {
      grouped.set(comfort, []);
    }
    grouped.get(comfort)!.push(point);
  });
  
  // Create zones (simplified - just use point positions)
  grouped.forEach((pts, comfort) => {
    if (pts.length > 0) {
      const avgSpeed = pts.reduce((sum, p) => sum + p.speed, 0) / pts.length;
      
      const descriptions = {
        comfortable: 'Ideal for sitting areas, outdoor dining, and recreational spaces',
        acceptable: 'Suitable for walking paths and transit areas',
        uncomfortable: 'Avoid prolonged exposure, consider windbreaks',
        dangerous: 'Unsafe conditions, requires immediate wind mitigation measures'
      };
      
      zones.push({
        polygon: pts.map(p => p.position),
        comfort: comfort as any,
        averageSpeed: avgSpeed,
        description: descriptions[comfort as keyof typeof descriptions]
      });
    }
  });
  
  return zones;
}

/**
 * Generate streamlines for flow visualization
 */
function generateStreamlines(
  points: WindFlowPoint[],
  baseWind: THREE.Vector3,
  numStreamlines: number
): THREE.Vector3[][] {
  const streamlines: THREE.Vector3[][] = [];
  
  // Find bounds
  const bounds = new THREE.Box3();
  points.forEach(p => bounds.expandByPoint(p.position));
  
  const size = new THREE.Vector3();
  bounds.getSize(size);
  
  // Create grid for interpolation
  const gridSize = 20;
  const grid: Map<string, WindFlowPoint> = new Map();
  points.filter(p => p.position.y === 2).forEach(p => {
    const key = `${Math.floor(p.position.x)},${Math.floor(p.position.z)}`;
    grid.set(key, p);
  });
  
  // Generate streamlines from random start points
  for (let i = 0; i < numStreamlines; i++) {
    const startX = bounds.min.x + Math.random() * size.x;
    const startZ = bounds.min.z + Math.random() * size.z;
    const streamline: THREE.Vector3[] = [];
    
    let currentPos = new THREE.Vector3(startX, 2, startZ);
    
    // Trace streamline
    for (let step = 0; step < 100; step++) {
      streamline.push(currentPos.clone());
      
      // Interpolate velocity at current position
      const key = `${Math.floor(currentPos.x)},${Math.floor(currentPos.z)}`;
      const point = grid.get(key);
      
      if (!point) break; // Out of bounds
      
      // Move along velocity vector
      const stepSize = 1.0;
      currentPos.add(point.velocity.clone().normalize().multiplyScalar(stepSize));
      
      // Stop if out of bounds
      if (!bounds.containsPoint(currentPos)) break;
    }
    
    if (streamline.length > 5) {
      streamlines.push(streamline);
    }
  }
  
  return streamlines;
}

/**
 * Analyze wind comfort for specific activity
 */
export interface ActivityWindAnalysis {
  activity: string;
  suitableAreas: THREE.Vector3[];
  unsuitableAreas: THREE.Vector3[];
  percentage: number; // Percentage of area suitable
  recommendation: string;
}

export function analyzeWindForActivity(
  flowField: WindFlowField,
  activity: 'sitting' | 'standing' | 'walking' | 'cycling'
): ActivityWindAnalysis {
  const thresholds = {
    sitting: 5,
    standing: 8,
    walking: 12,
    cycling: 15
  };
  
  const threshold = thresholds[activity];
  const suitable: THREE.Vector3[] = [];
  const unsuitable: THREE.Vector3[] = [];
  
  flowField.points.filter(p => p.position.y === 2).forEach(point => {
    if (point.speed < threshold) {
      suitable.push(point.position);
    } else {
      unsuitable.push(point.position);
    }
  });
  
  const total = suitable.length + unsuitable.length;
  const percentage = total > 0 ? (suitable.length / total) * 100 : 0;
  
  const recommendations = {
    sitting: percentage > 70 ? 'Excellent location for outdoor seating and cafés' : 'Consider adding windbreaks for seating areas',
    standing: percentage > 60 ? 'Good for plazas and gathering spaces' : 'Recommend strategic planting for wind reduction',
    walking: percentage > 80 ? 'Comfortable pedestrian environment' : 'May need canopies or covered walkways',
    cycling: percentage > 50 ? 'Suitable for bike paths' : 'Strong winds may affect cycling comfort'
  };
  
  return {
    activity,
    suitableAreas: suitable,
    unsuitableAreas: unsuitable,
    percentage,
    recommendation: recommendations[activity]
  };
}

/**
 * Suggest wind mitigation measures
 */
export interface WindMitigationSuggestion {
  location: THREE.Vector3;
  type: 'tree' | 'wall' | 'canopy' | 'building_modification';
  description: string;
  expectedReduction: number; // Percentage wind speed reduction
}

export function suggestWindMitigation(
  flowField: WindFlowField,
  buildings: THREE.Mesh[]
): WindMitigationSuggestion[] {
  const suggestions: WindMitigationSuggestion[] = [];
  
  // Find high-wind areas at pedestrian level
  const problematicPoints = flowField.points.filter(
    p => p.position.y === 2 && p.speed > 10
  );
  
  // Cluster problematic points
  const clusters: THREE.Vector3[][] = [];
  const used = new Set<WindFlowPoint>();
  
  problematicPoints.forEach(point => {
    if (used.has(point)) return;
    
    const cluster: THREE.Vector3[] = [point.position];
    used.add(point);
    
    // Find nearby points
    problematicPoints.forEach(other => {
      if (used.has(other)) return;
      if (point.position.distanceTo(other.position) < 20) {
        cluster.push(other.position);
        used.add(other);
      }
    });
    
    if (cluster.length >= 3) {
      clusters.push(cluster);
    }
  });
  
  // Suggest mitigation for each cluster
  clusters.forEach(cluster => {
    const center = cluster.reduce(
      (sum, p) => sum.add(p),
      new THREE.Vector3()
    ).divideScalar(cluster.length);
    
    // Determine mitigation type based on context
    suggestions.push({
      location: center,
      type: 'tree',
      description: 'Plant trees in rows perpendicular to prevailing wind',
      expectedReduction: 30
    });
    
    suggestions.push({
      location: center,
      type: 'wall',
      description: 'Install permeable wind screen (40-50% porosity)',
      expectedReduction: 50
    });
  });
  
  return suggestions;
}
