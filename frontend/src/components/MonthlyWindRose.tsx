import React from 'react';
import { QuantitativeData } from '../types';

// Small, reusable radial segment chart for one month
const Rose: React.FC<{
  month: string;
  directionLabels: string[];
  speedBins: number[];
  bins: { direction: string; speedFrequencies: number[] }[];
  unit: 'hours' | 'percent';
}> = ({ month, directionLabels, speedBins, bins, unit }) => {
  const size = 220; // svg size
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 20;
  const sectors = directionLabels.length;
  const sectorAngle = (2 * Math.PI) / sectors;

  // Calculate max total per direction for scaling (percent uses 100 as max)
  const totals = bins.map(b => b.speedFrequencies.reduce((a, v) => a + v, 0));
  const maxValue = unit === 'percent' ? 100 : Math.max(1, ...totals);

  const colors = ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'];

  const polar = (angle: number, radius: number) => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];

  const pathForSegment = (
    startAng: number,
    endAng: number,
    innerR: number,
    outerR: number
  ) => {
    const [x0, y0] = polar(startAng, innerR);
    const [x1, y1] = polar(endAng, innerR);
    const [x2, y2] = polar(endAng, outerR);
    const [x3, y3] = polar(startAng, outerR);
    const largeArc = endAng - startAng > Math.PI ? 1 : 0;
    return `M ${x3} ${y3} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x1} ${y1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x0} ${y0} Z`;
  };

  // map bins by direction for easy lookup
  const byDir = new Map(bins.map(b => [b.direction, b] as const));

  return (
    <div className="bg-gradient-to-br from-white to-teal-50 p-4 rounded-xl border border-teal-200 group relative overflow-hidden transition hover:shadow-lg hover:border-teal-300">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-100/0 via-teal-100/20 to-cyan-100/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800">{month}</h4>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {speedBins.slice(0, -1).map((_, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: colors[i % colors.length] }} />
              <span>{speedBins[i]}–{speedBins[i+1]} m/s</span>
            </span>
          ))}
        </div>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        {/* rings */}
        {[0.25, 0.5, 0.75, 1].map((t, idx) => (
          <circle key={idx} cx={cx} cy={cy} r={maxRadius * t} fill="none" stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {/* direction spokes */}
        {directionLabels.map((_, i) => {
          const a = -Math.PI / 2 + i * sectorAngle; // start at north
          const [x, y] = polar(a, maxRadius);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#cbd5e1" strokeWidth={0.5} />
        })}
        {/* labels N,E,S,W */}
        {['N','E','S','W'].map((d, idx) => {
          const angles: Record<string, number> = { N: -Math.PI/2, E: 0, S: Math.PI/2, W: Math.PI };
          const a = angles[d];
          const [x, y] = polar(a, maxRadius + 10);
          return <text key={idx} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-slate-500">{d}</text>
        })}

        {/* stacked sectors */}
        {directionLabels.map((dir, i) => {
          const data = byDir.get(dir);
          const start = -Math.PI / 2 + i * sectorAngle;
          const end = start + sectorAngle * 0.9; // small gap
          if (!data) return null;
          const total = data.speedFrequencies.reduce((a,v)=>a+v,0);
          let inner = 0;
          return (
            <g key={dir}>
              {data.speedFrequencies.map((v, k) => {
                const outer = inner + (total === 0 ? 0 : (v / maxValue) * maxRadius);
                const d = pathForSegment(start, end, inner, outer);
                const path = <path key={k} d={d} fill={colors[k % colors.length]} opacity={0.9} stroke="#ffffff" strokeWidth={0.5}/>;
                inner = outer;
                return path;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const MonthlyWindRose: React.FC<{ data: QuantitativeData['monthlyWindRose'] }>= ({ data }) => {
  if (!data) return null;
  const directionLabels = data.directionLabels && data.directionLabels.length > 0
    ? data.directionLabels
    : ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

  const unit = data.unit || 'percent';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.months.map((m) => (
        <Rose
          key={m.month}
          month={m.month}
          directionLabels={directionLabels}
          speedBins={data.speedBins}
          bins={m.directionBins}
          unit={unit}
        />
      ))}
    </div>
  );
};

export default MonthlyWindRose;
