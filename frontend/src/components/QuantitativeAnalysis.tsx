import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { QuantitativeData, ProximityItem, LocationData } from '../types';
import { 
    UsersIcon, 
    TransportIcon, 
    DollarSignIcon, 
    LeafIcon, 
    TemperatureIcon, 
    WindIcon, 
    WalkIcon, 
    MapPinIcon, 
    SunIcon, 
    SpeakerIcon, 
    WaterIcon,
    InfoIcon,
    ShieldCheckIcon,
    HeartIcon,
    ShoppingCartIcon,
    BuildingStorefrontIcon,
    AcademicCapIcon,
    BriefcaseIcon,
    GlobeAltIcon,
    TruckIcon,
    SparklesIcon,
    BuildingLibraryIcon,
    WrenchScrewdriverIcon,
    FireIcon,
    CafeIcon,
    ParkingIcon,
    ParkIcon,
    OfficeBuildingIcon,
    DownloadIcon,
} from './Icons';
// Removed Excel export button from this legacy panel per UX change.

const COLORS = ["#14b8a6", "#2dd4bf", "#0f766e", "#0d9488", "#5eead4", "#99f6e4"];

// --- Chart Components ---

interface PieChartProps {
    data: { name: string; value: number }[];
}

const PieChart: React.FC<PieChartProps> = ({ data }) => {
    const size = 128;
    const center = size / 2;
    const radius = size / 2 - 4; // small padding
    const holeRadius = radius / 1.8; 

    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <div className="text-center text-gray-500">No data for chart.</div>;
    
    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (r * Math.cos(angleInRadians)),
            y: centerY + (r * Math.sin(angleInRadians))
        };
    };

    let startAngle = 0;
    const segments = data.map((item, index) => {
        const percent = item.value / total;
        // prevent segments from being too small to render properly
        if (percent * 360 < 1) return null;
        const angle = percent * 360;
        const endAngle = startAngle + angle;
        
        const start = polarToCartesian(center, center, radius, endAngle);
        const end = polarToCartesian(center, center, radius, startAngle);
        
        const startHole = polarToCartesian(center, center, holeRadius, endAngle);
        const endHole = polarToCartesian(center, center, holeRadius, startAngle);

        const largeArcFlag = angle > 180 ? "1" : "0";

        const d = [
          "M", start.x, start.y,
          "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
          "L", endHole.x, endHole.y,
          "A", holeRadius, holeRadius, 0, largeArcFlag, 1, startHole.x, startHole.y,
          "Z"
        ].join(" ");

        const segmentData = {
            ...item,
            percent: (percent * 100).toFixed(1),
            color: COLORS[index % COLORS.length],
            d: d
        };
        startAngle = endAngle;
        return segmentData;
    }).filter(Boolean);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
             <div className="w-32 h-32 flex-shrink-0">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {segments.map(s => s && (
                        <path key={s.name} d={s.d} fill={s.color} />
                    ))}
                </svg>
            </div>
            <div className="flex-1 w-full">
                <ul className="space-y-2">
                    {segments.map(s => s && (
                        <li key={s.name} className="flex items-center text-sm">
                            <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: s.color }}></span>
                            <span className="font-semibold text-slate-800 truncate pr-2">{s.name}:</span>
                            <span className="ml-auto text-slate-700 font-mono">{s.percent}%</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};


interface BarChartProps {
    data: { name: string; value: number }[];
}
const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const maxValue = Math.max(...data.map(item => item.value), 0);
     if (maxValue === 0) return <div className="text-center text-gray-500">No data for chart.</div>;
    return (
        <div className="space-y-3">
            {data.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3 text-sm">
                    <span className="w-20 truncate text-slate-600" title={item.name}>{item.name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4">
                        <div
                            className="h-4 rounded-full"
                            style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                    </div>
                    <span className="w-10 text-right font-semibold">{item.value}%</span>
                </div>
            ))}
        </div>
    );
};

// --- New Chart Components ---

