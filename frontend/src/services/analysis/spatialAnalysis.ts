/**
 * Spatial Analysis Utilities
 * Uses Turf.js for geospatial calculations
 */

import * as turf from '@turf/turf';
import { OSMBuilding, OSMLandUse, OSMAmenity } from './osmAnalysisService';

export interface AnalysisResult {
  metric: string;
  value: number;
  unit: string;
  color: string;
}

/**
 * Calculate green space ratio within bounds
 */
export function calculateGreenSpaceRatio(
  landUses: OSMLandUse[],
  bounds: { north: number; south: number; east: number; west: number }
): number {
  const bbox = turf.bboxPolygon([bounds.west, bounds.south, bounds.east, bounds.north]);
  const totalArea = turf.area(bbox);

  let greenArea = 0;

  landUses.forEach((lu) => {
    if (!lu.geometry || lu.geometry.length < 3) return;

    const category = categorizeLandUse(lu);
    if (category === 'Green Space' || category === 'Recreation') {
      try {
        // Close the polygon if not already closed
        const coords = [...lu.geometry];
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }

        const polygon = turf.polygon([coords]);
        greenArea += turf.area(polygon);
      } catch (error) {
        // Skip invalid geometries
      }
    }
  });

  return totalArea > 0 ? (greenArea / totalArea) * 100 : 0;
}

/**
 * Calculate amenity density (amenities per km²)
 */
export function calculateAmenityDensity(
  amenities: OSMAmenity[],
  bounds: { north: number; south: number; east: number; west: number }
): number {
  const bbox = turf.bboxPolygon([bounds.west, bounds.south, bounds.east, bounds.north]);
  const areaKm2 = turf.area(bbox) / 1_000_000; // Convert m² to km²

  return areaKm2 > 0 ? amenities.length / areaKm2 : 0;
}

/**
 * Calculate building density (buildings per km²)
 */
export function calculateBuildingDensity(
  buildings: OSMBuilding[],
  bounds: { north: number; south: number; east: number; west: number }
): number {
  const bbox = turf.bboxPolygon([bounds.west, bounds.south, bounds.east, bounds.north]);
  const areaKm2 = turf.area(bbox) / 1_000_000;

  return areaKm2 > 0 ? buildings.length / areaKm2 : 0;
}

/**
 * Calculate average building height
 */
export function calculateAverageBuildingHeight(buildings: OSMBuilding[]): number {
  if (buildings.length === 0) return 0;

  const heights = buildings.map((b) => {
    if (b.tags.height) {
      const height = parseFloat(b.tags.height);
      if (!isNaN(height)) return height;
    }

    if (b.tags['building:levels']) {
      const levels = parseFloat(b.tags['building:levels']);
      if (!isNaN(levels)) return levels * 3.5;
    }

    return 10; // Default
  });

  return heights.reduce((sum, h) => sum + h, 0) / heights.length;
}

/**
 * Group amenities by category
 */
export function groupAmenitiesByCategory(amenities: OSMAmenity[]): { [category: string]: number } {
  const categories: { [key: string]: number } = {};

  amenities.forEach((amenity) => {
    const category = categorizeAmenity(amenity);
    categories[category] = (categories[category] || 0) + 1;
  });

  return categories;
}

/**
 * Calculate land use distribution
 */
export function calculateLandUseDistribution(landUses: OSMLandUse[]): { [category: string]: number } {
  const distribution: { [key: string]: number } = {};
  let totalArea = 0;

  landUses.forEach((lu) => {
    if (!lu.geometry || lu.geometry.length < 3) return;

    const category = categorizeLandUse(lu);
    
    try {
      const coords = [...lu.geometry];
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }

      const polygon = turf.polygon([coords]);
      const area = turf.area(polygon);

      distribution[category] = (distribution[category] || 0) + area;
      totalArea += area;
    } catch (error) {
      // Skip invalid geometries
    }
  });

  // Convert to percentages
  const percentages: { [key: string]: number } = {};
  Object.keys(distribution).forEach((category) => {
    percentages[category] = totalArea > 0 ? (distribution[category] / totalArea) * 100 : 0;
  });

  return percentages;
}

/**
 * Calculate street network density (km of roads per km²)
 */
export function calculateStreetDensity(
  streets: { geometry: [number, number][] }[],
  bounds: { north: number; south: number; east: number; west: number }
): number {
  const bbox = turf.bboxPolygon([bounds.west, bounds.south, bounds.east, bounds.north]);
  const areaKm2 = turf.area(bbox) / 1_000_000;

  let totalLengthKm = 0;

  streets.forEach((street) => {
    try {
      const line = turf.lineString(street.geometry);
      const lengthKm = turf.length(line, { units: 'kilometers' });
      totalLengthKm += lengthKm;
    } catch (error) {
      // Skip invalid geometries
    }
  });

  return areaKm2 > 0 ? totalLengthKm / areaKm2 : 0;
}

