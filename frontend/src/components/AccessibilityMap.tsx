import React, { useEffect, useState } from 'react';
import { analyzeAccessibility, ACCESSIBILITY_COLORS, INTERSECTION_COLORS, AccessibilityCell, Intersection, AccessibilityLevel } from '@/services/roadAccessibility';
import { renderMapBackground, clearMapBackground, MapBackgroundOverlays } from '@/utils/mapBackground';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

interface AccessibilityMapProps {
  center: { lat: number; lng: number };
  boundary?: { lat: number; lng: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  googleMap?: any;
}

const AccessibilityMap: React.FC<AccessibilityMapProps> = ({ center, boundary, googleMap }) => {
  const [cells, setCells] = useState<AccessibilityCell[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntersections, setShowIntersections] = useState(true);
  const [hoverCell, setHoverCell] = useState<AccessibilityCell | null>(null);
  const [backgroundOverlays, setBackgroundOverlays] = useState<MapBackgroundOverlays | null>(null);

  useEffect(() => {
    let canceled = false;
    async function run() {
      if (!googleMap) return;
      
      setLoading(true);
      setError(null);
      
      // Clear previous background
      if (backgroundOverlays) {
        clearMapBackground(backgroundOverlays);
      }
      
      try {
        // Render background (buildings, roads, boundary)
        const bg = await renderMapBackground(googleMap, center, boundary);
        if (!canceled) setBackgroundOverlays(bg);
        
        // Analyze accessibility
        const { cells, intersections } = await analyzeAccessibility(center, 700, 50);
        if (!canceled) {
          setCells(cells);
          setIntersections(intersections);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to analyze accessibility');
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    run();
    return () => { 
      canceled = true;
      if (backgroundOverlays) {
        clearMapBackground(backgroundOverlays);
      }
    };
  }, [center.lat, center.lng, googleMap]);

  // Render cells on map
  useEffect(() => {
    if (!googleMap || !cells.length) return;

    const overlayKey = 'accessibility-overlay';
    const existing: any[] = googleMap[overlayKey] || [];
    existing.forEach((r: any) => r.setMap(null));
    googleMap[overlayKey] = [];

    cells.forEach(cell => {
      const color = ACCESSIBILITY_COLORS[cell.category];
      const poly = new google.maps.Polygon({
        paths: cell.polygon.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#ffffff',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        fillOpacity: 0.5,
        fillColor: color,
        map: googleMap,
        clickable: true,
        zIndex: 5
      });
      poly.addListener('mouseover', () => setHoverCell(cell));
      poly.addListener('mouseout', () => setHoverCell(null));
      googleMap[overlayKey].push(poly);
    });

    return () => {
      const rects: any[] = googleMap[overlayKey] || [];
      rects.forEach((r: any) => r.setMap(null));
      googleMap[overlayKey] = [];
    };
  }, [googleMap, cells]);

  // Render intersections
  useEffect(() => {
    if (!googleMap || !intersections.length || !showIntersections) return;

    const overlayKey = 'intersection-overlay';
    const existing: any[] = googleMap[overlayKey] || [];
    existing.forEach((r: any) => r.setMap(null));
    googleMap[overlayKey] = [];

    intersections.forEach(inter => {
      const size = inter.importance === 'critical' ? 8 : inter.importance === 'major' ? 6 : 4;
      const color = INTERSECTION_COLORS[inter.importance];
      
      const circle = new google.maps.Circle({
        center: { lat: inter.lat, lng: inter.lng },
        radius: size,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 1.5,
        strokeOpacity: 1,
        map: googleMap,
        zIndex: 100
      });
      googleMap[overlayKey].push(circle);
    });

    return () => {
      const markers: any[] = googleMap[overlayKey] || [];
      markers.forEach((m: any) => m.setMap(null));
      googleMap[overlayKey] = [];
    };
  }, [googleMap, intersections, showIntersections]);

  if (!googleMap) {
    return <div className="p-4 text-sm text-gray-500">Accessibility Map requires a Google Map instance.</div>;
  }

  return (
    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md shadow-xl rounded-2xl p-4 w-80 text-xs space-y-3 border border-slate-200/60">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-800">Road Accessibility</div>
        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showIntersections}
            onChange={e => setShowIntersections(e.target.checked)}
            className="rounded accent-teal-600"
          />
          Intersections
        </label>
      </div>
      <p className="text-[11px] leading-snug text-slate-600">
        Walkability & connectivity based on proximity to road network and major junctions.
      </p>
      {loading && <div className="text-slate-500 animate-pulse">Analyzing…</div>}
      {error && <div className="text-red-600 text-[11px]">{error}</div>}
      
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-slate-700">Accessibility</div>
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(ACCESSIBILITY_COLORS) as [AccessibilityLevel, string][]).map(([k, v]) => (
            <div key={k} className="flex flex-col items-center gap-1.5">
              <div style={{ background: v }} className="w-7 h-7 rounded-full shadow-sm border border-white/50" />
              <span className="text-[9px] text-slate-600 text-center leading-tight">{k}</span>
            </div>
          ))}
        </div>
      </div>

      {showIntersections && (
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-700">Intersections</div>
          <div className="flex gap-3">
            {(Object.entries(INTERSECTION_COLORS) as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div style={{ background: v }} className="w-3 h-3 rounded-full shadow-sm border border-white" />
                <span className="text-[10px] text-slate-600 capitalize">{k}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hoverCell && (
        <div className="mt-2 p-3 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl shadow-sm animate-in fade-in duration-200">
          <div className="font-semibold text-slate-800 mb-2 text-[11px]">Cell Metrics</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-slate-600">Walk score:</div>
            <div className="font-medium text-slate-800">{hoverCell.walkScore.toFixed(0)}/100</div>
            <div className="text-slate-600">Drive score:</div>
            <div className="font-medium text-slate-800">{hoverCell.driveScore.toFixed(0)}/100</div>
            <div className="text-slate-600">Accessibility:</div>
            <div className="font-medium text-teal-700">{hoverCell.category}</div>
            <div className="text-slate-600">Nearest junction:</div>
            <div className="font-medium text-slate-800">{hoverCell.intersectionProximity.toFixed(0)}m</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessibilityMap;
