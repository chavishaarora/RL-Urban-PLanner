/**
 * FREE ENVIRONMENTAL GRADIENT COMPONENT
 * React Three Fiber integration for building-aware environmental gradients
 * 100% Free & Open Source
 */
// @ts-nocheck

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
extend(THREE);
import { FreeGradientRenderer, GradientRendererOptions } from '@/services/FreeGradientRenderer';
import { fetchOSMBuildings, createSpatialGrid, GridCell } from '@/services/freeGradientSystem';

interface FreeEnvironmentalGradientProps {
    // Analysis type
    mode: 'solar' | 'shadow' | 'wind' | 'comfort';
    
    // Geographic bounds (matches OSM API format)
    bounds: {
        south: number;  // minLat
        north: number;  // maxLat
        west: number;   // minLon
        east: number;   // maxLon
    };
    
    // 3D scene bounds
    sceneBounds: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
    
    // Date/time
    date: Date;
    
    // Weather conditions
    weather: {
        temperature: number; // Celsius
        windSpeed: number; // m/s
        windDirection: number; // degrees
        humidity: number; // 0-100
        cloudCover: number; // 0-1
    };
    
    // Building meshes (for interaction)
    buildingMeshes?: THREE.Mesh[];
    
    // Rendering options
    options?: Partial<GradientRendererOptions>;

    // Optional: notify parent when value range updates for legend UI
    onRangeUpdate?: (range: { min: number; max: number }) => void;
}

export const FreeEnvironmentalGradient: React.FC<FreeEnvironmentalGradientProps> = ({
    mode,
    bounds,
    sceneBounds,
    date,
    weather,
    buildingMeshes = [],
    options = {},
    onRangeUpdate
}) => {
    console.log('[FreeGradient] Component mounted/updated with mode:', mode);
    
    const [gradientMesh, setGradientMesh] = useState<THREE.Mesh | null>(null);
    const [windVectorMesh, setWindVectorMesh] = useState<THREE.Mesh | null>(null);
    const [loading, setLoading] = useState(true);

    // Create renderer instance
    const renderer = useMemo(() => {
        const defaultOptions: GradientRendererOptions = {
            resolution: 100,
            colorScheme: mode === 'shadow' ? 'inferno' : mode === 'wind' ? 'viridis' : 'plasma',
            smoothing: 2,
            buildingFeather: 0.8,
            bloomIntensity: 0.3,
            showWindVectors: mode === 'wind'
        };

        return new FreeGradientRenderer({ ...defaultOptions, ...options });
    }, []); // Only create once

    // Update gradient when parameters change
    useEffect(() => {
        let mounted = true;

        const updateGradient = async () => {
            try {
                setLoading(true);

                // 1. Fetch OSM building data (FREE)
                console.log('[FreeGradient] Starting update, mode:', mode, 'bounds:', bounds);
                console.log('Fetching OSM buildings...');
                const buildings = await fetchOSMBuildings(bounds);
                console.log(`Loaded ${buildings.length} buildings from OpenStreetMap`);

                // 2. Create spatial grid (FREE)
                console.log('Creating spatial grid...');
                const resolution = options.resolution || 100;
                const grid = createSpatialGrid(buildings, bounds, resolution);

                // 3. Generate gradient mesh (FREE)
                console.log('Computing environmental values...');
                const mesh = await renderer.updateGradient(
                    grid,
                    mode,
                    date,
                    weather,
                    sceneBounds
                );

                if (!mounted) return;
                setGradientMesh(mesh);
                console.log('[FreeGradient] Created gradient mesh:', mesh);

                // Inform parent about min/max for legend
                const range = renderer.getLastRange?.();
                if (range && onRangeUpdate) onRangeUpdate(range);

                // 4. Create wind vectors if needed (FREE)
                if (mode === 'wind' && options.showWindVectors !== false) {
                    console.log('Generating wind vectors...');
                    const vectorMesh = renderer.createWindVectors(grid, weather, sceneBounds);
                    if (mounted) {
                        setWindVectorMesh(vectorMesh);
                        console.log('[FreeGradient] Created wind vector mesh:', vectorMesh);
                    }
                } else {
                    setWindVectorMesh(null);
                }

                setLoading(false);
                console.log('[FreeGradient] Update complete');
            } catch (error) {
                console.error('[FreeGradient] Failed to generate gradient:', error);
                setLoading(false);
            }
        };

        updateGradient();

        return () => {
            mounted = false;
        };
    }, [mode, date, weather, bounds, sceneBounds, options.resolution, options.showWindVectors, renderer]);

    // Update renderer options in real-time
    useEffect(() => {
        if (options) {
            renderer.updateOptions(options);
        }
    }, [options, renderer]);

    // Animate (for bloom and wind vectors)
    useFrame(({ clock }) => {
        renderer.animate(clock.getElapsedTime());
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            renderer.dispose();
        };
    }, [renderer]);

    return (
        <>
            {console.log('[FreeGradient] Rendering - gradientMesh:', gradientMesh, 'windVectorMesh:', windVectorMesh, 'loading:', loading)}
            
            {/* Render gradient mesh */}
            {gradientMesh && (
                <mesh
                    geometry={gradientMesh.geometry}
                    material={gradientMesh.material}
                    position={gradientMesh.position}
                    rotation={gradientMesh.rotation}
                />
            )}
            
            {/* Render wind vector mesh */}
            {windVectorMesh && (
                <mesh
                    geometry={windVectorMesh.geometry}
                    material={windVectorMesh.material}
                    position={windVectorMesh.position}
                    rotation={windVectorMesh.rotation}
                />
            )}
            
            {loading && (
                <Html center>
                    <div style={{ 
                        background: 'rgba(255,255,255,0.95)', 
                        padding: '16px 24px', 
                        borderRadius: '24px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        minWidth: '280px'
                    }}>
                        <div style={{ 
                            fontSize: '13px', 
                            fontWeight: '500', 
                            color: '#64748b',
                            marginBottom: '8px',
                            textAlign: 'center'
                        }}>
                            Loading environmental data...
                        </div>
                        <div style={{
                            width: '100%',
                            height: '6px',
                            background: '#e2e8f0',
                            borderRadius: '12px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(90deg, #14b8a6, #06b6d4)',
                                borderRadius: '12px',
                                animation: 'slideProgress 1.5s ease-in-out infinite'
                            }} />
                        </div>
                        <style>{`
                            @keyframes slideProgress {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(100%); }
                            }
                        `}</style>
                    </div>
                </Html>
            )}
        </>
    );
};

export default FreeEnvironmentalGradient;
