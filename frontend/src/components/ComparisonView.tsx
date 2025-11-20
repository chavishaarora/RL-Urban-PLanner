import React, { useState } from 'react';
import { DesignAlternative } from '../types';
import { XIcon } from './Icons';

interface ComparisonViewProps {
    isOpen: boolean;
    onClose: () => void;
    alternatives: DesignAlternative[];
    onSelectAlternative?: (id: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ 
    isOpen, 
    onClose, 
    alternatives,
    onSelectAlternative 
}) => {
    const [selectedAlts, setSelectedAlts] = useState<string[]>(
        alternatives.slice(0, 2).map(a => a.id)
    );

    if (!isOpen) return null;

    const compareAlternatives = alternatives.filter(a => selectedAlts.includes(a.id));

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const toggleSelection = (id: string) => {
        if (selectedAlts.includes(id)) {
            if (selectedAlts.length > 1) {
                setSelectedAlts(selectedAlts.filter(altId => altId !== id));
            }
        } else {
            if (selectedAlts.length < 3) {
                setSelectedAlts([...selectedAlts, id]);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Compare Design Alternatives</h2>
                        <p className="text-sm text-slate-500 mt-1">Select up to 3 alternatives to compare side-by-side</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Alternative Selector */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex flex-wrap gap-2">
                        {alternatives.map(alt => (
                            <button
                                key={alt.id}
                                onClick={() => toggleSelection(alt.id)}
                                className={`btn ${
                                    selectedAlts.includes(alt.id) ? 'btn-primary' : 'btn-secondary'
                                }`}
                            >
                                {alt.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comparison Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className={`grid ${compareAlternatives.length === 1 ? 'grid-cols-1' : compareAlternatives.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} divide-x divide-slate-200`}>
                        {compareAlternatives.map(alt => (
                            <div key={alt.id} className="p-6 space-y-6 flex flex-col">
                                {/* Alternative Header */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">{alt.name}</h3>
                                    <p className="text-sm text-slate-600">{alt.description}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Created: {new Date(alt.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Cost Summary */}
                                {alt.costEstimate && (
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <div className="text-center">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Cost</p>
                                            <p className="text-2xl font-bold text-slate-700">
                                                {formatCurrency(alt.costEstimate.totalCost)}
                                            </p>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-slate-500">Construction</p>
                                                <p className="font-semibold text-slate-700">
                                                    {formatCurrency(alt.costEstimate.constructionCost)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500">Annual Maint.</p>
                                                <p className="font-semibold text-slate-700">
                                                    {formatCurrency(alt.costEstimate.maintenanceYearlyCost)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Design Visual */}
                                {alt.analysisResult.find(s => s.title === 'Strategic Generative Recommendations')?.imageUrls.site && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">Design Render</p>
                                        <img 
                                            src={alt.analysisResult.find(s => s.title === 'Strategic Generative Recommendations')!.imageUrls.site!}
                                            alt={`${alt.name} design render`}
                                            className="w-full h-48 object-cover rounded-lg border border-slate-200"
                                        />
                                    </div>
                                )}

                                {/* Key Metrics */}
                                {alt.quantitativeData && (
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">Key Metrics</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Potential Visitors</span>
                                                <span className="font-semibold text-slate-800">
                                                    {alt.quantitativeData.potentialVisitors.toLocaleString()}/day
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Green Space</span>
                                                <span className="font-semibold text-slate-800">
                                                    {alt.quantitativeData.greenSpaceRatio}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Transit Access</span>
                                                <span className="font-semibold text-slate-800">
                                                    {alt.quantitativeData.publicTransportAccess}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Analysis Sections Summary */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Analysis Sections</p>
                                    <div className="space-y-1">
                                        {alt.analysisResult.map((section, idx) => (
                                            <div key={idx} className="text-xs text-slate-700 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0"></span>
                                                <span className="truncate">{section.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Button */}
                                <div className="flex-grow flex items-end">
                                    {onSelectAlternative && (
                                        <button
                                            onClick={() => {
                                                onSelectAlternative(alt.id);
                                                onClose();
                                            }}
                                            className="w-full btn btn-secondary"
                                        >
                                            View This Alternative
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};