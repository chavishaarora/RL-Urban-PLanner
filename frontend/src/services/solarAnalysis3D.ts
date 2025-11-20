// 3D Solar Radiation Analysis Service
// Real-time solar radiation calculation with shadow casting

import * as THREE from 'three';
import SunCalc from 'suncalc';

export interface SolarAnalysisPoint {
  lat: number;
  lng: number;
  elevation: number;
  annualRadiation: number; // kWh/m²/year
  dailyRadiation: number; // kWh/m²/day (for selected date)
  shadowHours: number; // hours in shadow per day
  sunExposure: number; // 0-1 (percentage of day in sun)
}

export interface SunPosition {
  azimuth: number; // radians
  altitude: number; // radians
  position: THREE.Vector3; // 3D position for rendering
}

export interface ShadowCastResult {
  shadowedPoints: Set<string>; // "x,y,z" keys
  shadowPolygons: THREE.Mesh[];
  shadowCoverage: number; // percentage
}

export interface SolarRadiationHeatmap {
  points: SolarAnalysisPoint[];
  min: number;
  max: number;
  average: number;
  texture?: THREE.DataTexture;
}

/**
 * Calculate sun position for a given time and location
 */
export function calculateSunPosition(
  lat: number,
  lng: number,
  date: Date
): SunPosition {
  const sunPos = SunCalc.getPosition(date, lat, lng);
  
  // Convert spherical to Cartesian coordinates
  const distance = 10000; // Arbitrary large distance for sun
  const x = distance * Math.cos(sunPos.altitude) * Math.sin(sunPos.azimuth);
  const y = distance * Math.sin(sunPos.altitude);
  const z = distance * Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth);
  
  return {
    azimuth: sunPos.azimuth,
    altitude: sunPos.altitude,
    position: new THREE.Vector3(x, y, z)
  };
}

/**
 * Calculate sun path for entire day
 */
export function calculateDailySunPath(
  lat: number,
  lng: number,
  date: Date,
  intervalMinutes: number = 30
): SunPosition[] {
  const positions: SunPosition[] = [];
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  // Calculate for 24 hours
  for (let minutes = 0; minutes < 1440; minutes += intervalMinutes) {
    const currentTime = new Date(dayStart.getTime() + minutes * 60000);
    const sunPos = calculateSunPosition(lat, lng, currentTime);
    
    // Only include positions when sun is above horizon
    if (sunPos.altitude > 0) {
      positions.push(sunPos);
    }
  }
  
  return positions;
}

/**
 * Calculate seasonal sun paths (winter solstice, equinox, summer solstice)
 */
export function calculateSeasonalSunPaths(
  lat: number,
  lng: number,
  year: number = new Date().getFullYear()
): {
  winterSolstice: SunPosition[];
  springEquinox: SunPosition[];
  summerSolstice: SunPosition[];
  fallEquinox: SunPosition[];
} {
  const winterSolstice = new Date(year, 11, 21); // Dec 21
  const springEquinox = new Date(year, 2, 20);   // Mar 20
  const summerSolstice = new Date(year, 5, 21);  // Jun 21
  const fallEquinox = new Date(year, 8, 22);     // Sep 22
  
  return {
    winterSolstice: calculateDailySunPath(lat, lng, winterSolstice, 30),
    springEquinox: calculateDailySunPath(lat, lng, springEquinox, 30),
    summerSolstice: calculateDailySunPath(lat, lng, summerSolstice, 30),
    fallEquinox: calculateDailySunPath(lat, lng, fallEquinox, 30)
  };
}

/**
 * Cast shadows from buildings using ray casting
 */
