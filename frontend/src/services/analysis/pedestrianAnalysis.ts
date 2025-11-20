import * as THREE from 'three';
import * as PF from 'pathfinding';
import * as turf from '@turf/turf';

export interface PedestrianAnalysisResult {
    flowDensity: number[][];
    accessibilityScore: number;
    criticalPaths: THREE.Vector3[][];
    congestionPoints: { position: THREE.Vector3; intensity: number }[];
    avgPathLength: number;
    numSimulatedAgents: number;
}

export class PedestrianAnalyzer {
    private scene: THREE.Scene;
    private buildings: THREE.Mesh[];
    private gridSize: { x: number; y: number };
    private cellSize: number;
    private finder: PF.AStarFinder;
    private grid: PF.Grid;

    constructor(scene: THREE.Scene, buildings: THREE.Mesh[], gridSize = { x: 100, y: 100 }, cellSize = 1) {
        this.scene = scene;
        this.buildings = buildings;
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        
        // Initialize pathfinding
        this.grid = new PF.Grid(gridSize.x, gridSize.y);
        this.finder = new PF.AStarFinder({
            allowDiagonal: true,
            dontCrossCorners: true
        });
        
        this.initializeGrid();
    }

    private initializeGrid() {
        // Mark building positions as obstacles in the grid
        this.buildings.forEach(building => {
            const bbox = new THREE.Box3().setFromObject(building);
            const min = bbox.min.divideScalar(this.cellSize);
            const max = bbox.max.divideScalar(this.cellSize);
            
            for (let x = Math.floor(min.x); x <= Math.ceil(max.x); x++) {
                for (let y = Math.floor(min.z); y <= Math.ceil(max.z); y++) {
                    if (x >= 0 && x < this.gridSize.x && y >= 0 && y < this.gridSize.y) {
                        this.grid.setWalkableAt(x, y, false);
                    }
                }
            }
        });
    }

    async analyzePedestrianFlow(
        entryPoints: THREE.Vector3[],
        destinations: THREE.Vector3[]
    ): Promise<PedestrianAnalysisResult> {
        // Initialize flow density grid
        const flowDensity = Array(this.gridSize.x)
            .fill(0)
            .map(() => Array(this.gridSize.y).fill(0));
        
        // Calculate paths between entry points and destinations
        const paths = this.calculateAllPaths(entryPoints, destinations);
        
        // Calculate flow density
        paths.forEach(path => {
            path.forEach(point => {
                const x = Math.floor(point.x / this.cellSize);
                const y = Math.floor(point.z / this.cellSize);
                if (x >= 0 && x < this.gridSize.x && y >= 0 && y < this.gridSize.y) {
                    flowDensity[x][y]++;
                }
            });
        });
        
        // Calculate accessibility score
        const accessibilityScore = this.calculateAccessibilityScore(paths);
        
        // Find critical paths
        const criticalPaths = this.findCriticalPaths(paths, flowDensity);
        
        // Identify congestion points
        const congestionPoints = this.identifyCongestionPoints(flowDensity);

        // Calculate average path length
        const avgPathLength = paths.reduce((sum, path) => {
            let pathLength = 0;
            for (let i = 1; i < path.length; i++) {
                pathLength += path[i].distanceTo(path[i - 1]);
            }
            return sum + pathLength;
        }, 0) / Math.max(paths.length, 1);

        return {
            flowDensity,
            accessibilityScore,
            criticalPaths,
            congestionPoints,
            avgPathLength,
            numSimulatedAgents: entryPoints.length * destinations.length
        };
    }

    private calculateAllPaths(
        entryPoints: THREE.Vector3[],
        destinations: THREE.Vector3[]
    ): THREE.Vector3[][] {
        const paths: THREE.Vector3[][] = [];
        
        entryPoints.forEach(entry => {
            destinations.forEach(dest => {
                const startX = Math.floor(entry.x / this.cellSize);
                const startY = Math.floor(entry.z / this.cellSize);
                const endX = Math.floor(dest.x / this.cellSize);
                const endY = Math.floor(dest.z / this.cellSize);
                
                if (this.isValidPosition(startX, startY) && this.isValidPosition(endX, endY)) {
                    const gridClone = this.grid.clone();
                    const path = this.finder.findPath(startX, startY, endX, endY, gridClone);
                    
                    if (path.length > 0) {
                        paths.push(
                            path.map(
                                ([x, y]) =>
                                    new THREE.Vector3(
                                        x * this.cellSize,
                                        0,
                                        y * this.cellSize
                                    )
                            )
                        );
                    }
                }
            });
        });
        
        return paths;
    }

    private isValidPosition(x: number, y: number): boolean {
        return (
            x >= 0 &&
            x < this.gridSize.x &&
            y >= 0 &&
            y < this.gridSize.y &&
            this.grid.isWalkableAt(x, y)
        );
    }

    private calculateAccessibilityScore(paths: THREE.Vector3[][]): number {
        if (paths.length === 0) return 0;
        
        // Calculate average path length and normalize
        const avgPathLength =
            paths.reduce((sum, path) => sum + path.length, 0) / paths.length;
        const maxPossibleLength = this.gridSize.x + this.gridSize.y;
        
        // Higher score means better accessibility (shorter paths)
        return 1 - avgPathLength / maxPossibleLength;
    }

    private findCriticalPaths(
        paths: THREE.Vector3[][],
        flowDensity: number[][]
    ): THREE.Vector3[][] {
        // Find paths that pass through high-density areas
        const threshold = this.calculateFlowThreshold(flowDensity);
        
        return paths.filter(path => {
            return path.some(point => {
                const x = Math.floor(point.x / this.cellSize);
                const y = Math.floor(point.z / this.cellSize);
                return (
                    x >= 0 &&
                    x < this.gridSize.x &&
                    y >= 0 &&
                    y < this.gridSize.y &&
                    flowDensity[x][y] > threshold
                );
            });
        });
    }

    private calculateFlowThreshold(flowDensity: number[][]): number {
        // Calculate the 75th percentile of flow density as threshold
        const allValues = flowDensity.flat().sort((a, b) => a - b);
        const index = Math.floor(allValues.length * 0.75);
        return allValues[index];
    }

    private identifyCongestionPoints(
        flowDensity: number[][]
    ): { position: THREE.Vector3; intensity: number }[] {
        const congestionPoints = [];
        const threshold = this.calculateFlowThreshold(flowDensity);
        
        for (let x = 0; x < this.gridSize.x; x++) {
            for (let y = 0; y < this.gridSize.y; y++) {
                if (flowDensity[x][y] > threshold) {
                    congestionPoints.push({
                        position: new THREE.Vector3(
                            x * this.cellSize,
                            0,
                            y * this.cellSize
                        ),
                        intensity: flowDensity[x][y] / threshold
                    });
                }
            }
        }
        
        return congestionPoints;
    }
}