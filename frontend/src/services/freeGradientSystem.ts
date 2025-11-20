/**
 * FREE ENVIRONMENTAL GRADIENT SYSTEM
 * 100% Open Source - No Commercial APIs
 * 
 * Data Sources (All Free):
 * - Buildings: OpenStreetMap Overpass API
 * - Sun Position: SunCalc (MIT)
 * - Terrain: EU DEM / SRTM (Free)
 * - Weather: Open-Meteo API (Free)
 */

import * as THREE from 'three';
import SunCalc from 'suncalc';

// Simple in-memory caches (per page session)
const osmCache = new Map<string, OSMBuilding[]>();
let backendHealthy: boolean | null = null;
let backendCheckedAt = 0;

// ============================================================================
// 1. FREE BUILDING DATA FROM OPENSTREETMAP
// ============================================================================

export interface OSMBuilding {
    id: string;
    geometry: [number, number][]; // lat, lng pairs
    height: number; // meters
    levels?: number;
}

/**
 * Fetch building data from OpenStreetMap Overpass API (FREE)
 * No API key required, rate limited but free for reasonable use
 */
export async function fetchOSMBuildings(
    bbox: { south: number; west: number; north: number; east: number }
): Promise<OSMBuilding[]> {
    // Cache key (rounded to ~5e-5 deg ≈ 5 m) to avoid thrash
    const key = `${bbox.south.toFixed(5)}|${bbox.west.toFixed(5)}|${bbox.north.toFixed(5)}|${bbox.east.toFixed(5)}`;
    if (osmCache.has(key)) {
        return osmCache.get(key)!;
    }

    // Quick bounds check - use mock data for invalid bounds
    if (
        !isFinite(bbox.south) ||
        !isFinite(bbox.west) ||
        !isFinite(bbox.north) ||
        !isFinite(bbox.east) ||
        (bbox.south === 0 && bbox.north === 0 && bbox.west === 0 && bbox.east === 0)
    ) {
        console.warn('[OSM] Invalid bounds, using mock data');
        const mock = generateMockBuildings(bbox);
        osmCache.set(key, mock);
        return mock;
    }

    // Quick bounds check - use mock data for invalid bounds
    if (bbox.south === 0 && bbox.north === 0 && bbox.west === 0 && bbox.east === 0) {
        console.warn('[OSM] Invalid bounds (all zeros), using mock data');
        const mock = generateMockBuildings(bbox);
        osmCache.set(key, mock);
        return mock;
    }

    const query = `
        [out:json][timeout:10];
        (
            way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        );
        out body;
        >;
        out skel qt;
    `;

    const url = 'https://overpass-api.de/api/interpreter';
    
    try {
        console.log('[OSM] Fetching buildings from Overpass API...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
        
        const response = await fetch(url, {
            method: 'POST',
            body: query,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // Check HTTP status first
        if (!response.ok) {
            console.warn(`[OSM] HTTP ${response.status}, using mock data`);
            const mock = generateMockBuildings(bbox);
            osmCache.set(key, mock);
            return mock;
        }

        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.warn('[OSM] Non-JSON response, using mock data. Content-Type:', contentType);
            const mock = generateMockBuildings(bbox);
            osmCache.set(key, mock);
            return mock;
        }

        const data = await response.json();
        
        // Parse OSM data
        const nodes = new Map<number, [number, number]>();
        if (data.elements) {
            data.elements.forEach((el: any) => {
                if (el.type === 'node') {
                    nodes.set(el.id, [el.lat, el.lon]);
                }
            });
        }

        const buildings: OSMBuilding[] = [];
        if (data.elements) {
            data.elements.forEach((el: any) => {
                if (el.type === 'way' && el.tags?.building) {
                    const geometry = el.nodes
                        .map((nodeId: number) => nodes.get(nodeId))
                        .filter((coord: any) => coord) as [number, number][];

                    // Estimate height from levels or use default
                    const levels = el.tags['building:levels'] || el.tags.levels;
                    const height = el.tags.height 
                        ? parseFloat(el.tags.height)
                        : levels 
                            ? parseFloat(levels) * 3.5 
                            : 10; // Default 10m

                    buildings.push({
                        id: el.id.toString(),
                        geometry,
                        height
                    });
                }
            });
        }

        console.log(`[OSM] Successfully fetched ${buildings.length} buildings`);
        
        // Fallback to mock if no buildings found
        if (buildings.length === 0) {
            console.warn('[OSM] No buildings found in response, using mock data');
            const mock = generateMockBuildings(bbox);
            osmCache.set(key, mock);
            return mock;
        }

        osmCache.set(key, buildings);
        return buildings;
    } catch (error: any) {
        console.error('[OSM] Fetch failed:', error.message);
        console.warn('[OSM] Falling back to mock building data');
        const mock = generateMockBuildings(bbox);
        osmCache.set(key, mock);
        return mock;
    }
}

/**
 * Generate mock building data for testing/fallback (FREE)
 */
function generateMockBuildings(
    bbox: { south: number; west: number; north: number; east: number }
): OSMBuilding[] {
    const centerLat = (bbox.south + bbox.north) / 2;
    const centerLon = (bbox.west + bbox.east) / 2;
    const latSpan = bbox.north - bbox.south;
    const lonSpan = bbox.east - bbox.west;

    const buildings: OSMBuilding[] = [];
    
    // Generate 10-20 random buildings
    const count = 10 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i < count; i++) {
        const lat = centerLat + (Math.random() - 0.5) * latSpan * 0.8;
        const lon = centerLon + (Math.random() - 0.5) * lonSpan * 0.8;
        const size = 0.0001 + Math.random() * 0.0003;
        
        buildings.push({
            id: `mock_${i}`,
            geometry: [
                [lat - size, lon - size],
                [lat - size, lon + size],
                [lat + size, lon + size],
                [lat + size, lon - size],
                [lat - size, lon - size]
            ],
            height: 5 + Math.random() * 30
        });
    }
    
    console.log(`[OSM] Generated ${buildings.length} mock buildings`);
    return buildings;
}

// ============================================================================
// 2. SPATIAL GRID RASTERIZATION (FREE ALGORITHM)
// ============================================================================

export interface GridCell {
    x: number; // grid index
    y: number;
    lat: number; // actual coordinates
    lng: number;
    elevation: number;
    buildings: { id: string; height: number; distance: number; geometry: [number, number][] }[]; // nearby buildings with full data
    value: number; // computed environmental value
}

/**
 * Create a spatial grid from buildings (FREE - basic spatial indexing)
 */
export function createSpatialGrid(
    buildings: OSMBuilding[],
    bbox: { south: number; west: number; north: number; east: number },
    resolution: number = 512
): GridCell[][] {
    const grid: GridCell[][] = [];
    const latStep = (bbox.north - bbox.south) / resolution;
    const lngStep = (bbox.east - bbox.west) / resolution;

    for (let y = 0; y < resolution; y++) {
        grid[y] = [];
        for (let x = 0; x < resolution; x++) {
            const lat = bbox.south + y * latStep;
            const lng = bbox.west + x * lngStep;

            // Find nearby buildings using simple distance check (FREE)
            const nearbyBuildings = buildings
                .map(building => {
                    const centerLat = building.geometry.reduce((sum, p) => sum + p[0], 0) / building.geometry.length;
                    const centerLng = building.geometry.reduce((sum, p) => sum + p[1], 0) / building.geometry.length;
                    
                    // Haversine distance (FREE formula)
                    const distance = haversineDistance(lat, lng, centerLat, centerLng);
                    
                    return {
                        id: building.id,
                        height: building.height,
                        distance,
                        geometry: building.geometry
                    };
                })
                .filter(b => b.distance < 200) // Only buildings within 200m
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 10); // Keep 10 nearest

            grid[y][x] = {
                x,
                y,
                lat,
                lng,
                elevation: 0, // Can fetch from SRTM if needed
                buildings: nearbyBuildings,
                value: 0
            };
        }
    }

    return grid;
}

