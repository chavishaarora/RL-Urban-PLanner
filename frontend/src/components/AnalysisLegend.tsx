// @ts-nocheck
import React from 'react';

interface AnalysisLegendProps {
  type: 'solar' | 'wind' | 'shadow' | 'comfort';
  range?: { min: number; max: number } | null;
  colorScheme?: 'viridis' | 'plasma' | 'inferno' | 'magma';
}

function formatValue(type: AnalysisLegendProps['type'], v: number): string {
  if (!isFinite(v)) return '-';
  switch (type) {
    case 'solar':
      // W/m², compact
      return `${Math.round(v)} W/m²`;
    case 'wind':
      return `${v.toFixed(1)} m/s`;
    case 'shadow':
      return `${v.toFixed(1)} h`;
    case 'comfort':
    default:
      return `${v.toFixed(1)} °C`;
  }
}

function gradientForScheme(scheme: string) {
  switch (scheme) {
    case 'viridis':
      return 'linear-gradient(90deg, #440154 0%, #31688e 50%, #35b779 70%, #fde725 100%)';
    case 'inferno':
      return 'linear-gradient(90deg, #000004 0%, #b53679 50%, #fb9f3a 75%, #fcffa4 100%)';
    case 'magma':
      return 'linear-gradient(90deg, #000004 0%, #5b1a5e 45%, #b63679 70%, #fbfdbf 100%)';
    case 'plasma':
    default:
      return 'linear-gradient(90deg, #0d0887 0%, #7e03a8 40%, #cc4778 70%, #f0f921 100%)';
  }
}

export const AnalysisLegend: React.FC<AnalysisLegendProps> = ({ type, range, colorScheme = 'plasma' }) => {
  const label = type === 'solar' ? 'Solar Radiation' : type === 'wind' ? 'Wind Speed' : type === 'shadow' ? 'Shadow Hours' : 'Thermal Comfort';
  const gradient = gradientForScheme(colorScheme);

  const min = range?.min;
  const max = range?.max;

  return (
    <div className="mt-2 select-none">
      <div className="px-3 py-2 rounded-full shadow-lg border border-teal-200/60 bg-white/90 backdrop-blur-sm inline-flex items-center gap-3">
        <span className="text-xs font-semibold text-teal-800">{label}</span>
        <div className="h-3 w-40 rounded-full" style={{ background: gradient }} />
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <span className="font-mono">{min !== undefined ? formatValue(type, min) : '-'}</span>
          <span>–</span>
          <span className="font-mono">{max !== undefined ? formatValue(type, max) : '-'}</span>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLegend;
