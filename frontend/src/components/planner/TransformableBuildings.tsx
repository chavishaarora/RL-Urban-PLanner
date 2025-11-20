// 3D Transform Controls for moving/rotating buildings in 3D viewport
import React, { useRef, useEffect, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TransformableBuildingsProps {
    enabled: boolean;
    selectedShapeIds: string[];
    onShapeUpdate: (shapeId: string, updates: { x?: number; y?: number; rotation?: number }) => void;
}

export const TransformableBuildings: React.FC<TransformableBuildingsProps> = ({
    enabled,
    selectedShapeIds,
    onShapeUpdate,
}) => {
    const { scene, camera, gl } = useThree();
    const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);
    const transformRef = useRef<any>(null);

    // Find the selected mesh in the scene
    useEffect(() => {
        if (!enabled || selectedShapeIds.length !== 1) {
            setSelectedMesh(null);
            return;
        }

        const shapeId = selectedShapeIds[0];
        let found: THREE.Mesh | null = null;

        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData?.shapeId === shapeId) {
                found = child;
            }
        });

        setSelectedMesh(found);
    }, [enabled, selectedShapeIds, scene]);

    // Handle transform changes
    const handleTransformChange = () => {
        if (!selectedMesh || !transformRef.current) return;

        const shapeId = selectedMesh.userData.shapeId;
        if (!shapeId) return;

        // Get updated position
        const position = selectedMesh.position;
        const rotation = selectedMesh.rotation;

        onShapeUpdate(shapeId, {
            x: position.x,
            y: position.z, // Map Z to Y in 2D coordinates
            rotation: rotation.y, // Rotation around Y axis
        });
    };

    if (!enabled || !selectedMesh) return null;

    return (
        <TransformControls
            ref={transformRef}
            object={selectedMesh}
            mode="translate" // Can switch to 'rotate' or 'scale'
            onObjectChange={handleTransformChange}
        />
    );
};
