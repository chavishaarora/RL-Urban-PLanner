const initialState: PlannerState = {
    shapes: [],
    selectedShapeIds: [],
    history: [[]],
    historyIndex: 0,
    clipboard: [],
};
import React, { useReducer, useCallback, useRef, useEffect, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { ProjectData, ConceptualPlan, PlanShape, LayoutModule, CostEstimate, ProximityItem } from '../types';
import { Toolbox } from './planner/Toolbox';
import { PropertiesPanel } from './planner/PropertiesPanel';
import { MapCanvas } from './planner/MapCanvas';
import { Viewer3D } from './planner/Viewer3D';
import { SaveIcon } from './planner/PlannerIcons';
import PageHeader from './PageHeader';
import { ConceptIcon } from './Icons';
import { LayoutGenerator } from './planner/LayoutGenerator';
import { generateConceptualPlanCostEstimate } from '@/services/geminiService-1';
import { exportToOBJ, downloadOBJ, exportUserContentOnly, exportCompleteScene } from '@/utils/OBJExporter';
import { exportToGLTF, downloadGLTF } from '@/utils/GLTFExporter';
import * as THREE from 'three';

// STATE MANAGEMENT
type PlannerState = {
    shapes: PlanShape[];
    selectedShapeIds: string[];
    history: PlanShape[][];
    historyIndex: number;
    clipboard: Omit<PlanShape, 'id'>[];
};

type Action =
    | { type: 'ADD_SHAPE'; payload: Omit<PlanShape, 'id'> }
    | { type: 'REPLACE_AND_SELECT_SHAPES'; payload: { shapesToAdd: PlanShape[] } }
    | { type: 'UPDATE_SHAPES'; payload: (Partial<PlanShape> & { id: string })[] }
    | { type: 'FINALIZE_UPDATE'; payload: PlanShape[] }
    | { type: 'DELETE_SELECTION' }
    | { type: 'DUPLICATE_SELECTION' }
    | { type: 'SELECT_SHAPE'; payload: { id: string; multi: boolean } }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'SET_SHAPES'; payload: PlanShape[] }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'COPY_SELECTION' }
    | { type: 'PASTE_CLIPBOARD' };
