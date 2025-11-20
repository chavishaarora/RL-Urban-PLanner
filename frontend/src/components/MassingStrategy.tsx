import React, { useState, useEffect, useMemo, Suspense, useCallback, useRef, useLayoutEffect } from 'react';
// FIX: Add type import and augment JSX namespace for react-three-fiber elements
import { Canvas, useThree, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { ProjectData, PlanShape } from '../types';

// FIX: Augment the JSX namespace to include react-three-fiber's custom elements.
// This resolves errors where TypeScript doesn't recognize tags like <group>, <mesh>, etc.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: ThreeElements['group'];
      mesh: ThreeElements['mesh'];
      meshStandardMaterial: ThreeElements['meshStandardMaterial'];
      lineSegments: ThreeElements['lineSegments'];
      edgesGeometry: ThreeElements['edgesGeometry'];
      lineBasicMaterial: ThreeElements['lineBasicMaterial'];
      color: ThreeElements['color'];
      ambientLight: ThreeElements['ambientLight'];
      directionalLight: ThreeElements['directionalLight'];
      shadowMaterial: ThreeElements['shadowMaterial'];
    }
  }
}


// Helper function to calculate distance in meters from latitude/longitude
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};


// --- Sub-components ---

// A custom-built properties panel
const PropertiesEditor: React.FC<{
    selectedShape: PlanShape | null;
    onUpdate: (id: string, update: Partial<PlanShape>) => void;
}> = ({ selectedShape, onUpdate }) => {
    if (!selectedShape) return null;

    const handleFloorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(selectedShape.id, { floors: parseInt(e.target.value, 10) });
    };

    const handleFloorHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(selectedShape.id, { floorHeight: parseFloat(e.target.value) });
    };

    const totalHeight = ((selectedShape.floors ?? 1) * (selectedShape.floorHeight ?? 3.5)).toFixed(1);

    return (
        <div className="card p-4 space-y-4 bg-white/80 backdrop-blur-sm">
            <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2">{selectedShape.label}</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Floors</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="1" max="50" step="1"
                            value={selectedShape.floors ?? 1}
                            onChange={handleFloorsChange}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <input
                            type="number"
                            min="1" max="50"
                            value={selectedShape.floors ?? 1}
                            onChange={handleFloorsChange}
                            className="w-20 p-1 form-input !rounded-md text-center"
                        />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Floor Height (m)</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0.01" max="10" step="0.01"
                            value={selectedShape.floorHeight ?? 3.5}
                            onChange={handleFloorHeightChange}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <input
                            type="number"
                            min="0.01" max="10" step="0.01"
                            value={(selectedShape.floorHeight ?? 3.5).toFixed(2)}
                            onChange={handleFloorHeightChange}
                            className="w-20 p-1 form-input !rounded-md text-center"
                        />
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-200 pt-3 mt-3">
                <div className="flex justify-between items-baseline">
                    <p className="text-sm font-medium text-slate-600">Total Height</p>
                    <p className="text-2xl font-bold text-teal-600">{totalHeight} m</p>
                </div>
            </div>
        </div>
    );
};


