import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocationData } from '../types';
import { fetchOSMLandUseAround, fetchOSMBuildingsAround, fetchOSMRoadsAround, createInferredLandUseZones, LANDUSE_TYPE_COLORS, LandUseType, fetchOSMAmenitiesAround, ROAD_TYPE_WIDTHS, ROAD_TYPE_COLORS } from '@/services/osmBuildings';
import { buildGrid, classifyGridCells, smoothGrid, computeMix, computeDevelopmentPotential, GridCell } from '@/services/landUseGrid';
import PopulationDensityMap from './PopulationDensityMap';
import { MapColorCustomizer } from './MapColorCustomizer';
import { useMapColorConfig } from '@/hooks/useMapColorConfig';

declare const google: any;

const lightMapStyle = [
  // Base geometry
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  
  // Roads
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#737373' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  
  // Buildings - VISIBLE
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  
  // Transit - hide
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8eaf8' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  
  // Landscape
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
];

type LandUseMode = 'smoothed' | 'population';
interface OSMLandUseMapProps { location: LocationData; }

export const OSMLandUseMap: React.FC<OSMLandUseMapProps> = ({ location }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverDivRef = useRef<HTMLDivElement | null>(null);
  const boundaryOverlayRef = useRef<any | null>(null);
  const overlaysRef = useRef<any[]>([]); // polygons we add so we can clear
  const polygonDataRef = useRef<GridCell[]>([]); // Store cell data for quick updates
  const roadOverlaysRef = useRef<any[]>([]); // road polylines
  const canvasOverlayRef = useRef<any | null>(null); // Custom canvas overlay
  const [map, setMap] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<LandUseMode>('smoothed');
  const [hideLowConfidence, setHideLowConfidence] = useState(true);
  const center = useMemo(() => ({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);

  // Color configuration hook
  const projectId = location.name || 'default'; // Use project name as ID
  const colorConfig = useMapColorConfig(projectId, 'landuse', LANDUSE_TYPE_COLORS, 0.7);

  // --- Color utilities ---
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const s = hex.replace('#','');
    const bigint = parseInt(s, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }
  function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r,g,b].map(v=> v.toString(16).padStart(2,'0')).join('');
  }
  function blendHex(a: string, b: string, t: number): string {
    const c1 = hexToRgb(a); const c2 = hexToRgb(b);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b2 = Math.round(c1.b + (c2.b - c1.b) * t);
    return rgbToHex(r,g,b2);
  }
  function lerp3(x: number, c0: string, c1: string, c2: string): string {
    if (x <= 0.5) {
      const t = x / 0.5; return blendHex(c0, c1, t);
    } else {
      const t = (x - 0.5) / 0.5; return blendHex(c1, c2, t);
    }
  }

  // Init map
  useEffect(() => {
    if (map || !containerRef.current) return;
    try { containerRef.current.setAttribute('data-export-ready','false'); } catch(_) {}
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      mapTypeId: 'styled_map'
    });
    mapInstance.mapTypes.set('styled_map', new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' }));
    if (location.boundary && location.boundary.length > 0) {
      const b = new google.maps.LatLngBounds();
      location.boundary.forEach(p => b.extend(p));
      mapInstance.fitBounds(b);
    }
    setMap(mapInstance);
  }, [map, center, location.boundary]);

  // Export view reset listener
  useEffect(() => {
    if (!map) return;
    const handler = (e: any) => {
      try {
        const framing = e?.detail?.framing || 'wide';
        const paddingPx = framing === 'xwide' ? 260 : framing === 'wide' ? 160 : 40;
        const extraZoom = framing === 'xwide' ? 3 : framing === 'wide' ? 2 : 1;
        if (location.boundary && location.boundary.length > 0) {
          const b = new google.maps.LatLngBounds();
          location.boundary.forEach(p => b.extend(p));
          map.fitBounds(b, paddingPx);
        } else {
          map.setCenter(center);
          map.setZoom(15);
        }
        setTimeout(()=>{ try { map.setZoom(Math.max(0, map.getZoom()-extraZoom)); } catch(_) {} }, 250);
      } catch (_) {}
    };
    window.addEventListener('uexport-reset-view', handler);
    return () => window.removeEventListener('uexport-reset-view', handler);
  }, [map, center, location.boundary]);

  // Fast color update effect - updates existing polygons without re-rendering
  useEffect(() => {
    if (!map || mode !== 'smoothed' || overlaysRef.current.length === 0) return;
    
    // Update colors on existing polygons
    overlaysRef.current.forEach((poly, index) => {
      const cell = polygonDataRef.current[index];
      if (!cell || !cell.landUse) return;
      
      const fill = colorConfig.getColor(cell.landUse);
      const visible = colorConfig.isVisible(cell.landUse);
      const customOpacity = colorConfig.getOpacity(cell.landUse);
      
      let opacity = customOpacity;
      if (!cell.explicit) {
        const conf = cell.confidence ?? 0.5;
        const baseOpacity = hideLowConfidence ? (conf < 0.35 ? 0 : 0.45 + 0.25 * conf) : (0.45 + 0.25 * conf);
        opacity = baseOpacity * customOpacity;
      }
      
      if (!visible) {
        poly.setOptions({ fillOpacity: 0, strokeOpacity: 0 });
      } else {
        poly.setOptions({ 
          fillColor: fill, 
          fillOpacity: opacity,
          strokeOpacity: 0.4 
        });
      }
    });
  }, [colorConfig.config, hideLowConfidence, mode, map]);

  const previousModeRef = useRef<LandUseMode>('smoothed');

  // Load data & render predictive land use for smoothed mode ONLY when entering that mode
  useEffect(() => {
    if (!map) return;
    const enteringSmoothed = mode === 'smoothed' && previousModeRef.current !== 'smoothed';
    const stayingSmoothed = mode === 'smoothed' && previousModeRef.current === 'smoothed';
    const leavingSmoothed = previousModeRef.current === 'smoothed' && mode !== 'smoothed';

    if (leavingSmoothed) {
      // Clear overlays once when leaving smoothed mode
      overlaysRef.current.forEach(o => o.setMap(null));
      overlaysRef.current = [];
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }
    }

    if (mode !== 'smoothed') {
      previousModeRef.current = mode;
      return; // population mode does its own rendering, nothing to do here
    }

    if (!enteringSmoothed && !stayingSmoothed) {
      previousModeRef.current = mode;
      return;
    }
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      try { containerRef.current?.setAttribute('data-export-ready','false'); } catch(_) {}
      // Clear previous overlays
      overlaysRef.current.forEach(o => o.setMap(null));
      overlaysRef.current = [];
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.setMap(null);
        canvasOverlayRef.current = null;
      }

      // Fetch all data in parallel for faster loading
      const [landUseData, buildingData, amenities] = await Promise.all([
        fetchOSMLandUseAround(center, 700),
        fetchOSMBuildingsAround(center, 700),
        fetchOSMAmenitiesAround(center, 700)
      ]);
      if (cancelled) { setIsLoading(false); return; }

      const inferredZones = buildingData?.buildings ? createInferredLandUseZones(buildingData.buildings) : [];

      // Single smoothed grid rendering
      const { cells, cols, rows } = buildGrid(center, 700, 30);
      let classified: GridCell[] = classifyGridCells(cells, landUseData, inferredZones);
      classified = smoothGrid(classified, rows, cols);

      // Store cell data for fast color updates
      polygonDataRef.current = [];

      classified.forEach(c => {
          // decide color & opacity per mode
          let fill = '#e2e8f0';
          let opacity = 0.6;
          let strokeColor = '#ffffff'; // White border for hexagons
          let strokeOpacity = 0.4;
          let strokeWeight = 1;
          let visible = true;
          
          if (c.landUse) {
            // Use custom color configuration
            fill = colorConfig.getColor(c.landUse);
            visible = colorConfig.isVisible(c.landUse);
            const customOpacity = colorConfig.getOpacity(c.landUse);
            
            if (!c.explicit) {
              const conf = c.confidence ?? 0.5;
              const baseOpacity = hideLowConfidence ? (conf < 0.35 ? 0 : 0.45 + 0.25 * conf) : (0.45 + 0.25 * conf);
              opacity = baseOpacity * customOpacity;
            } else {
              opacity = customOpacity;
            }
          }
          
          // Skip if category is hidden
          if (!visible) return;
          
          const poly = new google.maps.Polygon({
            paths: c.polygon.map(p => ({ lat: p.lat, lng: p.lng })),
            strokeColor: strokeColor, strokeOpacity: strokeOpacity, strokeWeight: strokeWeight,
            fillColor: fill, fillOpacity: opacity, clickable: true, zIndex: 5,
          });
          poly.setMap(map);
          
          // Store cell data for this polygon
          polygonDataRef.current.push(c);
          
          poly.addListener('mouseover', () => {
            if (!hoverDivRef.current) return;
            hoverDivRef.current.style.display = 'block';
            const text = `${c.landUse ?? 'Unclassified'}${c.explicit ? '' : ' (inferred)'}`;
            hoverDivRef.current.innerHTML = `<div class="px-2 py-1 rounded-md bg-white/90 shadow text-[11px] font-medium text-slate-700">${text}</div>`;
          });
          poly.addListener('mousemove', (e: any) => {
            if (!hoverDivRef.current) return;
            const proj = map.getProjection(); if (!proj) return;
            const scale = Math.pow(2, map.getZoom());
            const worldPoint = proj.fromLatLngToPoint(e.latLng);
            const centerWorld = proj.fromLatLngToPoint(map.getCenter());
            const mapDiv = map.getDiv();
            const left = (mapDiv.clientWidth / 2) + (worldPoint.x * scale - centerWorld.x * scale);
            const top = (mapDiv.clientHeight / 2) + (worldPoint.y * scale - centerWorld.y * scale);
            hoverDivRef.current.style.transform = `translate(${left + 6}px, ${top + 6}px)`;
          });
          poly.addListener('mouseout', () => { if (hoverDivRef.current) hoverDivRef.current.style.display = 'none'; });
          overlaysRef.current.push(poly);
        });

      // Site boundary polygon
      if (location.boundary && location.boundary.length > 0) {
        const boundaryPoly = new google.maps.Polygon({
          paths: location.boundary.map(p => ({ lat: p.lat, lng: p.lng })),
          strokeColor: '#0d9488',
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: '#14b8a6',
          fillOpacity: 0.05,
          clickable: false,
          zIndex: 1000,
        });
        boundaryPoly.setMap(map);
        boundaryOverlayRef.current = boundaryPoly;
      }

      setIsLoading(false);
      try { containerRef.current?.setAttribute('data-export-ready','true'); } catch(_) {}
    };

    loadData();
    previousModeRef.current = mode;
    return () => { cancelled = true; };
  }, [map, center, location.boundary, mode, hideLowConfidence]);

  const legendItems = useMemo(() => {
    const order: LandUseType[] = ['Park/Green', 'Residential', 'Commercial', 'Industrial', 'Water', 'Agricultural', 'Institutional'];
    return order.map(k => ({ label: k, color: colorConfig.getColor(k) }));
  }, [colorConfig.config]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('smoothed')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'smoothed'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Land Use
          </button>
          <button
            onClick={() => setMode('population')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'population'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Population
          </button>
        </div>
        {mode === 'smoothed' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-1 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
              <span className="text-slate-600">{item.label}</span>
            </div>
          ))}
          </div>
        )}
      </div>
      <div className="relative">
        {/* Google Map container - keep empty to avoid DOM conflicts */}
        <div ref={containerRef} data-map-capture="true" id="context-map-capture" className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden relative shadow-lg" />

        {/* Hover tooltip lives outside the map DOM */}
        <div ref={hoverDivRef} className="pointer-events-none absolute top-0 left-0 z-[9999]" style={{ display: 'none' }} />

        {/* Color Customizer */}
        {mode === 'smoothed' && (
          <MapColorCustomizer
            mapType="landuse"
            categories={LANDUSE_TYPE_COLORS}
            currentConfig={colorConfig.config}
            onConfigChange={colorConfig.setConfig}
            onReset={colorConfig.resetConfig}
          />
        )}

        {/* Mode-specific UI overlays (outside map DOM) */}
        {mode === 'smoothed' && (
          <div className="absolute top-16 right-4 z-[1000]">
            <label className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-700 shadow-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-teal-600"
                checked={hideLowConfidence}
                onChange={e => setHideLowConfidence(e.target.checked)}
              />
              Hide low-confidence (&lt;35%)
            </label>
          </div>
        )}

        {mode === 'population' && map && (
          <PopulationDensityMap center={center} boundary={location.boundary} googleMap={map} />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
            <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500 italic">
        {mode === 'smoothed' 
          ? 'Source: OpenStreetMap contributors. Land use uses smoothed grid inference with confidence and optional composition/potential analysis.'
          : 'Hybrid: OSM buildings + Google Places weighting. Not official census data.'}
      </p>
    </div>
  );
};

export default OSMLandUseMap;
