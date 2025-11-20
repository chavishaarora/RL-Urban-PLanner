import { fetchOSMBuildingsAround, fetchOSMRoadsAround, ROAD_TYPE_WIDTHS, ROAD_TYPE_COLORS } from '@/services/osmBuildings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

export interface MapBackgroundOverlays {
  buildings: any[];
  roads: any[];
  boundary: any | null;
}

/**
 * Renders buildings, roads, and site boundary as background layers on a Google Map
 * @param map - Google Maps instance
 * @param center - Center coordinates
 * @param boundary - Site boundary polygon (optional)
 * @param radius - Radius in meters for fetching OSM data (default: 700)
 * @returns Object containing overlay references for cleanup
 */
export async function renderMapBackground(
  map: any,
  center: { lat: number; lng: number },
  boundary?: { lat: number; lng: number }[],
  radius: number = 700
): Promise<MapBackgroundOverlays> {
  const overlays: MapBackgroundOverlays = {
    buildings: [],
    roads: [],
    boundary: null
  };

  try {
    // Fetch and render buildings
    const buildingData = await fetchOSMBuildingsAround(center, radius);
    if (buildingData && buildingData.buildings) {
      buildingData.buildings.forEach(building => {
        const path = building.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
        const buildingPoly = new google.maps.Polygon({
          paths: path,
          strokeColor: '#cbd5e1',
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: '#e2e8f0',
          fillOpacity: 0.4,
          clickable: false,
          zIndex: 1,
        });
        buildingPoly.setMap(map);
        overlays.buildings.push(buildingPoly);
      });
    }

    // Fetch and render roads
    const roads = await fetchOSMRoadsAround(center, radius);
    roads.forEach(road => {
      const path = road.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
      const baseWidth = ROAD_TYPE_WIDTHS[road.roadType];
      const baseColor = ROAD_TYPE_COLORS[road.roadType];
      
      // Road casing (subtle shadow)
      const casingWidth = baseWidth + 1;
      const casing = new google.maps.Polyline({
        path,
        strokeColor: '#0f172a',
        strokeOpacity: 0.15,
        strokeWeight: casingWidth,
        clickable: false,
        zIndex: 2,
      });
      casing.setMap(map);
      overlays.roads.push(casing);
      
      // Main road line
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: baseColor,
        strokeOpacity: 0.4,
        strokeWeight: baseWidth,
        clickable: false,
        zIndex: 3,
      });
      polyline.setMap(map);
      overlays.roads.push(polyline);
    });

    // Render site boundary
    if (boundary && boundary.length > 0) {
      const boundaryPath = boundary.map(p => ({ lat: p.lat, lng: p.lng }));
      const boundaryPoly = new google.maps.Polygon({
        paths: boundaryPath,
        strokeColor: '#0d9488',
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: 'transparent',
        fillOpacity: 0,
        clickable: false,
        zIndex: 999,
      });
      boundaryPoly.setMap(map);
      overlays.boundary = boundaryPoly;
    }

  } catch (error) {
    console.error('Error rendering map background:', error);
  }

  return overlays;
}

/**
 * Clears all background overlays from the map
 */
export function clearMapBackground(overlays: MapBackgroundOverlays) {
  overlays.buildings.forEach(o => { try { o?.setMap?.(null); } catch(_){} });
  overlays.roads.forEach(o => { try { o?.setMap?.(null); } catch(_){} });
  try { overlays.boundary?.setMap?.(null); } catch(_) {}
  overlays.buildings = [];
  overlays.roads = [];
  overlays.boundary = null;
}
