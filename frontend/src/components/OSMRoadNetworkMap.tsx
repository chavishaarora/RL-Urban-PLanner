import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocationData } from '../types';
import {
  fetchOSMRoadsAround,
  fetchOSMBuildingsAround,
  ROAD_TYPE_COLORS,
  ROAD_TYPE_WIDTHS,
  RoadType
} from '@/services/osmBuildings';
import AccessibilityMap from './AccessibilityMap';
import { MapColorCustomizer } from './MapColorCustomizer';
import { useMapColorConfig } from '@/hooks/useMapColorConfig';

declare const google: any;

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#a8dadc' }] },
];

interface OSMRoadNetworkMapProps {
  location: LocationData;
}

export const OSMRoadNetworkMap: React.FC<OSMRoadNetworkMapProps> = ({ location }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverDivRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'hierarchy' | 'accessibility'>('hierarchy');
  const roadOverlaysRef = useRef<any[]>([]);
  const roadDataRef = useRef<any[]>([]); // Store road data for fast updates
  const buildingOverlaysRef = useRef<any[]>([]);
  const boundaryOverlayRef = useRef<any | null>(null);

  // Color customization for road network
  const roadColorConfig = useMapColorConfig(location.name, 'road-network', ROAD_TYPE_COLORS);

  const center = useMemo(() => ({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);

  useEffect(() => {
    if (!containerRef.current || map) return;
    try { containerRef.current.setAttribute('data-export-ready','false'); } catch(_) {}
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      mapTypeId: 'styled_map',
    });
    const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' });
    mapInstance.mapTypes.set('styled_map', styledMapType);
    if (location.boundary && location.boundary.length > 0) {
      const b = new google.maps.LatLngBounds();
      location.boundary.forEach(p => b.extend(p));
      mapInstance.fitBounds(b);
    }
    setMap(mapInstance);
  }, [center, map, location.boundary]);

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

  // Fast color update effect - updates existing roads without re-render
  useEffect(() => {
    if (!map || mode !== 'hierarchy' || roadOverlaysRef.current.length === 0 || roadDataRef.current.length === 0) return;
    
    // Roads are stored in groups of 2-3 (casing + main + optional center line)
    roadDataRef.current.forEach((data, index) => {
      const visible = roadColorConfig.isVisible(data.roadType);
      const color = roadColorConfig.getColor(data.roadType);
      const opacity = roadColorConfig.getOpacity(data.roadType);
      
      const casingIndex = data.casingIndex;
      const mainIndex = data.mainIndex;
      const centerIndex = data.centerIndex;
      
      if (!visible) {
        if (casingIndex !== undefined) roadOverlaysRef.current[casingIndex]?.setOptions({ strokeOpacity: 0 });
        if (mainIndex !== undefined) roadOverlaysRef.current[mainIndex]?.setOptions({ strokeOpacity: 0 });
        if (centerIndex !== undefined) roadOverlaysRef.current[centerIndex]?.setOptions({ strokeOpacity: 0 });
        return;
      }
      
      if (casingIndex !== undefined) roadOverlaysRef.current[casingIndex]?.setOptions({ strokeOpacity: 0.5 });
      if (mainIndex !== undefined) {
        roadOverlaysRef.current[mainIndex]?.setOptions({
          strokeColor: color,
          strokeOpacity: 1.0
        });
      }
      if (centerIndex !== undefined) roadOverlaysRef.current[centerIndex]?.setOptions({ strokeOpacity: 0.9 });
    });
  }, [roadColorConfig.config, map, mode]);

  useEffect(() => {
    if (!map) return;
    if (mode !== 'hierarchy') return; // Only render roads in hierarchy mode
    
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try { containerRef.current?.setAttribute('data-export-ready','false'); } catch(_) {}
      
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      buildingOverlaysRef.current.forEach(o => o.setMap(null));
      buildingOverlaysRef.current = [];
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }

      // Fetch buildings and roads in parallel for faster loading
      const [buildingData, roads] = await Promise.all([
        fetchOSMBuildingsAround(center, 700),
        fetchOSMRoadsAround(center, 700)
      ]);
      
      if (cancelled) { setIsLoading(false); return; }

      // Render buildings in background
      if (buildingData) {
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
          buildingOverlaysRef.current.push(buildingPoly);
        });
      }
      
      // Clear road data for fresh start
      roadDataRef.current = [];
      
      roads.forEach(road => {
        const path = road.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
        const baseWidth = ROAD_TYPE_WIDTHS[road.roadType];
        const baseColor = roadColorConfig.getColor(road.roadType);
        const visible = roadColorConfig.isVisible(road.roadType);
        const opacity = roadColorConfig.getOpacity(road.roadType);
        
        const casingIndex = roadOverlaysRef.current.length;
        
        // Road casing (always render, but hide if not visible)
        const casingWidth = baseWidth + 2;
        const casing = new google.maps.Polyline({
          path,
          strokeColor: '#0f172a',
          strokeOpacity: visible ? 0.5 : 0,
          strokeWeight: casingWidth,
          clickable: false,
          zIndex: 1,
        });
        casing.setMap(map);
        roadOverlaysRef.current.push(casing);
        
        const mainIndex = roadOverlaysRef.current.length;
        
        // Main road line (always render, but hide if not visible)
        const polyline = new google.maps.Polyline({
          path,
          strokeColor: baseColor,
          strokeOpacity: visible ? 1.0 : 0,
          strokeWeight: baseWidth,
          clickable: true,
          zIndex: 2,
        });
        polyline.setMap(map);
        roadOverlaysRef.current.push(polyline);
        
        let centerIndex = undefined;
        
        // Center line for major roads (always render, but hide if not visible)
        if (['motorway', 'primary'].includes(road.roadType)) {
          centerIndex = roadOverlaysRef.current.length;
          const centerLine = new google.maps.Polyline({
            path,
            strokeColor: '#fbbf24',
            strokeOpacity: visible ? 0.9 : 0,
            strokeWeight: 1.2,
            clickable: false,
            zIndex: 3,
          });
          centerLine.setMap(map);
          roadOverlaysRef.current.push(centerLine);
        }
        
        // Add hover tooltip for roads
        const roadName = road.tags.name || road.tags.ref || 'Unnamed road';
        polyline.addListener('mouseover', () => {
          if (!hoverDivRef.current) return;
          hoverDivRef.current.style.display = 'block';
          hoverDivRef.current.innerHTML = `<div class="px-2 py-1 rounded-md bg-white shadow text-[11px] font-medium text-slate-700">${roadName} <span class="text-slate-400">(${road.roadType})</span></div>`;
        });
        polyline.addListener('mousemove', (e: any) => {
          if (!hoverDivRef.current) return;
          const proj = map.getProjection();
          if (!proj) return;
          const scale = Math.pow(2, map.getZoom());
          const worldPoint = proj.fromLatLngToPoint(e.latLng);
          const centerWorld = proj.fromLatLngToPoint(map.getCenter());
          const mapDiv = map.getDiv();
          const left = (mapDiv.clientWidth / 2) + (worldPoint.x * scale - centerWorld.x * scale);
          const top = (mapDiv.clientHeight / 2) + (worldPoint.y * scale - centerWorld.y * scale);
          hoverDivRef.current.style.transform = `translate(${left + 6}px, ${top + 6}px)`;
        });
        polyline.addListener('mouseout', () => {
          if (hoverDivRef.current) hoverDivRef.current.style.display = 'none';
        });
        
        // Store road data with overlay indices for fast updates
        roadDataRef.current.push({
          roadType: road.roadType,
          casingIndex,
          mainIndex,
          centerIndex
        });
      });

      // Site boundary
      if (location.boundary && location.boundary.length > 0) {
        const boundaryPath = location.boundary.map(p => ({ lat: p.lat, lng: p.lng }));
        const boundaryPoly = new google.maps.Polygon({
          paths: boundaryPath,
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
    load();
    return () => { 
      cancelled = true;
      // Cleanup overlays when switching modes
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      buildingOverlaysRef.current.forEach(o => o.setMap(null));
      buildingOverlaysRef.current = [];
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }
    };
  }, [map, center, location.boundary, mode]);

  const legendItems = useMemo(() => {
    const order: RoadType[] = ['motorway', 'primary', 'secondary', 'tertiary', 'residential', 'service'];
    return order.map(k => ({ label: k.charAt(0).toUpperCase() + k.slice(1), color: roadColorConfig.getColor(k) }));
  }, [roadColorConfig.config]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('hierarchy')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'hierarchy'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Street Hierarchy
          </button>
          <button
            onClick={() => setMode('accessibility')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'accessibility'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Accessibility
          </button>
        </div>
        {mode === 'hierarchy' && (
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
        <div ref={containerRef} data-map-capture="true" id="context-map-capture" className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden shadow-lg">
          <div ref={hoverDivRef} className="pointer-events-none absolute top-0 left-0 z-[9999]" style={{ display: 'none' }} />
          
          {mode === 'accessibility' && <AccessibilityMap center={center} boundary={location.boundary} googleMap={map} />}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
              <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Color Customizer - only show in hierarchy mode */}
        {mode === 'hierarchy' && (
          <MapColorCustomizer
            mapType="road-network"
            categories={ROAD_TYPE_COLORS}
            currentConfig={roadColorConfig.config}
            onConfigChange={roadColorConfig.setConfig}
            onReset={roadColorConfig.resetConfig}
          />
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500 italic">Source: OpenStreetMap contributors. {mode === 'hierarchy' ? 'Hover over roads to view details.' : 'Hover over cells to view accessibility metrics.'}</p>
    </div>
  );
};

export default OSMRoadNetworkMap;
