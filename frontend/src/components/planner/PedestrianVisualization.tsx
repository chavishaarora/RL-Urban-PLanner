import React, { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PedestrianAgent {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    destination: THREE.Vector3;
    mesh: THREE.Mesh;
    path: THREE.Vector3[];
    pathIndex: number;
    speed: number;
    radius: number;
}

interface PedestrianVisualizationProps {
    buildings: THREE.Mesh[];
    siteBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
    enabled: boolean;
}

export const PedestrianVisualization: React.FC<PedestrianVisualizationProps> = ({
    buildings,
    siteBounds,
    enabled
}) => {
    const { scene } = useThree();
    const agentsRef = useRef<PedestrianAgent[]>([]);
    const pathLinesRef = useRef<THREE.Line[]>([]);
    const heatmapRef = useRef<THREE.Mesh | null>(null);
    const animationRef = useRef<number>(0);
    const densityGridRef = useRef<number[][]>([]);

    // Entry and destination points
    const entryPoints = useMemo(() => {
        const points = [
            new THREE.Vector3(siteBounds.minX, 0.5, siteBounds.minZ),
            new THREE.Vector3(siteBounds.maxX, 0.5, siteBounds.minZ),
            new THREE.Vector3(siteBounds.minX, 0.5, siteBounds.maxZ),
            new THREE.Vector3(siteBounds.maxX, 0.5, siteBounds.maxZ),
            new THREE.Vector3((siteBounds.minX + siteBounds.maxX) / 2, 0.5, siteBounds.minZ),
            new THREE.Vector3((siteBounds.minX + siteBounds.maxX) / 2, 0.5, siteBounds.maxZ),
        ];
        return points;
    }, [siteBounds]);

    const destinationPoints = useMemo(() => {
        // Create destination points at building entrances and key locations
        const points: THREE.Vector3[] = [];
        
        buildings.forEach(building => {
            const bbox = new THREE.Box3().setFromObject(building);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            
            // Add points at building corners (entry points)
            points.push(new THREE.Vector3(bbox.min.x, 0.5, bbox.min.z));
            points.push(new THREE.Vector3(bbox.max.x, 0.5, bbox.min.z));
            points.push(new THREE.Vector3(bbox.min.x, 0.5, bbox.max.z));
            points.push(new THREE.Vector3(bbox.max.x, 0.5, bbox.max.z));
        });

        // Add central gathering points
        const centerX = (siteBounds.minX + siteBounds.maxX) / 2;
        const centerZ = (siteBounds.minZ + siteBounds.maxZ) / 2;
        points.push(new THREE.Vector3(centerX, 0.5, centerZ));
        
        return points;
    }, [buildings, siteBounds]);

    // Find path avoiding buildings
    const findPath = (start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] => {
        const path: THREE.Vector3[] = [start.clone()];
        const current = start.clone();
        const stepSize = 2; // Smaller steps for smoother paths
        const maxSteps = 200;
        let steps = 0;

        while (current.distanceTo(end) > stepSize && steps < maxSteps) {
            const direction = end.clone().sub(current).normalize();
            let nextPos = current.clone().add(direction.multiplyScalar(stepSize));
            nextPos.y = 0.5; // Keep at ground level
            
            // Check for building collision
            let collision = false;
            for (const building of buildings) {
                building.updateMatrixWorld(true);
                const bbox = new THREE.Box3().setFromObject(building);
                bbox.expandByScalar(1.5); // Safety margin
                
                if (bbox.containsPoint(nextPos)) {
                    collision = true;
                    
                    // Try to go around both directions
                    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
                    const alternate1 = current.clone().add(perpendicular.multiplyScalar(stepSize * 1.5));
                    const alternate2 = current.clone().add(perpendicular.multiplyScalar(-stepSize * 1.5));
                    alternate1.y = 0.5;
                    alternate2.y = 0.5;
                    
                    let foundAlternate = false;
                    if (!bbox.containsPoint(alternate1)) {
                        nextPos = alternate1;
                        foundAlternate = true;
                    } else if (!bbox.containsPoint(alternate2)) {
                        nextPos = alternate2;
                        foundAlternate = true;
                    }
                    
                    if (foundAlternate) {
                        collision = false;
                    }
                    break;
                }
            }
            
            if (!collision) {
                path.push(nextPos.clone());
                current.copy(nextPos);
            } else {
                // If still in collision, try moving perpendicular
                const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
                const escape = current.clone().add(perpendicular.multiplyScalar(stepSize));
                escape.y = 0.5;
                path.push(escape.clone());
                current.copy(escape);
            }
            steps++;
        }
        
        path.push(end.clone());
        console.log(`Path created with ${path.length} waypoints from`, start, 'to', end);
        return path;
    };

    // Initialize pedestrian agents
    useEffect(() => {
        if (!enabled) {
            // Clear agents
            agentsRef.current.forEach(agent => {
                scene.remove(agent.mesh);
                agent.mesh.geometry.dispose();
                (agent.mesh.material as THREE.Material).dispose();
            });
            agentsRef.current = [];
            return;
        }

        console.log('=== Creating pedestrian agents ===');
        console.log('Buildings available:', buildings.length);
        console.log('Entry points:', entryPoints.length);
        console.log('Destination points:', destinationPoints.length);
        console.log('Site bounds:', siteBounds);

        const numAgents = 50; // Number of pedestrians
        const agents: PedestrianAgent[] = [];

        for (let i = 0; i < numAgents; i++) {
            const entryPoint = entryPoints[Math.floor(Math.random() * entryPoints.length)].clone();
            const destination = destinationPoints[Math.floor(Math.random() * destinationPoints.length)].clone();
            
            console.log(`Agent ${i}: Entry ${entryPoint.x.toFixed(1)},${entryPoint.z.toFixed(1)} -> Dest ${destination.x.toFixed(1)},${destination.z.toFixed(1)}`);
            
            const path = findPath(entryPoint, destination);
            
            // Create pedestrian mesh (small cylinder)
            const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.7, 8);
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
                metalness: 0.2,
                roughness: 0.8
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(entryPoint);
            mesh.castShadow = true;
            scene.add(mesh);

            agents.push({
                position: entryPoint.clone(),
                velocity: new THREE.Vector3(),
                destination: destination,
                mesh: mesh,
                path: path,
                pathIndex: 0,
                speed: 0.8 + Math.random() * 0.7, // 0.8-1.5 m/s
                radius: 0.4
            });
        }

        agentsRef.current = agents;
        console.log(`✓ Created ${agents.length} pedestrian agents with paths`);

        return () => {
            agents.forEach(agent => {
                scene.remove(agent.mesh);
                agent.mesh.geometry.dispose();
                (agent.mesh.material as THREE.Material).dispose();
            });
        };
    }, [enabled, buildings, scene, entryPoints, destinationPoints]);

    // Initialize density grid for heatmap
    useEffect(() => {
        if (!enabled) return;

        const gridResolution = 50;
        const grid: number[][] = [];
        for (let i = 0; i < gridResolution; i++) {
            grid[i] = [];
            for (let j = 0; j < gridResolution; j++) {
                grid[i][j] = 0;
            }
        }
        densityGridRef.current = grid;
    }, [enabled]);

    // Animate pedestrians
    useFrame((state, delta) => {
        if (!enabled || agentsRef.current.length === 0) return;

        animationRef.current += delta;

        agentsRef.current.forEach((agent, index) => {
            // Ensure agent has a valid path
            if (!agent.path || agent.path.length === 0) {
                console.log(`Agent ${index} has no path, creating new one`);
                const newDest = destinationPoints[Math.floor(Math.random() * destinationPoints.length)].clone();
                agent.path = findPath(agent.position, newDest);
                agent.pathIndex = 0;
                agent.destination = newDest;
                return;
            }

            // Check if reached current waypoint
            if (agent.pathIndex < agent.path.length) {
                const target = agent.path[agent.pathIndex];
                const distance = agent.position.distanceTo(target);

                if (distance < 0.5) { // Smaller threshold for smoother movement
                    agent.pathIndex++;
                    
                    // If reached final destination, get new destination
                    if (agent.pathIndex >= agent.path.length) {
                        const newDest = destinationPoints[Math.floor(Math.random() * destinationPoints.length)].clone();
                        agent.path = findPath(agent.position, newDest);
                        agent.pathIndex = 0;
                        agent.destination = newDest;
                        console.log(`Agent ${index} reached destination, new path created`);
                    }
                } else {
                    // Move towards target
                    const direction = target.clone().sub(agent.position).normalize();
                    
                    // Avoid other agents (social force model)
                    const avoidanceForce = new THREE.Vector3();
                    agentsRef.current.forEach(other => {
                        if (other === agent) return;
                        const toOther = other.position.clone().sub(agent.position);
                        const dist = toOther.length();
                        if (dist < agent.radius + other.radius + 1.5) {
                            const force = toOther.normalize().multiplyScalar(-0.5 / Math.max(dist, 0.1));
                            avoidanceForce.add(force);
                        }
                    });

                    // Combine direction with avoidance
                    const finalDirection = direction.add(avoidanceForce).normalize();
                    const moveDistance = agent.speed * delta;
                    agent.velocity.copy(finalDirection.multiplyScalar(moveDistance));
                    agent.position.add(agent.velocity);
                    agent.position.y = 0.5; // Keep at ground level
                    
                    // Update mesh position
                    agent.mesh.position.copy(agent.position);
                    
                    // Rotate to face direction
                    if (agent.velocity.length() > 0.01) {
                        const angle = Math.atan2(agent.velocity.x, agent.velocity.z);
                        agent.mesh.rotation.y = angle;
                    }

                    // Bob animation (walking)
                    agent.mesh.position.y = 0.85 + Math.sin(animationRef.current * 8 + index) * 0.08;

                    // Update density grid
                    const gridRes = densityGridRef.current.length;
                    if (gridRes > 0) {
                        const gridX = Math.floor(((agent.position.x - siteBounds.minX) / (siteBounds.maxX - siteBounds.minX)) * gridRes);
                        const gridZ = Math.floor(((agent.position.z - siteBounds.minZ) / (siteBounds.maxZ - siteBounds.minZ)) * gridRes);
                        
                        if (gridX >= 0 && gridX < gridRes && gridZ >= 0 && gridZ < gridRes) {
                            densityGridRef.current[gridX][gridZ] += delta;
                        }
                    }
                }
            } else {
                // Pathfinding reached end, create new destination
                const newDest = destinationPoints[Math.floor(Math.random() * destinationPoints.length)].clone();
                agent.path = findPath(agent.position, newDest);
                agent.pathIndex = 0;
                agent.destination = newDest;
            }
        });
    });

    // Cleanup
    useEffect(() => {
        return () => {
            agentsRef.current.forEach(agent => {
                scene.remove(agent.mesh);
                agent.mesh.geometry.dispose();
                (agent.mesh.material as THREE.Material).dispose();
            });
            agentsRef.current = [];
            
            pathLinesRef.current.forEach(line => {
                scene.remove(line);
                line.geometry.dispose();
                (line.material as THREE.Material).dispose();
            });
            pathLinesRef.current = [];
            
            if (heatmapRef.current) {
                scene.remove(heatmapRef.current);
                heatmapRef.current.geometry.dispose();
                (heatmapRef.current.material as THREE.Material).dispose();
            }
        };
    }, [scene]);

    return null;
};

export default PedestrianVisualization;
