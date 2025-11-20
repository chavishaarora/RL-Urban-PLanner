import { PlanShape, LayoutOption, LayoutModule } from '../types';

// --- Geometric Helper Types ---
export type Vector2 = { x: number; y: number };

// --- Geometric Helper Functions ---

/** Calculates the signed area of a polygon. Positive for CCW, negative for CW. */
export const calculateSignedPolygonArea = (polygon: Vector2[]): number => {
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return area / 2;
};


/** Calculates the absolute area of a polygon. */
export const calculatePolygonArea = (polygon: Vector2[]): number => {
    return Math.abs(calculateSignedPolygonArea(polygon));
};

/** Ensures the polygon has a counter-clockwise winding order, which is crucial for some geometric tests. */
export const ensurePolygonWinding = (polygon: Vector2[]): Vector2[] => {
    const signedArea = calculateSignedPolygonArea(polygon);
    if (signedArea < 0) {
        // If area is negative, polygon is clockwise, so reverse it
        return [...polygon].reverse();
    }
    return polygon;
};

/** Helper to check if a point is inside a polygon using the ray casting algorithm. */
export const isPointInPolygon = (point: Vector2, polygon: Vector2[]): boolean => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
};

/** Checks if all four corners of a potentially rotated rectangle are inside a polygon. */
export const isRectangleInPolygon = (rect: {x: number, y: number, width: number, height: number, rotation: number}, polygon: Vector2[]): boolean => {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
    ];
    // This function assumes the rect is NOT rotated yet, so we apply the rotation here.
    const rotatedCorners = corners.map(p => rotatePoint(p, {x: cx, y: cy}, rect.rotation));
    return rotatedCorners.every(p => isPointInPolygon(p, polygon));
};


/** Rotates a point around a given origin. */
export const rotatePoint = (point: Vector2, origin: Vector2, angle: number): Vector2 => {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const translated = { x: point.x - origin.x, y: point.y - origin.y };
    const rotated = {
        x: translated.x * cos - translated.y * sin,
        y: translated.x * sin + translated.y * cos,
    };
    return { x: rotated.x + origin.x, y: rotated.y + origin.y };
};

/** Gets the axis-aligned bounding box of a set of points. */
export const getBoundingBox = (points: Vector2[]): { minX: number, minY: number, maxX: number, maxY: number } => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
        minX: Math.min(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
        maxX: Math.max(...points.map(p => p.x)),
        maxY: Math.max(...points.map(p => p.y)),
    };
};


/**
 * Calculates the orientation of the principal axis of a polygon.
 * This helps determine the most efficient packing direction.
 * It uses the method of moments to find the axis of minimum rotational inertia.
 */
export const getPrimaryAxisAngle = (polygon: Vector2[]): number => {
    if (polygon.length < 3) return 0;

    let a = 0, b = 0, c = 0;
    let cx = 0, cy = 0, area = 0;
    
    // Calculate centroid and area
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        const cross = p1.x * p2.y - p2.x * p1.y;
        area += cross;
        cx += (p1.x + p2.x) * cross;
        cy += (p1.y + p2.y) * cross;
    }
    area /= 2;
    cx /= (6 * area);
    cy /= (6 * area);

    // Calculate moments of inertia relative to the centroid
    for (let i = 0; i < polygon.length; i++) {
        const p1 = { x: polygon[i].x - cx, y: polygon[i].y - cy };
        const p2 = { x: polygon[(i + 1) % polygon.length].x - cx, y: polygon[(i + 1) % polygon.length].y - cy };
        const cross = p1.x * p2.y - p2.x * p1.y;
        
        a += (p1.y * p1.y + p1.y * p2.y + p2.y * p2.y) * cross; // Ixx
        b += (2 * p1.y * p1.x + p1.y * p2.x + p2.y * p1.x + 2 * p2.y * p2.x) * cross; // Ixy
        c += (p1.x * p1.x + p1.x * p2.x + p2.x * p2.x) * cross; // Iyy
    }
    a /= 12;
    b /= 24;
    c /= 12;
    
    // Calculate the angle of the principal axis
    const angleRad = 0.5 * Math.atan2(-2 * b, a - c);
    return angleRad * (180 / Math.PI);
};

// --- Sutherland-Hodgman Polygon Clipping ---

/**
 * Checks if a point `p` is "inside" a clipping edge defined by `p1` -> `p2`.
 * For a CCW clip polygon, inside is to the left of the edge vector.
 */
const isInside = (p: Vector2, p1: Vector2, p2: Vector2): boolean => {
    return (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x) >= 0;
};

/**
 * Calculates the intersection point of two line segments (s1-e1 and s2-e2).
 */
const getIntersection = (s1: Vector2, e1: Vector2, s2: Vector2, e2: Vector2): Vector2 => {
    const dc = { x: s1.x - e1.x, y: s1.y - e1.y };
    const dp = { x: s2.x - e2.x, y: s2.y - e2.y };
    const n1 = s1.x * e1.y - s1.y * e1.x;
    const n2 = s2.x * e2.y - s2.y * e2.x;
    const n3 = 1.0 / (dc.x * dp.y - dc.y * dp.x);
    return {
        x: (n1 * dp.x - n2 * dc.x) * n3,
        y: (n1 * dp.y - n2 * dc.y) * n3,
    };
};


