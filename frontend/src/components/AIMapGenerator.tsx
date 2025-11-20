import React, { useEffect, useRef, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateRdYlBu, interpolateYlOrRd, interpolatePlasma } from 'd3-scale-chromatic';
import { LocationData } from '../types/types';
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
  getWindComfortCategory
} from '@/services/windFlowService';
import { 
  fetchWeatherData, 
  calculateComfortIndex
} from '@/services/weatherService';
import { parseUserQuery, MapAction } from '@/services/aiMapService';
import { fetchCompetitors } from '@/services/marketAnalysis';
import { motion, AnimatePresence } from 'framer-motion';

declare const google: any;

interface Props {
  location: LocationData;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const SUGGESTED_QUERIES = [
  "Show me green parks",
  "Find nearby cafes",
  "Analyze solar radiation",
  "Show water bodies",
  "Wind comfort analysis",
  "Where are the schools?"
];

const AIMapGenerator: React.FC<Props> = ({ location }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const backgroundRef = useRef<MapBackgroundOverlays | null>(null);
  const sunPathRef = useRef<any>(null);
  const sunMarkerRef = useRef<any>(null);

  // Data State
  const [pedestrianSpaces, setPedestrianSpaces] = useState<PedestrianSpace[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [weatherData, setWeatherData] = useState<any>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'ai', text: 'Hello! I can generate custom maps for you. Try asking for "green parks nearby", "solar radiation map", or "wind analysis".' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeLegend, setActiveLegend] = useState<{ label: string; color: string }[] | null>(null);

  const center = {
    lat: location.latitude,
    lng: location.longitude
  };

  // Map Styles (Clean, minimal for AI overlays)
  const mapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bae6fd' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
  ];

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 16,
      styles: mapStyles,
      disableDefaultUI: true, // Clean look
      zoomControl: true,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;
    
