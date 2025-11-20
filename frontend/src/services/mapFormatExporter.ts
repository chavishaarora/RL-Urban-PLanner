// Service for exporting context maps in multiple formats: PNG, SVG, GeoJSON

import { LocationData } from '../types';
import {
  OSMBuildingPolygon,
  fetchOSMBuildingsAround,
  BUILDING_TYPE_COLORS,
  HEIGHT_RANGE_COLORS,
  AGE_BUCKET_COLORS,
  COVERAGE_LEVEL_COLORS,
  classifyBuildingType,
  classifyBuildingHeight,
  classifyBuildingAge,
  classifyBuildingCoverage,
  computePolygonAreaMeters,
  OSMLandUsePolygon,
  fetchOSMLandUseAround,
  LANDUSE_TYPE_COLORS,
  OSMRoadSegment,
  fetchOSMRoadsAround,
  ROAD_TYPE_COLORS,
} from './osmBuildings';

export type ExportFormat = 'png' | 'svg' | 'geojson';

export interface MapExportOptions {
  format: ExportFormat;
  maps?: string[]; // specific maps to export, or all if undefined
  includeMetadata?: boolean;
}

// GeoJSON Feature Collection structure with layer organization
interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'LineString';
    coordinates: number[][] | number[][][];
  };
  properties: Record<string, any>;
}

interface GeoJSONLayer {
  name: string;
  color: string;
  category: string;
  features: GeoJSONFeature[];
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  layers?: GeoJSONLayer[]; // Organized layers for easier filtering
  metadata?: {
    location: string;
    bounds: { south: number; west: number; north: number; east: number };
    exported: string;
    source: string;
    layerCount?: number;
    featureCount?: number;
  };
}

// Convert OSM building polygon to GeoJSON feature
function buildingToGeoJSON(building: OSMBuildingPolygon, analysisType: 'type' | 'height' | 'age'): GeoJSONFeature {
  const coordinates = [building.nodes.map(node => [node.lng, node.lat])];
  
  let properties: Record<string, any> = {
    id: building.id,
    ...building.tags,
  };

  if (analysisType === 'type') {
    const buildingType = classifyBuildingType(building.tags);
    properties.buildingType = buildingType;
    properties.color = BUILDING_TYPE_COLORS[buildingType];
  } else if (analysisType === 'height') {
    const heightInfo = classifyBuildingHeight(building.tags);
    properties.estimatedHeight = heightInfo.meters;
    properties.heightRange = heightInfo.range;
    properties.color = HEIGHT_RANGE_COLORS[heightInfo.range];
  } else if (analysisType === 'age') {
    const ageInfo = classifyBuildingAge(building.tags);
    properties.buildingAge = ageInfo.bucket;
    properties.buildYear = ageInfo.year;
    properties.color = AGE_BUCKET_COLORS[ageInfo.bucket];
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates,
    },
    properties,
  };
}

// Convert land use polygon to GeoJSON
function landUseToGeoJSON(landUse: OSMLandUsePolygon): GeoJSONFeature {
  const coordinates = [landUse.nodes.map(node => [node.lng, node.lat])];
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates,
    },
    properties: {
      id: landUse.id,
      landUseType: landUse.landUseType,
      color: LANDUSE_TYPE_COLORS[landUse.landUseType],
      ...landUse.tags,
    },
  };
}

// Convert road segment to GeoJSON
function roadToGeoJSON(road: OSMRoadSegment): GeoJSONFeature {
  const coordinates = road.nodes.map(node => [node.lng, node.lat]);
  
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {
      id: road.id,
      roadType: road.roadType,
      color: ROAD_TYPE_COLORS[road.roadType],
      name: road.tags.name || 'Unnamed',
      ...road.tags,
    },
  };
}

// Organize GeoJSON features into layers by category/color
function organizeGeoJSONLayers(geoJSON: GeoJSONFeatureCollection): GeoJSONFeatureCollection {
  const layerMap: Map<string, GeoJSONLayer> = new Map();

  geoJSON.features.forEach(feature => {
    const color = feature.properties.color || '#cccccc';
    const category = feature.properties.buildingType || 
                    feature.properties.landUseType || 
                    feature.properties.roadType || 
                    feature.properties.heightRange ||
                    feature.properties.buildingAge ||
                    feature.properties.coverageLevel ||
                    'Other';
    
    const key = `${category}_${color}`;
    
    if (!layerMap.has(key)) {
      layerMap.set(key, {
        name: category,
        color,
        category,
        features: [],
      });
    }
    layerMap.get(key)!.features.push(feature);
  });

  const layers = Array.from(layerMap.values()).sort((a, b) => 
    a.category.localeCompare(b.category)
  );

  return {
    ...geoJSON,
    layers,
    metadata: {
      ...geoJSON.metadata!,
      layerCount: layers.length,
      featureCount: geoJSON.features.length,
    },
  };
}

