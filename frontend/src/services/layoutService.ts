import { PlanShape, LayoutOption, LayoutModule, LayoutUserOptions } from '../types';
import {
    Vector2,
    calculatePolygonArea,
    ensurePolygonWinding,
    getPrimaryAxisAngle,
    isRectangleInPolygon,
    rotatePoint,
    getBoundingBox,
    clipPolygon,
    isPointInPolygon,
    offsetPolygonUniform,
} from '@/utils/geometry';

// --- Module Definitions ---
const MODULE_SPECS: { [key: string]: { width: number, height: number, core?: boolean } } = {
    // Residential - UPDATED SIZES
    'Studio Unit': { width: 7, height: 5 }, // 35 m²
    '1 BHK Unit': { width: 10, height: 6 }, // 60 m²
    '2 BHK Unit': { width: 12, height: 8 }, // 96 m²
    '3 BHK Unit': { width: 14, height: 10 }, // 140 m²
    'Duplex or Penthouse': { width: 15, height: 12 },
    // Commercial
    'Small Shop': { width: 6, height: 8 },
    'Restaurant / Café': { width: 12, height: 10 },
    'Anchor Store': { width: 20, height: 25 },
    'Showroom': { width: 15, height: 15 },
    'Co-retail Module': { width: 8, height: 8 },
    // Office
    'Small Office': { width: 10, height: 10 },
    'Medium Office (10-20 people)': { width: 15, height: 12 },
    'Large Floorplate': { width: 30, height: 20 },
    'Coworking Module': { width: 12, height: 12 },
    'Service Core Block': { width: 6, height: 6, core: true },
};

/**
 * Generates rule-based layout options for a given buildable area.
 */
