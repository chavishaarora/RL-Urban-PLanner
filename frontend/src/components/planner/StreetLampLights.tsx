// Street Lamp Lighting System for UrbanEyes
// Adds point lights to lamp objects for night-time illumination
import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanShape } from '../../types';

interface StreetLampLightsProps {
    shapes: PlanShape[];
    timeOfDay: number; // Hour of day (0-24)
}

export const StreetLampLights: React.FC<StreetLampLightsProps> = ({
    shapes,
    timeOfDay,
}) => {
    const { scene } = useThree();
    const lightsRef = useRef<Map<string, THREE.PointLight>>(new Map());

    useEffect(() => {
        // Determine if it's night time
        const isNightTime = timeOfDay < 6 || timeOfDay > 18;

        // Get all lamp shapes
        const lampShapes = shapes.filter(
            (s) => s.objectType === 'lamp' && s.visible !== false
        );

        // Remove lights for lamps that no longer exist
        const currentLampIds = new Set(lampShapes.map((s) => s.id));
        lightsRef.current.forEach((light, shapeId) => {
            if (!currentLampIds.has(shapeId)) {
                scene.remove(light);
                lightsRef.current.delete(shapeId);
            }
        });

        // Add or update lights for each lamp
        lampShapes.forEach((lampShape) => {
            const lampId = lampShape.id;
            let light = lightsRef.current.get(lampId);

            // Create light if it doesn't exist
            if (!light) {
                light = new THREE.PointLight(
                    0xffebb3, // Warm white color
                    isNightTime ? 2.5 : 0, // Intensity
                    30, // Distance
                    1.5 // Decay
                );
                light.castShadow = true;
                light.shadow.bias = -0.001;
                light.shadow.mapSize.width = 512;
                light.shadow.mapSize.height = 512;

                scene.add(light);
                lightsRef.current.set(lampId, light);
            }

            // Update light intensity based on time of day
            light.intensity = isNightTime ? 2.5 : 0;

            // Position the light at the lamp's center
            if (lampShape.points && lampShape.points.length > 0) {
                // Calculate center of lamp shape
                let centerX = 0;
                let centerY = 0;
                lampShape.points.forEach((p) => {
                    centerX += p.x;
                    centerY += p.y;
                });
                centerX /= lampShape.points.length;
                centerY /= lampShape.points.length;

                // Position light (remember: Y is up, and we flip Y coordinate)
                light.position.set(centerX, 3, -centerY); // 3 meters up
            }
        });

        // Cleanup on unmount
        return () => {
            lightsRef.current.forEach((light) => {
                scene.remove(light);
            });
            lightsRef.current.clear();
        };
    }, [shapes, timeOfDay, scene]);

    // Component returns null as lights are added directly to scene
    return null;
};
