// Accurate Solar Radiation Analysis
// Uses SunCalc for sun position and building shadows for radiation calculation

import SunCalc from 'suncalc';
import * as turf from '@turf/turf';

export interface SolarPoint {
  lat: number;
  lng: number;
  totalRadiation: number; // kWh/m²/day
  directRadiation: number; // W/m²
  diffuseRadiation: number; // W/m²
  shadowHours: number; // hours in shadow per day
  sunExposure: number; // 0-1 (percentage of daylight in sun)
}

export interface Building {
  coordinates: number[][];
  height: number;
}

/**
 * Calculate sun position with correct East-to-West movement
 */
export function getSunPosition(lat: number, lng: number, date: Date) {
  const pos = SunCalc.getPosition(date, lat, lng);
  
  // SunCalc azimuth: South = 0, increases clockwise
  // Convert to standard: North = 0°, East = 90°, South = 180°, West = 270°
  let azimuthDegrees = (pos.azimuth * 180 / Math.PI + 180) % 360;
  let altitudeDegrees = pos.altitude * 180 / Math.PI;
  
  return {
    azimuth: azimuthDegrees, // 0-360 degrees (North = 0)
    altitude: altitudeDegrees, // -90 to 90 degrees
    azimuthRadians: pos.azimuth,
    altitudeRadians: pos.altitude
  };
}

/**
 * Calculate sun path for entire day (sunrise to sunset)
 */
export function getDailySunPath(lat: number, lng: number, date: Date): Array<{
  time: Date;
  azimuth: number;
  altitude: number;
  position: { lat: number; lng: number };
}> {
  const times = SunCalc.getTimes(date, lat, lng);
  const sunrise = times.sunrise;
  const sunset = times.sunset;
  
  const path = [];
  const totalMinutes = (sunset.getTime() - sunrise.getTime()) / (1000 * 60);
  const step = 15; // Every 15 minutes
  
  for (let minutes = 0; minutes <= totalMinutes; minutes += step) {
    const time = new Date(sunrise.getTime() + minutes * 60 * 1000);
    const pos = getSunPosition(lat, lng, time);
    
    if (pos.altitude > 0) {
      // Calculate sun marker position on map
      // Convert azimuth to radians: East (90°) to West (270°)
      const azimuthRad = (pos.azimuth - 90) * Math.PI / 180;
      const distance = 0.01; // degrees on map
      
      // East is positive lng, West is negative lng (correct movement)
      const sunLat = lat + distance * Math.sin(azimuthRad) * 0.3; // Less north-south movement
      const sunLng = lng + distance * Math.cos(azimuthRad); // Main east-west movement
      
      path.push({
        time,
        azimuth: pos.azimuth,
        altitude: pos.altitude,
        position: { lat: sunLat, lng: sunLng }
      });
    }
  }
  
  return path;
}

/**
 * Check if a point is in shadow from a building at a specific time
 */
export function isPointInShadow(
  pointLat: number,
  pointLng: number,
  building: Building,
  sunAzimuth: number, // degrees
  sunAltitude: number, // degrees
  lat: number,
  lng: number
): boolean {
  if (sunAltitude <= 0) return true; // Sun below horizon
  
  // Calculate shadow length
  const shadowLength = building.height / Math.tan(sunAltitude * Math.PI / 180);
  
  // Shadow direction (opposite of sun)
  const shadowAzimuth = (sunAzimuth + 180) % 360;
  const shadowAzimuthRad = shadowAzimuth * Math.PI / 180;
  
  // Convert building polygon to shadow polygon
  const buildingPoly = turf.polygon([building.coordinates]);
  const shadowPolygons = [];
  
  // Create shadow for each building vertex
  for (const coord of building.coordinates[0]) {
    const buildingLng = coord[0];
    const buildingLat = coord[1];
    
    // Calculate shadow offset in meters
    const shadowEndLat = buildingLat + (shadowLength * Math.cos(shadowAzimuthRad)) / 111000;
    const shadowEndLng = buildingLng + (shadowLength * Math.sin(shadowAzimuthRad)) / (111000 * Math.cos(buildingLat * Math.PI / 180));
    
    shadowPolygons.push([shadowEndLng, shadowEndLat]);
  }
  
  // Close the polygon
  shadowPolygons.push(shadowPolygons[0]);
  
  try {
    const shadowPoly = turf.polygon([shadowPolygons]);
    const point = turf.point([pointLng, pointLat]);
    
    // Check if point is inside building or its shadow
    return turf.booleanPointInPolygon(point, buildingPoly) || 
           turf.booleanPointInPolygon(point, shadowPoly);
  } catch (e) {
    return false;
  }
}

