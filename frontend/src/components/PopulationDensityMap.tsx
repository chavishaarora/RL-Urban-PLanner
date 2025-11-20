import React, { useEffect, useMemo, useState } from 'react';
import { estimatePopulationGrid, classifyDensity, DENSITY_COLORS, DensityCell } from '@/services/populationDensity';
import { fetchGooglePlacesNearby } from '@/services/googlePlacesService';
import { renderMapBackground, clearMapBackground, MapBackgroundOverlays } from '@/utils/mapBackground';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

interface PopulationDensityMapProps {
  center: { lat:number; lng:number };
  boundary?: { lat: number; lng: number }[];
  radiusMeters?: number;
  cellSizeMeters?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  googleMap?: any;
}

type DensityMode = 'Base' | 'Blended' | 'Daytime' | 'Nighttime';

const POI_WEIGHTS: Record<string, number> = {
  Education: 200,
  Healthcare: 250,
  Retail: 40,
  'Food & Drink': 35,
  Transit: 180,
  Culture: 120,
  Recreation: 90,
  Other: 25,
};

const PopulationDensityMap: React.FC<PopulationDensityMapProps> = ({ center, boundary, radiusMeters = 700, cellSizeMeters = 70, googleMap }) => {
  const [cells, setCells] = useState<DensityCell[]>([]);
  const [mode, setMode] = useState<DensityMode>('Blended');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideLow, setHideLow] = useState(false);
  const [hoverCell, setHoverCell] = useState<DensityCell | null>(null);
  const [poiInfluence, setPoiInfluence] = useState<Record<string, number>>({});
  const [adaptive, setAdaptive] = useState(true);
  const [backgroundOverlays, setBackgroundOverlays] = useState<MapBackgroundOverlays | null>(null);

  // Mount background once; if center changes significantly we could refetch (rare for current workflow)
  useEffect(() => {
    if (!googleMap) return;
    let canceled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        if (backgroundOverlays) clearMapBackground(backgroundOverlays);
        const bg = await renderMapBackground(googleMap, center, boundary);
        if (!canceled) setBackgroundOverlays(bg);
        const { cells } = await estimatePopulationGrid(center, radiusMeters, cellSizeMeters);
        if (!canceled) setCells(cells);
      } catch (e:any) {
        if (!canceled) setError(e.message || 'Failed to estimate density');
      } finally { if (!canceled) setLoading(false); }
    })();
    return () => { canceled = true; };
    // intentionally exclude backgroundOverlays from deps
  }, [googleMap, center.lat, center.lng, radiusMeters, cellSizeMeters, boundary]);

  useEffect(() => {
    let canceled = false;
    async function enrich(){
      if(!googleMap || !cells.length) return;
      let places: Array<{lat:number; lng:number; category:string}> = [];
      try {
        places = await fetchGooglePlacesNearby(center, radiusMeters);
      } catch (e) {
        // Fail open: no POI weighting, but keep map alive
        console.warn('PopulationDensityMap: POI weighting skipped (Places fetch failed).');
        places = [];
      }
      if(canceled) return;
      const influence: Record<string, number> = {};
      places.forEach(p => {
        let best: DensityCell | null = null; let bestDist = Infinity;
        cells.forEach(c => {
          const d = Math.pow(c.center.lat - p.lat,2) + Math.pow(c.center.lng - p.lng,2);
          if(d < bestDist){ bestDist = d; best = c; }
        });
        if(best){
          const key = `${best.i},${best.j}`;
          influence[key] = (influence[key] || 0) + (POI_WEIGHTS[p.category] || 20);
        }
      });
      setPoiInfluence(influence);
    }
    enrich();
    return () => { canceled = true; };
  }, [googleMap, cells, center, radiusMeters]);

  function exportCSV(){
    const header = ['i','j','lat','lng','residentialPersons','dayActivityPersons','nightActivityPersons','blendedPersons','percentile','baseDensityPpkm2'];
    const rows = cells.map(c => [c.i, c.j, c.center.lat, c.center.lng, c.residentialPersons, c.dayActivityPersons, c.nightActivityPersons, c.blendedPersons, c.percentile.toFixed(3), c.densityPpkm2.toFixed(0)]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'population_density_cells.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Render rectangles on map
  useEffect(() => {
    if(!googleMap || !cells.length) return;
    
    const overlayKey = 'pop-density-overlay';
    const existing: any[] = googleMap[overlayKey] || [];
    existing.forEach((r:any) => {
      try { if (r && r.getMap && r.getMap()) r.setMap(null); } catch (e) { /* ignore */ }
    });
    googleMap[overlayKey] = [];

    const getValue = (c: DensityCell) => {
      const key = `${c.i},${c.j}`;
      const poiBoost = poiInfluence[key] || 0;
      if(mode === 'Base') return c.residentialPersons;
      if(mode === 'Daytime') return c.dayActivityPersons;
      if(mode === 'Nighttime') return c.nightActivityPersons;
      return c.blendedPersons + poiBoost; // Blended
    };

    const values = cells.map(getValue);
    const sorted = [...values].sort((a,b)=>a-b);
    const q = (p:number)=> sorted.length ? sorted[Math.floor(p * (sorted.length-1))] : 0;
    const thresholds = { vlow: q(0.2), low: q(0.4), mod: q(0.6), high: q(0.8) };
    
    const classify = (ppkm2: number) => {
      if(adaptive){
        const val = ppkm2;
        if(val <= thresholds.vlow) return 'Very Low';
        if(val <= thresholds.low) return 'Low';
        if(val <= thresholds.mod) return 'Moderate';
        if(val <= thresholds.high) return 'High';
        return 'Very High';
      }
      return classifyDensity(ppkm2);
    };

    cells.forEach(cell => {
      const v = getValue(cell);
      const ppkm2 = (v / cell.areaM2) * 1_000_000;
      const category = classify(ppkm2);
      if(hideLow && (category === 'Very Low' || category === 'Low')) return;
      const color = DENSITY_COLORS[category];
      
      // Use hexagon polygon if available, otherwise fall back to square
      const paths = cell.polygon 
        ? cell.polygon.map(p => ({ lat: p.lat, lng: p.lng }))
        : (() => {
            const latHalf = (cellSizeMeters/111000)/2;
            const lngHalf = (cellSizeMeters/(111000*Math.cos(center.lat*Math.PI/180)))/2;
            return [
              { lat: cell.center.lat + latHalf, lng: cell.center.lng - lngHalf },
              { lat: cell.center.lat + latHalf, lng: cell.center.lng + lngHalf },
              { lat: cell.center.lat - latHalf, lng: cell.center.lng + lngHalf },
              { lat: cell.center.lat - latHalf, lng: cell.center.lng - lngHalf },
            ];
          })();
      
      const poly = new google.maps.Polygon({
        paths: paths,
        strokeColor: '#ffffff',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        fillOpacity: 0.55,
        fillColor: color,
        map: googleMap
      });
      poly.addListener('mouseover', () => setHoverCell(cell));
      poly.addListener('mouseout', () => setHoverCell(null));
      googleMap[overlayKey].push(poly);
    });

    // Cleanup on unmount
    return () => {
      const polys: any[] = googleMap[overlayKey] || [];
      polys.forEach((p:any) => {
        try { if (p && p.getMap && p.getMap()) p.setMap(null); } catch(e){ /* swallow */ }
      });
      googleMap[overlayKey] = [];
    };
  }, [googleMap, cells, mode, hideLow, adaptive, poiInfluence, center, cellSizeMeters]);

  if(!googleMap){
    return <div className="p-4 text-sm text-gray-500">Population Density Map requires a Google Map instance.</div>;
  }

  return (
    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md shadow-xl rounded-2xl p-4 w-80 text-xs space-y-3 border border-slate-200/60">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-800">Population Density</div>
        <button 
          onClick={exportCSV} 
          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white text-[11px] font-medium hover:from-teal-600 hover:to-teal-700 transition-all shadow-sm hover:shadow-md"
        >
          Export CSV
        </button>
      </div>
      <p className="text-[11px] leading-snug text-slate-600">
        Relative people presence (OSM floors + Google Places weighting). Not official census data.
      </p>
      <div className="flex gap-1 justify-between items-center">
        {(['Base','Blended','Daytime','Nighttime'] as DensityMode[]).map(m => (
          <button
            key={m}
            onClick={()=>setMode(m)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
              mode===m
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            style={{ minWidth: 0 }}
          >{m}</button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={hideLow} onChange={e=>setHideLow(e.target.checked)} className="rounded accent-teal-600" />
          Hide very low / low
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={adaptive} onChange={e=>setAdaptive(e.target.checked)} className="rounded accent-teal-600" />
          Adaptive legend
        </label>
      </div>
      {loading && <div className="text-slate-500 animate-pulse">Loading…</div>}
      {error && <div className="text-red-600 text-[11px]">{error}</div>}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(DENSITY_COLORS).map(([k,v]) => (
          <div key={k} className="flex flex-col items-center gap-1.5">
            <div style={{ background:v }} className="w-7 h-7 rounded-full shadow-sm border border-white/50" />
            <span className="text-[10px] text-slate-600 text-center leading-tight">{k.replace(' ','<br/>')}</span>
          </div>
        ))}
      </div>
      {hoverCell && (
        <div className="mt-2 p-3 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl shadow-sm animate-in fade-in duration-200">
          <div className="font-semibold text-slate-800 mb-2 text-[11px]">Cell Details</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-slate-600">Residential:</div>
            <div className="font-medium text-slate-800">{hoverCell.residentialPersons.toFixed(0)}</div>
            <div className="text-slate-600">Day activity:</div>
            <div className="font-medium text-slate-800">{hoverCell.dayActivityPersons.toFixed(0)}</div>
            <div className="text-slate-600">Night activity:</div>
            <div className="font-medium text-slate-800">{hoverCell.nightActivityPersons.toFixed(0)}</div>
            <div className="text-slate-600">Blended:</div>
            <div className="font-medium text-teal-700">{hoverCell.blendedPersons.toFixed(0)}</div>
            <div className="text-slate-600">Percentile:</div>
            <div className="font-medium text-slate-800">{(hoverCell.percentile*100).toFixed(0)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopulationDensityMap;