import React, { useMemo, useState } from 'react';
import { ConceptualPlan, PlanShape, CostEstimate } from '../../types';
import { EditIcon, LayoutIcon, HomeIcon, ShopIcon, OfficeBuildingIcon, TreeIcon, CubeIcon, DollarSignIcon } from '../Icons';
import { ChevronRightIcon } from './PlannerIcons';

// Helper function to calculate area of different shapes
const calculatePolygonArea = (points: {x: number, y: number}[], width: number, height: number): number => {
    if (!points || points.length < 3) return width * height; 
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
};

const getShapeArea = (shape: PlanShape): number => {
    if (shape.type === 'polygon' && shape.points) {
        return calculatePolygonArea(shape.points, shape.width, shape.height);
    }
    if (shape.type === 'circle') {
        return Math.PI * (shape.width / 2) * (shape.height / 2);
    }
    return shape.width * shape.height;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};


interface PlannerDashboardCardProps {
    conceptualPlan: ConceptualPlan;
    onEditPlan: () => void;
    costEstimate?: CostEstimate | null;
}

const categoryIcons: { [key: string]: React.FC<{className?: string}> } = {
    'Residential': HomeIcon,
    'Commercial': ShopIcon,
    'Office': OfficeBuildingIcon,
    'Landscape': TreeIcon,
    'Default': CubeIcon,
};

