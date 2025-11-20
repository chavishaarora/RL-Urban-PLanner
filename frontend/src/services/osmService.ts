// Lightweight OSM Overpass fetcher for road centerlines around a bounding box
// NOTE: Runs client-side. If the Overpass endpoint is rate-limited, consider caching or proxying.

export interface LatLng { lat: number; lng: number }

export async function fetchOSMRoadCenterlines(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }): Promise<LatLng[][]> {
  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|road"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
    );
    (._;>;);
    out body;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ data: query })
    });
    if (!res.ok) throw new Error(`Overpass error ${res.status}`);
    const data = await res.json();

    // Build node map
    const nodes: Record<string, LatLng> = {};
    for (const el of data.elements) {
      if (el.type === 'node') nodes[el.id] = { lat: el.lat, lng: el.lon };
    }
    const polylines: LatLng[][] = [];
    for (const el of data.elements) {
      if (el.type === 'way' && Array.isArray(el.nodes) && el.nodes.length >= 2) {
        const line: LatLng[] = [];
        for (const nid of el.nodes) {
          const n = nodes[nid];
          if (n) line.push({ lat: n.lat, lng: n.lng });
        }
        if (line.length >= 2) polylines.push(line);
      }
    }
    return polylines;
  } catch (e) {
    console.warn('OSM fetch failed', e);
    return [];
  }
}
