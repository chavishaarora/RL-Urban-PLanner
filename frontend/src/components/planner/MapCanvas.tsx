import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { PlanShape, ProjectData, ProximityItem } from '../../types';
import { PlannerTool } from '../ConceptualPlanner';
import { CustomMapControl } from '../CustomMapControl';
import { getPOIMarkerIcon } from '@/utils/mapUtils';
import { XIcon } from '../Icons';
import { offsetPolygonUniform, offsetPolygonPerEdge, ensurePolygonWinding } from '@/utils/geometry';

// FIX: Declare the global 'google' object to resolve 'Cannot find namespace' errors.
declare const google: any;

const lightMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e3e3e3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d6d6d6" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#a8dadc" }] },
];

const getBoundingBox = (points: {x:number, y:number}[]) => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
        minX: Math.min(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
        maxX: Math.max(...points.map(p => p.x)),
        maxY: Math.max(...points.map(p => p.y)),
    };
};

const rotatePoint = (point: {x: number, y: number}, origin: {x: number, y: number}, angle: number) => {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const translated = { x: point.x - origin.x, y: point.y - origin.y };
    const rotated = {
        x: translated.x * cos - translated.y * sin,
        y: translated.x * sin + translated.y * cos,
    };
    return { x: rotated.x + origin.x, y: rotated.y + origin.y };
};


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


// --- Custom Map Label Overlay ---

// FIX: Use 'any' for google.maps types as 'google' is not a typed namespace, which causes errors with type annotations.
class CustomMapLabel extends google.maps.OverlayView {
    private position: any;
    private containerDiv: HTMLDivElement;
    private onAddCb: (container: HTMLDivElement) => void;
    private onRemoveCb: () => void;

    constructor(position: any, onAddCb: (container: HTMLDivElement) => void, onRemoveCb: () => void) {
        super();
        this.position = position;
        this.containerDiv = document.createElement('div');
        this.containerDiv.style.position = 'absolute';
        this.onAddCb = onAddCb;
        this.onRemoveCb = onRemoveCb;
    }

    onAdd() {
        this.getPanes()?.floatPane?.appendChild(this.containerDiv);
        this.onAddCb(this.containerDiv);
    }

    onRemove() {
        if (this.containerDiv.parentNode) {
            this.containerDiv.parentNode.removeChild(this.containerDiv);
        }
        this.onRemoveCb();
    }

    draw() {
        const projection = this.getProjection();
        if (!projection) {
            return;
        }
        const point = projection.fromLatLngToDivPixel(this.position);
        if (point) {
            this.containerDiv.style.left = `${point.x}px`;
            this.containerDiv.style.top = `${point.y}px`;
        }
    }
    
    updatePosition(position: any) {
        this.position = position;
        this.draw();
    }
}


interface MapLabelProps {
    map: any;
    position: any;
    text: string;
}

const MapLabel: React.FC<MapLabelProps> = ({ map, position, text }) => {
    const overlayRef = useRef<CustomMapLabel | null>(null);
    const portalContainerRef = useRef<HTMLDivElement | null>(null);
    const [isMounted, setIsMounted] = React.useState(false);

    useEffect(() => {
        if (map) {
            const onAdd = (container: HTMLDivElement) => {
                portalContainerRef.current = container;
                setIsMounted(true);
            };
            const onRemove = () => {
                portalContainerRef.current = null;
                setIsMounted(false);
            };

            const overlay = new CustomMapLabel(position, onAdd, onRemove);
            overlay.setMap(map);
            overlayRef.current = overlay;

            return () => {
                overlayRef.current?.setMap(null);
                overlayRef.current = null;
            };
        }
    }, [map]);
    
    useEffect(() => {
        if (overlayRef.current) {
            overlayRef.current.updatePosition(position);
        }
    }, [position]);

    if (!isMounted || !portalContainerRef.current) {
        return null;
    }

    return createPortal(
        <div style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            <div className="px-2 py-0.5 bg-slate-800/70 text-white text-xs font-semibold rounded-md backdrop-blur-sm shadow-md whitespace-nowrap">
                {text}
            </div>
        </div>,
        portalContainerRef.current
    );
};


