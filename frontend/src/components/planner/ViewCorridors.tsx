import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ViewCorridorsProps {
    siteBoundary: Array<{ lat: number; lng: number }>;
    origin: { lat: number; lng: number };
    enabled: boolean;
    viewpoints: Array<{ x: number; y: number; z: number; label: string; direction: number }>;
    onAddViewpoint?: (viewpoint: { x: number; y: number; z: number; label: string; direction: number }) => void;
    onRemoveViewpoint?: (index: number) => void;
    onUpdateViewpoint?: (index: number, viewpoint: { x: number; y: number; z: number; label: string; direction: number }) => void;
    selectedViewpointIndex?: number | null;
    onSelectViewpoint?: (index: number | null) => void;
}

export const ViewCorridors: React.FC<ViewCorridorsProps> = ({
    siteBoundary,
    origin,
    enabled,
    viewpoints,
    onAddViewpoint,
    onRemoveViewpoint,
    onUpdateViewpoint,
    selectedViewpointIndex,
    onSelectViewpoint
}) => {
    const { scene, camera, gl } = useThree();
    const groupRef = useRef<THREE.Group>(new THREE.Group());
    const raycasterRef = useRef(new THREE.Raycaster());
    const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

    // Click handler to place viewpoints OR select existing ones
    useEffect(() => {
        if (!enabled) return;

        const handleClick = (event: MouseEvent) => {
            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);

            // First, check if clicking on an existing viewpoint sphere
            if (groupRef.current) {
                const viewpointMarkers = groupRef.current.children.filter(
                    (child) => child.userData.isViewpoint === true
                );
                const intersects = raycasterRef.current.intersectObjects(viewpointMarkers);
                
                if (intersects.length > 0) {
                    const clickedMarker = intersects[0].object;
                    const vpIndex = clickedMarker.userData.index;
                    console.log('[ViewCorridors] Selected viewpoint:', vpIndex);
                    onSelectViewpoint?.(vpIndex);
                    return;
                }
            }

            // If Shift key is pressed and didn't click a viewpoint, place new one
            if (event.shiftKey && onAddViewpoint) {
                const target = new THREE.Vector3();
                raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, target);

                if (target) {
                    const newViewpoint = {
                        x: target.x,
                        y: 0.48, // Eye level in scaled coordinates (displays as ~1.6m)
                        z: target.z,
                        label: `VP${viewpoints.length + 1}`,
                        direction: 0 // Facing north by default
                    };
                    
                    console.log('[ViewCorridors] Placing viewpoint at eye level:', newViewpoint);
                    onAddViewpoint(newViewpoint);
                }
            } else {
                // Clicked empty space, deselect
                onSelectViewpoint?.(null);
            }
        };

        gl.domElement.addEventListener('click', handleClick);
        return () => gl.domElement.removeEventListener('click', handleClick);
    }, [enabled, gl, camera, onAddViewpoint, onSelectViewpoint, viewpoints.length]);

    // Render view corridors
    useEffect(() => {
        if (!groupRef.current || !enabled) {
            groupRef.current?.clear();
            return;
        }

        if (!origin || !scene) {
            console.log('[ViewCorridors] Missing origin or scene');
            return;
        }

        groupRef.current.clear();

        if (viewpoints.length === 0) {
            console.log('[ViewCorridors] No viewpoints to display');
            return;
        }

        console.log('[ViewCorridors] Creating view corridors for', viewpoints.length, 'viewpoints');

        // Human field of vision: ~114° horizontal
        const visionConeAngle = 114; // degrees
        const visionConeRad = (visionConeAngle * Math.PI) / 180;

        // Create rays for each viewpoint
        viewpoints.forEach((viewpoint, vpIndex) => {
            console.log(`[ViewCorridors] Rendering viewpoint ${vpIndex + 1}:`, viewpoint);
            
            const isSelected = selectedViewpointIndex === vpIndex;
            
            // Create marker sphere at viewpoint (larger and more visible)
            const markerGeo = new THREE.SphereGeometry(2.5, 32, 32);
            const markerMat = new THREE.MeshStandardMaterial({
                color: isSelected ? 0x06b6d4 : 0x14b8a6, // Cyan-500 when selected, Teal-500 otherwise
                emissive: isSelected ? 0x0891b2 : 0x0d9488, // Brighter cyan when selected
                emissiveIntensity: isSelected ? 1.5 : 0.8,
                metalness: 0.3,
                roughness: 0.4
            });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(viewpoint.x, viewpoint.y, viewpoint.z);
            marker.userData = { isViewpoint: true, index: vpIndex };
            marker.castShadow = true;
            groupRef.current?.add(marker);

            // Add selection ring if selected (animated)
            if (isSelected) {
                const ringGeo = new THREE.TorusGeometry(3.8, 0.4, 16, 32);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0x22d3ee, // Cyan-400
                    transparent: true,
                    opacity: 0.8
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.position.set(viewpoint.x, viewpoint.y, viewpoint.z);
                ring.rotation.x = Math.PI / 2;
                groupRef.current?.add(ring);

                // Animated pulse ring (outer)
                const pulseRingGeo = new THREE.TorusGeometry(5, 0.3, 16, 32);
                const pulseRingMat = new THREE.MeshBasicMaterial({
                    color: 0x67e8f9, // Cyan-300
                    transparent: true,
                    opacity: 0.5
                });
                const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
                pulseRing.position.set(viewpoint.x, viewpoint.y, viewpoint.z);
                pulseRing.rotation.x = Math.PI / 2;
                pulseRing.userData = { isPulseRing: true };
                groupRef.current?.add(pulseRing);

                // Inner glow ring
                const glowRingGeo = new THREE.TorusGeometry(3, 0.25, 16, 32);
                const glowRingMat = new THREE.MeshBasicMaterial({
                    color: 0xa5f3fc, // Cyan-200
                    transparent: true,
                    opacity: 0.6
                });
                const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
                glowRing.position.set(viewpoint.x, viewpoint.y, viewpoint.z);
                glowRing.rotation.x = Math.PI / 2;
                groupRef.current?.add(glowRing);
            }

            // Add a vertical line from ground to viewpoint for reference
            const verticalLinePoints = [
                new THREE.Vector3(viewpoint.x, 0, viewpoint.z),
                new THREE.Vector3(viewpoint.x, viewpoint.y, viewpoint.z)
            ];
            const verticalGeo = new THREE.BufferGeometry().setFromPoints(verticalLinePoints);
            const verticalMat = new THREE.LineBasicMaterial({
                color: isSelected ? 0x06b6d4 : 0x14b8a6, // Cyan when selected
                transparent: true,
                opacity: isSelected ? 0.9 : 0.4,
                linewidth: isSelected ? 4 : 2
            });
            const verticalLine = new THREE.Line(verticalGeo, verticalMat);
            groupRef.current?.add(verticalLine);

            // Create vision cone (rays within 114° field of view)
            const raysInCone = 120; // 120 rays across the cone for dense visualization
            const rayDistance = 100; // 100m viewing distance
            
            for (let i = 0; i < raysInCone; i++) {
                // Spread rays across the field of view
                const angleOffset = ((i / (raysInCone - 1)) - 0.5) * visionConeRad;
                const rayAngle = viewpoint.direction + angleOffset;

                // Calculate ray direction
                const direction = new THREE.Vector3(
                    Math.cos(rayAngle),
                    0, // Horizontal rays only
                    Math.sin(rayAngle)
                );

                // Create visual ray
                const endPoint = new THREE.Vector3(
                    viewpoint.x + direction.x * rayDistance,
                    viewpoint.y + direction.y * rayDistance,
                    viewpoint.z + direction.z * rayDistance
                );

                const points = [
                    new THREE.Vector3(viewpoint.x, viewpoint.y, viewpoint.z),
                    endPoint
                ];

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                
                // Teal gradient - brighter at source, fade to darker
                const colors = new Float32Array([
                    0.078, 0.722, 0.651, // Start: Teal-500 RGB (20, 184, 166)
                    0.051, 0.584, 0.533  // End: Teal-600 RGB (13, 149, 136)
                ]);
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                const material = new THREE.LineBasicMaterial({
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.3,
                    linewidth: 1
                });

                const line = new THREE.Line(geometry, material);
                groupRef.current?.add(line);
            }

            // Add cone edge rays (more prominent)
            [-visionConeRad / 2, visionConeRad / 2].forEach((angleOffset) => {
                const rayAngle = viewpoint.direction + angleOffset;
                const direction = new THREE.Vector3(
                    Math.cos(rayAngle),
                    0,
                    Math.sin(rayAngle)
                );

                const endPoint = new THREE.Vector3(
                    viewpoint.x + direction.x * rayDistance,
                    viewpoint.y,
                    viewpoint.z + direction.z * rayDistance
                );

                const points = [
                    new THREE.Vector3(viewpoint.x, viewpoint.y, viewpoint.z),
                    endPoint
                ];

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: 0x14b8a6,
                    transparent: true,
                    opacity: 0.6,
                    linewidth: 2
                });

                const line = new THREE.Line(geometry, material);
                groupRef.current?.add(line);
            });

            // Add label above viewpoint
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 128;
            canvas.height = 64;
            context.fillStyle = '#14b8a6';
            context.font = 'Bold 32px Arial';
            context.textAlign = 'center';
            context.fillText(viewpoint.label, 64, 40);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.9
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(viewpoint.x, viewpoint.y + 3, viewpoint.z);
            sprite.scale.set(8, 4, 1);
            groupRef.current?.add(sprite);
        });

        console.log('[ViewCorridors] Created', groupRef.current.children.length, 'visualization elements');

    }, [enabled, viewpoints, scene, selectedViewpointIndex]);

    // @ts-ignore
    return <primitive object={groupRef.current} />;
};
