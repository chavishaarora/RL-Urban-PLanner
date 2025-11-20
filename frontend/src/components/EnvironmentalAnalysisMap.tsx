// Pedestrian-Level Environmental Analysis Map
// Analyzes streets, parks, plazas, and walkways where people actually experience environmental conditions
// Stack: Google Maps + SunCalc + Turf.js + Open-Meteo + D3 + Simplex Noise

import React, { useEffect, useRef, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateRdYlBu, interpolateYlOrRd, interpolateViridis, interpolatePlasma } from 'd3-scale-chromatic';
import { LocationData } from '../types';
import { fetchOSMBuildingsAround } from '@/services/osmBuildings';
import { fetchPedestrianSpaces, PedestrianSpace } from '@/services/pedestrianSpaces';
import { renderMapBackground, clearMapBackground, MapBackgroundOverlays } from '@/utils/mapBackground';
import { 
  getSunPosition, 
  getDailySunPath, 
  calculateSolarRadiation,
  calculateDailySolarExposure
} from '@/services/solarRadiationService';
import { 
  calculateWindAtPoint, 
  getWindComfortCategory,
  generateWindFlowVectors
} from '@/services/windFlowService';
import { 
  fetchWeatherData, 
  calculateComfortIndex
} from '@/services/weatherService';

declare const google: any;

type AnalysisMode = 'solar' | 'wind' | 'shadow' | 'comfort';

interface Props {
  location: LocationData;
}

