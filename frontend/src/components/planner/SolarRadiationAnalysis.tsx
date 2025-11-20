// Solar Radiation Analysis for UrbanEyes
// Calculates and visualizes solar exposure directly on building surfaces
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanShape } from '../../types';

interface SolarRadiationAnalysisProps {
    enabled: boolean;
    shapes: PlanShape[];
    latitude: number;
    longitude: number;
    month: number;
    timeOfDay: number;
    analysisType: 'shadow' | 'cumulative' | 'hourly';
    onAnalysisComplete?: (data: SolarAnalysisData) => void;
}

export interface SolarAnalysisData {
    shadowCoverage: number; // Percentage of building surfaces in shadow
    solarExposure: number; // Average solar exposure (kWh/m²)
    peakSunHours: number;
    optimalOrientation: number; // Degrees from north
}

export const SolarRadiationAnalysis: React.FC<SolarRadiationAnalysisProps> = ({
    enabled,
    shapes,
    latitude,
    longitude,
    month,
    timeOfDay,
    analysisType,
    onAnalysisComplete,
}) => {
    const { scene } = useThree();
    const [buildingSolarData, setBuildingSolarData] = useState<Map<string, Float32Array>>(new Map());
    const coloredMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

    // Calculate sun position based on time and location
    const sunPosition = useMemo(() => {
        // Solar calculation (simplified)
        const dayOfYear = month * 30; // Approximate
        const solarDeclination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180));

        const hourAngle = (timeOfDay - 12) * 15; // Degrees
        const latRad = latitude * (Math.PI / 180);
        const declRad = solarDeclination * (Math.PI / 180);
        const hourRad = hourAngle * (Math.PI / 180);

        // Solar elevation angle
        const sinElevation = Math.sin(latRad) * Math.sin(declRad) +
                            Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad);
        const elevation = Math.asin(sinElevation);

        // Solar azimuth angle
        const cosAzimuth = (Math.sin(declRad) - Math.sin(latRad) * sinElevation) /
                          (Math.cos(latRad) * Math.cos(elevation));
        let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));

        if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;

        // Convert to 3D position
        const distance = 500; // Distance from origin
        const x = distance * Math.cos(elevation) * Math.sin(azimuth);
        const y = distance * Math.sin(elevation);
        const z = -distance * Math.cos(elevation) * Math.cos(azimuth);

        return new THREE.Vector3(x, y, z);
    }, [latitude, longitude, month, timeOfDay]);

    // Calculate solar radiation on building surfaces
    useEffect(() => {
        if (!enabled) {
            // Clear colored meshes when disabled
            coloredMeshesRef.current.forEach((mesh) => {
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                    mesh.material.vertexColors = false;
                    mesh.material.needsUpdate = true;
                }
            });
            coloredMeshesRef.current.clear();
            return;
        }

        const raycaster = new THREE.Raycaster();
        const sunDirection = sunPosition.clone().normalize().negate();
        const solarDataMap = new Map<string, Float32Array>();

        // Get all building meshes (user buildings only, not surrounding)
        const userBuildings: THREE.Mesh[] = [];
        const allObstacles: THREE.Mesh[] = []; // All objects that can cast shadows

        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // User buildings (from shapes)
                if (child.userData?.shapeId) {
                    userBuildings.push(child);
                    allObstacles.push(child);
                }
                // Surrounding buildings, trees, etc. (obstacles only)
                else if (child.userData?.objectType || child.name?.includes('tile') || child.name?.includes('building')) {
                    allObstacles.push(child);
                }
            }
        });

        // Analyze each user building
        userBuildings.forEach((buildingMesh) => {
            const geometry = buildingMesh.geometry;
            if (!geometry || !geometry.isBufferGeometry) return;

            const position = geometry.getAttribute('position');
            const normal = geometry.getAttribute('normal');
            if (!position || !normal) return;

            const vertexCount = position.count;
            const exposureData = new Float32Array(vertexCount);

            // Get world matrix for transformations
            buildingMesh.updateMatrixWorld(true);
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(buildingMesh.matrixWorld);

            // Analyze each vertex
            for (let i = 0; i < vertexCount; i++) {
                // Get vertex position in world space
                const vertex = new THREE.Vector3(
                    position.getX(i),
                    position.getY(i),
                    position.getZ(i)
                );
                vertex.applyMatrix4(buildingMesh.matrixWorld);

                // Get vertex normal in world space
                const vertexNormal = new THREE.Vector3(
                    normal.getX(i),
                    normal.getY(i),
                    normal.getZ(i)
                );
                vertexNormal.applyMatrix3(normalMatrix).normalize();

                // Calculate angle between surface normal and sun direction
                const sunAngle = vertexNormal.dot(sunDirection.clone().negate());

                // If surface faces away from sun, no direct radiation
                if (sunAngle <= 0) {
                    exposureData[i] = 0;
                    continue;
                }

                // Cast ray from vertex towards sun to check for obstacles
                const rayOrigin = vertex.clone().add(vertexNormal.clone().multiplyScalar(0.01)); // Small offset to avoid self-intersection
                raycaster.set(rayOrigin, sunDirection.clone().negate());

                // Check if ray hits any obstacles
                const intersects = raycaster.intersectObjects(
                    allObstacles.filter(obj => obj !== buildingMesh),
                    false
                );

                // If blocked by obstacle, reduce exposure
                if (intersects.length > 0 && intersects[0].distance < 1000) {
                    exposureData[i] = sunAngle * 0.1; // 10% ambient radiation in shadow
                } else {
                    // Direct sun exposure
                    exposureData[i] = sunAngle; // Value between 0 and 1
                }
            }

            solarDataMap.set(buildingMesh.userData.shapeId, exposureData);
        });

        setBuildingSolarData(solarDataMap);
    }, [enabled, sunPosition, scene]);

    // Apply solar radiation colors to building surfaces
    useEffect(() => {
        if (!enabled || buildingSolarData.size === 0) return;

        // Helper function to convert exposure value to color
        const getColorFromExposure = (exposure: number): THREE.Color => {
            // Clamp exposure between 0 and 1
            const e = Math.max(0, Math.min(1, exposure));

            let r, g, b;

            if (e < 0.2) {
                // Purple (low exposure)
                const t = e / 0.2;
                r = 0.58 + t * (0.93 - 0.58);
                g = 0.20 + t * (0.26 - 0.20);
                b = 0.92 + t * (0.60 - 0.92);
            } else if (e < 0.4) {
                // Magenta (medium-low)
                const t = (e - 0.2) / 0.2;
                r = 0.93 + t * (0.95 - 0.93);
                g = 0.26 + t * (0.45 - 0.26);
                b = 0.60 + t * (0.15 - 0.60);
            } else if (e < 0.6) {
                // Orange (medium)
                const t = (e - 0.4) / 0.2;
                r = 0.95 + t * (0.98 - 0.95);
                g = 0.45 + t * (0.75 - 0.45);
                b = 0.15 + t * (0.09 - 0.15);
            } else if (e < 0.8) {
                // Yellow (medium-high)
                const t = (e - 0.6) / 0.2;
                r = 0.98 + t * (0.99 - 0.98);
                g = 0.75 + t * (0.88 - 0.75);
                b = 0.09 + t * (0.29 - 0.09);
            } else {
                // Light Yellow (high exposure)
                const t = (e - 0.8) / 0.2;
                r = 0.99 + t * (1.00 - 0.99);
                g = 0.88 + t * (0.94 - 0.88);
                b = 0.29 + t * (0.54 - 0.29);
            }

            return new THREE.Color(r, g, b);
        };

        // Apply colors to each building mesh
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData?.shapeId) {
                const exposureData = buildingSolarData.get(child.userData.shapeId);
                if (!exposureData) return;

                const geometry = child.geometry;
                if (!geometry || !geometry.isBufferGeometry) return;

                const position = geometry.getAttribute('position');
                if (!position) return;

                const vertexCount = position.count;
                const colors = new Float32Array(vertexCount * 3);

                // Set color for each vertex based on exposure
                for (let i = 0; i < vertexCount; i++) {
                    const exposure = exposureData[i];
                    const color = getColorFromExposure(exposure);

                    colors[i * 3] = color.r;
                    colors[i * 3 + 1] = color.g;
                    colors[i * 3 + 2] = color.b;
                }

                // Apply vertex colors to geometry
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                // Enable vertex colors on material
                if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.vertexColors = true;
                    child.material.needsUpdate = true;
                }

                coloredMeshesRef.current.set(child.userData.shapeId, child);
            }
        });
    }, [buildingSolarData, enabled, scene]);

    // Update analysis data based on building surface exposure
    useEffect(() => {
        if (!enabled || buildingSolarData.size === 0 || !onAnalysisComplete) return;

        let totalExposure = 0;
        let totalVertices = 0;
        let shadowedVertices = 0;

        buildingSolarData.forEach((exposureData) => {
            for (let i = 0; i < exposureData.length; i++) {
                totalExposure += exposureData[i];
                totalVertices++;
                if (exposureData[i] < 0.3) {
                    shadowedVertices++;
                }
            }
        });

        const avgExposure = totalVertices > 0 ? totalExposure / totalVertices : 0;
        const shadowCoverage = totalVertices > 0 ? (shadowedVertices / totalVertices) * 100 : 0;

        // Solar exposure in kWh/m² (simplified calculation)
        const solarExposure = avgExposure * 5.5; // Average daily solar radiation
        const peakSunHours = avgExposure * 8; // Peak sun hours

        onAnalysisComplete({
            shadowCoverage,
            solarExposure,
            peakSunHours,
            optimalOrientation: 180, // South-facing (can be calculated from data)
        });
    }, [buildingSolarData, enabled, onAnalysisComplete]);

    // Component returns null as visualization is applied directly to building materials
    return null;
};
