import React, { useState, useEffect, useCallback } from 'react';
import { PlanShape, GeneratedLayouts, LayoutOption, LayoutModule } from '../../types';
import { generateRuleBasedLayouts } from '@/services/layoutService';
import { generateGeneticApartmentLayouts } from '@/services/gaApartmentLayout';
import { HomeModernIcon, OfficeBuildingIcon, ShopIcon } from './PlannerIcons';
import { XIcon, Spinner } from '../Icons';
import { CustomDropdown } from '../CustomDropdown';

const projectTypes: Record<string, { icon: React.FC<{className?: string}>, subcategories: string[], devModels: string[] }> = {
    Residential: {
        icon: HomeModernIcon,
        subcategories: ['Studio Unit', '1 BHK Unit', '2 BHK Unit', '3 BHK Unit', 'Duplex or Penthouse'],
        devModels: ['Apartment', 'Planned Society'],
    },
    Commercial: {
        icon: ShopIcon,
        subcategories: ['Small Shop', 'Restaurant / Café', 'Anchor Store', 'Showroom', 'Co-retail Module'],
        devModels: ['Mall', 'Street Retail'],
    },
    Office: {
        icon: OfficeBuildingIcon,
        subcategories: ['Small Office', 'Medium Office (10-20 people)', 'Large Floorplate', 'Coworking Module', 'Service Core Block'],
        devModels: ['Office Tower', 'Business Park'],
    },
};

const categoryColors: { [key: string]: string } = {
    Residential: '#d8b4fe',
    Commercial: '#fecaca',
    Office: '#bae6fd',
    'Service Core': '#d1d5db',
    'Circulation': '#e5e7eb',
    'Courtyard': '#86efac',
    'Common Area': '#fde047',
    'default': '#f3f4f6',
};

const LayoutPreview: React.FC<{ layout: LayoutOption, buildableArea: PlanShape, projectType: string }> = ({ layout, buildableArea, projectType }) => {
    const buildableAreaPoints = buildableArea.points?.map(p => ({ x: p.x + buildableArea.x, y: p.y + buildableArea.y })) || [];

    const allModulePoints = layout.modules.flatMap(m => m.points || []);
    
    const allPoints = [...buildableAreaPoints, ...allModulePoints];
    if (allPoints.length === 0) return null;

    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const padding = Math.max(contentWidth, contentHeight) * 0.1;

    const viewBox = {
        x: minX - padding,
        y: minY - padding,
        width: contentWidth + padding * 2,
        height: contentHeight + padding * 2,
    };

    const getColorForModule = (label: string) => {
        if (label.includes('Core')) return categoryColors['Service Core'];
        if (label.includes('Circulation')) return categoryColors['Circulation'];
        if (label.includes('Courtyard')) return categoryColors['Courtyard'];
        if (label.includes('Common Area')) return categoryColors['Common Area'];
        return categoryColors[projectType] || categoryColors['default'];
    };

    return (
        <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} className="w-full h-full bg-slate-50 rounded-lg border border-slate-200">
            <polygon
                points={buildableAreaPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={Math.max(0.5, viewBox.width * 0.005)}
                strokeDasharray="2 2"
            />
            {layout.modules.map((module, index) => {
                const strokeWidth = Math.max(0.2, viewBox.width * 0.002);
                return (
                    <polygon
                        key={index}
                        points={module.points!.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={getColorForModule(module.label)}
                        stroke="#475569"
                        strokeWidth={strokeWidth}
                    />
                );
            })}
        </svg>
    );
};

interface LayoutGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    buildableAreaShape: PlanShape | undefined;
    onApplyLayout: (modules: LayoutModule[], projectType: string) => void;
}