/**
 * Haversine distance formula (FREE, public domain)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// ============================================================================
// 3. FREE SOLAR RADIATION MODEL (SunCalc + Physics)
// ============================================================================

/**
 * Calculate solar radiation for a grid cell (FREE - open physics formulas)
 * Based on simplified solar irradiance model
 */
export function calculateSolarRadiation(
    cell: GridCell,
    date: Date,
    clearSkyIndex: number = 0.8
): number {
    // Get sun position using SunCalc (FREE, MIT license)
    const sunPos = SunCalc.getPosition(date, cell.lat, cell.lng);
    const sunAltitude = sunPos.altitude * (180 / Math.PI); // degrees
    const sunAzimuth = sunPos.azimuth * (180 / Math.PI);

    // Sun below horizon = no radiation
    if (sunAltitude <= 0) return 0;

    // Direct Normal Irradiance (DNI) - simplified FREE formula
    // Based on ASHRAE clear sky model (public domain)
    const airMass = 1 / (Math.sin(sunPos.altitude) + 0.50572 * Math.pow(sunAltitude + 6.07995, -1.6364));
    const tau = 0.5; // Atmospheric optical depth (simplified)
    const dni = 1367 * Math.exp(-tau * airMass) * clearSkyIndex; // W/m²

    // Check for shadow occlusion from buildings (FREE ray-casting)
    const shadowFactor = calculateShadowOcclusion(cell, sunPos);

    // Direct radiation on horizontal surface
    const directRadiation = dni * Math.sin(sunPos.altitude) * (1 - shadowFactor);

    // Diffuse radiation (simplified sky model, FREE)
    const diffuseRadiation = dni * 0.15 * (1 - shadowFactor * 0.5);

    return directRadiation + diffuseRadiation; // W/m²
}

