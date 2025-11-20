// @ts-nocheck
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
// Extend Three.js types for React Three Fiber
import { extend } from '@react-three/fiber';
extend(THREE);
import { PlanShape, LocationData } from '../../types';
import { offsetPolygonUniform, getPrimaryAxisAngle } from '@/utils/geometry';
import { Google3DTiles } from './Google3DTiles';
import { SunSimulation, NorthIndicator } from './SunSimulation';
import { ViewCorridors } from './ViewCorridors';
import { CustomDropdown } from '../CustomDropdown';
import { fetchOSMRoadCenterlines } from '@/services/osmService';
import { SolarRadiationAnalysis, SolarAnalysisData } from './SolarRadiationAnalysis';
import { TransformableBuildings } from './TransformableBuildings';
import { exportToOBJ, downloadOBJ, exportUserContentOnly, exportCompleteScene } from '@/utils/OBJExporter';
import { exportToGLTF, downloadGLTF, organizeSceneForExport } from '@/utils/GLTFExporter';
import { fetchPedestrianSpaces, PedestrianSpace } from '@/services/pedestrianSpaces';
import SunCalc from 'suncalc';
import { scaleSequential } from 'd3-scale';
import { interpolateYlOrRd, interpolatePlasma, interpolateRdYlBu } from 'd3-scale-chromatic';
import { FreeEnvironmentalGradient } from '../FreeEnvironmentalGradient';
import { AnalysisLegend } from '../AnalysisLegend';

interface Buildings3DProps {
    shapes: PlanShape[];
    //codepreview-start Buildings3DProps-selectedShapeIds (boolean //true==00+1)
    //plotmatlib.in (boolessn3d)
    selectedShapeIds: string[];
    origin: { lat: number; lng: number };
    onSelectShape: (id: string | null, multi: boolean) => void;
}

interface SiteBoundaryProps {
    location: LocationData;
    origin: { lat: number; lng: number };
}

const GroundPlane: React.FC = () => {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[1000, 1000]} />
            <shadowMaterial opacity={0.15} />
        </mesh>
    );
};

// Pedestrian Environmental Analysis Component
interface PedestrianEnvironmentalAnalysisProps {
    spaces: PedestrianSpace[];
    origin: { lat: number; lng: number };
    analysisType: 'solar' | 'wind' | 'shadow' | 'comfort';
    latitude: number;
    longitude: number;
    month: number;
    timeOfDay: number;
    buildingMeshList: THREE.Mesh[];
}

