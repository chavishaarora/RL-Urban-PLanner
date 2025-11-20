import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Google3DTilesProps {
    apiKey: string;
    center: { lat: number; lng: number };
    origin: { lat: number; lng: number };
    siteBoundary?: Array<{ lat: number; lng: number }>;
    deletedBuildingIds?: Set<string>;
    onDeleteBuilding?: (buildingId: string) => void;
    selectedBuildingId?: string | null;
    onSelectBuilding?: (buildingId: string | null) => void;
}

// Simplified 3D Surroundings using OpenStreetMap data
export const Google3DTiles: React.FC<Google3DTilesProps> = ({ 
    apiKey, 
    center, 
    origin, 
    siteBoundary,
    deletedBuildingIds = new Set(),
    onDeleteBuilding,
    selectedBuildingId = null,
    onSelectBuilding
}) => {
    const { scene, raycaster, camera, gl } = useThree();
    const groupRef = useRef<THREE.Group>(new THREE.Group());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Cache to prevent API flooding
    const cachedDataRef = useRef<any>(null);
    const lastFetchLocationRef = useRef<string>('');
    const isFetchingRef = useRef<boolean>(false);
    
    // Double-click detection
    const lastClickTimeRef = useRef<number>(0);
    const lastClickedBuildingIdRef = useRef<string | null>(null);
    const previousDeletedCountRef = useRef<number>(0);

    useEffect(() => {
        if (!groupRef.current) return;
        
        // Prevent multiple simultaneous fetches
        if (isFetchingRef.current) {
            console.log('[Google3DTiles] ⏸️ Skipping fetch - already in progress');
            return;
        }
        
        // Create location key for caching (rounded to 4 decimals = ~11m precision)
        const locationKey = `${center.lat.toFixed(4)}_${center.lng.toFixed(4)}`;
        
        // Check if we need to rebuild
        const needsRebuild = 
            lastFetchLocationRef.current !== locationKey || // Location changed
            groupRef.current.children.length === 0 || // No geometry
            (deletedBuildingIds.size === 0 && previousDeletedCountRef.current > 0); // Reset was clicked
        
        if (!needsRebuild && groupRef.current.children.length > 0) {
            console.log('[Google3DTiles] 🎯 Location unchanged, keeping existing 3D geometry');
            return;
        }

        if (deletedBuildingIds.size === 0 && previousDeletedCountRef.current > 0) {
            console.log('[Google3DTiles] 🔄 Reset detected - rebuilding all buildings');
        }

        // Update previous count
        previousDeletedCountRef.current = deletedBuildingIds.size;

        // Clear previous content
        groupRef.current.clear();

        const R = 6371000;

        const pointInPolygon = (point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) => {
            // Ray-casting algorithm for point-in-polygon
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].lng, yi = polygon[i].lat;
                const xj = polygon[j].lng, yj = polygon[j].lat;

                const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                    (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi + Number.EPSILON) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 10000) => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { ...options, signal: controller.signal });
                return res;
            } finally {
                clearTimeout(t);
            }
        };

    // Increased search radius to capture all nearby buildings including adjacent ones
    const bboxRadiusMeters = 500; // 500m radius to ensure all immediate surroundings are loaded
        const latDelta = bboxRadiusMeters / 111000;
        const lngDelta = bboxRadiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));

        // Overpass bbox: south,west,north,east
    const south = center.lat - latDelta;
        const north = center.lat + latDelta;
        const west = center.lng - lngDelta;
        const east = center.lng + lngDelta;

        // Comprehensive query to get ALL surrounding context
        const query = `[
out:json][timeout:30];
(
  way["building"](${south},${west},${north},${east});
  way["building:part"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
  relation["type"="multipolygon"]["building"](${south},${west},${north},${east});
  way["highway"](${south},${west},${north},${east});
  way["landuse"](${south},${west},${north},${east});
  way["amenity"](${south},${west},${north},${east});
  relation["amenity"](${south},${west},${north},${east});
);
out body;
>;out skel qt;`;

        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.ru/api/interpreter',
            'https://overpass.nchc.org.tw/api/interpreter',
        ];

        const tryFetch = async (): Promise<any | null> => {
            for (const url of endpoints) {
                try {
                    const res = await fetchWithTimeout(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `data=${encodeURIComponent(query)}`,
                    }, 15000);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && json.elements && json.elements.length) return json;
                    }
                } catch (_err) {
                    // try next endpoint
                }
            }
            return null;
        };

        const buildFallbackPlaceholder = () => {
            // fallback: create a soft ring of neutral blocks so the 3D context is never empty
            const buildings: Array<{ lat: number; lng: number; height: number; size: number }> = [];
            const num = 16; // fewer buildings in fallback
            const minR = 80; const maxR = 200; // closer ring (was 120-420)
            for (let i = 0; i < num; i++) {
                const ang = (i / num) * Math.PI * 2 + (i % 2 ? 0.2 : -0.2);
                const dist = minR + Math.random() * (maxR - minR);
                const dLat = (dist / 111000) * Math.sin(ang);
                const dLng = (dist / (111000 * Math.cos((center.lat * Math.PI) / 180))) * Math.cos(ang);
                const plat = center.lat + dLat;
                const plng = center.lng + dLng;
                buildings.push({ lat: plat, lng: plng, height: 10 + Math.random() * 25, size: 12 + Math.random() * 18 });
            }
            buildings.forEach((b) => {
                const dx = (b.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                const dy = (b.lat - origin.lat) * (Math.PI / 180) * R;
                const geometry = new THREE.BoxGeometry(b.size, b.height, b.size);
                const material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d9d9d9'), roughness: 0.95, metalness: 0.05 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(dx, b.height / 2, -dy);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                groupRef.current?.add(mesh);
            });
        };

        (async () => {
            try {
                isFetchingRef.current = true;
                setIsLoading(true);
                setError(null);
                
                // Create location key for caching (rounded to 4 decimals = ~11m precision)
                const locationKey = `${center.lat.toFixed(4)}_${center.lng.toFixed(4)}`;
                
                // Use cached data if location hasn't changed significantly
                let data = null;
                if (lastFetchLocationRef.current === locationKey && cachedDataRef.current) {
                    console.log('[Google3DTiles] 📦 Using cached OSM data for location:', locationKey);
                    data = cachedDataRef.current;
                } else {
                    console.log('[Google3DTiles] 🌐 Fetching new OSM data for location:', locationKey);
                    data = await tryFetch();
                    
                    if (data) {
                        cachedDataRef.current = data;
                        lastFetchLocationRef.current = locationKey;
                    }
                }

                if (!data) {
                    console.warn('[Google3DTiles] No data from any Overpass endpoint');
                    console.warn('[Google3DTiles] Tried bbox:', { south, west, north, east });
                    setError('No building data available from OSM in this area.');
                    buildFallbackPlaceholder();
                    setIsLoading(false);
                    return;
                }
                
                console.log('[Google3DTiles] ✅ Received OSM data:', { 
                    elementCount: data.elements?.length || 0,
                    center: `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
                    bbox: `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`
                });

                // Map nodes and ways by id; collect relations for multipolygons
                const nodes: Record<number, { lat: number; lon: number }> = {};
                const waysById: Record<number, any> = {};
                const wayList: Array<any> = [];
                const roadWays: Array<any> = [];
                const relations: Array<any> = [];

                for (const el of data.elements || []) {
                    if (el.type === 'node') {
                        nodes[el.id] = { lat: el.lat, lon: el.lon };
                    } else if (el.type === 'way') {
                        waysById[el.id] = el;
                        // Separate roads from buildings
                        if (el.tags?.highway) {
                            roadWays.push(el);
                        } else {
                            wayList.push(el);
                        }
                    } else if (el.type === 'relation') {
                        relations.push(el);
                    }
                }

                const assembledPolygons: Array<{ points: Array<{ x: number; y: number }>; height: number; tags: any }> = [];

                const addPolygon = (latlngs: Array<{ lat: number; lon: number }>, tags: any) => {
                    if (!latlngs || latlngs.length < 3) return;
                    const points = latlngs.map((n) => {
                        const dx = (n.lon - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                        const dy = (n.lat - origin.lat) * (Math.PI / 180) * R;
                        // REVERTED: Back to original working coordinate system
                        return { x: dx, y: -dy };
                    });
                    // height from tags
                    let height = 12;
                    if (tags.height) {
                        const parsed = parseFloat(String(tags.height).replace(/m/i, '').trim());
                        if (!isNaN(parsed)) height = parsed;
                    } else if (tags['building:levels'] || tags.levels) {
                        const levels = parseFloat((tags['building:levels'] || tags.levels).toString());
                        if (!isNaN(levels)) height = Math.max(3, levels * 3);
                    } else if (tags['roof:height'] && tags['min_height']) {
                        const rh = parseFloat(String(tags['roof:height']).replace(/m/i, ''));
                        const mh = parseFloat(String(tags['min_height']).replace(/m/i, ''));
                        if (!isNaN(rh) && !isNaN(mh)) height = rh + mh;
                    }
                    assembledPolygons.push({ points, height, tags });
                };

                // Ways → polygons
                for (const way of wayList) {
                    const refs: number[] = way.nodes || [];
                    const latlngs = refs.map((id: number) => nodes[id]).filter(Boolean);
                    addPolygon(latlngs, way.tags || {});
                }

                // Relations (multipolygon) → stitch outer rings
                const stitchRing = (members: any[]): Array<{ lat: number; lon: number }> => {
                    const outers = members.filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === 'outline'));
                    if (!outers.length) return [];
                    // naive stitching by connecting matching end nodes
                    const chains = outers.map((m) => (waysById[m.ref]?.nodes || []).slice());
                    // build map from node id to chains including orientation
                    const result: number[] = [];
                    let current = chains.shift() || [];
                    result.push(...current);
                    while (chains.length) {
                        const tail = result[result.length - 1];
                        const idx = chains.findIndex((c) => c[0] === tail || c[c.length - 1] === tail);
                        if (idx === -1) break;
                        const chain = chains.splice(idx, 1)[0];
                        if (chain[0] === tail) {
                            result.push(...chain.slice(1));
                        } else {
                            result.push(...chain.slice(0, chain.length - 1).reverse());
                        }
                    }
                    const latlngs = result.map((id) => nodes[id]).filter(Boolean);
                    return latlngs;
                };

                for (const rel of relations) {
                    const latlngs = stitchRing(rel.members || []);
                    if (latlngs.length >= 3) addPolygon(latlngs, rel.tags || {});
                }

                if (assembledPolygons.length === 0) {
                    console.warn('[Google3DTiles] ⚠️ No polygons assembled from OSM elements');
                    console.warn('[Google3DTiles] Element breakdown:', {
                        totalElements: data.elements?.length,
                        nodes: Object.keys(nodes).length,
                        ways: wayList.length,
                        relations: relations.length
                    });
                    setError('No surrounding buildings found in OSM here.');
                    buildFallbackPlaceholder();
                    setIsLoading(false);
                    return;
                }
                
                console.log('[Google3DTiles] ✅ Assembled polygons:', assembledPolygons.length);

                // Calculate distances from site center for all buildings
                const buildingsWithDistance = assembledPolygons.map((poly) => {
                    const avgX = poly.points.reduce((s, p) => s + p.x, 0) / poly.points.length;
                    const avgY = poly.points.reduce((s, p) => s + p.y, 0) / poly.points.length;
                    const distanceFromCenter = Math.sqrt(avgX * avgX + avgY * avgY);
                    return { ...poly, avgX, avgY, distanceFromCenter };
                });

                // Sort by distance - closest first
                buildingsWithDistance.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

                // Debug: Show closest 5 buildings to verify they're being loaded
                console.log('🎯 5 CLOSEST buildings to site center:');
                buildingsWithDistance.slice(0, 5).forEach((poly, idx) => {
                    const lat = origin.lat + (-poly.avgY / R) * (180 / Math.PI);
                    const lng = origin.lng + (poly.avgX / (R * Math.cos((origin.lat * Math.PI) / 180))) * (180 / Math.PI);
                    console.log(`  ${idx + 1}. Distance: ${poly.distanceFromCenter.toFixed(1)}m | Lat/Lng: ${lat.toFixed(6)}, ${lng.toFixed(6)} | Height: ${poly.height}m`);
                });

                // Render ALL buildings within radius - no artificial limits
                const maxBuildings = 1000; // Increased to ensure complete 360° coverage
                let count = 0;
                let skippedInBoundary = 0;
                let debugSkipped: any[] = [];
                let debugRendered: any[] = [];

                // prepare siteBoundary for point-in-polygon checks (if provided)
                const boundary = siteBoundary || [];
                
                // Debug: Log site boundary to verify it's correct
                if (boundary.length > 0) {
                    console.log('🗺️ Site Boundary Polygon:', boundary.length, 'vertices');
                    console.log('   First vertex:', boundary[0]);
                    console.log('   Last vertex:', boundary[boundary.length - 1]);
                }

                // Process buildings in distance order (closest first)
                buildingsWithDistance.forEach(({ points, height, tags, avgX, avgY, distanceFromCenter }) => {
                    if (count >= maxBuildings) return;
                    
                    try {
                        if (!points || points.length < 3) return;

                        // Centroid already calculated in buildingsWithDistance
                        
                        // Convert back to lat/lng for boundary test
                        const plat = origin.lat + (-avgY / R) * (180 / Math.PI);
                        const plng = origin.lng + (avgX / (R * Math.cos((origin.lat * Math.PI) / 180))) * (180 / Math.PI);

                        // DISABLED FILTERING - Show ALL buildings in radius
                        // The filtering was removing buildings adjacent to the site
                        // Users want to see the complete urban context including immediately adjacent buildings
                        let shouldSkip = false;
                        
                        /* ORIGINAL FILTERING LOGIC - DISABLED
                        if (boundary && boundary.length > 2) {
                            const centroidInside = pointInPolygon({ lat: plat, lng: plng }, boundary);
                            
                            // Debug: Log every building's centroid position relative to boundary
                            if (count < 10) {
                                console.log(`Building ${count + 1}: Centroid at ${plat.toFixed(6)}, ${plng.toFixed(6)} | Inside boundary: ${centroidInside}`);
                            }
                            
                            if (centroidInside) {
                                // Count how many vertices are inside vs outside
                                let verticesInside = 0;
                                let verticesOutside = 0;
                                
                                for (const point of points) {
                                    // CRITICAL FIX: point.y is now positive north, so we add it directly
                                    const ptLat = origin.lat + (point.y / R) * (180 / Math.PI);
                                    const ptLng = origin.lng + (point.x / (R * Math.cos((origin.lat * Math.PI) / 180))) * (180 / Math.PI);
                                    
                                    if (pointInPolygon({ lat: ptLat, lng: ptLng }, boundary)) {
                                        verticesInside++;
                                    } else {
                                        verticesOutside++;
                                    }
                                }
                                
                                // Only skip if more than 80% of vertices are inside
                                // This keeps buildings on the edge or partially overlapping
                                const insideRatio = verticesInside / points.length;
                                if (insideRatio > 0.8) {
                                    shouldSkip = true;
                                    debugSkipped.push({
                                        centroid: { lat: plat.toFixed(6), lng: plng.toFixed(6) },
                                        insideRatio: insideRatio.toFixed(2),
                                        verticesIn: verticesInside,
                                        verticesOut: verticesOutside,
                                        totalVertices: points.length
                                    });
                                }
                            }
                        }
                        */
                        
                        if (shouldSkip) {
                            skippedInBoundary++;
                            return;
                        }

                        // Generate unique ID for this building
                        const buildingId = `building_${plat.toFixed(6)}_${plng.toFixed(6)}_${count}`;
                        
                        // Skip if this building has been deleted
                        if (deletedBuildingIds.has(buildingId)) {
                            console.log('⏭️ Skipping deleted building:', buildingId);
                            return;
                        }

                        // create three shape
                        const threeShape = new THREE.Shape();
                        points.forEach((p: any, i: number) => {
                            if (i === 0) threeShape.moveTo(p.x, p.y);
                            else threeShape.lineTo(p.x, p.y);
                        });
                        threeShape.closePath();

                        const extrudeGeo = new THREE.ExtrudeGeometry(threeShape, { depth: height, bevelEnabled: false });
                        extrudeGeo.rotateX(-Math.PI / 2);

                        const material = new THREE.MeshStandardMaterial({
                            color: new THREE.Color(0.85 + Math.random() * 0.1, 0.85 + Math.random() * 0.1, 0.85 + Math.random() * 0.1),
                            roughness: 0.9,
                            metalness: 0.05,
                        });

                        const mesh = new THREE.Mesh(extrudeGeo, material);
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        
                        // Store metadata for double-click deletion
                        mesh.userData = {
                            buildingId,
                            isSurroundingBuilding: true,
                            centroid: { lat: plat, lng: plng },
                            height,
                            tags,
                            distanceFromCenter
                        };
                        
                        // position already in local coordinates; extrude geometry has depth along +Z after rotateX
                        // translate so base sits on Y=0
                        mesh.position.set(0, 0, 0);

                        groupRef.current?.add(mesh);
                        count++;
                    } catch (err) {
                        // ignore per-building failures
                        console.warn('Failed to create building mesh', err);
                    }
                });
                // Enhanced Debug Output with Coverage Analysis
                console.log('\n🏢 ============ 3D SURROUNDINGS SUMMARY ============');
                console.log(`📍 Site Center: ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`);
                console.log(`📏 Coverage Radius: ${bboxRadiusMeters}m (360° complete coverage)`);
                console.log(`� Bounding Box: N:${north.toFixed(4)} S:${south.toFixed(4)} E:${east.toFixed(4)} W:${west.toFixed(4)}`);
                console.log(`�📦 Total Buildings from OSM: ${assembledPolygons.length}`);
                console.log(`✅ Rendered Buildings: ${count} (${((count/assembledPolygons.length)*100).toFixed(1)}%)`);
                console.log(`🛣️  Total Roads from OSM: ${roadWays.length}`);
                console.log(`🎯 Filtering: DISABLED - Complete 360° context loaded`);
                console.log(`⚠️  Skipped (maxBuildings=${maxBuildings}): ${Math.max(0, assembledPolygons.length - count)}`);
                console.log(`🧭 Coverage: FRONT ✓ BACK ✓ LEFT ✓ RIGHT ✓`);
                console.log('===================================================\n');

                // Render Roads
                let roadCount = 0;
                roadWays.forEach((way) => {
                    try {
                        const refs: number[] = way.nodes || [];
                        const latlngs = refs.map((id: number) => nodes[id]).filter(Boolean);
                        
                        if (latlngs.length < 2) return;

                        const points = latlngs.map((n) => {
                            const dx = (n.lon - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                            const dy = (n.lat - origin.lat) * (Math.PI / 180) * R;
                            // After building rotation: X stays X, original Y becomes -Z, so -dy → +dy in final Z
                            // Therefore roads need dy (positive north) to match rotated buildings
                            return new THREE.Vector3(dx, 0.05, dy);
                        });

                        // Determine road width based on highway type
                        const tags = way.tags || {};
                        let width = 4; // default width in meters
                        const highway = tags.highway;
                        
                        if (highway === 'motorway' || highway === 'trunk') width = 12;
                        else if (highway === 'primary') width = 10;
                        else if (highway === 'secondary') width = 8;
                        else if (highway === 'tertiary') width = 6;
                        else if (highway === 'residential' || highway === 'unclassified') width = 5;
                        else if (highway === 'service' || highway === 'track') width = 3;
                        else if (highway === 'footway' || highway === 'path' || highway === 'pedestrian') width = 2;

                        // Create road as a thick line
                        const curve = new THREE.CatmullRomCurve3(points);
                        const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, width / 2, 8, false);
                        
                        // Road color based on type
                        let roadColor = 0x555555; // default grey
                        if (highway === 'motorway' || highway === 'trunk') roadColor = 0x3a3a3a;
                        else if (highway === 'footway' || highway === 'path' || highway === 'pedestrian') roadColor = 0x888888;
                        
                        const roadMaterial = new THREE.MeshStandardMaterial({
                            color: roadColor,
                            roughness: 0.95,
                            metalness: 0.0,
                        });

                        const roadMesh = new THREE.Mesh(tubeGeometry, roadMaterial);
                        roadMesh.receiveShadow = true;
                        roadMesh.castShadow = false; // roads don't cast shadows
                        
                        groupRef.current?.add(roadMesh);
                        roadCount++;
                    } catch (err) {
                        console.warn('Failed to create road mesh', err);
                    }
                });

                console.log(`🛣️  Rendered ${roadCount} roads`);

                if (count === 0) {
                    console.warn('[Google3DTiles] ⚠️ CRITICAL: No buildings could be created!');
                    setError('No buildings could be extruded from OSM footprints here.');
                    buildFallbackPlaceholder();
                } else {
                    console.log(`[Google3DTiles] ✅ SUCCESS: Loaded ${count}/${assembledPolygons.length} buildings and ${roadCount} roads`);
                }
                setIsLoading(false);
            } catch (err) {
                console.error('[Google3DTiles] ❌ Error loading OSM building footprints:', err);
                setError('Failed to load surrounding buildings.');
                buildFallbackPlaceholder();
                setIsLoading(false);
            } finally {
                isFetchingRef.current = false;
            }
        })();

    }, [apiKey, center.lat, center.lng, origin.lat, origin.lng, deletedBuildingIds]);

    // Update building materials when selection changes
    useEffect(() => {
        if (!groupRef.current) return;

        groupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.userData?.isSurroundingBuilding) {
                const buildingId = child.userData.buildingId;
                const isSelected = buildingId === selectedBuildingId;
                
                const material = child.material as THREE.MeshStandardMaterial;
                if (isSelected) {
                    // Highlight selected building with teal/green glow
                    material.color.set(0x14b8a6); // Teal-500
                    material.emissive.set(0x0d9488); // Teal-600
                    material.emissiveIntensity = 0.4;
                } else {
                    // Reset to default gray
                    const gray = 0.85 + Math.random() * 0.1;
                    material.color.setRGB(gray, gray, gray);
                    material.emissive.set(0x000000);
                    material.emissiveIntensity = 0;
                }
            }
        });
    }, [selectedBuildingId]);

    // Remove deleted buildings from scene immediately
    useEffect(() => {
        if (!groupRef.current) return;

        const meshesToRemove: THREE.Mesh[] = [];
        
        groupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.userData?.isSurroundingBuilding) {
                const buildingId = child.userData.buildingId;
                if (deletedBuildingIds.has(buildingId)) {
                    console.log('🗑️ Removing building from scene:', buildingId);
                    meshesToRemove.push(child);
                }
            }
        });

        // Remove the meshes
        meshesToRemove.forEach((mesh) => {
            groupRef.current?.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });

        if (meshesToRemove.length > 0) {
            console.log(`✅ Removed ${meshesToRemove.length} buildings from scene`);
        }
    }, [deletedBuildingIds]);

    // Pointer events handler
    useEffect(() => {
        if (!groupRef.current || !onSelectBuilding || !onDeleteBuilding) return;

        const handlePointerDown = (event: PointerEvent) => {
            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            const intersects = raycaster.intersectObjects(groupRef.current!.children, false);

            console.log('[Google3DTiles] Pointer down. Intersects:', intersects.length);

            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object as THREE.Mesh;
                const buildingId = clickedMesh.userData?.buildingId;
                const isSurroundingBuilding = clickedMesh.userData?.isSurroundingBuilding;

                console.log('[Google3DTiles] Clicked:', { buildingId, isSurroundingBuilding });

                if (buildingId && isSurroundingBuilding) {
                    const now = Date.now();
                    const timeSinceLastClick = now - lastClickTimeRef.current;
                    const isSameBuilding = lastClickedBuildingIdRef.current === buildingId;

                    console.log('[Google3DTiles] Time since last click:', timeSinceLastClick, 'ms', 'Same building:', isSameBuilding);

                    // Double-click detection (within 400ms)
                    if (timeSinceLastClick < 400 && isSameBuilding) {
                        console.log('🗑️ DOUBLE-CLICK! Deleting building:', buildingId);
                        onDeleteBuilding(buildingId);
                        onSelectBuilding(null);
                        lastClickTimeRef.current = 0;
                        lastClickedBuildingIdRef.current = null;
                    } else {
                        // First click - select building
                        console.log('✅ First click - Selecting building:', buildingId);
                        onSelectBuilding(buildingId);
                        lastClickTimeRef.current = now;
                        lastClickedBuildingIdRef.current = buildingId;
                    }

                    event.stopPropagation();
                }
            } else {
                // Clicked empty space - deselect
                console.log('[Google3DTiles] Clicked empty space - deselecting');
                onSelectBuilding(null);
            }
        };

        gl.domElement.addEventListener('pointerdown', handlePointerDown);
        return () => gl.domElement.removeEventListener('pointerdown', handlePointerDown);
    }, [gl, raycaster, camera, onSelectBuilding, onDeleteBuilding]);

    // @ts-ignore - primitive is a valid React Three Fiber element
    return <primitive object={groupRef.current} />;
};
