import React, { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ThermalVisualizationProps {
    buildings: THREE.Mesh[];
    ambientTemperature: number;
    solarRadiation: number;
    windSpeed: number;
    windDirection: THREE.Vector3;
    enabled: boolean;
}

export const ThermalVisualization: React.FC<ThermalVisualizationProps> = ({
    buildings,
    ambientTemperature,
    solarRadiation,
    windSpeed,
    windDirection,
    enabled
}) => {
    const { scene } = useThree();
    const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map());
    const thermalMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
    const heatVectorsRef = useRef<THREE.ArrowHelper[]>([]);
    const animationRef = useRef<number>(0);

    // Calculate thermal properties for each building
    const thermalData = useMemo(() => {
        if (!enabled) return new Map();

        const dataMap = new Map<string, { temperature: number; heatFlow: number }>();
        
        // Material properties
        const absorptivity = 0.7;
        const emissivity = 0.9;
        const convectionCoeff = 5 + 3.8 * windSpeed;

        buildings.forEach(building => {
            // Calculate surface temperature
            // T_surface = T_ambient + (α * Q_solar - ε * σ * T^4) / h_conv
            const solarHeat = absorptivity * solarRadiation;
            const radiativeCooling = emissivity * 5.67e-8 * Math.pow(ambientTemperature + 273.15, 4);
            
            // Simplified surface temperature
            const surfaceTemp = ambientTemperature + (solarHeat / convectionCoeff);
            
            // Calculate heat flow (W/m²)
            const heatFlow = convectionCoeff * (surfaceTemp - ambientTemperature);
            
            dataMap.set(building.uuid, {
                temperature: surfaceTemp,
                heatFlow: Math.max(0, heatFlow)
            });
        });

        return dataMap;
    }, [buildings, ambientTemperature, solarRadiation, windSpeed, enabled]);

    // Get thermal color based on temperature
    const getThermalColor = (temperature: number): THREE.Color => {
        // Temperature range: 15°C (blue) to 45°C (red)
        const minTemp = 15;
        const maxTemp = 45;
        const normalized = Math.max(0, Math.min(1, (temperature - minTemp) / (maxTemp - minTemp)));
        
        if (normalized < 0.2) {
            // Blue to Cyan (cold)
            return new THREE.Color().setHSL(0.6, 1, 0.4 + normalized * 1.5);
        } else if (normalized < 0.4) {
            // Cyan to Green
            return new THREE.Color().setHSL(0.45, 0.9, 0.5);
        } else if (normalized < 0.6) {
            // Green to Yellow
            return new THREE.Color().setHSL(0.15, 1, 0.5);
        } else if (normalized < 0.8) {
            // Yellow to Orange
            return new THREE.Color().setHSL(0.08, 1, 0.5);
        } else {
            // Orange to Red (hot)
            return new THREE.Color().setHSL(0.0, 1, 0.4 + normalized * 0.2);
        }
    };

    // Apply thermal materials
    useEffect(() => {
        if (!enabled) {
            // Restore original materials
            buildings.forEach(building => {
                const originalMaterial = originalMaterialsRef.current.get(building.uuid);
                if (originalMaterial) {
                    building.material = originalMaterial;
                }
            });
            thermalMaterialsRef.current.clear();
            return;
        }

        buildings.forEach(building => {
            if (!originalMaterialsRef.current.has(building.uuid)) {
                originalMaterialsRef.current.set(building.uuid, building.material as THREE.Material);
            }

            const data = thermalData.get(building.uuid);
            if (!data) return;

            const color = getThermalColor(data.temperature);
            const intensity = Math.min(data.heatFlow / 500, 1);

            const thermalMaterial = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.2 + intensity * 0.4,
                metalness: 0.1,
                roughness: 0.8,
                transparent: true,
                opacity: 0.9
            });

            building.material = thermalMaterial;
            thermalMaterialsRef.current.set(building.uuid, thermalMaterial);
        });
    }, [buildings, enabled, thermalData]);

    // Create heat flow vectors
    useEffect(() => {
        // Clear existing vectors
        heatVectorsRef.current.forEach(arrow => {
            scene.remove(arrow);
            arrow.dispose();
        });
        heatVectorsRef.current = [];

        if (!enabled) return;

        const normalizedWindDir = windDirection.clone().normalize();

        buildings.forEach(building => {
            const data = thermalData.get(building.uuid);
            if (!data || data.heatFlow < 10) return;

            // Get building position and bounds
            const bbox = new THREE.Box3().setFromObject(building);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const size = new THREE.Vector3();
            bbox.getSize(size);

            // Create multiple vectors around the building
            const numVectors = 8;
            const radius = Math.max(size.x, size.z) * 0.6;

            for (let i = 0; i < numVectors; i++) {
                const angle = (i / numVectors) * Math.PI * 2;
                const startPos = new THREE.Vector3(
                    center.x + Math.cos(angle) * radius,
                    center.y + size.y * 0.3,
                    center.z + Math.sin(angle) * radius
                );

                // Heat rises upward + wind direction
                const heatRiseDir = new THREE.Vector3(0, 1, 0);
                const combinedDir = normalizedWindDir.clone()
                    .multiplyScalar(windSpeed * 0.3)
                    .add(heatRiseDir.multiplyScalar(data.heatFlow / 200))
                    .normalize();

                const arrowLength = 3 + (data.heatFlow / 100);
                const arrowColor = getThermalColor(data.temperature);

                const arrow = new THREE.ArrowHelper(
                    combinedDir,
                    startPos,
                    arrowLength,
                    arrowColor.getHex(),
                    arrowLength * 0.2,
                    arrowLength * 0.15
                );

                // Store angle for animation
                (arrow as any).userData = {
                    angle,
                    baseRadius: radius,
                    centerX: center.x,
                    centerZ: center.z,
                    baseY: center.y + size.y * 0.3,
                    direction: combinedDir,
                    intensity: data.heatFlow
                };

                scene.add(arrow);
                heatVectorsRef.current.push(arrow);
            }
        });

        return () => {
            heatVectorsRef.current.forEach(arrow => {
                scene.remove(arrow);
                arrow.dispose();
            });
            heatVectorsRef.current = [];
        };
    }, [buildings, enabled, thermalData, scene, windDirection, windSpeed]);

    // Animate vectors
    useFrame((state) => {
        if (!enabled) return;

        animationRef.current += 0.01;

        heatVectorsRef.current.forEach(arrow => {
            const userData = (arrow as any).userData;
            if (!userData) return;

            // Animate position in a circular rising pattern
            const animAngle = userData.angle + animationRef.current;
            const wave = Math.sin(animationRef.current * 2 + userData.angle) * 0.5;
            const radius = userData.baseRadius + wave;

            const newPos = new THREE.Vector3(
                userData.centerX + Math.cos(animAngle) * radius,
                userData.baseY + Math.sin(animationRef.current * 3) * 2 + animationRef.current * 2,
                userData.centerZ + Math.sin(animAngle) * radius
            );

            arrow.position.copy(newPos);

            // Reset position when too high
            if (arrow.position.y > userData.baseY + 15) {
                arrow.position.y = userData.baseY;
            }

            // Pulse opacity
            const pulse = 0.5 + Math.sin(animationRef.current * 4 + userData.angle) * 0.5;
            if (arrow.line) {
                (arrow.line.material as THREE.LineBasicMaterial).opacity = pulse * 0.7;
                (arrow.line.material as THREE.LineBasicMaterial).transparent = true;
            }
            if (arrow.cone) {
                (arrow.cone.material as THREE.MeshBasicMaterial).opacity = pulse * 0.8;
                (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
            }
        });

        // Animate thermal materials
        thermalMaterialsRef.current.forEach((material, uuid) => {
            const data = thermalData.get(uuid);
            if (!data) return;

            const pulse = Math.sin(animationRef.current * 2) * 0.1 + 0.9;
            const intensity = Math.min(data.heatFlow / 500, 1);
            material.emissiveIntensity = (0.2 + intensity * 0.4) * pulse;
        });
    });

    // Cleanup
    useEffect(() => {
        return () => {
            buildings.forEach(building => {
                const originalMaterial = originalMaterialsRef.current.get(building.uuid);
                if (originalMaterial) {
                    building.material = originalMaterial;
                }
            });
            
            thermalMaterialsRef.current.forEach(material => material.dispose());
            thermalMaterialsRef.current.clear();
            
            heatVectorsRef.current.forEach(arrow => {
                scene.remove(arrow);
                arrow.dispose();
            });
            heatVectorsRef.current = [];
        };
    }, [buildings, scene]);

    return null;
};

export default ThermalVisualization;
