// Service to fetch pedestrian-level spaces for environmental analysis
// Fetches roads, parks, plazas, walkways, and open spaces where people actually experience environmental conditions

export interface PedestrianSpace {
  id: string;
  type: 'road' | 'park' | 'plaza' | 'walkway' | 'parking' | 'courtyard' | 'water';
  geometry: { lat: number; lng: number }[];
  width?: number; // estimated width in meters for roads/paths
  tags: Record<string, any>;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// Simple cache to prevent duplicate requests
const requestCache = new Map<string, { data: PedestrianSpace[], timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased from 5)

function buildPedestrianSpacesQuery(bbox: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bbox;
  
  return `[out:json][timeout:25];
(
  // Major roads only (exclude minor paths to reduce data)
  way["highway"~"primary|secondary|tertiary|residential|pedestrian|footway"](${south},${west},${north},${east});
  
  // Parks and green spaces
  way["leisure"~"park|garden|playground"](${south},${west},${north},${east});
  relation["leisure"~"park|garden|playground"](${south},${west},${north},${east});
  
  // Plazas and squares
  way["place"="square"](${south},${west},${north},${east});
  way["highway"="pedestrian"](${south},${west},${north},${east});

  // Water bodies
  way["natural"="water"](${south},${west},${north},${east});
  way["waterway"~"river|canal|stream"](${south},${west},${north},${east});
  relation["natural"="water"](${south},${west},${north},${east});
);
(._;>;);
out body;`;
}

async function tryFetchPedestrianSpaces(query: string): Promise<any | null> {
  for (let endpointIndex = 0; endpointIndex < OVERPASS_ENDPOINTS.length; endpointIndex++) {
    const url = OVERPASS_ENDPOINTS[endpointIndex];
    
    // Exponential backoff: 3s, 6s delays between attempts
    if (endpointIndex > 0) {
      const delay = Math.pow(2, endpointIndex) * 3000; // Increased from 1000 to 3000
      console.log(`Waiting ${delay}ms before trying next endpoint...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ data: query })
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`Overpass endpoint ${url} rate limited (429) - waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds on 429
          continue;
        }
        if (res.status === 504) {
          console.warn(`Overpass endpoint ${url} timeout (504) - trying next...`);
          continue;
        }
        console.warn(`Overpass endpoint ${url} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.warn(`Failed to fetch from ${url}:`, err);
      continue;
    }
  }
  
  console.error('All Overpass endpoints failed or timed out');
  return null;
}

function classifySpaceType(tags: Record<string, any>): PedestrianSpace['type'] {
  if (tags.highway) {
    if (tags.highway === 'pedestrian' || tags.highway === 'footway' || tags.highway === 'steps') {
      return 'walkway';
    }
    return 'road';
  }
  if (tags.leisure) return 'park';
  if (tags.place === 'square') return 'plaza';
  if (tags.amenity === 'parking') return 'parking';
  if (tags.place === 'courtyard') return 'courtyard';
  if (tags.natural === 'water' || tags.waterway) return 'water';
  return 'road';
}

function estimateWidth(tags: Record<string, any>, type: PedestrianSpace['type']): number {
  // If width is explicitly tagged
  if (tags.width) {
    const w = parseFloat(tags.width);
    if (!isNaN(w)) return w;
  }

  // Estimate based on highway type
  if (tags.highway) {
    const widths: Record<string, number> = {
      'motorway': 12,
      'trunk': 10,
      'primary': 8,
      'secondary': 7,
      'tertiary': 6,
      'residential': 5,
      'unclassified': 4,
      'service': 3,
      'living_street': 4,
      'pedestrian': 4,
      'footway': 2,
      'path': 1.5,
      'cycleway': 2,
      'steps': 2
    };
    return widths[tags.highway] || 5;
  }

  // Default widths for other types
  if (type === 'park') return 20;
  if (type === 'plaza') return 15;
  if (type === 'parking') return 10;
  if (type === 'courtyard') return 10;
  
  return 5;
}

export async function fetchPedestrianSpaces(
  centerLat: number,
  centerLng: number,
  radiusMeters: number = 500
): Promise<PedestrianSpace[]> {
  
  const cacheKey = `${centerLat.toFixed(4)}_${centerLng.toFixed(4)}_${radiusMeters}`;
  
  // Check cache first
  const cached = requestCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`🚶 Using cached pedestrian spaces (${cached.data.length} spaces)`);
    return cached.data;
  }
  
  console.log(`🚶 Fetching pedestrian spaces within ${radiusMeters}m...`);

  // Calculate bounding box
  const latOffset = (radiusMeters / 111320);
  const lngOffset = (radiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180)));

  const bbox = {
    south: centerLat - latOffset,
    north: centerLat + latOffset,
    west: centerLng - lngOffset,
    east: centerLng + lngOffset
  };

  const query = buildPedestrianSpacesQuery(bbox);
  
  // Add delay to avoid rate limiting (5 seconds minimum, increased from 3)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const data = await tryFetchPedestrianSpaces(query);
  
  if (!data || !data.elements) {
    console.warn('Failed to fetch pedestrian spaces from all endpoints');
    return [];
  }

  // Build node lookup
  const nodeMap: Record<string, { lat: number; lng: number }> = {};
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodeMap[el.id] = { lat: el.lat, lng: el.lon };
    }
  }

  const spaces: PedestrianSpace[] = [];

  // Process ways
  for (const el of data.elements) {
    if (el.type === 'way' && el.nodes && el.nodes.length >= 2) {
      const geometry: { lat: number; lng: number }[] = [];
      
      for (const nodeId of el.nodes) {
        const node = nodeMap[nodeId];
        if (node) {
          geometry.push(node);
        }
      }

      if (geometry.length >= 2) {
        const type = classifySpaceType(el.tags || {});
        const width = estimateWidth(el.tags || {}, type);

        spaces.push({
          id: `way-${el.id}`,
          type,
          geometry,
          width,
          tags: el.tags || {}
        });
      }
    }
  }

  // Process relations (for parks/plazas that are relations)
  for (const el of data.elements) {
    if (el.type === 'relation' && el.members) {
      const outerWays = el.members.filter((m: any) => m.role === 'outer' && m.type === 'way');
      
      if (outerWays.length > 0) {
        // Find the way in elements
        const wayId = outerWays[0].ref;
        const wayEl = data.elements.find((e: any) => e.type === 'way' && e.id === wayId);
        
        if (wayEl && wayEl.nodes) {
          const geometry: { lat: number; lng: number }[] = [];
          
          for (const nodeId of wayEl.nodes) {
            const node = nodeMap[nodeId];
            if (node) {
              geometry.push(node);
            }
          }

          if (geometry.length >= 3) {
            const type = classifySpaceType(el.tags || {});
            
            spaces.push({
              id: `relation-${el.id}`,
              type,
              geometry,
              width: estimateWidth(el.tags || {}, type),
              tags: el.tags || {}
            });
          }
        }
      }
    }
  }

  console.log(`✅ Fetched ${spaces.length} pedestrian spaces`);
  console.log(`   Roads: ${spaces.filter(s => s.type === 'road').length}`);
  console.log(`   Parks: ${spaces.filter(s => s.type === 'park').length}`);
  console.log(`   Plazas: ${spaces.filter(s => s.type === 'plaza').length}`);
  console.log(`   Walkways: ${spaces.filter(s => s.type === 'walkway').length}`);

  // Cache the results
  requestCache.set(cacheKey, { data: spaces, timestamp: Date.now() });

  return spaces;
}
