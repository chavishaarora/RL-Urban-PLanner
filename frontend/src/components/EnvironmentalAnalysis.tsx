import React, { useState } from 'react';
import { SolarAnalyzer } from '@/services/analysis/solarAnalysis';

interface EnvironmentalAnalysisProps {
    scene: any;
    buildings: any[];
    latitude?: number;
    longitude?: number;
    date?: Date; // reference date for sun path
    timeOfDay?: number; // Hour of day (0-24)
    onVisualizationChange?: (type: string | null) => void;
}

type AnalysisOption = {
    id: string;
    label: string;
    action: () => Promise<void>;
};

export const EnvironmentalAnalysis: React.FC<EnvironmentalAnalysisProps> = ({
    scene,
    buildings,
    latitude = 51.5074,
    longitude = -0.1278,
    date = new Date(),
    timeOfDay = 12,
    onVisualizationChange
}) => {
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [hour, setHour] = useState(timeOfDay);


    const runSolarAnalysis = async () => {
        if (onVisualizationChange) onVisualizationChange('solar');
        const d = new Date(date);
        d.setHours(hour, 0, 0, 0);
        const analyzer = new SolarAnalyzer(scene, buildings);
        const results = await analyzer.analyzeSolarRadiation(latitude, longitude, d);
        setAnalysisResults(results);
    };





    const renderResults = () => {
        if (!analysisResults) return null;
        return (
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-teal-800 border-b border-teal-100 pb-2">Sun & Shadows</h3>
                <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Approx. Radiation (relative)</span>
                        <span className="text-sm font-semibold text-teal-700">{analysisResults.radiation.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Sunlit Hours (est.)</span>
                        <span className="text-sm font-semibold text-teal-700">{analysisResults.sunExposureHours.toFixed(0)}h</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Shadow Timeline</p>
                        <div className="grid grid-cols-12 gap-0">
                            {analysisResults.shadows.map((shadow: boolean, idx: number) => (
                                <div
                                    key={idx}
                                    title={`${idx}:00`}
                                    className={`h-3 ${shadow ? 'bg-slate-300' : 'bg-amber-400'}`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>0h</span><span>12h</span><span>24h</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const analysisOptions = [
        { id: 'solar', label: 'Sun & Shadows', action: runSolarAnalysis }
    ];

    return (
        <div className="environmental-analysis">
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white border-0 rounded-lg shadow-lg px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2"
                >
                    <span>{activeAnalysis ? `${activeAnalysis.charAt(0).toUpperCase() + activeAnalysis.slice(1)} Analysis` : 'Environmental Analysis'}</span>
                    <svg 
                        className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute mt-2 w-56 rounded-lg bg-white shadow-2xl border border-teal-100 overflow-hidden z-10">
                        {analysisOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => {
                                    setActiveAnalysis(option.id);
                                    option.action();
                                    setIsOpen(false);
                                }}
                                disabled={false}
                                className={`w-full text-left px-4 py-3 text-xs font-medium transition-all ${
                                    activeAnalysis === option.id
                                        ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white'
                                        : 'text-slate-700 hover:bg-teal-50'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Time of day control */}
            <div className="mt-3 p-4 bg-white rounded-lg border border-teal-100 shadow-sm">
                <label className="flex justify-between items-center text-xs font-medium text-teal-700 mb-1">
                    <span>Time of Day</span>
                    <span>{hour}:00</span>
                </label>
                <input
                    type="range"
                    min={0}
                    max={23}
                    value={hour}
                    onChange={(e) => {
                        const h = parseInt(e.target.value, 10);
                        setHour(h);
                        if (activeAnalysis === 'solar') runSolarAnalysis();
                    }}
                    className="w-full"
                />
            </div>
            {activeAnalysis === 'solar' && analysisResults && (
                <div className="mt-3 p-4 bg-white rounded-lg border border-teal-100 shadow-lg relative">
                    <button
                        onClick={() => {
                            setAnalysisResults(null);
                            setActiveAnalysis(null);
                            if (onVisualizationChange) onVisualizationChange(null);
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-teal-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    {renderResults()}
                </div>
            )}
        </div>
    );
};