// glTF/GLB Exporter for UrbanEyes 3D export
// Exports with proper scene hierarchy, materials, and organized layers
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Export scene to glTF/GLB format with organized hierarchy
 * @param {THREE.Scene} scene - The Three.js scene to export
 * @param {boolean} binary - True for GLB (binary), false for glTF (JSON + bin)
 * @returns {Promise<ArrayBuffer|Object>} - The exported glTF/GLB data
 */
export function exportToGLTF(scene, binary = true) {
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();

        const options = {
            binary: binary,
            trs: false, // Use matrices instead of separate translation/rotation/scale
            onlyVisible: true,
            truncateDrawRange: true,
            embedImages: true,
            maxTextureSize: 4096,
            animations: [],
            forceIndices: false,
            forcePowerOfTwoTextures: false,
        };

        exporter.parse(
            scene,
            (result) => {
                resolve(result);
            },
            (error) => {
                console.error('Error exporting glTF:', error);
                reject(error);
            },
            options
        );
    });
}

/**
 * Download glTF or GLB file
 * @param {ArrayBuffer|Object} gltfData - The glTF/GLB data
 * @param {boolean} binary - True for GLB, false for glTF
 * @param {string} filename - Output filename (without extension)
 */
export function downloadGLTF(gltfData, binary = true, filename = 'urbaneyes_model') {
    let blob, extension;

    if (binary) {
        // GLB format (binary)
        blob = new Blob([gltfData], { type: 'model/gltf-binary' });
        extension = 'glb';
    } else {
        // glTF format (JSON)
        const output = JSON.stringify(gltfData, null, 2);
        blob = new Blob([output], { type: 'application/json' });
        extension = 'gltf';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Organize scene into logical groups before export
 * Creates a clean hierarchy: ROOT > GROUPS > OBJECTS
 * @param {THREE.Scene} scene - The scene to organize
 * @returns {THREE.Group} - Organized root group
 */
export function organizeSceneForExport(scene) {
    const root = new THREE.Group();
    root.name = 'UrbanEyes_Model';

    // Create group containers
    const groups = {
        SITE_BOUNDARY: new THREE.Group(),
        USER_BUILDINGS: new THREE.Group(),
        LANDSCAPE: new THREE.Group(),
        GROUND_PLANE: new THREE.Group(),
        ROADS: new THREE.Group(),
        SURROUNDING: new THREE.Group(),
        OTHER: new THREE.Group(),
    };

    // Name the groups
    groups.SITE_BOUNDARY.name = 'Site_Boundary';
    groups.USER_BUILDINGS.name = 'User_Buildings';
    groups.LANDSCAPE.name = 'Landscape_Elements';
    groups.GROUND_PLANE.name = 'Ground_Plane';
    groups.ROADS.name = 'Road_Network';
    groups.SURROUNDING.name = 'Surrounding_Buildings';
    groups.OTHER.name = 'Other_Elements';

    // Helper function to determine which group an object belongs to
    function determineGroup(obj) {
        if (obj.name && obj.name.includes('SiteBoundary')) return 'SITE_BOUNDARY';
        if (obj.userData?.shapeId) return 'USER_BUILDINGS';
        if (obj.parent?.name && obj.parent.name.includes('ground')) return 'GROUND_PLANE';
        if (obj.geometry?.type === 'PlaneGeometry' && obj.position.y < 0) return 'GROUND_PLANE';

        // Landscape elements
        const landscapeTypes = ['tree', 'shrub', 'bench', 'kiosk', 'lamp', 'dustbin', 'playzone', 'bikeparking'];
        if (obj.userData?.objectType && landscapeTypes.includes(obj.userData.objectType)) {
            return 'LANDSCAPE';
        }

        // Roads/paths
        if (obj.userData?.objectType === 'path' || obj.name?.includes('road') || obj.name?.includes('stripe')) {
            return 'ROADS';
        }

        // Surrounding buildings
        if (obj.name?.includes('tile') || obj.name?.includes('building')) {
            return 'SURROUNDING';
        }

        return 'OTHER';
    }

    // Clone and organize all objects from the scene
    const objectsToOrganize = [];
    scene.traverse((child) => {
        if (child.isMesh || child.isLine || child.isLineSegments) {
            objectsToOrganize.push(child);
        }
    });

    // Add cloned objects to appropriate groups
    objectsToOrganize.forEach((obj) => {
        const groupName = determineGroup(obj);
        const clonedObj = obj.clone(true);

        // Apply world transformations to the clone
        obj.updateMatrixWorld(true);
        clonedObj.applyMatrix4(obj.matrixWorld);

        groups[groupName].add(clonedObj);
    });

    // Add non-empty groups to root
    Object.values(groups).forEach((group) => {
        if (group.children.length > 0) {
            root.add(group);
        }
    });

    return root;
}