const PedestrianEnvironmentalAnalysis: React.FC<PedestrianEnvironmentalAnalysisProps> = ({ 
    spaces, 
    origin, 
    analysisType, 
    latitude, 
    longitude, 
    month, 
    timeOfDay,
    buildingMeshList = []
}) => {
    const R = 6371000;
    const meshRef = useRef<THREE.Mesh>(null);
    
    const buildingData = useMemo(() => {
        return buildingMeshList
            .filter(mesh => mesh?.userData?.isBuilding)
            .map(mesh => {
                mesh.updateMatrixWorld?.();
                const bbox = new THREE.Box3().setFromObject(mesh);
                const height = mesh.userData?.height || Math.max(5, bbox.max.y - bbox.min.y);
                return { mesh, bbox, height };
            });
    }, [buildingMeshList]);
    
    // Calculate bounds from spaces
    const bounds = useMemo(() => {
        if (spaces.length === 0) return { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
        
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        
        spaces.forEach(space => {
            space.geometry.forEach(({ lat, lng }) => {
                const dx = (lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                const dy = (lat - origin.lat) * (Math.PI / 180) * R;
                minX = Math.min(minX, dx);
                maxX = Math.max(maxX, dx);
                minZ = Math.min(minZ, dy);
                maxZ = Math.max(maxZ, dy);
            });
        });
        
        // Expand bounds by 20%
        const width = maxX - minX;
        const height = maxZ - minZ;
        return {
            minX: minX - width * 0.2,
            maxX: maxX + width * 0.2,
            minZ: minZ - height * 0.2,
            maxZ: maxZ + height * 0.2
        };
    }, [spaces, origin]);
    
    // Professional gradient color scales
    const getSolarColor = (value: number): THREE.Color => {
        const normalized = Math.max(0, Math.min(1, value / 10));
        if (normalized < 0.33) {
            const t = normalized / 0.33;
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFFF8C9), new THREE.Color(0xFFC857), t
            );
        } else if (normalized < 0.66) {
            const t = (normalized - 0.33) / 0.33;
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFFC857), new THREE.Color(0xFF8A00), t
            );
        } else {
            const t = (normalized - 0.66) / 0.34;
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFF8A00), new THREE.Color(0xFF4500), t
            );
        }
    };
    
    const getWindColor = (value: number): THREE.Color => {
        if (value < 2) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x90CAF9), new THREE.Color(0x42A5F5), value / 2
            );
        } else if (value < 5) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x42A5F5), new THREE.Color(0x1E88E5), (value - 2) / 3
            );
        } else if (value < 8) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x1E88E5), new THREE.Color(0xFF9800), (value - 5) / 3
            );
        } else if (value < 12) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFF9800), new THREE.Color(0xE53935), (value - 8) / 4
            );
        } else {
            return new THREE.Color(0xB71C1C);
        }
    };
    
    const getShadowColor = (value: number): THREE.Color => {
        const normalized = Math.max(0, Math.min(1, value / 12));
        if (normalized < 0.5) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0xC8C8FF), new THREE.Color(0x9090E0), normalized / 0.5
            );
        } else {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x9090E0), new THREE.Color(0x6060C0), (normalized - 0.5) / 0.5
            );
        }
    };
    
    const getComfortColor = (value: number): THREE.Color => {
        if (value < 18) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x4FC3F7), new THREE.Color(0x81D4FA), (value - 10) / 8
            );
        } else if (value < 23) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0x81D4FA), new THREE.Color(0xFFF59D), (value - 18) / 5
            );
        } else if (value < 29) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFFF59D), new THREE.Color(0xFFCA28), (value - 23) / 6
            );
        } else if (value < 35) {
            return new THREE.Color().lerpColors(
                new THREE.Color(0xFFCA28), new THREE.Color(0xF57C00), (value - 29) / 6
            );
        } else {
            return new THREE.Color(0xE65100);
        }
    };
    
    // Calculate if a point is in shadow based on sun position and buildings
    const isInShadow = useCallback((x: number, z: number, sunPos: any): { inShadow: boolean; shadowDepth: number } => {
        if (buildingData.length === 0) {
            return { inShadow: false, shadowDepth: 0 };
        }
        
        const sunAltitude = sunPos.altitude * (180 / Math.PI);
        const sunAzimuth = sunPos.azimuth * (180 / Math.PI);
        
        // If sun is below horizon, everything is in shadow
        if (sunAltitude <= 0) {
            return { inShadow: true, shadowDepth: 1 };
        }
        
        // Calculate sun direction vector
        const sunAltitudeRad = sunPos.altitude;
        const sunAzimuthRad = sunPos.azimuth;
        
        // Sun direction (pointing FROM the sun TO the ground)
        const sunDir = new THREE.Vector3(
            Math.sin(sunAzimuthRad) * Math.cos(sunAltitudeRad),
            Math.sin(sunAltitudeRad),
            -Math.cos(sunAzimuthRad) * Math.cos(sunAltitudeRad)
        ).normalize();
        
        // Ray origin: start from the point and trace upward, then reverse toward sun
        const rayOrigin = new THREE.Vector3(x, 200, z); // Start high above ground
        const rayDirection = sunDir.clone().multiplyScalar(-1); // Point toward sun
        
        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        
        // Check intersection with buildings
        let maxShadowDepth = 0;
        let hitCount = 0;
        
        for (const { mesh, height } of buildingData) {
            const intersections = raycaster.intersectObject(mesh, false);
            
            if (intersections.length > 0) {
                hitCount++;
                // Calculate shadow depth based on building height and sun angle
                const shadowDepth = Math.min(1, (height / 50) * (1 - sunAltitude / 90));
                maxShadowDepth = Math.max(maxShadowDepth, shadowDepth);
            }
        }
        
        return {
            inShadow: hitCount > 0,
            shadowDepth: maxShadowDepth
        };
    }, [buildingData]);
    
    // Multi-octave noise for realistic variation
    const multiOctaveNoise = useCallback((x: number, z: number, octaves: number = 3): number => {
        let value = 0;
        let amplitude = 1;
        let frequency = 0.002;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            value += Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        
        return value / maxValue;
    }, []);
    
    // Calculate distance to nearest building edge
    const getDistanceToBuilding = useCallback((x: number, z: number): number => {
        if (buildingData.length === 0) return 100;

        const point = new THREE.Vector3(x, 0, z);
        let minDist = Infinity;

        buildingData.forEach(({ bbox }) => {
            const closest = bbox.clampPoint(point, new THREE.Vector3());
            const dx = point.x - closest.x;
            const dz = point.z - closest.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDist) {
                minDist = dist;
            }
        });

        return Math.min(minDist, 100);
    }, [buildingData]);

    const computeWindField = useCallback((x: number, z: number): { speed: number; direction: number } => {
        const noise = multiOctaveNoise(x * 0.9 + 1500, z * 0.9 - 800, 4);
        const turbulence1 = Math.sin(x * 0.006) * Math.cos(z * 0.006);
        const turbulence2 = Math.cos(x * 0.009) * Math.sin(z * 0.009);
        const distToBuilding = getDistanceToBuilding(x, z);
        const buildingEffect = distToBuilding < 30 ? (1 + Math.sin(distToBuilding * 0.1) * 0.4) : 1;

        const baseSpeed = 4.5 + noise * 3 + turbulence1 * 2 + turbulence2 * 1.5;
        const speed = Math.max(0, Math.min(14, baseSpeed * buildingEffect));

        const dirX = Math.cos(z * 0.01 + noise * 0.5) + Math.sin(x * 0.004);
        const dirZ = Math.sin(z * 0.01 - noise * 0.5) + Math.cos(x * 0.004);
        const direction = Math.atan2(dirZ, dirX);

        return { speed, direction };
    }, [getDistanceToBuilding, multiOctaveNoise]);
    
    // Calculate value at any point based on nearby data
    const calculateValueAtPoint = useCallback((x: number, z: number, date: Date, sunPos: any): number => {
        if (analysisType === 'solar') {
            const sunAltitude = sunPos.altitude * (180 / Math.PI);
            const sunAzimuth = sunPos.azimuth * (180 / Math.PI);
            const baseRadiation = sunAltitude > 0 ? (Math.sin(sunAltitude * Math.PI / 180) * 10) : 0;
            
            // Check if point is in shadow
            const { inShadow, shadowDepth } = isInShadow(x, z, sunPos);
            
            if (inShadow) {
                // Significantly reduced radiation in shadows
                // Some diffuse radiation still reaches shadowed areas
                const diffuseRadiation = baseRadiation * 0.15; // Only 15% diffuse light
                const shadowReduction = 1 - (shadowDepth * 0.85); // Up to 85% reduction
                return Math.max(0, diffuseRadiation * shadowReduction);
            } else {
                // Full direct radiation with spatial variation
                const noise = multiOctaveNoise(x, z, 3);
                const directionNoise = Math.sin((x + z) * 0.002 + sunAzimuth * 0.05);
                const orientationFactor = noise * 0.25 + directionNoise * 0.1;
                
                return Math.max(0, Math.min(10, baseRadiation * (1 + orientationFactor)));
            }
        } else if (analysisType === 'wind') {
            return computeWindField(x, z).speed;
        } else if (analysisType === 'shadow') {
            const sunAltitude = sunPos.altitude * (180 / Math.PI);
            
            // Base shadow hours when sun is up
            const baseShadowHours = sunAltitude > 0 ? (10 - sunAltitude / 8) : 12;
            
            // Check if this point is actually in shadow from buildings
            const { inShadow, shadowDepth } = isInShadow(x, z, sunPos);
            
            if (inShadow) {
                // Point is in actual building shadow - much darker
                // Shadow hours increase significantly (less sun exposure)
                const additionalShadow = 6 * shadowDepth; // Up to 6 extra hours of shadow
                return Math.min(12, baseShadowHours + additionalShadow);
            } else {
                // Point receives direct sun - lighter
                // Add subtle noise for natural variation in open areas
                const noise = multiOctaveNoise(x, z, 2) * 0.3;
                return Math.max(0, baseShadowHours + noise);
            }
        } else {
            // Thermal comfort with heat island effect and building influence
            const noise = multiOctaveNoise(x, z, 3);
            const distToBuilding = getDistanceToBuilding(x, z);
            
            // Buildings create heat islands - warmer near buildings
            const heatIsland = distToBuilding < 50 ? 
                (1 - distToBuilding / 50) * 6 : 0;
            
            const baseTemp = 22 + noise * 5 + heatIsland;
            
            return Math.max(10, Math.min(38, baseTemp));
        }
    }, [analysisType, multiOctaveNoise, getDistanceToBuilding, isInShadow, computeWindField]);
    
    useEffect(() => {
        if (!meshRef.current) return;
        
        const date = new Date();
        date.setMonth(month - 1);
        date.setHours(Math.floor(timeOfDay));
        date.setMinutes((timeOfDay % 1) * 60);
        
        const sunPos = SunCalc.getPosition(date, latitude, longitude);
        
        // Create high-resolution ground plane
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxZ - bounds.minZ;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        
        // Ultra-high resolution for smooth gradients and building edge detail
        const segments = 200;
        const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
        
        // Generate vertex colors for smooth gradient with edge-aware blending
        const positions = geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) + centerX;
            const z = positions.getY(i) + centerZ; // PlaneGeometry uses Y for what we think of as Z
            
            // Calculate base value
            let value = calculateValueAtPoint(x, z, date, sunPos);
            
            // Apply subtle neighbor-based smoothing for more realistic gradients
            // Sample nearby points for smooth transitions
            const smoothRadius = Math.max(width, height) / segments * 2;
            let neighborSum = value;
            let neighborCount = 1;
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dz === 0) continue;
                    const nx = x + dx * smoothRadius;
                    const nz = z + dz * smoothRadius;
                    neighborSum += calculateValueAtPoint(nx, nz, date, sunPos);
                    neighborCount++;
                }
            }
            
            // Blend between sharp detail and smooth gradient
            const smoothed = neighborSum / neighborCount;
            value = value * 0.7 + smoothed * 0.3;
            
            const color = analysisType === 'solar' ? getSolarColor(value) :
                         analysisType === 'wind' ? getWindColor(value) :
                         analysisType === 'shadow' ? getShadowColor(value) :
                         getComfortColor(value);
            
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Update mesh
        if (meshRef.current.geometry) {
            meshRef.current.geometry.dispose();
        }
        meshRef.current.geometry = geometry;
        meshRef.current.position.set(centerX, 0.2, centerZ);
        
    }, [bounds, month, timeOfDay, latitude, longitude, analysisType, calculateValueAtPoint, getSolarColor, getWindColor, getShadowColor, getComfortColor]);

    const windArrows = useMemo(() => {
        if (analysisType !== 'wind') return [] as Array<{
            id: string;
            dir: [number, number, number];
            origin: [number, number, number];
            length: number;
            color: number;
            headLength: number;
            headWidth: number;
        }>;

        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxZ - bounds.minZ;
        const spacingX = Math.max(20, width / 12);
        const spacingZ = Math.max(20, height / 12);
        const arrows: Array<{
            id: string;
            dir: [number, number, number];
            origin: [number, number, number];
            length: number;
            color: number;
            headLength: number;
            headWidth: number;
        }> = [];

        for (let x = bounds.minX; x <= bounds.maxX; x += spacingX) {
            for (let z = bounds.minZ; z <= bounds.maxZ; z += spacingZ) {
                const { speed, direction } = computeWindField(x, z);
                const normalized = Math.min(1, speed / 14);
                const length = 3 + normalized * 4;
                const headLength = length * 0.35;
                const headWidth = headLength * 0.6;
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(0x4FC3F7),
                    new THREE.Color(0xF57C00),
                    normalized
                ).getHex();

                arrows.push({
                    id: `${x.toFixed(1)}-${z.toFixed(1)}`,
                    dir: [Math.cos(direction), 0, Math.sin(direction)],
                    origin: [x, 0.6, z],
                    length,
                    color,
                    headLength,
                    headWidth
                });
            }
        }

        return arrows;
    }, [analysisType, bounds, computeWindField]);
    
    const opacity = analysisType === 'solar' ? 0.7 :
                   analysisType === 'wind' ? 0.5 :
                   analysisType === 'shadow' ? 0.4 :
                   0.6;
    
    return (
        <>
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial 
                    vertexColors
                    transparent
                    opacity={opacity}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    roughness={0.9}
                    metalness={0.05}
                    emissiveIntensity={0.1}
                />
            </mesh>
            {analysisType === 'wind' && windArrows.length > 0 && (
                <group>
                    {windArrows.map(arrow => (
                        <arrowHelper
                            key={arrow.id}
                            args={[
                                new THREE.Vector3(...arrow.dir).normalize(),
                                new THREE.Vector3(...arrow.origin),
                                arrow.length,
                                arrow.color,
                                arrow.headLength,
                                arrow.headWidth
                            ]}
                        />
                    ))}
                </group>
            )}
        </>
    );
};

