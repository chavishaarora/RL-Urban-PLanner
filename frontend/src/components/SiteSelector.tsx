import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { LocationData, ProximityItem } from '../types';
import { ThemeContext } from '@/contexts/ThemeContext';
import { CustomMapControl } from './CustomMapControl';
import { HandIcon, PolygonIcon, RectangleIcon, PencilIcon, XIcon } from './Icons';
import { getPOIMarkerIcon } from '@/utils/mapUtils';

declare const google: any;

// A custom info window component to match the app's theme
const CustomInfoWindow: React.FC<{ map: any; poi: ProximityItem | null; onClose: () => void }> = ({ map, poi, onClose }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<any>(null);

    useEffect(() => {
        if (!map) return;

        class CustomOverlay extends google.maps.OverlayView {
            private div: HTMLDivElement | null = null;
            private position: any | null = null;

            constructor(div: HTMLDivElement) {
                super();
                this.div = div;
            }
            onAdd() {
                const panes = this.getPanes();
                panes?.floatPane.appendChild(this.div!);
            }
            onRemove() {
                if (this.div?.parentElement) {
                    this.div.parentElement.removeChild(this.div);
                }
            }
            draw() {
                const projection = this.getProjection();
                if (!projection || !this.position || !this.div) return;
                const point = projection.fromLatLngToDivPixel(this.position);
                this.div.style.left = `${point.x}px`;
                this.div.style.top = `${point.y}px`;
            }
            setPosition(position: any) {
                this.position = position;
                this.draw();
            }
            hide() {
                if (this.div) this.div.style.visibility = 'hidden';
            }
            show() {
                 if (this.div) this.div.style.visibility = 'visible';
            }
        }

        if (!overlayRef.current && divRef.current) {
            overlayRef.current = new CustomOverlay(divRef.current);
            overlayRef.current.setMap(map);
        }

        return () => {
            if (overlayRef.current) {
                overlayRef.current.setMap(null);
                overlayRef.current = null;
            }
        };
    }, [map]);
    
    useEffect(() => {
        if (overlayRef.current) {
            if (poi) {
                const position = new google.maps.LatLng(poi.latitude, poi.longitude);
                overlayRef.current.setPosition(position);
                overlayRef.current.show();
            } else {
                overlayRef.current.hide();
            }
        }
    }, [poi]);

    return (
        <div ref={divRef} style={{ position: 'absolute', visibility: 'hidden' }}>
            {poi && (
                <div className="relative bottom-4 -translate-x-1/2 bg-slate-800 text-white p-3 rounded-lg shadow-lg w-64 animate-fade-in-up" style={{ marginBottom: '10px' }}>
                    <button onClick={onClose} className="absolute top-1 right-1 p-1 text-slate-400 hover:text-white">
                        <XIcon className="w-4 h-4" />
                    </button>
                    <p className="font-bold text-base mb-1">{poi.name}</p>
                    <p className="text-xs text-slate-300">{poi.category}</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
                </div>
            )}
        </div>
    );
};


const lightMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#e3e3e3" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi.park", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#d1fae5" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a7a5f" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e3e3e3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d6d6d6" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#c1c1c1" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#a8dadc" }] },
];

interface SiteSelectorProps {
    onLocationSelect: (location: LocationData | null) => void;
    currentLocation: LocationData | null;
    mapContainerRef: React.RefObject<HTMLDivElement>;
    onMapLoad: (map: any) => void;
    hasAnalysis: boolean;
    showPois: boolean;
    onTogglePois: () => void;
    proximityPois: ProximityItem[] | null;
}