/**
 * Generate heatmap grid for building heights
 */
export function generateBuildingHeightHeatmap(
  buildings: OSMBuilding[],
  bounds: { north: number; south: number; east: number; west: number },
  gridSize: number = 50 // meters
): Array<{ lat: number; lon: number; value: number }> {
  const cellWidth = (bounds.east - bounds.west) / gridSize;
  const cellHeight = (bounds.north - bounds.south) / gridSize;

  const grid: Array<{ lat: number; lon: number; value: number }> = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lon = bounds.west + cellWidth * (i + 0.5);
      const lat = bounds.south + cellHeight * (j + 0.5);

      const cellCenter = turf.point([lon, lat]);
      const nearby = buildings.filter((b) => {
        const buildingPoint = turf.point([b.lon, b.lat]);
        const distance = turf.distance(cellCenter, buildingPoint, { units: 'meters' });
        return distance < 100; // Consider buildings within 100m
      });

      if (nearby.length > 0) {
        const avgHeight =
          nearby.reduce((sum, b) => {
            const height = parseFloat(b.tags.height || '0') || parseFloat(b.tags['building:levels'] || '0') * 3.5 || 10;
            return sum + height;
          }, 0) / nearby.length;

        grid.push({ lat, lon, value: avgHeight });
      }
    }
  }

  return grid;
}

/**
 * Helper: Categorize amenity
 */
function categorizeAmenity(amenity: OSMAmenity): string {
  const tag = amenity.tags.amenity || amenity.tags.shop || amenity.tags.tourism || 'other';

  if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(tag)) return 'Food & Drink';
  if (['school', 'university', 'college', 'library'].includes(tag)) return 'Education';
  if (['hospital', 'clinic', 'pharmacy', 'doctors'].includes(tag)) return 'Healthcare';
  if (['bank', 'atm', 'post_office'].includes(tag)) return 'Finance';
  if (['supermarket', 'convenience', 'mall', 'department_store'].includes(tag)) return 'Shopping';
  if (['park', 'playground', 'sports_centre', 'swimming_pool'].includes(tag)) return 'Recreation';
  if (['bus_station', 'parking', 'fuel', 'taxi'].includes(tag)) return 'Transport';

  return 'Other';
}

/**
 * Helper: Categorize land use
 */
function categorizeLandUse(landUse: OSMLandUse): string {
  if (landUse.tags.landuse) {
    const lu = landUse.tags.landuse;
    if (['residential', 'apartments'].includes(lu)) return 'Residential';
    if (['commercial', 'retail'].includes(lu)) return 'Commercial';
    if (['industrial', 'construction'].includes(lu)) return 'Industrial';
    if (['grass', 'meadow', 'greenfield', 'forest', 'farmland'].includes(lu)) return 'Green Space';
    if (['recreation_ground'].includes(lu)) return 'Recreation';
  }

  if (landUse.tags.leisure) return 'Recreation';
  if (landUse.tags.natural) return 'Green Space';

  return 'Other';
}

/**
 * Calculate solar exposure score (0-100) based on building density and heights
 * Higher score = better solar access
 */
export function calculateSolarExposure(
  buildings: OSMBuilding[],
  location: { lat: number; lon: number },
  radius: number = 100 // meters
): number {
  const point = turf.point([location.lon, location.lat]);
  
  // Find nearby buildings that could cast shadows
  const nearbyBuildings = buildings.filter((b) => {
    const buildingPoint = turf.point([b.lon, b.lat]);
    const distance = turf.distance(point, buildingPoint, { units: 'meters' });
    return distance < radius && distance > 0;
  });

  if (nearbyBuildings.length === 0) return 100; // Perfect exposure

  // Calculate obstruction factor based on nearby building heights and distances
  let obstructionScore = 0;

  nearbyBuildings.forEach((b) => {
    const buildingPoint = turf.point([b.lon, b.lat]);
    const distance = turf.distance(point, buildingPoint, { units: 'meters' });
    const height = parseFloat(b.tags.height || '0') || parseFloat(b.tags['building:levels'] || '0') * 3.5 || 10;

    // Buildings cast more shadow when they're taller and closer
    const obstruction = (height / distance) * 100;
    obstructionScore += obstruction;
  });

  // Normalize to 0-100 scale (inverse relationship)
  const exposure = Math.max(0, 100 - Math.min(100, obstructionScore));

  return exposure;
}
