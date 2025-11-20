/**
 * FREE GRADIENT RENDERER
 * Three.js-based real-time gradient system
 * 100% Open Source
 */

import * as THREE from 'three';
import { 
    gradientVertexShader, 
    gradientFragmentShader,
    windVectorShader 
} from '../shaders/freeGradientShaders';
import { 
    computeEnvironmentalGrid,
    createDataTexture,
    GridCell
} from './freeGradientSystem';

export interface GradientRendererOptions {
    resolution: number;
    colorScheme: 'viridis' | 'plasma' | 'inferno' | 'magma';
    smoothing: number; // 0-5
    buildingFeather: number; // 0-1
    bloomIntensity: number; // 0-1
    showWindVectors?: boolean;
}

export class FreeGradientRenderer {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private dataTexture: THREE.DataTexture | null = null;
    private buildingMaskTexture: THREE.DataTexture | null = null;
    private windVectorMesh: THREE.Mesh | null = null;
    private lastRange: { min: number; max: number } | null = null;
    
    constructor(private options: GradientRendererOptions) {}

    /**
     * Create gradient material (FREE - WebGL shader)
     */
    private createMaterial(
        dataTexture: THREE.DataTexture,
        buildingMask: THREE.DataTexture,
        valueRange: { min: number; max: number }
    ): THREE.ShaderMaterial {
        const colorSchemeMap = {
            'viridis': 0,
            'plasma': 1,
            'inferno': 2,
            'magma': 3
        };

        console.log('[Renderer] Creating material with:', {
            dataTexture: dataTexture ? 'valid' : 'NULL',
            buildingMask: buildingMask ? 'valid' : 'NULL',
            valueRange,
            resolution: this.options.resolution
        });

        const material = new THREE.ShaderMaterial({
            vertexShader: gradientVertexShader,
            fragmentShader: gradientFragmentShader,
            uniforms: {
                uDataTexture: { value: dataTexture },
                uBuildingMask: { value: buildingMask },
                uResolution: { value: new THREE.Vector2(this.options.resolution, this.options.resolution) },
                uMinValue: { value: valueRange.min },
                uMaxValue: { value: valueRange.max },
                uColorScheme: { value: colorSchemeMap[this.options.colorScheme] },
                uSmoothing: { value: this.options.smoothing },
                uBuildingFeather: { value: this.options.buildingFeather },
                uBloomIntensity: { value: this.options.bloomIntensity }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // Log shader compilation errors
        material.needsUpdate = true;
        console.log('[Renderer] Material created, checking compilation...');

        return material;
    }

    /**
     * Returns last computed value range for legend/UX
     */
    getLastRange() {
        return this.lastRange;
    }

    /**
     * Create building mask texture (FREE)
     */
    private createBuildingMask(grid: GridCell[][]): THREE.DataTexture {
        const resolution = grid.length;
        const maskData = new Float32Array(resolution * resolution);

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const cell = grid[y][x];
                const idx = y * resolution + x;
                
                // Mark cells with nearby buildings
                maskData[idx] = cell.buildings.length > 0 && cell.buildings[0].distance < 5 ? 1.0 : 0.0;
            }
        }

        return createDataTexture(maskData, resolution);
    }

    /**
     * Update gradient with new data (FREE - real-time update)
     */
    async updateGradient(
        grid: GridCell[][],
        analysisType: 'solar' | 'shadow' | 'wind' | 'comfort',
        date: Date,
        weather: {
            temperature: number;
            windSpeed: number;
            windDirection: number;
            humidity: number;
            cloudCover: number;
        },
        bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
    ): Promise<THREE.Mesh> {
        // Compute environmental values (FREE physics)
        const values = await computeEnvironmentalGrid(
            grid,
            analysisType,
            date,
            weather
        );

        // Find value range for normalization
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < values.length; i++) {
            min = Math.min(min, values[i]);
            max = Math.max(max, values[i]);
        }
        this.lastRange = { min, max };

        // Create textures
        this.dataTexture = createDataTexture(values, this.options.resolution);
        this.buildingMaskTexture = this.createBuildingMask(grid);

        // Create or update material
        if (!this.material) {
            this.material = this.createMaterial(
                this.dataTexture,
                this.buildingMaskTexture,
                { min, max }
            );
        } else {
            this.material.uniforms.uDataTexture.value = this.dataTexture;
            this.material.uniforms.uBuildingMask.value = this.buildingMaskTexture;
            this.material.uniforms.uMinValue.value = min;
            this.material.uniforms.uMaxValue.value = max;
        }

        // Create or update mesh
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxZ - bounds.minZ;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        
        console.log('[Renderer] Gradient plane size:', { width, height, centerX, centerZ, bounds });
        
        if (!this.mesh) {
            const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
            this.mesh = new THREE.Mesh(geometry, this.material);
            this.mesh.rotation.x = -Math.PI / 2;
            this.mesh.position.set(centerX, 0.5, centerZ);
        } else {
            // Update existing mesh geometry and position
            this.mesh.geometry.dispose();
            this.mesh.geometry = new THREE.PlaneGeometry(width, height, 1, 1);
            this.mesh.position.set(centerX, 0.5, centerZ);
        }

        return this.mesh;
    }

