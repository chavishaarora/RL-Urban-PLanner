// @ts-nocheck
import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';

interface RotationControlsProps {
  selectedMesh: THREE.Mesh | null;
  onRotationChange: (rotation: number) => void;
  enabled: boolean;
}

export const RotationControls: React.FC<RotationControlsProps> = ({ 
  selectedMesh, 
  onRotationChange,
  enabled 
}) => {
  const transformRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const initialRotationRef = useRef<number>(0);

  useEffect(() => {
    if (selectedMesh && transformRef.current) {
      // Store initial rotation when mesh is selected
      initialRotationRef.current = selectedMesh.rotation.y;
    }
  }, [selectedMesh]);

  const handleChange = () => {
    if (selectedMesh && transformRef.current) {
      // Get the current Y rotation (in radians)
      const currentRotation = selectedMesh.rotation.y;
      // Convert to degrees
      const degrees = (currentRotation * 180) / Math.PI;
      // Normalize to 0-360
      const normalized = ((degrees % 360) + 360) % 360;
      onRotationChange(normalized);
    }
  };

  if (!selectedMesh || !enabled) return null;

  return (
    <TransformControls
      ref={transformRef}
      object={selectedMesh}
      mode="rotate"
      size={1.5}
      showX={false}
      showZ={false}
      onObjectChange={handleChange}
    />
  );
};