export const LayoutGenerator: React.FC<LayoutGeneratorProps> = ({ isOpen, onClose, buildableAreaShape, onApplyLayout }) => {
    const [projectType, setProjectType] = useState<keyof typeof projectTypes>('Residential');
    const [subcategory, setSubcategory] = useState(projectTypes.Residential.subcategories[0]);
    const [devModel, setDevModel] = useState<string>(projectTypes.Residential.devModels[0]);
    const [roadWidth, setRoadWidth] = useState<number>(8);
    const [unitMix, setUnitMix] = useState<Record<string, number>>({});
    const [useGA, setUseGA] = useState<boolean>(false);
    const [floors, setFloors] = useState<number>(6);
    const [totalUnits, setTotalUnits] = useState<number>(60);
    const [mixPercent, setMixPercent] = useState<Record<string, number>>({ 'Studio Unit': 100 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedLayouts, setGeneratedLayouts] = useState<GeneratedLayouts | null>(null);

    const handleGenerate = useCallback(() => {
        if (!buildableAreaShape) {
            setError("No buildable area defined. Please create a setback boundary first.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedLayouts(null);
        
        // Use a timeout to allow the UI to update to the loading state before starting the heavy computation
        setTimeout(() => {
            try {
                let options;
                if (useGA && projectType === 'Residential' && (devModel === 'Apartment')) {
                    options = generateGeneticApartmentLayouts(buildableAreaShape, {
                        devModel: 'Apartment',
                        floors,
                        totalUnits,
                        unitMixPercent: Object.keys(mixPercent).length ? mixPercent : { 'Studio Unit': 100 },
                        useGA: true,
                    });
                } else {
                    options = generateRuleBasedLayouts(buildableAreaShape, subcategory, projectType, {
                        devModel: devModel as any,
                        unitMix: Object.keys(unitMix).length ? unitMix : undefined,
                        roadWidth,
                    });
                }
                setGeneratedLayouts({
                    projectType,
                    subcategory,
                    layoutOptions: options,
                });
            } catch (e: any) {
                setError(e.message || "Failed to generate rule-based layouts.");
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [buildableAreaShape, subcategory, projectType, devModel, unitMix, useGA, floors, totalUnits, mixPercent, roadWidth]);

    useEffect(() => {
        if (projectType && projectTypes[projectType]) {
            setSubcategory(projectTypes[projectType].subcategories[0]);
            setDevModel(projectTypes[projectType].devModels[0]);
            setUnitMix({});
        }
    }, [projectType]);
    
    useEffect(() => {
        if (isOpen) {
            setGeneratedLayouts(null);
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Layout Generator</h2>
                        <p className="text-sm text-slate-500 mt-1">Generate conceptual layouts for your buildable area.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 flex min-h-0">
                    <div className="w-80 p-6 border-r border-slate-200 flex flex-col gap-6 bg-slate-50 overflow-y-auto min-h-0">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">1. Project Type</label>
                            <CustomDropdown
                                value={projectType}
                                onChange={(val) => setProjectType(val as any)}
                                options={Object.keys(projectTypes).map(type => ({ value: type, label: type }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">2. Development Model</label>
                            <CustomDropdown
                                value={devModel}
                                onChange={(val) => setDevModel(val as string)}
                                options={projectTypes[projectType].devModels.map(model => ({ value: model, label: model }))}
                            />
                        </div>
                                                <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">3. Main Unit Type</label>
                            <CustomDropdown
                                value={subcategory}
                                onChange={(val) => setSubcategory(val as string)}
                                options={projectTypes[projectType].subcategories.map(sub => ({ value: sub, label: sub }))}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">4. Unit Mix (optional)</label>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {projectTypes[projectType].subcategories.map(sub => (
                                    <div key={sub} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-slate-600">{sub}</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            placeholder="0"
                                            value={unitMix[sub] ?? ''}
                                            onChange={e => {
                                                const v = e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value)));
                                                setUnitMix(prev => {
                                                    const next = { ...prev } as Record<string, number>;
                                                    if (v === undefined || isNaN(v)) delete next[sub]; else next[sub] = v;
                                                    return next;
                                                });
                                            }}
                                            className="w-20 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">Leave blank to auto-fill with the main unit type.</p>
                        </div>

                                                {projectType === 'Residential' && devModel === 'Apartment' && (
                                                    <div className="space-y-3 pt-2 border-t border-slate-200">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-sm font-medium text-slate-700">Use Genetic Optimizer</label>
                                                            <input type="checkbox" checked={useGA} onChange={(e)=> setUseGA(e.target.checked)} />
                                                        </div>
                                                        {useGA && (
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Floors</label>
                                                                        <input type="number" min={1} max={40} value={floors} onChange={e=> setFloors(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="form-input !rounded-lg w-full" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Total Units</label>
                                                                        <input type="number" min={1} max={1000} value={totalUnits} onChange={e=> setTotalUnits(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} className="form-input !rounded-lg w-full" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Unit Mix (%)</label>
                                                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                                                        {['Studio Unit','1 BHK Unit','2 BHK Unit','3 BHK Unit','Duplex or Penthouse'].map(label => (
                                                                            <div key={label} className="flex items-center justify-between gap-2">
                                                                                <span className="text-xs text-slate-600">{label}</span>
                                                                                <input type="number" min={0} max={100} step={1}
                                                                                    value={mixPercent[label] ?? 0}
                                                                                    onChange={e=> {
                                                                                        const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                                                                        setMixPercent(prev => ({ ...prev, [label]: v }));
                                                                                    }}
                                                                                    className="w-20 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300" />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-500 mt-1">Percentages need not sum to 100; they will be normalized.</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                        {(devModel === 'Planned Society' || devModel === 'Business Park' || devModel === 'Street Retail') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">5. Internal Road Width (m)</label>
                                <input
                                    type="number"
                                    min={4}
                                    max={20}
                                    step={1}
                                    value={roadWidth}
                                    onChange={e => setRoadWidth(Math.max(4, Math.min(20, Number(e.target.value) || 8)))}
                                    className="form-input !rounded-lg w-full"
                                />
                            </div>
                        )}

                        <div className="mt-auto pt-6 border-t border-slate-200">
                             <button onClick={handleGenerate} disabled={isLoading} className="btn btn-primary btn-large w-full">
                                {isLoading ? <Spinner /> : 'Generate Layouts'}
                            </button>
                            <p className="text-xs text-slate-500 mt-2 text-center">Generates architecturally-sound layout options based on your site.</p>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Spinner />
                                <p className="mt-4 font-semibold text-slate-700">Generating layouts...</p>
                                <p className="text-sm text-slate-500">Calculating optimal arrangements...</p>
                            </div>
                        )}
                        {error && (
                             <div className="flex items-center justify-center h-full">
                                <p className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">{error}</p>
                            </div>
                        )}
                        {generatedLayouts && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {generatedLayouts.layoutOptions.map(option => (
                                    <div key={option.id} className="card p-4 space-y-3">
                                        <h4 className="font-bold text-slate-800">{option.description}</h4>
                                        <div className="w-full aspect-[4/3]">
                                            {buildableAreaShape && <LayoutPreview layout={option} buildableArea={buildableAreaShape} projectType={generatedLayouts.projectType} />}
                                        </div>
                                        <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Total GFA</p>
                                                <p className="font-semibold">{option.gfa.toFixed(0)} m²</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Plot Coverage</p>
                                                <p className="font-semibold">{(option.plotCoverage * 100).toFixed(0)}%</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onApplyLayout(option.modules, generatedLayouts.projectType)} className="w-full btn btn-secondary">Apply Layout</button>
                                    </div>
                                ))}
                                {generatedLayouts.layoutOptions.length === 0 && !isLoading && (
                                     <div className="lg:col-span-2 xl:col-span-3 flex items-center justify-center h-full text-center py-10">
                                        <div>
                                            <p className="text-lg font-semibold text-slate-700">No layouts generated</p>
                                            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">The buildable area might be too small or complex for the selected unit size.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                         {!isLoading && !error && !generatedLayouts && (
                            <div className="flex items-center justify-center h-full text-center">
                                <div>
                                    <p className="text-lg font-semibold text-slate-700">Ready to Generate</p>
                                     <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
                                        Select your project options and click "Generate Layouts" to create architectural massing studies.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};