interface TemperatureChartProps {
    data: { month: string; temp: number }[];
}

const TemperatureChart: React.FC<TemperatureChartProps> = ({ data }) => {
    const width = 300;
    const height = 150;
    const margin = { top: 20, right: 10, bottom: 30, left: 30 };

    const temps = data.map(d => d.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    
    const tempRange = maxTemp - minTemp;
    const yMin = tempRange > 0 ? Math.floor(minTemp - tempRange * 0.1) : minTemp - 5;
    const yMax = tempRange > 0 ? Math.ceil(maxTemp + tempRange * 0.1) : maxTemp + 5;
    
    const xScale = (index: number) => margin.left + (index / (data.length - 1)) * (width - margin.left - margin.right);
    const yScale = (temp: number) => height - margin.bottom - ((temp - yMin) / (yMax - yMin)) * (height - margin.top - margin.bottom);

    const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.temp)}`).join(' ');

    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Monthly temperature chart">
                <text x={margin.left - 8} y={yScale(yMax) + 4} textAnchor="end" fontSize="8" fill="currentColor" className="text-slate-600">{yMax}°</text>
                <text x={margin.left - 8} y={yScale(yMin) + 4} textAnchor="end" fontSize="8" fill="currentColor" className="text-slate-600">{yMin}°</text>
                
                <line x1={margin.left} y1={yScale(yMax)} x2={width - margin.right} y2={yScale(yMax)} stroke="currentColor" strokeWidth="0.5" className="text-slate-100" />
                <line x1={margin.left} y1={yScale(yMin)} x2={width - margin.right} y2={yScale(yMin)} stroke="currentColor" strokeWidth="0.5" className="text-slate-100" />

                <path d={pathData} fill="none" stroke="#14b8a6" strokeWidth="2" />

                {data.map((d, i) => (
                    <g key={d.month}>
                        <circle cx={xScale(i)} cy={yScale(d.temp)} r="3" fill="#14b8a6" />
                        <text x={xScale(i)} y={height - margin.bottom + 13} textAnchor="middle" fontSize="8" fill="currentColor" className="text-slate-600">
                            {d.month}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

interface WindChartProps {
    data: { month: string; direction: string }[];
}

const WindChart: React.FC<WindChartProps> = ({ data }) => {
    const getRotation = (direction: string = "N") => {
        const directions: { [key: string]: number } = {
            N: 0, NE: 45, E: 90, SE: 135,
            S: 180, SW: 225, W: 270, NW: 315
        };
        return directions[direction.toUpperCase()] || 0;
    };
    
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 text-center">
            {data.map(({ month, direction }) => (
                <div key={month} className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-sm font-semibold text-slate-800">{month}</p>
                    <div className="flex justify-center items-center mt-1">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ transform: `rotate(${getRotation(direction)}deg)` }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-4 4m4-4l4 4" />
                        </svg>
                        <span className="ml-1.5 font-mono text-slate-900 text-xs">{direction}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

interface RainfallChartProps {
    data: { month: string; rainfall: number }[];
}

const RainfallChart: React.FC<RainfallChartProps> = ({ data }) => {
    const width = 300;
    const height = 150;
    const margin = { top: 20, right: 10, bottom: 30, left: 35 };

    const rainfalls = data.map(d => d.rainfall);
    const maxRainfall = Math.max(...rainfalls, 0);
    const yMax = Math.ceil(maxRainfall * 1.1);
    
    const xScale = (index: number) => margin.left + (index / (data.length - 1)) * (width - margin.left - margin.right);
    const barWidth = (width - margin.left - margin.right) / data.length;
    
    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Monthly rainfall chart">
                <text x={margin.left - 5} y={margin.top - 5} textAnchor="end" fontSize="8" fill="currentColor" className="text-slate-600">{yMax}mm</text>
                <text x={margin.left - 5} y={height - margin.bottom + 4} textAnchor="end" fontSize="8" fill="currentColor" className="text-slate-600">0</text>
                
                <line x1={margin.left} y1={margin.top} x2={width - margin.right} y2={margin.top} stroke="currentColor" strokeWidth="0.5" className="text-slate-100" />
                <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="currentColor" strokeWidth="0.5" className="text-slate-100" />

                {data.map((d, i) => {
                    const barHeight = yMax > 0 ? (d.rainfall / yMax) * (height - margin.top - margin.bottom) : 0;
                    const barX = margin.left + (i * barWidth) + barWidth * 0.2;
                    const barY = height - margin.bottom - barHeight;
                    
                    return (
                        <g key={d.month}>
                            <rect 
                                x={barX} 
                                y={barY} 
                                width={barWidth * 0.6} 
                                height={barHeight} 
                                fill="#14b8a6" 
                                rx="2"
                            />
                            <text x={barX + barWidth * 0.3} y={height - margin.bottom + 13} textAnchor="middle" fontSize="8" fill="currentColor" className="text-slate-600">
                                {d.month}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};


// --- Stat Card Component for new data ---
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number | undefined; unit?: string; rationale?: string; }> = ({ icon, label, value, unit, rationale }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200/60 hover:border-teal-400/40 transition-all">
            <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-teal-600">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    {rationale && (
                        <div className="group relative flex items-center">
                            <InfoIcon className="w-3 h-3 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                <p className="font-semibold mb-1">Estimation Rationale</p>
                                {rationale}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </div>
                <p className="text-xl font-bold text-slate-900 truncate leading-tight">
                    {value}
                    {unit && <span className="text-sm font-medium text-slate-500 ml-1">{unit}</span>}
                </p>
            </div>
        </div>
    );
};


// --- Main Component ---
interface QuantitativeAnalysisProps {
    data: QuantitativeData;
    location?: LocationData | null;
    onViewDetails?: () => void;
}

export const QuantitativeAnalysis: React.FC<QuantitativeAnalysisProps> = ({ data, location, onViewDetails }) => {
    const proximityData = data.proximityAnalysis;
    const [exporting, setExporting] = useState(false);

    // Refs for chart capture
    const landUseRef = useRef<HTMLDivElement | null>(null);
    const ageRef = useRef<HTMLDivElement | null>(null);
    const tempRef = useRef<HTMLDivElement | null>(null);
    const rainRef = useRef<HTMLDivElement | null>(null);
    const windRef = useRef<HTMLDivElement | null>(null);

    const groupedProximity = useMemo(() => {
        if (!proximityData) return {};
        return proximityData.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {} as { [key: string]: ProximityItem[] });
    }, [proximityData]);

    const categoryDetails: { [key: string]: { icon: React.ReactNode; name: string } } = {
        'Safety': { icon: <ShieldCheckIcon className="w-5 h-5"/>, name: 'Safety & Emergency' },
        'Healthcare': { icon: <HeartIcon className="w-5 h-5"/>, name: 'Healthcare' },
        'Daily Needs': { icon: <ShoppingCartIcon className="w-5 h-5"/>, name: 'Daily Needs' },
        'Lifestyle': { icon: <BuildingStorefrontIcon className="w-5 h-5"/>, name: 'Lifestyle & Shopping' },
        'Shopping': { icon: <BuildingStorefrontIcon className="w-5 h-5"/>, name: 'Shopping' },
        'Recreation': { icon: <ParkIcon className="w-5 h-5"/>, name: 'Recreation' },
        'Education': { icon: <AcademicCapIcon className="w-5 h-5"/>, name: 'Education' },
        'Child Care': { icon: <UsersIcon className="w-5 h-5"/>, name: 'Child Care' },
        'Work': { icon: <BriefcaseIcon className="w-5 h-5"/>, name: 'Work & Business' },
        'Nature': { icon: <GlobeAltIcon className="w-5 h-5"/>, name: 'Nature & Greenery' },
        'Transit': { icon: <TransportIcon className="w-5 h-5"/>, name: 'Public Transit' },
        'Civic': { icon: <OfficeBuildingIcon className="w-5 h-5"/>, name: 'Civic Services' },
        'Sustainability': { icon: <LeafIcon className="w-5 h-5"/>, name: 'Sustainability' },
        'Finance': { icon: <DollarSignIcon className="w-5 h-5"/>, name: 'Finance' },
        'Logistics': { icon: <TruckIcon className="w-5 h-5"/>, name: 'Logistics' },
        'Parking': { icon: <ParkingIcon className="w-5 h-5"/>, name: 'Parking' },
        'Food & Drink': { icon: <CafeIcon className="w-5 h-5"/>, name: 'Food & Drink' },
        'Wellness': { icon: <SparklesIcon className="w-5 h-5"/>, name: 'Wellness & Fitness' },
        'Hospitality': { icon: <BuildingLibraryIcon className="w-5 h-5"/>, name: 'Hospitality' },
        'Culture': { icon: <SparklesIcon className="w-5 h-5"/>, name: 'Culture & Arts' },
        'Transport': { icon: <TransportIcon className="w-5 h-5"/>, name: 'Transport Links' },
        'Utilities': { icon: <WrenchScrewdriverIcon className="w-5 h-5"/>, name: 'Utilities' },
    };
    
    const TitleWithRationale: React.FC<{ title: string; rationale?: string; className?: string }> = ({ title, rationale, className }) => (
        <div className={`flex items-center gap-2 ${className}`}>
            <h4 className="font-semibold text-slate-800">{title}</h4>
            {rationale && (
                <div className="group relative flex items-center">
                    <InfoIcon className="w-4 h-4 text-slate-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                        <p className="font-semibold mb-1">Data Rationale</p>
                        {rationale}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
    );
    
    return (
        <div className="card p-6 space-y-6">
            <div className="border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">Quantitative Insights</h3>
                {data.location?.name && <p className="text-xs text-slate-500 mt-1">{data.location.name}</p>}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <StatCard 
                    icon={<UsersIcon className="w-5 h-5"/>}
                    label="Potential Visitors"
                    value={data.potentialVisitors}
                    unit="daily"
                    rationale={data.potentialVisitorsRationale}
                 />
                 <StatCard 
                    icon={<LeafIcon className="w-5 h-5"/>}
                    label="Green Space"
                    value={data.greenSpaceRatio}
                    unit="%"
                    rationale={data.greenSpaceRatioRationale}
                 />
                 <StatCard 
                    icon={<TransportIcon className="w-5 h-5"/>}
                    label="Public Transport"
                    value={data.publicTransportAccess}
                    rationale={data.publicTransportAccessRationale}
                 />
                 <StatCard 
                    icon={<DollarSignIcon className="w-5 h-5"/>}
                    label="Avg. Income"
                    value={data.averageIncome}
                    rationale={data.averageIncomeRationale}
                 />
                 <StatCard
                    icon={<WalkIcon className="w-5 h-5"/>}
                    label="Walkability Score"
                    value={data.walkabilityScore}
                    unit="/ 100"
                    rationale={data.walkabilityScoreRationale}
                />
                <StatCard
                    icon={<MapPinIcon className="w-5 h-5"/>}
                    label="Nearby Amenities"
                    value={data.nearbyPOIs}
                    unit="in 500m"
                    rationale={data.nearbyPOIsRationale}
                />
                <StatCard
                    icon={<SpeakerIcon className="w-5 h-5"/>}
                    label="Est. Noise Level"
                    value={data.noiseLevel}
                    rationale={data.noiseLevelRationale}
                />
                <StatCard
                    icon={<WaterIcon className="w-5 h-5"/>}
                    label="Flood Risk"
                    value={data.floodRisk}
                    rationale={data.floodRiskRationale}
                />
            </div>
            
            {data.landUse && data.landUse.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                    <TitleWithRationale 
                        title="Surrounding Building Types (1km)" 
                        rationale={data.landUseRationale}
                        className="mb-4 text-sm"
                    />
                    <div ref={landUseRef} data-export-id="chart-landuse" className="bg-white p-2 rounded-md">
                        <PieChart data={data.landUse.map(d => ({ name: d.type, value: d.percentage }))} />
                    </div>
                </div>
            )}

            {data.ageDemographics && data.ageDemographics.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                    <TitleWithRationale 
                        title="Local Age Demographics (1km)" 
                        rationale={data.ageDemographicsRationale}
                        className="mb-4 text-sm"
                    />
                    <div ref={ageRef} data-export-id="chart-age" className="bg-white p-2 rounded-md">
                        <BarChart data={data.ageDemographics.map(d => ({ name: d.ageRange, value: d.percentage }))} />
                    </div>
                </div>
            )}

            {(data.monthlyTemperatures || data.monthlyWinds || data.monthlyRainfall) && (
                    <div className="border-t border-slate-200 pt-6 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-lg p-4 -mx-2"
                         onClick={onViewDetails}
                         title="Click to view detailed quantitative analysis">
                         <div className="flex items-center justify-between mb-4">
                             <TitleWithRationale 
                                title="Climatic Conditions"
                                rationale={data.climaticDataRationale}
                                className="text-sm"
                             />
                             <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                             </svg>
                         </div>
                    <div className="space-y-4">
                    {data.monthlyTemperatures && data.monthlyTemperatures.length > 0 && (
                        <div ref={tempRef} data-export-id="chart-temp" className="bg-white p-2 rounded-md">
                            <h5 className="font-medium mb-2 text-slate-700 text-xs">Average Monthly Temperature (°C)</h5>
                            <TemperatureChart data={data.monthlyTemperatures} />
                        </div>
                    )}

                    {data.monthlyRainfall && data.monthlyRainfall.length > 0 && (
                        <div ref={rainRef} data-export-id="chart-rain" className="bg-white p-2 rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-medium text-slate-700 text-xs">Monthly Rainfall (mm)</h5>
                                {data.rainfallRationale && (
                                    <div className="group relative flex items-center">
                                        <InfoIcon className="w-3 h-3 text-slate-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-10">
                                            <p className="font-semibold mb-1">Rainfall Data</p>
                                            {data.rainfallRationale}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <RainfallChart data={data.monthlyRainfall} />
                        </div>
                    )}

                    {data.monthlyWinds && data.monthlyWinds.length > 0 && (
                        <div ref={windRef} data-export-id="chart-wind" className="bg-white p-2 rounded-md">
                            <h5 className="font-medium mb-2 text-slate-700 text-xs">Dominant Monthly Winds</h5>
                            <WindChart data={data.monthlyWinds} />
                        </div>
                    )}
                    </div>
                </div>
            )}

            {proximityData && proximityData.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                    <h4 className="font-semibold mb-3 text-slate-900 text-sm">Proximity Analysis (1km Radius)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* FIX: Explicitly type the destructured 'items' parameter to resolve a TypeScript error where it was inferred as 'unknown' from Object.entries. */}
                        {Object.entries(groupedProximity).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, items]: [string, ProximityItem[]]) => (
                            <div key={category} className="p-3 bg-slate-50/50 rounded-lg border border-slate-200/60">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-teal-600">{categoryDetails[category]?.icon || <InfoIcon className="w-4 h-4"/>}</span>
                                    <h5 className="font-semibold text-xs text-slate-800">{categoryDetails[category]?.name || category}</h5>
                                </div>
                                <ul className="space-y-1.5">
                                    {items.map((item, index) => (
                                        <li key={index} className="flex justify-between items-center text-xs gap-2">
                                            <span className="text-slate-700 truncate" title={item.name}>{item.name}</span>
                                            <span className="font-mono text-[10px] text-slate-500 flex-shrink-0 bg-white px-1.5 py-0.5 rounded">{item.distance}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};