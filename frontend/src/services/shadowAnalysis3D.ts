// 3D Shadow Analysis Service
// Time-lapse shadow progression and annual shadow mapping

import * as THREE from 'three';
import { calculateSunPosition, calculateDailySunPath, calculateSeasonalSunPaths } from './solarAnalysis3D';

export interface ShadowSnapshot {
  time: Date;
  shadowGeometry: THREE.Mesh[];
  shadowCoverage: number; // percentage
  sunPosition: THREE.Vector3;
  sunAltitude: number;
  sunAzimuth: number;
}

export interface ShadowTimelapseData {
  date: Date;
  snapshots: ShadowSnapshot[];
  totalShadowHours: Map<string, number>; // "x,z" -> hours in shadow
  averageShadowCoverage: number;
}

export interface AnnualShadowAnalysis {
  winterSolstice: ShadowTimelapseData;
  springEquinox: ShadowTimelapseData;
  summerSolstice: ShadowTimelapseData;
  fallEquinox: ShadowTimelapseData;
  annualShadowMap: Map<string, number>; // "x,z" -> total hours in shadow per year
}

export interface ShadowImpactAnalysis {
  beforeBuilding: ShadowTimelapseData;
  afterBuilding: ShadowTimelapseData;
  shadowIncrease: number; // percentage increase
  affectedAreas: THREE.Vector3[];
  impactScore: number; // 0-100 (higher = more negative impact)
}

/**
 * Cast shadow from a building at specific sun position
 */
export function castBuildingShadow(
  building: THREE.Mesh,
  sunPosition: THREE.Vector3,
  groundLevel: number = 0
): THREE.Mesh {
  const geometry = building.geometry;
  const position = building.position;
  
  // Get building vertices
  const positionAttribute = geometry.getAttribute('position');
  const vertices: THREE.Vector3[] = [];
  
  for (let i = 0; i < positionAttribute.count; i++) {
    const vertex = new THREE.Vector3(
      positionAttribute.getX(i),
      positionAttribute.getY(i),
      positionAttribute.getZ(i)
    );
    vertex.add(position);
    vertices.push(vertex);
  }
  
  // Calculate shadow vertices
  const sunDirection = sunPosition.clone().normalize();
  const shadowVertices: THREE.Vector3[] = [];
  
  vertices.forEach(vertex => {
    // Only cast shadows from top vertices
    if (vertex.y > groundLevel) {
      // Ray from vertex in direction opposite to sun
      const ray = new THREE.Vector3().copy(vertex);
      const direction = sunDirection.clone().negate();
      
      // Find intersection with ground plane
      const t = (groundLevel - ray.y) / direction.y;
      
      if (t > 0) {
        const shadowPoint = ray.clone().add(direction.multiplyScalar(t));
        shadowVertices.push(shadowPoint);
      }
    }
  });
  
  // Create shadow mesh (simplified - convex hull of shadow vertices)
  if (shadowVertices.length === 0) {
    return new THREE.Mesh(new THREE.BufferGeometry());
  }
  
  // Create a plane for shadow visualization
  const shadowGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(shadowVertices.length * 3);
  
  shadowVertices.forEach((v, i) => {
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  });
  
  shadowGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  });
  
  return new THREE.Mesh(shadowGeometry, shadowMaterial);
}

/**
 * Calculate shadow coverage percentage
 */
function calculateShadowCoverage(
  shadowMeshes: THREE.Mesh[],
  areaSize: { width: number; height: number }
): number {
  // Simplified: count shadowed grid points
  const resolution = 50;
  const stepX = areaSize.width / resolution;
  const stepZ = areaSize.height / resolution;
  
  let shadowedPoints = 0;
  const raycaster = new THREE.Raycaster();
  
  for (let x = -areaSize.width / 2; x < areaSize.width / 2; x += stepX) {
    for (let z = -areaSize.height / 2; z < areaSize.height / 2; z += stepZ) {
      const origin = new THREE.Vector3(x, 100, z); // Ray from above
      const direction = new THREE.Vector3(0, -1, 0);
      
      raycaster.set(origin, direction);
      const intersects = raycaster.intersectObjects(shadowMeshes);
      
      if (intersects.length > 0) {
        shadowedPoints++;
      }
    }
  }
  
  const totalPoints = resolution * resolution;
  return (shadowedPoints / totalPoints) * 100;
}

/**
 * Generate shadow timelapse for a single day
 */
