/**
 * OSM Analysis Service
 * Fetches real geospatial data from OpenStreetMap via Overpass API
 */

export interface OSMBuilding {
  id: string;
  lat: number;
  lon: number;
  tags: {
    'building:levels'?: string;
    building?: string;
    height?: string;
    roof_height?: string;
  };
  geometry?: [number, number][];
}

export interface OSMLandUse {
  id: string;
  lat: number;
  lon: number;
  tags: {
    landuse?: string;
    amenity?: string;
    leisure?: string;
    natural?: string;
  };
  geometry?: [number, number][];
}

export interface OSMAmenity {
  id: string;
  lat: number;
  lon: number;
  tags: {
    amenity?: string;
    shop?: string;
    tourism?: string;
    name?: string;
  };
}

export interface OSMStreet {
  id: string;
  tags: {
    highway?: string;
    name?: string;
  };
  geometry: [number, number][];
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Build Overpass QL query for bounding box
 */
function buildBoundingBox(bounds: { north: number; south: number; east: number; west: number }): string {
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

/**
 * Fetch building data with height information
 */
export async function fetchBuildings(bounds: { north: number; south: number; east: number; west: number }): Promise<OSMBuilding[]> {
  const bbox = buildBoundingBox(bounds);
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await response.json();
    
    // Convert OSM elements to building objects
    const buildings: OSMBuilding[] = [];
    const nodes: { [id: string]: { lat: number; lon: number } } = {};

    // First pass: collect all nodes
    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    });

    // Second pass: build ways and relations
    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.tags?.building) {
        const geometry = el.nodes?.map((nodeId: number) => {
          const node = nodes[nodeId];
          return node ? [node.lon, node.lat] as [number, number] : null;
        }).filter(Boolean);

        const center = geometry && geometry.length > 0 ? getCentroid(geometry) : { lat: 0, lon: 0 };

        buildings.push({
          id: el.id.toString(),
          lat: center.lat,
          lon: center.lon,
          tags: el.tags,
          geometry,
        });
      }
    });

    return buildings;
  } catch (error) {
    console.error('Error fetching buildings:', error);
    return [];
  }
}

/**
 * Fetch land use data
 */
export async function fetchLandUse(bounds: { north: number; south: number; east: number; west: number }): Promise<OSMLandUse[]> {
  const bbox = buildBoundingBox(bounds);
  const query = `
    [out:json][timeout:25];
    (
      way["landuse"](${bbox});
      way["leisure"](${bbox});
      way["natural"](${bbox});
      relation["landuse"](${bbox});
      relation["leisure"](${bbox});
      relation["natural"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await response.json();
    
    const landUses: OSMLandUse[] = [];
    const nodes: { [id: string]: { lat: number; lon: number } } = {};

    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    });

    data.elements.forEach((el: any) => {
      if (el.type === 'way' && (el.tags?.landuse || el.tags?.leisure || el.tags?.natural)) {
        const geometry = el.nodes?.map((nodeId: number) => {
          const node = nodes[nodeId];
          return node ? [node.lon, node.lat] as [number, number] : null;
        }).filter(Boolean);

        const center = geometry && geometry.length > 0 ? getCentroid(geometry) : { lat: 0, lon: 0 };

        landUses.push({
          id: el.id.toString(),
          lat: center.lat,
          lon: center.lon,
          tags: el.tags,
          geometry,
        });
      }
    });

    return landUses;
  } catch (error) {
    console.error('Error fetching land use:', error);
    return [];
  }
}

/**
 * Fetch amenities (POIs)
 */
export async function fetchAmenities(bounds: { north: number; south: number; east: number; west: number }): Promise<OSMAmenity[]> {
  const bbox = buildBoundingBox(bounds);
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"](${bbox});
      node["shop"](${bbox});
      node["tourism"](${bbox});
    );
    out body;
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await response.json();
    
    return data.elements
      .filter((el: any) => el.type === 'node')
      .map((el: any) => ({
        id: el.id.toString(),
        lat: el.lat,
        lon: el.lon,
        tags: el.tags,
      }));
  } catch (error) {
    console.error('Error fetching amenities:', error);
    return [];
  }
}

/**
 * Fetch street network
 */
export async function fetchStreetNetwork(bounds: { north: number; south: number; east: number; west: number }): Promise<OSMStreet[]> {
  const bbox = buildBoundingBox(bounds);
  const query = `
    [out:json][timeout:25];
    (
      way["highway"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await response.json();
    
    const streets: OSMStreet[] = [];
    const nodes: { [id: string]: { lat: number; lon: number } } = {};

    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    });

    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.tags?.highway) {
        const geometry = el.nodes?.map((nodeId: number) => {
          const node = nodes[nodeId];
          return node ? [node.lon, node.lat] as [number, number] : null;
        }).filter(Boolean);

        if (geometry && geometry.length > 0) {
          streets.push({
            id: el.id.toString(),
            tags: el.tags,
            geometry,
          });
        }
      }
    });

    return streets;
  } catch (error) {
    console.error('Error fetching street network:', error);
    return [];
  }
}

/**
 * Calculate centroid of polygon
 */
function getCentroid(coords: [number, number][]): { lat: number; lon: number } {
  if (!coords || coords.length === 0) return { lat: 0, lon: 0 };
  
  const sum = coords.reduce(
    (acc, coord) => ({
      lon: acc.lon + coord[0],
      lat: acc.lat + coord[1],
    }),
    { lon: 0, lat: 0 }
  );

  return {
    lon: sum.lon / coords.length,
    lat: sum.lat / coords.length,
  };
}

/**
 * Estimate building height from levels or height tag
 */
export function estimateBuildingHeight(building: OSMBuilding): number {
  if (building.tags.height) {
    const height = parseFloat(building.tags.height);
    if (!isNaN(height)) return height;
  }

  if (building.tags['building:levels']) {
    const levels = parseFloat(building.tags['building:levels']);
    if (!isNaN(levels)) return levels * 3.5; // Assume 3.5m per floor
  }

  // Default for buildings with no height data
  return 10; // Conservative 2-3 story estimate
}

/**
 * Categorize land use type
 */
export function categorizeLandUse(landUse: OSMLandUse): string {
  if (landUse.tags.landuse) {
    const lu = landUse.tags.landuse;
    if (['residential', 'apartments'].includes(lu)) return 'Residential';
    if (['commercial', 'retail'].includes(lu)) return 'Commercial';
    if (['industrial', 'construction'].includes(lu)) return 'Industrial';
    if (['grass', 'meadow', 'greenfield', 'forest', 'farmland'].includes(lu)) return 'Green Space';
    if (['recreation_ground'].includes(lu)) return 'Recreation';
  }

  if (landUse.tags.leisure) {
    return 'Recreation';
  }

  if (landUse.tags.natural) {
    return 'Green Space';
  }

  return 'Other';
}
