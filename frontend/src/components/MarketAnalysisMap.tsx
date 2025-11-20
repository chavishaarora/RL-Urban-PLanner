import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LocationData } from '../types';
import { fetchCompetitors, analyzeMarket, Competitor, MarketAnalysisResult } from '@/services/marketAnalysis';
import { fetchOSMBuildingsAround, fetchOSMRoadsAround, ROAD_TYPE_WIDTHS, ROAD_TYPE_COLORS } from '@/services/osmBuildings';
import html2canvas from 'html2canvas';
import { DownloadIcon } from './Icons';

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

interface MarketAnalysisMapProps {
  location: LocationData;
}

// Market categories - clean, no emojis
const MARKET_CATEGORIES = {
  'Food & Beverage': [
    'Restaurant', 'Cafe', 'Fast Food', 'Bar & Nightlife',
    'Bakery & Pastry', 'Ice Cream & Desserts', 'Food Court'
  ],
  'Retail': [
    'Supermarket & Grocery', 'Pharmacy & Drugstore',
    'Clothing & Fashion', 'Electronics & Tech', 'Home & Furniture', 'Bookstore'
  ],
  'Services': [
    'Salon & Spa', 'Fitness & Gym', 'Laundry & Dry Cleaning', 'Car Services',
    'Bank & Finance', 'Post Office', 'Real Estate Office', 'Travel Agency',
    'Professional Services', 'Business Center'
  ],
  'Healthcare': [
    'Hospital', 'Clinic & Doctor', 'Dentist', 'Pharmacy',
    'Veterinary', 'Physiotherapy', 'Optician'
  ],
  'Education & Entertainment': [
    'School & Kindergarten', 'University & College', 'Library', 'Cinema & Theater',
    'Museum & Gallery', 'Sports Facility', 'Park & Recreation', 'Coworking Space'
  ]
};

// Format distance helper
const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
};