/**
 * Shadow occlusion using simple ray-casting (FREE algorithm)
 */
function calculateShadowOcclusion(
    cell: GridCell,
    sunPos: { altitude: number; azimuth: number }
): number {
    if (cell.buildings.length === 0) return 0;

    // Ray direction from sun
    const sunDir = {
        x: Math.cos(sunPos.azimuth) * Math.cos(sunPos.altitude),
        y: Math.sin(sunPos.azimuth) * Math.cos(sunPos.altitude),
        z: Math.sin(sunPos.altitude)
    };

    let maxOcclusion = 0;

    // Check each nearby building
    for (const building of cell.buildings) {
        // Simple shadow check: if building is between cell and sun
        const buildingAngle = Math.atan2(building.height, building.distance);
        
        if (buildingAngle > sunPos.altitude) {
            // Building casts shadow on this cell
            const occlusion = Math.min(1, (buildingAngle - sunPos.altitude) / (Math.PI / 4));
            maxOcclusion = Math.max(maxOcclusion, occlusion);
        }
    }

    return maxOcclusion;
}

// ============================================================================
// 4. FREE WIND COMFORT MODEL (Urban Canyon Physics)
// ============================================================================

/**
 * Calculate wind speed considering urban canyon effects (FREE model)
 * Based on published urban meteorology research (public domain formulas)
 */
export function calculateWindSpeed(
    cell: GridCell,
    baseWindSpeed: number, // m/s from weather API
    baseWindDirection: number // degrees
): { speed: number; direction: number } {
    if (cell.buildings.length === 0) {
        return { speed: baseWindSpeed, direction: baseWindDirection };
    }

    // Urban canyon effect (FREE formula from urban meteorology)
    const nearestBuilding = cell.buildings[0];
    const H = nearestBuilding.height; // building height
    const d = Math.max(1, nearestBuilding.distance); // distance to building

    // Wind speed reduction in urban canyon
    // Formula: v(z) = v_ref * (z / H)^α where α ≈ 0.25 for urban areas
    const heightRatio = 2 / Math.max(2, H); // assume pedestrian at 2m
    const speedReduction = Math.pow(heightRatio, 0.25);

    // Shelter effect when very close to buildings
    const shelterFactor = Math.exp(-d / (2 * H));
    
    // Channeling effect in street canyons
    const channelAmplification = 1 + 0.3 * Math.exp(-d / (0.5 * H));

    let finalSpeed = baseWindSpeed * speedReduction * (1 - 0.7 * shelterFactor);
    
    // Apply channeling if wind aligned with canyon
    if (d < H) {
        finalSpeed *= channelAmplification;
    }

    return {
        speed: Math.max(0, Math.min(20, finalSpeed)),
        direction: baseWindDirection // Simplified - can add deflection
    };
}

// ============================================================================
// 5. FREE THERMAL COMFORT MODEL (PET simplified)
// ============================================================================

/**
 * Calculate Physiological Equivalent Temperature (FREE simplified model)
 * Based on RayMan model principles (academic, free to use)
 */
export function calculateThermalComfort(
    cell: GridCell,
    airTemp: number, // °C
    solarRadiation: number, // W/m²
    windSpeed: number, // m/s
    relativeHumidity: number // 0-1
): number {
    // Simplified PET calculation (FREE formula)
    
    // Mean Radiant Temperature (MRT) from solar radiation
    const mrt = airTemp + (solarRadiation / 150); // Simplified conversion
    
    // Wind cooling effect
    const windChill = windSpeed > 0 
        ? airTemp - 1.5 * Math.sqrt(windSpeed)
        : airTemp;
    
    // Humidity discomfort (above 60% RH)
    const humidityEffect = relativeHumidity > 0.6 
        ? (relativeHumidity - 0.6) * 5
        : 0;
    
    // PET calculation (simplified)
    const pet = 0.6 * windChill + 0.4 * mrt + humidityEffect;
    
    return pet;
}

// ============================================================================
// 6. GRID VALUE COMPUTATION (Combines all free models)
// ============================================================================

