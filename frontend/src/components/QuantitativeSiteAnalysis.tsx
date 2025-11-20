import React, { useMemo, useState, useRef } from 'react';
import { QuantitativeData, SavedInsightCard, DesignTemplate } from '../types';
import { MonthlyWindRose } from './MonthlyWindRose';
import { InfoIcon, DownloadIcon } from './Icons';
import { getCurrencyFromLocation, formatCurrency } from '@/utils/currencyUtils';
import PageHeader from './PageHeader';
import { DocumentStatsIcon } from './Icons';
import html2canvas from 'html2canvas';
import { exportQuantitativeToExcel } from '@/services/excelExportService';

interface QuantitativeSiteAnalysisProps {
    data: QuantitativeData;
    onSaveCard?: (card: SavedInsightCard) => void;
    template?: DesignTemplate | null; // Pass the currently selected design template for contextual strategy guidance
}

// Helper to generate chart colors
const CHART_COLORS = {
    primary: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
    // Use application palette (teal/cyan family) instead of red/blue/purple
    temperature: '#0ea5a3', // teal-600
    rainfall: '#14b8a6',    // teal-500
    humidity: '#2dd4bf',    // teal-300
    wind: '#0d9488',        // teal-700
};

// Removed StrategyInfoBadge (top-right info bubble) per UX request to declutter section headers.