export const MarketAnalysisMap: React.FC<MarketAnalysisMapProps> = ({ location }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Food & Beverage');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('Cafe');
  const [map, setMap] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isPremium, setIsPremium] = useState(false); // Default to Free (OSM only)
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const competitorMarkersRef = useRef<any[]>([]);
  const boundaryOverlayRef = useRef<any | null>(null);
  const gapCirclesRef = useRef<any[]>([]);
  const heatmapRef = useRef<any | null>(null);
  const buildingOverlaysRef = useRef<any[]>([]);
  const roadOverlaysRef = useRef<any[]>([]);
  
  // Refs for analytics card downloads
  const analyticsCardRef = useRef<HTMLDivElement>(null);
  const behaviorCardRef = useRef<HTMLDivElement>(null);

  // Download card as high-quality image
  const downloadCard = async (cardRef: React.RefObject<HTMLDivElement>, cardName: string) => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // High quality
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `${cardName.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download card:', error);
    }
  };

  const center = useMemo(() => ({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);

  const categories = Object.keys(MARKET_CATEGORIES);
  const subcategories = MARKET_CATEGORIES[selectedCategory as keyof typeof MARKET_CATEGORIES] || [];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || map) return;
    
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      mapTypeId: 'styled_map',
    });
    
    const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' });
    mapInstance.mapTypes.set('styled_map', styledMapType);
    
    // Fit to boundary if available
    if (location.boundary && location.boundary.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      location.boundary.forEach(p => bounds.extend(p));
      mapInstance.fitBounds(bounds);
    }
    
    setMap(mapInstance);
  }, [map, center, location.boundary]);

  // Export reset view listener - centers and pads map for PNG export
  useEffect(() => {
    if (!map) return;
    
    const handler = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        const framing = customEvent?.detail?.framing || 'wide';
        
        // Padding based on framing
        let paddingPx = 180;
        let extraZoom = 0;
        if (framing === 'wide') {
          paddingPx = 200;
          extraZoom = 0.5;
        } else if (framing === 'xwide') {
          paddingPx = 240;
          extraZoom = 1;
        }
        
        // Fit to boundary with padding
        if (location.boundary && location.boundary.length > 0) {
          const b = new google.maps.LatLngBounds();
          location.boundary.forEach(p => b.extend(p));
          map.fitBounds(b, paddingPx);
        } else {
          map.setCenter(center);
          map.setZoom(15);
        }
        
        // Additional zoom-out padding
        setTimeout(() => {
          try { map.setZoom(Math.max(0, map.getZoom() - extraZoom)); } catch(_) {}
        }, 250);
      } catch (_) {}
    };
    
    window.addEventListener('uexport-reset-view', handler);
    return () => window.removeEventListener('uexport-reset-view', handler);
  }, [map, center, location.boundary]);

  // Fetch and analyze market data when subcategory changes
  useEffect(() => {
    if (!map || !selectedSubcategory) return;
    
    let cancelled = false;
    
    const loadMarketData = async () => {
      setIsLoading(true);
      
      // Clear existing overlays
      competitorMarkersRef.current.forEach(m => m.setMap(null));
      competitorMarkersRef.current = [];
      gapCirclesRef.current.forEach(c => c.setMap(null));
      gapCirclesRef.current = [];
      buildingOverlaysRef.current.forEach(o => o.setMap(null));
      buildingOverlaysRef.current = [];
      roadOverlaysRef.current.forEach(o => o.setMap(null));
      roadOverlaysRef.current = [];
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
      if (boundaryOverlayRef.current) {
        boundaryOverlayRef.current.setMap(null);
        boundaryOverlayRef.current = null;
      }

      try {
        // Fetch buildings, roads, and competitors in parallel
        const [buildingData, roads, competitors] = await Promise.all([
          fetchOSMBuildingsAround(center, 700),
          fetchOSMRoadsAround(center, 700),
          fetchCompetitors(center, selectedSubcategory, 800, isPremium)
        ]);
        
        if (cancelled) return;

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

        // Render roads in background
        roads.forEach(road => {
          const path = road.nodes.map(n => ({ lat: n.lat, lng: n.lng }));
          const baseWidth = ROAD_TYPE_WIDTHS[road.roadType];
          const baseColor = ROAD_TYPE_COLORS[road.roadType];
          
          // Road casing
          const casing = new google.maps.Polyline({
            path,
            strokeColor: '#0f172a',
            strokeOpacity: 0.5,
            strokeWeight: baseWidth + 2,
            clickable: false,
            zIndex: 2,
          });
          casing.setMap(map);
          roadOverlaysRef.current.push(casing);
          
          // Main road line
          const polyline = new google.maps.Polyline({
            path,
            strokeColor: baseColor,
            strokeOpacity: 1.0,
            strokeWeight: baseWidth,
            clickable: false,
            zIndex: 3,
          });
          polyline.setMap(map);
          roadOverlaysRef.current.push(polyline);
        });

        // Analyze market
        const marketAnalysis = analyzeMarket(competitors, center, 800, isPremium);
        setAnalysis(marketAnalysis);

        // Render competitors as markers
        marketAnalysis.competitors.forEach((competitor) => {
          const marker = new google.maps.Marker({
            position: { lat: competitor.lat, lng: competitor.lng },
            map: map,
            title: `${competitor.name} (${formatDistance(competitor.distance)})`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#ef4444',
              fillOpacity: 0.8,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            zIndex: 100,
          });

          // Add info window on click
          marker.addListener('click', () => {
            const ratingInfo = competitor.rating 
              ? `<div style="font-size: 12px; color: #f59e0b; margin-top: 4px;">${competitor.rating.toFixed(1)}/5 (${competitor.userRatingsTotal || 0} reviews)</div>`
              : '';
            
            const sourceInfo = competitor.source === 'google' 
              ? '<span style="font-size: 11px; color: #10b981;">Google</span>'
              : '<span style="font-size: 11px; color: #6366f1;">OSM</span>';
            
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; min-width: 180px;">
                  <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${competitor.name}</div>
                  <div style="font-size: 12px; color: #64748b;">
                    ${competitor.type} • ${formatDistance(competitor.distance)} away
                  </div>
                  ${ratingInfo}
                  <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                    ${sourceInfo}
                  </div>
                </div>
              `,
            });
            infoWindow.open(map, marker);
          });

          competitorMarkersRef.current.push(marker);
        });

        // Render heatmap
        if (showHeatmap && marketAnalysis.competitors.length > 0) {
          const heatmapData = marketAnalysis.competitors.map(c => ({
            location: new google.maps.LatLng(c.lat, c.lng),
            weight: 1,
          }));

          const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            radius: 50,
            opacity: 0.6,
            gradient: [
              'rgba(0, 255, 255, 0)',
              'rgba(0, 255, 255, 1)',
              'rgba(0, 191, 255, 1)',
              'rgba(0, 127, 255, 1)',
              'rgba(0, 63, 255, 1)',
              'rgba(0, 0, 255, 1)',
              'rgba(0, 0, 223, 1)',
              'rgba(0, 0, 191, 1)',
              'rgba(0, 0, 159, 1)',
              'rgba(0, 0, 127, 1)',
              'rgba(63, 0, 91, 1)',
              'rgba(127, 0, 63, 1)',
              'rgba(191, 0, 31, 1)',
              'rgba(255, 0, 0, 1)'
            ],
          });
          heatmap.setMap(map);
          heatmapRef.current = heatmap;
        }

        // Render site boundary
        if (location.boundary && location.boundary.length > 0) {
          const boundaryPath = location.boundary.map(p => ({ lat: p.lat, lng: p.lng }));
          const boundaryPoly = new google.maps.Polygon({
            paths: boundaryPath,
            strokeColor: '#0d9488',
            strokeOpacity: 1,
            strokeWeight: 3,
            fillColor: '#14b8a6',
            fillOpacity: 0.1,
            clickable: false,
            zIndex: 1000,
          });
          boundaryPoly.setMap(map);
          boundaryOverlayRef.current = boundaryPoly;
        }

      } catch (error) {
        console.error('Error loading market data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMarketData();
    
    return () => {
      cancelled = true;
    };
  }, [map, selectedSubcategory, center, location.boundary, showHeatmap, isPremium]);

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Auto-select first subcategory
    const subs = MARKET_CATEGORIES[category as keyof typeof MARKET_CATEGORIES];
    if (subs && subs.length > 0) {
      setSelectedSubcategory(subs[0]);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Category Selector */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Select Business Category</h4>
            
            {/* Premium/Free Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Data Source:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isPremium 
                  ? 'bg-teal-500 text-white' 
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {isPremium ? 'Premium' : 'Free'}
              </span>
              <button
                onClick={() => setIsPremium(!isPremium)}
                className="relative w-11 h-6 bg-slate-300 rounded-full transition-colors duration-300 focus:outline-none"
                style={{ backgroundColor: isPremium ? '#14b8a6' : '#94a3b8' }}
              >
                <div
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300"
                  style={{ transform: isPremium ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory Pills */}
        {subcategories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-600 mb-2">Specific Business Type</h4>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    selectedSubcategory === sub
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={containerRef}
          data-map-capture="true"
          id="context-map-capture"
          className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden shadow-lg"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
              <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Heatmap Toggle */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="absolute top-4 right-4 px-3 py-2 bg-white rounded-xl shadow-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all"
        >
          {showHeatmap ? 'Hide' : 'Show'} Heatmap
        </button>
      </div>

      {/* Market Insights */}
      {analysis && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Competition</div>
              <div className="text-2xl font-bold text-slate-800">{analysis.totalCount}</div>
              <div className="text-xs text-slate-500 mt-1">
                {analysis.nearestDistance < 1000 
                  ? `Nearest: ${formatDistance(analysis.nearestDistance)}` 
                  : 'within 800m'}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Market Density</div>
              <div className="text-2xl font-bold text-slate-800">
                {analysis.densityScore.toFixed(1)}/10
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {analysis.densityScore < 3 ? 'Low' : analysis.densityScore < 7 ? 'Moderate' : 'High'}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Opportunity Score</div>
              <div className={`text-2xl font-bold ${
                analysis.opportunityScore >= 7 ? 'text-emerald-600' :
                analysis.opportunityScore >= 5 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {analysis.opportunityScore.toFixed(1)}/10
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {analysis.opportunityScore >= 7 ? 'Strong' : 
                 analysis.opportunityScore >= 5 ? 'Moderate' : 
                 analysis.opportunityScore >= 3 ? 'Limited' : 'Low'}
              </div>
            </div>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Market Insights</h4>
            <ul className="space-y-2">
              {analysis.insights.map((insight, index) => {
                // Determine if insight is positive or negative
                const isPositive = insight.includes('Strong market opportunity') || 
                                   insight.includes('Low competition') || 
                                   insight.includes('untapped market') ||
                                   insight.includes('excellent') ||
                                   insight.includes('first-mover') ||
                                   insight.includes('far away');
                const isNegative = insight.includes('Limited opportunity') ||
                                   insight.includes('Low opportunity') ||
                                   insight.includes('Very high competition') ||
                                   insight.includes('saturated') ||
                                   insight.includes('Very close competitor') ||
                                   insight.includes('High market density');
                
                const dotColor = isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-teal-500';
                
                return (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className={`w-1.5 h-1.5 ${dotColor} rounded-full mt-1.5 flex-shrink-0`}></span>
                    <span>{insight}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Competitors List */}
          {analysis.competitors.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                Nearby Competitors ({analysis.competitors.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {analysis.competitors.slice(0, 10).map((competitor) => (
                  <div 
                    key={competitor.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{competitor.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{competitor.type}</span>
                          {competitor.rating && (
                            <span className="text-amber-600 font-medium">{competitor.rating.toFixed(1)}/5</span>
                          )}
                          {competitor.source === 'google' && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">Google</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-slate-600 ml-2">{formatDistance(competitor.distance)}</div>
                  </div>
                ))}
                {analysis.competitors.length > 10 && (
                  <div className="text-center text-xs text-slate-500 pt-2">
                    + {analysis.competitors.length - 10} more competitors
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Premium Analytics */}
          {analysis.analytics && isPremium && (
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border-2 border-teal-200 shadow-md p-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-slate-800">Market Analytics</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => downloadCard(analyticsCardRef, 'Market_Analytics')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-700 text-xs font-medium rounded-lg border border-teal-200 transition-colors shadow-sm"
                    title="Download Analytics Card"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold rounded-full">
                    PREMIUM
                  </span>
                </div>
              </div>

              <div ref={analyticsCardRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Busiest Hours */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h5 className="text-sm font-semibold text-slate-700 mb-3">Busiest Hours</h5>
                    <div className="space-y-1">
                      {analysis.analytics.peakHours
                        .filter(h => h.hour >= 6 && h.hour <= 23)
                        .map((hourData) => (
                          <div key={hourData.hour} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-600 w-12">
                              {hourData.hour.toString().padStart(2, '0')}:00
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${hourData.popularity}%` }}
                              >
                                {hourData.popularity > 30 && (
                                  <span className="text-[10px] font-bold text-white">
                                    {hourData.popularity}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 italic">
                      Peak: {analysis.analytics.peakHours.reduce((max, h) => h.popularity > max.popularity ? h : max).hour}:00
                    </p>
                  </div>

                  {/* Competition Intensity - Below Busiest Hours */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h5 className="text-sm font-semibold text-slate-700 mb-3">Competition Intensity</h5>
                    <div className="space-y-3">
                      {/* Distance Distribution */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-600">Proximity Zones</span>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const within500m = analysis.competitors.filter(c => c.distance <= 500).length;
                            const within1km = analysis.competitors.filter(c => c.distance > 500 && c.distance <= 1000).length;
                            const beyond1km = analysis.competitors.filter(c => c.distance > 1000).length;
                            const total = analysis.competitors.length;
                            
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">0-500m</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${(within500m / total) * 100}%` }}
                                    >
                                      {within500m > 0 && (
                                        <span className="text-[10px] font-bold text-white">{within500m}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">500m-1km</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${(within1km / total) * 100}%` }}
                                    >
                                      {within1km > 0 && (
                                        <span className="text-[10px] font-bold text-white">{within1km}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">&gt;1km</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${(beyond1km / total) * 100}%` }}
                                    >
                                      {beyond1km > 0 && (
                                        <span className="text-[10px] font-bold text-white">{beyond1km}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Rating Distribution */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-600">Rating Tiers</span>
                        </div>
                        <div className="space-y-1.5">
                          {(() => {
                            const excellent = analysis.competitors.filter(c => c.rating && c.rating >= 4.5).length;
                            const good = analysis.competitors.filter(c => c.rating && c.rating >= 4.0 && c.rating < 4.5).length;
                            const average = analysis.competitors.filter(c => c.rating && c.rating >= 3.5 && c.rating < 4.0).length;
                            const below = analysis.competitors.filter(c => c.rating && c.rating < 3.5).length;
                            const total = analysis.competitors.filter(c => c.rating).length;
                            
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">4.5-5.0</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${total > 0 ? (excellent / total) * 100 : 0}%` }}
                                    >
                                      {excellent > 0 && (
                                        <span className="text-[10px] font-bold text-white">{excellent}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">4.0-4.5</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${total > 0 ? (good / total) * 100 : 0}%` }}
                                    >
                                      {good > 0 && (
                                        <span className="text-[10px] font-bold text-white">{good}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">3.5-4.0</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${total > 0 ? (average / total) * 100 : 0}%` }}
                                    >
                                      {average > 0 && (
                                        <span className="text-[10px] font-bold text-white">{average}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-16">&lt;3.5</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-slate-400 to-slate-500 h-full rounded-full flex items-center justify-end pr-2"
                                      style={{ width: `${total > 0 ? (below / total) * 100 : 0}%` }}
                                    >
                                      {below > 0 && (
                                        <span className="text-[10px] font-bold text-white">{below}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Market Density Score */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Density Score</span>
                          <span className="text-lg font-bold text-teal-700">
                            {analysis.densityScore.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="mt-2 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
                            style={{ width: `${(analysis.densityScore / 10) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {analysis.densityScore >= 7 ? 'High saturation - differentiation critical' :
                           analysis.densityScore >= 5 ? 'Moderate density - niche opportunities exist' :
                           'Low competition - strong market potential'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Market Snapshot with Weekly Pattern */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-700 mb-3">Market Snapshot</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Average Rating</span>
                      <span className="text-sm font-bold text-teal-600">
                        {analysis.analytics.averageRating.toFixed(1)}/5
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Total Reviews</span>
                      <span className="text-sm font-bold text-slate-800">
                        {analysis.analytics.totalReviews.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Currently Open</span>
                      <span className="text-sm font-bold text-emerald-600">
                        {analysis.analytics.openNowCount} / {analysis.totalCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">With Photos</span>
                      <span className="text-sm font-bold text-teal-600">
                        {analysis.analytics.hasPhotosCount}
                      </span>
                    </div>
                  </div>

                  {/* Weekly Pattern - Inside Market Snapshot */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h6 className="text-sm font-semibold text-slate-700 mb-2">Weekly Pattern</h6>
                    <div className="space-y-1.5">
                      {analysis.analytics.dayOfWeekDistribution.map((dayData) => (
                        <div key={dayData.day} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 w-10">
                            {dayData.day.substring(0, 3)}
                          </span>
                          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${dayData.averagePopularity}%` }}
                            >
                              {dayData.averagePopularity > 30 && (
                                <span className="text-[10px] font-bold text-white">
                                  {dayData.averagePopularity}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User Behavior Insights */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h6 className="text-sm font-semibold text-slate-700">User Behavior Analysis</h6>
                      <button
                        onClick={() => downloadCard(behaviorCardRef, 'User_Behavior_Analysis')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-medium rounded-lg border border-teal-200 transition-colors"
                        title="Download Behavior Analysis"
                      >
                        <DownloadIcon className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </div>
                    <div ref={behaviorCardRef} className="space-y-2.5">
                      {/* Peak Activity Insight */}
                      <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-3 rounded-xl border border-teal-200 shadow-sm">
                        <p className="font-bold text-teal-900 mb-1 text-xs">Peak Activity</p>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          Users are most active around <span className="font-bold text-teal-700">
                          {analysis.analytics.peakHours.reduce((max, h) => h.popularity > max.popularity ? h : max).hour}:00
                          </span>, indicating prime visiting hours for {selectedCategory.toLowerCase()} establishments. 
                          This suggests optimal staffing and inventory levels should align with midday to early afternoon periods.
                        </p>
                      </div>

                      {/* Weekend vs Weekday */}
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-3 rounded-xl border border-emerald-200 shadow-sm">
                        <p className="font-bold text-emerald-900 mb-1 text-xs">Weekly Dynamics</p>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          {(() => {
                            const weekdayAvg = analysis.analytics.dayOfWeekDistribution
                              .slice(0, 5)
                              .reduce((sum, d) => sum + d.averagePopularity, 0) / 5;
                            const weekendAvg = analysis.analytics.dayOfWeekDistribution
                              .slice(5, 7)
                              .reduce((sum, d) => sum + d.averagePopularity, 0) / 2;
                            const diff = Math.abs(weekendAvg - weekdayAvg);
                            
                            if (weekendAvg > weekdayAvg + 10) {
                              return `Weekend traffic is ${diff.toFixed(0)}% higher than weekdays, suggesting this area serves as a leisure destination. Consider extended weekend hours and promotional campaigns targeting weekend visitors.`;
                            } else if (weekdayAvg > weekendAvg + 10) {
                              return `Weekday activity is ${diff.toFixed(0)}% stronger, indicating a commercial/office-oriented demographic. Focus on quick-service offerings and business lunch specials during weekdays.`;
                            } else {
                              return `Consistent foot traffic throughout the week suggests a balanced mix of residential and commercial users. Maintain steady operations with slight adjustments for weekend leisure activities.`;
                            }
                          })()}
                        </p>
                      </div>

                      {/* Customer Profile */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200 shadow-sm">
                        <p className="font-bold text-blue-900 mb-1 text-xs">Customer Profile</p>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          With an average rating of <span className="font-bold text-blue-700">
                          {analysis.analytics.averageRating.toFixed(1)}/5
                          </span> across {analysis.analytics.totalReviews.toLocaleString()} reviews, 
                          the area shows {analysis.analytics.averageRating >= 4.0 ? 'high customer satisfaction' : 
                          analysis.analytics.averageRating >= 3.5 ? 'moderate satisfaction with room for improvement' : 
                          'significant opportunity for quality differentiation'}. Currently, {analysis.analytics.openNowCount} out of {analysis.competitors.length} establishments 
                          are open, with {((analysis.analytics.openNowCount / analysis.competitors.length) * 100).toFixed(0)}% operational availability.
                        </p>
                      </div>

                      {/* Strategic Recommendation */}
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3 rounded-xl border border-amber-200 shadow-sm">
                        <p className="font-bold text-amber-900 mb-1 text-xs">Strategic Insight</p>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          {(() => {
                            const peakHour = analysis.analytics.peakHours.reduce((max, h) => h.popularity > max.popularity ? h : max).hour;
                            const busiestDay = analysis.analytics.dayOfWeekDistribution.reduce((max, d) => d.averagePopularity > max.averagePopularity ? d : max);
                            
                            return `The data reveals ${busiestDay.day} afternoons (around ${peakHour}:00) as the prime engagement window. 
                            ${analysis.opportunityScore >= 7 ? 'High opportunity score indicates undersupplied demand - consider premium positioning and extended service hours.' : 
                            analysis.opportunityScore >= 5 ? 'Moderate competition suggests success through differentiation - focus on unique value propositions and exceptional service quality.' : 
                            'Saturated market conditions require innovative approaches - explore niche segments, off-peak promotions, or complementary service bundles.'}`;
                          })()}
                        </p>
                      </div>

                      {/* Market Positioning */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl border border-purple-200 shadow-sm">
                        <p className="font-bold text-purple-900 mb-1 text-xs">Market Positioning</p>
                        <p className="leading-relaxed text-[11px] text-slate-700">
                          {(() => {
                            const nearCompetitors = analysis.competitors.filter(c => c.distance <= 500).length;
                            const highRated = analysis.competitors.filter(c => c.rating && c.rating >= 4.5).length;
                            const percentHighRated = analysis.competitors.filter(c => c.rating).length > 0 
                              ? ((highRated / analysis.competitors.filter(c => c.rating).length) * 100).toFixed(0)
                              : 0;
                            
                            return `With ${nearCompetitors} competitors within 500m and ${percentHighRated}% rated 4.5+ stars, ${
                              nearCompetitors > 15 ? 'this is a highly competitive zone requiring strong brand identity and exceptional customer experience to stand out.' :
                              nearCompetitors > 8 ? 'moderate competition exists - establish clear differentiators and leverage local partnerships for visibility.' :
                              'limited immediate competition presents a first-mover advantage - build strong community presence early.'
                            }`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-slate-500 italic text-center">
        Market analysis powered by {isPremium ? 'Google Places + OpenStreetMap' : 'OpenStreetMap'} • 
        {isPremium && ' Premium: Advanced analytics & insights •'} Red dots = competitors
      </p>
    </div>
  );
};

export default MarketAnalysisMap;