const plannerReducer = (state: PlannerState, action: Action): PlannerState => {
    let newShapes = [...state.shapes];
    switch (action.type) {
        case 'ADD_SHAPE':
            newShapes.push({ ...action.payload, id: `shape_${Date.now()}` });
            break;
        case 'REPLACE_AND_SELECT_SHAPES': {
            const { shapesToAdd } = action.payload;
            // Keep only setback shapes, remove all others
            const setbackShapes = state.shapes.filter(s => s.category === 'Setback');
            const newShapes = [...setbackShapes, ...shapesToAdd];
            const newSelection = shapesToAdd.map(s => s.id);
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), newShapes];
            return {
                ...state,
                shapes: newShapes,
                selectedShapeIds: newSelection,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            };
        }
        case 'UPDATE_SHAPES':
            newShapes = newShapes.map(s => {
                const update = action.payload.find(u => u.id === s.id);
                return update ? { ...s, ...update } : s;
            });
            return { ...state, shapes: newShapes }; // No history for intermediate updates
        case 'FINALIZE_UPDATE': {
            const finalShapes = action.payload;
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), finalShapes];
            return {
              ...state,
              shapes: finalShapes,
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }
         case 'DELETE_SELECTION':
            newShapes = newShapes.filter(s => !state.selectedShapeIds.includes(s.id));
            return { ...state, shapes: newShapes, selectedShapeIds: [], history: [...state.history.slice(0, state.historyIndex + 1), newShapes], historyIndex: state.historyIndex + 1 };
        case 'DUPLICATE_SELECTION': {
            const shapesToDuplicate = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
            const newSelection: string[] = [];
            shapesToDuplicate.forEach(originalShape => {
                const newShape: PlanShape = {
                    ...originalShape,
                    id: `shape_${Date.now()}_${Math.random()}`,
                    x: originalShape.x + 10,
                    y: originalShape.y + 10,
                };
                newShapes.push(newShape);
                newSelection.push(newShape.id);
            });
            return { ...state, shapes: newShapes, selectedShapeIds: newSelection, history: [...state.history.slice(0, state.historyIndex + 1), newShapes], historyIndex: state.historyIndex + 1 };
        }
        case 'SELECT_SHAPE': {
            const { id, multi } = action.payload;
            let newSelection = [...state.selectedShapeIds];
            if (multi) {
                if (newSelection.includes(id)) {
                    newSelection = newSelection.filter(selectedId => selectedId !== id);
                } else {
                    newSelection.push(id);
                }
            } else {
                if (!(newSelection.length === 1 && newSelection[0] === id)) {
                     newSelection = [id];
                }
            }
            return { ...state, selectedShapeIds: newSelection };
        }
        case 'CLEAR_SELECTION':
            return { ...state, selectedShapeIds: [] };
        case 'SET_SHAPES':
             return { ...state, shapes: action.payload, history: [action.payload], historyIndex: 0, selectedShapeIds: [] };
        case 'UNDO':
            if (state.historyIndex > 0) {
                const newIndex = state.historyIndex - 1;
                return { ...state, historyIndex: newIndex, shapes: state.history[newIndex], selectedShapeIds: [] };
            }
            return state;
        case 'REDO':
             if (state.historyIndex < state.history.length - 1) {
                const newIndex = state.historyIndex + 1;
                return { ...state, historyIndex: newIndex, shapes: state.history[newIndex], selectedShapeIds: [] };
            }
            return state;
        case 'COPY_SELECTION': {
            const shapesToCopy = state.shapes
                .filter(s => state.selectedShapeIds.includes(s.id))
                .map(({ id, ...rest }) => rest); // copy without id
            return { ...state, clipboard: shapesToCopy };
        }
        case 'PASTE_CLIPBOARD': {
            if (state.clipboard.length === 0) return state;
            const newSelection: string[] = [];
            const pastedShapes = state.clipboard.map(s => {
                const newId = `shape_${Date.now()}_${Math.random()}`;
                newSelection.push(newId);
                return {
                    ...s,
                    id: newId,
                    x: s.x + 10,
                    y: s.y + 10,
                    points: s.points?.map(p => ({ x: p.x + 10, y: p.y + 10 }))
                };
            });
            newShapes.push(...pastedShapes);
            break;
        }
        default:
            return state;
    }
    
    // Add to history for actions that change shapes
    if (['ADD_SHAPE', 'PASTE_CLIPBOARD'].includes(action.type)) {
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), newShapes];
        return { ...state, shapes: newShapes, history: newHistory, historyIndex: newHistory.length - 1 };
    }
    return { ...state, shapes: newShapes };
};


// --- COMPONENT ---
interface ConceptualPlannerProps {
    projectData: ProjectData;
    onClose: () => void;
    onSave: (plan: ConceptualPlan) => void;
    onUpdateShapes: (shapes: PlanShape[]) => void;
    onCostUpdate: (estimate: CostEstimate | null) => void;
    showPois: boolean;
    onTogglePois: () => void;
    proximityAnalysis: ProximityItem[] | null | undefined;
}

export type PlannerTool = 'select' | 'draw-polygon' | 'draw-circle';
export type ViewMode = '2d' | '3d';

