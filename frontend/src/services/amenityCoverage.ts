// Amenities coverage feature removed. Keeping minimal type stubs for backward compatibility.
import { AmenityType } from './osmBuildings';
import { GridCell } from './landUseGrid';

export type CoverageLevel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';

export const COVERAGE_COLORS: Record<CoverageLevel, string> = {
  'Excellent': '#10b981',
  'Good': '#34d399',
  'Fair': '#f59e0b',
  'Poor': '#f97316',
  'Very Poor': '#ef4444',
};

export interface CoverageCell extends GridCell {
  coveredCategories: number; // 0..N
  totalCategories: number;   // constant (essentials.length)
  level: CoverageLevel;
}

export interface CoverageResult {
  cells: CoverageCell[];
  centers: { lat:number; lng:number; type: AmenityType }[]; // amenity points used (essentials only)
}

function haversineMeters(a:{lat:number;lng:number}, b:{lat:number;lng:number}){
  const R = 6371000; // meters
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const lat1 = a.lat * Math.PI/180;
  const lat2 = b.lat * Math.PI/180;
  const sinDLat = Math.sin(dLat/2);
  const sinDLng = Math.sin(dLng/2);
  const h = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLng*sinDLng;
  return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
}

const ESSENTIALS: AmenityType[] = ['Healthcare','Education','Retail','Transit'];

// Fetch amenities (OSM + Google) once and return only essentials, plus pre-indexed by type
export async function fetchEssentialAmenities(){
  return { essentialsByType: {} as Record<AmenityType, {lat:number;lng:number}[]>, centers: [] as {lat:number;lng:number;type:AmenityType}[] };
}

// Pure compute: given a built grid and pre-fetched essentials, compute coverage for a threshold
export function computeCoverage(cellsInput: GridCell[]): CoverageCell[] {
  // Return cells with default 'Very Poor' since the feature is disabled.
  return cellsInput.map(c => ({ ...c, coveredCategories: 0, totalCategories: 0, level: 'Very Poor' }));
}

// Backwards-compatible function: still available for simple calls
export async function analyzeAmenityCoverage(): Promise<CoverageResult> {
  return { cells: [], centers: [] };
}
