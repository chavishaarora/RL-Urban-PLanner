// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

// Minimal capsule geometry for human agents
function Capsule({ radius = 0.3, height = 1.4, color = '#7dd3fc' }) {
  const cap = useMemo(() => {
    const g = new THREE.CapsuleGeometry(radius, Math.max(0, height - radius * 2), 8, 8);
    return g;
  }, [radius, height]);
  return (
    <mesh geometry={cap} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

// Simple agent that walks between waypoints
function WalkingAgent({ waypoints, speed = 1.2, color, y = 0 }) {
  const ref = useRef<THREE.Group>(null);
  const [i, setI] = useState(0);

  useFrame((_, dt) => {
    if (!ref.current || waypoints.length < 2) return;
    const curr = new THREE.Vector3(ref.current.position.x, 0, ref.current.position.z);
    const tgt = new THREE.Vector3(waypoints[i].x, 0, waypoints[i].z);
    const dir = tgt.clone().sub(curr);
    const dist = dir.length();
    if (dist < 0.2) {
      setI((i + 1) % waypoints.length);
      return;
    }
    dir.normalize();
    const step = Math.min(dist, speed * dt);
    const next = curr.addScaledVector(dir, step);
    ref.current.position.set(next.x, y, next.z);
    // face direction
    const yaw = Math.atan2(dir.x, dir.z);
    ref.current.rotation.y = yaw;
  });

  return (
    <group ref={ref} position={[waypoints[0]?.x ?? 0, y, waypoints[0]?.z ?? 0]}> 
      <Capsule color={color} />
    </group>
  );
}

// Simple vehicle following a loop spline
function Vehicle({ points, speed = 6, color = '#94a3b8', y = 0.4, size = [1.6, 1, 3], laneOffset = 0 }) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, 0, p.z)), true), [points]);
  const len = useMemo(() => curve.getLength(), [curve]);
  const tRef = useRef(Math.random());

  useFrame((_, dt) => {
    if (!ref.current || !len) return;
    const delta = (speed * dt) / len; // normalized
    tRef.current = (tRef.current + delta) % 1;
    const p1 = curve.getPointAt(tRef.current);
    const p2 = curve.getPointAt((tRef.current + 0.01) % 1);
    const dir = p2.clone().sub(p1).normalize();
    // lateral offset using normal in XZ plane
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const pos = p1.clone().addScaledVector(normal, laneOffset);
    ref.current.position.set(pos.x, y, pos.z);
    const yaw = Math.atan2(dir.x, dir.z);
    ref.current.rotation.y = yaw;
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

export interface RealTimeModeProps {
  enabled: boolean;
  siteCenter: { x: number; y: number };
  groundY?: number;
  buildingMeshes?: THREE.Mesh[];
  onExit?: () => void;
  setFov?: (fov: number) => void;
  ambientPreset?: 'off' | 'traffic' | 'ocean' | 'birds';
}

export const RealTimeMode: React.FC<RealTimeModeProps> = ({ enabled, siteCenter, groundY = 0, buildingMeshes = [], onExit, setFov, ambientPreset = 'off' }) => {
  const { camera, gl, scene } = useThree();
  const [locked, setLocked] = useState(false);
  const [speed, setSpeed] = useState(3.0); // m/s walking ~1.4, slight boost for comfort
  const [sprint, setSprint] = useState(false);
  const listenerRef = useRef<THREE.AudioListener | null>(null);
  const ambientRef = useRef<THREE.Audio | null>(null);
  const ambientNodes = useRef<{ osc?: OscillatorNode; gain?: GainNode; lfo?: OscillatorNode } | null>(null);
  const controlsRef = useRef<any>(null);
  const keysRef = useRef(new Set<string>()); // Move keys to component state

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      console.log('🔵 Key down:', e.code, 'All keys:', Array.from(keysRef.current));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Basic AABB collision
  const collides = (nextPos: THREE.Vector3, height: number, radius: number, boxes: THREE.Box3[]) => {
    const aabb = new THREE.Box3(
      new THREE.Vector3(nextPos.x - radius, 0, nextPos.z - radius),
      new THREE.Vector3(nextPos.x + radius, height, nextPos.z + radius)
    );
    for (const b of boxes) {
      if (aabb.intersectsBox(b)) return true;
    }
    return false;
  };


  // Precompute building boxes
  const boxes = useMemo(() => {
    return buildingMeshes.map(m => {
      m.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(m);
      return box;
    });
  }, [buildingMeshes]);

  // Adjust camera for human perspective when enabled
  useEffect(() => {
    if (!enabled) return;
    const prevFov = camera.fov;
    const prevPos = camera.position.clone();
    const prevNear = camera.near;

    camera.fov = 90;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    if (setFov) setFov(90);

    // Place at site center, slight offset
    camera.position.set(siteCenter.x, groundY + 1.7, siteCenter.y + 2);

    // Audio listener (stub)
    if (!listenerRef.current) {
      listenerRef.current = new THREE.AudioListener();
      camera.add(listenerRef.current);
    }

    return () => {
      camera.fov = prevFov;
      camera.near = prevNear;
      camera.position.copy(prevPos);
      camera.updateProjectionMatrix();
      if (setFov) setFov(prevFov);
    };
  }, [enabled]);

  // Movement update loop
  useFrame((_, dt) => {
    if (!enabled) return; // ALLOW MOVEMENT even without lock; lock only affects mouse look
    const vel = (sprint ? speed * 1.8 : speed) * dt;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize().multiplyScalar(-1);

    let next = camera.position.clone();
    let moved = false;
    const keys = keysRef.current;
    if (keys.has('KeyW')) { next.addScaledVector(fwd, vel); moved = true; }
    if (keys.has('KeyS')) { next.addScaledVector(fwd, -vel); moved = true; }
    if (keys.has('KeyA')) { next.addScaledVector(right, -vel); moved = true; }
    if (keys.has('KeyD')) { next.addScaledVector(right, vel); moved = true; }

    // Debug: log once per second if keys are pressed but no movement
    if (moved && (Date.now() % 1000 < 16)) {
      console.log('🎮 WASD input detected, keys:', Array.from(keys), 'sprint:', sprint, 'next:', next);
    }

    // keep on ground
    next.y = groundY + 1.7;

    // simple collision
    if (!collides(next, 1.7, 0.35, boxes)) {
      camera.position.copy(next);
    } else if (moved) {
      console.log('⚠️ Collision detected at:', next);
    }
  });

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setSprint(true);
      if (e.code === 'Escape') {
        setLocked(false);
        onExit?.();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setSprint(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [onExit]);

  // Ambient soundscape (very lightweight synthesis)
  useEffect(() => {
    if (!enabled) {
      // stop if disabled
      if (ambientNodes.current?.osc) ambientNodes.current.osc.stop();
      ambientNodes.current = null;
      ambientRef.current = null;
      return;
    }
    if (!listenerRef.current) return;
    const ctx = listenerRef.current.context as AudioContext;
    // cleanup previous
    if (ambientNodes.current?.osc) ambientNodes.current.osc.stop();
    ambientNodes.current = {};
    if (ambientPreset === 'off') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    osc.connect(gain).connect(ctx.destination);

    if (ambientPreset === 'traffic') {
      osc.type = 'sawtooth';
      osc.frequency.value = 90; // low hum
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.2;
      lfoGain.gain.value = 0.08; // modulation depth
      lfo.connect(lfoGain).connect(gain.gain);
      gain.gain.value = 0.05;
      lfo.start();
      ambientNodes.current.lfo = lfo;
    } else if (ambientPreset === 'ocean') {
      osc.type = 'sine';
      osc.frequency.value = 55;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.1;
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain).connect(gain.gain);
      gain.gain.value = 0.06;
      lfo.start();
      ambientNodes.current.lfo = lfo;
    } else if (ambientPreset === 'birds') {
      osc.type = 'triangle';
      osc.frequency.value = 1200;
      gain.gain.value = 0.0;
      // chirp envelopes
      const playChirp = () => {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      };
      const interval = setInterval(playChirp, 1200 + Math.random() * 1200);
      // store cleanup
      (ambientNodes.current as any).interval = interval;
    }
    // fade in
    const now = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(osc.type === 'triangle' ? 0.001 : gain.gain.value || 0.06, now + 0.8);
    osc.start();
    ambientNodes.current.osc = osc;
    ambientNodes.current.gain = gain;

    return () => {
      try { ambientNodes.current?.osc?.stop(); } catch {}
      if ((ambientNodes.current as any)?.interval) clearInterval((ambientNodes.current as any).interval);
      ambientNodes.current = null;
    };
  }, [enabled, ambientPreset]);

  // Waypoint helpers
  const randomWaypoints = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    const R = 20;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.2;
      arr.push({ x: siteCenter.x + Math.cos(a) * (R + Math.random() * 10), z: siteCenter.y + Math.sin(a) * (R + Math.random() * 10) });
    }
    return arr;
  }, [siteCenter.x, siteCenter.y]);

  const loopPoints = useMemo(() => {
    const pts = [] as { x: number; z: number }[];
    const W = 40, H = 26;
    const cx = siteCenter.x, cz = siteCenter.y;
    pts.push({ x: cx - W, z: cz - H });
    pts.push({ x: cx + W, z: cz - H });
    pts.push({ x: cx + W, z: cz + H });
    pts.push({ x: cx - W, z: cz + H });
    return pts;
  }, [siteCenter.x, siteCenter.y]);

  return (
    <>
      {enabled && (
        <PointerLockControls
          ref={controlsRef}
          makeDefault
          // no selector: click anywhere on the canvas to lock
          onLock={() => setLocked(true)}
          onUnlock={() => { setLocked(false); onExit?.(); }}
        />
      )}

      {/* Agents */}
      {enabled && (
        <group>
          {new Array(8).fill(0).map((_, idx) => (
            <WalkingAgent key={idx} waypoints={randomWaypoints} speed={1.2 + (idx % 3) * 0.3} color={idx % 2 ? '#60a5fa' : '#34d399'} y={0} />
          ))}
        </group>
      )}
    </>
  );
};
