import React, { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SunCalc from 'suncalc';

interface SolarHeatmapProps {
    buildings: THREE.Mesh[];
    latitude: number;
    longitude: number;
    month: number;
    enabled: boolean;
}

export const SolarHeatmap: React.FC<SolarHeatmapProps> = ({
    buildings,
    latitude,
    longitude,
    month,
    enabled
}) => {
    const { scene } = useThree();
    const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map());
    const heatmapMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
    const animationRef = useRef<number>(0);

    // Calculate solar exposure for each building
    const solarExposureData = useMemo(() => {
        if (!enabled) return new Map();

        const exposureMap = new Map<string, number>();
        const date = new Date(2025, month - 1, 15); // Mid-month

        buildings.forEach(building => {
            let totalRadiation = 0;
            let sunlitHours = 0;

            // Sample 24 hours
            for (let hour = 0; hour < 24; hour++) {
                const testDate = new Date(date);
                testDate.setHours(hour);
                
                const sunPos = SunCalc.getPosition(testDate, latitude, longitude);
                
                // Only count daylight hours (sun above horizon)
                if (sunPos.altitude > 0) {
                    // Simple radiation model: intensity based on sun altitude
                    const radiationIntensity = 1000 * Math.sin(sunPos.altitude); // W/m²
                    
                    // Check if building faces the sun (simplified - checks if top surface is exposed)
                    const isSunlit = true; // In reality, would use raycasting
                    
                    if (isSunlit) {
                        totalRadiation += radiationIntensity;
                        sunlitHours++;
                    }
                }
            }

            // Normalize to 0-1 range (0 = no sun, 1 = full sun)
            const avgRadiation = sunlitHours > 0 ? totalRadiation / sunlitHours : 0;
            const normalized = Math.min(avgRadiation / 1000, 1);
            
            exposureMap.set(building.uuid, normalized);
        });

        return exposureMap;
    }, [buildings, latitude, longitude, month, enabled]);

    // Create heatmap color from exposure value (0-1)
    const getHeatmapColor = (exposure: number): THREE.Color => {
        // Blue (cold/no sun) -> Green -> Yellow -> Orange -> Red (hot/full sun)
        if (exposure < 0.25) {
            // Blue to Cyan
            return new THREE.Color().setHSL(0.6 - exposure * 0.4, 1, 0.5);
        } else if (exposure < 0.5) {
            // Cyan to Green
            return new THREE.Color().setHSL(0.4 - (exposure - 0.25) * 0.8, 1, 0.5);
        } else if (exposure < 0.75) {
            // Green to Yellow
            return new THREE.Color().setHSL(0.25 - (exposure - 0.5) * 0.5, 1, 0.5);
        } else {
            // Yellow to Red
            return new THREE.Color().setHSL(0.1 - (exposure - 0.75) * 0.4, 1, 0.5);
        }
    };

    // Apply or remove heatmap
    useEffect(() => {
        if (!enabled) {
            // Restore original materials
            buildings.forEach(building => {
                const originalMaterial = originalMaterialsRef.current.get(building.uuid);
                if (originalMaterial) {
                    building.material = originalMaterial;
                }
            });
            heatmapMaterialsRef.current.clear();
            return;
        }

        // Store original materials and apply heatmap
        buildings.forEach(building => {
            // Store original material if not already stored
            if (!originalMaterialsRef.current.has(building.uuid)) {
                originalMaterialsRef.current.set(building.uuid, building.material as THREE.Material);
            }

            const exposure = solarExposureData.get(building.uuid) || 0;
            const color = getHeatmapColor(exposure);

            // Create heatmap material
            const heatmapMaterial = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.3 + exposure * 0.3,
                metalness: 0.2,
                roughness: 0.7,
                transparent: true,
                opacity: 0.9
            });

            building.material = heatmapMaterial;
            heatmapMaterialsRef.current.set(building.uuid, heatmapMaterial);
        });

    }, [buildings, enabled, solarExposureData]);

    // Animate pulsing effect
    useFrame((state) => {
        if (!enabled) return;

        animationRef.current += 0.02;
        const pulse = Math.sin(animationRef.current) * 0.1 + 0.9;

        heatmapMaterialsRef.current.forEach((material, uuid) => {
            const exposure = solarExposureData.get(uuid) || 0;
            material.emissiveIntensity = (0.3 + exposure * 0.3) * pulse;
        });
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Restore all original materials
            buildings.forEach(building => {
                const originalMaterial = originalMaterialsRef.current.get(building.uuid);
                if (originalMaterial) {
                    building.material = originalMaterial;
                }
            });
            
            // Dispose heatmap materials
            heatmapMaterialsRef.current.forEach(material => material.dispose());
            heatmapMaterialsRef.current.clear();
        };
    }, [buildings]);

    return null; // This component doesn't render anything, it just modifies materials
};

export default SolarHeatmap;
