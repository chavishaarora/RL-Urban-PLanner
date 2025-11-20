import * as THREE from 'three';
import { PlanShape } from '../types';

/**
 * Converts a PlanShape (2D polygon in meters) to a Three.js 3D building mesh.
 */
export const shapeToBuilding3D = (shape: PlanShape, origin: { lat: number; lng: number }): THREE.Mesh => {
    const points = shape.points || [];
    if (points.length < 3) {
        // Fallback: create a simple box if no valid polygon
        const geometry = new THREE.BoxGeometry(shape.width, shape.height, 10);
        const material = new THREE.MeshStandardMaterial({ color: shape.fill, transparent: true, opacity: shape.fillOpacity ?? 0.7 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(shape.x + shape.width / 2, shape.y + shape.height / 2, 5);
        return mesh;
    }

    // Calculate the height from floors and floorHeight
    const floors = shape.floors || 1;
    const floorHeight = shape.floorHeight || 3.5;
    const buildingHeight = floors * floorHeight;

    // Convert 2D polygon points to Three.js Shape
    // Apply rotation if needed
    let finalPoints = [...points];
    if (shape.rotation && shape.rotation !== 0) {
        const { minX, minY, maxX, maxY } = getBoundingBox(finalPoints);
        const center = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
        finalPoints = finalPoints.map(p => rotatePoint(p, center, shape.rotation));
    }

    // Create a Three.js Shape from the 2D polygon
    const threeShape = new THREE.Shape();
    finalPoints.forEach((p, i) => {
        if (i === 0) {
            threeShape.moveTo(p.x, p.y);
        } else {
            threeShape.lineTo(p.x, p.y);
        }
    });
    threeShape.closePath();

    // Extrude the shape to create a 3D building
    const extrudeSettings = {
        depth: buildingHeight,
        bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings);

    // Rotate geometry to stand upright (Three.js extrudes along Z, we want it along Y)
    geometry.rotateX(Math.PI / 2);

    // Create material with the shape's color
    const color = new THREE.Color(shape.fill);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        transparent: shape.fillOpacity !== undefined,
        opacity: shape.fillOpacity ?? 0.7,
        roughness: 0.7,
        metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store shape id for selection
    mesh.userData = { shapeId: shape.id, category: shape.category, label: shape.label };

    return mesh;
};

// Utility functions
const getBoundingBox = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
        minX: Math.min(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
        maxX: Math.max(...points.map(p => p.x)),
        maxY: Math.max(...points.map(p => p.y)),
    };
};

const rotatePoint = (point: { x: number; y: number }, origin: { x: number; y: number }, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const translated = { x: point.x - origin.x, y: point.y - origin.y };
    const rotated = {
        x: translated.x * cos - translated.y * sin,
        y: translated.x * sin + translated.y * cos,
    };
    return { x: rotated.x + origin.x, y: rotated.y + origin.y };
};

/**
 * Create a ground plane mesh for the site boundary
 */
export const createGroundPlane = (boundary: { lat: number; lng: number }[], origin: { lat: number; lng: number }): THREE.Mesh => {
    // Convert boundary to meters using a simple approximation
    const R = 6371000; // Earth's radius in meters
    const points = boundary.map(p => {
        const dx = (p.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
        const dy = (p.lat - origin.lat) * (Math.PI / 180) * R;
        return { x: dx, y: dy };
    });

    const threeShape = new THREE.Shape();
    points.forEach((p, i) => {
        if (i === 0) {
            threeShape.moveTo(p.x, p.y);
        } else {
            threeShape.lineTo(p.x, p.y);
        }
    });
    threeShape.closePath();

    const geometry = new THREE.ShapeGeometry(threeShape);
    geometry.rotateX(-Math.PI / 2); // Lay flat on the ground

    const material = new THREE.MeshStandardMaterial({
        color: 0x8bc34a,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    return mesh;
};