export function generateDailyShadowTimelapse(
  buildings: THREE.Mesh[],
  lat: number,
  lng: number,
  date: Date,
  intervalHours: number = 1,
  areaSize: { width: number; height: number } = { width: 500, height: 500 }
): ShadowTimelapseData {
  const snapshots: ShadowSnapshot[] = [];
  const shadowHoursMap = new Map<string, number>();
  
  // Get sun path for the day
  const sunPath = calculateDailySunPath(lat, lng, date, intervalHours * 60);
  
  // For each time interval
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  for (let hours = 6; hours <= 20; hours += intervalHours) {
    const currentTime = new Date(dayStart.getTime() + hours * 3600000);
    const sunPos = calculateSunPosition(lat, lng, currentTime);
    
    // Skip if sun is below horizon
    if (sunPos.altitude <= 0) continue;
    
    // Cast shadows from all buildings
    const shadowMeshes = buildings.map(building => 
      castBuildingShadow(building, sunPos.position)
    );
    
    const coverage = calculateShadowCoverage(shadowMeshes, areaSize);
    
    // Track shadow hours per grid point
    const resolution = 20;
    const stepX = areaSize.width / resolution;
    const stepZ = areaSize.height / resolution;
    
    for (let x = -areaSize.width / 2; x < areaSize.width / 2; x += stepX) {
      for (let z = -areaSize.height / 2; z < areaSize.height / 2; z += stepZ) {
        const key = `${Math.floor(x)},${Math.floor(z)}`;
        
        // Check if this point is in shadow
        const testPoint = new THREE.Vector3(x, 0.1, z);
        const raycaster = new THREE.Raycaster();
        raycaster.set(testPoint, new THREE.Vector3(0, 1, 0));
        
        const intersects = raycaster.intersectObjects(shadowMeshes);
        if (intersects.length > 0) {
          shadowHoursMap.set(key, (shadowHoursMap.get(key) || 0) + intervalHours);
        }
      }
    }
    
    snapshots.push({
      time: currentTime,
      shadowGeometry: shadowMeshes,
      shadowCoverage: coverage,
      sunPosition: sunPos.position,
      sunAltitude: sunPos.altitude,
      sunAzimuth: sunPos.azimuth
    });
  }
  
  const avgCoverage = snapshots.reduce((sum, s) => sum + s.shadowCoverage, 0) / snapshots.length;
  
  return {
    date,
    snapshots,
    totalShadowHours: shadowHoursMap,
    averageShadowCoverage: avgCoverage
  };
}

/**
 * Generate annual shadow analysis (4 key dates)
 */
export function generateAnnualShadowAnalysis(
  buildings: THREE.Mesh[],
  lat: number,
  lng: number,
  year: number = new Date().getFullYear(),
  areaSize: { width: number; height: number } = { width: 500, height: 500 }
): AnnualShadowAnalysis {
  const winterSolstice = new Date(year, 11, 21);
  const springEquinox = new Date(year, 2, 20);
  const summerSolstice = new Date(year, 5, 21);
  const fallEquinox = new Date(year, 8, 22);
  
  const winterData = generateDailyShadowTimelapse(buildings, lat, lng, winterSolstice, 1, areaSize);
  const springData = generateDailyShadowTimelapse(buildings, lat, lng, springEquinox, 1, areaSize);
  const summerData = generateDailyShadowTimelapse(buildings, lat, lng, summerSolstice, 1, areaSize);
  const fallData = generateDailyShadowTimelapse(buildings, lat, lng, fallEquinox, 1, areaSize);
  
  // Combine shadow hours from all seasons (approximate annual total)
  const annualShadowMap = new Map<string, number>();
  
  [winterData, springData, summerData, fallData].forEach(seasonData => {
    seasonData.totalShadowHours.forEach((hours, key) => {
      annualShadowMap.set(key, (annualShadowMap.get(key) || 0) + hours * 91.25); // ~365/4 days
    });
  });
  
  return {
    winterSolstice: winterData,
    springEquinox: springData,
    summerSolstice: summerData,
    fallEquinox: fallData,
    annualShadowMap
  };
}

/**
 * Compare shadows before and after new building
 */
export function analyzeShadowImpact(
  existingBuildings: THREE.Mesh[],
  newBuilding: THREE.Mesh,
  lat: number,
  lng: number,
  analysisDate: Date,
  areaSize: { width: number; height: number } = { width: 500, height: 500 }
): ShadowImpactAnalysis {
  // Analyze before
  const beforeData = generateDailyShadowTimelapse(
    existingBuildings,
    lat,
    lng,
    analysisDate,
    1,
    areaSize
  );
  
  // Analyze after (with new building)
  const afterData = generateDailyShadowTimelapse(
    [...existingBuildings, newBuilding],
    lat,
    lng,
    analysisDate,
    1,
    areaSize
  );
  
  // Calculate increase
  const shadowIncrease = afterData.averageShadowCoverage - beforeData.averageShadowCoverage;
  
  // Find affected areas (areas that gained shadow)
  const affectedAreas: THREE.Vector3[] = [];
  
  afterData.totalShadowHours.forEach((afterHours, key) => {
    const beforeHours = beforeData.totalShadowHours.get(key) || 0;
    const increase = afterHours - beforeHours;
    
    if (increase > 2) { // More than 2 additional hours of shadow
      const [x, z] = key.split(',').map(Number);
      affectedAreas.push(new THREE.Vector3(x, 0, z));
    }
  });
  
  // Impact score (0-100, higher = worse)
  let impactScore = 0;
  impactScore += Math.min(shadowIncrease * 2, 40); // Max 40 points for coverage increase
  impactScore += Math.min((affectedAreas.length / 100) * 60, 60); // Max 60 points for affected area
  
  return {
    beforeBuilding: beforeData,
    afterBuilding: afterData,
    shadowIncrease,
    affectedAreas,
    impactScore
  };
}

