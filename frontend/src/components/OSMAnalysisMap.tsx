import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocationData } from '../types';
import {
  fetchOSMBuildingsAround,
  fetchOSMRoadsAround,
  classifyBuildingType,
  classifyBuildingHeight,
  classifyBuildingCoverage,
  inferBuildingType,
  inferBuildingHeight,
  inferBuildingCoverage,
  inferBuildingAge,
  inferBuildingAgeEnhanced,
  computePolygonAreaMeters,
  BUILDING_TYPE_COLORS,
  HEIGHT_RANGE_COLORS,
  COVERAGE_LEVEL_COLORS,
  AGE_BUCKET_COLORS,
  ROAD_TYPE_COLORS,
  ROAD_TYPE_WIDTHS,
  BuildingType,
  HeightRange,
  CoverageLevel,
  type AgeBucket
} from '@/services/osmBuildings';
import { MapColorCustomizer } from './MapColorCustomizer';
import { useMapColorConfig } from '@/hooks/useMapColorConfig';
// Download button removed: export functionality handled by global menu

// Use global google object loaded by the app
declare const google: any;

type LayerKind = 'type' | 'height' | 'coverage' | 'age';

interface OSMAnalysisMapProps {
  location: LocationData;
  initialLayer?: LayerKind;
}

// Light theme styling consistent with app
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#a8dadc' }] },
];

