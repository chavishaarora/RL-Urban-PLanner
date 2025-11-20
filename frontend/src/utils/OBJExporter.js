// OBJ/MTL Exporter for UrbanEyes 3D export
// Exports scene to Wavefront OBJ format with material library (MTL)
import * as THREE from 'three';

/**
 * Export scene to OBJ format with MTL material library
 * @param {THREE.Scene} scene - The Three.js scene to export
 * @param {Object} options - Export options
 * @returns {Object} - { obj: string, mtl: string } containing OBJ and MTL file contents
 */
export function exportToOBJ(scene, options = {}) {
    const {
        includeNormals = true,
        includeUVs = true,
        onlyVisible = true,
        precision = 6,
    } = options;

    let vertexIndex = 1; // OBJ indices start at 1
    let normalIndex = 1;
    let uvIndex = 1;

    let objOutput = '# UrbanEyes 3D Model Export\n';
    objOutput += '# Exported from UrbanEyes v5.0\n';
    objOutput += `# Date: ${new Date().toISOString()}\n\n`;
    objOutput += 'mtllib urbaneyes_model.mtl\n\n';

    let mtlOutput = '# UrbanEyes Material Library\n';
    mtlOutput += '# Exported from UrbanEyes v5.0\n\n';

    const materials = new Map();
    const groups = organizeSceneForOBJ(scene);

    // Process each group
    groups.forEach((group) => {
        objOutput += `\n# Group: ${group.name}\n`;
        objOutput += `g ${group.name}\n\n`;

        group.objects.forEach((obj, objIdx) => {
            if (onlyVisible && !obj.visible) return;
            if (!obj.geometry) return;

            const geometry = obj.geometry;
            const matrix = obj.matrixWorld;

            // Generate unique material name
            const materialName = generateMaterialName(obj, group.name, objIdx);

            // Export material if not already exported
            if (!materials.has(materialName)) {
                mtlOutput += exportMaterial(obj.material, materialName);
                materials.set(materialName, true);
            }

            objOutput += `# Object: ${obj.name || 'unnamed'}\n`;
            objOutput += `o ${obj.name || `object_${objIdx}`}\n`;
            objOutput += `usemtl ${materialName}\n`;

            // Get position attribute
            const positionAttr = geometry.attributes.position;
            const normalAttr = geometry.attributes.normal;
            const uvAttr = geometry.attributes.uv;

            if (!positionAttr) return;

            const vertices = [];
            const normals = [];
            const uvs = [];

            // Extract vertices
            for (let i = 0; i < positionAttr.count; i++) {
                const vertex = new THREE.Vector3(
                    positionAttr.getX(i),
                    positionAttr.getY(i),
                    positionAttr.getZ(i)
                );
                vertex.applyMatrix4(matrix);
                vertices.push(vertex);
            }

            // Extract normals
            if (includeNormals && normalAttr) {
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
                for (let i = 0; i < normalAttr.count; i++) {
                    const normal = new THREE.Vector3(
                        normalAttr.getX(i),
                        normalAttr.getY(i),
                        normalAttr.getZ(i)
                    );
                    normal.applyMatrix3(normalMatrix).normalize();
                    normals.push(normal);
                }
            }

            // Extract UVs
            if (includeUVs && uvAttr) {
                for (let i = 0; i < uvAttr.count; i++) {
                    const uv = new THREE.Vector2(
                        uvAttr.getX(i),
                        uvAttr.getY(i)
                    );
                    uvs.push(uv);
                }
            }

            // Write vertices
            vertices.forEach(v => {
                objOutput += `v ${v.x.toFixed(precision)} ${v.y.toFixed(precision)} ${v.z.toFixed(precision)}\n`;
            });

            // Write normals
            if (includeNormals && normals.length > 0) {
                normals.forEach(n => {
                    objOutput += `vn ${n.x.toFixed(precision)} ${n.y.toFixed(precision)} ${n.z.toFixed(precision)}\n`;
                });
            }

            // Write UVs
            if (includeUVs && uvs.length > 0) {
                uvs.forEach(uv => {
                    objOutput += `vt ${uv.x.toFixed(precision)} ${uv.y.toFixed(precision)}\n`;
                });
            }

            // Write faces
            const indexAttr = geometry.index;
            const hasIndex = indexAttr !== null;
            const faceCount = hasIndex ? indexAttr.count / 3 : positionAttr.count / 3;

            for (let i = 0; i < faceCount; i++) {
                const i1 = hasIndex ? indexAttr.getX(i * 3) : i * 3;
                const i2 = hasIndex ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
                const i3 = hasIndex ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

                const v1 = vertexIndex + i1;
                const v2 = vertexIndex + i2;
                const v3 = vertexIndex + i3;

                if (includeNormals && normals.length > 0 && includeUVs && uvs.length > 0) {
                    const n1 = normalIndex + i1;
                    const n2 = normalIndex + i2;
                    const n3 = normalIndex + i3;
                    const t1 = uvIndex + i1;
                    const t2 = uvIndex + i2;
                    const t3 = uvIndex + i3;
                    objOutput += `f ${v1}/${t1}/${n1} ${v2}/${t2}/${n2} ${v3}/${t3}/${n3}\n`;
                } else if (includeNormals && normals.length > 0) {
                    const n1 = normalIndex + i1;
                    const n2 = normalIndex + i2;
                    const n3 = normalIndex + i3;
                    objOutput += `f ${v1}//${n1} ${v2}//${n2} ${v3}//${n3}\n`;
                } else if (includeUVs && uvs.length > 0) {
                    const t1 = uvIndex + i1;
                    const t2 = uvIndex + i2;
                    const t3 = uvIndex + i3;
                    objOutput += `f ${v1}/${t1} ${v2}/${t2} ${v3}/${t3}\n`;
                } else {
                    objOutput += `f ${v1} ${v2} ${v3}\n`;
                }
            }

            objOutput += '\n';

            // Update indices
            vertexIndex += vertices.length;
            normalIndex += normals.length;
            uvIndex += uvs.length;
        });
    });

    return { obj: objOutput, mtl: mtlOutput };
}