// A single 3D massing block
const MassingBlock: React.FC<{
    shape: PlanShape;
    siteWidth: number;
    siteHeight: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, update: Partial<PlanShape>) => void;
}> = ({ shape, siteWidth, siteHeight, isSelected, onSelect, onUpdate }) => {
    const { floors = 1, floorHeight = 3.5 } = shape;
    const totalHeight = floors * floorHeight;

    const position = useMemo<[number, number, number]>(() => [
        shape.x + shape.width / 2 - siteWidth / 2,
        0, // Position on the ground plane, height is handled by geometry
        shape.y + shape.height / 2 - siteHeight / 2,
    ], [shape, siteWidth, siteHeight]);

    const rotation = useMemo<[number, number, number]>(() => [0, -shape.rotation * (Math.PI / 180), 0], [shape.rotation]);
    
    const geometry = useMemo(() => {
        try {
            if (shape.type === 'circle') {
                const geo = new THREE.CylinderGeometry(shape.width / 2, shape.width / 2, totalHeight, 32);
                geo.translate(0, totalHeight / 2, 0);
                return geo;
            }
            if (shape.type === 'polygon' && shape.points && shape.points.length > 2) {
                const polyShape = new THREE.Shape();
                // Move points to be relative to the shape's center (0,0) and flip Y axis
                polyShape.moveTo(shape.points[0].x - shape.width / 2, -(shape.points[0].y - shape.height / 2));
                for (let i = 1; i < shape.points.length; i++) {
                    polyShape.lineTo(shape.points[i].x - shape.width / 2, -(shape.points[i].y - shape.height / 2));
                }
                polyShape.closePath();
                
                const extrudeSettings = { depth: totalHeight, bevelEnabled: false };
                const geo = new THREE.ExtrudeGeometry(polyShape, extrudeSettings);
                // The extrusion happens along Z, but we want it along Y.
                // Rotate it to be upright on the XZ plane.
                geo.rotateX(-Math.PI / 2); 
                // Then translate its base to y=0.
                geo.translate(0, totalHeight, 0);
                return geo;
            }
            // 'rect'
            const geo = new THREE.BoxGeometry(shape.width, totalHeight, shape.height);
            geo.translate(0, totalHeight / 2, 0); // Move its base to y=0
            return geo;
        } catch (error) {
            console.error("Failed to create geometry for shape:", shape, error);
            return null; // Return null on error
        }
    }, [shape, totalHeight]);


    const handlePull = useCallback((e: any) => {
        e.stopPropagation();
        const startDragY = e.clientY;
        const startFloors = floors;

        const onPointerMove = (moveEvent: PointerEvent) => {
            const deltaY = startDragY - moveEvent.clientY;
            const floorChange = Math.round(deltaY / 20); // Adjust sensitivity
            const newFloors = Math.max(1, startFloors + floorChange);
            if (newFloors !== (shape.floors || 1)) {
                onUpdate(shape.id, { floors: newFloors });
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
        
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [floors, shape.id, shape.floors, onUpdate]);

    if (!geometry) return null; // Don't render if geometry failed

    return (
        <group position={position} rotation={rotation}>
            <mesh
                geometry={geometry}
                onClick={(e) => { e.stopPropagation(); onSelect(shape.id); }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; }}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={isSelected ? '#14b8a6' : '#e2e8f0'} transparent opacity={0.95} />
            </mesh>
            <lineSegments>
                <edgesGeometry attach="geometry" args={[geometry]} />
                <lineBasicMaterial attach="material" color={isSelected ? '#0f766e' : '#94a3b8'} />
            </lineSegments>
            {isSelected && (
                 <Html position={[0, totalHeight + 2, 0]}>
                     <div
                         onPointerDown={handlePull}
                         className="w-4 h-4 bg-teal-500 rounded-full cursor-ns-resize hover:bg-teal-400"
                         style={{
                             boxShadow: '0 0 10px rgba(20, 184, 166, 0.7)',
                             transform: 'translate(-50%, -50%)',
                         }}
                         title="Drag to change floors"
                     />
                 </Html>
            )}
        </group>
    );
};

const SiteBoundary: React.FC<{ boundary: { lat: number, lng: number }[], siteWidth: number, siteHeight: number }> = ({ boundary, siteWidth, siteHeight }) => {
    const points = useMemo(() => {
        if (!boundary) return [];
        const coords = boundary.map(p => ({ x: p.lng, y: p.lat }));
        const minLng = Math.min(...coords.map(c => c.x));
        const minLat = Math.min(...coords.map(c => c.y));

        return coords.map(c => {
            const x = getDistanceInMeters(minLat, minLng, minLat, c.x) - siteWidth / 2;
            const z = getDistanceInMeters(minLat, minLng, c.y, minLng) - siteHeight / 2;
            return new THREE.Vector3(x, 0.1, -z); // Flip Z to match canvas coordinates
        });
    }, [boundary, siteWidth, siteHeight]);
    
    if (points.length === 0) return null;

    return <Line points={[...points, points[0]]} color="#0f766e" lineWidth={3} />;
};

const CameraFitter: React.FC<{ sceneRef: React.RefObject<THREE.Group>, shapes: PlanShape[] }> = ({ sceneRef, shapes }) => {
    const { camera, controls } = useThree();

    useLayoutEffect(() => {
        if (sceneRef.current) {
            const box = new THREE.Box3().setFromObject(sceneRef.current);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            if (size.x === 0 && size.y === 0 && size.z === 0) return;

            const maxSize = Math.max(size.x, size.z); // Base on XZ plane
            const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
            const fitWidthDistance = fitHeightDistance / camera.aspect;
            const distance = 1.5 * Math.max(fitHeightDistance, fitWidthDistance);

            if (controls) {
                (controls as any).maxDistance = distance * 10;
                (controls as any).target.copy(center);
            }
            
            camera.near = distance / 100;
            camera.far = distance * 100;
            camera.position.set(center.x + distance * 0.8, center.y + distance, center.z + distance * 0.8);
            camera.lookAt(center);
            
            camera.updateProjectionMatrix();
            if (controls) {
                (controls as any).update();
            }
        }
    }, [sceneRef, camera, controls, shapes]); // Re-run when shapes change

    return null;
}

const MassingScene: React.FC<{
    shapes: PlanShape[];
    siteBoundary: { lat: number, lng: number }[] | undefined;
    siteWidth: number;
    siteHeight: number;
    selectedShapeId: string | null;
    onSelectShape: (id: string) => void;
    onUpdateShape: (id: string, update: Partial<PlanShape>) => void;
}> = ({ shapes, siteBoundary, siteWidth, siteHeight, selectedShapeId, onSelectShape, onUpdateShape }) => {
    
    const sceneRef = useRef<THREE.Group>(null);

    return (
        <>
            <color attach="background" args={['#f8fafc']} />
            <ambientLight intensity={1.5} />
            <directionalLight
                position={[siteWidth * 0.5, Math.max(siteWidth, siteHeight) * 2, siteHeight * 0.5]}
                intensity={2.5}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
            
            <Plane args={[siteWidth * 5, siteHeight * 5]} rotation-x={-Math.PI / 2} receiveShadow>
                <shadowMaterial transparent opacity={0.2} />
            </Plane>
            
            <group ref={sceneRef}>
                {siteBoundary && <SiteBoundary boundary={siteBoundary} siteWidth={siteWidth} siteHeight={siteHeight} />}

                {shapes.map(shape => (
                    <MassingBlock
                        key={shape.id}
                        shape={shape}
                        siteWidth={siteWidth}
                        siteHeight={siteHeight}
                        isSelected={selectedShapeId === shape.id}
                        onSelect={onSelectShape}
                        onUpdate={onUpdateShape}
                    />
                ))}
            </group>

            <Grid
                position={[0, 0.05, 0]}
                args={[1000, 1000]}
                cellSize={10}
                cellThickness={1}
                cellColor={'#e2e8f0'}
                sectionSize={50}
                sectionThickness={1.5}
                sectionColor={'#cbd5e1'}
                fadeDistance={Math.max(siteWidth, siteHeight) * 4}
                infiniteGrid
            />
            <OrbitControls makeDefault minDistance={20} maxDistance={Math.max(siteWidth, siteHeight) * 3} />
            <CameraFitter sceneRef={sceneRef} shapes={shapes} />
        </>
    );
};

// --- Main Component ---
export interface MassingStrategyProps {
    projectData: ProjectData;
    onClose: () => void;
    onUpdateShapes: (shapes: PlanShape[]) => void;
}

export const MassingStrategy: React.FC<MassingStrategyProps> = ({ projectData, onClose, onUpdateShapes }) => {
    const [internalShapes, setInternalShapes] = useState<PlanShape[]>([]);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

    useEffect(() => {
        const initialShapes = projectData.conceptualPlan?.shapes.map(s => ({
            ...s,
            floors: s.floors || 1,
            floorHeight: s.floorHeight || 3.5,
        })) || [];
        setInternalShapes(initialShapes);
    }, [projectData.conceptualPlan]);

    const { siteWidth, siteHeight } = useMemo(() => {
        if (!projectData.location?.boundary || projectData.location.boundary.length < 3) return { siteWidth: 100, siteHeight: 100 };
        
        const coords = projectData.location.boundary.map(p => ({ x: p.lng, y: p.lat }));
        const minLng = Math.min(...coords.map(c => c.x));
        const maxLng = Math.max(...coords.map(c => c.x));
        const minLat = Math.min(...coords.map(c => c.y));
        const maxLat = Math.max(...coords.map(c => c.y));

        const width = getDistanceInMeters(minLat, minLng, minLat, maxLng);
        const height = getDistanceInMeters(minLat, minLng, maxLat, minLng);
        
        return { siteWidth: width > 0 ? width : 100, siteHeight: height > 0 ? height : 100 };
    }, [projectData.location?.boundary]);

    const handleUpdateShape = useCallback((id: string, update: Partial<PlanShape>) => {
        setInternalShapes(currentShapes =>
            currentShapes.map(s => (s.id === id ? { ...s, ...update } : s))
        );
    }, []);

    const handleClose = () => {
        onUpdateShapes(internalShapes);
        onClose();
    };

    const selectedShape = useMemo(() => internalShapes.find(s => s.id === selectedShapeId) || null, [internalShapes, selectedShapeId]);

    return (
        <div className="w-full h-[calc(100vh-68px)] flex flex-col bg-slate-100 animate-fade-in relative overflow-hidden">
            <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm z-20">
                <h1 className="text-xl font-bold text-slate-800">3D Massing Strategy</h1>
                <button onClick={handleClose} className="btn btn-secondary">Save & Back to Dashboard</button>
            </header>
            
            <div className="flex-grow w-full h-full relative">
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><p>Loading 3D View...</p></div>}>
                    <Canvas
                        shadows
                        camera={{ fov: 50, near: 1, far: Math.max(siteWidth, siteHeight) * 10 }}
                        onClick={() => setSelectedShapeId(null)}
                    >
                        <MassingScene 
                            shapes={internalShapes}
                            siteBoundary={projectData.location?.boundary}
                            siteWidth={siteWidth}
                            siteHeight={siteHeight}
                            selectedShapeId={selectedShapeId}
                            onSelectShape={setSelectedShapeId}
                            onUpdateShape={handleUpdateShape}
                        />
                    </Canvas>
                </Suspense>
            </div>
            
            <div className={`absolute top-24 right-4 w-80 z-20 transition-all duration-300 ${selectedShape ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                <PropertiesEditor selectedShape={selectedShape} onUpdate={handleUpdateShape} />
            </div>
        </div>
    );
};