    // Initial Data Load
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    setIsLoading(true);
    setLoadingMessage('Loading base map data...');
    try {
      const map = mapInstanceRef.current;
      
      // Background
      const bg = await renderMapBackground(map, center, location.boundary, 500);
      backgroundRef.current = bg;

      // Pedestrian Spaces (Parks, Roads, etc.)
      const spaces = await fetchPedestrianSpaces(center.lat, center.lng, 500);
      setPedestrianSpaces(spaces);

      // Buildings (for shadows/analysis)
      const bData = await fetchOSMBuildingsAround(center, 500);
      if (bData?.buildings) setBuildings(bData.buildings);

      // Weather
      const weather = await fetchWeatherData(center.lat, center.lng, new Date());
      setWeatherData(weather);

    } catch (e) {
      console.error('Error loading base data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const text = overrideText || inputValue;
    if (!text.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setLoadingMessage('Processing request...');

    try {
      // 1. Parse Intent
      const action = await parseUserQuery(userMsg.text);
      
      // 2. Execute Action
      await executeMapAction(action);

      // 3. Respond
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: action.message 
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error('AI Action Failed:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'ai', 
        text: "Sorry, I encountered an error processing that request." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeMapAction = async (action: MapAction) => {
    clearOverlays();
    setActiveLegend(null);

    if (action.type === 'clear') return;

    if (action.type === 'osm_layer' && action.layer) {
      renderOSMLayer(action.layer, action.style);
      // Set simple legend
      setActiveLegend([{ label: action.layer.charAt(0).toUpperCase() + action.layer.slice(1), color: action.style?.fillColor || '#ccc' }]);
    } else if (action.type === 'analysis' && action.analysisMode) {
      await renderAnalysis(action.analysisMode);
    } else if (action.type === 'amenity' && action.amenityType) {
      await renderAmenities(action.amenityType);
      setActiveLegend([{ label: action.amenityType, color: '#ef4444' }]);
    }
  };

  const clearOverlays = () => {
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    if (sunPathRef.current) sunPathRef.current.setMap(null);
    if (sunMarkerRef.current) sunMarkerRef.current.setMap(null);
  };

  const renderAmenities = async (type: string) => {
    const map = mapInstanceRef.current;
    const competitors = await fetchCompetitors(center, type, 800, false); // Use free mode for speed
    
    competitors.forEach(comp => {
      const marker = new google.maps.Marker({
        position: { lat: comp.lat, lng: comp.lng },
        map,
        title: comp.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#ef4444',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 100,
      });
      
      // Simple info window
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding:5px; font-weight:bold;">${comp.name}</div><div style="font-size:12px;">${comp.type}</div>`
      });
      marker.addListener('click', () => infoWindow.open(map, marker));
      
      overlaysRef.current.push(marker);
    });
  };

  const renderOSMLayer = (layerType: string, style: any) => {
    const map = mapInstanceRef.current;
    
    // Handle buildings separately as they are not in pedestrianSpaces
    if (layerType === 'buildings') {
      buildings.forEach(b => {
        const paths = (b.nodes || []).map((pt: any) => ({ lat: pt.lat, lng: pt.lng }));
        const poly = new google.maps.Polygon({
          paths,
          fillColor: style?.fillColor || '#cbd5e1',
          fillOpacity: 0.6,
          strokeColor: style?.strokeColor || '#64748b',
          strokeWeight: 1,
          map
        });
        overlaysRef.current.push(poly);
      });
      return;
    }
    
    // Filter spaces based on layer type
    const relevantSpaces = pedestrianSpaces.filter(space => {
      if (layerType === 'parks') return space.type === 'park' || space.type === 'plaza';
      if (layerType === 'roads') return space.type === 'road' || space.type === 'walkway';
      if (layerType === 'water') return space.type === 'water';
      return false;
    });

    relevantSpaces.forEach(space => {
      if (!space.geometry?.length) return;

      const paths = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
      
      // Render roads/paths as Polylines, others as Polygons
      if (space.type === 'road' || space.type === 'walkway') {
        const line = new google.maps.Polyline({
          path: paths,
          strokeColor: style?.fillColor || '#94a3b8',
          strokeOpacity: 0.9,
          strokeWeight: space.width ? Math.max(space.width, 4) : 6,
          map,
        });
        overlaysRef.current.push(line);
      } else {
        const polygon = new google.maps.Polygon({
          paths,
          fillColor: style?.fillColor || '#ccc',
          fillOpacity: 0.6,
          strokeColor: style?.strokeColor || '#666',
          strokeOpacity: 0.8,
          strokeWeight: 1,
          map,
        });
        overlaysRef.current.push(polygon);
      }
    });
  };

  const renderAnalysis = async (mode: string) => {
    const map = mapInstanceRef.current;
    const date = new Date(); // Use current date/time for now
    
    // Reuse logic from EnvironmentalAnalysisMap (simplified)
    // Note: In a real refactor, we'd extract these render functions to a shared hook/utility
    
    if (mode === 'solar') {
      const colorScale = scaleSequential(interpolateYlOrRd).domain([0, 800]);
      const buildingsForShadow = buildings.map(b => ({
        coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
        height: parseInt(b.tags?.['building:levels'] || '3') * 3
      }));

      pedestrianSpaces.slice(0, 200).forEach(space => {
        if (!space.geometry?.length) return;
        const centerLat = space.geometry[0].lat; // Simplified center
        const centerLng = space.geometry[0].lng;

        const solarData = calculateSolarRadiation(
          center.lat, center.lng, date, buildingsForShadow,
          centerLat, centerLng, 
          weatherData?.directRadiation || 600, 
          weatherData?.diffuseRadiation || 150
        );

        const paths = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
        const color = colorScale(solarData.totalRadiation * 1000);

        if (space.type === 'road' || space.type === 'walkway') {
          const line = new google.maps.Polyline({
            path: paths,
            strokeColor: color,
            strokeOpacity: 0.9,
            strokeWeight: space.width ? Math.max(space.width, 4) : 6,
            map
          });
          overlaysRef.current.push(line);
        } else {
          const poly = new google.maps.Polygon({
            paths,
            fillColor: color,
            fillOpacity: 0.7,
            strokeWeight: 0,
            map
          });
          overlaysRef.current.push(poly);
        }
      });
      
      setActiveLegend([
        { label: 'Low Radiation', color: '#ffff00' },
        { label: 'Medium', color: '#ff6600' },
        { label: 'High Radiation', color: '#cc0000' }
      ]);
    }
    
    // Add other modes (wind, comfort) similarly...
    // For brevity in this prototype, I'm implementing Solar fully.
    // Wind/Comfort would follow the same pattern calling their respective services.
    if (mode === 'wind') {
       const buildingsForWind = buildings.map(b => ({
        coordinates: (b.nodes || []).map((pt: any) => [pt.lng, pt.lat]),
        height: parseInt(b.tags?.['building:levels'] || '3') * 3
      }));
      
      pedestrianSpaces.slice(0, 200).forEach(space => {
         if (!space.geometry?.length) return;
         const centerLat = space.geometry[0].lat;
         const centerLng = space.geometry[0].lng;
         
         const wind = calculateWindAtPoint(
             centerLat, centerLng, 
             weatherData?.windSpeed || 3, 
             weatherData?.windDirection || 0,
             buildingsForWind,
             center.lat, center.lng
         );
         
         const comfort = getWindComfortCategory(wind.speed, wind.gustiness);
         const paths = space.geometry.map(p => ({ lat: p.lat, lng: p.lng }));
         
         if (space.type === 'road' || space.type === 'walkway') {
            const line = new google.maps.Polyline({
              path: paths,
              strokeColor: comfort.color,
              strokeOpacity: 0.9,
              strokeWeight: space.width ? Math.max(space.width, 4) : 6,
              map
            });
            overlaysRef.current.push(line);
         } else {
            const poly = new google.maps.Polygon({
              paths,
              fillColor: comfort.color,
              fillOpacity: 0.7,
              strokeWeight: 0,
              map
            });
            overlaysRef.current.push(poly);
         }
      });
      
      setActiveLegend([
        { label: 'Comfortable', color: '#22c55e' },
        { label: 'Acceptable', color: '#eab308' },
        { label: 'Uncomfortable', color: '#ef4444' }
      ]);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans">
      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend Overlay */}
      {activeLegend && (
        <div className="absolute bottom-8 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 z-10">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Legend</h4>
          <div className="space-y-1.5">
            {activeLegend.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Interface */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="absolute top-4 left-4 bottom-8 w-80 md:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl flex flex-col border border-slate-200/60 z-10"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-teal-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">AI Map Generator</h3>
                  <p className="text-xs text-slate-500">Powered by UrbanEyes</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-teal-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-slate-400 ml-2">{loadingMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Queries */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 overflow-x-auto whitespace-nowrap no-scrollbar">
              <div className="flex gap-2">
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(undefined, q)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-colors shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 rounded-b-2xl">
              <form onSubmit={(e) => handleSendMessage(e)} className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask for a map (e.g. 'Show parks')..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-sm"
                />
                <button 
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 top-2 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button (when closed) */}
      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="absolute top-4 left-4 p-3 bg-white text-teal-600 rounded-full shadow-lg hover:shadow-xl transition-all z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default AIMapGenerator;