const SiteBoundary: React.FC<SiteBoundaryProps> = ({ location, origin }) => {
    const lineRef = useRef<THREE.Line>(null);

    useEffect(() => {
        if (!location?.boundary || location.boundary.length === 0) return;

        const R = 6371000;
        const points = location.boundary.map(p => {
            const dx = (p.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
            const dy = (p.lat - origin.lat) * (Math.PI / 180) * R;
            return new THREE.Vector3(dx, 0.1, dy);
        });

        // Close the loop
        points.push(points[0].clone());

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        if (lineRef.current) {
            lineRef.current.geometry.dispose();
            lineRef.current.geometry = geometry;
        }
    }, [location?.boundary, origin.lat, origin.lng]);

    return (
        <line ref={lineRef}>
            <bufferGeometry />
            <lineBasicMaterial color="#0f766e" linewidth={3} />
        </line>
    );
};

// Helper function to create 3D objects for landscape elements
const create3DLandscapeObject = (shape: PlanShape): THREE.Object3D | null => {
    const points = shape.points || [];
    if (points.length < 3) return null;

    const group = new THREE.Group();
    
    // Calculate actual center from points
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    
    // Map coordinates: p.x -> Three.js X, p.y -> Three.js Z (positive north, same as site boundary)
    const posX = centerX;
    const posZ = centerY;

    switch (shape.objectType) {
        case 'tree': {
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(posX, 2, posZ);
            trunk.castShadow = true;
            
            // Tree canopy
            const canopyGeometry = new THREE.SphereGeometry(2, 8, 8);
            const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 });
            const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
            canopy.position.set(posX, 5, posZ);
            canopy.castShadow = true;
            
            group.add(trunk);
            group.add(canopy);
            break;
        }
        case 'shrub': {
            const shrubGeometry = new THREE.SphereGeometry(0.75, 8, 8);
            const shrubMaterial = new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.7 });
            const shrub = new THREE.Mesh(shrubGeometry, shrubMaterial);
            shrub.scale.y = 0.7;
            shrub.position.set(posX, 0.5, posZ);
            shrub.castShadow = true;
            
            group.add(shrub);
            break;
        }
        case 'bench': {
            // Bench seat
            const seatGeometry = new THREE.BoxGeometry(2, 0.1, 0.5);
            const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6 });
            const seat = new THREE.Mesh(seatGeometry, benchMaterial);
            seat.position.set(posX, 0.5, posZ);
            seat.castShadow = true;
            
            // Bench back
            const backGeometry = new THREE.BoxGeometry(2, 0.5, 0.1);
            const back = new THREE.Mesh(backGeometry, benchMaterial);
            back.position.set(posX, 0.75, posZ - 0.25);
            back.castShadow = true;
            
            group.add(seat);
            group.add(back);
            break;
        }
        case 'kiosk': {
            // Kiosk base
            const baseGeometry = new THREE.BoxGeometry(4, 3, 4);
            const kioskMaterial = new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5 });
            const base = new THREE.Mesh(baseGeometry, kioskMaterial);
            base.position.set(posX, 1.5, posZ);
            base.castShadow = true;
            
            // Roof
            const roofGeometry = new THREE.ConeGeometry(3, 1, 4);
            const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.6 });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.set(posX, 3.5, posZ);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            
            group.add(base);
            group.add(roof);
            break;
        }
        case 'lamp': {
            // Lamp post
            const poleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 4, 6);
            const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.7 });
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            pole.position.set(posX, 2, posZ);
            pole.castShadow = true;
            
            // Lamp head
            const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
            const headMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xfff8dc, 
                emissive: 0xfff8dc, 
                emissiveIntensity: 0.5,
                roughness: 0.2 
            });
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.position.set(posX, 4.2, posZ);
            
            group.add(pole);
            group.add(head);
            break;
        }
        case 'dustbin': {
            const binGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8);
            const binMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.3 });
            const bin = new THREE.Mesh(binGeometry, binMaterial);
            bin.position.set(posX, 0.4, posZ);
            bin.castShadow = true;
            
            group.add(bin);
            break;
        }
        case 'playzone': {
            // Simple colorful box for play zone
            const playGeometry = new THREE.BoxGeometry(shape.width * 0.8, 0.2, shape.height * 0.8);
            const playMaterial = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.8 });
            const playGround = new THREE.Mesh(playGeometry, playMaterial);
            playGround.position.set(posX, 0.1, posZ);
            playGround.receiveShadow = true;
            
            group.add(playGround);
            break;
        }
        case 'bikeparking': {
            // Bike rack representation
            const rackGeometry = new THREE.BoxGeometry(shape.width * 0.9, 0.8, 0.5);
            const rackMaterial = new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.4, metalness: 0.6 });
            const rack = new THREE.Mesh(rackGeometry, rackMaterial);
            rack.position.set(posX, 0.4, posZ);
            rack.castShadow = true;
            
            group.add(rack);
            break;
        }
        case 'path':
        case 'fencing':
        default:
            // For paths and fencing, just use flat extrusion (handled in main Buildings3D)
            return null;
    }

    return group;
};

const Buildings3D: React.FC<Buildings3DProps & { onMeshesUpdate: (meshes: THREE.Mesh[]) => void; onSceneUpdate: (scene: THREE.Scene) => void }> =
    ({ shapes, selectedShapeIds, origin, onSelectShape, onMeshesUpdate, onSceneUpdate }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, raycaster, camera, gl } = useThree();

    useEffect(() => {
        onSceneUpdate(scene);
        // Expose scene to window for OBJ export
        (window as any).__urbaneyes3dscene = scene;
    }, [scene, onSceneUpdate]);

    useEffect(() => {
        if (!groupRef.current) return;

        // Clear previous meshes
        groupRef.current.clear();
        
        const newMeshes: THREE.Mesh[] = [];

        // Filter to only visible shapes
        const visibleShapes = shapes.filter(s => s.visible !== false);

        // Create 3D buildings from shapes
        visibleShapes.forEach(shape => {
            try {
                const points = shape.points || [];
                if (points.length < 3) return;

                // Check if this is a landscape object that needs special 3D treatment
                if (shape.objectType && ['tree', 'shrub', 'bench', 'kiosk', 'lamp', 'dustbin', 'playzone', 'bikeparking'].includes(shape.objectType)) {
                    const landscapeObject = create3DLandscapeObject(shape);
                    if (landscapeObject) {
                        landscapeObject.userData = { shapeId: shape.id };
                        
                        // Highlight selected
                        if (selectedShapeIds.includes(shape.id)) {
                            landscapeObject.traverse((child) => {
                                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                                    child.material = child.material.clone();
                                    child.material.emissive = new THREE.Color(0x0f766e);
                                    child.material.emissiveIntensity = 0.3;
                                }
                            });
                        }
                        
                        groupRef.current?.add(landscapeObject);
                        landscapeObject.traverse((child) => {
                            if (child instanceof THREE.Mesh) {
                                newMeshes.push(child);
                            }
                        });
                    }
                    return; // Skip standard extrusion for these objects
                }

                const floors = shape.floors || 1;
                const floorHeight = shape.floorHeight || 3.5;
                const buildingHeight = floors * floorHeight;

                // For paths and fencing, use minimal height
                const finalHeight = (shape.objectType === 'path') ? 0.01 : (shape.objectType === 'fencing') ? 1.2 : buildingHeight;

                // Create shape
                const threeShape = new THREE.Shape();
                // Flip the Y coordinate to match the site's coordinate system (north positive -> Three.js Z uses -y)
                points.forEach((p, i) => {
                    const vx = p.x;
                    const vy = -p.y; // invert Y so map north becomes negative Z in Three
                    if (i === 0) {
                        threeShape.moveTo(vx, vy);
                    } else {
                        threeShape.lineTo(vx, vy);
                    }
                });
                threeShape.closePath();

                // Roads/paths are completely flat planes, not extruded at all
                let geometry: THREE.BufferGeometry;
                if (shape.objectType === 'path') {
                    // Use PlaneGeometry for perfectly flat rectangular roads
                    const shapeGeo = new THREE.ShapeGeometry(threeShape);
                    shapeGeo.rotateX(-Math.PI / 2); // Rotate to lie flat on XZ plane
                    geometry = shapeGeo;
                } else {
                    const extrude = new THREE.ExtrudeGeometry(threeShape, {
                        depth: finalHeight,
                        bevelEnabled: false,
                    });
                    extrude.rotateX(-Math.PI / 2);
                    geometry = extrude;
                }

                // Material with enhanced color
                const color = new THREE.Color(shape.fill);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    transparent: false,
                    opacity: 1.0,
                    roughness: 0.5,
                    metalness: 0.15,
                });

                // Highlight selected
                if (selectedShapeIds.includes(shape.id)) {
                    material.emissive = new THREE.Color(0x0f766e);
                    material.emissiveIntensity = 0.3;
                }

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (shape.objectType === 'path') {
                    mesh.position.y = 0.01; // very slight lift above ground plane to prevent z-fighting
                    if (material instanceof THREE.MeshStandardMaterial) {
                        material.color = new THREE.Color('#2a2a2c'); // Dark asphalt color
                        material.roughness = 0.9;
                        material.metalness = 0.0;
                        material.side = THREE.DoubleSide; // Render both sides of the flat plane
                    }

                    // Sidewalk bands (offset polygon shrunk)
                    const basePoly = points.map(p => new THREE.Vector2(p.x, -p.y));
                    const sidewalkOuter = basePoly;
                    const sidewalkInner = offsetPolygonUniform(basePoly.map(v => ({ x: v.x, y: v.y })), 2.5);
                    if (sidewalkInner.length >= 3) {
                        const swShape = new THREE.Shape();
                        sidewalkOuter.forEach((p,i)=>{ i===0? swShape.moveTo(p.x,p.y): swShape.lineTo(p.x,p.y);});
                        swShape.closePath();
                        const holePath = new THREE.Path();
                        sidewalkInner.forEach((p,i)=>{ i===0? holePath.moveTo(p.x,p.y): holePath.lineTo(p.x,p.y);});
                        holePath.closePath();
                        swShape.holes.push(holePath);
                        const swGeo = new THREE.ShapeGeometry(swShape);
                        swGeo.rotateX(-Math.PI/2);
                        const swMat = new THREE.MeshStandardMaterial({ color:'#2d2d30', roughness:0.9, metalness:0, transparent:true, opacity:0.9 });
                        const swMesh = new THREE.Mesh(swGeo, swMat);
                        swMesh.position.y = 0.025;
                        groupRef.current?.add(swMesh);
                    }

                    // Lane markings: use thin boxes along primary axis
                    const axisDeg = getPrimaryAxisAngle(points.map(p=>({x:p.x,y:p.y})));
                    const axisRad = axisDeg * Math.PI/180;
                    const dir = new THREE.Vector3(Math.cos(axisRad),0, -Math.sin(axisRad));
                    const centerX = points.reduce((s,p)=>s+p.x,0)/points.length;
                    const centerY = points.reduce((s,p)=>s+p.y,0)/points.length;
                    const center = new THREE.Vector3(centerX,0,-centerY);
                    const stripeCount = 12;
                    for(let i=0;i<stripeCount;i++){
                        const frac = (i/stripeCount)-0.5;
                        const pos = center.clone().addScaledVector(dir, frac * Math.min(shape.width, shape.height));
                        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.001,3), new THREE.MeshStandardMaterial({color:'#fafafa', emissive:'#222', emissiveIntensity:0.2, roughness:0.4, metalness:0}));
                        stripe.position.set(pos.x,0.03,pos.z);
                        stripe.rotation.y = axisRad;
                        groupRef.current?.add(stripe);
                        newMeshes.push(stripe);
                    }
                }
                const isBuilding = finalHeight > 2 && shape.objectType !== 'path' && shape.objectType !== 'fencing';
                mesh.userData = {
                    shapeId: shape.id,
                    objectType: shape.objectType || 'building',
                    isBuilding,
                    height: finalHeight
                };

                groupRef.current?.add(mesh);
                newMeshes.push(mesh);
            } catch (error) {
                console.error(`Failed to create 3D mesh for shape ${shape.id}:`, error);
            }
        });

        onMeshesUpdate(newMeshes);
    }, [shapes, selectedShapeIds, origin.lat, origin.lng, onMeshesUpdate]);

    // Handle clicks
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (!groupRef.current) return;

            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            const intersects = raycaster.intersectObjects(groupRef.current.children, true);

            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object as THREE.Mesh;
                const shapeId = clickedMesh.userData?.shapeId;
                if (shapeId) {
                    onSelectShape(shapeId, event.shiftKey);
                }
            } else {
                onSelectShape(null, false);
            }
        };

        gl.domElement.addEventListener('click', handleClick);
        return () => gl.domElement.removeEventListener('click', handleClick);
    }, [gl, raycaster, camera, onSelectShape]);

    return <group ref={groupRef} />;
};