/**
 * Clips a subject polygon against a convex clip polygon using the Sutherland-Hodgman algorithm.
 * The clip polygon must have a counter-clockwise winding order.
 */
export const clipPolygon = (subjectPoints: Vector2[], clipPoints: Vector2[]): Vector2[] => {
    let outputList = subjectPoints;
    const clipEdges = clipPoints.map((p, i) => [p, clipPoints[(i + 1) % clipPoints.length]]);

    for (const [clipEdgeStart, clipEdgeEnd] of clipEdges) {
        const inputList = outputList;
        outputList = [];
        if (inputList.length === 0) break;

        let S = inputList[inputList.length - 1];

        for (const E of inputList) {
            const sInside = isInside(S, clipEdgeStart, clipEdgeEnd);
            const eInside = isInside(E, clipEdgeStart, clipEdgeEnd);

            if (eInside) {
                if (!sInside) {
                    // Start is outside, End is inside: add intersection then End
                    outputList.push(getIntersection(S, E, clipEdgeStart, clipEdgeEnd));
                }
                // Start is inside, End is inside: add End
                outputList.push(E);
            } else if (sInside) {
                // Start is inside, End is outside: add intersection
                outputList.push(getIntersection(S, E, clipEdgeStart, clipEdgeEnd));
            }
            // Both outside: add nothing

            S = E;
        }
    }
    return outputList;
};

// --- Polygon Offset Utilities ---

/** Normalize a vector */
const normalize = (v: Vector2): Vector2 => {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
};

/** Dot product */
const dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;

/** Perpendicular to vector (rotate 90deg CCW) */
const perp = (v: Vector2): Vector2 => ({ x: -v.y, y: v.x });

/** Line intersection from two points and directions (p + t*d) and (q + u*e) */
const intersectLines = (p: Vector2, d: Vector2, q: Vector2, e: Vector2): Vector2 => {
    const det = d.x * e.y - d.y * e.x;
    if (Math.abs(det) < 1e-8) {
        // Parallel; return midpoint between closest points as fallback
        return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    }
    const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / det;
    return { x: p.x + t * d.x, y: p.y + t * d.y };
};

/** Determine inward normal assuming polygon is CCW */
const inwardNormal = (a: Vector2, b: Vector2): Vector2 => {
    const edge = { x: b.x - a.x, y: b.y - a.y };
    // For CCW polygon, inward is -perp(edge)
    const n = perp(edge);
    const nn = normalize({ x: -n.x, y: -n.y });
    return nn;
};

/**
 * Offset a polygon by a uniform distance (meters) inwards.
 * Works best for simple polygons; concave features are handled pragmatically.
 */
export const offsetPolygonUniform = (polygon: Vector2[], distance: number): Vector2[] => {
    if (polygon.length < 3 || distance === 0) return polygon.slice();
    const ccw = ensurePolygonWinding(polygon);
    const n = ccw.length;
    const result: Vector2[] = [];
    for (let i = 0; i < n; i++) {
        const a = ccw[(i - 1 + n) % n];
        const b = ccw[i];
        const c = ccw[(i + 1) % n];
        const n1 = inwardNormal(a, b);
        const n2 = inwardNormal(b, c);
        const p1 = { x: b.x + n1.x * distance, y: b.y + n1.y * distance };
        const p2 = { x: b.x + n2.x * distance, y: b.y + n2.y * distance };
        const d1 = { x: b.x - a.x, y: b.y - a.y };
        const d2 = { x: c.x - b.x, y: c.y - b.y };
        const ip = intersectLines(p1, d1, p2, d2);
        result.push(ip);
    }
    return result;
};

/** Offset a polygon with per-edge distances (length equals number of edges/vertices). */
export const offsetPolygonPerEdge = (polygon: Vector2[], offsets: number[]): Vector2[] => {
    if (polygon.length < 3) return polygon.slice();
    const ccw = ensurePolygonWinding(polygon);
    const n = ccw.length;
    if (offsets.length < n) {
        const last = offsets[offsets.length - 1] ?? 0;
        offsets = offsets.concat(new Array(n - offsets.length).fill(last));
    }
    const result: Vector2[] = [];
    for (let i = 0; i < n; i++) {
        const a = ccw[(i - 1 + n) % n];
        const b = ccw[i];
        const c = ccw[(i + 1) % n];
        const dPrev = offsets[(i - 1 + n) % n] ?? 0;
        const dCur = offsets[i] ?? 0;

        const n1 = inwardNormal(a, b);
        const n2 = inwardNormal(b, c);
        const p1 = { x: b.x + n1.x * dPrev, y: b.y + n1.y * dPrev };
        const p2 = { x: b.x + n2.x * dCur, y: b.y + n2.y * dCur };
        const e1 = { x: b.x - a.x, y: b.y - a.y };
        const e2 = { x: c.x - b.x, y: c.y - b.y };
        const ip = intersectLines(p1, e1, p2, e2);
        result.push(ip);
    }
    return result;
};