export const PlannerDashboardCard: React.FC<PlannerDashboardCardProps> = ({ 
    conceptualPlan, 
    onEditPlan, 
    costEstimate
}) => {
    
    const stats = useMemo(() => {
        if (!conceptualPlan.shapes || conceptualPlan.shapes.length === 0) return null;

        const buildableShapes = conceptualPlan.shapes.filter(shape => shape.category !== 'Setback');

        const totalGFA = buildableShapes.reduce((sum, shape) => sum + (getShapeArea(shape) * (shape.floors ?? 1)), 0);
        
        const areaByCategory = conceptualPlan.shapes.reduce((acc, shape) => {
            // Determine category - use objectType for landscape elements
            let category = shape.category || 'Uncategorized';
            
            // If it's a landscape object, group under 'Landscape' category
            if (shape.objectType && ['tree', 'shrub', 'bench', 'kiosk', 'playzone', 'path', 'lamp', 'dustbin', 'bikeparking', 'fencing'].includes(shape.objectType)) {
                category = 'Landscape';
            }
            
            const area = getShapeArea(shape) * (shape.floors ?? 1);
            if (!acc[category]) {
                acc[category] = 0;
            }
            acc[category] += area;
            return acc;
        }, {} as { [key: string]: number });
        
        const sortedCategories = Object.entries(areaByCategory).sort(([, areaA], [, areaB]) => Number(areaB) - Number(areaA));
        
        return {
            totalGFA,
            totalUnits: buildableShapes.length,
            categoryBreakdown: sortedCategories,
        };
    }, [conceptualPlan]);

    const costBreakdown = useMemo(() => {
        if (!costEstimate) return null;

        const categoryTotals = Object.entries(
            costEstimate.items.reduce((acc: Record<string, number>, item) => {
                acc[item.category] = (acc[item.category] || 0) + item.totalCost;
                return acc;
            }, {})
        ).sort(([, totalA], [, totalB]) => totalB - totalA);
        
        return {
            total: costEstimate.totalCost,
            categories: categoryTotals,
        };
    }, [costEstimate]);
    
    if (!stats) return null;

    return (
        <div className="card p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Conceptual Massing Plan</h3>
                    <p className="text-sm text-slate-500">A high-level spatial arrangement of the site.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <button onClick={onEditPlan} className="btn btn-secondary flex items-center gap-2">
                        <EditIcon className="w-5 h-5" /> Edit Plan
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left: Image Preview */}
                <div className="w-full relative">
                    {conceptualPlan.previewImage ? (
                        <img src={conceptualPlan.previewImage} alt="Conceptual Plan Preview" className="w-full rounded-md border border-slate-200 bg-slate-100" />
                    ) : (
                        <div className="w-full aspect-video bg-slate-100 rounded-md flex items-center justify-center">
                            <p className="text-slate-500">No preview available.</p>
                        </div>
                    )}
                </div>

                {/* Right: Stats & Breakdown */}
                <div className="space-y-6">
                    {/* Key Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <LayoutIcon className="w-6 h-6 text-teal-600 mb-1" />
                            <p className="text-xs text-slate-500">Total GFA</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalGFA.toFixed(0)} <span className="text-base font-normal">m²</span></p>
                        </div>
                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <CubeIcon className="w-6 h-6 text-teal-600 mb-1" />
                            <p className="text-xs text-slate-500">Total Units</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalUnits}</p>
                        </div>
                    </div>

                     {/* Cost Breakdown */}
                     {costBreakdown && (
                        <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Cost Estimate</h4>
                            <details className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden group transition-all duration-300">
                                <summary className="p-3 cursor-pointer hover:bg-slate-100 list-none flex items-center gap-2">
                                    <ChevronRightIcon className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-90 flex-shrink-0" />
                                    <div className="flex-grow flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <DollarSignIcon className="w-5 h-5 text-slate-500" />
                                            <span className="font-bold text-slate-800 text-base">Total Estimated Cost</span>
                                        </div>
                                        <span className="font-bold text-lg text-teal-700 font-mono">{formatCurrency(costBreakdown.total)}</span>
                                    </div>
                                </summary>
                                <div className="border-t border-slate-200 bg-white p-3 max-h-60 overflow-y-auto">
                                    <ul className="space-y-2">
                                        {costBreakdown.categories.map(([category, total]) => (
                                            <li key={category} className="flex justify-between text-sm px-2 py-1">
                                                <span className="text-slate-600 truncate pr-2">{category}</span>
                                                <span className="font-mono text-slate-700 font-medium flex-shrink-0">{formatCurrency(total as number)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </details>
                        </div>
                    )}


                    {/* Category Breakdown */}
                    <div>
                        <h4 className="font-semibold text-slate-800 mb-2">Area by Category</h4>
                        <div className="space-y-2">
                            {stats.categoryBreakdown.map(([category, area]) => {
                                const totalAreaForPercentage = category === 'Setback' 
                                    ? (area + stats.totalGFA) // Show setback relative to total site plan area
                                    : stats.totalGFA;
                                const percentage = totalAreaForPercentage > 0 ? (area / totalAreaForPercentage) * 100 : 0;
                                const Icon = categoryIcons[category] || categoryIcons['Default'];
                                const categoryShapes = conceptualPlan.shapes.filter(s => {
                                    // For Landscape category, include all shapes with landscape objectTypes
                                    if (category === 'Landscape') {
                                        return s.objectType && ['tree', 'shrub', 'bench', 'kiosk', 'playzone', 'path', 'lamp', 'dustbin', 'bikeparking', 'fencing'].includes(s.objectType);
                                    }
                                    // For other categories, match by category field (excluding landscape objects)
                                    return s.category === category && !s.objectType;
                                });
                                return (
                                    <details key={category} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden group transition-all duration-300">
                                        <summary className="p-2 cursor-pointer hover:bg-slate-100 list-none flex items-center gap-2">
                                            <ChevronRightIcon className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-90 flex-shrink-0" />
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="w-4 h-4 text-slate-500" />
                                                        <span className="font-medium text-slate-700">{category}</span>
                                                    </div>
                                                    <span className="font-mono text-slate-600">{area.toFixed(0)} m²</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                                    <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                </div>
                                            </div>
                                        </summary>
                                        <div className="border-t border-slate-200 bg-white p-2 max-h-40 overflow-y-auto">
                                            <ul className="space-y-1">
                                                {categoryShapes.map(shape => {
                                                    const displayLabel = shape.objectType 
                                                        ? shape.objectType.charAt(0).toUpperCase() + shape.objectType.slice(1)
                                                        : (shape.label || category);
                                                    const floorDisplay = shape.objectType ? '' : ` (${shape.floors || 0}F)`;
                                                    
                                                    return (
                                                        <li key={shape.id} className="flex justify-between text-xs px-2 py-0.5 rounded hover:bg-slate-50">
                                                            <span className="text-slate-600 truncate pr-2">{displayLabel}{floorDisplay}</span>
                                                            <span className="font-mono text-slate-500 flex-shrink-0">{(getShapeArea(shape) * (shape.floors || 1)).toFixed(1)} m²</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};