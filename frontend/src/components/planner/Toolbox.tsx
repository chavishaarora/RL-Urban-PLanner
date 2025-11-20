import React, { useMemo } from 'react';
import { ChevronLeftIcon, PolygonIcon, RedoIcon, UndoIcon, CircleIcon } from './PlannerIcons';
import { PlannerTool, ViewMode } from '../ConceptualPlanner';

interface ToolboxProps {
    isOpen: boolean;
    onToggle: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    activeTool: PlannerTool;
    onSetTool: (tool: PlannerTool) => void;
    boundaryOffsets: number[];
    onSetAllOffsets: (offset: number) => void;
    onSetOffsetAt: (index: number, value: number) => void;
    onCreateOffsetBoundary: () => void;
    showLabels: boolean;
    onToggleLabels: () => void;
    showPois: boolean;
    onTogglePois: () => void;
    onOpenLayoutGenerator: () => void;
    isLayoutGeneratorEnabled: boolean;
    viewMode: ViewMode;
    onSetViewMode: (mode: ViewMode) => void;
}

const toolboxCategories = [
    {
        name: 'Residential',
        items: [
            { type: 'rect', label: 'Studio Unit', category: 'Residential', color: '#d8b4fe', width: 7, height: 5 }, // 35 m²
            { type: 'rect', label: '1 BHK Unit', category: 'Residential', color: '#d8b4fe', width: 9, height: 7 }, // 63 m²
            { type: 'rect', label: '2 BHK Unit', category: 'Residential', color: '#d8b4fe', width: 10, height: 9 }, // 90 m²
            { type: 'rect', label: '3 BHK Unit', category: 'Residential', color: '#d8b4fe', width: 12, height: 10 }, // 120 m²
        ]
    },
    {
        name: 'Commercial',
        items: [
            { type: 'rect', label: 'Small Shop', category: 'Commercial', color: '#fecaca', width: 6, height: 8 }, // 48 m²
            { type: 'rect', label: 'Restaurant', category: 'Commercial', color: '#fecaca', width: 12, height: 10 }, // 120 m²
            { type: 'rect', label: 'Anchor Store', category: 'Commercial', color: '#fecaca', width: 20, height: 25 }, // 500 m²
        ]
    },
    {
        name: 'Office',
        items: [
            { type: 'rect', label: 'Small Office', category: 'Office', color: '#bae6fd', width: 10, height: 10 }, // 100 m²
            { type: 'rect', label: 'Large Floorplate', category: 'Office', color: '#bae6fd', width: 30, height: 20 }, // 600 m²
        ]
    },
    {
        name: 'Landscape & Open Space',
        items: [
            { type: 'rect', label: 'Green Zone', category: 'Landscape', color: '#bbf7d0', width: 20, height: 20 },
            { type: 'rect', label: 'Plaza/Hardscape', category: 'Landscape', color: '#e7e5e4', width: 15, height: 15 },
            { type: 'circle', label: 'Circular Plaza', category: 'Landscape', color: '#e7e5e4', width: 15, height: 15 },
            { type: 'circle', label: 'Tree', category: 'Landscape', color: '#22c55e', width: 3, height: 3, objectType: 'tree' },
            { type: 'circle', label: 'Shrub', category: 'Landscape', color: '#86efac', width: 1.5, height: 1.5, objectType: 'shrub' },
            { type: 'rect', label: 'Bench', category: 'Landscape', color: '#78716c', width: 2, height: 0.6, objectType: 'bench' },
            { type: 'rect', label: 'Kiosk', category: 'Landscape', color: '#fb923c', width: 4, height: 4, objectType: 'kiosk' },
            { type: 'rect', label: 'Play Zone', category: 'Landscape', color: '#fbbf24', width: 10, height: 10, objectType: 'playzone' },
            { type: 'rect', label: 'Path', category: 'Landscape', color: '#d6d3d1', width: 20, height: 3, objectType: 'path' },
            { type: 'circle', label: 'Lamp', category: 'Landscape', color: '#fef3c7', width: 0.5, height: 0.5, objectType: 'lamp' },
            { type: 'circle', label: 'Dustbin', category: 'Landscape', color: '#737373', width: 0.8, height: 0.8, objectType: 'dustbin' },
            { type: 'rect', label: 'Bike Parking', category: 'Landscape', color: '#60a5fa', width: 8, height: 3, objectType: 'bikeparking' },
            { type: 'rect', label: 'Fencing', category: 'Landscape', color: '#a1a1aa', width: 15, height: 0.3, objectType: 'fencing' },
        ]
    },
    {
        name: 'Infrastructure',
        items: [
            { type: 'rect', label: 'Service Core', category: 'Core', color: '#d1d5db', width: 6, height: 6 },
            { type: 'rect', label: 'Road (6m)', category: 'Circulation', color: '#e5e7eb', width: 50, height: 6 },
            { type: 'rect', label: 'Parking Lot', category: 'Parking', color: '#9ca3af', width: 20, height: 15 },
        ]
    }
];