// Export Building Analysis maps as GeoJSON
async function exportBuildingAnalysisGeoJSON(
  location: LocationData,
  analysisType: 'type' | 'height' | 'footprint' | 'age'
): Promise<GeoJSONFeatureCollection> {
  const result = await fetchOSMBuildingsAround(
    { lat: location.latitude, lng: location.longitude },
    600
  );

  if (!result) {
    throw new Error('Failed to fetch building data');
  }

  const features: GeoJSONFeature[] = result.buildings.map(building => {
    if (analysisType === 'footprint') {
      // For footprint, classify by coverage level based on area
      const area = computePolygonAreaMeters(building.nodes);
      const coverageLevel = classifyBuildingCoverage(building.tags, area);
      const color = COVERAGE_LEVEL_COLORS[coverageLevel];
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [building.nodes.map(node => [node.lng, node.lat])],
        },
        properties: {
          id: building.id,
          coverageLevel,
          color,
          area,
          ...building.tags,
        },
      };
    }
    return buildingToGeoJSON(building, analysisType as 'type' | 'height' | 'age');
  });

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      location: location.name,
      bounds: result.bbox,
      exported: new Date().toISOString(),
      source: 'OpenStreetMap',
    },
  };
}

// Export Land Use map as GeoJSON
async function exportLandUseGeoJSON(location: LocationData): Promise<GeoJSONFeatureCollection> {
  const landUsePolygons = await fetchOSMLandUseAround(
    { lat: location.latitude, lng: location.longitude },
    600
  );

  const features: GeoJSONFeature[] = landUsePolygons.map(landUseToGeoJSON);

  // Calculate bounds
  const lats = landUsePolygons.flatMap(p => p.nodes.map(n => n.lat));
  const lngs = landUsePolygons.flatMap(p => p.nodes.map(n => n.lng));
  
  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      location: location.name,
      bounds: {
        south: Math.min(...lats),
        north: Math.max(...lats),
        west: Math.min(...lngs),
        east: Math.max(...lngs),
      },
      exported: new Date().toISOString(),
      source: 'OpenStreetMap',
    },
  };
}

// Export Road Network as GeoJSON
async function exportRoadNetworkGeoJSON(location: LocationData): Promise<GeoJSONFeatureCollection> {
  const roads = await fetchOSMRoadsAround(
    { lat: location.latitude, lng: location.longitude },
    600
  );

  const features: GeoJSONFeature[] = roads.map(roadToGeoJSON);

  // Calculate bounds
  const lats = roads.flatMap(r => r.nodes.map(n => n.lat));
  const lngs = roads.flatMap(r => r.nodes.map(n => n.lng));

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      location: location.name,
      bounds: {
        south: Math.min(...lats),
        north: Math.max(...lats),
        west: Math.min(...lngs),
        east: Math.max(...lngs),
      },
      exported: new Date().toISOString(),
      source: 'OpenStreetMap',
    },
  };
}