/**
 * Create shadow heatmap texture
 */
export function createShadowHeatmapTexture(
  shadowHoursMap: Map<string, number>,
  resolution: number,
  maxHours: number = 12
): THREE.DataTexture {
  const size = resolution * resolution;
  const data = new Uint8Array(4 * size);
  
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = (i - resolution / 2) * 5; // Scale factor
      const z = (j - resolution / 2) * 5;
      const key = `${Math.floor(x)},${Math.floor(z)}`;
      
      const hours = shadowHoursMap.get(key) || 0;
      const normalized = Math.min(hours / maxHours, 1);
      
      const idx = (i * resolution + j) * 4;
      
      // Color: white (no shadow) -> blue -> purple -> black (full shadow)
      if (normalized < 0.33) {
        const t = normalized * 3;
        data[idx] = Math.floor((1 - t) * 255);     // R
        data[idx + 1] = Math.floor((1 - t) * 255); // G
        data[idx + 2] = 255;                        // B (blue)
      } else if (normalized < 0.66) {
        const t = (normalized - 0.33) * 3;
        data[idx] = Math.floor(t * 128);           // R (purple)
        data[idx + 1] = 0;                         // G
        data[idx + 2] = 255;                        // B
      } else {
        const t = (normalized - 0.66) * 3;
        data[idx] = Math.floor((1 - t) * 128);     // R
        data[idx + 1] = 0;                         // G
        data[idx + 2] = Math.floor((1 - t) * 255); // B
      }
      data[idx + 3] = 200; // Alpha
    }
  }
  
  const texture = new THREE.DataTexture(data, resolution, resolution);
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Find optimal locations avoiding shadows
 */
export function findShadowFreeZones(
  shadowAnalysis: ShadowTimelapseData,
  minSunHours: number = 6,
  areaSize: { width: number; height: number } = { width: 500, height: 500 }
): THREE.Vector3[] {
  const shadowFreeZones: THREE.Vector3[] = [];
  const maxPossibleHours = 14; // Daylight hours
  
  shadowAnalysis.totalShadowHours.forEach((shadowHours, key) => {
    const sunHours = maxPossibleHours - shadowHours;
    
    if (sunHours >= minSunHours) {
      const [x, z] = key.split(',').map(Number);
      shadowFreeZones.push(new THREE.Vector3(x, 0, z));
    }
  });
  
  return shadowFreeZones;
}

/**
 * Recommend building orientation to minimize shadow impact
 */
export interface OrientationRecommendation {
  orientation: number; // degrees from north
  shadowReduction: number; // percentage
  reasoning: string;
}

export function recommendBuildingOrientation(
  buildingSize: { width: number; depth: number; height: number },
  lat: number,
  lng: number,
  analysisDate: Date
): OrientationRecommendation {
  // Test multiple orientations
  const orientations = [0, 45, 90, 135]; // Test 4 orientations
  const results: { angle: number; shadowArea: number }[] = [];
  
  orientations.forEach(angle => {
    // Create test building at this orientation
    const geometry = new THREE.BoxGeometry(buildingSize.width, buildingSize.height, buildingSize.depth);
    const material = new THREE.MeshBasicMaterial();
    const testBuilding = new THREE.Mesh(geometry, material);
    testBuilding.rotation.y = angle * Math.PI / 180;
    
    // Calculate shadow for this orientation
    const data = generateDailyShadowTimelapse([testBuilding], lat, lng, analysisDate, 1);
    
    results.push({
      angle,
      shadowArea: data.averageShadowCoverage
    });
  });
  
  // Find orientation with minimum shadow
  const optimal = results.reduce((min, curr) => 
    curr.shadowArea < min.shadowArea ? curr : min
  );
  
  const worst = results.reduce((max, curr) => 
    curr.shadowArea > max.shadowArea ? curr : max
  );
  
  const reduction = ((worst.shadowArea - optimal.shadowArea) / worst.shadowArea) * 100;
  
  const reasoningMap: Record<number, string> = {
    0: 'North-South orientation minimizes east-west shadow impact',
    45: 'Diagonal orientation balances morning and afternoon shadows',
    90: 'East-West orientation minimizes north-south shadow impact',
    135: 'Angled orientation optimizes for prevailing sun angles'
  };
  
  return {
    orientation: optimal.angle,
    shadowReduction: reduction,
    reasoning: reasoningMap[optimal.angle] || 'Optimal orientation based on shadow analysis'
  };
}