export const generateRuleBasedLayouts = (
    buildableAreaShape: PlanShape,
    subcategory: string,
    projectType: string,
    userOptions?: LayoutUserOptions
): LayoutOption[] => {
    if (!buildableAreaShape.points || buildableAreaShape.points.length < 3) {
        throw new Error("Invalid buildable area. It must be a polygon with at least 3 points.");
    }

    const moduleSpec = MODULE_SPECS[subcategory] || MODULE_SPECS['Small Office'];
    const coreSpec = MODULE_SPECS['Service Core Block'];
    const corridorWidth = 3;

    const buildablePolygon: Vector2[] = ensurePolygonWinding(
        buildableAreaShape.points.map(p => ({
            x: p.x + buildableAreaShape.x,
            y: p.y + buildableAreaShape.y,
        }))
    );
    
    const buildableArea = calculatePolygonArea(buildablePolygon);
    const mainAngle = getPrimaryAxisAngle(buildablePolygon);

    const anglesToTest = [
        { angle: mainAngle, description: 'Aligned with Primary Axis' },
        { angle: mainAngle + 90, description: 'Perpendicular to Primary Axis' },
    ];

    if (Math.abs(mainAngle % 90) > 15 && Math.abs((mainAngle + 90) % 90) > 15) {
        anglesToTest.push({ angle: 0, description: 'Axis-Aligned (North-South)' });
    }

    const options: LayoutOption[] = [];

    // Planned Society / Business Park / Street Retail => community grid with streets
    const devModel = userOptions?.devModel;
    const isCommunity = (projectType === 'Residential' && devModel === 'Planned Society')
        || (projectType === 'Office' && devModel === 'Business Park')
        || (projectType === 'Commercial' && devModel === 'Street Retail');

    if (isCommunity) {
        const roadWidth = Math.max(4, Math.min(20, userOptions?.roadWidth ?? 8));
        const mix = normalizeUnitMix(userOptions?.unitMix);
        const mods = generatePlannedCommunityLayout(buildablePolygon, mix ?? { [subcategory]: Infinity }, roadWidth, mainAngle);
        if (mods.length) {
            const totalModuleArea = mods.filter(m => m.label.startsWith('Unit')).reduce((s,m)=> s + calculatePolygonArea(m.points!),0);
            options.push({
                id: 'community-grid',
                description: 'Community Grid with Internal Streets',
                modules: mods,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    }

    // --- STRATEGY 1: Linear Packing (improved scanline) ---
    anglesToTest.forEach(({ angle, description }) => {
        // Try double-loaded scanline first
        let modules = generateLinearPackedLayout(
            buildablePolygon, moduleSpec, coreSpec, corridorWidth, angle, true
        );
        // Fallback to single-loaded if double-loaded produces nothing
        if (modules.length === 0) {
            modules = generateLinearPackedLayout(
                buildablePolygon, moduleSpec, coreSpec, corridorWidth, angle, false
            );
        }

        if (modules.length > 0) {
            const totalModuleArea = modules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
            options.push({
                id: `linear-${description.replace(/\s+/g, '-')}`,
                description: `Linear Pack: ${description}`,
                modules: modules,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    });

    // --- STRATEGY 1b: Staggered (Herringbone-like) Packing ---
    [mainAngle, mainAngle + 90].forEach((angle, idx) => {
        const modules = generateStaggeredPackedLayout(buildablePolygon, moduleSpec, angle);
        if (modules.length > 0) {
            const totalModuleArea = modules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
            options.push({
                id: `staggered-${idx}`,
                description: `Staggered Grid` + (idx === 0 ? '' : ' (Perpendicular)'),
                modules,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    });

    // --- STRATEGY 1c: Orthogonal Grid (tight, no corridors) ---
    [mainAngle, mainAngle + 90].forEach((angle, idx) => {
        const modules = generateOrthogonalGridLayout(buildablePolygon, moduleSpec, angle);
        if (modules.length > 0) {
            const totalModuleArea = modules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
            options.push({
                id: `orthogrid-${idx}`,
                description: `Orthogonal Grid` + (idx === 0 ? '' : ' (Perpendicular)'),
                modules,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    });

    // --- STRATEGY 1d: Alternating Orientation Grid (rows swap width/height) ---
    [mainAngle].forEach((angle) => {
        const modules = generateAlternatingOrientationLayout(buildablePolygon, moduleSpec, angle);
        if (modules.length > 0) {
            const totalModuleArea = modules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
            options.push({
                id: `alt-orient`,
                description: `Alternating Orientation`,
                modules,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    });

    // --- STRATEGY 3: Perimeter Belt (continuous ring of blocks) ---
    // Perimeter belt depth tuned for fuller coverage (up to 2x module height, capped)
    const beltModules = generatePerimeterBeltLayout(buildablePolygon, moduleSpec, Math.min(moduleSpec.height * 2, 32));
    if (beltModules.length > 0) {
        const totalModuleArea = beltModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'perimeter-belt',
            description: 'Perimeter Belt',
            modules: beltModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }
    
    // --- STRATEGY 2: Perimeter Trimmed Packing ---
    const trimmedModules = generateTrimmedLayout(
        buildablePolygon, moduleSpec
    );

    if (trimmedModules.length > 0) {
        const totalModuleArea = trimmedModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        
        const isDuplicate = options.some(opt => {
            return opt.modules.length === trimmedModules.length && opt.gfa.toFixed(0) === totalModuleArea.toFixed(0);
        });
        
        if (!isDuplicate) {
            options.push({
                id: `trimmed-perimeter-layout`,
                description: `Perimeter Aligned`,
                modules: trimmedModules,
                gfa: totalModuleArea,
                plotCoverage: totalModuleArea / buildableArea,
            });
        }
    }


    // --- NEW ADVANCED TYPOLOGIES ---

    // STRATEGY 4: Courtyard Layout (hollow center for light/air)
    const courtyardModules = generateCourtyardLayout(buildablePolygon, moduleSpec);
    if (courtyardModules.length > 0) {
        const totalModuleArea = courtyardModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'courtyard',
            description: 'Courtyard (Hollow Center)',
            modules: courtyardModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }

    // STRATEGY 5: Cruciform / Cross Layout (4 wings from central core)
    const cruciformModules = generateCruciformLayout(buildablePolygon, moduleSpec);
    if (cruciformModules.length > 0) {
        const totalModuleArea = cruciformModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'cruciform',
            description: 'Cruciform (Cross-Shaped)',
            modules: cruciformModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }

    // STRATEGY 6: Compact Tower Layout (maximum efficiency, central core)
    const towerModules = generateCompactTowerLayout(buildablePolygon, moduleSpec, coreSpec);
    if (towerModules.length > 0) {
        const totalModuleArea = towerModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'compact-tower',
            description: 'Compact Tower (Efficient Core)',
            modules: towerModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }

    // STRATEGY 7: Linear Bar / Slab Layout (single-loaded with max views)
    const linearBarModules = generateLinearBarLayout(buildablePolygon, moduleSpec, mainAngle);
    if (linearBarModules.length > 0) {
        const totalModuleArea = linearBarModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'linear-bar',
            description: 'Linear Bar (Single-Loaded)',
            modules: linearBarModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }

    // STRATEGY 8: Clustered Pavilions (organic grouping around shared spaces)
    const clusterModules = generateClusteredLayout(buildablePolygon, moduleSpec);
    if (clusterModules.length > 0) {
        const totalModuleArea = clusterModules.reduce((sum, mod) => sum + calculatePolygonArea(mod.points!), 0);
        options.push({
            id: 'clustered',
            description: 'Clustered Pavilions',
            modules: clusterModules,
            gfa: totalModuleArea,
            plotCoverage: totalModuleArea / buildableArea,
        });
    }

    // Sort by plot coverage (density) then by GFA descending
    return options.sort((a, b) => (b.plotCoverage - a.plotCoverage) || (b.gfa - a.gfa));
};

/** Lays out modules in a linear fashion with corridors, ensuring they fit fully inside the polygon. */
const generateLinearPackedLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    coreSpec: { width: number, height: number },
    corridorWidth: number,
    angle: number,
    doubleLoaded: boolean
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1; // small buffer between units

    const buildableBBox = getBoundingBox(buildablePolygon);
    const center = { x: (buildableBBox.minX + buildableBBox.maxX) / 2, y: (buildableBBox.minY + buildableBBox.maxY) / 2 };
    const rotatedPolygon = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rotatedBBox = getBoundingBox(rotatedPolygon);

    const rowHeight = doubleLoaded
        ? moduleSpec.height * 2 + corridorWidth + spacing
        : moduleSpec.height + spacing;

    let coreCounter = 0;
    const coreInterval = 6; // every ~6 placements

    // Scanline over Y
    for (let y = rotatedBBox.minY; y <= rotatedBBox.maxY - (doubleLoaded ? (moduleSpec.height * 2 + corridorWidth) : moduleSpec.height); y += rowHeight) {
        const segments = getScanlineSegments(rotatedPolygon, y + (doubleLoaded ? moduleSpec.height / 2 : moduleSpec.height / 2));
        for (const [sx, ex] of segments) {
            const usable = ex - sx;
            if (usable < moduleSpec.width) continue;
            const count = Math.floor((usable + spacing) / (moduleSpec.width + spacing));
            if (count <= 0) continue;
            const leftover = usable - count * moduleSpec.width - (count - 1) * spacing;
            let x = sx + Math.max(0, leftover / 2);
            for (let i = 0; i < count; i++) {
                const unit1Rect = { x, y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                const unit1Fits = isRectangleInPolygon(unit1Rect, rotatedPolygon);
                let unit2Fits = false;
                let unit2Rect: any = null;
                if (doubleLoaded) {
                    unit2Rect = { x, y: y + moduleSpec.height + corridorWidth, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                    unit2Fits = isRectangleInPolygon(unit2Rect, rotatedPolygon);
                }
                if (unit1Fits) modules.push(createRotatedModule(unit1Rect, 'Unit', angle, center));
                if (doubleLoaded && unit2Fits) modules.push(createRotatedModule(unit2Rect, 'Unit', angle, center));
                if (doubleLoaded && unit1Fits && unit2Fits) {
                    const corridorRect = { x, y: y + moduleSpec.height, width: moduleSpec.width, height: corridorWidth, rotation: 0 };
                    if (isRectangleInPolygon(corridorRect, rotatedPolygon)) {
                        modules.push(createRotatedModule(corridorRect, 'Circulation', angle, center));
                    }
                }
                if (unit1Fits || unit2Fits) {
                    coreCounter++;
                    if (coreCounter % coreInterval === 0) {
                        const coreRect = { x: x + moduleSpec.width + spacing, y, width: coreSpec.width, height: coreSpec.height, rotation: 0 };
                        if (isRectangleInPolygon(coreRect, rotatedPolygon)) {
                            modules.push(createRotatedModule(coreRect, 'Service Core', angle, center));
                        }
                    }
                }
                x += moduleSpec.width + spacing;
            }
        }
    }

    let unitCounter = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${unitCounter++}`; });
    return modules;
};


/** Lays out modules perpendicularly along the polygon edges and trims them. */
const generateTrimmedLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const placedModuleBounds: { minX: number, minY: number, maxX: number, maxY: number }[] = [];

    const edges = buildablePolygon.map((p, i) => [p, buildablePolygon[(i + 1) % buildablePolygon.length]]);

    for (const edge of edges) {
        const [p1, p2] = edge;
        const edgeVector = { x: p2.x - p1.x, y: p2.y - p1.y };
        const edgeLength = Math.sqrt(edgeVector.x * edgeVector.x + edgeVector.y * edgeVector.y);
        const edgeAngle = Math.atan2(edgeVector.y, edgeVector.x) * (180 / Math.PI);

        if (edgeLength < moduleSpec.width * 0.75) continue;

        const numModules = Math.floor(edgeLength / moduleSpec.width);
        const normalizedEdgeVector = { x: edgeVector.x / edgeLength, y: edgeVector.y / edgeLength };
        
        let perpendicularVector = { x: -normalizedEdgeVector.y, y: normalizedEdgeVector.x };
        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const testPoint = { x: midPoint.x + perpendicularVector.x * 0.1, y: midPoint.y + perpendicularVector.y * 0.1 };
        if (!isPointInPolygon(testPoint, buildablePolygon)) {
            perpendicularVector = { x: normalizedEdgeVector.y, y: -normalizedEdgeVector.x };
        }

        for (let i = 0; i < numModules; i++) {
            const onEdgeCenter = {
                x: p1.x + normalizedEdgeVector.x * (moduleSpec.width * (i + 0.5)),
                y: p1.y + normalizedEdgeVector.y * (moduleSpec.width * (i + 0.5)),
            };
            const moduleCenter = {
                x: onEdgeCenter.x + perpendicularVector.x * (moduleSpec.height / 2),
                y: onEdgeCenter.y + perpendicularVector.y * (moduleSpec.height / 2),
            };
            
            const halfW = moduleSpec.width / 2;
            const halfH = moduleSpec.height / 2;
            const corners = [
                { x: -halfW, y: -halfH }, { x:  halfW, y: -halfH },
                { x:  halfW, y:  halfH }, { x: -halfW, y:  halfH },
            ];

            const rotatedCorners = corners.map(p => rotatePoint(p, {x:0, y:0}, edgeAngle));
            const translatedCorners = rotatedCorners.map(p => ({ x: p.x + moduleCenter.x, y: p.y + moduleCenter.y }));
            
            const clippedPoints = clipPolygon(translatedCorners, buildablePolygon);
            
            if (clippedPoints.length >= 3 && calculatePolygonArea(clippedPoints) > (moduleSpec.width * moduleSpec.height) * 0.3) {
                const newBbox = getBoundingBox(clippedPoints);
                let hasOverlap = false;
                for (const placedBbox of placedModuleBounds) {
                    const overlapX = Math.max(0, Math.min(newBbox.maxX, placedBbox.maxX) - Math.max(newBbox.minX, placedBbox.minX));
                    const overlapY = Math.max(0, Math.min(newBbox.maxY, placedBbox.maxY) - Math.max(newBbox.minY, placedBbox.minY));
                    if (overlapX * overlapY > 5) {
                        hasOverlap = true;
                        break;
                    }
                }

                if (!hasOverlap) {
                     modules.push({
                        label: 'Unit', type: 'polygon', points: clippedPoints,
                        x: newBbox.minX, y: newBbox.minY,
                        width: newBbox.maxX - newBbox.minX, height: newBbox.maxY - newBbox.minY,
                        rotation: 0,
                    });
                    placedModuleBounds.push(newBbox);
                }
            }
        }
    }
    
    let unitCounter = 1;
    modules.sort((a,b) => a.y - b.y || a.x - b.x).forEach(m => {
        if (m.label === 'Unit') {
            m.label = `Unit ${unitCounter++}`;
        }
    });

    return modules;
}


// Helper to create a final module by rotating a rect back to world space
const createRotatedModule = (
    rect: { x: number, y: number, width: number, height: number, rotation: number }, 
    label: string, 
    angle: number,
    origin: Vector2
): LayoutModule => {
    // The rect is in a rotated coordinate space. We need to rotate it back.
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
        rotation: 0, // Rotation is now baked into the points
    };
}

// --- Additional Packing Strategies ---

/** Compute scanline x-intervals where the polygon is filled at a given y (polygon in local rotated space). */
const getScanlineSegments = (polygon: Vector2[], y: number): Array<[number, number]> => {
    const xs: number[] = [];
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        // Ignore horizontal edges to avoid double counting
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
    for (let i = 0; i + 1 < xs.length; i += 2) {
        segments.push([xs[i], xs[i + 1]]);
    }
    return segments;
};

/** Staggered grid packing without corridors; alternates half-width offset each row for denser fill. */
const generateStaggeredPackedLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    angle: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1;
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    const polyR = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rbox = getBoundingBox(polyR);
    const rowH = moduleSpec.height + spacing;
    let rowIndex = 0;
    for (let y = rbox.minY; y <= rbox.maxY - moduleSpec.height; y += rowH) {
        const segments = getScanlineSegments(polyR, y + moduleSpec.height / 2);
        const offset = (rowIndex % 2 === 1) ? (moduleSpec.width + spacing) / 2 : 0;
        for (const [sx, ex] of segments) {
            let x = sx + offset;
            while (x + moduleSpec.width <= ex) {
                const rect = { x, y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                if (isRectangleInPolygon(rect, polyR)) {
                    modules.push(createRotatedModule(rect, 'Unit', angle, center));
                }
                x += moduleSpec.width + spacing;
            }
        }
        rowIndex++;
    }
    let idx = 1; modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Orthogonal grid packing using scanlines; maximizes count without stagger or corridors. */
const generateOrthogonalGridLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    angle: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1;
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    const polyR = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rbox = getBoundingBox(polyR);
    for (let y = rbox.minY; y <= rbox.maxY - moduleSpec.height; y += moduleSpec.height + spacing) {
        const segments = getScanlineSegments(polyR, y + moduleSpec.height / 2);
        for (const [sx, ex] of segments) {
            const usable = ex - sx;
            if (usable < moduleSpec.width) continue;
            const count = Math.floor((usable + spacing) / (moduleSpec.width + spacing));
            const leftover = usable - count * moduleSpec.width - (count - 1) * spacing;
            let x = sx + Math.max(0, leftover / 2);
            for (let i = 0; i < count; i++) {
                const rect = { x, y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                if (isRectangleInPolygon(rect, polyR)) {
                    modules.push(createRotatedModule(rect, 'Unit', angle, center));
                }
                x += moduleSpec.width + spacing;
            }
        }
    }
    let idx = 1; modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Alternating rows swap width/height to adapt to narrow sections. */
const generateAlternatingOrientationLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    angle: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1;
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    const polyR = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rbox = getBoundingBox(polyR);
    let row = 0;
    for (let y = rbox.minY; y <= rbox.maxY - Math.min(moduleSpec.height, moduleSpec.width); ) {
        const swapped = row % 2 === 1;
        const w = swapped ? moduleSpec.height : moduleSpec.width;
        const h = swapped ? moduleSpec.width : moduleSpec.height;
        const segments = getScanlineSegments(polyR, y + h / 2);
        for (const [sx, ex] of segments) {
            const usable = ex - sx;
            if (usable < w) continue;
            const count = Math.floor((usable + spacing) / (w + spacing));
            const leftover = usable - count * w - (count - 1) * spacing;
            let x = sx + Math.max(0, leftover / 2);
            for (let i = 0; i < count; i++) {
                const rect = { x, y, width: w, height: h, rotation: 0 };
                if (isRectangleInPolygon(rect, polyR)) {
                    modules.push(createRotatedModule(rect, 'Unit', angle, center));
                }
                x += w + spacing;
            }
        }
        y += h + spacing;
        row++;
    }
    let idx = 1; modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Planned community generator: creates internal streets and fills blocks from a unit mix. */
const generatePlannedCommunityLayout = (
    buildablePolygon: Vector2[],
    unitMix: { [label: string]: number | number },
    roadWidth: number,
    angle: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1;

    // Build a prioritized unit list (largest area first) from mix
    const mixEntries = Object.entries(unitMix).filter(([k, v]) => (MODULE_SPECS as any)[k] && (v as number) > 0);
    if (mixEntries.length === 0) return modules;
    const sorted = mixEntries.sort((a,b) => {
        const sa = (MODULE_SPECS as any)[a[0]]; const sb = (MODULE_SPECS as any)[b[0]];
        return (sb.width*sb.height) - (sa.width*sa.height);
    });

    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    const polyR = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rbox = getBoundingBox(polyR);

    // Grid rows with periodic street rows
    const baseH = Math.min(...sorted.map(([k]) => (MODULE_SPECS as any)[k].height));
    const rowPackHeight = baseH + spacing;
    const blocksPerStreet = 4; // every 4 rows add a street
    let rowIndex = 0;
    for (let y = rbox.minY; y <= rbox.maxY - baseH; ) {
        const isStreetRow = rowIndex > 0 && rowIndex % blocksPerStreet === 0;
        const yMid = y + baseH/2;
        const segments = getScanlineSegments(polyR, yMid);
        for (const [sx, ex] of segments) {
            const usable = ex - sx;
            if (usable <= 0) continue;
            if (isStreetRow) {
                // Horizontal street
                const streetRect = { x: sx, y: y, width: usable, height: roadWidth, rotation: 0 };
                // ensure fully inside
                if (isRectangleInPolygon(streetRect, polyR)) {
                    modules.push(createRotatedModule(streetRect, 'Circulation', angle, center));
                }
                continue;
            }
            // Place units left-to-right; add occasional vertical streets
            let x = sx; let col = 0; const blocksPerVStreet = 5;
            while (x + 1 <= ex) {
                const isVStreet = col > 0 && col % blocksPerVStreet === 0;
                if (isVStreet) {
                    const vRect = { x, y, width: roadWidth, height: baseH, rotation: 0 };
                    if (isRectangleInPolygon(vRect, polyR)) {
                        modules.push(createRotatedModule(vRect, 'Circulation', angle, center));
                    }
                    x += roadWidth + spacing; col++; continue;
                }
                // pick a unit that fits into remaining width
                let placed = false;
                for (let i = 0; i < sorted.length; i++) {
                    const label = sorted[i][0];
                    const remaining = sorted[i][1] as number;
                    const spec = (MODULE_SPECS as any)[label];
                    const rect = { x, y, width: spec.width, height: spec.height, rotation: 0 };
                    if (x + spec.width <= ex && spec.height <= baseH + 0.001 && remaining > 0 && isRectangleInPolygon(rect, polyR)) {
                        modules.push(createRotatedModule(rect, 'Unit', angle, center));
                        sorted[i][1] = (remaining - 1) as any;
                        x += spec.width + spacing; col++; placed = true; break;
                    }
                }
                if (!placed) break; // no unit fits in remaining space, go next segment
            }
        }
        // Advance Y by either street width or row height
        y += (isStreetRow ? (roadWidth + spacing) : rowPackHeight);
        rowIndex++;
    }
    // Label units sequentially
    let idx = 1; modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

const normalizeUnitMix = (mix?: { [label: string]: number }): { [label: string]: number } | undefined => {
    if (!mix) return undefined;
    const out: { [label: string]: number } = {};
    for (const [k, v] of Object.entries(mix)) {
        if (typeof v === 'number' && isFinite(v) && v > 0) out[k] = Math.floor(v);
    }
    return Object.keys(out).length ? out : undefined;
};

/** Perimeter belt: place a ring of blocks hugging the boundary with given depth. */
const generatePerimeterBeltLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    depth: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const targetWidth = Math.max(3, moduleSpec.width); // keep widths consistent across edges for better visual alignment
    const baseSpacing = Math.max(0.25, Math.min(1, targetWidth * 0.06)); // small, adaptive spacing
    const ccw = ensurePolygonWinding(buildablePolygon);
    const maxDepth = Math.min(depth, moduleSpec.height * 2.2); // cap belt depth to avoid over-inset
    const rows = maxDepth > moduleSpec.height * 1.4 ? 2 : 1; // add a second inner row if depth allows
    const perRowDepth = Math.min(moduleSpec.height, maxDepth / rows);
    const innerLimitPoly = offsetPolygonUniform(ccw, maxDepth); // used only to avoid pushing entire rows too deep

    const n = ccw.length;
    for (let i = 0; i < n; i++) {
        const a = ccw[i];
        const b = ccw[(i + 1) % n];
        const edgeVec = { x: b.x - a.x, y: b.y - a.y };
        const edgeLen = Math.hypot(edgeVec.x, edgeVec.y);
        if (edgeLen < moduleSpec.width * 0.5) continue; // skip very short edges
        const dir = { x: edgeVec.x / edgeLen, y: edgeVec.y / edgeLen };
        let normal = { x: -dir.y, y: dir.x };
        // Detect inward by sampling
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const test = { x: mid.x + normal.x * 0.15, y: mid.y + normal.y * 0.15 };
        if (!isPointInPolygon(test, ccw)) normal = { x: dir.y, y: -dir.x };

        // Compute module count preferring constant width, then solve spacing to fit the edge.
        const usableLen = edgeLen;
        if (usableLen < targetWidth * 0.75) {
            const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
            const h = perRowDepth;
            const centerSingle = { x: (a.x + b.x) / 2 + normal.x * (h / 2), y: (a.y + b.y) / 2 + normal.y * (h / 2) };
            modules.push(createOrientedRectModule(centerSingle, Math.max(2, usableLen * 0.9), h, angle, 'Unit'));
            continue;
        }
        let count = Math.max(1, Math.floor((usableLen + baseSpacing) / (targetWidth + baseSpacing)));
        let spacing = (usableLen - count * targetWidth) / (count + 1);
        if (spacing < baseSpacing * 0.5) {
            // Reduce count until spacing reaches a reasonable minimum
            while (count > 1 && spacing < baseSpacing * 0.5) {
                count -= 1;
                spacing = (usableLen - count * targetWidth) / (count + 1);
            }
        }
        const occupied = count * targetWidth + (count - 1) * spacing;
        let start = (usableLen - occupied) / 2 + spacing; // margin start; center of first at start + targetWidth/2

        for (let row = 0; row < rows; row++) {
            const rowOffset = (row + 0.5) * perRowDepth; // center of row depth from boundary
            for (let k = 0; k < count; k++) {
                const segCenterAlong = start + targetWidth / 2 + k * (targetWidth + spacing);
                const baseCx = a.x + dir.x * segCenterAlong;
                const baseCy = a.y + dir.y * segCenterAlong;
                const cx = baseCx + normal.x * rowOffset;
                const cy = baseCy + normal.y * rowOffset;
                const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
                // Trim ends slightly to avoid corner collisions while keeping consistent width
                const trim = Math.min(targetWidth * 0.02, perRowDepth * 0.2);
                const rect = { x: cx - (targetWidth - trim) / 2, y: cy - perRowDepth / 2, width: targetWidth - trim, height: perRowDepth, rotation: angle };
                // Must be inside outer polygon
                const fitsOuter = isRectangleInPolygon(rect, ccw);
                if (!fitsOuter) continue;
                // Avoid pushing modules entirely beyond inner limit polygon for outer row only
                let tooDeep = false;
                if (row === rows - 1 && innerLimitPoly.length >= 3) {
                    tooDeep = isRectangleInPolygon(rect, innerLimitPoly); // last row shouldn't be completely inside deepest inset
                }
                if (tooDeep && rows === 1) continue; // single row: skip if fully inside inset
                modules.push(createOrientedRectModule({ x: cx, y: cy }, targetWidth - trim, perRowDepth, angle, 'Unit'));
            }
        }
    }

    // De-duplicate modules that might overlap at sharp corners (simple AABB overlap cull)
    const dedup: LayoutModule[] = [];
    for (const m of modules) {
        const overlap = dedup.some(o => !(m.x + m.width < o.x || o.x + o.width < m.x || m.y + m.height < o.y || o.y + o.height < m.y));
        if (!overlap) dedup.push(m);
    }

    let idx = 1; dedup.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return dedup;
};

// Create a polygon module for a rectangle centered at `center`, rotated by `angleDeg`
const createOrientedRectModule = (
    center: Vector2,
    width: number,
    height: number,
    angleDeg: number,
    label: string
): LayoutModule => {
    const halfW = width / 2;
    const halfH = height / 2;
    const local = [
        { x: -halfW, y: -halfH },
        { x:  halfW, y: -halfH },
        { x:  halfW, y:  halfH },
        { x: -halfW, y:  halfH },
    ];
    const corners = local.map(p => rotatePoint({ x: p.x + center.x, y: p.y + center.y }, center, angleDeg));
    const bbox = getBoundingBox(corners);
    return {
        label,
        type: 'polygon',
        points: corners,
        x: bbox.minX,
        y: bbox.minY,
        width: bbox.maxX - bbox.minX,
        height: bbox.maxY - bbox.minY,
        rotation: 0,
    };
};

// =========================
// NEW ADVANCED LAYOUT TYPOLOGIES
// =========================

/** Courtyard Layout: Hollow square/rectangular perimeter with central open courtyard for light/air */
const generateCourtyardLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number }
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    
    // Calculate courtyard dimensions: aim for 30-40% open space in center
    const bboxWidth = bbox.maxX - bbox.minX;
    const bboxHeight = bbox.maxY - bbox.minY;
    const courtyardWidth = Math.max(moduleSpec.width * 2, bboxWidth * 0.35);
    const courtyardHeight = Math.max(moduleSpec.height * 2, bboxHeight * 0.35);
    
    // Create two offset polygons: outer (boundary) and inner (courtyard)
    const outerDepth = Math.max(moduleSpec.width, moduleSpec.height);
    const innerPolygon = offsetPolygonUniform(buildablePolygon, outerDepth);
    
    if (innerPolygon.length < 3) return modules; // Can't create courtyard
    
    // Place units around perimeter in 4 sides
    const spacing = 1;
    const sides = [
        { start: bbox.minX, end: bbox.maxX, y: bbox.minY, vertical: false }, // South
        { start: bbox.minX, end: bbox.maxX, y: bbox.maxY - moduleSpec.height, vertical: false }, // North
        { start: bbox.minY, end: bbox.maxY, x: bbox.minX, vertical: true }, // West
        { start: bbox.minY, end: bbox.maxY, x: bbox.maxX - moduleSpec.width, vertical: true }, // East
    ];
    
    sides.forEach((side, sideIdx) => {
        if (side.vertical) {
            // Vertical sides
            const length = side.end - side.start;
            const count = Math.floor(length / (moduleSpec.height + spacing));
            const startPos = side.start + (length - count * moduleSpec.height - (count - 1) * spacing) / 2;
            for (let i = 0; i < count; i++) {
                const y = startPos + i * (moduleSpec.height + spacing);
                const rect = { x: side.x!, y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                if (isRectangleInPolygon(rect, buildablePolygon)) {
                    modules.push({
                        label: 'Unit',
                        type: 'polygon',
                        points: [
                            { x: rect.x, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y + rect.height },
                            { x: rect.x, y: rect.y + rect.height },
                        ],
                        x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotation: 0
                    });
                }
            }
        } else {
            // Horizontal sides
            const length = side.end - side.start;
            const count = Math.floor(length / (moduleSpec.width + spacing));
            const startPos = side.start + (length - count * moduleSpec.width - (count - 1) * spacing) / 2;
            for (let i = 0; i < count; i++) {
                const x = startPos + i * (moduleSpec.width + spacing);
                const rect = { x, y: side.y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                if (isRectangleInPolygon(rect, buildablePolygon)) {
                    modules.push({
                        label: 'Unit',
                        type: 'polygon',
                        points: [
                            { x: rect.x, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y + rect.height },
                            { x: rect.x, y: rect.y + rect.height },
                        ],
                        x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotation: 0
                    });
                }
            }
        }
    });
    
    // Add courtyard space marker
    if (innerPolygon.length >= 3) {
        const innerBbox = getBoundingBox(innerPolygon);
        modules.push({
            label: 'Courtyard',
            type: 'polygon',
            points: innerPolygon,
            x: innerBbox.minX,
            y: innerBbox.minY,
            width: innerBbox.maxX - innerBbox.minX,
            height: innerBbox.maxY - innerBbox.minY,
            rotation: 0
        });
    }
    
    let idx = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Cruciform Layout: 4 wings radiating from central core in cross/plus shape */
const generateCruciformLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number }
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    
    const bboxWidth = bbox.maxX - bbox.minX;
    const bboxHeight = bbox.maxY - bbox.minY;
    
    // Central core (service/circulation)
    const coreSize = Math.min(moduleSpec.width * 1.5, moduleSpec.height * 1.5);
    modules.push(createOrientedRectModule(center, coreSize, coreSize, 0, 'Service Core'));
    
    // 4 wings: North, South, East, West
    const wingLength = Math.min(bboxWidth, bboxHeight) * 0.35;
    const wingWidth = moduleSpec.width;
    const spacing = 0.5;
    
    const wings = [
        { angle: 0, name: 'East' },    // Right
        { angle: 90, name: 'North' },  // Top
        { angle: 180, name: 'West' },  // Left
        { angle: 270, name: 'South' }, // Bottom
    ];
    
    wings.forEach(wing => {
        const unitsPerWing = Math.floor(wingLength / (moduleSpec.height + spacing));
        for (let i = 0; i < unitsPerWing; i++) {
            const distanceFromCore = coreSize / 2 + spacing + i * (moduleSpec.height + spacing);
            // Calculate position based on angle
            const rad = wing.angle * Math.PI / 180;
            const offsetX = Math.cos(rad) * (distanceFromCore + moduleSpec.height / 2);
            const offsetY = Math.sin(rad) * (distanceFromCore + moduleSpec.height / 2);
            const unitCenter = { x: center.x + offsetX, y: center.y + offsetY };
            
            const rect = { 
                x: unitCenter.x - wingWidth / 2, 
                y: unitCenter.y - moduleSpec.height / 2, 
                width: wingWidth, 
                height: moduleSpec.height, 
                rotation: 0 
            };
            
            if (isRectangleInPolygon(rect, buildablePolygon)) {
                modules.push(createOrientedRectModule(unitCenter, wingWidth, moduleSpec.height, wing.angle + 90, 'Unit'));
            }
        }
    });
    
    let idx = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Compact Tower: Maximum efficiency with central core and units radiating outward */
const generateCompactTowerLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    coreSpec: { width: number, height: number }
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    
    // Central core
    modules.push(createOrientedRectModule(center, coreSpec.width * 1.5, coreSpec.height * 1.5, 0, 'Service Core'));
    
    // Compact ring of units around core (6-8 units per floor typical for tower)
    const numUnits = 6;
    const radius = Math.max(moduleSpec.width, moduleSpec.height) * 0.7;
    
    for (let i = 0; i < numUnits; i++) {
        const angle = (i * 360 / numUnits);
        const rad = angle * Math.PI / 180;
        const offsetX = Math.cos(rad) * radius;
        const offsetY = Math.sin(rad) * radius;
        const unitCenter = { x: center.x + offsetX, y: center.y + offsetY };
        
        const rect = {
            x: unitCenter.x - moduleSpec.width / 2,
            y: unitCenter.y - moduleSpec.height / 2,
            width: moduleSpec.width,
            height: moduleSpec.height,
            rotation: 0
        };
        
        if (isRectangleInPolygon(rect, buildablePolygon)) {
            modules.push(createOrientedRectModule(unitCenter, moduleSpec.width, moduleSpec.height, angle, 'Unit'));
        }
    }
    
    let idx = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Linear Bar: Single-loaded slab for maximum views/light on one side */
const generateLinearBarLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number },
    angle: number
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const spacing = 1;
    const corridorWidth = 2.5;
    
    const bbox = getBoundingBox(buildablePolygon);
    const center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
    const polyR = buildablePolygon.map(p => rotatePoint(p, center, -angle));
    const rbox = getBoundingBox(polyR);
    
    // Single row of units with corridor on one side
    const rowHeight = moduleSpec.height + corridorWidth + spacing;
    
    for (let y = rbox.minY; y <= rbox.maxY - rowHeight; y += rowHeight * 2) { // Spaced out rows
        const segments = getScanlineSegments(polyR, y + moduleSpec.height / 2);
        for (const [sx, ex] of segments) {
            const usable = ex - sx;
            if (usable < moduleSpec.width) continue;
            const count = Math.floor((usable + spacing) / (moduleSpec.width + spacing));
            const leftover = usable - count * moduleSpec.width - (count - 1) * spacing;
            let x = sx + Math.max(0, leftover / 2);
            
            for (let i = 0; i < count; i++) {
                const unitRect = { x, y, width: moduleSpec.width, height: moduleSpec.height, rotation: 0 };
                if (isRectangleInPolygon(unitRect, polyR)) {
                    modules.push(createRotatedModule(unitRect, 'Unit', angle, center));
                }
                
                // Corridor behind
                const corridorRect = { x, y: y + moduleSpec.height, width: moduleSpec.width, height: corridorWidth, rotation: 0 };
                if (isRectangleInPolygon(corridorRect, polyR)) {
                    modules.push(createRotatedModule(corridorRect, 'Circulation', angle, center));
                }
                
                x += moduleSpec.width + spacing;
            }
        }
    }
    
    let idx = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};

/** Clustered Pavilions: Organic grouping of smaller blocks around shared spaces */
const generateClusteredLayout = (
    buildablePolygon: Vector2[],
    moduleSpec: { width: number, height: number }
): LayoutModule[] => {
    const modules: LayoutModule[] = [];
    const bbox = getBoundingBox(buildablePolygon);
    
    // Divide site into 4-6 clusters
    const bboxWidth = bbox.maxX - bbox.minX;
    const bboxHeight = bbox.maxY - bbox.minY;
    
    const clusterSize = Math.min(moduleSpec.width * 3, moduleSpec.height * 3);
    const spacing = clusterSize * 0.3; // Space between clusters
    
    const clustersX = Math.max(2, Math.floor(bboxWidth / (clusterSize + spacing)));
    const clustersY = Math.max(2, Math.floor(bboxHeight / (clusterSize + spacing)));
    
    for (let cy = 0; cy < clustersY; cy++) {
        for (let cx = 0; cx < clustersX; cx++) {
            const clusterCenterX = bbox.minX + spacing + cx * (clusterSize + spacing) + clusterSize / 2;
            const clusterCenterY = bbox.minY + spacing + cy * (clusterSize + spacing) + clusterSize / 2;
            
            // 2x2 or 3x3 units per cluster
            const unitsPerCluster = 4;
            const unitWidth = moduleSpec.width * 0.9;
            const unitHeight = moduleSpec.height * 0.9;
            
            const positions = [
                { x: -unitWidth/2 - 0.5, y: -unitHeight/2 - 0.5 },
                { x: unitWidth/2 + 0.5, y: -unitHeight/2 - 0.5 },
                { x: -unitWidth/2 - 0.5, y: unitHeight/2 + 0.5 },
                { x: unitWidth/2 + 0.5, y: unitHeight/2 + 0.5 },
            ];
            
            positions.forEach(pos => {
                const rect = {
                    x: clusterCenterX + pos.x - unitWidth / 2,
                    y: clusterCenterY + pos.y - unitHeight / 2,
                    width: unitWidth,
                    height: unitHeight,
                    rotation: 0
                };
                
                if (isRectangleInPolygon(rect, buildablePolygon)) {
                    modules.push({
                        label: 'Unit',
                        type: 'polygon',
                        points: [
                            { x: rect.x, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y },
                            { x: rect.x + rect.width, y: rect.y + rect.height },
                            { x: rect.x, y: rect.y + rect.height },
                        ],
                        x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotation: 0
                    });
                }
            });
            
            // Shared space in cluster center
            const sharedSize = Math.min(unitWidth, unitHeight) * 0.6;
            const sharedRect = {
                x: clusterCenterX - sharedSize / 2,
                y: clusterCenterY - sharedSize / 2,
                width: sharedSize,
                height: sharedSize,
                rotation: 0
            };
            
            if (isRectangleInPolygon(sharedRect, buildablePolygon)) {
                modules.push({
                    label: 'Common Area',
                    type: 'polygon',
                    points: [
                        { x: sharedRect.x, y: sharedRect.y },
                        { x: sharedRect.x + sharedRect.width, y: sharedRect.y },
                        { x: sharedRect.x + sharedRect.width, y: sharedRect.y + sharedRect.height },
                        { x: sharedRect.x, y: sharedRect.y + sharedRect.height },
                    ],
                    x: sharedRect.x, y: sharedRect.y, width: sharedRect.width, height: sharedRect.height, rotation: 0
                });
            }
        }
    }
    
    let idx = 1;
    modules.forEach(m => { if (m.label === 'Unit') m.label = `Unit ${idx++}`; });
    return modules;
};