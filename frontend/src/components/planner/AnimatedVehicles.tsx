// @ts-nocheck
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanShape } from '../../types';
import { getPrimaryAxisAngle } from '@/utils/geometry';

interface VehicleProps {
  points: { x: number; z: number }[];
  speed?: number;
  color?: string;
  y?: number;
  size?: [number, number, number];
  laneOffset?: number;
}

function Vehicle({ points, speed = 6, color = '#94a3b8', y = 0.6, size = [1.6, 1, 3], laneOffset = 0 }: VehicleProps) {
  const ref = useRef<THREE.Group>(null);
  // Piecewise linear loop (no smoothing) so cars stick to road centerlines
  const pts = useMemo(() => points.map(p => new THREE.Vector3(p.x, 0, p.z)), [points]);
  const segLens = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      arr.push(a.distanceTo(b));
    }
    return arr;
  }, [pts]);
  const totalLen = useMemo(() => segLens.reduce((s, v) => s + v, 0), [segLens]);
  const tRef = useRef(Math.random());

  useFrame((_, dt) => {
    if (!ref.current || totalLen <= 0 || pts.length < 2) return;
    // advance proportionally to real distance
    const delta = (speed * dt) / totalLen;
    tRef.current = (tRef.current + delta) % 1;
    let dist = tRef.current * totalLen;
    let seg = 0;
    while (dist > segLens[seg]) {
      dist -= segLens[seg];
      seg = (seg + 1) % pts.length;
    }
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    const segLen = Math.max(segLens[seg], 1e-6);
    const f = dist / segLen;
    const pos = new THREE.Vector3().lerpVectors(a, b, f);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    pos.addScaledVector(normal, laneOffset);
    ref.current.position.set(pos.x, y, pos.z);
    ref.current.rotation.y = Math.atan2(dir.x, dir.z);
  });

  return (
    <group ref={ref}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

interface AnimatedVehiclesProps {
  siteCenter: { x: number; y: number };
  pathShapes?: PlanShape[]; // raw path shapes from plan
  loops?: { x: number; z: number }[][]; // pre-computed road centerlines (e.g. from OSM)
}

export const AnimatedVehicles: React.FC<AnimatedVehiclesProps> = ({ siteCenter, pathShapes, loops }) => {
  // Derive centerline loops from path shapes (straight approximation)
  const derivedLoops = useMemo(() => {
    if (!pathShapes || pathShapes.length === 0) return [] as { x: number; z: number }[][];
    return pathShapes.map(shape => {
      // Gather world polygon points
      const poly = (shape.points && shape.points.length >= 2)
        ? shape.points.map(p => ({ x: p.x, y: p.y }))
        : [
            { x: 0, y: 0 },
            { x: shape.width, y: 0 },
            { x: shape.width, y: shape.height },
            { x: 0, y: shape.height }
          ];
      // Shift by shape.x/y
      const world = poly.map(p => ({ x: p.x + shape.x, y: p.y + shape.y }));
      // Convert polygon outline directly into loop, preserving shape
      const outline = world.map(p => ({ x: p.x, z: -p.y }));
      // Ensure closed
      if (outline.length > 2) {
        // Optionally simplify very small edges later
        return outline;
      }
      return outline;
    });
  }, [pathShapes]);
  const makeRect = (W: number, H: number): { x: number; z: number }[] => {
    const cx = siteCenter.x;
    const cz = -siteCenter.y; // map Y -> three Z
    return [
      { x: cx - W, z: cz - H },
      { x: cx + W, z: cz - H },
      { x: cx + W, z: cz + H },
      { x: cx - W, z: cz + H },
    ];
  };

  const outerLoop = useMemo(() => makeRect(46, 30), [siteCenter.x, siteCenter.y]);
  const innerLoop = useMemo(() => makeRect(26, 16), [siteCenter.x, siteCenter.y]);

  const carCount = 28; // 25–30 cars
  const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#9ca3af', '#eab308', '#22d3ee'];
  const lanes = 4;
  const laneStep = 1.2;

  // Use provided loops (OSM) first; fall back to derived loops from path shapes
  const activeLoops = loops && loops.length > 0 ? loops : derivedLoops;
  
  const vehicles = (activeLoops.length === 0 ? [] : Array.from({ length: carCount }, (_, idx) => {
    // Distribute vehicles across available road centerlines
    const basePoints = activeLoops[idx % activeLoops.length];
    const clockwise = idx % 3 !== 0; // mix directions
    const points = clockwise ? basePoints : [...basePoints].reverse();
    const speed = 4.2 + (idx % 7) * 0.55; // 4.2 – 7.5 m/s-ish
    const laneOffset = ((idx % lanes) - (lanes - 1) / 2) * laneStep;
    const size: [number, number, number] = [
      1.9 + (idx % 5) * 0.25,
      1.15,
      3.8 + (idx % 4) * 0.5,
    ];
    const color = colors[idx % colors.length];
    return { points, speed, laneOffset, size, color };
  }));

  return (
    <group>
      {vehicles.map((v, idx) => (
        <Vehicle
          key={`v-${idx}`}
          points={v.points}
          speed={v.speed}
          color={v.color}
          laneOffset={v.laneOffset}
          size={v.size}
        />
      ))}
    </group>
  );
};