export const QuantitativeSiteAnalysis: React.FC<QuantitativeSiteAnalysisProps> = ({ data, onSaveCard, template }) => {
    // Refs for card downloads
    const demographicsRef = useRef<HTMLDivElement>(null);
    const landUseRef = useRef<HTMLDivElement>(null);
    const accessibilityRef = useRef<HTMLDivElement>(null);
    const environmentalRef = useRef<HTMLDivElement>(null);
    const urbanContextRef = useRef<HTMLDivElement>(null);
    const microclimateRef = useRef<HTMLDivElement>(null);
    const mobilityRef = useRef<HTMLDivElement>(null);
    const socioEconomicRef = useRef<HTMLDivElement>(null);
    const climateRef = useRef<HTMLDivElement>(null);
    const proximityRef = useRef<HTMLDivElement>(null);
    const caseStudiesRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState(false);

    // Download card as high-quality image
    const downloadCard = async (cardRef: React.RefObject<HTMLDivElement>, cardName: string) => {
        if (!cardRef.current) return;
        
        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 3, // High quality
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            });
            
            const link = document.createElement('a');
            link.download = `${cardName.replace(/\s+/g, '_')}_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Failed to download card:', error);
        }
    };

    // Detect currency from location
    const currency = useMemo(() => {
        if (data.location && data.location.name) {
            return getCurrencyFromLocation(data.location.name);
        }
        return { code: 'USD', symbol: '$', name: 'US Dollar' };
    }, [data.location]);

    const handleSaveCard = (title: string, value: string | number, unit: string | undefined, category: string, icon?: string) => {
        if (onSaveCard) {
            const card: SavedInsightCard = {
                id: `${category}-${title}-${Date.now()}`,
                title,
                value,
                unit,
                category,
                icon,
                timestamp: new Date().toISOString(),
            };
            onSaveCard(card);
        }
    };

    // Bar Chart Component for Age Distribution
    const AgeDistributionChart: React.FC<{ demographics: { ageRange: string; percentage: number }[] }> = ({ demographics }) => {
        const maxPercentage = Math.max(...demographics.map(d => d.percentage));
        
        return (
            <div className="space-y-4">
                {demographics.map((demo, idx) => (
                    <div key={idx} className="relative">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">{demo.ageRange}</span>
                            <span className="text-sm font-bold text-teal-600">{demo.percentage}%</span>
                        </div>
                        <div className="h-3 bg-slate-100/70 rounded-full overflow-hidden relative shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                style={{ width: `${(demo.percentage / maxPercentage) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Pie Chart Component for Building Types
    const BuildingTypesPieChart: React.FC<{ landUse: { type: string; percentage: number }[] }> = ({ landUse }) => {
        const total = 360;
        let currentAngle = 0;
        
        const segments = landUse.map((item, idx) => {
            const angle = (item.percentage / 100) * total;
            const startAngle = currentAngle;
            currentAngle += angle;
            
            return {
                ...item,
                startAngle,
                endAngle: currentAngle,
                color: CHART_COLORS.primary[idx % CHART_COLORS.primary.length]
            };
        });

        const createArc = (startAngle: number, endAngle: number, radius: number) => {
            const start = polarToCartesian(100, 100, radius, endAngle);
            const end = polarToCartesian(100, 100, radius, startAngle);
            const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
            return `M 100 100 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
        };

        const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        };

        return (
            <div className="flex flex-col lg:flex-row items-center gap-6">
                <svg viewBox="0 0 200 200" className="w-64 h-64">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#f1f5f9" strokeWidth="20"/>
                    {segments.map((segment, idx) => (
                        <g key={idx}>
                            <path
                                d={createArc(segment.startAngle, segment.endAngle, 90)}
                                fill={segment.color}
                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                                opacity="0.9"
                            />
                        </g>
                    ))}
                    <circle cx="100" cy="100" r="60" fill="white"/>
                </svg>
                <div className="flex-1 space-y-2">
                    {segments.map((segment, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-4 h-4 rounded-full" 
                                    style={{ backgroundColor: segment.color }}
                                ></div>
                                <span className="text-sm text-slate-700">{segment.type}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900">{segment.percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Line Chart Component for Climate Data
    const ClimateLineChart: React.FC<{
        temperatures?: { month: string; temp: number }[];
        rainfall?: { month: string; rainfall: number }[];
        humidity?: { month: string; humidity: number }[];
    }> = ({ temperatures, rainfall, humidity }) => {
        const months = temperatures?.map(t => t.month) || [];
        const hasData = temperatures || rainfall || humidity;
        
        if (!hasData || months.length === 0) return null;

        const tempValues = temperatures?.map(t => t.temp) || [];
        const rainfallValues = rainfall?.map(r => r.rainfall) || [];
        const humidityValues = humidity?.map(h => h.humidity) || [];

        const maxTemp = temperatures ? Math.max(...tempValues) : 0;
        const minTemp = temperatures ? Math.min(...tempValues) : 0;
        const maxRainfall = rainfall ? Math.max(...rainfallValues) : 0;
        const maxHumidity = humidity ? Math.max(...humidityValues) : 0;

        const normalizeValue = (value: number, min: number, max: number) => {
            if (max === min) return 50;
            return ((value - min) / (max - min)) * 80 + 10;
        };

        const createPath = (values: number[], min: number, max: number) => {
            const points = values.map((value, idx) => {
                const x = (idx / (values.length - 1)) * 100;
                const y = 100 - normalizeValue(value, min, max);
                return `${x},${y}`;
            });
            return `M ${points.join(' L ')}`;
        };

        return (
            <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-200">
                <svg viewBox="0 0 100 100" className="w-full h-64" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((y) => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e2e8f0" strokeWidth="0.2" />
                    ))}
                    
                    {/* Temperature line */}
                    {temperatures && (
                        <path
                            d={createPath(tempValues, minTemp, maxTemp)}
                            fill="none"
                            stroke={CHART_COLORS.temperature}
                            strokeWidth="0.8"
                            className="transition-all duration-500"
                        />
                    )}
                    
                    {/* Rainfall line */}
                    {rainfall && (
                        <path
                            d={createPath(rainfallValues, 0, maxRainfall)}
                            fill="none"
                            stroke={CHART_COLORS.rainfall}
                            strokeWidth="0.8"
                            strokeDasharray="2,2"
                            className="transition-all duration-500"
                        />
                    )}
                    
                    {/* Humidity line */}
                    {humidity && (
                        <path
                            d={createPath(humidityValues, 0, maxHumidity)}
                            fill="none"
                            stroke={CHART_COLORS.humidity}
                            strokeWidth="0.8"
                            strokeDasharray="4,2"
                            className="transition-all duration-500"
                        />
                    )}
                </svg>
                
                {/* Month labels */}
                <div className="flex justify-between mt-2 px-1">
                    {months.map((month, idx) => (
                        <span key={idx} className="text-xs text-slate-500">{month}</span>
                    ))}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 justify-center">
                    {temperatures && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5" style={{ backgroundColor: CHART_COLORS.temperature }}></div>
                            <span className="text-xs text-slate-600">Temperature (°C)</span>
                        </div>
                    )}
                    {rainfall && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.rainfall }}></div>
                            <span className="text-xs text-slate-600">Rainfall (mm)</span>
                        </div>
                    )}
                    {humidity && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.humidity, borderStyle: 'dashed' }}></div>
                            <span className="text-xs text-slate-600">Humidity (%)</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Amenity Bar Chart
    const AmenityBarChart: React.FC<{ amenities: { category: string; count: number }[] }> = ({ amenities }) => {
        const maxCount = Math.max(...amenities.map(a => a.count));
        
        return (
            <div className="space-y-4">
                {amenities.map((amenity, idx) => (
                    <div key={idx} className="relative">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">{amenity.category}</span>
                            <span className="text-sm font-bold text-cyan-600">{amenity.count}</span>
                        </div>
                        <div className="h-3 bg-slate-100/70 rounded-full overflow-hidden relative shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                style={{ width: `${(amenity.count / maxCount) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Wind Rose Visualization
    const WindRoseChart: React.FC<{ winds: { month: string; direction: string }[] }> = ({ winds }) => {
        const directionCounts: { [key: string]: number } = {};
        winds.forEach(w => {
            directionCounts[w.direction] = (directionCounts[w.direction] || 0) + 1;
        });

        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const angleMap: { [key: string]: number } = {
            'N': 0, 'NE': 45, 'E': 90, 'SE': 135, 'S': 180, 'SW': 225, 'W': 270, 'NW': 315
        };

        return (
            <div className="flex justify-center">
                <svg viewBox="0 0 200 200" className="w-64 h-64">
                    {/* Compass rose background */}
                    <circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" strokeWidth="2"/>
                    <circle cx="100" cy="100" r="60" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    <circle cx="100" cy="100" r="40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    <circle cx="100" cy="100" r="20" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    
                    {/* Direction lines */}
                    {directions.map((dir, idx) => {
                        const angle = (idx * 45) * Math.PI / 180;
                        const x2 = 100 + 80 * Math.sin(angle);
                        const y2 = 100 - 80 * Math.cos(angle);
                        return (
                            <line key={dir} x1="100" y1="100" x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="0.5"/>
                        );
                    })}
                    
                    {/* Wind frequency bars */}
                    {Object.entries(directionCounts).map(([direction, count]) => {
                        const angle = angleMap[direction];
                        if (angle === undefined) return null;
                        
                        const length = (count / winds.length) * 60 + 20;
                        const angleRad = angle * Math.PI / 180;
                        const x2 = 100 + length * Math.sin(angleRad);
                        const y2 = 100 - length * Math.cos(angleRad);
                        
                        return (
                            <line 
                                key={direction} 
                                x1="100" 
                                y1="100" 
                                x2={x2} 
                                y2={y2} 
                                stroke={CHART_COLORS.wind} 
                                strokeWidth="6"
                                strokeLinecap="round"
                                opacity="0.8"
                            />
                        );
                    })}
                    
                    {/* Direction labels */}
                    {directions.map((dir, idx) => {
                        const angle = (idx * 45) * Math.PI / 180;
                        const x = 100 + 95 * Math.sin(angle);
                        const y = 100 - 95 * Math.cos(angle);
                        return (
                            <text key={dir} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-xs font-semibold fill-slate-700">
                                {dir}
                            </text>
                        );
                    })}
                </svg>
            </div>
        );
    };

    // Radial Progress Chart for Scores (0-100)
    const RadialScoreChart: React.FC<{ score: number; label: string; color?: string }> = ({ score, label, color = '#14b8a6' }) => {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (score / 100) * circumference;

        return (
            <div className="flex flex-col items-center">
                <svg viewBox="0 0 120 120" className="w-32 h-32">
                    {/* Background circle */}
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="10"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        className="transition-all duration-1000 ease-out"
                    />
                    {/* Score text */}
                    <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-slate-900">
                        {score}
                    </text>
                </svg>
                <span className="text-sm text-slate-700 mt-2 text-center">{label}</span>
            </div>
        );
    };

    // Horizontal Stacked Bar for Percentages
    const StackedBarChart: React.FC<{ data: { sector: string; percentage: number }[] }> = ({ data }) => {
        const colors = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];
        let cumulative = 0;

        return (
            <div className="space-y-3">
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden flex">
                    {data.map((item, idx) => {
                        const segment = (
                            <div
                                key={idx}
                                className="h-full transition-all duration-1000 ease-out flex items-center justify-center"
                                style={{
                                    width: `${item.percentage}%`,
                                    backgroundColor: colors[idx % colors.length]
                                }}
                            >
                                {item.percentage > 5 && (
                                    <span className="text-xs font-semibold text-white">{item.percentage}%</span>
                                )}
                            </div>
                        );
                        cumulative += item.percentage;
                        return segment;
                    })}
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                    {data.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: colors[idx % colors.length] }}
                            />
                            <span className="text-xs text-slate-700">{item.sector}: {item.percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Gauge Chart for Comfort Hours
    const GaugeChart: React.FC<{ value: number; max?: number; label: string }> = ({ value, max = 100, label }) => {
        const percentage = (value / max) * 100;
        const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees

        return (
            <div className="flex flex-col items-center">
                <svg viewBox="0 0 200 120" className="w-full max-w-xs">
                    {/* Background arc */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="20"
                        strokeLinecap="round"
                    />
                    {/* Progress arc */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="20"
                        strokeLinecap="round"
                        strokeDasharray={`${percentage * 2.51} 251`}
                        className="transition-all duration-1000 ease-out"
                    />
                    {/* Center value */}
                    <text x="100" y="90" textAnchor="middle" className="text-3xl font-bold fill-slate-900">
                        {value}%
                    </text>
                    <text x="100" y="110" textAnchor="middle" className="text-sm fill-slate-600">
                        {label}
                    </text>
                </svg>
            </div>
        );
    };

    // Vertical Bar Chart for Utility Distances
    const VerticalBarChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
        const maxValue = Math.max(...data.map(d => d.value));

        return (
            <div className="flex items-end justify-around gap-6 h-48">
                {data.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 max-w-[80px]">
                        <div className="w-full flex items-end justify-center h-40">
                            <div
                                className="w-12 bg-gradient-to-t from-teal-600 via-teal-500 to-teal-400 rounded-full transition-all duration-1000 ease-out flex items-end justify-center pb-3 shadow-lg"
                                style={{ height: `${(item.value / maxValue) * 100}%` }}
                            >
                                <span className="text-[10px] font-bold text-white drop-shadow-sm">{item.value}m</span>
                            </div>
                        </div>
                        <span className="text-xs text-slate-700 mt-3 text-center font-medium">{item.label}</span>
                    </div>
                ))}
            </div>
        );
    };

    const DataRow: React.FC<{ label: string; value: string | number | undefined; unit?: string; rationale?: string }> = ({ label, value, unit, rationale }) => {
        if (value === undefined || value === null || value === '') return null;
        
        return (
            <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    {rationale && (
                        <div className="group relative flex items-center">
                            <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10 whitespace-normal">
                                <p className="font-semibold mb-1">Data Rationale</p>
                                {rationale}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                        {value}
                        {unit && <span className="font-normal ml-1 text-slate-600">{unit}</span>}
                    </span>
                </div>
            </div>
        );
    };

    const TableDataRow: React.FC<{ label: string; value: number; percentage?: boolean }> = ({ label, value, percentage }) => (
        <tr className="border-b border-slate-100">
            <td className="py-2.5 px-3 text-sm text-slate-700">{label}</td>
            <td className="py-2.5 px-3 text-sm font-bold text-right text-slate-900">
                {value}{percentage && '%'}
            </td>
        </tr>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="w-full pt-0 pb-8">
                                <PageHeader
                                    className="mb-8"
                                    title="Quantitative Site Analysis"
                                    icon={<DocumentStatsIcon className="w-full h-full" />}
                                    subtitle={
                                        <span className="text-xs md:text-sm">
                                            {data.location?.name ? (
                                                <>Insights for <span className="font-semibold text-teal-700">{data.location.name}</span></>
                                            ) : (
                                                <>Comprehensive data-driven insights for urban planning</>
                                            )}
                                        </span>
                                    }
                                    actions={
                                        <div className="flex items-center gap-3">
                                            <div className="relative group">
                                                <button
                                                    className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white text-sm font-semibold shadow-md shadow-teal-500/30 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-300"
                                                    onClick={async () => {
                                                        setExporting(true);
                                                        try {
                                                            await exportQuantitativeToExcel(data, { location: data.location });
                                                        } finally { setExporting(false); }
                                                    }}
                                                    disabled={exporting}
                                                    title="Download full structured Excel export"
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                    <span className="whitespace-nowrap">{exporting ? 'Preparing…' : 'Export Excel'}</span>
                                                </button>
                                                <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-slate-900 text-white text-[10px] font-medium opacity-0 group-hover:opacity-90 transition-opacity shadow">
                                                    XLSX report
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900"></div>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                />

                {/* Dynamic Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-auto">
                {/* Demographics Section */}
                <div ref={demographicsRef} className="relative card p-6 bg-gradient-to-br from-white to-teal-50/30 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Demographics & Population
                        </h2>
                        <button
                            onClick={() => downloadCard(demographicsRef, 'Demographics_Population')}
                            className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                            title="Download as image"
                        >
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>
                    
                    <DataRow 
                        label="Potential Daily Visitors" 
                        value={data.potentialVisitors}
                        rationale={data.potentialVisitorsRationale}
                    />
                    
                    {data.averageIncomeNumeric && (
                        <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">Average Household Income</span>
                                {data.averageIncomeRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10 whitespace-normal">
                                            <p className="font-semibold mb-1">Data Rationale</p>
                                            {data.averageIncomeRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-teal-600">
                                    {formatCurrency(data.averageIncomeNumeric, currency, 0)}
                                </span>
                                <span className="text-sm ml-2 text-slate-600">/year</span>
                            </div>
                        </div>
                    )}

                    {data.ageDemographics && data.ageDemographics.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-sm font-semibold text-slate-800">Age Distribution (1km radius)</h3>
                                {data.ageDemographicsRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                            <p className="font-semibold mb-1">Data Source</p>
                                            {data.ageDemographicsRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <AgeDistributionChart demographics={data.ageDemographics} />
                        </div>
                    )}
                </div>

                {/* Land Use & Urban Fabric */}
                <div ref={landUseRef} className="relative card p-6 bg-gradient-to-br from-white to-cyan-50/30 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Land Use & Urban Fabric
                        </h2>
                        <button
                            onClick={() => downloadCard(landUseRef, 'Land_Use_Urban_Fabric')}
                            className="p-2 hover:bg-cyan-50 rounded-lg transition-colors group"
                            title="Download as image"
                        >
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>

                    <DataRow 
                        label="Green Space Ratio" 
                        value={data.greenSpaceRatio}
                        unit="%"
                        rationale={data.greenSpaceRatioRationale}
                    />

                    {data.constructionStyle && (
                        <div className="py-3 border-b border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-medium text-slate-700">Construction Style</span>
                                {data.constructionRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10 whitespace-normal">
                                            <p className="font-semibold mb-1">Construction Context</p>
                                            {data.constructionRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 rounded-xl border border-teal-200">
                                <p className="text-sm font-medium text-slate-800">{data.constructionStyle}</p>
                            </div>
                        </div>
                    )}

                    {data.constructionMaterials && data.constructionMaterials.length > 0 && (
                        <div className="py-3 border-b border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-medium text-slate-700">Common Materials</span>
                                {data.constructionRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10 whitespace-normal">
                                            <p className="font-semibold mb-1">Material Analysis</p>
                                            {data.constructionRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {data.constructionMaterials.map((material, idx) => (
                                    <button 
                                        key={idx} 
                                        className="group relative px-5 py-2.5 bg-white border-2 border-teal-300 text-teal-700 rounded-full text-sm font-semibold hover:bg-teal-50 hover:border-teal-400 transition-all duration-300 hover:scale-105 cursor-default"
                                    >
                                        <span className="relative z-10">{material}</span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-teal-400/0 via-teal-400/20 to-teal-400/0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.landUse && data.landUse.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-sm font-semibold text-slate-800">Surrounding Building Types (1km radius)</h3>
                                {data.landUseRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                            <p className="font-semibold mb-1">Data Source</p>
                                            {data.landUseRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <BuildingTypesPieChart landUse={data.landUse} />
                        </div>
                    )}
                </div>

                {/* Accessibility & Mobility */}
                <div ref={accessibilityRef} className="relative card p-6 bg-gradient-to-br from-white to-teal-50/30">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Accessibility & Mobility
                        </h2>
                        <button
                            onClick={() => downloadCard(accessibilityRef, 'Accessibility_Mobility')}
                            className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                            title="Download as image"
                        >
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>

                    <DataRow 
                        label="Public Transport Access" 
                        value={data.publicTransportAccess}
                        rationale={data.publicTransportAccessRationale}
                    />

                    {data.walkabilityScore && (
                        <div className="my-6 flex justify-center">
                            <RadialScoreChart 
                                score={data.walkabilityScore} 
                                label="Walkability Score" 
                                color="#14b8a6"
                            />
                        </div>
                    )}

                    <DataRow 
                        label="Nearby Amenities" 
                        value={data.nearbyPOIs}
                        unit="within 500m"
                        rationale={data.nearbyPOIsRationale}
                    />

                    {data.amenityBreakdown && data.amenityBreakdown.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4">Amenity Breakdown</h3>
                            <AmenityBarChart amenities={data.amenityBreakdown} />
                        </div>
                    )}
                </div>

                {/* Environmental Factors */}
                <div ref={environmentalRef} className="relative card p-6">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Environmental Factors
                        </h2>
                        <button
                            onClick={() => downloadCard(environmentalRef, 'Environmental_Factors')}
                            className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                            title="Download as image"
                        >
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>

                    <DataRow 
                        label="Estimated Noise Level" 
                        value={data.noiseLevel}
                        rationale={data.noiseLevelRationale}
                    />

                    {data.noiseDay && (
                        <DataRow 
                            label="Daytime Noise" 
                            value={data.noiseDay}
                            unit="dB"
                            rationale={data.noiseDayRationale}
                        />
                    )}

                    {data.noiseNight && (
                        <DataRow 
                            label="Nighttime Noise" 
                            value={data.noiseNight}
                            unit="dB"
                            rationale={data.noiseNightRationale}
                        />
                    )}

                    <DataRow 
                        label="Flood Risk Assessment" 
                        value={data.floodRisk}
                        rationale={data.floodRiskRationale}
                    />

                    {data.groundPermeability && (
                        <DataRow 
                            label="Ground Permeability" 
                            value={data.groundPermeability}
                            rationale={data.groundPermeabilityRationale}
                        />
                    )}

                    {data.airQualityPM25 && (
                        <DataRow 
                            label="Air Quality (PM 2.5)" 
                            value={data.airQualityPM25}
                            unit="µg/m³"
                            rationale={data.airQualityPM25Rationale}
                        />
                    )}

                    {data.airQualityNO2 && (
                        <DataRow 
                            label="Air Quality (NO₂)" 
                            value={data.airQualityNO2}
                            unit="µg/m³"
                            rationale={data.airQualityNO2Rationale}
                        />
                    )}

                    {data.treeCanopyCoverage && (
                        <DataRow 
                            label="Tree Canopy Coverage (500m)" 
                            value={data.treeCanopyCoverage}
                            unit="%"
                            rationale={data.treeCanopyCoverageRationale}
                        />
                    )}
                </div>

                {/* Urban Context & Regulation */}
                {(data.zoningFAR || data.heightLimit || data.setbackLimits || data.landValueIndex) && (
                    <div ref={urbanContextRef} className="relative card p-6 bg-gradient-to-br from-white to-slate-50/50">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Urban Context & Regulation
                            </h2>
                            <button
                                onClick={() => downloadCard(urbanContextRef, 'Urban_Context_Regulation')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>

                        {data.zoningFAR && (
                            <DataRow 
                                label="Zoning & FAR (Floor Area Ratio)" 
                                value={data.zoningFAR}
                                unit="m²/m²"
                                rationale={data.zoningFARRationale}
                            />
                        )}

                        {data.heightLimit && (
                            <DataRow 
                                label="Height Limit" 
                                value={data.heightLimit}
                                unit="m"
                                rationale={data.heightLimitRationale}
                            />
                        )}

                        {data.setbackLimits && (
                            <DataRow 
                                label="Setback Limits" 
                                value={data.setbackLimits}
                                rationale={data.setbackLimitsRationale}
                            />
                        )}

                        {data.imperviousSurfaceRatio && (
                            <DataRow 
                                label="Impervious Surface Ratio" 
                                value={data.imperviousSurfaceRatio}
                                unit="%"
                                rationale={data.imperviousSurfaceRatioRationale}
                            />
                        )}

                        {data.landValueIndex && (
                            <DataRow 
                                label="Land Value Index" 
                                value={data.landValueIndex.toLocaleString()}
                                unit={data.landValueUnit || "per m²"}
                                rationale={data.landValueIndexRationale}
                            />
                        )}

                        {(data.utilityDistanceWater || data.utilityDistanceSewer || data.utilityDistanceElectricity) && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-slate-800 mb-4">Utility Network Distance</h3>
                                <VerticalBarChart 
                                    data={[
                                        ...(data.utilityDistanceWater ? [{ label: 'Water', value: data.utilityDistanceWater }] : []),
                                        ...(data.utilityDistanceSewer ? [{ label: 'Sewer', value: data.utilityDistanceSewer }] : []),
                                        ...(data.utilityDistanceElectricity ? [{ label: 'Electricity', value: data.utilityDistanceElectricity }] : [])
                                    ]}
                                />
                            </div>
                        )}

                        {(data.permitProcessingTime || data.permitFees) && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-slate-800 mb-3">Permit & Approval</h3>
                                <div className="space-y-2">
                                    {data.permitProcessingTime && (
                                        <DataRow 
                                            label="Processing Time" 
                                            value={data.permitProcessingTime}
                                            unit="days"
                                            rationale={data.permitProcessingTimeRationale}
                                        />
                                    )}
                                    {data.permitFees && (
                                        <DataRow 
                                            label="Average Fees" 
                                            value={formatCurrency(data.permitFees, currency, 0)}
                                            unit=""
                                            rationale={data.permitFeesRationale}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Microclimate & Environmental Comfort */}
                {(data.solarRadiation || data.windSpeedRange || data.outdoorComfortHours) && (
                    <div ref={microclimateRef} className="relative card p-6 bg-gradient-to-br from-white to-teal-50/30">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Microclimate & Environmental Comfort
                            </h2>
                            <button
                                onClick={() => downloadCard(microclimateRef, 'Microclimate_Environmental_Comfort')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>

                        {data.solarRadiation && data.solarRadiation.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 className="text-sm font-semibold text-slate-800">Average Solar Radiation</h3>
                                    {data.solarRadiationRationale && (
                                        <div className="group relative flex items-center">
                                            <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                                <p className="font-semibold mb-1">Data Source</p>
                                                {data.solarRadiationRationale}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {data.solarRadiation.map((solar, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-lg p-3 text-center">
                                            <div className="text-xs text-slate-600 mb-1">{solar.orientation}</div>
                                            <div className="text-lg font-bold text-slate-900">{solar.kWhPerM2PerDay}</div>
                                            <div className="text-xs text-slate-500">kWh/m²/day</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.windSpeedRange && (
                            <DataRow 
                                label="Wind Speed Range" 
                                value={data.windSpeedRange}
                                rationale={data.windSpeedRangeRationale}
                            />
                        )}

                        {data.windDirectionSeasonal && (
                            <DataRow 
                                label="Seasonal Wind Direction" 
                                value={data.windDirectionSeasonal}
                                rationale={data.windDirectionSeasonalRationale}
                            />
                        )}

                        {data.outdoorComfortHours && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-slate-800 mb-4 text-center">Outdoor Comfort Hours</h3>
                                <GaugeChart 
                                    value={data.outdoorComfortHours} 
                                    label="of the year"
                                />
                                {data.outdoorComfortHoursRationale && (
                                    <div className="flex justify-center mt-2">
                                        <div className="group relative flex items-center">
                                            <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                                <p className="font-semibold mb-1">Data Source</p>
                                                {data.outdoorComfortHoursRationale}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Enhanced Mobility Metrics */}
                {(data.transitFrequency || data.cyclingInfrastructureDensity || data.fifteenMinuteCityIndex || data.parkingRatio || data.connectivityScore) && (
                    <div ref={mobilityRef} className="relative card p-6 bg-gradient-to-br from-white to-cyan-50/30">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Advanced Mobility Metrics
                            </h2>
                            <button
                                onClick={() => downloadCard(mobilityRef, 'Advanced_Mobility_Metrics')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            {data.fifteenMinuteCityIndex && (
                                <RadialScoreChart 
                                    score={data.fifteenMinuteCityIndex} 
                                    label="15-Min City Index" 
                                    color="#06b6d4"
                                />
                            )}
                            {data.connectivityScore && (
                                <RadialScoreChart 
                                    score={data.connectivityScore} 
                                    label="Connectivity Score" 
                                    color="#14b8a6"
                                />
                            )}
                            {data.cyclingInfrastructureDensity && (
                                <div className="flex flex-col items-center justify-center">
                                    <div className="text-4xl font-bold text-teal-600">{data.cyclingInfrastructureDensity}</div>
                                    <div className="text-sm text-slate-600 mt-1">m/km²</div>
                                    <div className="text-xs text-slate-500 mt-2 text-center">Cycling Infrastructure</div>
                                </div>
                            )}
                        </div>

                        {data.transitFrequency && (
                            <DataRow 
                                label="Transit Frequency" 
                                value={data.transitFrequency}
                                unit="vehicles/hour"
                                rationale={data.transitFrequencyRationale}
                            />
                        )}

                        {data.parkingRatio && (
                            <DataRow 
                                label="Parking Ratio" 
                                value={data.parkingRatio}
                                unit="spaces/1000m²"
                                rationale={data.parkingRatioRationale}
                            />
                        )}
                    </div>
                )}

                {/* Socio-Economic Fabric */}
                {(data.medianRent || data.medianPropertyPrice || data.householdSize || data.populationDensity) && (
                    <div ref={socioEconomicRef} className="relative card p-6 bg-gradient-to-br from-white to-slate-50/50 lg:col-span-1">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Socio-Economic Fabric
                            </h2>
                            <button
                                onClick={() => downloadCard(socioEconomicRef, 'Socio_Economic_Fabric')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>

                        {data.medianRent && (
                            <DataRow 
                                label="Median Rent" 
                                value={formatCurrency(data.medianRent, currency, 0)}
                                unit="per m²/month"
                                rationale={data.medianRentRationale}
                            />
                        )}

                        {data.medianPropertyPrice && (
                            <DataRow 
                                label="Median Property Price" 
                                value={formatCurrency(data.medianPropertyPrice, currency, 0)}
                                unit="per m²"
                                rationale={data.medianPropertyPriceRationale}
                            />
                        )}

                        {data.householdSize && (
                            <DataRow 
                                label="Average Household Size" 
                                value={data.householdSize}
                                unit="people"
                                rationale={data.householdSizeRationale}
                            />
                        )}

                        {data.populationDensity && (
                            <DataRow 
                                label="Population Density" 
                                value={data.populationDensity.toLocaleString()}
                                unit="people/km²"
                                rationale={data.populationDensityRationale}
                            />
                        )}

                        {data.annualGrowthRate && (
                            <DataRow 
                                label="Annual Growth Rate" 
                                value={data.annualGrowthRate}
                                unit="%"
                                rationale={data.annualGrowthRateRationale}
                            />
                        )}

                        {data.educationIndex && (
                            <DataRow 
                                label="Education Index" 
                                value={data.educationIndex}
                                unit="% with tertiary degree"
                                rationale={data.educationIndexRationale}
                            />
                        )}

                        {data.diversityMigrationIndex && (
                            <DataRow 
                                label="Diversity & Migration Index" 
                                value={data.diversityMigrationIndex}
                                unit="/ 100"
                                rationale={data.diversityMigrationIndexRationale}
                            />
                        )}

                        {data.employmentSectorSplit && data.employmentSectorSplit.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="text-sm font-semibold text-slate-800">Employment Sector Split</h3>
                                    {data.employmentSectorSplitRationale && (
                                        <div className="group relative flex items-center">
                                            <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                                <p className="font-semibold mb-1">Data Source</p>
                                                {data.employmentSectorSplitRationale}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <StackedBarChart data={data.employmentSectorSplit} />
                            </div>
                        )}
                    </div>
                )}

                {/* Climate Data */}
                {(data.monthlyTemperatures || data.monthlyWinds || data.monthlyRainfall || data.monthlyHumidity) && (
                    <div ref={climateRef} className="relative card p-6 bg-gradient-to-br from-white to-teal-50/30 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex items-center justify-between flex-1 pb-3 border-b-2 border-teal-500">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    Climatic Conditions
                                </h2>
                                <button
                                    onClick={() => downloadCard(climateRef, 'Climatic_Conditions')}
                                    className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                    title="Download as image"
                                >
                                    <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            </div>
                            {data.climaticDataRationale && (
                                <div className="group relative flex items-center">
                                    <InfoIcon className="w-5 h-5 text-slate-400 cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                        <p className="font-semibold mb-1">Climate Data Source</p>
                                        {data.climaticDataRationale}
                                        <div className="absolute top-full right-4 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Combined Climate Chart */}
                        {(data.monthlyTemperatures || data.monthlyRainfall || data.monthlyHumidity) && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-slate-800 mb-4">Climate Overview (All Metrics)</h3>
                                <ClimateLineChart 
                                    temperatures={data.monthlyTemperatures}
                                    rainfall={data.monthlyRainfall}
                                    humidity={data.monthlyHumidity}
                                />
                            </div>
                        )}

                        {/* Individual Climate Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            {/* Temperature */}
                            {data.monthlyTemperatures && data.monthlyTemperatures.length > 0 && (
                                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse"></span>
                                        Temperature (°C)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {data.monthlyTemperatures.map((temp, idx) => (
                                            <div key={idx} className="text-center">
                                                <div className="text-xs text-slate-600 mb-1">{temp.month}</div>
                                                <div className="text-sm font-bold text-slate-900">{temp.temp}°</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rainfall */}
                            {data.monthlyRainfall && data.monthlyRainfall.length > 0 && (
                                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse"></span>
                                            Rainfall (mm)
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {data.monthlyRainfall.map((rain, idx) => (
                                            <div key={idx} className="text-center">
                                                <div className="text-xs text-slate-600 mb-1">{rain.month}</div>
                                                <div className="text-sm font-bold text-slate-900">{rain.rainfall}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Humidity */}
                            {data.monthlyHumidity && data.monthlyHumidity.length > 0 && (
                                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-teal-300 animate-pulse"></span>
                                        Humidity (%)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {data.monthlyHumidity.map((hum, idx) => (
                                            <div key={idx} className="text-center">
                                                <div className="text-xs text-slate-600 mb-1">{hum.month}</div>
                                                <div className="text-sm font-bold text-slate-900">{hum.humidity}%</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Wind Direction */}
                            {data.monthlyWindRose ? (
                                <div className="col-span-1 md:col-span-2">
                                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-teal-600 animate-pulse"></span>
                                            Monthly Wind Rose (Speed & Direction)
                                        </h3>
                                        <MonthlyWindRose data={data.monthlyWindRose} />
                                    </div>
                                </div>
                            ) : (
                                data.monthlyWinds && data.monthlyWinds.length > 0 && (
                                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-teal-600 animate-pulse"></span>
                                            Wind Rose Diagram
                                        </h3>
                                        <WindRoseChart winds={data.monthlyWinds} />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Proximity Analysis */}
                {data.proximityAnalysis && data.proximityAnalysis.length > 0 && (
                    <div ref={proximityRef} className="relative card p-6">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Proximity Analysis (1km radius)
                            </h2>
                            <button
                                onClick={() => downloadCard(proximityRef, 'Proximity_Analysis')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Group by category */}
                            {Object.entries(
                                data.proximityAnalysis.reduce((acc, item) => {
                                    (acc[item.category] = acc[item.category] || []).push(item);
                                    return acc;
                                }, {} as { [key: string]: typeof data.proximityAnalysis })
                            ).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, items]) => (
                                <div key={category} className="bg-slate-50 rounded-lg p-4">
                                    <h3 className="font-semibold text-sm text-slate-800 mb-3 uppercase tracking-wide">{category}</h3>
                                    <table className="w-full">
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-200 last:border-0">
                                                    <td className="py-2 text-sm text-slate-700">{item.name}</td>
                                                    <td className="py-2 text-sm font-mono font-semibold text-right text-slate-900">{item.distance}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Case Study Projects */}
                {data.caseStudyProjects && data.caseStudyProjects.length > 0 && (
                    <div ref={caseStudiesRef} className="relative card p-6 bg-gradient-to-br from-white to-teal-50/30">
                        <div className="flex items-center justify-between mb-2 pb-3 border-b-2 border-teal-500">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Relevant Case Studies
                            </h2>
                            <button
                                onClick={() => downloadCard(caseStudiesRef, 'Relevant_Case_Studies')}
                                className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
                                title="Download as image"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-6">
                            Similar projects based on climate, context, and program. Study these for inspiration and design strategies.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {data.caseStudyProjects.map((project, idx) => (
                                <div 
                                    key={idx} 
                                    className="group relative bg-white rounded-xl border-2 border-teal-200 hover:border-teal-400 p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
                                >
                                    {/* Animated background gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-transparent to-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    
                                    <div className="relative z-10">
                                        {/* Project header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                                                    {project.name}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {project.location}
                                                </p>
                                            </div>
                                            {project.sourceUrl && (
                                                <a 
                                                    href={project.sourceUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-teal-600 hover:text-teal-700 transition-colors"
                                                    title="View source"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                                    </svg>
                                                </a>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-slate-700 mb-3 leading-relaxed">
                                            {project.description}
                                        </p>

                                        {/* Relevance badge */}
                                        <div className="mt-4 pt-3 border-t border-slate-200">
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-semibold text-teal-700 mt-0.5">Why relevant:</span>
                                                <p className="text-xs text-slate-600 flex-1">
                                                    {project.relevance}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                </div> {/* End Dynamic Grid */}

                {/* Footer note */}
                <div className="mt-8 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <p className="text-xs text-slate-600 text-center">
                        <span className="font-semibold">Note:</span> All data is based on location analysis and public datasets.
                    </p>
                </div>
            </div>
        </div>
    );
};
