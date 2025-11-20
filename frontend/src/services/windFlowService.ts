// Wind Flow Simulation with Urban Canyon Effects
// Uses Simplex Noise for turbulence and building wake effects

import { createNoise2D } from 'simplex-noise';
import * as turf from '@turf/turf';

export interface WindPoint {
  lat: number;
  lng: number;
  speed: number; // m/s
  direction: number; // degrees
  turbulence: number; // 0-1
  gustiness: number; // m/s variation
}

export interface Building {
  coordinates: number[][];
  height: number;
}

const noise2D = createNoise2D();

/**
 * Calculate wind speed at a point considering building effects
 * Uses simplified CFD principles:
 * - Upstream: flow deceleration
 * - Sides: acceleration (Venturi effect)
 * - Downstream: wake/turbulence
 */
export function calculateWindAtPoint(
  pointLat: number,
  pointLng: number,
  baseWindSpeed: number,
  baseWindDirection: number, // degrees
  buildings: Building[],
  lat: number,
  lng: number
): WindPoint {
  let effectiveSpeed = baseWindSpeed;
  let effectiveTurbulence = 0.1; // Base turbulence
  let effectiveGustiness = 0.5;
  
  const windDirRad = (baseWindDirection - 90) * Math.PI / 180; // Convert to radians
  
  // Check each building's effect on this point
  for (const building of buildings) {
    try {
      const buildingPoly = turf.polygon([building.coordinates]);
      const buildingCenter = turf.centroid(buildingPoly);
      const buildingBbox = turf.bbox(buildingPoly);
      const buildingWidth = turf.distance(
        [buildingBbox[0], buildingBbox[1]], 
        [buildingBbox[2], buildingBbox[1]], 
        { units: 'meters' }
      );
      
      const point = turf.point([pointLng, pointLat]);
      const distanceToBuilding = turf.distance(
        buildingCenter.geometry.coordinates,
        [pointLng, pointLat],
        { units: 'meters' }
      );
      
      // Calculate angle from building to point
      const bearing = turf.bearing(buildingCenter.geometry.coordinates, [pointLng, pointLat]);
      const relativeAngle = ((bearing - baseWindDirection + 360) % 360);
      
      // Building influence radius
      const influenceRadius = Math.max(building.height * 5, buildingWidth * 3);
      
      if (distanceToBuilding < influenceRadius) {
        const influenceFactor = 1 - (distanceToBuilding / influenceRadius);
        
        // UPSTREAM (windward side): Deceleration
        if (relativeAngle > 135 && relativeAngle < 225) {
          effectiveSpeed *= (1 - 0.4 * influenceFactor);
          effectiveTurbulence += 0.2 * influenceFactor;
        }
        
        // SIDES: Acceleration (Venturi effect)
        else if ((relativeAngle > 45 && relativeAngle < 135) || 
                 (relativeAngle > 225 && relativeAngle < 315)) {
          effectiveSpeed *= (1 + 0.3 * influenceFactor);
          effectiveTurbulence += 0.3 * influenceFactor;
          effectiveGustiness += 1.5 * influenceFactor;
        }
        
        // DOWNSTREAM (leeward side): Wake zone
        else {
          const wakeFactor = Math.min(building.height / 20, 1);
          effectiveSpeed *= (1 - 0.6 * influenceFactor * wakeFactor);
          effectiveTurbulence += 0.5 * influenceFactor;
          effectiveGustiness += 2.0 * influenceFactor;
        }
      }
    } catch (e) {
      // Skip invalid buildings
      continue;
    }
  }
  
  // Add procedural turbulence using Simplex noise
  const noiseValue = noise2D(pointLat * 1000, pointLng * 1000);
  effectiveSpeed *= (1 + noiseValue * 0.15); // ±15% variation
  
  // Ensure speed stays positive
  effectiveSpeed = Math.max(0.5, effectiveSpeed);
  effectiveTurbulence = Math.min(1, effectiveTurbulence);
  
  return {
    lat: pointLat,
    lng: pointLng,
    speed: effectiveSpeed,
    direction: baseWindDirection,
    turbulence: effectiveTurbulence,
    gustiness: effectiveGustiness
  };
}

/**
 * Calculate pedestrian wind comfort category
 * Based on NEN 8100 standard (Dutch wind comfort criteria)
 */
export function getWindComfortCategory(
  windSpeed: number,
  gustiness: number
): {
  category: 'comfortable' | 'acceptable' | 'uncomfortable' | 'dangerous';
  color: string;
  description: string;
} {
  const effectiveSpeed = windSpeed + gustiness;
  
  if (effectiveSpeed < 5) {
    return {
      category: 'comfortable',
      color: '#4CAF50', // Green
      description: 'Comfortable for sitting and standing'
    };
  } else if (effectiveSpeed < 10) {
    return {
      category: 'acceptable',
      color: '#FFC107', // Yellow
      description: 'Acceptable for walking'
    };
  } else if (effectiveSpeed < 15) {
    return {
      category: 'uncomfortable',
      color: '#FF9800', // Orange
      description: 'Uncomfortable, fast walking necessary'
    };
  } else {
    return {
      category: 'dangerous',
      color: '#F44336', // Red
      description: 'Dangerous conditions, avoid area'
    };
  }
}

/**
 * Generate wind flow vectors for visualization
 */
export function generateWindFlowVectors(
  centerLat: number,
  centerLng: number,
  radius: number, // meters
  gridSize: number, // meters
  baseWindSpeed: number,
  baseWindDirection: number,
  buildings: Building[]
): WindPoint[] {
  const vectors: WindPoint[] = [];
  
  for (let x = -radius; x <= radius; x += gridSize) {
    for (let y = -radius; y <= radius; y += gridSize) {
      const latOffset = y / 111000;
      const lngOffset = x / (111000 * Math.cos(centerLat * Math.PI / 180));
      
      const pointLat = centerLat + latOffset;
      const pointLng = centerLng + lngOffset;
      
      const windData = calculateWindAtPoint(
        pointLat,
        pointLng,
        baseWindSpeed,
        baseWindDirection,
        buildings,
        centerLat,
        centerLng
      );
      
      vectors.push(windData);
    }
  }
  
  return vectors;
}