// Convert GeoJSON to SVG with color-based layers for easier editing in Illustrator
function geoJSONToSVG(
  geoJSON: GeoJSONFeatureCollection,
  mapName: string,
  width: number = 1200,
  height: number = 1200
): string {
  const { metadata } = geoJSON;
  if (!metadata) throw new Error('Metadata required for SVG export');

  const { bounds } = metadata;
  
  // Calculate the aspect ratio in meters (approximately)
  const centerLat = (bounds.north + bounds.south) / 2;
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  
  // Convert to approximate meters (at the center latitude)
  const metersPerDegreeLat = 111320; // roughly constant
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  
  const heightMeters = latRange * metersPerDegreeLat;
  const widthMeters = lngRange * metersPerDegreeLng;
  
  // Add padding
  const padding = 80;
  const drawWidth = width - 2 * padding;
  const drawHeight = height - 2 * padding;
  
  // Calculate scale based on the actual aspect ratio in meters
  const scaleX = drawWidth / widthMeters;
  const scaleY = drawHeight / heightMeters;
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate actual drawing dimensions
  const actualWidth = widthMeters * scale;
  const actualHeight = heightMeters * scale;
  
  // Center the map in the canvas
  const offsetX = padding + (drawWidth - actualWidth) / 2;
  const offsetY = padding + (drawHeight - actualHeight) / 2;
  
  const coordToSVG = (lng: number, lat: number): [number, number] => {
    // Convert lat/lng to meters from the bounds origin
    const xMeters = (lng - bounds.west) * metersPerDegreeLng;
    const yMeters = (bounds.north - lat) * metersPerDegreeLat; // Flip Y for SVG
    
    // Apply scale and offset
    const x = offsetX + xMeters * scale;
    const y = offsetY + yMeters * scale;
    return [x, y];
  };

  // Group features by color and category for layer organization
  const layerGroups: Map<string, {
    color: string;
    category: string;
    features: GeoJSONFeature[];
  }> = new Map();

  geoJSON.features.forEach(feature => {
    const color = feature.properties.color || '#cccccc';
    const category = feature.properties.buildingType || 
                    feature.properties.landUseType || 
                    feature.properties.roadType || 
                    feature.properties.heightRange ||
                    feature.properties.buildingAge ||
                    'Other';
    
    const key = `${category}_${color}`;
    
    if (!layerGroups.has(key)) {
      layerGroups.set(key, { color, category, features: [] });
    }
    layerGroups.get(key)!.features.push(feature);
  });

  // Start SVG
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- UrbanEyes Context Map Export -->
  <!-- Organized in layers by category/color for easy editing in Illustrator -->
  <defs>
    <style>
      .layer { opacity: 1; }
      .layer:hover { opacity: 0.8; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <g id="${mapName}">
`;

  // Render each layer group
  const sortedLayers = Array.from(layerGroups.entries()).sort((a, b) => 
    a[1].category.localeCompare(b[1].category)
  );

  sortedLayers.forEach(([key, group], groupIdx) => {
    const layerName = group.category.replace(/\s+/g, '_');
    const featureCount = group.features.length;
    
    svgContent += `\n    <!-- Layer: ${group.category} (${featureCount} features, ${group.color}) -->\n`;
    svgContent += `    <g id="layer_${layerName}" class="layer" data-category="${group.category}" data-color="${group.color}">\n`;
    
    group.features.forEach((feature, featureIdx) => {
      const color = group.color;
      
      if (feature.geometry.type === 'Polygon') {
        const rings = feature.geometry.coordinates as number[][][];
        rings.forEach((ring, ringIdx) => {
          const points = ring.map(([lng, lat]) => coordToSVG(lng, lat));
          const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';
          const featureId = `${layerName}_${featureIdx}_${ringIdx}`;
          svgContent += `      <path id="${featureId}" d="${pathData}" fill="${color}" stroke="#ffffff" stroke-width="0.5" opacity="0.8"/>\n`;
        });
      } else if (feature.geometry.type === 'LineString') {
        const points = (feature.geometry.coordinates as number[][]).map(([lng, lat]) => coordToSVG(lng, lat));
        const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
        const strokeWidth = feature.properties.roadType === 'Primary' ? 3 : 
                            feature.properties.roadType === 'Secondary' ? 2 : 1.5;
        const featureId = `${layerName}_${featureIdx}`;
        svgContent += `      <path id="${featureId}" d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="0.9"/>\n`;
      }
    });
    
    svgContent += `    </g>\n`;
  });

  // Add title and metadata layer (always on top)
  svgContent += `\n    <!-- Title and Metadata Layer -->\n`;
  svgContent += `    <g id="layer_Title_Metadata" class="layer">\n`;
  svgContent += `      <text x="${width / 2}" y="30" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#1e293b">${mapName}</text>\n`;
  svgContent += `      <text x="${width / 2}" y="50" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#64748b">${metadata.location}</text>\n`;
  svgContent += `      <text x="20" y="${height - 20}" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8">Exported: ${new Date().toLocaleDateString()} | Source: OpenStreetMap</text>\n`;
  svgContent += `    </g>\n`;

  svgContent += `  </g>
</svg>`;

  return svgContent;
}

// Download a file with given content
function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Main export function for individual maps
export async function exportContextMap(
  location: LocationData,
  mapType: string,
  format: ExportFormat
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = `${location.name}_${mapType}_${timestamp}`;

  try {
    let geoJSON: GeoJSONFeatureCollection;

    // Fetch data based on map type
    switch (mapType) {
      case 'BuildingTypes':
        geoJSON = await exportBuildingAnalysisGeoJSON(location, 'type');
        break;
      case 'BuildingHeight':
        geoJSON = await exportBuildingAnalysisGeoJSON(location, 'height');
        break;
      case 'BuildingFootprint':
        geoJSON = await exportBuildingAnalysisGeoJSON(location, 'footprint');
        break;
      case 'BuildingAge':
        geoJSON = await exportBuildingAnalysisGeoJSON(location, 'age');
        break;
      case 'LandUse':
        geoJSON = await exportLandUseGeoJSON(location);
        break;
      case 'PopulationDensity':
        // Population density uses rendered visualization, fallback to PNG only
        throw new Error('Population Density map only supports PNG export');
      case 'StreetHierarchy':
      case 'Accessibility':
        geoJSON = await exportRoadNetworkGeoJSON(location);
        break;
      default:
        throw new Error(`Unknown map type: ${mapType}`);
    }

    // Export in requested format
    if (format === 'geojson') {
      // Organize features into layers for easier filtering in GIS software
      const organizedGeoJSON = organizeGeoJSONLayers(geoJSON);
      const content = JSON.stringify(organizedGeoJSON, null, 2);
      downloadFile(content, `${baseFilename}.geojson`, 'application/geo+json');
    } else if (format === 'svg') {
      const svg = geoJSONToSVG(geoJSON, mapType, 1200, 1200);
      downloadFile(svg, `${baseFilename}.svg`, 'image/svg+xml');
    } else {
      throw new Error('PNG export should use the existing mapExportService');
    }

  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

// Get available formats for a map type
export function getAvailableFormats(mapType: string): ExportFormat[] {
  // Population Density only supports PNG (rendered visualization)
  if (mapType === 'PopulationDensity') {
    return ['png'];
  }
  // All other maps support all three formats
  return ['png', 'svg', 'geojson'];
}