const DraggableItem: React.FC<{ item: typeof toolboxCategories[0]['items'][0] }> = ({ item }) => {
    const handleDragStart = (e: React.DragEvent) => {
        const data = JSON.stringify(item);
        e.dataTransfer.setData('application/json', data);
    };

    return (
        <div 
            draggable 
            onDragStart={handleDragStart}
            className="group relative flex items-center gap-3 p-2.5 bg-gradient-to-r from-white to-slate-50 rounded-full border border-slate-200 cursor-grab active:cursor-grabbing hover:border-teal-300 hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
        >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
            
            <div 
                className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow" 
                style={{ backgroundColor: item.color }}
            ></div>
            <p className="font-semibold text-sm text-slate-800 tracking-tight relative z-10">{item.label}</p>
        </div>
    );
};

export const Toolbox: React.FC<ToolboxProps> = ({ isOpen, onToggle, onUndo, onRedo, canUndo, canRedo, activeTool, onSetTool, boundaryOffsets, onSetAllOffsets, onSetOffsetAt, onCreateOffsetBoundary, showLabels, onToggleLabels, showPois, onTogglePois, onOpenLayoutGenerator, isLayoutGeneratorEnabled, viewMode, onSetViewMode }) => {

    // Derive UI helpers for a consistent feel
    const { displayOffset, isAllEqual, baseline, maxOffset } = useMemo(() => {
        if (boundaryOffsets.length === 0) return { displayOffset: 0 as number | string, isAllEqual: true, baseline: 0, maxOffset: 20 };
        const first = boundaryOffsets[0] ?? 0;
        const allEqual = boundaryOffsets.every(o => o === first);
        // Heuristic max for sliders: a bit above the current max to keep it comfortable
        const currentMax = Math.max(...boundaryOffsets, 10);
        const cap = Math.min(100, Math.ceil(currentMax + 10));
        return {
            displayOffset: allEqual ? first : '',
            isAllEqual: allEqual,
            baseline: first,
            maxOffset: cap
        };
    }, [boundaryOffsets]);

    // No extra local UI state needed now (always-show list, no dropdown)

    return (
        <aside className={`relative bg-gradient-to-br from-white via-teal-50/20 to-white backdrop-blur-xl border border-slate-200/60 transition-all duration-500 ease-in-out flex flex-col ring-1 ring-teal-500/10 rounded-3xl hover:ring-2 hover:ring-teal-400/30 hover:border-teal-300/60 hover:scale-[1.02] hover:-translate-y-1 ${isOpen ? 'w-56' : 'w-0'}`}>
            <button 
                onClick={onToggle} 
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-16 bg-gradient-to-r from-white to-slate-50 backdrop-blur-sm border border-slate-200 rounded-r-xl hover:from-teal-50 hover:to-white hover:border-teal-300 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
            >
                <ChevronLeftIcon className={`w-5 h-5 text-slate-500 group-hover:text-teal-600 transition-all duration-300 ${isOpen ? '' : 'rotate-180'}`} />
            </button>
            <div className={`overflow-hidden w-56 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <div className="p-3 border-b border-slate-200/60 bg-gradient-to-r from-teal-50/30 to-transparent flex items-center justify-between rounded-t-3xl">
                    <h3 className="font-bold text-slate-800 text-base">Toolbox</h3>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onUndo} 
                            disabled={!canUndo} 
                            className="p-1.5 rounded-lg hover:bg-teal-100 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                        >
                            <UndoIcon className="w-5 h-5"/>
                        </button>
                        <button 
                            onClick={onRedo} 
                            disabled={!canRedo} 
                            className="p-1.5 rounded-lg hover:bg-teal-100 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                        >
                            <RedoIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
                <div className="p-3 overflow-y-auto h-[calc(100vh-125px)] space-y-3 custom-scrollbar">{/* Custom scrollbar class for styling */}
                     <div>
                        <h4 className="text-xs font-bold text-slate-600 mb-2 px-1">View Mode</h4>
                        <div className="mb-4 w-full">
                            <div className="btn-group w-full bg-gradient-to-r from-slate-100 to-slate-50 rounded-full p-1 shadow-inner" role="tablist" aria-label="View mode">
                                <button
                                    onClick={() => onSetViewMode('2d')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                                        viewMode === '2d' 
                                        ? 'bg-gradient-to-r from-white to-slate-50 text-teal-600 shadow-md scale-105' 
                                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                    }`}
                                    aria-pressed={viewMode === '2d'}
                                >
                                    2D Map
                                </button>
                                <button
                                    onClick={() => onSetViewMode('3d')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                                        viewMode === '3d' 
                                        ? 'bg-gradient-to-r from-white to-slate-50 text-teal-600 shadow-md scale-105' 
                                        : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                                    }`}
                                    aria-pressed={viewMode === '3d'}
                                >
                                    3D View
                                </button>
                            </div>
                        </div>
                    </div>

                     <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">View Options</h4>
                        <div className="space-y-2">
                            <button
                                onClick={onToggleLabels}
                                className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-full transition-all duration-300 shadow-sm hover:shadow-md ${
                                    showLabels 
                                    ? 'bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-300 text-teal-700 hover:from-teal-100 hover:to-teal-50' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-200 hover:bg-teal-50/30'
                                }`}
                            >
                                <span className="text-sm font-medium">Show Labels</span>
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${
                                    showLabels ? 'bg-teal-500 scale-110' : 'bg-slate-200 group-hover:bg-slate-300'
                                }`}>
                                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                        showLabels ? 'bg-white shadow-inner' : 'bg-slate-400'
                                    }`} />
                                </span>
                            </button>

                            <button
                                onClick={onTogglePois}
                                className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-full transition-all duration-300 shadow-sm hover:shadow-md ${
                                    showPois 
                                    ? 'bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-300 text-teal-700 hover:from-teal-100 hover:to-teal-50' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-200 hover:bg-teal-50/30'
                                }`}
                            >
                                <span className="text-sm font-medium">Show Nearby POIs</span>
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${
                                    showPois ? 'bg-teal-500 scale-110' : 'bg-slate-200 group-hover:bg-slate-300'
                                }`}>
                                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                        showPois ? 'bg-white shadow-inner' : 'bg-slate-400'
                                    }`} />
                                </span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-3 pt-2 border-t border-slate-200/60 mt-4">Layout Tools</h4>
                            <div className="space-y-2">
                                <button
                                    onClick={onOpenLayoutGenerator}
                                    disabled={!isLayoutGeneratorEnabled}
                                    className={`group w-full px-4 py-3 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden ${
                                        isLayoutGeneratorEnabled
                                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 border border-teal-400 text-white hover:from-teal-600 hover:to-cyan-600 hover:scale-105'
                                        : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {isLayoutGeneratorEnabled && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                                    )}
                                    <span className="text-sm font-medium relative z-10">Generate Layouts</span>
                                </button>
                            </div>
                    </div>
                    
                     <div>
                        <h4 className="text-sm font-bold text-slate-600 mb-2 px-1 pt-2 border-t border-slate-200 mt-4">Drawing Tools</h4>
                         <div className="space-y-2">
                            <button
                                onClick={() => onSetTool('draw-polygon')}
                                className={`group w-full flex items-center gap-3 p-2.5 rounded-full border transition-all duration-300 hover:shadow-md ${activeTool === 'draw-polygon' ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-400 shadow-sm' : 'bg-white border-slate-200 hover:border-teal-200 hover:bg-teal-50/30'}`}
                            >
                                <PolygonIcon className={`w-5 h-5 transition-colors ${activeTool === 'draw-polygon' ? 'text-teal-600' : 'text-slate-600 group-hover:text-teal-600'}`} />
                                <div>
                                    <p className={`font-semibold text-sm transition-colors ${activeTool === 'draw-polygon' ? 'text-teal-700' : 'text-slate-800 group-hover:text-teal-700'}`}>Draw Polygon</p>
                                    <p className="text-xs text-slate-500">Create custom shapes</p>
                                </div>
                            </button>
                            <button
                                onClick={() => onSetTool('draw-circle')}
                                className={`group w-full flex items-center gap-3 p-2.5 rounded-full border transition-all duration-300 hover:shadow-md ${activeTool === 'draw-circle' ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-400 shadow-sm' : 'bg-white border-slate-200 hover:border-teal-200 hover:bg-teal-50/30'}`}
                            >
                                <CircleIcon className={`w-5 h-5 transition-colors ${activeTool === 'draw-circle' ? 'text-teal-600' : 'text-slate-600 group-hover:text-teal-600'}`} />
                                <div>
                                    <p className={`font-semibold text-sm transition-colors ${activeTool === 'draw-circle' ? 'text-teal-700' : 'text-slate-800 group-hover:text-teal-700'}`}>Draw Circle</p>
                                    <p className="text-xs text-slate-500">Create circular shapes</p>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-sm font-semibold text-slate-600 mb-3 pt-2 border-t border-slate-200 mt-4">Site Tools</h4>
                        <div className="space-y-3">
                            <div className="p-3 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl shadow-sm">
                                <label className="block text-sm font-medium text-slate-600 mb-2">Set All Offsets (m)</label>
                                <input
                                    type="number"
                                    value={displayOffset}
                                    placeholder={displayOffset === '' ? 'Mixed' : ''}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                            onSetAllOffsets(val);
                                        }
                                    }}
                                    min="0"
                                    step="0.5"
                                    className="w-full text-sm px-4 py-2 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-300 transition-all duration-300 hover:border-teal-200 hover:shadow-sm transform focus:scale-105"
                                />
                            </div>
                            {boundaryOffsets.length > 0 && (
                                <div className="p-3 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-slate-600">Per-side Offsets (m)</label>
                                        <button
                                            type="button"
                                            onClick={() => onSetAllOffsets(baseline)}
                                            className="group relative text-xs px-4 py-1.5 rounded-full border border-teal-300 bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 hover:from-teal-100 hover:to-cyan-100 transition-all duration-300 hover:shadow-md hover:scale-105 active:scale-95 overflow-hidden"
                                            title="Reset all sides to the same value"
                                            aria-label="Reset all sides to the same value"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                                            <span className="relative z-10 font-medium">Reset</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                                        {boundaryOffsets.map((val, i) => (
                                            <div key={i} className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Side {i+1}</span>
                                                <input
                                                    aria-label={`Offset for side ${i+1}`}
                                                    type="number"
                                                    value={val}
                                                    onChange={e => {
                                                        const v = Number(e.target.value);
                                                        if (!isNaN(v)) onSetOffsetAt(i, v);
                                                    }}
                                                    min={0}
                                                    step={0.5}
                                                    className="w-full text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-300 transition-all duration-300 hover:border-teal-200 hover:shadow-sm transform focus:scale-105"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={onCreateOffsetBoundary}
                                className="group relative w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                                <span className="relative z-10">Create Offset Boundary</span>
                            </button>
                        </div>
                    </div>
                    
                    <p className="text-xs text-slate-500 px-1 pt-2 font-medium">Drag shapes onto the canvas</p>
                    {toolboxCategories.map(category => (
                        <div key={category.name}>
                            <h4 className="text-sm font-bold text-slate-700 mb-2 px-1 pt-2 border-t border-slate-200/60 mt-2">{category.name}</h4>
                            <div className="space-y-2">
                                {category.items.map(item => (
                                        <div 
                                            key={item.label}
                                            draggable 
                                            onDragStart={(e) => {
                                                const data = JSON.stringify(item);
                                                e.dataTransfer.setData('application/json', data);
                                            }}
                                            className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-full cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:border-slate-300 transition-all"
                                        >
                                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                            <p className="text-sm font-medium text-slate-700">{item.label}</p>
                                        </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};