const EnvironmentalAnalysisMap: React.FC<Props> = ({ location }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const backgroundRef = useRef<MapBackgroundOverlays | null>(null);
  const sunPathRef = useRef<any>(null);
  const sunMarkerRef = useRef<any>(null);

  const [pedestrianSpaces, setPedestrianSpaces] = useState<PedestrianSpace[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]); // For shadow casting
  const [mode, setMode] = useState<AnalysisMode>('solar');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timeOfDay, setTimeOfDay] = useState<number>(12);
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [showSunPath, setShowSunPath] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis parameters (from real weather API)
  const [windSpeed, setWindSpeed] = useState(3);
  const [windDirection, setWindDirection] = useState(0);

  const center = {
    lat: location.latitude,
    lng: location.longitude
  };

  // Helper to convert wind direction to compass names
  const getWindDirectionName = (degrees: number): string => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return `${dirs[index]} (${degrees.toFixed(0)}°)`;
  };

  // Map styles
  const mapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#f8f8f8' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e5f0' }] },
  ];

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 16,
      styles: mapStyles,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;
  }, []);

  // Load pedestrian spaces and buildings (for shadow casting)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const map = mapInstanceRef.current;
        
        // Clear old OSM cache to prevent quota errors
        try {
          const keys = Object.keys(sessionStorage);
          keys.forEach(key => {
            if (key.startsWith('osm-cache-')) {
              sessionStorage.removeItem(key);
            }
          });
          console.log('✅ Cleared old OSM cache');
        } catch (e) {
          console.warn('Could not clear cache:', e);
        }
        
        // Load background (roads and basic context)
        const bg = await renderMapBackground(map, center, location.boundary, 500);
        backgroundRef.current = bg;
        
        // Add longer delay to avoid Overpass API rate limiting (5 seconds, increased from 3)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Load pedestrian spaces (roads, parks, plazas, walkways)
        const spaces = await fetchPedestrianSpaces(center.lat, center.lng, 500);
        setPedestrianSpaces(spaces);
        console.log(`✅ Loaded ${spaces.length} pedestrian spaces for analysis`);
        
        // Add delay before next API call (5 seconds, increased from 3)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Load buildings (for shadow casting only)
        const data = await fetchOSMBuildingsAround(center, 500);
        if (data && data.buildings && data.buildings.length > 0) {
          setBuildings(data.buildings);
          console.log(`✅ Loaded ${data.buildings.length} buildings for shadow casting`);
        } else {
          console.warn('⚠️ No building data received, analysis will show without shadows');
          setBuildings([]);
        }

        // Fetch real weather data
        const analysisDate = new Date(selectedDate);
        analysisDate.setHours(timeOfDay);
        const weather = await fetchWeatherData(center.lat, center.lng, analysisDate);
        setWeatherData(weather);
        setWindSpeed(weather.windSpeed);
        setWindDirection(weather.windDirection);
        console.log('✅ Weather data:', weather);

      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load environmental data. Retrying...');
        setPedestrianSpaces([]);
        setBuildings([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      // Clean up overlays
      if (backgroundRef.current) {
        clearMapBackground(backgroundRef.current);
      }
      
      // Clear large data to free memory
      setPedestrianSpaces([]);
      setBuildings([]);
      overlaysRef.current.forEach(o => o.setMap?.(null));
      overlaysRef.current = [];
    };
  }, [mapInstanceRef.current, location]);

  // Update weather when date/time changes
  useEffect(() => {
    if (!pedestrianSpaces.length) return;
    
    const updateWeather = async () => {
      const analysisDate = new Date(selectedDate);
      analysisDate.setHours(timeOfDay, 0, 0, 0);
      const weather = await fetchWeatherData(center.lat, center.lng, analysisDate);
      setWeatherData(weather);
      setWindSpeed(weather.windSpeed);
      setWindDirection(weather.windDirection);
      console.log('🌤️ Updated weather:', weather);
    };
    
    updateWeather();
  }, [selectedDate, timeOfDay, center.lat, center.lng]);

  // Update analysis when parameters change
  useEffect(() => {
    if (!mapInstanceRef.current || !pedestrianSpaces.length || !weatherData) return;

    // Clear previous overlays
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    if (sunPathRef.current) {
      sunPathRef.current.setMap(null);
      sunPathRef.current = null;
    }
    if (sunMarkerRef.current) {
      sunMarkerRef.current.setMap(null);
      sunMarkerRef.current = null;
    }

    const analysisDate = new Date(selectedDate);
    analysisDate.setHours(timeOfDay, 0, 0, 0);

    // Run analysis based on mode
    console.log(`Running ${mode} analysis...`);
    if (mode === 'solar') {
      renderSolarAnalysis(analysisDate);
    } else if (mode === 'wind') {
      renderWindAnalysis();
    } else if (mode === 'shadow') {
      renderShadowAnalysis(analysisDate);
    } else if (mode === 'comfort') {
      renderComfortAnalysis(analysisDate);
    }

  }, [mode, pedestrianSpaces, buildings, weatherData, showSunPath]);

  // SOLAR RADIATION ANALYSIS - On pedestrian spaces (streets, parks, plazas)
  const renderSolarAnalysis = (date: Date) => {
    const map = mapInstanceRef.current;
    
    console.log(`🌞 Rendering solar radiation on pedestrian spaces at ${date.toLocaleTimeString()}...`);

    // Get sun position
    const sunPos = getSunPosition(center.lat, center.lng, date);
    console.log(`Sun: Azimuth ${sunPos.azimuth.toFixed(1)}°, Altitude ${sunPos.altitude.toFixed(1)}°`);

    if (sunPos.altitude <= 0) {
      console.log('⚠️ Sun below horizon');
      return;
    }

    // Color scale: Yellow (low radiation) → Red (high radiation)
    const colorScale = scaleSequential(interpolateYlOrRd).domain([0, 800]);

    // Prepare buildings for shadow casting
    const buildingsForShadow = (buildings || []).map(b => ({
      coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
      height: parseInt(b.tags?.['building:levels'] || b.tags?.height || '3') * 3 || 10
    })).filter(b => b.coordinates && b.coordinates.length > 0);

    let maxRadiation = 0;
    let minRadiation = Infinity;

    // Analyze each pedestrian space (limit to 150 for performance)
    const spacesToAnalyze = pedestrianSpaces.slice(0, 150);
    console.log(`Analyzing ${spacesToAnalyze.length} pedestrian spaces...`);
    
    spacesToAnalyze.forEach((space: PedestrianSpace, index: number) => {
      if (!space.geometry || space.geometry.length === 0) return;

      // Calculate center point of the space
      const lats = space.geometry.map(p => p.lat);
      const lngs = space.geometry.map(p => p.lng);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      // Calculate solar radiation at this pedestrian location
      const solarData = calculateSolarRadiation(
        center.lat,
        center.lng,
        date,
        buildingsForShadow,
        centerLat,
        centerLng,
        weatherData?.directRadiation || 600,
        weatherData?.diffuseRadiation || 150
      );

      maxRadiation = Math.max(maxRadiation, solarData.totalRadiation);
      minRadiation = Math.min(minRadiation, solarData.totalRadiation);

      // Color the pedestrian space based on radiation
      const spacePath = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
      
      // For roads/paths, create a buffer polygon if it's a line
      let paths = spacePath;
      if (space.type === 'road' || space.type === 'walkway') {
        // Simple buffering for visualization (roads appear as lines otherwise)
        paths = spacePath;
      }
      
      const polygon = new google.maps.Polygon({
        paths,
        fillColor: colorScale(solarData.totalRadiation * 1000),
        fillOpacity: 0.75,
        strokeColor: '#333333',
        strokeOpacity: 0.8,
        strokeWeight: space.type === 'park' || space.type === 'plaza' ? 2 : 1,
        map,
        zIndex: 500,
      });
      
      if (index === 0) console.log('Created solar polygon with color:', colorScale(solarData.totalRadiation * 1000));

      overlaysRef.current.push(polygon);

      // For linear features (roads/walkways), also draw a polyline for better visibility
      if (space.type === 'road' || space.type === 'walkway') {
        const line = new google.maps.Polyline({
          path: spacePath,
          strokeColor: colorScale(solarData.totalRadiation * 1000),
          strokeOpacity: 0.9,
          strokeWeight: (space.width || 5) * 1.5,
          map,
          zIndex: 501,
        });
        overlaysRef.current.push(line);
      }
    });

    console.log(`✅ Analyzed ${spacesToAnalyze.length} spaces, radiation range: ${minRadiation.toFixed(2)} - ${maxRadiation.toFixed(2)} kWh/m²`);

    // Draw sun path
    if (showSunPath) {
      const sunPath = getDailySunPath(center.lat, center.lng, date);
      const pathCoords = sunPath.map(p => ({ lat: p.position.lat, lng: p.position.lng }));

      if (pathCoords.length > 0) {
        const sunPathLine = new google.maps.Polyline({
          path: pathCoords,
          strokeColor: '#FF6B00',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
          zIndex: 25,
        });
        sunPathRef.current = sunPathLine;

        // Current sun position marker
        const currentSun = sunPath.find(p => p.time.getHours() === date.getHours());
        if (currentSun) {
          const sunMarker = new google.maps.Marker({
            position: currentSun.position,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#FFD700',
              fillOpacity: 1,
              strokeColor: '#FF8C00',
              strokeWeight: 3,
            },
            title: `Sun at ${timeOfDay}:00`,
            zIndex: 30,
          });
          sunMarkerRef.current = sunMarker;
        }
      }
    }
  };

  // WIND FLOW ANALYSIS - On pedestrian spaces
  const renderWindAnalysis = () => {
    const map = mapInstanceRef.current;

    console.log(`💨 Rendering wind flow on pedestrian spaces: ${windSpeed} m/s from ${windDirection}°...`);

    const buildingsForWind = (buildings || []).map(b => ({
      coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
      height: parseInt(b.tags?.['building:levels'] || b.tags?.height || '3') * 3 || 10
    })).filter(b => b.coordinates && b.coordinates.length > 0);

    // Analyze each pedestrian space (limit to 150 for performance)
    const spacesToAnalyze = pedestrianSpaces.slice(0, 150);
    spacesToAnalyze.forEach((space: PedestrianSpace) => {
      if (!space.geometry || space.geometry.length === 0) return;

      // Calculate center point
      const lats = space.geometry.map(p => p.lat);
      const lngs = space.geometry.map(p => p.lng);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      // Calculate wind at this pedestrian location
      const windData = calculateWindAtPoint(
        centerLat,
        centerLng,
        windSpeed,
        windDirection,
        buildingsForWind,
        center.lat,
        center.lng
      );

      const comfort = getWindComfortCategory(windData.speed, windData.gustiness);

      // Color the pedestrian space
      const spacePath = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
      
      const polygon = new google.maps.Polygon({
        paths: spacePath,
        fillColor: comfort.color,
        fillOpacity: 0.7,
        strokeColor: '#2a2a2a',
        strokeOpacity: 0.6,
        strokeWeight: 1,
        map,
        zIndex: 500,
      });

      overlaysRef.current.push(polygon);

      // For linear features, add colored polyline
      if (space.type === 'road' || space.type === 'walkway') {
        const line = new google.maps.Polyline({
          path: spacePath,
          strokeColor: comfort.color,
          strokeOpacity: 0.85,
          strokeWeight: (space.width || 5) * 1.5,
          map,
          zIndex: 501,
        });
        overlaysRef.current.push(line);
      }

      // Add wind arrow at center point
      const windDirRad = (windDirection - 90) * Math.PI / 180;
      const arrowLength = 0.0003 * Math.max(windData.speed, 2);
      const endLat = centerLat + arrowLength * Math.sin(windDirRad);
      const endLng = centerLng + arrowLength * Math.cos(windDirRad);

      const arrow = new google.maps.Polyline({
        path: [
          { lat: centerLat, lng: centerLng },
          { lat: endLat, lng: endLng }
        ],
        strokeColor: '#ffffff',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: '#333',
            strokeWeight: 0.5,
          },
          offset: '100%'
        }],
        map,
        zIndex: 600,
      });

      overlaysRef.current.push(arrow);
    });

    console.log(`✅ Analyzed ${spacesToAnalyze.length} pedestrian spaces for wind effects`);
  };

  // SHADOW ANALYSIS - On pedestrian spaces
  const renderShadowAnalysis = (date: Date) => {
    const map = mapInstanceRef.current;

    console.log(`🌑 Rendering shadow analysis on pedestrian spaces for ${date.toLocaleDateString()}...`);

    const buildingsForShadow = (buildings || []).map(b => ({
      coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
      height: parseInt(b.tags?.['building:levels'] || b.tags?.height || '3') * 3 || 10
    })).filter(b => b.coordinates && b.coordinates.length > 0);

    const colorScale = scaleSequential(interpolatePlasma).domain([12, 0]); // 12h shadow to 0h (full sun)

    let maxShadowHours = 0;
    let minShadowHours = Infinity;

    // Analyze each pedestrian space (limit to 150 for performance)
    const spacesToAnalyze = pedestrianSpaces.slice(0, 150);
    spacesToAnalyze.forEach((space: PedestrianSpace) => {
      if (!space.geometry || space.geometry.length === 0) return;

      // Calculate center point
      const lats = space.geometry.map(p => p.lat);
      const lngs = space.geometry.map(p => p.lng);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      // Calculate daily shadow hours at this location
      const shadowData = calculateDailySolarExposure(
        center.lat,
        center.lng,
        date,
        buildingsForShadow,
        centerLat,
        centerLng
      );

      maxShadowHours = Math.max(maxShadowHours, shadowData.shadowHours);
      minShadowHours = Math.min(minShadowHours, shadowData.shadowHours);

      // Color the pedestrian space
      const spacePath = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
      
      const polygon = new google.maps.Polygon({
        paths: spacePath,
        fillColor: colorScale(shadowData.shadowHours),
        fillOpacity: 0.75,
        strokeColor: '#2a2a2a',
        strokeOpacity: 0.7,
        strokeWeight: space.type === 'park' || space.type === 'plaza' ? 2 : 1,
        map,
        zIndex: 500,
      });

      overlaysRef.current.push(polygon);

      // For linear features, add colored polyline
      if (space.type === 'road' || space.type === 'walkway') {
        const line = new google.maps.Polyline({
          path: spacePath,
          strokeColor: colorScale(shadowData.shadowHours),
          strokeOpacity: 0.85,
          strokeWeight: (space.width || 5) * 1.5,
          map,
          zIndex: 501,
        });
        overlaysRef.current.push(line);
      }
    });

    console.log(`✅ Analyzed ${spacesToAnalyze.length} spaces, shadow hours: ${minShadowHours.toFixed(1)} - ${maxShadowHours.toFixed(1)}h`);
  };

  // THERMAL COMFORT ANALYSIS - On pedestrian spaces
  const renderComfortAnalysis = (date: Date) => {
    const map = mapInstanceRef.current;

    console.log(`🌡️ Rendering thermal comfort on pedestrian spaces...`);

    const buildingsForAnalysis = (buildings || []).map(b => ({
      coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
      height: parseInt(b.tags?.['building:levels'] || b.tags?.height || '3') * 3 || 10
    })).filter(b => b.coordinates && b.coordinates.length > 0);

    // Color scale: Blue (comfortable) → Red (extreme)
    const colorScale = scaleSequential(interpolateRdYlBu).domain([4, -4]);

    // Analyze each pedestrian space (limit to 150 for performance)
    const spacesToAnalyze = pedestrianSpaces.slice(0, 150);
    spacesToAnalyze.forEach((space: PedestrianSpace) => {
      if (!space.geometry || space.geometry.length === 0) return;

      // Calculate center point
      const lats = space.geometry.map(p => p.lat);
      const lngs = space.geometry.map(p => p.lng);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      // Get solar radiation
      const solarData = calculateSolarRadiation(
        center.lat,
        center.lng,
        date,
        buildingsForAnalysis,
        centerLat,
        centerLng,
        weatherData?.directRadiation || 600,
        weatherData?.diffuseRadiation || 150
      );

      // Get wind data
      const windData = calculateWindAtPoint(
        centerLat,
        centerLng,
        windSpeed,
        windDirection,
        buildingsForAnalysis,
        center.lat,
        center.lng
      );

      // Calculate comfort index
      const comfort = calculateComfortIndex(
        weatherData?.temperature || 20,
        windData.speed,
        weatherData?.relativeHumidity || 50,
        solarData.totalRadiation * 1000
      );

      // Color the pedestrian space
      const spacePath = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
      
      const polygon = new google.maps.Polygon({
        paths: spacePath,
        fillColor: colorScale(-comfort.index), // Invert so blue = comfortable
        fillOpacity: 0.75,
        strokeColor: '#2a2a2a',
        strokeOpacity: 0.7,
        strokeWeight: space.type === 'park' || space.type === 'plaza' ? 2 : 1,
        map,
        zIndex: 500,
      });

      overlaysRef.current.push(polygon);

      // For linear features, add colored polyline
      if (space.type === 'road' || space.type === 'walkway') {
        const line = new google.maps.Polyline({
          path: spacePath,
          strokeColor: colorScale(-comfort.index),
          strokeOpacity: 0.85,
          strokeWeight: (space.width || 5) * 1.5,
          map,
          zIndex: 501,
        });
        overlaysRef.current.push(line);
      }
    });

    console.log(`✅ Analyzed ${spacesToAnalyze.length} spaces for thermal comfort`);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-xl shadow-2xl p-6 max-w-sm z-20">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Environmental Analysis
          <span className="ml-2 text-sm font-normal text-gray-500">
            (Pedestrian Level - 500m radius)
          </span>
        </h2>

        {/* Analysis Mode */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Analysis Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['solar', 'wind', 'shadow', 'comfort'] as AnalysisMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  mode === m
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m === 'solar' && '☀️ Solar'}
                {m === 'wind' && '💨 Wind'}
                {m === 'shadow' && '🌑 Shadow'}
                {m === 'comfort' && '🌡️ Comfort'}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Time: {timeOfDay}:00
          </label>
          <input
            type="range"
            min="0"
            max="23"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Real-time weather info */}
        {weatherData && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-800 mb-2">Real-time Weather Data</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>🌡️ {weatherData.temperature.toFixed(1)}°C</div>
              <div>💨 Wind: {weatherData.windSpeed.toFixed(1)} m/s from {getWindDirectionName(weatherData.windDirection)}</div>
              <div>☀️ {weatherData.directRadiation.toFixed(0)} W/m²</div>
            </div>
          </div>
        )}

        {/* Sun Path Toggle */}
        {mode === 'solar' && (
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showSunPath}
                onChange={(e) => setShowSunPath(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Show sun path</span>
            </label>
          </div>
        )}



        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-2">Legend</div>
          {mode === 'solar' && (
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#ffff00'}}></span>Low radiation</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#ff6600'}}></span>Medium radiation</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#cc0000'}}></span>High radiation</div>
            </div>
          )}
          {mode === 'wind' && (
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center"><span className="w-4 h-4 mr-2 bg-green-500"></span>Comfortable</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2 bg-yellow-500"></span>Acceptable</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2 bg-orange-500"></span>Uncomfortable</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2 bg-red-500"></span>Dangerous</div>
            </div>
          )}
          {mode === 'shadow' && (
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#0d0887'}}></span>Full sun (0h shadow)</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#cc4778'}}></span>Partial shadow (6h)</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#f0f921'}}></span>Full shadow (12h)</div>
            </div>
          )}
          {mode === 'comfort' && (
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#313695'}}></span>Very comfortable</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#ffffbf'}}></span>Neutral</div>
              <div className="flex items-center"><span className="w-4 h-4 mr-2" style={{backgroundColor: '#a50026'}}></span>Uncomfortable</div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-cyan-500 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Loading environmental data...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a moment...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !isLoading && (
        <div className="absolute top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg z-20">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-yellow-600 hover:text-yellow-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvironmentalAnalysisMap;