/**
 * Generate unique material name for object
 */
function generateMaterialName(obj, groupName, index) {
    const baseName = groupName.replace(/\s+/g, '_');
    const objType = obj.userData?.objectType || obj.userData?.shapeId || 'material';
    return `${baseName}_${objType}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Export material to MTL format
 */
function exportMaterial(material, name) {
    let mtl = `\nnewmtl ${name}\n`;

    if (material.isMeshStandardMaterial || material.isMeshPhongMaterial) {
        const color = material.color || new THREE.Color(0.8, 0.8, 0.8);
        mtl += `Kd ${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)}\n`;

        if (material.emissive) {
            const emissive = material.emissive;
            const intensity = material.emissiveIntensity || 1.0;
            mtl += `Ke ${(emissive.r * intensity).toFixed(3)} ${(emissive.g * intensity).toFixed(3)} ${(emissive.b * intensity).toFixed(3)}\n`;
        }

        if (material.specular) {
            const specular = material.specular;
            mtl += `Ks ${specular.r.toFixed(3)} ${specular.g.toFixed(3)} ${specular.b.toFixed(3)}\n`;
        }

        // Roughness to shininess conversion
        if (material.roughness !== undefined) {
            const shininess = (1 - material.roughness) * 100;
            mtl += `Ns ${shininess.toFixed(1)}\n`;
        }

        // Transparency
        if (material.transparent && material.opacity !== undefined) {
            mtl += `d ${material.opacity.toFixed(3)}\n`;
        }
    } else if (material.isMeshBasicMaterial) {
        const color = material.color || new THREE.Color(0.8, 0.8, 0.8);
        mtl += `Kd ${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)}\n`;
    } else if (material.isLineBasicMaterial) {
        const color = material.color || new THREE.Color(0.0, 0.0, 0.0);
        mtl += `Kd ${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)}\n`;
    }

    // Default ambient
    mtl += `Ka 0.2 0.2 0.2\n`;
    mtl += `illum 2\n`;

    return mtl;
}

/**
 * Organize scene into logical groups for OBJ export
 */
function organizeSceneForOBJ(scene) {
    const groups = [
        { name: 'Site_Boundary', objects: [] },
        { name: 'User_Buildings', objects: [] },
        { name: 'Landscape_Elements', objects: [] },
        { name: 'Roads_and_Paths', objects: [] },
        { name: 'Ground_Plane', objects: [] },
        { name: 'Surrounding_Buildings', objects: [] },
        { name: 'Other_Elements', objects: [] },
    ];

    const groupMap = {
        'Site_Boundary': groups[0],
        'User_Buildings': groups[1],
        'Landscape_Elements': groups[2],
        'Roads_and_Paths': groups[3],
        'Ground_Plane': groups[4],
        'Surrounding_Buildings': groups[5],
        'Other_Elements': groups[6],
    };

    // Helper to determine which group an object belongs to
    function determineGroup(obj) {
        if (obj.name?.includes('SiteBoundary') || obj.name?.includes('boundary')) return 'Site_Boundary';

        if (obj.userData?.shapeId) return 'User_Buildings';

        const landscapeTypes = ['tree', 'shrub', 'bench', 'kiosk', 'lamp', 'dustbin', 'playzone', 'bikeparking'];
        if (obj.userData?.objectType && landscapeTypes.includes(obj.userData.objectType)) {
            return 'Landscape_Elements';
        }

        if (obj.userData?.objectType === 'path' || obj.name?.includes('road') || obj.name?.includes('stripe')) {
            return 'Roads_and_Paths';
        }

        if (obj.geometry?.type === 'PlaneGeometry' && obj.position.y <= 0) return 'Ground_Plane';

        if (obj.name?.includes('tile') || obj.name?.includes('building')) {
            return 'Surrounding_Buildings';
        }

        return 'Other_Elements';
    }

    // Collect all meshes and lines from scene
    scene.traverse((child) => {
        if (child.isMesh || child.isLine || child.isLineSegments) {
            const groupName = determineGroup(child);
            const group = groupMap[groupName];
            if (group) {
                group.objects.push(child);
            }
        }
    });

    // Filter out empty groups
    return groups.filter(g => g.objects.length > 0);
}

/**
 * Download OBJ and MTL files as a ZIP or separately
 * @param {Object} data - { obj, mtl } from exportToOBJ
 * @param {string} filename - Base filename without extension
 */
export function downloadOBJ(data, filename = 'urbaneyes_model') {
    // Download OBJ file
    const objBlob = new Blob([data.obj], { type: 'text/plain' });
    const objUrl = URL.createObjectURL(objBlob);
    const objLink = document.createElement('a');
    objLink.href = objUrl;
    objLink.download = `${filename}.obj`;
    document.body.appendChild(objLink);
    objLink.click();
    document.body.removeChild(objLink);
    URL.revokeObjectURL(objUrl);

    // Download MTL file
    setTimeout(() => {
        const mtlBlob = new Blob([data.mtl], { type: 'text/plain' });
        const mtlUrl = URL.createObjectURL(mtlBlob);
        const mtlLink = document.createElement('a');
        mtlLink.href = mtlUrl;
        mtlLink.download = `${filename}.mtl`;
        document.body.appendChild(mtlLink);
        mtlLink.click();
        document.body.removeChild(mtlLink);
        URL.revokeObjectURL(mtlUrl);
    }, 100);
}

/**
 * Export only user-created content (buildings, roads, landscape)
 */
export function exportUserContentOnly(scene, options = {}) {
    const tempScene = new THREE.Scene();

    scene.traverse((child) => {
        if (child.isMesh || child.isLine || child.isLineSegments) {
            // Only include user-created content
            if (child.userData?.shapeId ||
                child.userData?.objectType === 'path' ||
                child.name?.includes('SiteBoundary')) {
                const cloned = child.clone(true);
                cloned.updateMatrixWorld(true);
                tempScene.add(cloned);
            }
        }
    });

    return exportToOBJ(tempScene, options);
}

/**
 * Export complete scene including surroundings
 */
export function exportCompleteScene(scene, options = {}) {
    return exportToOBJ(scene, options);
}
