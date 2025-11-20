import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WindVisualizationProps {
    buildings: THREE.Mesh[];
    windSpeed: number;
    windDirection: number; // degrees (0 = North, 90 = East, 180 = South, 270 = West)
    enabled: boolean;
    siteBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const WindVisualization: React.FC<WindVisualizationProps> = ({
    buildings,
    windSpeed,
    windDirection,
    enabled,
    siteBounds
}) => {
    const { scene } = useThree();
    const windArrowsRef = useRef<THREE.ArrowHelper[]>([]);
    const particlesRef = useRef<THREE.Points[]>([]);
    const animationRef = useRef<number>(0);
    const windFieldRef = useRef<{
        position: THREE.Vector3;
        velocity: THREE.Vector3;
        turbulence: number;
    }[]>([]);

    // Calculate wind direction vector from degrees
    const getWindVector = (direction: number, speed: number): THREE.Vector3 => {
        const radians = (direction - 90) * Math.PI / 180; // -90 because 0° is North in our system
        return new THREE.Vector3(
            Math.cos(radians) * speed,
            0,
            Math.sin(radians) * speed
        );
    };

    // Calculate turbulence zones around buildings
    useEffect(() => {
        if (!enabled) return;

        console.log(`Calculating wind field for ${buildings.length} buildings`);
        console.log('Site bounds:', siteBounds);
        
        const windVec = getWindVector(windDirection, windSpeed);
        
        // Calculate grid based on site bounds with extra margin
        const siteWidth = siteBounds.maxX - siteBounds.minX;
        const siteDepth = siteBounds.maxZ - siteBounds.minZ;
        const siteCenterX = (siteBounds.minX + siteBounds.maxX) / 2;
        const siteCenterZ = (siteBounds.minZ + siteBounds.maxZ) / 2;
        
        // Ensure grid covers the entire site plus margin
        const gridSize = Math.max(siteWidth, siteDepth) * 1.5; // 1.5x the site size
        const gridResolution = 6; // Denser grid for better coverage
        const field: typeof windFieldRef.current = [];

        // Get building bounding boxes - force recalculation
        const buildingBoxes = buildings.map((building, idx) => {
            building.updateMatrixWorld(true); // Force update
            const bbox = new THREE.Box3().setFromObject(building);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bbox.getCenter(center);
            bbox.getSize(size);
            console.log(`Building ${idx}: center(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}), size(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)})`);
            return { bbox, center, size };
        });

        // Also compute a bounding box that tightly wraps the proposed buildings
        const proposedBBox = new THREE.Box3();
        buildingBoxes.forEach(({ bbox }) => proposedBBox.union(bbox));
        const proposedCenter = proposedBBox.getCenter(new THREE.Vector3());
        const proposedSize = proposedBBox.getSize(new THREE.Vector3());

        // Choose center prioritizing proposed buildings; fallback to site center if empty
        const centerX = isFinite(proposedCenter.x) ? proposedCenter.x : siteCenterX;
        const centerZ = isFinite(proposedCenter.z) ? proposedCenter.z : siteCenterZ;

        // Make sure grid fully covers the proposed site with margin
        const coverSize = Math.max(gridSize, Math.max(proposedSize.x, proposedSize.z) + 60);

        console.log(`Creating wind field grid: ${coverSize.toFixed(1)}m centered at (${centerX.toFixed(1)}, ${centerZ.toFixed(1)})`);

        // Create wind field grid centered on chosen center
        for (let x = centerX - coverSize / 2; x < centerX + coverSize / 2; x += gridResolution) {
            for (let z = centerZ - coverSize / 2; z < centerZ + coverSize / 2; z += gridResolution) {
                for (let y = 2; y <= 15; y += 5) { // Multiple height layers
                    const position = new THREE.Vector3(x, y, z);
                    let velocity = windVec.clone();
                    let turbulence = 0;
                    let isInsideBuilding = false;

                    // Check each building's influence
                    buildingBoxes.forEach(({ bbox, center, size }) => {
                        // Skip if inside building
                        if (bbox.containsPoint(position)) {
                            isInsideBuilding = true;
                            return;
                        }

                        const toPoint = new THREE.Vector2(
                            position.x - center.x,
                            position.z - center.z
                        );
                        const distance = toPoint.length();
                        const buildingRadius = Math.max(size.x, size.z) / 2;

                        // Only affect points near the building
                        if (distance > buildingRadius * 5) return;

                        const windDir2D = new THREE.Vector2(windVec.x, windVec.z).normalize();
                        const toPointNorm = toPoint.clone().normalize();
                        const dotProduct = toPointNorm.dot(windDir2D);

                        // WAKE ZONE (behind building relative to wind)
                        if (dotProduct > 0.3 && distance < buildingRadius * 3.5) {
                            const wakeFactor = 1 - (distance / (buildingRadius * 3.5));
                            turbulence = Math.max(turbulence, wakeFactor * 2.5);
                            velocity.multiplyScalar(0.2 + 0.6 * (distance / (buildingRadius * 3.5)));
                            
                            // Add swirl in wake
                            const perpendicular = new THREE.Vector3(-windDir2D.y, 0, windDir2D.x);
                            const swirlAmount = Math.sin(distance) * wakeFactor * windSpeed * 0.3;
                            velocity.add(perpendicular.multiplyScalar(swirlAmount));
                        }

                        // SIDE ZONES (flow around sides)
                        const crossDot = Math.abs(toPointNorm.x * windDir2D.y - toPointNorm.y * windDir2D.x);
                        if (crossDot > 0.5 && distance < buildingRadius * 2.5) {
                            const sideFactor = 1 - (distance / (buildingRadius * 2.5));
                            
                            // Accelerate flow around sides (Venturi effect)
                            const acceleration = 1 + sideFactor * 0.8;
                            velocity.multiplyScalar(acceleration);
                            
                            // Deflect flow around building
                            const deflection = toPoint.clone().normalize().multiplyScalar(sideFactor * windSpeed * 0.4);
                            velocity.x += deflection.x;
                            velocity.z += deflection.y;
                            
                            turbulence = Math.max(turbulence, sideFactor * 1.2);
                        }

                        // FRONT ZONE (upwind side)
                        if (dotProduct < -0.3 && distance < buildingRadius * 2) {
                            const frontFactor = 1 - (distance / (buildingRadius * 2));
                            
                            // Slow down and deflect upward/sideways
                            velocity.multiplyScalar(0.4 + 0.4 * (distance / (buildingRadius * 2)));
                            velocity.y += frontFactor * windSpeed * 0.3; // Upward deflection
                            
                            // Split flow to sides
                            const sideDeflection = toPoint.clone().normalize().multiplyScalar(frontFactor * windSpeed * 0.3);
                            velocity.x += sideDeflection.x;
                            velocity.z += sideDeflection.y;
                            
                            turbulence = Math.max(turbulence, frontFactor * 1.5);
                        }
                    });

                    // Skip points inside buildings
                    if (isInsideBuilding) continue;

                    // Add some natural variation
                    const noise = (Math.sin(x * 0.1) + Math.cos(z * 0.1)) * 0.1;
                    turbulence += Math.abs(noise);

                    field.push({
                        position: position.clone(),
                        velocity: velocity.clone(),
                        turbulence: Math.min(turbulence, 3)
                    });
                }
            }
        }

        windFieldRef.current = field;
        console.log(`✓ Wind field created with ${field.length} sample points`);
    }, [buildings, windSpeed, windDirection, enabled, siteBounds]);

    // Create wind arrows
    useEffect(() => {
        // Clear existing arrows
        windArrowsRef.current.forEach(arrow => {
            scene.remove(arrow);
            arrow.dispose();
        });
        windArrowsRef.current = [];

        if (!enabled || windFieldRef.current.length === 0) return;

        console.log(`Creating wind arrows from ${windFieldRef.current.length} field points`);

        // Create arrows from wind field (sample every 2nd point for dense coverage)
        windFieldRef.current.forEach((point, index) => {
            if (index % 2 !== 0) return; // Sample 50% of points for better coverage

            const speed = point.velocity.length();
            if (speed < 0.2) return; // Don't show very slow wind

            const direction = point.velocity.clone().normalize();
            const arrowLength = Math.min(3 + speed * 0.8, 12);
            
            // Color based on speed and turbulence
            let color: THREE.Color;
            if (point.turbulence > 1.5) {
                color = new THREE.Color(0xff4444); // Bright red for high turbulence
            } else if (point.turbulence > 0.8) {
                color = new THREE.Color(0xff8833); // Orange for medium turbulence
            } else if (speed > windSpeed * 1.3) {
                color = new THREE.Color(0x44ff44); // Bright green for accelerated flow
            } else {
                color = new THREE.Color(0x4488ff); // Blue for normal flow
            }

            const arrow = new THREE.ArrowHelper(
                direction,
                point.position.clone(),
                arrowLength,
                color.getHex(),
                arrowLength * 0.3,
                arrowLength * 0.25
            );

            // Store metadata for animation
            (arrow as any).userData = {
                basePosition: point.position.clone(),
                baseDirection: direction.clone(),
                baseVelocity: point.velocity.clone(),
                turbulence: point.turbulence,
                speed: speed,
                phase: Math.random() * Math.PI * 2,
                baseLength: arrowLength
            };

            // Make arrows more visible
            if (arrow.line) {
                (arrow.line.material as THREE.LineBasicMaterial).transparent = true;
                (arrow.line.material as THREE.LineBasicMaterial).opacity = 0.8;
                (arrow.line.material as THREE.LineBasicMaterial).linewidth = 2;
            }
            if (arrow.cone) {
                (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
                (arrow.cone.material as THREE.MeshBasicMaterial).opacity = 0.9;
            }

            scene.add(arrow);
            windArrowsRef.current.push(arrow);
        });

        console.log(`✓ Created ${windArrowsRef.current.length} wind arrows (${((windArrowsRef.current.length / windFieldRef.current.length) * 100).toFixed(1)}% of field points)`);

        return () => {
            windArrowsRef.current.forEach(arrow => {
                scene.remove(arrow);
                arrow.dispose();
            });
            windArrowsRef.current = [];
        };
    }, [enabled, scene, windSpeed, windDirection, buildings]);

    // Animate wind arrows with fluid motion
    useFrame((state, delta) => {
        if (!enabled) return;

        animationRef.current += delta;

        windArrowsRef.current.forEach((arrow, index) => {
            const userData = (arrow as any).userData;
            if (!userData) return;

            const time = animationRef.current;
            const turbulence = userData.turbulence;
            const speed = userData.speed;
            const phase = userData.phase;

            // Stronger fluid wave motion
            const waveX = Math.sin(time * 3 + phase) * turbulence * 1.5;
            const waveZ = Math.cos(time * 3 + phase + Math.PI / 3) * turbulence * 1.5;
            const waveY = Math.sin(time * 4 + phase) * 0.8;

            // Continuous flow movement
            const flowSpeed = speed * 1.5;
            const flowDistance = (time * flowSpeed) % 25; // Reset after 25 units
            const flowOffset = userData.baseDirection.clone().multiplyScalar(flowDistance);
            
            const newPos = userData.basePosition.clone()
                .add(flowOffset)
                .add(new THREE.Vector3(waveX, waveY, waveZ));

            arrow.position.copy(newPos);

            // More pronounced direction oscillation for turbulent areas
            if (turbulence > 0.5) {
                const dirWaveStrength = turbulence * 0.5;
                const directionWave = new THREE.Vector3(
                    Math.sin(time * 5 + phase) * dirWaveStrength,
                    Math.sin(time * 3 + phase + 1) * dirWaveStrength * 0.5,
                    Math.cos(time * 5 + phase) * dirWaveStrength
                );
                const newDirection = userData.baseDirection.clone().add(directionWave).normalize();
                arrow.setDirection(newDirection);
            } else {
                // Subtle variation for normal flow
                const subtleWave = new THREE.Vector3(
                    Math.sin(time * 2 + phase) * 0.1,
                    0,
                    Math.cos(time * 2 + phase) * 0.1
                );
                const newDirection = userData.baseDirection.clone().add(subtleWave).normalize();
                arrow.setDirection(newDirection);
            }

            // Stronger pulsing effect
            const pulse = 0.7 + Math.sin(time * 6 + phase) * 0.3;
            if (arrow.line) {
                const baseOpacity = 0.8;
                (arrow.line.material as THREE.LineBasicMaterial).opacity = pulse * baseOpacity;
            }
            if (arrow.cone) {
                const baseOpacity = 0.9;
                (arrow.cone.material as THREE.MeshBasicMaterial).opacity = pulse * baseOpacity;
            }

            // Dynamic length scaling based on turbulence
            const lengthScale = 1 + Math.sin(time * 4 + phase) * turbulence * 0.25;
            const currentLength = userData.baseLength * lengthScale;
            arrow.setLength(
                currentLength,
                currentLength * 0.3,
                currentLength * 0.25
            );
        });
    });

    // Cleanup
    useEffect(() => {
        return () => {
            windArrowsRef.current.forEach(arrow => {
                scene.remove(arrow);
                arrow.dispose();
            });
            windArrowsRef.current = [];
            
            particlesRef.current.forEach(particles => {
                scene.remove(particles);
                if (particles.geometry) particles.geometry.dispose();
                if (particles.material) {
                    if (Array.isArray(particles.material)) {
                        particles.material.forEach(m => m.dispose());
                    } else {
                        particles.material.dispose();
                    }
                }
            });
            particlesRef.current = [];
        };
    }, [scene]);

    return null;
};

export default WindVisualization;
