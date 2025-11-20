// 2D Environmental Analysis Map Component
// Real-time solar radiation, wind flow, and shadow analysis overlays on Google Maps

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LocationData } from '../types';
import { fetchOSMBuildingsAround } from '@/services/osmBuildings';
import { calculateSunPosition, calculateDailySunPath, SunPosition } from '@/services/solarAnalysis3D';
import { renderMapBackground, clearMapBackground, MapBackgroundOverlays } from '@/utils/mapBackground';

declare const google: any;

type AnalysisMode = 'solar' | 'wind' | 'shadow' | 'combined';

interface EnvironmentalAnalysisMapProps {
  location: LocationData;
}

// Light theme map style
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#a8dadc' }] },
];

// Solar radiation color scale (kWh/m²/day)
function getSolarRadiationColor(value: number): string {
  // value: 0-8 kWh/m²/day typical range
  const normalized = Math.min(value / 8, 1);
  
  if (normalized < 0.25) {
    // Blue (low)
    const t = normalized * 4;
    return `rgba(59, 130, 246, ${0.3 + t * 0.4})`;
  } else if (normalized < 0.5) {
    // Blue to Cyan
    const t = (normalized - 0.25) * 4;
    return `rgba(${59 + t * (34 - 59)}, ${130 + t * (211 - 130)}, ${246 + t * (238 - 246)}, 0.6)`;
  } else if (normalized < 0.75) {
    // Cyan to Yellow
    const t = (normalized - 0.5) * 4;
    return `rgba(${34 + t * (250 - 34)}, ${211 + t * (204 - 211)}, ${238 + t * (21 - 238)}, 0.7)`;
  } else {
    // Yellow to Red (high)
    const t = (normalized - 0.75) * 4;
    return `rgba(${250 + t * (239 - 250)}, ${204 - t * 136}, 21, 0.7)`;
  }
}

// Wind speed color (m/s)
function getWindSpeedColor(speed: number): string {
  if (speed < 5) return 'rgba(34, 197, 94, 0.6)';      // Green - comfortable
  if (speed < 10) return 'rgba(250, 204, 21, 0.6)';    // Yellow - acceptable
  if (speed < 15) return 'rgba(251, 146, 60, 0.6)';    // Orange - uncomfortable
  return 'rgba(239, 68, 68, 0.7)';                      // Red - dangerous
}

// Shadow hours color
function getShadowColor(hours: number): string {
  // hours: 0-12 range
  const normalized = Math.min(hours / 12, 1);
  
  if (normalized < 0.33) {
    // White to Light Blue
    const t = normalized * 3;
    return `rgba(${255 - t * 96}, ${255 - t * 96}, 255, ${0.3 + t * 0.2})`;
  } else if (normalized < 0.66) {
    // Light Blue to Purple
    const t = (normalized - 0.33) * 3;
    return `rgba(${159 + t * (168 - 159)}, ${159 - t * 74}, 255, ${0.5 + t * 0.2})`;
  } else {
    // Purple to Dark
    const t = (normalized - 0.66) * 3;
    return `rgba(${168 - t * 88}, ${85 - t * 60}, ${255 - t * 155}, 0.7)`;
  }
}