export const SiteSelector: React.FC<SiteSelectorProps> = ({ onLocationSelect, currentLocation, mapContainerRef, onMapLoad, hasAnalysis, showPois, onTogglePois, proximityPois }) => {
    const mapRef = mapContainerRef;
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [map, setMap] = useState<any | null>(null);
    const [drawingManager, setDrawingManager] = useState<any | null>(null);
    const [drawnPolygon, setDrawnPolygon] = useState<any | null>(null);
    const [geocoder, setGeocoder] = useState<any | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
    const [activePoi, setActivePoi] = useState<ProximityItem | null>(null);
    const poiMarkersRef = useRef<any[]>([]);

    // Mobile specific state
    const [isFabOpen, setIsFabOpen] = useState(false);

    const handleOverlayComplete = useCallback((event: any) => {
        if (drawnPolygon) {
            drawnPolygon.setMap(null);
        }
        setDrawnPolygon(event.overlay);
        
        setIsDrawing(false);
        setIsFabOpen(false); // Close FAB on mobile
        setActiveDrawingTool(null);
        drawingManager?.setDrawingMode(null);

        let pathArray;
        let bounds = new google.maps.LatLngBounds();
        let areaInMeters = 0;

        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const path = event.overlay.getPath();
            pathArray = path.getArray();
            pathArray.forEach((latLng: any) => bounds.extend(latLng));
            areaInMeters = google.maps.geometry.spherical.computeArea(path);
        
        } else if (event.type === google.maps.drawing.OverlayType.RECTANGLE) {
            bounds = event.overlay.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const rectPath = [
                { lat: sw.lat(), lng: sw.lng() },
                { lat: ne.lat(), lng: sw.lng() },
                { lat: ne.lat(), lng: ne.lng() },
                { lat: sw.lat(), lng: ne.lng() },
            ];
            pathArray = rectPath.map(p => new google.maps.LatLng(p.lat, p.lng));
            areaInMeters = google.maps.geometry.spherical.computeArea(pathArray);
        }

        if (pathArray) {
            const center = bounds.getCenter();
            const centerLat = center.lat();
            const centerLng = center.lng();
            const boundary = pathArray.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));

            geocoder.geocode({ location: center }, (results: any, status: any) => {
                const name = (status === 'OK' && results?.[0]) ? results[0].formatted_address : 'Custom Defined Area';
                onLocationSelect({
                    name,
                    latitude: centerLat,
                    longitude: centerLng,
                    boundary: boundary,
                    area: areaInMeters,
                });
            });
        }

    }, [drawingManager, drawnPolygon, geocoder, onLocationSelect]);


    useEffect(() => {
        (window as any).gm_authFailure = () => {
             setMapError("Google Maps authentication failed. Please check that your API key is correct, valid, and has the necessary APIs enabled in the Google Cloud Console.");
        };
        
        if (typeof (window as any).google === 'undefined' || typeof (window as any).google.maps === 'undefined' || typeof (window as any).google.maps.drawing === 'undefined' || typeof (window as any).google.maps.geometry === 'undefined') {
            setMapError("Google Maps failed to load. Please check your API key and ensure the 'drawing' and 'geometry' libraries are loaded in index.html.");
            return;
        }

        if (!map && mapRef.current) {
            const initialCenter = currentLocation 
                ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
                : { lat: 41.3999, lng: 2.1979 };

            const mapInstance = new google.maps.Map(mapRef.current, {
                center: initialCenter,
                zoom: currentLocation ? 16 : 17,
                disableDefaultUI: true,
                zoomControl: false, // Remove the +/- zoom buttons
            });

            const commonShapeOptions = {
                fillColor: '#14b8a6',
                fillOpacity: 0.4,
                strokeWeight: 4,
                strokeColor: '#0f766e',
                clickable: false,
                editable: true,
                zIndex: 1,
            };

            const drawingManagerInstance = new google.maps.drawing.DrawingManager({
                drawingMode: null,
                drawingControl: false, // Always false now
                polygonOptions: commonShapeOptions,
                rectangleOptions: commonShapeOptions,
            });
            
            drawingManagerInstance.setMap(mapInstance);

            setMap(mapInstance);
            onMapLoad(mapInstance);
            setGeocoder(new google.maps.Geocoder());
            setDrawingManager(drawingManagerInstance);

            if (currentLocation?.boundary) {
                const polygon = new google.maps.Polygon({
                    paths: currentLocation.boundary,
                    ...commonShapeOptions
                });
                polygon.setMap(mapInstance);
                setDrawnPolygon(polygon);
            }
        }
    }, [map, currentLocation, mapRef, onMapLoad]);
    
    useEffect(() => {
        if (map) {
            const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: "Styled Map" });
            map.mapTypes.set("styled_map", styledMapType);
            if (map.getMapTypeId() !== 'satellite') {
                map.setMapTypeId("styled_map");
            }
        }
    }, [map]);

    useEffect(() => {
        if (drawingManager) {
            const listener = google.maps.event.addListener(drawingManager, 'overlaycomplete', handleOverlayComplete);
            return () => {
                google.maps.event.removeListener(listener);
            };
        }
    }, [drawingManager, handleOverlayComplete]);
    
    useEffect(() => {
        if (map && searchInputRef.current) {
            const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
                fields: ["geometry", "name"]
            });
            autocomplete.bindTo("bounds", map);
            
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry?.viewport) {
                    map.fitBounds(place.geometry.viewport);
                } else if (place.geometry?.location) {
                    map.setCenter(place.geometry.location);
                    map.setZoom(17);
                }
            });
        }
    }, [map]);

     // Effect for handling POI layer
    useEffect(() => {
        const cleanup = () => {
            poiMarkersRef.current.forEach(marker => marker.setMap(null));
            poiMarkersRef.current = [];
        };

        if (!showPois || !map || !proximityPois || proximityPois.length === 0) {
            cleanup();
            setActivePoi(null);
            return;
        }

        cleanup();

        proximityPois.forEach(poi => {
            if (!poi.latitude || !poi.longitude) return;
            
            const marker = new google.maps.Marker({
                map,
                position: { lat: poi.latitude, lng: poi.longitude },
                title: poi.name,
                icon: getPOIMarkerIcon(),
                animation: google.maps.Animation.DROP,
            });

            marker.addListener('click', () => {
                setActivePoi(poi);
            });
            
            poiMarkersRef.current.push(marker);
        });

        return cleanup;
    }, [showPois, map, proximityPois]);


    const handleToggleDrawing = () => {
        const nextIsDrawing = !isDrawing;
        setIsDrawing(nextIsDrawing);
        setActiveDrawingTool(null);
        drawingManager?.setDrawingMode(null);
    };
    
    const handleClearClick = () => {
        if (drawnPolygon) {
            drawnPolygon.setMap(null);
            setDrawnPolygon(null);
        }
        onLocationSelect(null);
        if (isDrawing) {
            setIsDrawing(false);
            setActiveDrawingTool(null);
            drawingManager?.setDrawingMode(null);
        }
         if (isFabOpen) {
            setIsFabOpen(false);
        }
    };
    
    const setDrawingTool = (tool: string | null) => {
        setActiveDrawingTool(tool);
        if (tool === 'polygon') {
            drawingManager?.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        } else if (tool === 'rectangle') {
            drawingManager?.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
        } else {
            drawingManager?.setDrawingMode(null);
        }
        setIsFabOpen(false); // Close FAB after selection
    };

    return (
        <div className="relative">
            <div className="absolute top-4 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for a location to start..."
                    className="w-full max-w-md form-input shadow-md rounded-full px-6 pointer-events-auto"
                />
            </div>
            {/* Map controls moved into the map container below */}
            
            {/* Desktop Drawing Controls */}
            {isDrawing && (
                <div className="absolute top-4 left-4 z-10 hidden md:inline-flex">
                    <div className="btn-group bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-slate-200/50">
                        <button
                            onClick={() => setDrawingTool(null)}
                            title="Pan Map"
                            className={`btn rounded-l-full ${!activeDrawingTool ? 'active' : ''}`}
                        >
                            <HandIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setDrawingTool('polygon')}
                            title="Draw Polygon"
                            className={`btn ${activeDrawingTool === 'polygon' ? 'active' : ''}`}
                        >
                            <PolygonIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setDrawingTool('rectangle')}
                            title="Draw Rectangle"
                            className={`btn rounded-r-full ${activeDrawingTool === 'rectangle' ? 'active' : ''}`}
                        >
                            <RectangleIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {hasAnalysis && (
                <div className="absolute top-16 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-slate-200/50 px-4 py-2 flex items-center gap-3">
                    <label htmlFor="poi-toggle" className="text-sm font-medium text-slate-700">Show POIs</label>
                    <button
                        id="poi-toggle"
                        onClick={onTogglePois}
                        role="switch"
                        aria-checked={showPois}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${showPois ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${showPois ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
            )}

            {mapError ? (
                <div className="h-[500px] flex items-center justify-center bg-red-50 text-red-700 rounded-lg p-4 text-center">
                    {mapError}
                </div>
            ) : (
                <div className="relative">
                    <div ref={mapRef} className="h-[500px] w-full rounded-lg border border-slate-200" />
                    <CustomMapControl map={map} />
                </div>
            )}
            
            <CustomInfoWindow map={map} poi={activePoi} onClose={() => setActivePoi(null)} />
            
            {/* Desktop Bottom Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-3xl hidden md:flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2 sm:px-4 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-200/50">
                <div className="text-center sm:text-left flex-grow sm:pl-3">
                    <p className="font-semibold text-sm text-slate-800">
                        {currentLocation?.name || "No Area Selected"}
                    </p>
                     <p className="text-xs sm:text-sm text-slate-600 font-mono">
                        {currentLocation 
                            ? currentLocation.area 
                                ? `Area: ${currentLocation.area.toFixed(1)} m² | Center: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                                : `Center: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                            : "Use the drawing tool to define a site for analysis."
                        }
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button 
                        onClick={handleToggleDrawing} 
                        className={`btn ${isDrawing ? 'btn-secondary' : 'btn-primary'}`}
                    >
                        {isDrawing ? "Cancel" : "Draw Area"}
                    </button>
                    <button 
                        onClick={handleClearClick} 
                        disabled={!drawnPolygon}
                        className="btn btn-muted"
                    >
                        Clear Area
                    </button>
                </div>
            </div>

            {/* Mobile FAB and Info Panel */}
            <div className="md:hidden absolute bottom-4 right-4 z-20 space-y-3 flex flex-col items-end">
                {/* Speed Dial Options */}
                {isFabOpen && (
                    <div className="flex flex-col items-end gap-3 animate-fade-in-up">
                        <button onClick={() => setDrawingTool('rectangle')} className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-slate-200/50 hover:bg-slate-50 transition-colors" title="Draw Rectangle">
                            <RectangleIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setDrawingTool('polygon')} className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-slate-200/50 hover:bg-slate-50 transition-colors" title="Draw Polygon">
                            <PolygonIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setDrawingTool(null)} className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-slate-200/50 hover:bg-slate-50 transition-colors" title="Pan Map">
                            <HandIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}
                {/* Main FAB */}
                {!drawnPolygon && (
                    <button onClick={() => { setIsDrawing(true); setIsFabOpen(prev => !prev); }} className="mobile-fab">
                        <PencilIcon className="w-7 h-7" />
                    </button>
                )}
            </div>

             {/* Mobile Info Sheet */}
             <div className={`md:hidden absolute bottom-4 left-4 right-4 z-10 p-4 bg-white/90 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-md transition-all duration-300 ${drawnPolygon ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <div className="text-center mb-3">
                    <p className="font-semibold text-sm text-slate-800">{currentLocation?.name || "Area Defined"}</p>
                    <p className="text-xs text-slate-600 font-mono">
                        {currentLocation?.area ? `Area: ${currentLocation.area.toFixed(1)} m²` : 'Processing...'}
                    </p>
                </div>
                 <button onClick={handleClearClick} className="w-full btn btn-muted">
                    Clear Area
                </button>
            </div>
             {!drawnPolygon && (
                 <div className="md:hidden absolute bottom-0 left-0 right-0 z-10 p-4 pt-5 bg-white/90 backdrop-blur-sm border-t border-slate-200 rounded-t-2xl">
                    <p className="text-center text-sm text-slate-600">Tap the pencil to start drawing an area for analysis.</p>
                </div>
            )}
        </div>
    );
};