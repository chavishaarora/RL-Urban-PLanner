import React, { useState, useEffect, useRef } from 'react';
import { LocationData } from '../types';
import OSMAnalysisMap from './OSMAnalysisMap';
import OSMLandUseMap from './OSMLandUseMap';
import OSMRoadNetworkMap from './OSMRoadNetworkMap';
import MarketAnalysisMap from './MarketAnalysisMap';
import AIMapGenerator from './AIMapGenerator';
import PageHeader from './PageHeader';
import { MapPinIcon } from './Icons';
import MapExportProgress from './MapExportProgress';
import { exportSingleMap, MapExportProgress as ProgressData, ExportFraming } from '@/services/mapExportService';
import { exportContextMap, ExportFormat, getAvailableFormats } from '@/services/mapFormatExporter';

type MapLayer = 'buildings' | 'landuse' | 'roads' | 'market' | 'environmental';

interface ContextMapsViewProps {
  location: LocationData | null;
  initialLayer?: MapLayer;
}

export const ContextMapsView: React.FC<ContextMapsViewProps> = ({ location, initialLayer = 'buildings' }) => {
  const [activeLayer, setActiveLayer] = useState<MapLayer>(initialLayer);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ProgressData | null>(null);
  const [framing, setFraming] = useState<ExportFraming>('wide');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentSubMap, setCurrentSubMap] = useState<string>('BuildingTypes');
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for button clicks to track which sub-map is active
  useEffect(() => {
    const handleButtonClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;
      
      const buttonText = button.textContent?.trim() || '';
      
      // Map button text to export names
      const buttonMap: Record<string, string> = {
        'Type': 'BuildingTypes',
        'Height': 'BuildingHeight',
        'Footprint': 'BuildingFootprint',
        'Age': 'BuildingAge',
        'Land Use': 'LandUse',
        'Population': 'PopulationDensity',
        'Street Hierarchy': 'StreetHierarchy',
        'Accessibility': 'Accessibility',
        'Restaurant': 'MarketAnalysis_Restaurant',
        'Cafe': 'MarketAnalysis_Cafe',
        'Fast Food': 'MarketAnalysis_FastFood',
        'Bar & Nightlife': 'MarketAnalysis_BarNightlife',
        'Supermarket & Grocery': 'MarketAnalysis_Supermarket',
        'Pharmacy & Drugstore': 'MarketAnalysis_Pharmacy',
      };
      
      if (buttonMap[buttonText]) {
        setCurrentSubMap(buttonMap[buttonText]);
      }
    };

    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, []);

  // Update currentSubMap when layer changes
  useEffect(() => {
    const defaultSubMaps: Record<MapLayer, string> = {
      'buildings': 'BuildingTypes',
      'landuse': 'LandUse',
      'roads': 'StreetHierarchy',
      'market': 'MarketAnalysis_Cafe',
      'environmental': 'EnvironmentalAnalysis',
    };
    setCurrentSubMap(defaultSubMaps[activeLayer]);
  }, [activeLayer]);

  const layers: { id: MapLayer; label: string }[] = [
    { id: 'buildings', label: 'Building Analysis' },
    { id: 'landuse', label: 'Land Use' },
    { id: 'roads', label: 'Road Network' },
    { id: 'market', label: 'Market Analysis' },
    { id: 'environmental', label: 'AI Map Generator' },
  ];

  const handleExportFormat = async (format: ExportFormat) => {
    if (!location) return;
    
    setShowExportMenu(false);
    setIsExporting(true);

    try {
      if (format === 'png') {
        // Export current visible map as PNG
        await exportSingleMap(location.name, currentSubMap, { framing });
      } else {
        // Use the format exporter for SVG and GeoJSON
        await exportContextMap(location, currentSubMap, format);
      }
    } catch (error: any) {
      console.error('Failed to export map:', error);
      alert(error.message || 'Failed to export map. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="w-full pt-0 pb-8">
        {/* When a location exists, show header pill above the card (separate from body) */}
        {location && (
          <PageHeader
            className="mb-8"
            title="Context Maps"
            icon={<MapPinIcon className="w-full h-full" />}
            subtitle={
              <span className="text-xs md:text-sm">
                Urban analysis for <span className="font-semibold text-teal-700">{location.name}</span>
              </span>
            }
          />
        )}
        {/* Body Card (toggle + map). If no location, show the empty state inside the card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden">
          {!location ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-teal-100 via-teal-200 to-emerald-100 rounded-3xl mb-6 shadow-lg shadow-teal-500/20 animate-pulse">
                <svg
                  className="w-12 h-12 text-teal-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">No Location Selected</h3>
              <p className="text-slate-600 max-w-md mx-auto text-base leading-relaxed">
                Select a site from the <span className="font-semibold text-teal-600">"Analyse Site"</span> tab to unlock
                OpenStreetMap-based urban context analysis
              </p>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              {/* Header: Pill Toggle + Download Button */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="p-1.5 bg-white rounded-full shadow-lg border border-slate-200/60 backdrop-blur-sm">
                    <div className="flex">
                      {layers.map((layer) => (
                        <button
                          key={layer.id}
                          onClick={() => setActiveLayer(layer.id)}
                          className={`relative flex-1 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ease-out ${
                            activeLayer === layer.id
                              ? 'text-white shadow-lg'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {activeLayer === layer.id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full shadow-md shadow-teal-500/40" />
                          )}
                          <span className="relative">{layer.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Download Button with Format Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-full shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download As...</span>
                    <svg className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showExportMenu && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 z-[1000]" 
                        onClick={() => setShowExportMenu(false)}
                      />
                      {/* Menu */}
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[1002]">
                        <div className="py-1">
                          <button
                            onClick={() => handleExportFormat('png')}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-3"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <div className="font-medium">PNG</div>
                              <div className="text-xs text-slate-500">High-res raster image</div>
                            </div>
                          </button>
                          <button
                            onClick={() => handleExportFormat('svg')}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-3"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            <div>
                              <div className="font-medium">SVG</div>
                              <div className="text-xs text-slate-500">Scalable vector graphic</div>
                            </div>
                          </button>
                          <button
                            onClick={() => handleExportFormat('geojson')}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-3"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <div>
                              <div className="font-medium">GeoJSON</div>
                              <div className="text-xs text-slate-500">Geographic data format</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Map area */}
              <div>
                {activeLayer === 'buildings' && <OSMAnalysisMap location={location} initialLayer="type" />}
                {activeLayer === 'landuse' && <OSMLandUseMap location={location} />}
                {activeLayer === 'roads' && <OSMRoadNetworkMap location={location} />}
                {activeLayer === 'market' && <MarketAnalysisMap location={location} />}
                {activeLayer === 'environmental' && <AIMapGenerator location={location} />}
              </div>
            </div>
          )}
        </div>
        {/* Export Progress Modal */}
        {exportProgress && (
          <MapExportProgress progress={exportProgress} isOpen={isExporting} />
        )}
      </div>
    </div>
  );
};
