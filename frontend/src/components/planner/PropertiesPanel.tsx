import React, { useMemo, useState, useEffect } from 'react';
import { PlanShape, CostEstimate } from '../../types';
import { ChevronRightIcon } from './PlannerIcons';
import { getBoundingBox, rotatePoint } from '@/utils/geometry';
import { Spinner } from '../Icons';
import { CustomDropdown } from '../CustomDropdown';


interface PropertiesPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    selectedShapes: PlanShape[];
    allShapes: PlanShape[];
    onUpdateShapes: (updates: (Partial<PlanShape> & { id: string })[]) => void;
    onBulkUpdate: (updates: (Partial<PlanShape> & { id: string })[]) => void;
    onDeleteSelection: () => void;
    conceptualCostEstimate: CostEstimate | null;
    isCostLoading: boolean;
    costError: string | null;
    onUpdateCostEstimate: () => void;
}

const PropertyInput: React.FC<{ 
    label: string; 
    value: string | number; 
    onChange: (val: string) => void; 
    onBlur?: (val: string) => void;
    type?: string; 
    min?: number; 
    max?: number; 
    step?: number; 
    disabled?: boolean; 
    placeholder?: string;
}> = ({ label, value, onChange, onBlur, type = 'text', min = 0, max, step = 1, disabled = false, placeholder }) => (
    <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
        <input
            type={type}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur ? (e => onBlur(e.target.value)) : undefined}
            onKeyDown={onBlur ? (e => { if (e.key === 'Enter') onBlur(e.currentTarget.value); }) : undefined}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-300 disabled:opacity-50 disabled:bg-slate-100 transition-all duration-300 hover:border-teal-200 hover:shadow-sm transform focus:scale-105"
        />
    </div>
);

const calculatePolygonArea = (points: {x: number, y: number}[], width: number, height: number): number => {
    if (!points || points.length < 3) return width * height; // Fallback for rects or invalid polygons
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
};

const categoryColors: { [key: string]: string } = {
    'Residential': '#d8b4fe', // purple-300
    'Commercial': '#fecaca', // red-200
    'Office': '#bae6fd', // sky-200
    'Landscape': '#bbf7d0', // green-200
    'Infrastructure': '#e5e7eb', // gray-200
    'Core': '#d1d5db', // gray-300
    'Circulation': '#e5e7eb', // gray-200
    'Parking': '#9ca3af', // gray-400
    'Setback': '#bae6fd', // sky-200
    'Custom': '#e7e5e4', // stone-200
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};