export const ConceptualPlanner: React.FC<ConceptualPlannerProps> = ({
    projectData,
    onClose,
    onSave,
    onUpdateShapes,
    onCostUpdate,
    showPois,
    onTogglePois,
    proximityAnalysis
}) => {

    const initializer = (project: ProjectData) => {
        const initialShapes = project.conceptualPlan?.shapes || [];
        return {
            ...initialState,
            shapes: initialShapes,
            history: [initialShapes],
            historyIndex: 0
        };
    };
    const [state, dispatch] = useReducer(plannerReducer, projectData, initializer);

    const { shapes, selectedShapeIds, history, historyIndex } = state;
    const [isToolboxOpen, setIsToolboxOpen] = React.useState(true);
    const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(true);
    const [activeTool, setActiveTool] = useState<PlannerTool>('select');
    const [boundaryOffsets, setBoundaryOffsets] = useState<number[]>([]);
    const [showLabels, setShowLabels] = useState(true);
    const [isLayoutGeneratorOpen, setIsLayoutGeneratorOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('2d');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [sceneRef, setSceneRef] = useState<THREE.Scene | null>(null);

    const mapCanvasRef = useRef<HTMLDivElement>(null);    // State for conceptual cost estimation
    const [conceptualCostEstimate, setConceptualCostEstimate] = useState<CostEstimate | null>(projectData.conceptualCostEstimate || null);
    const [isCostLoading, setIsCostLoading] = useState(false);
    const [costError, setCostError] = useState<string | null>(null);

    // Update parent state when shapes change
    useEffect(() => {
        onUpdateShapes(shapes);
    }, [shapes]); // Remove onUpdateShapes from deps to prevent infinite loop

     // Keyboard shortcuts
     useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;

            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                dispatch({ type: 'CLEAR_SELECTION' });
            }
            if (isCtrl && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                dispatch({ type: 'COPY_SELECTION' });
            }
            if (isCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                dispatch({ type: 'PASTE_CLIPBOARD' });
            }
            if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                dispatch({ type: 'UNDO' });
            }
            if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                dispatch({ type: 'REDO' });
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedShapeIds.length > 0) {
                    e.preventDefault();
                    dispatch({ type: 'DELETE_SELECTION' });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedShapeIds]);
    
    // Initialize/reset offsets when boundary changes.
    useEffect(() => {
        const numSegments = projectData.location?.boundary?.length ?? 0;
        setBoundaryOffsets(new Array(numSegments).fill(0));
    }, [projectData.location?.boundary]);
    
    const selectedShapes = useMemo(() => shapes.filter(s => selectedShapeIds.includes(s.id)), [shapes, selectedShapeIds]);

    const handleAddShape = useCallback((shape: Omit<PlanShape, 'id'>) => {
        dispatch({ type: 'ADD_SHAPE', payload: shape });
        setActiveTool('select');
    }, []);

    const handleUpdateShapes = useCallback((updates: (Partial<PlanShape> & { id: string })[]) => {
        dispatch({ type: 'UPDATE_SHAPES', payload: updates });
    }, []);
    
    const handleBulkUpdate = (updates: (Partial<PlanShape> & { id: string })[]) => {
        const newShapes = shapes.map(s => {
            const update = updates.find(u => u.id === s.id);
            return update ? { ...s, ...update } : s;
        });
        dispatch({ type: 'FINALIZE_UPDATE', payload: newShapes });
    };

    const handleInteractionEnd = useCallback((updatedShapes: PlanShape[]) => {
        dispatch({ type: 'FINALIZE_UPDATE', payload: updatedShapes });
    }, []);

    const handleSelectShape = useCallback((id: string | null, multi: boolean) => {
        if (id === null) {
            dispatch({ type: 'CLEAR_SELECTION' });
        } else {
            dispatch({ type: 'SELECT_SHAPE', payload: { id, multi } });
             if (!multi) {
                setActiveTool('select');
            }
        }
    }, []);
    
    const handleSetAllOffsets = (offset: number) => {
        if (offset >= 0) {
            setBoundaryOffsets(prev => prev.map(() => offset));
        }
    };

    const handleSetOffsetAt = (index: number, value: number) => {
        setBoundaryOffsets(prev => prev.map((o, i) => (i === index ? Math.max(0, value) : o)));
    };

    const handleCreateOffsetBoundary = useCallback(() => {
        const existingSetback = shapes.find(s => s.category === 'Setback');
        if (existingSetback) {
            alert("A setback boundary already exists. Please delete it first to create a new one.");
            return;
        }

        const siteBoundary = projectData.location?.boundary;
        if (!siteBoundary || siteBoundary.length < 3) {
            alert("A valid site boundary is required to create an offset.");
            return;
        }

        const newShape: Omit<PlanShape, 'id'> = {
            type: 'polygon',
            x: 0, y: 0, width: 0, height: 0, // Will be calculated by MapCanvas
            points: [], // Will be calculated by MapCanvas
            rotation: 0,
            fill: '#e0f2fe',
            fillOpacity: 0.5,
            stroke: '#38bdf8',
            strokeDasharray: '5 5',
            label: 'Setback',
            category: 'Setback',
            floors: 0,
            floorHeight: 0.01,
            isOffsetBoundary: true,
            offsets: boundaryOffsets,
        };

        dispatch({ type: 'ADD_SHAPE', payload: newShape });

    }, [shapes, projectData.location?.boundary, boundaryOffsets]);

    const handleApplyGeneratedLayout = useCallback((modules: LayoutModule[], projectType: string) => {
        const categoryColors: { [key: string]: string } = {
            Residential: '#d8b4fe',
            Commercial: '#a7f3d0',
            Office: '#bae6fd',
            'Service Core': '#d1d5db',
            'Circulation': '#e5e7eb',
        };
        const defaultColor = '#e7e5e4';

        const newShapes: PlanShape[] = modules.map((module, i) => {
            const category = module.label.includes('Core') ? 'Service Core' : module.label.includes('Circulation') ? 'Circulation' : projectType;
            return {
                id: `shape_${Date.now()}_${i}`,
                type: 'polygon',
                points: module.points,
                x: module.x,
                y: module.y,
                width: module.width,
                height: module.height,
                rotation: 0,
                fill: categoryColors[category] || defaultColor,
                label: module.label,
                category: category,
                floors: 1,
                floorHeight: 3.5,
            };
        });

    dispatch({ type: 'REPLACE_AND_SELECT_SHAPES', payload: { shapesToAdd: newShapes } });
    // By default, don't select all new shapes to avoid group-drag; let user pick single or multi with Shift
    dispatch({ type: 'CLEAR_SELECTION' });
    setIsLayoutGeneratorOpen(false);

    }, []);

    const buildableAreaShape = useMemo(() => shapes.find(s => s.category === 'Setback'), [shapes]);

    // When per-side offsets change and a setback already exists, refresh it live
    useEffect(() => {
        const setback = shapes.find(s => s.category === 'Setback');
        if (!setback) return;
        // Trigger MapCanvas offset recompute by marking it as pending with new offsets
        handleUpdateShapes([{ id: setback.id, isOffsetBoundary: true, offsets: boundaryOffsets }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundaryOffsets]);

    const handleUpdateCostEstimate = useCallback(async () => {
        if (!projectData.location || shapes.length === 0) {
            setCostError("A site location and at least one building shape are required.");
            return;
        }
        setIsCostLoading(true);
        setCostError(null);
        setConceptualCostEstimate(null);
        try {
            const estimate = await generateConceptualPlanCostEstimate(shapes, projectData.location);
            setConceptualCostEstimate(estimate);
            onCostUpdate(estimate);
        } catch (e) {
            const message = e instanceof Error ? e.message : "An unknown error occurred.";
            setCostError(`Failed to generate cost estimate: ${message}`);
            onCostUpdate(null);
        } finally {
            setIsCostLoading(false);
        }
    }, [shapes, projectData.location, onCostUpdate]);
    
    const handleSaveWithPreview = useCallback(async (isClosing: boolean) => {
        let planToSave: ConceptualPlan = { shapes };

        if (mapCanvasRef.current) {
            try {
                // Temporarily deselect shapes for a clean screenshot
                const selectedBeforeCapture = selectedShapeIds;
                dispatch({ type: 'CLEAR_SELECTION' });
                // Allow state to update before capturing
                await new Promise(resolve => setTimeout(resolve, 50));

                const canvas = await html2canvas(mapCanvasRef.current, { useCORS: true, logging: false });
                const previewImage = canvas.toDataURL('image/jpeg', 0.8);
                planToSave = { ...planToSave, previewImage };
                
                // Restore selection
                selectedBeforeCapture.forEach(id => dispatch({ type: 'SELECT_SHAPE', payload: { id, multi: true } }));

            } catch (error) {
                console.error("Failed to capture planner preview:", error);
                // Continue without preview on error
            }
        }
        
        onSave(planToSave);

        if (isClosing) {
            onClose();
        }
    }, [onSave, onClose, shapes, selectedShapeIds]);

    // Export handlers
    const handleExportOBJ = async (includeAll: boolean) => {
        console.log('Export button clicked, sceneRef:', sceneRef);
        
        if (!sceneRef) {
            console.warn('Scene not ready for export');
            alert('Please wait for the 3D view to load before exporting.');
            return;
        }

        setIsExporting(true);

        try {
            console.log('Starting OBJ export...');
            const data = includeAll
                ? exportCompleteScene(sceneRef, { includeNormals: true, includeUVs: true })
                : exportUserContentOnly(sceneRef, { includeNormals: true, includeUVs: true });

            console.log('Export data generated:', data);
            
            const filename = 'urbaneyes_design';
            downloadOBJ(data, filename);

            console.log('OBJ export completed and download triggered');
        } catch (error) {
            console.error('Error exporting OBJ:', error);
            alert('Failed to export 3D model. Please try again.');
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    const handleExportGLTF = async (includeAll: boolean) => {
        if (!sceneRef) {
            console.warn('Scene not ready for export');
            return;
        }

        setIsExporting(true);

        try {
            const exportScene = includeAll ? sceneRef : createUserContentScene(sceneRef);
            const gltfData = await exportToGLTF(exportScene, true);

            const filename = 'urbaneyes_design';
            downloadGLTF(gltfData, true, filename);

            console.log('GLTF export completed');
        } catch (error) {
            console.error('Error exporting GLTF:', error);
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    const createUserContentScene = (scene: THREE.Scene) => {
        const tempScene = new THREE.Scene();
        scene.traverse((child: any) => {
            if (child.isMesh || child.isLine || child.isLineSegments) {
                if (child.userData?.shapeId ||
                    child.userData?.objectType === 'path' ||
                    child.name?.includes('SiteBoundary')) {
                    const cloned = child.clone(true);
                    cloned.updateMatrixWorld(true);
                    tempScene.add(cloned);
                }
            }
        });
        return tempScene;
    };

    return (
        <>
            <div className="w-full h-[calc(100vh-68px)] flex flex-col bg-gradient-to-br from-slate-50 via-white to-teal-50/30 animate-fade-in">
                {/* Header matches other pages: container width, same lateral padding and spacing */}
                <header className="flex-shrink-0 z-20">
                    <div className="container mx-auto px-4 md:px-8 pt-6 md:pt-8">
                        <PageHeader
                            title="Concept Planner"
                            className="mb-8"
                            subtitle={<span className="text-xs md:text-sm">{projectData.location?.name || 'Design massing and layouts'}</span>}
                            icon={<ConceptIcon className="w-full h-full" />}
                            actions={
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleSaveWithPreview(true)}
                                        className="group inline-flex items-center justify-center rounded-full font-semibold text-sm px-6 py-2.5 text-slate-700 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 focus:outline-none focus:ring-2 focus:ring-teal-400/30 transition-all duration-300 hover:scale-105 active:scale-95"
                                    >
                                        Back to Dashboard
                                    </button>

                                    {/* Download 3D Button - Only visible in 3D view */}
                                    {viewMode === '3d' && (
                                        <button
                                            onClick={() => handleExportOBJ(true)}
                                            disabled={isExporting}
                                            className={`group inline-flex items-center justify-center rounded-full font-semibold text-sm px-6 py-2.5 transition-all duration-300 hover:scale-105 active:scale-95 ${
                                                isExporting
                                                    ? 'bg-gray-400 text-white cursor-wait'
                                                    : 'text-teal-700 bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50'
                                            }`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download 3D
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleSaveWithPreview(false)}
                                        className="group relative inline-flex items-center justify-center rounded-full font-semibold text-sm px-6 py-2.5 text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                                        <SaveIcon className="w-4 h-4 mr-2 relative z-10" />
                                        <span className="relative z-10">Save Plan</span>
                                    </button>
                                </div>
                            }
                        />
                    </div>
                </header>

                {/* Main Content */}
                {/* Body aligned to the same container as other pages */}
                <div className="flex-grow">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="flex overflow-hidden gap-4 pt-2 md:pt-0 pb-6">
                    {/* Left Toolbox Panel */}
                    <Toolbox
                        isOpen={isToolboxOpen}
                        onToggle={() => setIsToolboxOpen(p => !p)}
                        onUndo={() => dispatch({ type: 'UNDO' })}
                        onRedo={() => dispatch({ type: 'REDO' })}
                        canUndo={historyIndex > 0}
                        canRedo={historyIndex < history.length - 1}
                        activeTool={activeTool}
                        onSetTool={setActiveTool}
                        boundaryOffsets={boundaryOffsets}
                        onSetAllOffsets={handleSetAllOffsets}
                        onSetOffsetAt={handleSetOffsetAt}
                        onCreateOffsetBoundary={handleCreateOffsetBoundary}
                        showLabels={showLabels}
                        onToggleLabels={() => setShowLabels(p => !p)}
                        showPois={showPois}
                        onTogglePois={onTogglePois}
                        onOpenLayoutGenerator={() => setIsLayoutGeneratorOpen(true)}
                        isLayoutGeneratorEnabled={!!buildableAreaShape}
                        viewMode={viewMode}
                        onSetViewMode={setViewMode}
                    />

                    {/* Center Canvas - restrict 3D viewport to fixed aspect ratio and size */}
                    <main
                        className={`relative overflow-hidden rounded-3xl ring-1 ring-slate-900/5 transition-all duration-500 hover:ring-2 hover:ring-teal-400/20 hover:scale-[1.01] ${viewMode === '2d' ? 'flex-grow flex items-center justify-center' : 'flex items-center justify-center'}`}
                        style={viewMode === '3d' ? { height: '650px', width: '100%', maxWidth: '1200px', margin: '0 auto', aspectRatio: '16/9', background: 'linear-gradient(to bottom, #e0f7fa, #fff)' } : {}}
                    >
                        {viewMode === '2d' ? (
                            <MapCanvas
                                ref={mapCanvasRef}
                                projectData={projectData}
                                shapes={shapes}
                                selectedShapeIds={selectedShapeIds}
                                onAddShape={handleAddShape}
                                onUpdateShapes={handleUpdateShapes}
                                onInteractionEnd={handleInteractionEnd}
                                onSelectShape={handleSelectShape}
                                activeTool={activeTool}
                                onSetTool={setActiveTool}
                                showLabels={showLabels}
                                showPois={showPois}
                                proximityAnalysis={proximityAnalysis}
                                viewMode={viewMode}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', height: '100%', maxWidth: '1200px', aspectRatio: '16/9', background: 'linear-gradient(to bottom, #e0f7fa, #fff)', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
                                    <Viewer3D
                                        shapes={shapes}
                                        selectedShapeIds={selectedShapeIds}
                                        location={projectData.location}
                                        onSelectShape={handleSelectShape}
                                        onShapeUpdate={(shapeId, updates) => handleUpdateShapes([{ id: shapeId, ...updates }])}
                                        onSceneReady={setSceneRef}
                                    />
                                </div>
                            </div>
                        )}
                    </main>

                    {/* Right Properties Panel */}
                    <PropertiesPanel 
                        isOpen={isPropertiesOpen} 
                        onToggle={() => setIsPropertiesOpen(p => !p)} 
                        selectedShapes={selectedShapes}
                        allShapes={shapes}
                        onUpdateShapes={handleUpdateShapes}
                        onBulkUpdate={handleBulkUpdate}
                        onDeleteSelection={() => dispatch({ type: 'DELETE_SELECTION' })}
                        conceptualCostEstimate={conceptualCostEstimate}
                        isCostLoading={isCostLoading}
                        costError={costError}
                        onUpdateCostEstimate={handleUpdateCostEstimate}
                    />
                        </div>
                    </div>
                </div>
            </div>
            
            <LayoutGenerator
                isOpen={isLayoutGeneratorOpen}
                onClose={() => setIsLayoutGeneratorOpen(false)}
                buildableAreaShape={buildableAreaShape}
                onApplyLayout={handleApplyGeneratedLayout}
            />
        </>
    );
};