// @ts-nocheck
interface Viewer3DProps {
    shapes: PlanShape[];
    selectedShapeIds: string[];
    location: LocationData | null;
    onSelectShape: (id: string | null, multi: boolean) => void;
    onShapeUpdate?: (shapeId: string, updates: Partial<PlanShape>) => void;
    onSceneReady?: (scene: THREE.Scene) => void;
}

export const Viewer3D: React.FC<Viewer3DProps> = ({ shapes, selectedShapeIds, location, onSelectShape, onShapeUpdate, onSceneReady }) => {
    // Fix ReferenceError: Cannot access 'sceneRef' before initialization
    const [sceneRef, setSceneRef] = useState<THREE.Scene | null>(null);
    const [show3DSurroundings, setShow3DSurroundings] = useState(false);
    const [buildingMeshes, setBuildingMeshes] = useState<THREE.Mesh[]>([]);
    const [timeOfDay, setTimeOfDay] = useState(14); // 2 PM default
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // Current month (1-12)
    const [activeVisualization, setActiveVisualization] = useState<string | null>(null);
    const [weatherData, setWeatherData] = useState({ temperature: 20, windSpeed: 2, solarRadiation: 500 });
    const [windDirection, setWindDirection] = useState(270); // Default: West
    const [windSpeed, setWindSpeed] = useState(3);
    const [deletedBuildingIds, setDeletedBuildingIds] = useState<Set<string>>(new Set());
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [showViewCorridors, setShowViewCorridors] = useState(false);
    const [viewpoints, setViewpoints] = useState<Array<{ x: number; y: number; z: number; label: string; direction: number }>>([]);
    const [selectedViewpointIndex, setSelectedViewpointIndex] = useState<number | null>(null);
    const googleApiKey = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const [topViewEnabled, setTopViewEnabled] = useState(false);
    const [cameraFov, setCameraFov] = useState(60);
    const [showSimulationMenu, setShowSimulationMenu] = useState(false);
    const [activeSimulation, setActiveSimulation] = useState<'none' | 'solar' | 'wind' | 'noise'>('none');
    const [solarAnalysisData, setSolarAnalysisData] = useState<SolarAnalysisData | null>(null);
    const [enable3DTransform, setEnable3DTransform] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // Environmental Analysis States
    const [showAnalysisMenu, setShowAnalysisMenu] = useState(false);
    const [activeAnalysis, setActiveAnalysis] = useState<'none' | 'solar' | 'wind' | 'shadow' | 'comfort'>('none');
    const [pedestrianSpaces, setPedestrianSpaces] = useState<PedestrianSpace[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [legendRange, setLegendRange] = useState<{ min: number; max: number } | null>(null);

    // Extract road/path shapes for vehicles to follow
    const pathShapes = useMemo(() => (shapes || []).filter(s => s.objectType === 'path'), [shapes]);
    
    // OSM road loops around current location (real city streets)
    const [osmLoops, setOsmLoops] = useState<Array<{ x: number; z: number }[]>>([]);
    const [roadsLoading, setRoadsLoading] = useState(false);
    const [roadsLoaded, setRoadsLoaded] = useState(false);

    const origin = useMemo(() => {
        if (!location?.boundary || location.boundary.length === 0) {
            return { lat: 0, lng: 0 };
        }
        const minLat = Math.min(...location.boundary.map(p => p.lat));
        const minLng = Math.min(...location.boundary.map(p => p.lng));
        return { lat: minLat, lng: minLng };
    }, [location?.boundary]);

    const siteCenter = useMemo(() => {
        if (!location?.boundary || location.boundary.length === 0) {
            return { x: 0, y: 0 };
        }

        const R = 6371000;
        const points = location.boundary.map(p => {
            const dx = (p.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
            const dy = (p.lat - origin.lat) * (Math.PI / 180) * R;
            return { x: dx, y: -dy };
        });

        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        return { x: avgX, y: avgY };
    }, [location?.boundary, origin.lat, origin.lng]);

    const siteCenterGeo = useMemo(() => {
        if (!location?.boundary || location.boundary.length === 0) {
            return { lat: 0, lng: 0 };
        }
        const avgLat = location.boundary.reduce((sum, p) => sum + p.lat, 0) / location.boundary.length;
        const avgLng = location.boundary.reduce((sum, p) => sum + p.lng, 0) / location.boundary.length;
        return { lat: avgLat, lng: avgLng };
    }, [location?.boundary]);

    // Geographic bounds for OSM data fetching
    const geoBounds = useMemo(() => {
        if (!location?.boundary || location.boundary.length === 0) {
            return { south: 0, north: 0, west: 0, east: 0 };
        }
        const lats = location.boundary.map(p => p.lat);
        const lngs = location.boundary.map(p => p.lng);
        // Add ~800m radius expansion around the site
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const radiusMeters = 800; // requested 700-800m
        const latMargin = radiusMeters / 111320; // deg per meter (latitude)
        const lonMargin = radiusMeters / (111320 * Math.max(0.1, Math.cos(centerLat * Math.PI / 180))); // protect near poles
        return {
            south: Math.min(...lats) - latMargin,
            north: Math.max(...lats) + latMargin,
            west: Math.min(...lngs) - lonMargin,
            east: Math.max(...lngs) + lonMargin
        };
    }, [location?.boundary]);

    // Calculate scene bounds from location boundary
    const bounds = useMemo(() => {
        if (!location?.boundary || location.boundary.length === 0) {
            return { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
        }
        
        const R = 6371000;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        
        location.boundary.forEach(point => {
            const dx = (point.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
            const dy = (point.lat - origin.lat) * (Math.PI / 180) * R;
            minX = Math.min(minX, dx);
            maxX = Math.max(maxX, dx);
            minZ = Math.min(minZ, dy);
            maxZ = Math.max(maxZ, dy);
        });
        
        // Expand bounds by 20%
        const width = maxX - minX;
        const height = maxZ - minZ;
        return {
            minX: minX - width * 0.2,
            maxX: maxX + width * 0.2,
            minZ: minZ - height * 0.2,
            maxZ: maxZ + height * 0.2
        };
    }, [location?.boundary, origin]);

    // Fetch OSM roads within the current boundary bbox and convert to local coords
    useEffect(() => {
        const load = async () => {
            if (!location?.boundary || location.boundary.length === 0) { 
                setOsmLoops([]);
                setRoadsLoaded(false);
                setRoadsLoading(false);
                return; 
            }
            
            setRoadsLoading(true);
            setRoadsLoaded(false);
            
            try {
                const lats = location.boundary.map(p => p.lat);
                const lngs = location.boundary.map(p => p.lng);
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);
                
                // Expand bbox by ~200m to capture surrounding streets
                const latMargin = 0.0018; // ~200m
                const lngMargin = 0.0024; // ~200m
                
                console.log('🛣️ Fetching OSM roads...');
                const lines = await fetchOSMRoadCenterlines({ 
                    minLat: minLat - latMargin, 
                    minLng: minLng - lngMargin, 
                    maxLat: maxLat + latMargin, 
                    maxLng: maxLng + lngMargin 
                });
                
                if (!lines || lines.length === 0) {
                    console.warn('⚠️ No OSM roads found in area');
                    setOsmLoops([]);
                    setRoadsLoaded(false);
                    setRoadsLoading(false);
                    return;
                }
                
                const R = 6371000;
                const loops = lines.map(line => line.map(({ lat, lng }) => {
                    const dx = (lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                    const dy = (lat - origin.lat) * (Math.PI / 180) * R;
                    return { x: dx, z: -dy };
                })).filter(loop => loop.length >= 2); // Only keep valid road segments
                
                console.log(`✅ Loaded ${loops.length} OSM road segments (${loops.reduce((sum, l) => sum + l.length, 0)} points total)`);
                setOsmLoops(loops);
                setRoadsLoaded(true);
                setRoadsLoading(false);
            } catch (err) {
                console.error('❌ Failed to fetch OSM roads:', err);
                setOsmLoops([]);
                setRoadsLoaded(false);
                setRoadsLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [origin.lat, origin.lng, location?.boundary]);
    
    // Fetch pedestrian spaces for environmental analysis
    useEffect(() => {
        const loadPedestrianSpaces = async () => {
            if (!location?.boundary || location.boundary.length === 0 || activeAnalysis === 'none') {
                setPedestrianSpaces([]);
                return;
            }
            
            setAnalysisLoading(true);
            
            try {
                const lats = location.boundary.map(p => p.lat);
                const lngs = location.boundary.map(p => p.lng);
                const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                
                console.log('🚶 Fetching pedestrian spaces for analysis...');
                const spaces = await fetchPedestrianSpaces(centerLat, centerLng, 500); // 500m radius
                
                console.log(`✅ Loaded ${spaces.length} pedestrian spaces`);
                setPedestrianSpaces(spaces);
            } catch (err) {
                console.error('❌ Failed to fetch pedestrian spaces:', err);
                setPedestrianSpaces([]);
            } finally {
                setAnalysisLoading(false);
            }
        };
        
        loadPedestrianSpaces();
    }, [location?.boundary, activeAnalysis]);

    // Auto-play sun animation
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            setTimeOfDay(prev => {
                const next = prev + 0.1;
                return next >= 24 ? 0 : next;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isPlaying]);

    const handleDeleteBuilding = (buildingId: string) => {
        console.log('🗑️🗑️🗑️ handleDeleteBuilding called with:', buildingId);
        console.log('Current deleted set size:', deletedBuildingIds.size);
        setDeletedBuildingIds(prev => {
            const newSet = new Set([...prev, buildingId]);
            console.log('New deleted set size:', newSet.size);
            console.log('New deleted set contents:', Array.from(newSet));
            return newSet;
        });
    };

    const handleResetDeletedBuildings = () => {
        console.log('🔄 Resetting all deleted buildings');
        setDeletedBuildingIds(new Set());
    };

    const handleAddViewpoint = (viewpoint: { x: number; y: number; z: number; label: string; direction: number }) => {
        setViewpoints(prev => [...prev, viewpoint]);
    };

    const handleRemoveViewpoint = (index: number) => {
        setViewpoints(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearViewpoints = () => {
        setViewpoints([]);
        setSelectedViewpointIndex(null);
    };

    const handleUpdateViewpoint = (index: number, updatedViewpoint: { x: number; y: number; z: number; label: string; direction: number }) => {
        setViewpoints(prev => prev.map((vp, i) => i === index ? updatedViewpoint : vp));
    };

    const handleSelectViewpoint = (index: number | null) => {
        setSelectedViewpointIndex(index);
    };

    // Notify parent when scene is ready
    useEffect(() => {
        if (sceneRef && onSceneReady) {
            console.log('Scene ready, notifying parent');
            onSceneReady(sceneRef);
        }
    }, [sceneRef, onSceneReady]);

    const handleExportOBJ = async (includeAll: boolean) => {
        if (!sceneRef) {
            console.warn('Scene not ready for export');
            return;
        }

        setIsExporting(true);
        setShowExportMenu(false);

        try {
            const data = includeAll
                ? exportCompleteScene(sceneRef, { includeNormals: true, includeUVs: true })
                : exportUserContentOnly(sceneRef, { includeNormals: true, includeUVs: true });

            const filename = includeAll ? 'urbaneyes_complete_scene' : 'urbaneyes_user_design';
            downloadOBJ(data, filename);

            console.log('OBJ export completed successfully');
        } catch (error) {
            console.error('Error exporting OBJ:', error);
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    const handleExportGLTF = async (includeAll: boolean) => {
        if (!sceneRef) {
            console.warn('Scene not ready for export');
            return;
        }

        setIsExporting(true);
        setShowExportMenu(false);

        try {
            const exportScene = includeAll ? sceneRef : createUserContentScene(sceneRef);
            const gltfData = await exportToGLTF(exportScene, true); // true = binary GLB format

            const filename = includeAll ? 'urbaneyes_complete_scene' : 'urbaneyes_user_design';
            downloadGLTF(gltfData, true, filename);

            console.log('GLTF export completed successfully');
        } catch (error) {
            console.error('Error exporting GLTF:', error);
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    const createUserContentScene = (scene: THREE.Scene) => {
        const tempScene = new THREE.Scene();
        scene.traverse((child) => {
            if (child.isMesh || child.isLine || child.isLineSegments) {
                if (child.userData?.shapeId ||
                    child.userData?.objectType === 'path' ||
                    child.name?.includes('SiteBoundary')) {
                    const cloned = child.clone(true);
                    cloned.updateMatrixWorld(true);
                    tempScene.add(cloned);
                }
            }
        });
        return tempScene;
    };

    if (!location?.boundary) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-200">
                <p className="text-slate-600">No site boundary available for 3D visualization</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-gradient-to-b from-sky-100 to-white">
            <Canvas
                shadows
                camera={{
                    position: [siteCenter.x + 100, 80, siteCenter.y + 100],
                    fov: cameraFov,
                }}
                gl={{
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.2
                }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.4} />
                <hemisphereLight args={['#87CEEB', '#6b7280', 0.3]} />

                {/* Real-time sun simulation */}
                <SunSimulation
                    timeOfDay={timeOfDay}
                    latitude={siteCenterGeo.lat}
                    longitude={siteCenterGeo.lng}
                    month={selectedMonth}
                />

                <Buildings3D
                    shapes={shapes}
                    selectedShapeIds={selectedShapeIds}
                    origin={origin}
                    onSelectShape={onSelectShape}
                    onMeshesUpdate={setBuildingMeshes}
                    onSceneUpdate={setSceneRef}
                />

                {/* Visualizations removed */}


                <SiteBoundary location={location} origin={origin} />

                {show3DSurroundings && googleApiKey && (
                    <Google3DTiles
                        apiKey={googleApiKey}
                        center={siteCenterGeo}
                        origin={origin}
                        siteBoundary={location.boundary}
                        deletedBuildingIds={deletedBuildingIds}
                        onDeleteBuilding={handleDeleteBuilding}
                        selectedBuildingId={selectedBuildingId}
                        onSelectBuilding={setSelectedBuildingId}
                    />
                )}

                {/* View Corridors & Sightlines */}
                {showViewCorridors && location?.boundary && (
                    <ViewCorridors
                        siteBoundary={location.boundary}
                        origin={origin}
                        enabled={showViewCorridors}
                        viewpoints={viewpoints}
                        onAddViewpoint={handleAddViewpoint}
                        onRemoveViewpoint={handleRemoveViewpoint}
                        onUpdateViewpoint={handleUpdateViewpoint}
                        selectedViewpointIndex={selectedViewpointIndex}
                        onSelectViewpoint={handleSelectViewpoint}
                    />
                )}

                {/* Ground plane for shadows */}
                <GroundPlane />

                {/* Solar Radiation Analysis */}
                {activeSimulation === 'solar' && (
                    <SolarRadiationAnalysis
                        enabled={true}
                        shapes={shapes}
                        latitude={siteCenterGeo.lat}
                        longitude={siteCenterGeo.lng}
                        month={selectedMonth}
                        timeOfDay={timeOfDay}
                        analysisType="shadow"
                        onAnalysisComplete={setSolarAnalysisData}
                    />
                )}
                
                {/* Pedestrian-Level Environmental Analysis - FREE GRADIENT SYSTEM */}
                {console.log('[Viewer3D] activeAnalysis:', activeAnalysis, 'geoBounds:', geoBounds, 'buildingMeshes:', buildingMeshes.length)}
                {activeAnalysis !== 'none' && (() => {
                    // Convert geographic geoBounds (~800m expanded) to scene meter coordinates
                    const R = 6371000;
                    const minX = (geoBounds.west - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                    const maxX = (geoBounds.east - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180) * R;
                    const southMeters = (geoBounds.south - origin.lat) * (Math.PI / 180) * R;
                    const northMeters = (geoBounds.north - origin.lat) * (Math.PI / 180) * R;
                    // Scene uses -Y as +Z; invert to keep north up
                    const gradientSceneBounds = { minX, maxX, minZ: -southMeters, maxZ: -northMeters };

                    return (
                        <FreeEnvironmentalGradient
                            mode={activeAnalysis === 'solar' ? 'solar' : activeAnalysis === 'shadow' ? 'shadow' : activeAnalysis === 'wind' ? 'wind' : 'comfort'}
                            bounds={geoBounds}
                            sceneBounds={gradientSceneBounds}
                            date={new Date(new Date().getFullYear(), selectedMonth - 1, 15, timeOfDay)}
                            weather={{
                                temperature: 25,
                                windSpeed: 3,
                                windDirection: 270,
                                humidity: 60,
                                cloudCover: 0.2
                            }}
                            buildingMeshes={buildingMeshes}
                            onRangeUpdate={setLegendRange}
                            options={{
                                colorScheme: activeAnalysis === 'shadow' ? 'inferno' : activeAnalysis === 'wind' ? 'viridis' : activeAnalysis === 'comfort' ? 'magma' : 'plasma',
                                smoothing: 2,
                                buildingFeather: 0.8,
                                bloomIntensity: 0.3,
                                showWindVectors: activeAnalysis === 'wind',
                                // Higher resolution for larger 700–800m radius area
                                // Balanced to keep performance acceptable
                                resolution: 96
                            }}
                        />
                    );
                })()}

                {/* 3D Transform Controls for Buildings */}
                {enable3DTransform && (
                    <TransformableBuildings
                        enabled={enable3DTransform}
                        selectedShapeIds={selectedShapeIds}
                        onShapeUpdate={(shapeId, updates) => {
                            if (onShapeUpdate) {
                                onShapeUpdate(shapeId, updates);
                            }
                        }}
                    />
                )}

                {/* North indicator - Hidden for cleaner view */}
                {/* <NorthIndicator size={50} /> */}

                <OrbitControls
                    target={[siteCenter.x, 0, siteCenter.y]}
                    maxPolarAngle={topViewEnabled ? 0.1 : Math.PI / 2.1}
                    minPolarAngle={topViewEnabled ? 0 : 0}
                    minDistance={20}
                    maxDistance={500}
                    enableDamping
                    dampingFactor={0.05}
                    makeDefault
                />
            </Canvas>

            {/* Road loading indicator */}
            {show3DSurroundings && roadsLoading && (
                <div className="absolute left-1/2 -translate-x-1/2 top-20 bg-teal-600 text-white px-4 py-2 rounded-full text-xs shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading road network...
                </div>
            )}
            
            {/* Analysis loading indicator */}
            {analysisLoading && (
                <div className="absolute left-1/2 -translate-x-1/2 top-20 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-xs shadow-lg flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading pedestrian spaces...
                </div>
            )}
            
            {/* Environmental Analysis Dropdown - TOP LEFT */}
            <div className="absolute top-4 left-4 z-20">
                <div className="relative">
                    <button
                        onClick={() => setShowAnalysisMenu(!showAnalysisMenu)}
                        className={`group relative px-4 py-2.5 text-xs font-semibold rounded-full transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 shadow-lg ${
                            activeAnalysis !== 'none'
                                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white ring-2 ring-teal-400/50'
                                : 'bg-white/95 backdrop-blur-sm text-slate-700 border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                        }`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ${activeAnalysis === 'none' ? 'opacity-50' : ''}`}></div>
                        <span className="relative z-10 flex items-center gap-2">
                            <svg className={`w-4 h-4 transition-colors ${activeAnalysis !== 'none' ? 'text-white' : 'text-teal-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>
                                {activeAnalysis === 'none' ? 'Environmental Analysis' :
                                 activeAnalysis === 'solar' ? 'Solar Analysis' :
                                 activeAnalysis === 'wind' ? 'Wind Analysis' :
                                 activeAnalysis === 'shadow' ? 'Shadow Analysis' :
                                 'Comfort Analysis'}
                            </span>
                            <svg className={`w-3.5 h-3.5 transition-transform ${showAnalysisMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </span>
                    </button>

                    {showAnalysisMenu && (
                        <div className="absolute left-0 mt-2 w-56 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border-2 border-slate-200 overflow-hidden z-50">
                            <div className="p-1">
                                <button
                                    onClick={() => {
                                        setActiveAnalysis('solar');
                                        setShowAnalysisMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-amber-50 transition-colors text-sm flex items-center gap-3 ${
                                        activeAnalysis === 'solar' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-slate-700'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <div>
                                        <div className="font-medium">Solar Radiation</div>
                                        <div className="text-[10px] text-slate-500">kWh/m² per day</div>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => {
                                        setActiveAnalysis('wind');
                                        setShowAnalysisMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-cyan-50 transition-colors text-sm flex items-center gap-3 ${
                                        activeAnalysis === 'wind' ? 'bg-cyan-100 text-cyan-900 font-semibold' : 'text-slate-700'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                    <div>
                                        <div className="font-medium">Wind Comfort</div>
                                        <div className="text-[10px] text-slate-500">NEN 8100 standard</div>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => {
                                        setActiveAnalysis('shadow');
                                        setShowAnalysisMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-purple-50 transition-colors text-sm flex items-center gap-3 ${
                                        activeAnalysis === 'shadow' ? 'bg-purple-100 text-purple-900 font-semibold' : 'text-slate-700'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                    <div>
                                        <div className="font-medium">Shadow Hours</div>
                                        <div className="text-[10px] text-slate-500">Daily shadow coverage</div>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => {
                                        setActiveAnalysis('comfort');
                                        setShowAnalysisMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-emerald-50 transition-colors text-sm flex items-center gap-3 ${
                                        activeAnalysis === 'comfort' ? 'bg-emerald-100 text-emerald-900 font-semibold' : 'text-slate-700'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <div className="font-medium">Thermal Comfort</div>
                                        <div className="text-[10px] text-slate-500">Combined UTCI index</div>
                                    </div>
                                </button>
                                
                                <div className="border-t border-slate-200 mt-1 pt-1">
                                    <button
                                        onClick={() => {
                                            setActiveAnalysis('none');
                                            setShowAnalysisMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 transition-colors text-slate-600 text-sm font-medium"
                                    >
                                        None
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                

                {activeAnalysis !== 'none' && (
                    <AnalysisLegend
                        type={activeAnalysis === 'solar' ? 'solar' : activeAnalysis === 'shadow' ? 'shadow' : activeAnalysis === 'wind' ? 'wind' : 'comfort'}
                        range={legendRange}
                        colorScheme={activeAnalysis === 'shadow' ? 'inferno' : activeAnalysis === 'wind' ? 'viridis' : activeAnalysis === 'comfort' ? 'magma' : 'plasma'}
                    />
                )}
            </div>

            {/* Info Icon with Hover Tooltip for Controls */}
            <div className="absolute bottom-4 left-4 group">
                <div className="w-8 h-8 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-full flex items-center justify-center cursor-help hover:bg-slate-50 transition-all">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                
                {/* Tooltip that appears on hover */}
                <div className="absolute bottom-full left-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                        <p className="font-semibold mb-1.5">3D View Controls</p>
                        <div className="space-y-0.5">
                            <p><span className="font-medium">Left Click + Drag:</span> Orbit</p>
                            <p><span className="font-medium">Right Click + Drag:</span> Pan</p>
                            <p><span className="font-medium">Scroll:</span> Zoom</p>
                            <p><span className="font-medium">Click Building:</span> Select</p>
                            <p><span className="font-medium">Double-Click Surrounding:</span> Delete</p>
                        </div>
                        {/* Arrow pointing down */}
                        <div className="absolute top-full left-4 -mt-1">
                            <div className="w-2 h-2 bg-slate-800 transform rotate-45"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-4 right-4 flex flex-col gap-2">

                {/* Simulations Dropdown - HIDDEN FOR NOW */}
                {/* <div className="relative">
                    <button
                        onClick={() => setShowSimulationMenu(!showSimulationMenu)}
                        className={`w-full px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${
                            activeSimulation !== 'none'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white ring-2 ring-orange-400/30'
                                : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                        }`}
                    >
                        <span className="flex items-center gap-2 justify-between">
                            <span>Simulations</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </span>
                    </button>

                    {showSimulationMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-50">
                            <button
                                onClick={() => {
                                    setActiveSimulation('solar');
                                    setShowSimulationMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-700 text-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Solar Radiation
                            </button>
                            <button
                                onClick={() => {
                                    setActiveSimulation('wind');
                                    setShowSimulationMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-700 text-sm border-t border-slate-100 flex items-center gap-2"
                                disabled
                            >
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <span className="opacity-50">Wind Flow (Soon)</span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveSimulation('none');
                                    setShowSimulationMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-700 text-sm border-t border-slate-100"
                            >
                                None
                            </button>
                        </div>
                    )}
                </div> */}

                <button
                    onClick={() => setTopViewEnabled(prev => !prev)}
                    className={`group relative px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 ${
                        topViewEnabled
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-400/30'
                            : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50/30'
                    }`}
                    title="Toggle bird's eye top view - perfect for plan analysis"
                >
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ${!topViewEnabled ? 'opacity-50' : ''}`}></div>
                    <span className="relative z-10 flex items-center gap-2">
                        <svg className={`w-4 h-4 transition-all ${topViewEnabled ? 'text-white rotate-0' : 'text-purple-500 rotate-45'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {topViewEnabled ? 'Perspective View' : 'Top View'}
                    </span>
                </button>
                
                <button
                    onClick={() => setShow3DSurroundings(!show3DSurroundings)}
                    className={`group relative px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 ${
                        show3DSurroundings
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white ring-2 ring-teal-400/30'
                            : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
                    }`}
                    title="Show photorealistic 3D buildings and terrain around the site"
                >
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ${!show3DSurroundings ? 'opacity-50' : ''}`}></div>
                    <span className="relative z-10 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${show3DSurroundings ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
                        {show3DSurroundings ? '3D Surroundings: ON' : '3D Surroundings: OFF'}
                    </span>
                </button>

                {/* View Corridors Button - HIDDEN */}
                {/* <button
                    onClick={() => setShowViewCorridors(!showViewCorridors)}
                    className={`group relative px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 ${
                        showViewCorridors
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white ring-2 ring-teal-400/30'
                            : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
                    }`}
                    title="Display view corridors with 114° human vision cone. Hold Shift + Click to place viewpoints."
                >
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ${!showViewCorridors ? 'opacity-50' : ''}`}></div>
                    <span className="relative z-10 flex items-center gap-2">
                        <svg className={`w-3.5 h-3.5 transition-colors ${showViewCorridors ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {showViewCorridors ? `View Corridors: ON (${viewpoints.length})` : 'View Corridors: OFF'}
                    </span>
                </button> */}

                {/* Clear Viewpoints Button - Only visible when viewpoints exist */}
                {showViewCorridors && viewpoints.length > 0 && (
                    <button
                        onClick={handleClearViewpoints}
                        className="group relative px-3 py-2 text-xs font-semibold rounded-full transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50/30"
                        title="Clear all viewpoints"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                        <span className="relative z-10 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear Viewpoints
                        </span>
                    </button>
                )}
            </div>

            {/* View Corridors Instructions */}
            {showViewCorridors && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-teal-500/95 backdrop-blur-sm text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in border-2 border-teal-400">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            View Corridor Controls
                        </div>
                        <div className="text-xs opacity-90 flex flex-col gap-0.5">
                            <span>• Hold <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-white font-mono">Shift</kbd> + Click ground to place viewpoint</span>
                            <span>• Click on <span className="text-amber-200 font-bold">sphere</span> to select and control position</span>
                            <span>• Each viewpoint has 114° human vision cone with 120 rays</span>
                            {viewpoints.length > 0 && <span className="text-teal-100 font-semibold">• {viewpoints.length} viewpoint{viewpoints.length !== 1 ? 's' : ''} placed</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Gamified Viewpoint Position Controller */}
            {showViewCorridors && selectedViewpointIndex !== null && viewpoints[selectedViewpointIndex] && (
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-56 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-teal-300/50 animate-fade-in backdrop-blur-sm">
                    <div className="flex flex-col gap-3">
                        {/* Header with pulsing indicator */}
                        <div className="flex items-center justify-between pb-2 border-b border-white/20">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-cyan-300 rounded-full animate-ping absolute"></div>
                                <div className="w-2 h-2 bg-cyan-300 rounded-full"></div>
                                <h3 className="text-xs font-black uppercase tracking-wider">
                                    {viewpoints[selectedViewpointIndex].label}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedViewpointIndex(null)}
                                className="w-5 h-5 bg-white/10 hover:bg-red-500/80 rounded-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
                                title="Close"
                            >
                                <svg className="w-3 h-3 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Compact Coordinate Display with icons */}
                        <div className="bg-gradient-to-r from-teal-700/60 to-cyan-700/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 font-mono text-[10px] shadow-inner">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <span className="text-cyan-300 font-bold">X</span>
                                    <span className="text-white font-bold">{viewpoints[selectedViewpointIndex].x.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-emerald-300 font-bold">Y</span>
                                    <span className="text-white font-bold">{viewpoints[selectedViewpointIndex].y.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-blue-300 font-bold">Z</span>
                                    <span className="text-white font-bold">{viewpoints[selectedViewpointIndex].z.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Compact Height Control */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                                    <svg className="w-3 h-3 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                    </svg>
                                    Height
                                </label>
                                <span className="text-[10px] font-black bg-cyan-400/30 px-1.5 py-0.5 rounded shadow-md">
                                    {(viewpoints[selectedViewpointIndex].y * 3.33).toFixed(1)}m
                                </span>
                            </div>
                            <div className="relative">
                                <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    step="0.3"
                                    value={viewpoints[selectedViewpointIndex].y}
                                    onChange={(e) => {
                                        const updatedVp = { ...viewpoints[selectedViewpointIndex], y: parseFloat(e.target.value) };
                                        handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                    }}
                                    className="w-full h-2 bg-teal-800/50 rounded-full appearance-none cursor-pointer shadow-inner
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br 
                                    [&::-webkit-slider-thumb]:from-cyan-300 [&::-webkit-slider-thumb]:to-teal-400 
                                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab 
                                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/50
                                    hover:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:shadow-cyan-400/50
                                    active:[&::-webkit-slider-thumb]:cursor-grabbing active:[&::-webkit-slider-thumb]:shadow-cyan-400"
                                />
                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>
                            </div>
                            <div className="flex justify-between text-[8px] opacity-60 font-semibold">
                                <span>0m</span>
                                <span>100m</span>
                            </div>
                        </div>

                        {/* Compact Directional Controls */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                                <svg className="w-3 h-3 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                Position
                            </label>
                            <div className="flex items-center justify-center">
                                <div className="relative w-24 h-24">
                                    {/* North Button */}
                                    <button
                                        onClick={() => {
                                            const updatedVp = { ...viewpoints[selectedViewpointIndex], z: viewpoints[selectedViewpointIndex].z - 2 };
                                            handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                        }}
                                        className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-cyan-400/40 to-teal-500/40 hover:from-cyan-300/60 hover:to-teal-400/60 
                                        active:from-cyan-200 active:to-teal-300 rounded-full flex items-center justify-center 
                                        transition-all hover:scale-110 active:scale-95 shadow-lg hover:shadow-cyan-400/50 
                                        border-2 border-white/20 hover:border-cyan-300/60 group"
                                        title="North"
                                    >
                                        <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 4l8 8h-6v8h-4v-8H4z" />
                                        </svg>
                                    </button>
                                    
                                    {/* West Button */}
                                    <button
                                        onClick={() => {
                                            const updatedVp = { ...viewpoints[selectedViewpointIndex], x: viewpoints[selectedViewpointIndex].x - 2 };
                                            handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                        }}
                                        className="absolute top-1/2 left-0 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-cyan-400/40 to-teal-500/40 hover:from-cyan-300/60 hover:to-teal-400/60 
                                        active:from-cyan-200 active:to-teal-300 rounded-full flex items-center justify-center 
                                        transition-all hover:scale-110 active:scale-95 shadow-lg hover:shadow-cyan-400/50 
                                        border-2 border-white/20 hover:border-cyan-300/60 group"
                                        title="West"
                                    >
                                        <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20 12l-8-8v6H4v4h8v6z" />
                                        </svg>
                                    </button>
                                    
                                    {/* East Button */}
                                    <button
                                        onClick={() => {
                                            const updatedVp = { ...viewpoints[selectedViewpointIndex], x: viewpoints[selectedViewpointIndex].x + 2 };
                                            handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                        }}
                                        className="absolute top-1/2 right-0 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-cyan-400/40 to-teal-500/40 hover:from-cyan-300/60 hover:to-teal-400/60 
                                        active:from-cyan-200 active:to-teal-300 rounded-full flex items-center justify-center 
                                        transition-all hover:scale-110 active:scale-95 shadow-lg hover:shadow-cyan-400/50 
                                        border-2 border-white/20 hover:border-cyan-300/60 group"
                                        title="East"
                                    >
                                        <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 12l8 8v-6h8v-4h-8V4z" />
                                        </svg>
                                    </button>
                                    
                                    {/* South Button */}
                                    <button
                                        onClick={() => {
                                            const updatedVp = { ...viewpoints[selectedViewpointIndex], z: viewpoints[selectedViewpointIndex].z + 2 };
                                            handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                        }}
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-cyan-400/40 to-teal-500/40 hover:from-cyan-300/60 hover:to-teal-400/60 
                                        active:from-cyan-200 active:to-teal-300 rounded-full flex items-center justify-center 
                                        transition-all hover:scale-110 active:scale-95 shadow-lg hover:shadow-cyan-400/50 
                                        border-2 border-white/20 hover:border-cyan-300/60 group"
                                        title="South"
                                    >
                                        <svg className="w-6 h-6 group-hover:animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 20l-8-8h6V4h4v8h6z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <p className="text-[8px] opacity-60 text-center font-semibold">2m per click</p>
                        </div>

                        {/* Compact Rotation Control */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                                    <svg className="w-3 h-3 text-cyan-300 animate-spin" style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Direction
                                </label>
                                <span className="text-[10px] font-black bg-cyan-400/30 px-1.5 py-0.5 rounded shadow-md">
                                    {Math.round((viewpoints[selectedViewpointIndex].direction * 180 / Math.PI) % 360)}°
                                </span>
                            </div>
                            <div className="relative">
                                <input
                                    type="range"
                                    min="0"
                                    max={Math.PI * 2}
                                    step={Math.PI / 36}
                                    value={viewpoints[selectedViewpointIndex].direction}
                                    onChange={(e) => {
                                        const updatedVp = { ...viewpoints[selectedViewpointIndex], direction: parseFloat(e.target.value) };
                                        handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                    }}
                                    className="w-full h-2 bg-teal-800/50 rounded-full appearance-none cursor-pointer shadow-inner
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br 
                                    [&::-webkit-slider-thumb]:from-cyan-300 [&::-webkit-slider-thumb]:to-teal-400 
                                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab 
                                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/50
                                    hover:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:shadow-cyan-400/50 hover:[&::-webkit-slider-thumb]:rotate-180
                                    active:[&::-webkit-slider-thumb]:cursor-grabbing active:[&::-webkit-slider-thumb]:shadow-cyan-400"
                                />
                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>
                            </div>
                            <div className="flex justify-between text-[8px] opacity-60 font-semibold">
                                <span>N</span>
                                <span>E</span>
                                <span>S</span>
                                <span>W</span>
                                <span>N</span>
                            </div>
                        </div>

                        {/* Compact Action Buttons */}
                        <div className="flex gap-1.5 pt-2 border-t border-white/20">
                            <button
                                onClick={() => {
                                    const updatedVp = { ...viewpoints[selectedViewpointIndex], y: 0.48 }; // 0.48 * 3.33 ≈ 1.6m displayed
                                    handleUpdateViewpoint(selectedViewpointIndex, updatedVp);
                                }}
                                className="flex-1 px-2 py-1.5 bg-cyan-400/20 hover:bg-cyan-400/40 active:bg-cyan-300/50 
                                rounded-md text-[10px] font-black transition-all hover:scale-105 active:scale-95 
                                border border-cyan-300/30 hover:border-cyan-200/50 shadow-md uppercase tracking-wide"
                            >
                                ↺ Reset
                            </button>
                            <button
                                onClick={() => {
                                    handleRemoveViewpoint(selectedViewpointIndex);
                                    setSelectedViewpointIndex(null);
                                }}
                                className="flex-1 px-2 py-1.5 bg-red-500/60 hover:bg-red-500/80 active:bg-red-500 
                                rounded-md text-[10px] font-black transition-all hover:scale-105 active:scale-95 
                                border border-red-400/50 hover:border-red-300 shadow-md uppercase tracking-wide"
                            >
                                ✕ Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Solar Analysis Data Panel - HIDDEN FOR NOW */}
            {/* {activeSimulation === 'solar' && solarAnalysisData && (
                <div className="absolute top-4 left-4 z-20">
                    <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-xl w-80 border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Solar Radiation Analysis</h3>

                        <div className="mb-3">
                            <div className="h-3 rounded-sm" style={{
                                background: 'linear-gradient(to right, #9333ea 0%, #ec4899 20%, #f97316 40%, #fbbf24 60%, #fde047 80%, #fef08a 100%)'
                            }}></div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-slate-600 font-medium">Low</span>
                                <span className="text-[9px] text-slate-600 font-medium">High Exposure</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="bg-slate-50 rounded px-3 py-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-700">Shadow Coverage</span>
                                    <span className="text-sm font-bold text-slate-900">{solarAnalysisData.shadowCoverage.toFixed(1)}%</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded px-3 py-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-700">Solar Exposure</span>
                                    <span className="text-sm font-bold text-slate-900">{solarAnalysisData.solarExposure.toFixed(1)} kWh/m²</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded px-3 py-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-700">Peak Sun Hours</span>
                                    <span className="text-sm font-bold text-slate-900">{solarAnalysisData.peakSunHours.toFixed(1)} hrs</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded px-3 py-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-700">Optimal Orientation</span>
                                    <span className="text-sm font-bold text-slate-900">{solarAnalysisData.optimalOrientation}° S</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200">
                            <button
                                onClick={() => setEnable3DTransform(!enable3DTransform)}
                                className={`w-full px-3 py-1.5 text-xs font-semibold rounded transition-all hover:scale-105 active:scale-95 ${
                                    enable3DTransform
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {enable3DTransform ? '3D Transform: ON' : '3D Transform: OFF'}
                            </button>
                        </div>
                    </div>
                </div>
            )} */}

            {/* Sun Simulation Controls */}
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm border border-slate-200 px-3 py-2.5 rounded-lg min-w-64">
                <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-slate-800">Sun Position</p>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                            isPlaying
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                </div>
                
                <div className="space-y-2.5">
                    {/* Month Selection */}
                    <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Month:</label>
                        <CustomDropdown
                            value={selectedMonth}
                            onChange={(val) => setSelectedMonth(Number(val))}
                            options={[
                                { value: 1, label: 'January' },
                                { value: 2, label: 'February' },
                                { value: 3, label: 'March' },
                                { value: 4, label: 'April' },
                                { value: 5, label: 'May' },
                                { value: 6, label: 'June' },
                                { value: 7, label: 'July' },
                                { value: 8, label: 'August' },
                                { value: 9, label: 'September' },
                                { value: 10, label: 'October' },
                                { value: 11, label: 'November' },
                                { value: 12, label: 'December' }
                            ]}
                        />
                    </div>
                    
                    {/* Time of Day */}
                    <div>
                        <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
                            <span className="font-semibold">Time:</span>
                            <span className="font-mono">{Math.floor(timeOfDay)}:{String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="24"
                            step="0.1"
                            value={timeOfDay}
                            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer 
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 
                                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white 
                                [&::-webkit-slider-thumb]:shadow 
                                hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 
                                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 
                                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 
                                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                            style={{
                                background: 'linear-gradient(to right, #0f766e 0%, #14b8a6 50%, #10b981 100%)',
                                accentColor: '#10b981'
                            }}
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>Midnight</span>
                            <span>Noon</span>
                            <span>Midnight</span>
                        </div>
                        <p className="text-[9px] text-teal-600 mt-1 text-center">
                            Local time at location (UTC{siteCenterGeo.lng >= 0 ? '+' : ''}{(siteCenterGeo.lng / 15).toFixed(1)})
                        </p>
                    </div>
                    
                    {/* Location Info */}
                    <div className="pt-2 border-t border-slate-200">
                        <p className="text-[10px] text-slate-500">
                            <span className="font-semibold">Location:</span> {siteCenterGeo.lat.toFixed(4)}°, {siteCenterGeo.lng.toFixed(4)}°
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center mt-1">
                            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1"></span>
                            <span className="font-semibold">North:</span> Towards top of view (-Z axis)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