export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    isOpen, onToggle, selectedShapes, allShapes, onUpdateShapes, onBulkUpdate, onDeleteSelection,
    conceptualCostEstimate, isCostLoading, costError, onUpdateCostEstimate 
}) => {
    
    const [groupRotationInput, setGroupRotationInput] = useState('0');
    const [batchFloorsInput, setBatchFloorsInput] = useState('');
    const [batchFloorHeightInput, setBatchFloorHeightInput] = useState('');
    const selectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

    useEffect(() => {
        setGroupRotationInput('0');
        setBatchFloorsInput('');
        setBatchFloorHeightInput('');
    }, [selectedShapes]);

    const handleUpdate = (field: keyof PlanShape, value: string | number | boolean) => {
        if (!selectedShape) return;
        const numericValue = typeof value === 'string' && (field !== 'label' && field !== 'category' && field !== 'fill') ? parseFloat(value) : value;
        onUpdateShapes([{ id: selectedShape.id, [field]: numericValue }]);
    };
    
    const handleApplyGroupRotation = () => {
        const angle = parseFloat(groupRotationInput) || 0;
        if (angle === 0 || selectedShapes.length <= 1) return;

        // 1. Find center of the bounding box of the current *visual* representation of the group
        const allPoints = selectedShapes.flatMap(s => {
            if (!s.points) return [];
            const shapeCenter = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
            return s.points.map(p => rotatePoint(p, shapeCenter, s.rotation));
        });

        if (allPoints.length === 0) return;

        const { minX, minY, maxX, maxY } = getBoundingBox(allPoints);
        const groupCenter = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };

        // 2. Calculate updates for each shape
        const updates = selectedShapes.map(shape => {
            const shapeCenter = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
            const newShapeCenter = rotatePoint(shapeCenter, groupCenter, angle);
            const deltaX = newShapeCenter.x - shapeCenter.x;
            const deltaY = newShapeCenter.y - shapeCenter.y;
            const newPoints = shape.points?.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
            const newBbox = newPoints ? getBoundingBox(newPoints) : { minX: shape.x + deltaX, minY: shape.y + deltaY, maxX: shape.x + deltaX + shape.width, maxY: shape.y + deltaY + shape.height };
            const newRotation = ((shape.rotation || 0) + angle);

            return { 
                id: shape.id, 
                x: newBbox.minX, 
                y: newBbox.minY,
                width: newBbox.maxX - newBbox.minX,
                height: newBbox.maxY - newBbox.minY,
                points: newPoints,
                rotation: newRotation,
            };
        });

        onBulkUpdate(updates);
        setGroupRotationInput('0');
    };

    const getShapeArea = (shape: PlanShape): number => {
        if (shape.type === 'polygon' && shape.points) {
            return calculatePolygonArea(shape.points, shape.width, shape.height);
        }
        if (shape.type === 'circle') {
            return Math.PI * (shape.width / 2) * (shape.height / 2);
        }
        return shape.width * shape.height;
    }

    const totalGFA = allShapes.reduce((sum, shape) => {
        if (shape.category === 'Setback' || shape.floors === 0) return sum;
        return sum + (getShapeArea(shape) * (shape.floors ?? 1));
    }, 0);

    const availableCategories = useMemo(() => {
        const defaultCategories = ['Residential', 'Commercial', 'Office', 'Landscape', 'Infrastructure', 'Core', 'Circulation', 'Parking', 'Setback', 'Custom'];
        const categories = new Set(defaultCategories);
        allShapes.forEach(shape => categories.add(shape.category));
        if (selectedShape) {
            categories.add(selectedShape.category);
        }
        return Array.from(categories).sort();
    }, [allShapes, selectedShape]);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!selectedShape) return;
        const newCategoryValue = e.target.value;
        if (newCategoryValue === '__add_new__') {
            const newCategory = window.prompt("Enter new category name:");
            if (newCategory && newCategory.trim() !== "") {
                const category = newCategory.trim();
                const color = categoryColors[category] || '#e7e5e4'; // stone-200
                onUpdateShapes([{ id: selectedShape.id, category, fill: color }]);
            }
        } else {
            const color = categoryColors[newCategoryValue] || '#e7e5e4';
            onUpdateShapes([{ id: selectedShape.id, category: newCategoryValue, fill: color }]);
        }
    };

    return (
        <aside className={`relative bg-gradient-to-br from-white via-cyan-50/20 to-white backdrop-blur-xl border border-slate-200/60 transition-all duration-500 ease-in-out flex flex-col ring-1 ring-cyan-500/10 rounded-3xl hover:ring-2 hover:ring-cyan-400/30 hover:border-cyan-300/60 hover:scale-[1.02] hover:-translate-y-1 ${isOpen ? 'w-72' : 'w-0'}`}>
            <button onClick={onToggle} className="group absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-16 bg-gradient-to-br from-white/95 to-slate-50/90 backdrop-blur-xl border border-slate-200 rounded-l-xl hover:from-teal-50 hover:to-cyan-50 flex items-center justify-center hover:border-teal-300 transition-all duration-300 hover:scale-105">
                <ChevronRightIcon className={`w-5 h-5 text-slate-600 group-hover:text-teal-600 transition-all duration-300 ${isOpen ? '' : 'rotate-180'}`} />
            </button>
            <div className={`overflow-hidden flex-shrink-0 w-72 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <div className="p-3 border-b border-slate-200/60 bg-gradient-to-r from-white to-cyan-50/30 rounded-t-3xl">
                    <h3 className="font-bold text-slate-800 text-base">Properties</h3>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar max-h-[calc(100vh-200px)]">
                    {selectedShapes.length > 1 ? (
                         <div className="space-y-3">
                            <p className="font-semibold text-slate-800 text-center text-sm">{selectedShapes.length} shapes selected</p>
                             <div className="p-4 bg-gradient-to-br from-teal-50/50 to-cyan-50/30 border border-teal-200 rounded-xl space-y-3 shadow-sm">
                                <h4 className="font-semibold text-sm text-teal-700">Batch Edit</h4>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <PropertyInput 
                                        label="Floors" 
                                        value={batchFloorsInput} 
                                        type="number" 
                                        placeholder="e.g., 12"
                                        onChange={val => setBatchFloorsInput(val)}
                                        onBlur={val => {
                                            const floors = parseFloat(val);
                                            if (!isNaN(floors) && floors > 0) {
                                                onBulkUpdate(selectedShapes.map(s => ({ id: s.id, floors })));
                                            }
                                        }}
                                        min={0} 
                                    />
                                    <PropertyInput 
                                        label="Floor Height (m)" 
                                        value={batchFloorHeightInput} 
                                        type="number" 
                                        placeholder="e.g., 3.5"
                                        onChange={val => setBatchFloorHeightInput(val)}
                                        onBlur={val => {
                                            const floorHeight = parseFloat(val);
                                            if (!isNaN(floorHeight) && floorHeight > 0) {
                                                onBulkUpdate(selectedShapes.map(s => ({ id: s.id, floorHeight })));
                                            }
                                        }}
                                        min={0.1} 
                                        step={0.1} 
                                    />
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <PropertyInput label="Group Rotation (°)" value={groupRotationInput} onChange={setGroupRotationInput} type="number" step={1} />
                                    <button onClick={handleApplyGroupRotation} className="group mt-auto px-4 py-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium text-sm hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95">Apply</button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => {
                                        onBulkUpdate(selectedShapes.map(s => ({ id: s.id, visible: false })));
                                    }}
                                    className="group w-full px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:border-teal-300 hover:bg-teal-50/30 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                                >
                                    Hide All
                                </button>
                                <button onClick={onDeleteSelection} className="group w-full px-4 py-2.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-200 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95">Delete All</button>
                            </div>
                        </div>
                    ) : selectedShape ? (
                        <>
                            <PropertyInput label="Label" value={selectedShape.label} onChange={val => handleUpdate('label', val)} />
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
                                <CustomDropdown
                                    value={selectedShape.category}
                                    onChange={(val) => {
                                        if (val === '__add_new__') {
                                            const newCategory = window.prompt("Enter new category name:");
                                            if (newCategory && newCategory.trim() !== "") {
                                                const category = newCategory.trim();
                                                const color = categoryColors[category] || '#e7e5e4';
                                                onUpdateShapes([{ id: selectedShape.id, category, fill: color }]);
                                            }
                                        } else {
                                            const color = categoryColors[val as string] || '#e7e5e4';
                                            onUpdateShapes([{ id: selectedShape.id, category: val as string, fill: color }]);
                                        }
                                    }}
                                    options={[
                                        ...availableCategories.map(cat => ({ value: cat, label: cat })),
                                        { value: '__add_new__', label: '+ Add New...', isSpecial: true }
                                    ]}
                                />
                            </div>

                             <div className="grid grid-cols-2 gap-2">
                                <PropertyInput label="Floors" value={selectedShape.floors ?? 1} type="number" onChange={val => handleUpdate('floors', val)} min={0} />
                                <PropertyInput label="Floor Height (m)" value={selectedShape.floorHeight || 3.5} type="number" onChange={val => handleUpdate('floorHeight', val)} min={0.01} step={0.01} />
                            </div>
                            <PropertyInput label="Rotation (°)" value={selectedShape.rotation || 0} type="number" onChange={val => handleUpdate('rotation', val)} min={0} max={360} step={1} />
                            
                            <PropertyInput label="Color" value={selectedShape.fill} type="color" onChange={val => handleUpdate('fill', val)} />
                            
                            <div className="border-t border-slate-200/60 pt-4 mt-4 space-y-3 bg-gradient-to-br from-slate-50/50 to-white p-3 rounded-xl">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 font-medium">Floor Area</span>
                                    <span className="font-semibold text-slate-800 font-mono bg-white px-3 py-1 rounded-full shadow-sm">
                                        {getShapeArea(selectedShape).toFixed(1)} m²
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 font-medium">Building Area ({selectedShape.floors ?? 1} floors)</span>
                                    <span className="font-bold text-slate-900 font-mono bg-gradient-to-r from-teal-50 to-cyan-50 px-3 py-1 rounded-full shadow-sm border border-teal-200">
                                        {(getShapeArea(selectedShape) * (selectedShape.floors ?? 1)).toFixed(1)} m²
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button 
                                    onClick={() => handleUpdate('visible', selectedShape.visible === false ? true : false)}
                                    className="group w-full px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:border-teal-300 hover:bg-teal-50/30 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                                >
                                    {selectedShape.visible === false ? 'Unhide' : 'Hide'}
                                </button>
                                <button onClick={onDeleteSelection} className="group w-full px-4 py-2.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-200 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95">Delete</button>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-8">Select a shape to edit its properties.</p>
                    )}
                </div>
            </div>

            <div className={`flex-grow flex flex-col overflow-hidden w-72 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <div className="p-3 border-y border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm">Area Summary</h3>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                            <tr>
                                <th className="p-2 text-left font-semibold text-slate-600 text-xs">Label</th>
                                <th className="p-1.5 text-center font-semibold text-slate-600 text-xs">Flrs</th>
                                <th className="p-1.5 text-right font-semibold text-slate-600 text-xs whitespace-nowrap">Floor Area<br/>(m²)</th>
                                <th className="p-1.5 text-right font-semibold text-slate-600 text-xs whitespace-nowrap">Bldg Area<br/>(m²)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allShapes.map(shape => {
                                const floorArea = getShapeArea(shape);
                                const isZeroFloor = shape.floors === 0;
                                const buildingArea = isZeroFloor ? 0 : floorArea * (shape.floors ?? 1);
                                const labelText = shape.category === 'Setback' ? 'Setback' : shape.label || 'Untitled';
                                const isHidden = shape.visible === false;
                                return (
                                <tr 
                                    key={shape.id} 
                                    className={`hover:bg-slate-50 ${selectedShape?.id === shape.id ? 'bg-teal-50' : ''} ${isHidden ? 'opacity-40' : ''}`}
                                >
                                    <td className="p-2 truncate text-slate-800 flex items-center gap-1 max-w-[80px]" title={labelText}>
                                        {isHidden && (
                                            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        )}
                                        <span className="truncate">{labelText}</span>
                                    </td>
                                    <td className="p-1.5 text-center font-mono text-slate-600">{shape.floors ?? 1}</td>
                                    <td className="p-1.5 text-right font-mono text-slate-800">{floorArea.toFixed(1)}</td>
                                    <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{buildingArea.toFixed(1)}</td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                <div className="flex-shrink-0 p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">Total GFA</span>
                    <span className="font-bold text-base text-teal-700 font-mono">{totalGFA.toFixed(1)} m²</span>
                </div>
                
                 {/* Conceptual Cost Estimate */}
                <div className="p-3 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-2.5">
                        <h3 className="font-bold text-slate-800 text-sm">Cost Estimate</h3>
                        <button onClick={onUpdateCostEstimate} disabled={isCostLoading} className="btn btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.75rem'}}>
                            {isCostLoading ? <Spinner className="w-4 h-4 text-slate-800" /> : 'Update'}
                        </button>
                    </div>
                    {isCostLoading && (
                        <div className="text-center py-4">
                            <Spinner className="w-6 h-6 text-teal-600 mx-auto" />
                            <p className="text-sm text-slate-500 mt-2">Generating estimate...</p>
                        </div>
                    )}
                    {costError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                            {costError}
                        </div>
                    )}
                    {conceptualCostEstimate && !isCostLoading && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-baseline p-3 bg-slate-100 rounded-lg">
                                <span className="font-semibold text-slate-700">Total Cost</span>
                                <span className="font-bold text-lg text-teal-700 font-mono">{formatCurrency(conceptualCostEstimate.totalCost)}</span>
                            </div>
                            <details className="text-xs">
                                <summary className="cursor-pointer font-medium text-slate-500">View breakdown</summary>
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200">
                                    {Object.entries(
                                        conceptualCostEstimate.items.reduce((acc: Record<string, number>, item) => {
                                            acc[item.category] = (acc[item.category] || 0) + item.totalCost;
                                            return acc;
                                        }, {})
                                    ).map(([category, total]) => (
                                        <div key={category} className="flex justify-between">
                                            <span className="text-slate-600">{category}</span>
                                            {/* FIX: Explicitly cast 'total' to a number to resolve TypeScript error where 'total' was inferred as 'unknown'. */}
                                            <span className="font-mono text-slate-800">{formatCurrency(Number(total))}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                    {!isCostLoading && !costError && !conceptualCostEstimate && (
                        <p className="text-xs text-slate-500 text-center py-2">Click "Update" to generate a cost estimate based on the current plan.</p>
                    )}
                </div>
            </div>
        </aside>
    );
};