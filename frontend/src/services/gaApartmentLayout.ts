import { PlanShape, LayoutModule, LayoutOption, GAResultOption, LayoutUserOptions } from '../types';
import { Vector2, ensurePolygonWinding, calculatePolygonArea, getBoundingBox, rotatePoint, isRectangleInPolygon } from '@/utils/geometry';

// Local helpers copied from layoutService to avoid circular deps
const getScanlineSegments = (polygon: Vector2[], y: number): Array<[number, number]> => {
  const xs: number[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    if (Math.abs(a.y - b.y) < 1e-6) continue;
    const ymin = Math.min(a.y, b.y);
    const ymax = Math.max(a.y, b.y);
    if (y > ymin && y <= ymax) {
      const t = (y - a.y) / (b.y - a.y);
      const x = a.x + t * (b.x - a.x);
      xs.push(x);
    }
  }
  xs.sort((p, q) => p - q);
  const segments: Array<[number, number]> = [];
  for (let i = 0; i + 1 < xs.length; i += 2) segments.push([xs[i], xs[i + 1]]);
  return segments;
};

// Unit specs (should match layoutService module sizes)
const UNIT_SPECS: Record<string, { width: number; height: number }> = {
  'Studio Unit': { width: 7, height: 5 },
  '1 BHK Unit': { width: 10, height: 6 },
  '2 BHK Unit': { width: 12, height: 8 },
  '3 BHK Unit': { width: 14, height: 10 },
  'Duplex or Penthouse': { width: 15, height: 12 },
};

interface Gene {
  angle: number; // degrees (0..180)
  corridorWidth: number; // meters (2..4)
  doubleLoaded: boolean; // corridor both sides
  spacing: number; // between units (0.5..1.2)
}

interface FitnessBreakdown {
  overall: number; gfaScore: number; circScore: number; sunScore: number; mixScore: number; countScore: number;
}

export function generateGeneticApartmentLayouts(
  buildableAreaShape: PlanShape,
  userOptions: LayoutUserOptions
): GAResultOption[] {
  if (!buildableAreaShape.points || buildableAreaShape.points.length < 3) return [];
  const polygon: Vector2[] = ensurePolygonWinding(
    buildableAreaShape.points.map(p => ({ x: p.x + buildableAreaShape.x, y: p.y + buildableAreaShape.y }))
  );
  const siteArea = calculatePolygonArea(polygon);

  // Targets
  const floors = Math.max(1, Math.floor(userOptions.floors ?? 6));
  const totalUnitsTarget = Math.max(1, Math.floor(userOptions.totalUnits ?? 60));

  // Build requested mix as counts
  const percent = normalizePercent(userOptions.unitMixPercent);
  const mixCounts = percentToCounts(percent, totalUnitsTarget);

  const popSize = 24; const generations = 30;
  let population: Gene[] = Array.from({ length: popSize }, () => randomGene());
  // Force apartment-style double-loaded corridor
  population = population.map(g => ({ ...g, doubleLoaded: true }));

  let best: { gene: Gene; layout: LayoutModule[]; score: FitnessBreakdown; plotCoverage: number } | null = null;

  for (let gen = 0; gen < generations; gen++) {
    const scored = population.map(g => {
      const gene = { ...g, doubleLoaded: true };
      const layout = createMixedLinearLayout(polygon, g, mixCounts);
      const { breakdown, plotCoverage } = scoreLayout(layout, polygon, floors, mixCounts);
      return { gene, layout, breakdown, plotCoverage };
    });
    scored.sort((a,b) => b.breakdown.overall - a.breakdown.overall);
    if (!best || scored[0].breakdown.overall > best.score.overall) best = {
      gene: scored[0].gene,
      layout: scored[0].layout,
      score: scored[0].breakdown,
      plotCoverage: scored[0].plotCoverage
    };

    // Selection (top 30%) + mutations until popSize
    const keep = Math.max(3, Math.floor(popSize * 0.3));
    const next: Gene[] = scored.slice(0, keep).map(s => s.gene);
    while (next.length < popSize) {
      const parent = next[Math.floor(Math.random() * keep)];
      next.push(mutateGene(parent));
    }
    population = next;
  }

  if (!best) return [];

  // Build top 3 variants around best by small perturbations
  const variants: { gene: Gene; layout: LayoutModule[]; score: FitnessBreakdown; plotCoverage: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const g = { ...(i === 0 ? best.gene : mutateGene(best.gene, 0.2)), doubleLoaded: true };
    const layout = createMixedLinearLayout(polygon, g, mixCounts);
    const { breakdown, plotCoverage } = scoreLayout(layout, polygon, floors, mixCounts);
    variants.push({ gene: g, layout, score: breakdown, plotCoverage });
  }
  variants.sort((a,b) => b.score.overall - a.score.overall);

  const top = variants.slice(0, 3).map((v, idx): GAResultOption => ({
    id: `ga-apartment-${idx+1}`,
  description: `GA Optimized (angle ${v.gene.angle.toFixed(0)}°, double corridor, ${floors} floors)` ,
    modules: v.layout,
    gfa: computeUnitsArea(v.layout) * floors,
    plotCoverage: v.plotCoverage,
    meta: {
      algorithm: 'GA', generations, populationSize: popSize,
      fitnessComponents: {
        gfaScore: v.score.gfaScore,
        circulationScore: v.score.circScore,
        sunScore: v.score.sunScore,
        mixScore: v.score.mixScore,
        overall: v.score.overall,
      }
    }
  }));

  return top;
}