export function castShadows(
  buildings: THREE.Mesh[],
  sunPosition: SunPosition,
  groundPlane: { width: number; height: number; resolution: number },
  centerLat: number,
  centerLng: number
): ShadowCastResult {
  const raycaster = new THREE.Raycaster();
  const shadowedPoints = new Set<string>();
  const sunDirection = sunPosition.position.clone().normalize().negate();
  
  const { width, height, resolution } = groundPlane;
  const stepX = width / resolution;
  const stepZ = height / resolution;
  
  // Cast rays from ground to sun for each grid point
  for (let x = -width / 2; x < width / 2; x += stepX) {
    for (let z = -height / 2; z < height / 2; z += stepZ) {
      const origin = new THREE.Vector3(x, 0.1, z);
      raycaster.set(origin, sunDirection.clone().negate());
      
      // Check if ray intersects any building
      const intersects = raycaster.intersectObjects(buildings, true);
      
      if (intersects.length > 0) {
        shadowedPoints.add(`${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  
  const totalPoints = (resolution * resolution);
  const shadowCoverage = (shadowedPoints.size / totalPoints) * 100;
  
  return {
    shadowedPoints,
    shadowPolygons: [], // Can be computed from shadowedPoints if needed
    shadowCoverage
  };
}

/**
 * Calculate solar radiation for a point considering shadows
 */
export function calculatePointRadiation(
  lat: number,
  lng: number,
  elevation: number,
  date: Date,
  buildings: THREE.Mesh[],
  intervalMinutes: number = 60
): SolarAnalysisPoint {
  const sunPath = calculateDailySunPath(lat, lng, date, intervalMinutes);
  let sunlitHours = 0;
  let totalRadiation = 0;
  
  const raycaster = new THREE.Raycaster();
  const pointPosition = new THREE.Vector3(0, elevation, 0); // Simplified, adjust for actual lat/lng
  
  sunPath.forEach(sunPos => {
    const sunDirection = sunPos.position.clone().normalize().negate();
    raycaster.set(pointPosition, sunDirection.clone().negate());
    
    const intersects = raycaster.intersectObjects(buildings, true);
    
    if (intersects.length === 0) {
      // Not in shadow
      sunlitHours += (intervalMinutes / 60);
      
      // Solar radiation calculation (simplified)
      // Actual formula: I = I₀ × cos(θ) × atmospheric_factors
      const solarConstant = 1.367; // kW/m²
      const atmosphericFactor = 0.7; // Clear sky
      const incidenceAngle = Math.max(0, Math.sin(sunPos.altitude));
      
      const hourlyRadiation = solarConstant * atmosphericFactor * incidenceAngle * (intervalMinutes / 60);
      totalRadiation += hourlyRadiation;
    }
  });
  
  const daylightHours = sunPath.length * (intervalMinutes / 60);
  const sunExposure = daylightHours > 0 ? sunlitHours / daylightHours : 0;
  const shadowHours = daylightHours - sunlitHours;
  
  // Estimate annual radiation (simplified: daily × 365)
  const annualRadiation = totalRadiation * 365;
  
  return {
    lat,
    lng,
    elevation,
    dailyRadiation: totalRadiation,
    annualRadiation,
    shadowHours,
    sunExposure
  };
}

/**
 * Generate solar radiation heatmap for entire area
 */
export function generateSolarHeatmap(
  centerLat: number,
  centerLng: number,
  buildings: THREE.Mesh[],
  date: Date,
  gridSize: { width: number; height: number; resolution: number }
): SolarRadiationHeatmap {
  const points: SolarAnalysisPoint[] = [];
  const { width, height, resolution } = gridSize;
  const stepX = width / resolution;
  const stepZ = height / resolution;
  
  let minRadiation = Infinity;
  let maxRadiation = -Infinity;
  let totalRadiation = 0;
  
  // Calculate radiation for each grid point
  for (let x = -width / 2; x < width / 2; x += stepX) {
    for (let z = -height / 2; z < height / 2; z += stepZ) {
      // Convert local coordinates to lat/lng (simplified)
      const latOffset = z / 111000; // meters to degrees
      const lngOffset = x / (111000 * Math.cos(centerLat * Math.PI / 180));
      
      const point = calculatePointRadiation(
        centerLat + latOffset,
        centerLng + lngOffset,
        0, // ground level
        date,
        buildings,
        60
      );
      
      points.push(point);
      minRadiation = Math.min(minRadiation, point.dailyRadiation);
      maxRadiation = Math.max(maxRadiation, point.dailyRadiation);
      totalRadiation += point.dailyRadiation;
    }
  }
  
  const average = totalRadiation / points.length;
  
  return {
    points,
    min: minRadiation,
    max: maxRadiation,
    average
  };
}

/**
 * Create heatmap texture from radiation data
 */
export function createRadiationTexture(
  heatmap: SolarRadiationHeatmap,
  resolution: number
): THREE.DataTexture {
  const size = resolution * resolution;
  const data = new Uint8Array(4 * size);
  
  heatmap.points.forEach((point, i) => {
    // Normalize radiation value to 0-1
    const normalized = (point.dailyRadiation - heatmap.min) / (heatmap.max - heatmap.min);
    
    // Color mapping: blue (low) -> yellow (medium) -> red (high)
    const stride = i * 4;
    if (normalized < 0.5) {
      // Blue to yellow
      const t = normalized * 2;
      data[stride] = Math.floor(t * 255);     // R
      data[stride + 1] = Math.floor(t * 255); // G
      data[stride + 2] = Math.floor((1 - t) * 255); // B
    } else {
      // Yellow to red
      const t = (normalized - 0.5) * 2;
      data[stride] = 255;                     // R
      data[stride + 1] = Math.floor((1 - t) * 255); // G
      data[stride + 2] = 0;                   // B
    }
    data[stride + 3] = 200; // Alpha
  });
  
  const texture = new THREE.DataTexture(data, resolution, resolution);
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Find optimal locations for solar panels
 */
export function findOptimalSolarLocations(
  heatmap: SolarRadiationHeatmap,
  threshold: number = 0.8 // Top 80% of radiation
): SolarAnalysisPoint[] {
  const thresholdRadiation = heatmap.min + (heatmap.max - heatmap.min) * threshold;
  return heatmap.points.filter(p => p.dailyRadiation >= thresholdRadiation);
}

/**
 * Calculate solar access for building facade
 */
export interface FacadeSolarAnalysis {
  orientation: 'north' | 'south' | 'east' | 'west';
  averageRadiation: number;
  suitabilityScore: number; // 0-100
  recommendation: string;
}

export function analyzeFacadeSolar(
  facadeNormal: THREE.Vector3,
  lat: number,
  lng: number,
  date: Date
): FacadeSolarAnalysis {
  const sunPath = calculateDailySunPath(lat, lng, date, 30);
  let totalRadiation = 0;
  
  sunPath.forEach(sunPos => {
    const sunDirection = sunPos.position.clone().normalize().negate();
    const dotProduct = facadeNormal.dot(sunDirection);
    
    if (dotProduct > 0) {
      // Facade is facing the sun
      const solarConstant = 1.367;
      const atmosphericFactor = 0.7;
      totalRadiation += solarConstant * atmosphericFactor * dotProduct * 0.5;
    }
  });
  
  // Determine orientation
  const angle = Math.atan2(facadeNormal.x, facadeNormal.z) * 180 / Math.PI;
  let orientation: 'north' | 'south' | 'east' | 'west';
  if (angle >= -45 && angle < 45) orientation = 'north';
  else if (angle >= 45 && angle < 135) orientation = 'east';
  else if (angle >= -135 && angle < -45) orientation = 'west';
  else orientation = 'south';
  
  // Suitability (south-facing is best in northern hemisphere)
  const suitabilityScore = lat > 0 
    ? (orientation === 'south' ? 100 : orientation === 'east' || orientation === 'west' ? 60 : 30)
    : (orientation === 'north' ? 100 : orientation === 'east' || orientation === 'west' ? 60 : 30);
  
  const recommendation = suitabilityScore > 70 
    ? 'Excellent for solar panels or windows'
    : suitabilityScore > 50 
    ? 'Good for passive solar heating'
    : 'Limited solar potential, consider shading or insulation';
  
  return {
    orientation,
    averageRadiation: totalRadiation,
    suitabilityScore,
    recommendation
  };
}