export const EnvironmentalAnalysisMap: React.FC<EnvironmentalAnalysisMapProps> = ({ location }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('solar');
  const [isLoading, setIsLoading] = useState(false);
  
  // Time and date controls
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeOfDay, setTimeOfDay] = useState(12); // 12:00 noon
  const [showSunPath, setShowSunPath] = useState(true);
  
  // Wind controls
  const [windSpeed, setWindSpeed] = useState(5); // m/s
  const [windDirection, setWindDirection] = useState(180); // degrees (South)
  
  // Overlays
  const overlaysRef = useRef<any[]>([]);
  const backgroundRef = useRef<MapBackgroundOverlays | null>(null);
  const sunPathOverlayRef = useRef<any | null>(null);
  const sunMarkerRef = useRef<any | null>(null);
  
  // Buildings data for analysis
  const [buildings, setBuildings] = useState<any[]>([]);

  const center = useMemo(
    () => ({ lat: location.latitude, lng: location.longitude }),
    [location.latitude, location.longitude]
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || map) return;
    
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 17,
      disableDefaultUI: true,
      styles: lightMapStyle,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    setMap(mapInstance);
  }, [center]);

  // Load buildings from OSM
  useEffect(() => {
    if (!map) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Clear old cache if quota is exceeded
        try {
          localStorage.clear();
        } catch (e) {
          console.warn('Could not clear cache:', e);
        }
        
        // Load buildings and background
        const bg = await renderMapBackground(map, center, location.boundary, 500);
        backgroundRef.current = bg;
        
        const data = await fetchOSMBuildingsAround(center, 500);
        if (data && data.buildings) {
          setBuildings(data.buildings);
          console.log(`Loaded ${data.buildings.length} buildings for environmental analysis`);
        } else {
          console.warn('No building data received');
          setBuildings([]);
        }
      } catch (error) {
        console.error('Failed to load environmental data:', error);
        setBuildings([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      if (backgroundRef.current) {
        clearMapBackground(backgroundRef.current);
      }
    };
  }, [map, location, center]);

  // Update analysis overlays when parameters change
  useEffect(() => {
    if (!map) return;
    
    // Clear previous overlays
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    
    if (sunPathOverlayRef.current) {
      sunPathOverlayRef.current.setMap(null);
      sunPathOverlayRef.current = null;
    }
    if (sunMarkerRef.current) {
      sunMarkerRef.current.setMap(null);
      sunMarkerRef.current = null;
    }
    
    // Only render analysis if we have buildings data
    if (!buildings.length) return;
    
    const analysisDate = new Date(selectedDate);
    analysisDate.setHours(timeOfDay, 0, 0, 0);
    
    // Run analysis based on mode
    if (mode === 'solar' || mode === 'combined') {
      renderSolarAnalysis(analysisDate);
    }
    
    if (mode === 'wind' || mode === 'combined') {
      renderWindAnalysis();
    }
    
    if (mode === 'shadow' || mode === 'combined') {
      renderShadowAnalysis(analysisDate);
    }
    
  }, [map, buildings, mode, selectedDate, timeOfDay, showSunPath, windSpeed, windDirection]);

  // Solar radiation analysis
  const renderSolarAnalysis = (date: Date) => {
    const gridSize = 60; // meters - increased for performance
    const radius = 250; // meters from center - reduced for performance
    
    // Calculate sun position
    const sunPos = calculateSunPosition(location.latitude, location.longitude, date);
    
    // Only show if sun is above horizon
    if (sunPos.altitude <= 0) {
      console.log('Sun is below horizon at this time');
      return;
    }
    
    console.log(`Rendering solar analysis: ${Math.floor((radius * 2 / gridSize) ** 2)} grid points`);
    
    // Create solar radiation grid
    for (let x = -radius; x <= radius; x += gridSize) {
      for (let y = -radius; y <= radius; y += gridSize) {
        const latOffset = y / 111000; // meters to degrees
        const lngOffset = x / (111000 * Math.cos(location.latitude * Math.PI / 180));
        
        const gridLat = location.latitude + latOffset;
        const gridLng = location.longitude + lngOffset;
        
        // Calculate solar radiation for this point (simplified)
        const radiation = calculateSolarRadiationForPoint(
          gridLat,
          gridLng,
          sunPos,
          buildings,
          date
        );
        
        // Create colored rectangle
        const bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(gridLat, gridLng),
          new google.maps.LatLng(gridLat + latOffset, gridLng + lngOffset)
        );
        
        const rectangle = new google.maps.Rectangle({
          bounds,
          fillColor: getSolarRadiationColor(radiation),
          fillOpacity: 0.6,
          strokeWeight: 0,
          map,
          clickable: false,
          zIndex: 10,
        });
        
        overlaysRef.current.push(rectangle);
      }
    }
    
    // Show sun path if enabled
    if (showSunPath) {
      const sunPath = calculateDailySunPath(location.latitude, location.longitude, date, 30);
      
      if (sunPath.length > 1) {
        // Convert sun positions to map coordinates (simplified visualization)
        const pathCoords = sunPath
          .filter(p => p.altitude > 0)
          .map(p => {
            // Project sun position onto map (simplified: show azimuth as direction, altitude as distance)
            const distance = (Math.PI / 2 - p.altitude) * 0.0005; // Scale for visibility
            const lat = location.latitude + distance * Math.cos(p.azimuth);
            const lng = location.longitude + distance * Math.sin(p.azimuth);
            return new google.maps.LatLng(lat, lng);
          });
        
        const sunPathLine = new google.maps.Polyline({
          path: pathCoords,
          strokeColor: '#FFA500',
          strokeOpacity: 0.8,
          strokeWeight: 3,
          map,
          clickable: false,
          zIndex: 20,
        });
        
        sunPathOverlayRef.current = sunPathLine;
      }
    }
    
    // Show current sun position
    const sunDistance = (Math.PI / 2 - sunPos.altitude) * 0.0005;
    const sunLat = location.latitude + sunDistance * Math.cos(sunPos.azimuth);
    const sunLng = location.longitude + sunDistance * Math.sin(sunPos.azimuth);
    
    const sunMarker = new google.maps.Marker({
      position: { lat: sunLat, lng: sunLng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#FFD700',
        fillOpacity: 1,
        strokeColor: '#FFA500',
        strokeWeight: 2,
      },
      title: `Sun Position - ${timeOfDay}:00`,
      zIndex: 30,
    });
    
    sunMarkerRef.current = sunMarker;
  };

  // Wind flow analysis
  const renderWindAnalysis = () => {
    const gridSize = 50; // meters - increased for performance
    const radius = 250; // reduced for performance
    
    const windRadians = (windDirection - 90) * Math.PI / 180;
    
    console.log(`Rendering wind analysis: ${Math.floor((radius * 2 / gridSize) ** 2)} grid points`);
    
    for (let x = -radius; x <= radius; x += gridSize) {
      for (let y = -radius; y <= radius; y += gridSize) {
        const latOffset = y / 111000;
        const lngOffset = x / (111000 * Math.cos(location.latitude * Math.PI / 180));
        
        const gridLat = location.latitude + latOffset;
        const gridLng = location.longitude + lngOffset;
        
        // Calculate wind speed at this point (simplified building effects)
        const localWindSpeed = calculateWindSpeedAtPoint(
          gridLat,
          gridLng,
          windSpeed,
          windDirection,
          buildings
        );
        
        // Create wind comfort zone
        const bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(gridLat, gridLng),
          new google.maps.LatLng(gridLat + latOffset, gridLng + lngOffset)
        );
        
        const rectangle = new google.maps.Rectangle({
          bounds,
          fillColor: getWindSpeedColor(localWindSpeed),
          fillOpacity: 0.6,
          strokeColor: getWindSpeedColor(localWindSpeed),
          strokeOpacity: 0.3,
          strokeWeight: 1,
          map,
          clickable: false,
          zIndex: 10,
        });
        
        overlaysRef.current.push(rectangle);
        
        // Add wind arrow every 2nd grid point for better visibility
        if (x % (gridSize * 2) === 0 && y % (gridSize * 2) === 0) {
          const arrowLength = 0.0003 * Math.max(localWindSpeed, 3); // Larger arrows, minimum size
          const endLat = gridLat + arrowLength * Math.sin(windRadians);
          const endLng = gridLng + arrowLength * Math.cos(windRadians);
          
          const arrow = new google.maps.Polyline({
            path: [
              { lat: gridLat, lng: gridLng },
              { lat: endLat, lng: endLng },
            ],
            strokeColor: '#1a1a1a',
            strokeOpacity: 0.9,
            strokeWeight: 3,
            icons: [{
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                strokeColor: '#1a1a1a',
                fillColor: '#1a1a1a',
                fillOpacity: 1,
              },
              offset: '100%',
            }],
            map,
            clickable: false,
            zIndex: 15,
          });
          
          overlaysRef.current.push(arrow);
        }
      }
    }
  };

  // Shadow analysis
  const renderShadowAnalysis = (date: Date) => {
    const gridSize = 40; // increased for performance
    const radius = 250; // reduced for performance
    
    console.log(`Rendering shadow analysis for ${date.toLocaleDateString()}`);
    
    // Calculate cumulative shadow hours for the day
    const shadowHoursMap = calculateDailyShadowHours(
      location.latitude,
      location.longitude,
      date,
      buildings,
      radius
    );
    
    console.log(`Shadow map has ${shadowHoursMap.size} points`);
    
    shadowHoursMap.forEach((hours, key) => {
      const [x, y] = key.split(',').map(Number);
      
      const latOffset = y / 111000;
      const lngOffset = x / (111000 * Math.cos(location.latitude * Math.PI / 180));
      
      const gridLat = location.latitude + latOffset;
      const gridLng = location.longitude + lngOffset;
      
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(gridLat, gridLng),
        new google.maps.LatLng(gridLat + latOffset, gridLng + lngOffset)
      );
      
      const rectangle = new google.maps.Rectangle({
        bounds,
        fillColor: getShadowColor(hours),
        fillOpacity: 0.6,
        strokeWeight: 0,
        map,
        clickable: false,
        zIndex: 10,
      });
      
      overlaysRef.current.push(rectangle);
    });
  };

  // Helper: Calculate solar radiation at a point
  const calculateSolarRadiationForPoint = (
    lat: number,
    lng: number,
    sunPos: SunPosition,
    buildings: any[],
    date: Date
  ): number => {
    // Check if point is in shadow
    const inShadow = isPointInShadow(lat, lng, sunPos, buildings);
    
    if (inShadow) return 0;
    
    // Calculate radiation based on sun altitude
    const solarConstant = 1.367; // kW/m²
    const atmosphericFactor = 0.75; // Clear sky
    const hourlyRadiation = solarConstant * atmosphericFactor * Math.sin(sunPos.altitude);
    
    return Math.max(0, hourlyRadiation * 8); // Approximate daily value
  };

  // Helper: Check if point is shadowed
  const isPointInShadow = (
    lat: number,
    lng: number,
    sunPos: SunPosition,
    buildings: any[]
  ): boolean => {
    // Simplified shadow check
    // In production, use proper ray-casting
    
    for (const building of buildings) {
      const height = parseFloat(building.tags.height || building.tags['building:levels'] * 3 || '15');
      
      if (height < 5) continue; // Skip low buildings
      
      // Check if point is roughly downwind of building
      const buildingCenter = getPolygonCenter(building.nodes);
      const dx = lng - buildingCenter.lng;
      const dy = lat - buildingCenter.lat;
      
      const angleToPoint = Math.atan2(dy, dx);
      const angleDiff = Math.abs(angleToPoint - sunPos.azimuth);
      
      const distance = Math.sqrt(dx * dx + dy * dy) * 111000; // rough meters
      const shadowLength = height / Math.tan(sunPos.altitude);
      
      if (angleDiff < 0.3 && distance < shadowLength && distance > 5) {
        return true;
      }
    }
    
    return false;
  };

  // Helper: Calculate wind speed at point
  const calculateWindSpeedAtPoint = (
    lat: number,
    lng: number,
    baseSpeed: number,
    direction: number,
    buildings: any[]
  ): number => {
    let speed = baseSpeed;
    
    // Check building effects
    for (const building of buildings) {
      const center = getPolygonCenter(building.nodes);
      const dx = lng - center.lng;
      const dy = lat - center.lat;
      const distance = Math.sqrt(dx * dx + dy * dy) * 111000;
      
      if (distance < 50) {
        // Close to building - reduce speed (wake effect)
        speed *= 0.6;
      } else if (distance < 100) {
        // Moderate distance - slight reduction
        speed *= 0.8;
      }
    }
    
    return speed;
  };

  // Helper: Calculate daily shadow hours
  const calculateDailyShadowHours = (
    centerLat: number,
    centerLng: number,
    date: Date,
    buildings: any[],
    radius: number
  ): Map<string, number> => {
    const shadowMap = new Map<string, number>();
    const gridSize = 40; // increased for performance
    
    // Check shadow at fewer hours for performance
    for (let hour = 7; hour <= 19; hour += 2) { // Every 2 hours instead of 1
      const testDate = new Date(date);
      testDate.setHours(hour, 0, 0, 0);
      
      const sunPos = calculateSunPosition(centerLat, centerLng, testDate);
      
      if (sunPos.altitude <= 0) continue;
      
      // Check each grid point
      for (let x = -radius; x <= radius; x += gridSize) {
        for (let y = -radius; y <= radius; y += gridSize) {
          const latOffset = y / 111000;
          const lngOffset = x / (111000 * Math.cos(centerLat * Math.PI / 180));
          
          const gridLat = centerLat + latOffset;
          const gridLng = centerLng + lngOffset;
          
          if (isPointInShadow(gridLat, gridLng, sunPos, buildings)) {
            const key = `${x},${y}`;
            shadowMap.set(key, (shadowMap.get(key) || 0) + 1);
          }
        }
      }
    }
    
    return shadowMap;
  };

  // Helper: Get polygon center
  const getPolygonCenter = (nodes: { lat: number; lng: number }[]) => {
    const sum = nodes.reduce(
      (acc, node) => ({ lat: acc.lat + node.lat, lng: acc.lng + node.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / nodes.length, lng: sum.lng / nodes.length };
  };

  // Quick date presets
  const setWinterSolstice = () => {
    const winter = new Date(selectedDate.getFullYear(), 11, 21);
    setSelectedDate(winter);
  };

  const setSummerSolstice = () => {
    const summer = new Date(selectedDate.getFullYear(), 5, 21);
    setSelectedDate(summer);
  };

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border-2 border-slate-200">
      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-3"></div>
            <p className="text-slate-600 font-medium">Loading environmental data...</p>
            <p className="text-xs text-slate-500 mt-2">Fetching buildings and roads from OpenStreetMap</p>
          </div>
        </div>
      )}
      
      {/* Data Status */}
      {!isLoading && buildings.length === 0 && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="text-center max-w-md p-6">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Data Available</h3>
            <p className="text-sm text-slate-600 mb-4">
              Could not load building data from OpenStreetMap. This may be due to:
            </p>
            <ul className="text-xs text-slate-600 text-left list-disc list-inside space-y-1 mb-4">
              <li>Slow or unavailable Overpass API server</li>
              <li>Network connectivity issues</li>
              <li>No buildings in this area</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Controls Panel */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 max-w-sm z-10">
        <h3 className="text-base font-bold text-slate-800 mb-3">Environmental Analysis</h3>
        
        {/* Analysis Mode */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-2">Analysis Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(['solar', 'wind', 'shadow', 'combined'] as AnalysisMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  mode === m
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Date & Time Controls */}
        {(mode === 'solar' || mode === 'shadow' || mode === 'combined') && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={setWinterSolstice}
                  className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Winter
                </button>
                <button
                  onClick={setSummerSolstice}
                  className="flex-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                >
                  Summer
                </button>
              </div>
            </div>
            
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Time: {timeOfDay}:00
              </label>
              <input
                type="range"
                min="6"
                max="20"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </>
        )}
        
        {/* Solar-specific controls */}
        {(mode === 'solar' || mode === 'combined') && (
          <div className="mb-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showSunPath}
                onChange={(e) => setShowSunPath(e.target.checked)}
                className="rounded text-teal-600"
              />
              Show Sun Path
            </label>
          </div>
        )}
        
        {/* Wind controls */}
        {(mode === 'wind' || mode === 'combined') && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Wind Speed: {windSpeed} m/s
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={windSpeed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Wind Direction: {windDirection}°
              </label>
              <input
                type="range"
                min="0"
                max="359"
                value={windDirection}
                onChange={(e) => setWindDirection(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>N</span>
                <span>E</span>
                <span>S</span>
                <span>W</span>
              </div>
            </div>
          </>
        )}
        
        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <h4 className="text-xs font-semibold text-slate-600 mb-2">Legend</h4>
          {mode === 'solar' && (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-3 bg-gradient-to-r from-blue-400 via-cyan-400 via-yellow-400 to-red-500 rounded"></div>
                <span className="text-slate-600">Solar Radiation (Low → High)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full border-2 border-orange-500"></div>
                <span className="text-slate-600">Current Sun Position</span>
              </div>
            </div>
          )}
          {mode === 'wind' && (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Comfortable (&lt;5 m/s)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                <span>Acceptable (5-10 m/s)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-400 rounded"></div>
                <span>Uncomfortable (10-15 m/s)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Dangerous (&gt;15 m/s)</span>
              </div>
            </div>
          )}
          {mode === 'shadow' && (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-3 bg-gradient-to-r from-white via-blue-300 via-purple-500 to-gray-800 rounded border"></div>
                <span className="text-slate-600">Shadow Hours (0 → 12+)</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Info panel - bottom left */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 z-10">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-slate-800">Real-Time Analysis</div>
          <div className="text-slate-600">
            {mode === 'solar' && `Date: ${selectedDate.toLocaleDateString()}, ${timeOfDay}:00`}
            {mode === 'wind' && `Wind: ${windSpeed} m/s from ${windDirection}°`}
            {mode === 'shadow' && `Shadow coverage for ${selectedDate.toLocaleDateString()}`}
            {mode === 'combined' && 'Combined environmental factors'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentalAnalysisMap;