// --- GA core helpers ---
function randomGene(): Gene {
  return {
    angle: Math.random() * 180,
    corridorWidth: 2 + Math.random() * 2,
    doubleLoaded: Math.random() < 0.6,
    spacing: 0.5 + Math.random() * 0.7,
  };
}

function mutateGene(g: Gene, scale = 0.4): Gene {
  return {
    angle: clamp(g.angle + (Math.random() - 0.5) * 60 * scale, 0, 180),
    corridorWidth: clamp(g.corridorWidth + (Math.random() - 0.5) * 1.2 * scale, 1.6, 4.5),
    doubleLoaded: Math.random() < 0.2 ? !g.doubleLoaded : g.doubleLoaded,
    spacing: clamp(g.spacing + (Math.random() - 0.5) * 0.6 * scale, 0.3, 1.5),
  };
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function normalizePercent(p?: { [label: string]: number }): { [label: string]: number } {
  const labels = Object.keys(UNIT_SPECS);
  const out: { [label: string]: number } = {};
  if (!p || Object.keys(p).length === 0) { out['Studio Unit'] = 100; return out; }
  let sum = 0;
  for (const [k, v] of Object.entries(p)) { if (labels.includes(k)) { out[k] = Math.max(0, v); sum += Math.max(0, v); } }
  if (sum <= 0) { out['Studio Unit'] = 100; return out; }
  for (const k of Object.keys(out)) out[k] = (out[k] / sum) * 100;
  return out;
}

function percentToCounts(p: { [label: string]: number }, total: number): { [label: string]: number } {
  const counts: { [label: string]: number } = {}; let assigned = 0; let last = 'Studio Unit';
  for (const [k, v] of Object.entries(p)) {
    const c = Math.floor((v / 100) * total); counts[k] = c; assigned += c; last = k;
  }
  if (assigned < total) counts[last] = (counts[last] || 0) + (total - assigned);
  return counts;
}

function computeUnitsArea(mods: LayoutModule[]): number {
  // Units are rectangles/polygons; we approximate via width*height bbox for speed (consistent with rule-based)
  return mods.filter(m => m.label.startsWith('Studio') || m.label.includes('BHK') || m.label.startsWith('Duplex'))
    .reduce((s, m) => s + m.width * m.height, 0);
}

function scoreLayout(layout: LayoutModule[], polygon: Vector2[], floors: number, targetMix: { [label: string]: number }): { breakdown: FitnessBreakdown; plotCoverage: number } {
  const siteArea = calculatePolygonArea(polygon);
  const units = layout.filter(m => isUnit(m));
  const corridorArea = layout.filter(m => m.label === 'Circulation').reduce((s, m) => s + m.width * m.height, 0);
  const unitArea = computeUnitsArea(layout);
  const plotCoverage = unitArea / siteArea;

  const gfa = unitArea * floors; // simplified

  // Mix score
  const achievedCounts: { [label: string]: number } = {};
  units.forEach(u => { const t = unitTypeLabel(u.label); achievedCounts[t] = (achievedCounts[t] || 0) + 1; });
  const totalAchieved = units.length || 1;
  let mixDiff = 0; let denom = 0;
  for (const [k, tv] of Object.entries(targetMix)) {
    const targetShare = tv / Object.values(targetMix).reduce((a, b) => a + b, 0);
    const achievedShare = (achievedCounts[k] || 0) / totalAchieved;
    mixDiff += Math.abs(targetShare - achievedShare);
    denom += 1;
  }
  const mixScore = 1 - clamp(mixDiff / Math.max(1, denom), 0, 1);

  // Corridor efficiency score (less corridor area is better up to 25%)
  const circRatio = unitArea > 0 ? corridorArea / (unitArea + corridorArea) : 1;
  const circScore = clamp(1 - (circRatio - 0.15) / 0.25, 0, 1);

  // Solar score: prefer angles close to 0 or 180 (E-W alignment) for south facade length
  const angle = estimateDominantAngle(units);
  // If angle is undefined (no units) sunScore should be 0 to discourage empty layouts
  const sunScore = units.length ? Math.abs(Math.cos((angle * Math.PI) / 180)) : 0; // 1 at 0/180, 0 at 90

  // GFA score: normalize by site area * floors (aim for 0.4..2.0 of site area)
  const targetGfa = siteArea * floors * 0.9; // heuristic
  const gfaScore = 1 - Math.min(1, Math.abs(gfa - targetGfa) / targetGfa);

  // Count score: match total unit count to target mix sum
  const targetCount = Object.values(targetMix).reduce((a, b) => a + b, 0);
  const countScore = 1 - Math.min(1, Math.abs(units.length - targetCount) / Math.max(1, targetCount));

  // Weighted sum
  const overall = clamp(
    0.3 * gfaScore + 0.25 * mixScore + 0.2 * circScore + 0.15 * sunScore + 0.1 * countScore,
    0, 1
  );

  return { breakdown: { overall, gfaScore, circScore, sunScore, mixScore, countScore }, plotCoverage };
}

function estimateDominantAngle(units: LayoutModule[]): number {
  if (units.length === 0) return 0;
  // Average orientation derived from edge vectors of first polygon
  const u = units[0];
  if (!u.points || u.points.length < 2) return u.rotation || 0;
  let acc = 0; let cnt = 0;
  for (let i=0;i<u.points.length;i++) {
    const a = u.points[i]; const b = u.points[(i+1)%u.points.length];
    const dx = b.x - a.x; const dy = b.y - a.y;
    if (Math.hypot(dx,dy) < 0.01) continue;
    const ang = (Math.atan2(dy,dx)*180/Math.PI + 360) % 180; // normalize 0..180
    acc += ang; cnt++;
  }
  return cnt? acc/cnt : (u.rotation||0);
}

function isUnit(m: LayoutModule): boolean {
  return m.label.startsWith('Studio') || m.label.includes('BHK') || m.label.startsWith('Duplex');
}

function unitTypeLabel(label: string): string {
  // Normalize to one of UNIT_SPECS keys
  for (const key of Object.keys(UNIT_SPECS)) {
    if (label.startsWith(key)) return key;
  }
  // Attempt partial matches
  if (label.includes('Studio')) return 'Studio Unit';
  if (label.includes('1 BHK')) return '1 BHK Unit';
  if (label.includes('2 BHK')) return '2 BHK Unit';
  if (label.includes('3 BHK')) return '3 BHK Unit';
  if (label.toLowerCase().includes('duplex')) return 'Duplex or Penthouse';
  return 'Studio Unit';
}

function createRotatedModule(rect: { x: number; y: number; width: number; height: number }, angle: number, origin: Vector2, label: string): LayoutModule {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map(p => rotatePoint(p, origin, angle));
  const bbox = getBoundingBox(corners);
  return {
    label,
    type: 'polygon',
    points: corners,
    x: bbox.minX,
    y: bbox.minY,
    width: bbox.maxX - bbox.minX,
    height: bbox.maxY - bbox.minY,
    rotation: angle,
  };
}

// Apartment row-based double-loaded corridor placement
function createMixedLinearLayout(polygon: Vector2[], gene: Gene, requestedCounts: { [label: string]: number }): LayoutModule[] {
  const spacing = gene.spacing;
  const angle = gene.angle;
  const bbox = getBoundingBox(polygon);
  const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
  const polyR = polygon.map(p => rotatePoint(p, center, -angle));
  const rbox = getBoundingBox(polyR);

  const modules: LayoutModule[] = [];
  const counts: { [label: string]: number } = { ...requestedCounts };
  const labelsInPriority = Object.keys(counts);
  const corridorW = gene.corridorWidth;
  let yCursor = rbox.minY;

  while (yCursor < rbox.maxY - 4) { // guard space
    // choose next label with remaining count
    const label = labelsInPriority.find(l => counts[l] > 0);
    if (!label) break;
    const spec = UNIT_SPECS[label];
    const rowUnitDepth = spec.height;
    const rowTotalHeight = gene.doubleLoaded ? rowUnitDepth * 2 + corridorW + spacing : rowUnitDepth + spacing;
    if (yCursor + rowTotalHeight > rbox.maxY) break;

    const scanY = yCursor + rowUnitDepth / 2;
    const segments = getScanlineSegments(polyR, scanY);
    let rowMin = Infinity, rowMax = -Infinity;
    for (const [sx, ex] of segments) {
      let x = sx;
      while (x + spec.width <= ex && counts[label] > 0) {
        // top side
        const topRect = { x, y: yCursor, width: spec.width, height: spec.height, rotation: 0 };
        const topFits = isRectangleInPolygon(topRect as any, polyR);
        let bottomFits = false; let bottomRect: any = null;
        if (gene.doubleLoaded) {
          bottomRect = { x, y: yCursor + rowUnitDepth + corridorW, width: spec.width, height: spec.height, rotation: 0 };
          bottomFits = isRectangleInPolygon(bottomRect as any, polyR);
        }
        if (!topFits) { x += spec.width + spacing; continue; }
        modules.push(createRotatedModule(topRect as any, angle, center, label)); counts[label] -= 1;
        if (bottomFits && counts[label] > 0) { modules.push(createRotatedModule(bottomRect as any, angle, center, label)); counts[label] -= 1; }
        rowMin = Math.min(rowMin, x); rowMax = Math.max(rowMax, x + spec.width);
        x += spec.width + spacing;
      }
    }
    if (gene.doubleLoaded && rowMin < rowMax) {
      const corridorRect = { x: rowMin, y: yCursor + rowUnitDepth, width: rowMax - rowMin, height: corridorW, rotation: 0 };
      if (isRectangleInPolygon(corridorRect as any, polyR)) {
        modules.push(createRotatedModule(corridorRect as any, angle, center, 'Circulation'));
        // core
        const coreSize = Math.min(6, corridorW + 4);
        const coreRect = { x: rowMin + (corridorRect.width/2) - coreSize/2, y: yCursor + rowUnitDepth + corridorW/2 - coreSize/2, width: coreSize, height: coreSize, rotation: 0 };
        if (isRectangleInPolygon(coreRect as any, polyR)) modules.push(createRotatedModule(coreRect as any, angle, center, 'Service Core'));
      }
    }
    yCursor += rowTotalHeight;
  }

  return modules;
}