// --- Main Canvas Component ---
interface MapCanvasProps {
    projectData: ProjectData;
    shapes: PlanShape[];
    selectedShapeIds: string[];
    onAddShape: (shape: Omit<PlanShape, 'id'>) => void;
    onUpdateShapes: (shapes: (Partial<PlanShape> & { id: string })[]) => void;
    onInteractionEnd: (shapes: PlanShape[]) => void;
    onSelectShape: (id: string | null, multi: boolean) => void;
    activeTool: PlannerTool;
    onSetTool: (tool: PlannerTool) => void;
    showLabels: boolean;
    showPois: boolean;
    proximityAnalysis: ProximityItem[] | null | undefined;
    viewMode?: '2d' | '3d'; // Add viewMode prop to detect when switching back to 2D
}

const MapCanvasComponent: React.ForwardRefRenderFunction<HTMLDivElement, MapCanvasProps> = (props, ref) => {
    const {
        projectData, shapes, selectedShapeIds, onAddShape, onUpdateShapes, onInteractionEnd, onSelectShape, activeTool, onSetTool, showLabels, showPois, proximityAnalysis, viewMode
    } = props;
    
    const [map, setMap] = useState<any | null>(null);
    const [drawingManager, setDrawingManager] = useState<any | null>(null);
    const [mapShapes, setMapShapes] = useState<Map<string, any>>(new Map());
    const [activePoi, setActivePoi] = useState<ProximityItem | null>(null);
    const poiMarkersRef = useRef<any[]>([]);
    
    // Use a ref to store the latest shapes array to prevent stale closures in event listeners
    const shapesRef = useRef(shapes);
    useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    const origin = useMemo(() => {
        if (!projectData.location?.boundary) return null;
        const { boundary } = projectData.location;
        const minLat = Math.min(...boundary.map(p => p.lat));
        const minLng = Math.min(...boundary.map(p => p.lng));
        return { lat: minLat, lng: minLng };
    }, [projectData.location?.boundary]);

    // Convert a LatLng to signed meters relative to `origin`.
    // Returns { x: eastMeters, y: northMeters } where east and north can be negative.
    const latLngToMeters = useCallback((latLng: any) => {
        if (!origin) return { x: 0, y: 0 };
        const pointLat = latLng.lat();
        const pointLng = latLng.lng();
        const originLat = origin.lat;
        const originLng = origin.lng;

        // unsigned distances
        const absY = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(originLat, originLng),
            new google.maps.LatLng(pointLat, originLng)
        );
        const absX = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(pointLat, originLng),
            new google.maps.LatLng(pointLat, pointLng)
        );

        // apply sign based on coordinate differences (east positive, north positive)
        const signedX = (pointLng - originLng) >= 0 ? absX : -absX;
        const signedY = (pointLat - originLat) >= 0 ? absY : -absY;

        return { x: signedX, y: signedY };
    }, [origin]);

    // Convert meters (signed) back to LatLng. `point.y` is northMeters, `point.x` is eastMeters.
    const metersToLatLng = useCallback((point: {x: number, y: number}) => {
        if (!origin) return new google.maps.LatLng(0, 0);
        const originLatLng = new google.maps.LatLng(origin.lat, origin.lng);

        // Move north/south depending on sign of y (0 = north, 180 = south)
        const latHeading = point.y >= 0 ? 0 : 180;
        const latOffset = google.maps.geometry.spherical.computeOffset(originLatLng, Math.abs(point.y), latHeading);

        // Move east/west depending on sign of x (90 = east, 270 = west)
        const lngHeading = point.x >= 0 ? 90 : 270;
        return google.maps.geometry.spherical.computeOffset(latOffset, Math.abs(point.x), lngHeading);
    }, [origin]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!map || !(ref && 'current' in ref && ref.current)) return;
    
        try {
            const item = JSON.parse(e.dataTransfer.getData('application/json'));
    
            const mapContainer = ref.current;
            if (!mapContainer) return;
            const rect = mapContainer.getBoundingClientRect();
            
            const pixelX = e.clientX - rect.left;
            const pixelY = e.clientY - rect.top;
    
            const overlay = new google.maps.OverlayView();
            overlay.setMap(map);
            overlay.draw = function() {};
            
            const latLng = overlay.getProjection().fromContainerPixelToLatLng(new google.maps.Point(pixelX, pixelY));
            overlay.setMap(null);
            
            if (!latLng) return;
    
            const meters = latLngToMeters(latLng);
    
            const x_origin = meters.x - item.width / 2;
            const y_origin = meters.y - item.height / 2;
            
            let points;
            if (item.type === 'circle') {
                // Convert dropped circle to a polygon approximation for consistent handling
                const centerX = x_origin + item.width / 2;
                const centerY = y_origin + item.height / 2;
                const radius = item.width / 2;
                points = [];
                for (let i = 0; i < 32; i++) { // Increase points for smoother circle
                    const angle = (i / 32) * 2 * Math.PI;
                    points.push({
                        x: centerX + radius * Math.cos(angle),
                        y: centerY + radius * Math.sin(angle),
                    });
                }
            } else { // rect
                points = [
                    { x: x_origin, y: y_origin },
                    { x: x_origin + item.width, y: y_origin },
                    { x: x_origin + item.width, y: y_origin + item.height },
                    { x: x_origin, y: y_origin + item.height },
                ];
            }
    
            const newShape: Omit<PlanShape, 'id'> = {
                ...item,
                x: x_origin,
                y: y_origin,
                points: points,
                type: 'polygon', // All shapes are polygons internally
                rotation: 0,
                fill: item.color || item.fill || '#374151', // Map color to fill, fallback to gray
            };
            
            onAddShape(newShape);
    
        } catch (error) {
            console.error('Failed to handle drop:', error);
        }
    }, [map, latLngToMeters, onAddShape, ref]);
    
    useEffect(() => {
        if (!map && ref && 'current' in ref && ref.current && projectData.location) {
            const bounds = new google.maps.LatLngBounds();
            projectData.location.boundary?.forEach(p => bounds.extend(p));
            
            const mapInstance = new google.maps.Map(ref.current, {
                center: bounds.getCenter(),
                zoom: 17,
                disableDefaultUI: true,
                mapTypeId: 'styled_map',
                tilt: 0,
            });
            mapInstance.fitBounds(bounds);
            
            const styledMapType = new google.maps.StyledMapType(lightMapStyle, { name: "Styled Map" });
            mapInstance.mapTypes.set("styled_map", styledMapType);

            setMap(mapInstance);

            new google.maps.Polygon({
                paths: projectData.location.boundary,
                strokeColor: '#0f766e',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#14b8a6',
                fillOpacity: 0.05,
                map: mapInstance,
                clickable: false,
            });
            
             const dm = new google.maps.drawing.DrawingManager({
                drawingMode: null,
                drawingControl: false,
                polygonOptions: {
                    fillColor: '#e7e5e4', // Default light gray
                    fillOpacity: 0.7,
                    strokeWeight: 2,
                    strokeColor: '#1f2937',
                    clickable: true,
                    editable: true,
                    draggable: true,
                    zIndex: 2, // Ensure drawn shapes are above setback
                },
            });
            dm.setMap(mapInstance);
            setDrawingManager(dm);
        }
    }, [map, projectData.location, ref]);
    
    // Refit bounds when switching back to 2D view
    useEffect(() => {
        if (map && viewMode === '2d' && projectData.location?.boundary) {
            // Small delay to ensure map is fully rendered
            setTimeout(() => {
                const bounds = new google.maps.LatLngBounds();
                projectData.location.boundary?.forEach(p => bounds.extend(p));
                map.fitBounds(bounds);
            }, 100);
        }
    }, [map, viewMode, projectData.location?.boundary]);
    
    useEffect(() => {
        if (!drawingManager) return;
        if (activeTool === 'draw-polygon') {
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        } else if (activeTool === 'draw-circle') {
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.CIRCLE);
        } else {
            drawingManager.setDrawingMode(null);
        }
    }, [activeTool, drawingManager]);

    useEffect(() => {
        if (!drawingManager) return;
        const listener = google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
            let path;
            if (event.type === google.maps.drawing.OverlayType.CIRCLE) {
                 const center = event.overlay.getCenter();
                 const radius = event.overlay.getRadius();
                 path = [];
                 for(let i=0; i<360; i+=11){ // ~32 points
                     path.push(google.maps.geometry.spherical.computeOffset(center, radius, i));
                 }
            } else { // Polygon
                path = event.overlay.getPath().getArray();
            }

            const meterPoints = path.map((p: any) => latLngToMeters(p));
            const { minX, minY, maxX, maxY } = getBoundingBox(meterPoints);
            
            onAddShape({
                type: 'polygon',
                points: meterPoints,
                x: minX, y: minY, width: maxX - minX, height: maxY - minY,
                rotation: 0,
                fill: '#e7e5e4', // Default light gray
                label: 'Custom Area',
                category: 'Custom',
                floors: 0, // No 3D extrusion for custom drawn polygons
                floorHeight: 0, // Flat boundary/area marker
            });

            event.overlay.setMap(null);
            onSetTool('select');
        });
        return () => google.maps.event.removeListener(listener);
    }, [drawingManager, onAddShape, latLngToMeters, onSetTool]);

    // Main sync effect for shapes <-> map
    useEffect(() => {
        if (!map || !origin) return;

        const shapesToOffset = shapes.filter(s => s.isOffsetBoundary && s.offsets && s.offsets.length > 0);
        if (shapesToOffset.length > 0 && projectData.location?.boundary) {
          const updates: (Partial<PlanShape> & { id: string })[] = [];
          shapesToOffset.forEach(shape => {
            const boundary = projectData.location!.boundary!;
            // Convert boundary to local meters
            const boundaryMeters = boundary.map(p => latLngToMeters(new google.maps.LatLng(p.lat, p.lng)));
            const ccw = ensurePolygonWinding(boundaryMeters);

            // Determine even vs per-side offsets
            const offs = shape.offsets || [];
            const allEqual = offs.every(v => v === offs[0]);
            let inset: { x: number; y: number }[] = ccw;
            if (allEqual) {
                const d = Math.max(0, offs[0] || 0);
                inset = offsetPolygonUniform(ccw, d);
            } else {
                inset = offsetPolygonPerEdge(ccw, offs.map(v => Math.max(0, v)));
            }

            const newMeterPoints = inset;
            const { minX, minY, maxX, maxY } = getBoundingBox(newMeterPoints);
            
            updates.push({
                id: shape.id,
                points: newMeterPoints,
                x: minX, y: minY, width: maxX - minX, height: maxY - minY,
                isOffsetBoundary: false,
            });
          });
          onUpdateShapes(updates);
          return;
        }
    
        const newMapShapes = new Map(mapShapes);
        const currentShapeIds = new Set(shapes.map(s => s.id));
        
        // Filter out hidden shapes
        const visibleShapes = shapes.filter(s => s.visible !== false);
    
        visibleShapes.forEach(shape => {
            const isSelected = selectedShapeIds.includes(shape.id);
            let mapShape: any = newMapShapes.get(shape.id);

            let finalPoints = shape.points || [];
            if (shape.rotation && shape.rotation !== 0 && finalPoints.length > 0) {
                const { minX, minY, maxX, maxY } = getBoundingBox(finalPoints);
                const center = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
                finalPoints = finalPoints.map(p => rotatePoint(p, center, shape.rotation));
            }
    
            let path = (finalPoints.length > 0) ? finalPoints.map(p => metersToLatLng({ x: p.x, y: p.y })) : [];
    
            const options = {
                paths: path,
                fillColor: shape.fill,
                fillOpacity: isSelected ? 0.9 : (shape.fillOpacity ?? 0.7),
                strokeColor: isSelected ? '#0f766e' : (shape.stroke ?? '#1f2937'),
                strokeWeight: isSelected ? 3 : 1.5,
                strokeDasharray: shape.strokeDasharray,
                editable: isSelected && activeTool === 'select',
                draggable: isSelected && activeTool === 'select',
                zIndex: shape.category === 'Setback' ? 1 : (isSelected ? 10 : 2)
            };
    
            if (mapShape) {
                mapShape.setOptions(options);
            } else {
                mapShape = new google.maps.Polygon(options);
                mapShape.setMap(map);
                newMapShapes.set(shape.id, mapShape);
    
                mapShape.addListener('click', (e: any) => {
                    e.stop();
                    onSelectShape(shape.id, e.domEvent.shiftKey);
                });
    
                let hasVertexChanged = false;
                let dragStartPosition: {x: number, y: number} | null = null;

                // Capture the initial position when drag starts
                mapShape.addListener('dragstart', () => {
                    const currentPath = mapShape.getPath().getArray();
                    const meterPoints = currentPath.map((p: any) => latLngToMeters(p));
                    const { minX, minY } = getBoundingBox(meterPoints);
                    dragStartPosition = { x: minX, y: minY };
                });

                const createUpdateHandler = (isFinal: boolean) => () => {
                    const allShapesNow = shapesRef.current;
                    const currentShape = allShapesNow.find(s => s.id === shape.id);
                    if (!currentShape) return;

                    const newPath = mapShape.getPath().getArray();
                    const newMeterPoints = newPath.map((p: any) => latLngToMeters(p));
                    
                    let basePoints;
                    const shapeRotation = currentShape.rotation || 0;

                    if (shapeRotation !== 0) {
                        const { minX, minY, maxX, maxY } = getBoundingBox(newMeterPoints);
                        const center = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
                        basePoints = newMeterPoints.map(p => rotatePoint(p, center, -shapeRotation));
                    } else {
                        basePoints = newMeterPoints;
                    }

                    const { minX, minY, maxX, maxY } = getBoundingBox(basePoints);
                    
                    // Calculate drag delta if this is a drag operation
                    let deltaX = 0;
                    let deltaY = 0;
                    if (dragStartPosition) {
                        deltaX = minX - dragStartPosition.x;
                        deltaY = minY - dragStartPosition.y;
                    }

                    // Build updates array - include all selected shapes if dragging
                    const updates: (Partial<PlanShape> & { id: string })[] = [];
                    
                    if (dragStartPosition && selectedShapeIds.length > 1 && selectedShapeIds.includes(shape.id)) {
                        // Multi-select drag: move all selected shapes by the same delta
                        selectedShapeIds.forEach(selectedId => {
                            const selectedShape = allShapesNow.find(s => s.id === selectedId);
                            if (!selectedShape) return;
                            
                            if (selectedId === shape.id) {
                                // The dragged shape
                                updates.push({
                                    id: shape.id,
                                    points: basePoints,
                                    x: minX,
                                    y: minY,
                                    width: maxX - minX,
                                    height: maxY - minY
                                });
                            } else {
                                // Other selected shapes - apply delta
                                const newPoints = selectedShape.points?.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
                                const newBbox = newPoints ? getBoundingBox(newPoints) : {
                                    minX: selectedShape.x + deltaX,
                                    minY: selectedShape.y + deltaY,
                                    maxX: selectedShape.x + deltaX + selectedShape.width,
                                    maxY: selectedShape.y + deltaY + selectedShape.height
                                };
                                updates.push({
                                    id: selectedId,
                                    points: newPoints,
                                    x: newBbox.minX,
                                    y: newBbox.minY,
                                    width: newBbox.maxX - newBbox.minX,
                                    height: newBbox.maxY - newBbox.minY
                                });
                            }
                        });
                    } else {
                        // Single shape update (vertex editing or single selection drag)
                        updates.push({
                            id: shape.id,
                            points: basePoints,
                            x: minX,
                            y: minY,
                            width: maxX - minX,
                            height: maxY - minY
                        });
                    }

                    onUpdateShapes(updates);

                    if (isFinal) {
                        dragStartPosition = null; // Reset after drag ends
                        const finalShapesState = allShapesNow.map(s => {
                            const update = updates.find(u => u.id === s.id);
                            return update ? { ...s, ...update } : s;
                        });
                        setTimeout(() => onInteractionEnd(finalShapesState), 0);
                        hasVertexChanged = false;
                    }
                };

                const vertexUpdateHandler = () => {
                    hasVertexChanged = true;
                    createUpdateHandler(false)();
                };
                const finalUpdateHandler = createUpdateHandler(true);

                mapShape.addListener('dragend', finalUpdateHandler);
                mapShape.getPath().addListener('set_at', vertexUpdateHandler);
                mapShape.getPath().addListener('insert_at', vertexUpdateHandler);
                mapShape.addListener('mouseup', () => {
                    if (hasVertexChanged) {
                        finalUpdateHandler();
                    }
                });

                // Also handle dragend to ensure drag operations are finalized
                mapShape.addListener('dragend', () => {
                    finalUpdateHandler();
                });
            }
        });
    
        for (const [id, mapShape] of newMapShapes.entries()) {
            if (!currentShapeIds.has(id)) {
                google.maps.event.clearInstanceListeners(mapShape);
                (mapShape as any).setMap(null);
                newMapShapes.delete(id);
            }
        }
    
        setMapShapes(newMapShapes);
    
    }, [shapes, selectedShapeIds, map, activeTool, origin, projectData.location, onSelectShape, onUpdateShapes, onInteractionEnd, latLngToMeters, metersToLatLng]);

    
    // Effect for handling POI layer
    useEffect(() => {
        const cleanup = () => {
            poiMarkersRef.current.forEach(marker => marker.setMap(null));
            poiMarkersRef.current = [];
        };

        if (!showPois || !map || !proximityAnalysis || proximityAnalysis.length === 0) {
            cleanup();
            setActivePoi(null);
            return;
        }

        cleanup();

        proximityAnalysis.forEach(poi => {
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
    }, [showPois, map, proximityAnalysis]);

    const labelsToRender = useMemo(() => {
        if (!showLabels || shapes.length === 0 || !map) return [];
        
        return shapes
            .filter(shape => shape.label && shape.points && shape.points.length > 0)
            .map(shape => {
                let finalPoints = shape.points!;
                if (shape.rotation && shape.rotation !== 0) {
                    const { minX, minY, maxX, maxY } = getBoundingBox(finalPoints);
                    const center = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
                    finalPoints = finalPoints.map(p => rotatePoint(p, center, shape.rotation));
                }
                const bounds = new google.maps.LatLngBounds();
                finalPoints.map(p => metersToLatLng(p)).forEach(p => bounds.extend(p));
                
                return {
                    id: shape.id,
                    text: shape.label,
                    position: bounds.getCenter()
                };
            });
    }, [shapes, showLabels, metersToLatLng, map]);

    return (
        <div className="w-full h-full relative">
            <div ref={ref} className="w-full h-full" onDragOver={handleDragOver} onDrop={handleDrop} />
            <CustomMapControl map={map} />
            {labelsToRender.map(label => (
                <MapLabel
                    key={label.id}
                    map={map}
                    position={label.position}
                    text={label.text}
                />
            ))}
            <CustomInfoWindow map={map} poi={activePoi} onClose={() => setActivePoi(null)} />
        </div>
    );
};

export const MapCanvas = forwardRef(MapCanvasComponent);