export const OSMAnalysisMap: React.FC<OSMAnalysisMapProps> = ({ location, initialLayer = 'type' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any | null>(null);
  const [layer, setLayer] = useState<LayerKind>(initialLayer);
  const [isLoading, setIsLoading] = useState(false);
  const [hideLowConfidence, setHideLowConfidence] = useState(false);
  // Removed local exporting button/state; downloads handled by main menu
  const overlaysRef = useRef<any[]>([]);
  const buildingDataRef = useRef<any[]>([]); // Store building data for fast updates
  const hoverDivRef = useRef<HTMLDivElement | null>(null);
  const roadOverlaysRef = useRef<any[]>([]);
  const boundaryOverlayRef = useRef<any | null>(null);

  // Color customization for each layer
  const typeColorConfig = useMapColorConfig(location.name, 'building-type', BUILDING_TYPE_COLORS);
  const heightColorConfig = useMapColorConfig(location.name, 'building-height', HEIGHT_RANGE_COLORS);
  const coverageColorConfig = useMapColorConfig(location.name, 'building-coverage', COVERAGE_LEVEL_COLORS);
  const ageColorConfig = useMapColorConfig(location.name, 'building-age', AGE_BUCKET_COLORS);

  // Get current color config based on active layer (stable reference)
  const currentColorConfig = layer === 'type' ? typeColorConfig :
                             layer === 'height' ? heightColorConfig :
                             layer === 'coverage' ? coverageColorConfig :
                             ageColorConfig;

  // Get current color categories based on active layer
  const currentCategories = useMemo(() => {
    switch (layer) {
      case 'type': return BUILDING_TYPE_COLORS;
      case 'height': return HEIGHT_RANGE_COLORS;
      case 'coverage': return COVERAGE_LEVEL_COLORS;
      case 'age': return AGE_BUCKET_COLORS;
    }
  }, [layer]);

  const center = useMemo(() => ({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);

  useEffect(() => {
    if (!containerRef.current || map) return;
    // mark not ready for export until overlays are rendered
    try { containerRef.current.setAttribute('data-export-ready','false'); } catch(_) {}
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 16,
      disableDefaultUI: true,
      mapTypeId: 'styled_map',
    });
    const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' });
    mapInstance.mapTypes.set('styled_map', styledMapType);
    // Fit to boundary if available
    if (location.boundary && location.boundary.length > 0) {
      const b = new google.maps.LatLngBounds();
      location.boundary.forEach(p => b.extend(p));
      mapInstance.fitBounds(b);
    }
    setMap(mapInstance);
  }, [center, map, location.boundary]);

  // Listen for export view reset requests
  useEffect(() => {
    if (!map) return;
    const handler = (e: any) => {
      try {
        const framing = e?.detail?.framing || 'wide';
        const paddingPx = framing === 'xwide' ? 240 : framing === 'wide' ? 200 : 40;
        const extraZoom = framing === 'xwide' ? 1 : framing === 'wide' ? 0 : 0;
        if (location.boundary && location.boundary.length > 0) {
          const b = new google.maps.LatLngBounds();
          location.boundary.forEach(p => b.extend(p));
          // apply pixel padding for wider framing
          map.fitBounds(b, paddingPx);
        } else {
          map.setCenter(center);
          map.setZoom(16);
        }
        // additional zoom-out padding
        setTimeout(() => {
          try { map.setZoom(Math.max(0, map.getZoom() - extraZoom)); } catch(_) {}
        }, 250);
      } catch (_) {}
    };
    window.addEventListener('uexport-reset-view', handler);
    return () => window.removeEventListener('uexport-reset-view', handler);
  }, [map, center, location.boundary]);

  // Fast color update effect - updates existing polygons without re-render
  useEffect(() => {
    if (!map || overlaysRef.current.length === 0 || buildingDataRef.current.length === 0) return;
    
    overlaysRef.current.forEach((poly, index) => {
      const data = buildingDataRef.current[index];
      if (!data) return;
      
      const visible = currentColorConfig.isVisible(data.category);
      if (!visible) {
        poly.setOptions({ fillOpacity: 0, strokeOpacity: 0 });
        return;
      }
      
      const fill = currentColorConfig.getColor(data.category);
      const opacity = currentColorConfig.getOpacity(data.category);
      
      poly.setOptions({
        fillColor: fill,
        fillOpacity: opacity * 0.65,
        strokeOpacity: 0.3
      });
    });
  }, [typeColorConfig.config, heightColorConfig.config, coverageColorConfig.config, ageColorConfig.config, layer, map]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try { containerRef.current?.setAttribute('data-export-ready','false'); } catch(_) {}
      
      // Clear existing overlays
      overlaysRef.current.forEach(o => o.setMap(null));
      overlaysRef.current = [];
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }

      // Fetch buildings
      const data = await fetchOSMBuildingsAround(center, 700);
      if (!data || cancelled) { setIsLoading(false); return; }

      // Clear building data for fresh start
      buildingDataRef.current = [];
      
      const polygons = data.buildings;
      polygons.forEach(poly => {
        const path = poly.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
        let fill = '#94a3b8';
        let stroke = '#0f172a';
        let title = '';
        let category = '';
        let visible = true;
        
        if (layer === 'type') {
          const t = inferBuildingType(poly, polygons); // Use predictive inference
          category = t;
          fill = currentColorConfig.getColor(t);
          visible = currentColorConfig.isVisible(t);
          title = `${t}`;
        } else if (layer === 'height') {
          const h = inferBuildingHeight(poly, polygons); // Use predictive inference
          category = h.range;
          fill = currentColorConfig.getColor(h.range);
          visible = currentColorConfig.isVisible(h.range);
          title = h.meters !== null ? `${h.range} (~${h.meters.toFixed(0)}m)` : h.range;
        } else if (layer === 'coverage') {
          const c = inferBuildingCoverage(poly, polygons); // Use predictive inference
          category = c;
          fill = currentColorConfig.getColor(c);
          visible = currentColorConfig.isVisible(c);
          const area = computePolygonAreaMeters(poly.nodes);
          const sizeLabel = c === 'Low' ? 'Small' : c === 'Medium' ? 'Medium' : c === 'High' ? 'Large' : 'Very Large';
          title = `Footprint ${area.toFixed(0)} m² (${sizeLabel})`;
        } else if (layer === 'age') {
          const ageEnhanced = inferBuildingAgeEnhanced(poly, polygons);
          if (hideLowConfidence && ageEnhanced.inferred && ageEnhanced.confidence < 0.4) {
            return; // skip rendering low-confidence inference when toggled
          }
          category = ageEnhanced.bucket;
          fill = currentColorConfig.getColor(ageEnhanced.bucket);
          visible = currentColorConfig.isVisible(ageEnhanced.bucket);
          const ageLabels: Record<AgeBucket, string> = {
            '<1960': 'Pre-1960 (Historic)',
            '1960-1975': '1960-1975 (Post-war)',
            '1975-1990': '1975-1990 (Late Modern)',
            '1990-2005': '1990-2005 (Contemporary)',
            '>2005': '2005+ (Modern)',
            'Unknown': 'Age Unknown'
          };
          const yearText = ageEnhanced.year ? ` (${ageEnhanced.year})` : (ageEnhanced.inferred ? ' (inferred)' : '');
          const confText = ageEnhanced.inferred ? ` • confidence ${(ageEnhanced.confidence*100).toFixed(0)}%` : '';
          title = `${ageLabels[ageEnhanced.bucket]}${yearText}${confText}`;
        }
        
        // Skip if category is hidden
        if (!visible) return;
        
        const opacity = currentColorConfig.getOpacity(category);
        
        const gpoly = new google.maps.Polygon({
          paths: path,
          strokeColor: stroke,
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: fill,
          fillOpacity: opacity * 0.65,
          clickable: true,
        });
        gpoly.setMap(map);
        gpoly.addListener('mouseover', (e: any) => {
          if (!hoverDivRef.current) return;
          hoverDivRef.current.style.display = 'block';
          hoverDivRef.current.innerHTML = `<div class="px-2 py-1 rounded-md bg-white/90 shadow text-[11px] font-medium text-slate-700">${title}</div>`;
          const proj = map.getProjection();
          if (proj) {
            const point = proj.fromLatLngToPoint(e.latLng);
          }
        });
        gpoly.addListener('mousemove', (e: any) => {
          if (!hoverDivRef.current) return;
          const scale = Math.pow(2, map.getZoom());
          const proj = map.getProjection();
          if (!proj) return;
          const worldPoint = proj.fromLatLngToPoint(e.latLng);
          const mapDiv = map.getDiv();
          // Convert world coordinates to pixel within container
          const x = worldPoint.x * scale;
            const y = worldPoint.y * scale;
          // position relative to container center
          const centerWorld = proj.fromLatLngToPoint(map.getCenter());
          const centerX = centerWorld.x * scale;
          const centerY = centerWorld.y * scale;
          const left = (mapDiv.clientWidth / 2) + (x - centerX);
          const top = (mapDiv.clientHeight / 2) + (y - centerY);
          hoverDivRef.current.style.transform = `translate(${left + 8}px, ${top + 8}px)`;
        });
        gpoly.addListener('mouseout', () => {
          if (hoverDivRef.current) hoverDivRef.current.style.display = 'none';
        });
        overlaysRef.current.push(gpoly);
        
        // Store building data for fast color updates
        buildingDataRef.current.push({ category });
      });

      // Fetch and render road network with realistic styling
      const roads = await fetchOSMRoadsAround(center, 700);
      if (cancelled) { setIsLoading(false); return; }
      
      roads.forEach(road => {
        const path = road.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
        const baseWidth = ROAD_TYPE_WIDTHS[road.roadType];
        const baseColor = ROAD_TYPE_COLORS[road.roadType];
        
        // Draw road casing (darker outline) for all roads
        const casingWidth = baseWidth + 1.5;
        const casing = new google.maps.Polyline({
          path,
          strokeColor: '#0f172a',
          strokeOpacity: 0.3,
          strokeWeight: casingWidth,
          clickable: false,
          zIndex: 1,
        });
        casing.setMap(map);
        roadOverlaysRef.current.push(casing);
        
        // Draw main road line
        const polyline = new google.maps.Polyline({
          path,
          strokeColor: baseColor,
          strokeOpacity: 0.9,
          strokeWeight: baseWidth,
          clickable: false,
          zIndex: 2,
        });
        polyline.setMap(map);
        roadOverlaysRef.current.push(polyline);
        
        // Add center line for major roads (dashed effect)
        if (['motorway', 'primary'].includes(road.roadType)) {
          const centerLine = new google.maps.Polyline({
            path,
            strokeColor: '#fbbf24',
            strokeOpacity: 0.7,
            strokeWeight: 0.8,
            clickable: false,
            zIndex: 3,
          });
          centerLine.setMap(map);
          roadOverlaysRef.current.push(centerLine);
        }
      });

      // Draw site boundary if available
      if (location.boundary && location.boundary.length > 0) {
        const boundaryPath = location.boundary.map(p => ({ lat: p.lat, lng: p.lng }));
        const boundaryPoly = new google.maps.Polygon({
          paths: boundaryPath,
          strokeColor: '#0d9488', // teal-600
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: '#14b8a6', // teal-500
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
    load();
    return () => { cancelled = true; };
  }, [map, center, layer, location.boundary, hideLowConfidence]);

  const legendItems = useMemo(() => {
    if (layer === 'type') {
      const order: BuildingType[] = ['Residential','Commercial','School/University','Office'];
      return order.map(k => ({ label: k, color: typeColorConfig.getColor(k) }));
    } else if (layer === 'height') {
      const order: HeightRange[] = ['<10m','10-20m','20-30m','30-50m','>50m'];
      return order.map(k => ({ label: k, color: heightColorConfig.getColor(k) }));
    } else if (layer === 'coverage') {
      const order: CoverageLevel[] = ['Low','Medium','High','Very High'];
      const labelMap: Record<CoverageLevel,string> = {
        Low: 'Small',
        Medium: 'Medium',
        High: 'Large',
        'Very High': 'Very Large',
        Unknown: 'Unknown',
      };
      return order.map(k => ({ label: labelMap[k], color: coverageColorConfig.getColor(k) }));
    } else if (layer === 'age') {
      const order: AgeBucket[] = ['<1960','1960-1975','1975-1990','1990-2005','>2005'];
      const labelMap: Record<AgeBucket,string> = {
        '<1960': 'Pre-1960',
        '1960-1975': '1960-1975',
        '1975-1990': '1975-1990',
        '1990-2005': '1990-2005',
        '>2005': '2005+',
        'Unknown': 'Unknown'
      };
      return order.map(k => ({ label: labelMap[k], color: ageColorConfig.getColor(k) }));
    }
    return [];
  }, [layer, typeColorConfig.config, heightColorConfig.config, coverageColorConfig.config, ageColorConfig.config]);

  // Local export handler removed

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              layer==='type'
                ?'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                :'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => setLayer('type')}
          >Type</button>
          <button
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              layer==='height'
                ?'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                :'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => setLayer('height')}
          >Height</button>
          <button
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              layer==='coverage'
                ?'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                :'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => setLayer('coverage')}
          >Footprint</button>
          <button
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              layer==='age'
                ?'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                :'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            onClick={() => setLayer('age')}
          >Age</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-1 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {layer === 'age' && (
        <div className="flex items-center justify-end -mt-2 mb-2">
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
            <input type="checkbox" className="accent-teal-600" checked={hideLowConfidence} onChange={e => setHideLowConfidence(e.target.checked)} />
            Hide low-confidence (&lt;40%)
          </label>
        </div>
      )}
      <div className="relative">
        <div ref={containerRef} data-map-capture="true" id="context-map-capture" className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden shadow-lg">
          {/* Hover tooltip layer */}
          <div ref={hoverDivRef} className="pointer-events-none absolute top-0 left-0 z-[9999]" style={{display:'none'}} />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
              <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Color Customizer - positioned relative to wrapper */}
        <MapColorCustomizer
          mapType={`building-${layer}`}
          categories={currentCategories}
          currentConfig={currentColorConfig.config}
          onConfigChange={currentColorConfig.setConfig}
          onReset={currentColorConfig.resetConfig}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500 italic">Source: OpenStreetMap contributors. Building classifications use predictive inference for missing data with local historical context and confidence scoring.</p>
    </div>
  );
};

export default OSMAnalysisMap;