export async function computeEnvironmentalGrid(
    grid: GridCell[][],
    analysisType: 'solar' | 'shadow' | 'wind' | 'comfort',
    date: Date,
    weather: {
        temperature: number;
        windSpeed: number;
        windDirection: number;
        humidity: number;
        cloudCover: number;
    }
): Promise<Float32Array> {
    const resolution = grid.length;
    
    // Try Python backend first (research-grade UTCI/PET), but only if healthy
    const now = Date.now();
    const shouldRecheck = backendHealthy === null || (now - backendCheckedAt) > 30_000; // 30s cache
    if (shouldRecheck) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 1200);
            const res = await fetch('http://localhost:8000/health', { signal: ctrl.signal });
            clearTimeout(t);
            backendHealthy = res.ok;
        } catch {
            backendHealthy = false;
        }
        backendCheckedAt = now;
    }

    if (backendHealthy) {
        try {
            console.log(`[Grid] Using Python backend for ${analysisType}...`);
            // Extract bounds from grid
            const bounds = {
                south: grid[0][0].lat,
                north: grid[resolution-1][resolution-1].lat,
                west: grid[0][0].lng,
                east: grid[resolution-1][resolution-1].lng
            };
            // Extract buildings from grid
            const buildingsMap = new Map<string, any>();
            grid.forEach(row => {
                row.forEach(cell => {
                    cell.buildings.forEach(b => {
                        if (!buildingsMap.has(b.id)) {
                            buildingsMap.set(b.id, {
                                id: b.id,
                                geometry: b.geometry,
                                height: b.height
                            });
                        }
                    });
                });
            });
            const buildings = Array.from(buildingsMap.values());
            const apiAnalysisType = analysisType === 'comfort' ? 'utci' : analysisType;

            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 3500);
            const response = await fetch('http://localhost:8000/api/thermal-comfort', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bounds,
                    buildings,
                    weather: {
                        temperature: weather.temperature,
                        humidity: weather.humidity,
                        wind_speed: weather.windSpeed,
                        wind_direction: weather.windDirection,
                        cloud_cover: weather.cloudCover
                    },
                    date: date.toISOString(),
                    resolution,
                    analysis_type: apiAnalysisType
                }),
                signal: ctrl.signal
            });
            clearTimeout(t);

            if (response.ok) {
                const data = await response.json();
                console.log(`[Grid] Python backend success - min:${data.min.toFixed(1)} max:${data.max.toFixed(1)}`);
                return new Float32Array(data.values);
            } else {
                console.warn(`[Grid] Backend responded ${response.status}, falling back`);
            }
        } catch (error) {
            console.warn('[Grid] Backend call failed, falling back to browser physics');
        }
    }
    
    // Fallback to browser-based calculations
    const values = new Float32Array(resolution * resolution);

    console.log(`[Grid] Computing ${analysisType} for ${resolution}x${resolution} grid (browser fallback)`);

    for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
            const cell = grid[y][x];
            const idx = y * resolution + x;

            switch (analysisType) {
                case 'solar':
                    values[idx] = calculateSolarRadiation(
                        cell,
                        date,
                        1 - weather.cloudCover
                    );
                    break;

                case 'shadow':
                    const sunPos = SunCalc.getPosition(date, cell.lat, cell.lng);
                    const occlusion = calculateShadowOcclusion(cell, sunPos);
                    values[idx] = occlusion * 12; // 0-12 shadow hours
                    break;

                case 'wind':
                    const wind = calculateWindSpeed(
                        cell,
                        weather.windSpeed,
                        weather.windDirection
                    );
                    values[idx] = wind.speed;
                    break;

                case 'comfort':
                    const solar = calculateSolarRadiation(cell, date, 1 - weather.cloudCover);
                    const windComfort = calculateWindSpeed(
                        cell,
                        weather.windSpeed,
                        weather.windDirection
                    );
                    values[idx] = calculateThermalComfort(
                        cell,
                        weather.temperature,
                        solar,
                        windComfort.speed,
                        weather.humidity
                    );
                    break;
            }
        }
    }

    console.log(`[Grid] Computed values - min: ${Math.min(...values)}, max: ${Math.max(...values)}, avg: ${values.reduce((a,b)=>a+b)/values.length}`);
    return values;
}

// ============================================================================
// 7. TEXTURE GENERATION FOR GPU (FREE)
// ============================================================================

/**
 * Convert grid values to GPU texture (FREE - standard WebGL)
 */
export function createDataTexture(
    values: Float32Array,
    resolution: number
): THREE.DataTexture {
    console.log('[Texture] Creating DataTexture:', {
        size: values.length,
        resolution,
        expected: resolution * resolution,
        sample: values.slice(0, 10)
    });

    // Validate and sanitize data
    for (let i = 0; i < values.length; i++) {
        if (!isFinite(values[i])) {
            console.warn(`[Texture] Invalid value at index ${i}: ${values[i]}, replacing with 0`);
            values[i] = 0;
        }
    }

    const texture = new THREE.DataTexture(
        values,
        resolution,
        resolution,
        THREE.RedFormat,
        THREE.FloatType
    );
    
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    console.log('[Texture] DataTexture created successfully');
    return texture;
}

export default {
    fetchOSMBuildings,
    createSpatialGrid,
    computeEnvironmentalGrid,
    createDataTexture
};