    /**
     * Create wind vector overlay (FREE)
     */
    createWindVectors(
        grid: GridCell[][],
        weather: { windSpeed: number; windDirection: number },
        bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
    ): THREE.Mesh {
        const resolution = this.options.resolution;
        
        // Create speed and direction textures
        const speedData = new Float32Array(resolution * resolution);
        const directionData = new Float32Array(resolution * resolution);

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const cell = grid[y][x];
                const idx = y * resolution + x;
                
                // Use wind calculation (already in grid)
                speedData[idx] = cell.value;
                directionData[idx] = weather.windDirection * Math.PI / 180;
            }
        }

        const speedTexture = createDataTexture(speedData, resolution);
        const directionTexture = createDataTexture(directionData, resolution);

        const material = new THREE.ShaderMaterial({
            vertexShader: gradientVertexShader,
            fragmentShader: windVectorShader,
            uniforms: {
                uWindSpeed: { value: speedTexture },
                uWindDirection: { value: directionTexture },
                uResolution: { value: new THREE.Vector2(resolution, resolution) },
                uTime: { value: 0 },
                uArrowDensity: { value: 30 }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxZ - bounds.minZ;
        const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
        
        this.windVectorMesh = new THREE.Mesh(geometry, material);
        this.windVectorMesh.rotation.x = -Math.PI / 2;
        this.windVectorMesh.position.set(
            (bounds.minX + bounds.maxX) / 2,
            1.0, // Slightly above gradient
            (bounds.minZ + bounds.maxZ) / 2
        );

        return this.windVectorMesh;
    }

    /**
     * Animate (for bloom and wind vectors)
     */
    animate(time: number) {
        if (this.windVectorMesh) {
            const material = this.windVectorMesh.material as THREE.ShaderMaterial;
            material.uniforms.uTime.value = time;
        }
    }

    /**
     * Update options in real-time
     */
    updateOptions(options: Partial<GradientRendererOptions>) {
        Object.assign(this.options, options);
        
        if (this.material) {
            const colorSchemeMap = {
                'viridis': 0,
                'plasma': 1,
                'inferno': 2,
                'magma': 3
            };

            if (options.colorScheme) {
                this.material.uniforms.uColorScheme.value = colorSchemeMap[options.colorScheme];
            }
            if (options.smoothing !== undefined) {
                this.material.uniforms.uSmoothing.value = options.smoothing;
            }
            if (options.buildingFeather !== undefined) {
                this.material.uniforms.uBuildingFeather.value = options.buildingFeather;
            }
            if (options.bloomIntensity !== undefined) {
                this.material.uniforms.uBloomIntensity.value = options.bloomIntensity;
            }
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.material) {
                this.material.dispose();
            }
        }
        if (this.dataTexture) {
            this.dataTexture.dispose();
        }
        if (this.buildingMaskTexture) {
            this.buildingMaskTexture.dispose();
        }
        if (this.windVectorMesh) {
            this.windVectorMesh.geometry.dispose();
            (this.windVectorMesh.material as THREE.ShaderMaterial).dispose();
        }
    }
}

export default FreeGradientRenderer;