/**
 * Calculate solar radiation at a point considering shadows
 */
export function calculateSolarRadiation(
  lat: number,
  lng: number,
  date: Date,
  buildings: Building[],
  pointLat: number,
  pointLng: number,
  directRadiation: number, // W/m² from weather API
  diffuseRadiation: number // W/m² from weather API
): SolarPoint {
  const sunPos = getSunPosition(lat, lng, date);
  
  // If sun is below horizon, no radiation
  if (sunPos.altitude <= 0) {
    return {
      lat: pointLat,
      lng: pointLng,
      totalRadiation: 0,
      directRadiation: 0,
      diffuseRadiation: 0,
      shadowHours: 0,
      sunExposure: 0
    };
  }
  
  // Check if point is in shadow
  const inShadow = buildings.some(b => 
    isPointInShadow(pointLat, pointLng, b, sunPos.azimuth, sunPos.altitude, lat, lng)
  );
  
  // Calculate actual radiation at point
  let actualDirectRadiation = 0;
  if (!inShadow) {
    // Adjust for sun angle (cosine law)
    const angleEffect = Math.sin(sunPos.altitudeRadians);
    actualDirectRadiation = directRadiation * angleEffect;
  }
  
  // Diffuse radiation is always present (from sky)
  const actualDiffuseRadiation = diffuseRadiation * 0.5; // Reduced by half in urban areas
  
  const totalRadiation = actualDirectRadiation + actualDiffuseRadiation;
  
  return {
    lat: pointLat,
    lng: pointLng,
    totalRadiation: totalRadiation / 1000, // Convert to kWh/m²
    directRadiation: actualDirectRadiation,
    diffuseRadiation: actualDiffuseRadiation,
    shadowHours: inShadow ? 1 : 0,
    sunExposure: inShadow ? 0 : 1
  };
}

/**
 * Calculate daily solar exposure (shadow hours throughout the day)
 */
export function calculateDailySolarExposure(
  lat: number,
  lng: number,
  date: Date,
  buildings: Building[],
  pointLat: number,
  pointLng: number
): { shadowHours: number; sunExposure: number } {
  const times = SunCalc.getTimes(date, lat, lng);
  const sunrise = times.sunrise;
  const sunset = times.sunset;
  
  let shadowHours = 0;
  let totalHours = 0;
  
  // Check every hour
  const totalMinutes = (sunset.getTime() - sunrise.getTime()) / (1000 * 60);
  const step = 60; // Every hour
  
  for (let minutes = 0; minutes <= totalMinutes; minutes += step) {
    const time = new Date(sunrise.getTime() + minutes * 60 * 1000);
    const sunPos = getSunPosition(lat, lng, time);
    
    if (sunPos.altitude > 0) {
      totalHours++;
      const inShadow = buildings.some(b => 
        isPointInShadow(pointLat, pointLng, b, sunPos.azimuth, sunPos.altitude, lat, lng)
      );
      if (inShadow) shadowHours++;
    }
  }
  
  const sunExposure = totalHours > 0 ? (totalHours - shadowHours) / totalHours : 0;
  
  return { shadowHours, sunExposure };
}
