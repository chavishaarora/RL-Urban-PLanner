import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LocationData } from '../types';
import {
  fetchOSMBuildingsAround,
  fetchOSMRoadsAround,
  fetchOSMLandUseAround,
  inferBuildingType,
  inferBuildingHeight,
  inferBuildingCoverage,
  inferBuildingAge,
  BUILDING_TYPE_COLORS,
  HEIGHT_RANGE_COLORS,
  COVERAGE_LEVEL_COLORS,
  AGE_BUCKET_COLORS,
  LANDUSE_TYPE_COLORS,
  ROAD_TYPE_COLORS,
  ROAD_TYPE_WIDTHS,
} from '@/services/osmBuildings';
import { buildGrid, classifyGridCells } from '@/services/landUseGrid';
import { estimatePopulationGrid } from '@/services/populationDensity';
import { analyzeAccessibility } from '@/services/roadAccessibility';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

interface LayeredMapViewProps {
  location: LocationData | null;
}


const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#a8dadc' }] },
];

export const LayeredMapView: React.FC<LayeredMapViewProps> = ({ location }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Active layer - only one analysis layer at a time (like radio buttons)
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [layerOpacity, setLayerOpacity] = useState(0.6);

  // 8 analysis layers
  const layers = [
    { id: 'building-type', label: 'Building Type' },
    { id: 'building-height', label: 'Building Height' },
    { id: 'building-footprint', label: 'Building Footprint' },
    { id: 'building-age', label: 'Building Age' },
    { id: 'landuse', label: 'Land Use' },
    { id: 'population', label: 'Population' },
    { id: 'street-hierarchy', label: 'Street Hierarchy' },
    { id: 'accessibility', label: 'Accessibility' },
  ];

  // Data states
  const [buildings, setBuildings] = useState<any[]>([]);
  const [roads, setRoads] = useState<any[]>([]);
  const [landuses, setLanduses] = useState<any[]>([]);
  const [gridCells, setGridCells] = useState<any[]>([]);
  const [popCells, setPopCells] = useState<any[]>([]);
  const [accessCells, setAccessCells] = useState<any[]>([]);

  // Overlay references
  const overlaysRef = useRef<{ [key: string]: any[] }>({});

  const center = useMemo(() => ({ lat: location?.latitude || 0, lng: location?.longitude || 0 }), [location]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || map || !location) return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center,
      zoom: 16,
      disableDefaultUI: true,
      mapTypeId: 'styled_map',
    });

    const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' });
    mapInstance.mapTypes.set('styled_map', styledMapType);

    // Fit to boundary if available
    if (location.boundary && location.boundary.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      location.boundary.forEach((p: any) => bounds.extend(p));
      mapInstance.fitBounds(bounds);

      // Draw boundary
      const boundary = new google.maps.Polygon({
        paths: location.boundary,
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillOpacity: 0,
        map: mapInstance,
      });
    }

    setMap(mapInstance);
  }, [center, map, location]);

  // Fetch OSM data
  useEffect(() => {
    if (!map || !location) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [buildingsData, roadsData, landusesData] = await Promise.all([
          fetchOSMBuildingsAround(center, 700),
          fetchOSMRoadsAround(center, 700),
          fetchOSMLandUseAround(center, 700),
        ]);

        // Extract buildings array from result
        const buildingsArray = buildingsData?.buildings || [];
        const roadsArray = roadsData || [];

        setBuildings(buildingsArray);
        setRoads(roadsArray);
        setLanduses(landusesData);

        // Generate grid data for land use and population
        if (location.boundary && location.boundary.length > 0) {
          const { cells } = buildGrid(center, 700, 100);
          // Don't use buildingsArray directly - need to create inferred zones
          const classifiedGrid = classifyGridCells(cells, landusesData, []);
          setGridCells(classifiedGrid);

          // Population estimation - simplified approach
          const popGrid = await estimatePopulationGrid(center, 700);
          setPopCells(popGrid?.cells || []);

          // Accessibility analysis - simplified approach
          const accessGrid = await analyzeAccessibility(center, 700);
          setAccessCells(accessGrid?.cells || []);
        }
      } catch (error) {
        console.error('Error fetching OSM data:', error);
        // Set empty arrays on error to prevent crashes
        setBuildings([]);
        setRoads([]);
        setLanduses([]);
        setGridCells([]);
        setPopCells([]);
        setAccessCells([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [map, location, center]);

  // Render Building Type layer
  useEffect(() => {
    if (!map || !buildings || !Array.isArray(buildings) || buildings.length === 0) return;

    const key = 'building-type';

    // Clear existing overlays
    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'building-type') return;

    const newOverlays: any[] = [];
    buildings.forEach(building => {
      const typeResult = inferBuildingType(building, buildings);
      const color = BUILDING_TYPE_COLORS[typeResult] || '#94a3b8';

      const polygon = new google.maps.Polygon({
        paths: building.coordinates,
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(polygon);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, buildings, activeLayer, layerOpacity]);

  // Render Building Height layer
  useEffect(() => {
    if (!map || !buildings || !Array.isArray(buildings) || buildings.length === 0) return;

    const key = 'building-height';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'building-height') return;

    const newOverlays: any[] = [];
    buildings.forEach(building => {
      const heightResult = inferBuildingHeight(building, buildings);
      const color = HEIGHT_RANGE_COLORS[heightResult.range] || '#94a3b8';

      const polygon = new google.maps.Polygon({
        paths: building.coordinates,
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(polygon);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, buildings, activeLayer, layerOpacity]);

  // Render Building Footprint layer
  useEffect(() => {
    if (!map || !buildings || !Array.isArray(buildings) || buildings.length === 0) return;

    const key = 'building-footprint';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'building-footprint') return;

    const newOverlays: any[] = [];
    buildings.forEach(building => {
      const coverage = inferBuildingCoverage(building, buildings);
      const color = COVERAGE_LEVEL_COLORS[coverage] || '#94a3b8';

      const polygon = new google.maps.Polygon({
        paths: building.coordinates,
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(polygon);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, buildings, activeLayer, layerOpacity]);

  // Render Building Age layer
  useEffect(() => {
    if (!map || !buildings || !Array.isArray(buildings) || buildings.length === 0) return;

    const key = 'building-age';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'building-age') return;

    const newOverlays: any[] = [];
    buildings.forEach(building => {
      const ageResult = inferBuildingAge(building, buildings);
      const color = AGE_BUCKET_COLORS[ageResult.bucket] || '#94a3b8';

      const polygon = new google.maps.Polygon({
        paths: building.coordinates,
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(polygon);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, buildings, activeLayer, layerOpacity]);

  // Render Land Use layer
  useEffect(() => {
    if (!map || !gridCells.length) return;

    const key = 'landuse';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'landuse') return;

    const newOverlays: any[] = [];
    gridCells.forEach((cell: any) => {
      const color = LANDUSE_TYPE_COLORS[cell.landUse || cell.primaryType] || '#94a3b8';

      // Use hexagonal polygon if available, otherwise fall back to rectangle
      if (cell.polygon) {
        const polygon = new google.maps.Polygon({
          paths: cell.polygon,
          fillColor: color,
          fillOpacity: layerOpacity * 0.85,
          strokeColor: '#ffffff',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          map: map,
        });
        newOverlays.push(polygon);
      } else {
        const rectangle = new google.maps.Rectangle({
          bounds: {
            north: cell.center.lat + cell.cellSize / 111320 / 2,
            south: cell.center.lat - cell.cellSize / 111320 / 2,
            east: cell.center.lng + cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
            west: cell.center.lng - cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
          },
          fillColor: color,
          fillOpacity: layerOpacity,
          strokeColor: '#ffffff',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          map: map,
        });
        newOverlays.push(rectangle);
      }
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, gridCells, activeLayer, layerOpacity]);

  // Render Population layer
  useEffect(() => {
    if (!map || !popCells.length) return;

    const key = 'population';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'population') return;

    const newOverlays: any[] = [];
    popCells.forEach((cell: any) => {
      const intensity = Math.min(cell.density / 10000, 1);
      const color = `rgba(20, 184, 166, ${intensity})`;

      const rectangle = new google.maps.Rectangle({
        bounds: {
          north: cell.center.lat + cell.cellSize / 111320 / 2,
          south: cell.center.lat - cell.cellSize / 111320 / 2,
          east: cell.center.lng + cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
          west: cell.center.lng - cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
        },
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(rectangle);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, popCells, activeLayer, layerOpacity]);

  // Render Street Hierarchy layer
  useEffect(() => {
    if (!map || !roads.length) return;

    const key = 'street-hierarchy';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'street-hierarchy') return;

    const newOverlays: any[] = [];
    roads.forEach((road: any) => {
      const baseWidth = ROAD_TYPE_WIDTHS[road.roadType] || 2;
      const baseColor = ROAD_TYPE_COLORS[road.roadType] || '#94a3b8';

      const polyline = new google.maps.Polyline({
        path: road.coordinates,
        strokeColor: baseColor,
        strokeOpacity: layerOpacity,
        strokeWeight: baseWidth,
        map: map,
      });
      newOverlays.push(polyline);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, roads, activeLayer, layerOpacity]);

  // Render Accessibility layer
  useEffect(() => {
    if (!map || !accessCells.length) return;

    const key = 'accessibility';

    if (overlaysRef.current[key]) {
      overlaysRef.current[key].forEach(o => o.setMap(null));
      overlaysRef.current[key] = [];
    }

    if (activeLayer !== 'accessibility') return;

    const newOverlays: any[] = [];
    const colors: any = {
      high: '#10b981',
      medium: '#fbbf24',
      low: '#ef4444',
    };

    accessCells.forEach((cell: any) => {
      const color = colors[cell.accessLevel] || '#94a3b8';

      const rectangle = new google.maps.Rectangle({
        bounds: {
          north: cell.center.lat + cell.cellSize / 111320 / 2,
          south: cell.center.lat - cell.cellSize / 111320 / 2,
          east: cell.center.lng + cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
          west: cell.center.lng - cell.cellSize / (111320 * Math.cos(cell.center.lat * Math.PI / 180)) / 2,
        },
        fillColor: color,
        fillOpacity: layerOpacity,
        strokeWeight: 0,
        map: map,
      });
      newOverlays.push(rectangle);
    });

    overlaysRef.current[key] = newOverlays;
  }, [map, accessCells, activeLayer, layerOpacity]);

  const toggleLayer = (id: string) => {
    setActiveLayer(current => current === id ? null : id);
  };

  const updateOpacity = (opacity: number) => {
    setLayerOpacity(opacity);
  };

  if (!location) {
    return (
      <div className="w-full p-16 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-teal-100 via-teal-200 to-emerald-100 rounded-3xl mb-6 shadow-lg shadow-teal-500/20 animate-pulse">
          <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-3">No Location Selected</h3>
        <p className="text-slate-600 max-w-md mx-auto text-base leading-relaxed">
          Select a site from the <span className="font-semibold text-teal-600">"Analyse Site"</span> tab to view layered map analysis
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <p className="text-sm text-teal-700">Loading layer data...</p>
        </div>
      )}

      {/* Layer Toggle Pills - Matching other map components */}
      <div className="flex flex-wrap gap-2 mb-4">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              activeLayer === layer.id
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Opacity Control for Active Layer */}
      {activeLayer && (
        <div className="mb-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">
              {layers.find(l => l.id === activeLayer)?.label} Opacity
            </span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={layerOpacity}
                onChange={(e) => updateOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{
                  background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${layerOpacity * 100}%, #e2e8f0 ${layerOpacity * 100}%, #e2e8f0 100%)`
                }}
              />
              <span className="text-xs text-slate-500 font-medium w-9 text-right">
                {Math.round(layerOpacity * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapRef} data-map-capture="true" className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden relative shadow-lg" />

      <p className="mt-3 text-xs text-slate-500 italic">
        Interactive layered map analysis with building types, heights, footprints, age, land use, population, street hierarchy, and accessibility.
      </p>
    </div>
  );
};

export default LayeredMapView;
