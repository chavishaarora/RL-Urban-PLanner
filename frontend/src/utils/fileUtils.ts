// Define an interface for the return type
interface Base64Result {
    base64: string;
    mimeType: string;
}

// Generic base64 encoder for any file type (like PDFs)
export const fileToBase64 = (file: File): Promise<Base64Result> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64String = dataUrl.split(',')[1];
            resolve({ base64: base64String, mimeType: file.type });
        };
        reader.onerror = (error) => reject(error);
    });
};


const MAX_IMAGE_DIMENSION = 1024; // Set a max dimension for images

// Specific image processor for Gemini (resizes and converts to JPEG)
export const processImageForGemini = (file: File): Promise<Base64Result> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Calculate the new dimensions to maintain aspect ratio
                if (width > height) {
                    if (width > MAX_IMAGE_DIMENSION) {
                        height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
                        width = MAX_IMAGE_DIMENSION;
                    }
                } else {
                    if (height > MAX_IMAGE_DIMENSION) {
                        width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
                        height = MAX_IMAGE_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert the canvas content to a JPEG data URL
                const mimeType = 'image/jpeg';
                const dataUrl = canvas.toDataURL(mimeType, 0.9); // Use 90% quality
                
                // Extract the base64 part from the data URL
                const base64String = dataUrl.split(',')[1];
                resolve({ base64: base64String, mimeType });
            };
            img.onerror = (error) => {
                console.error("Image failed to load into Image object", error);
                reject(error);
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

// ---- Project Export / Import Helpers ----

// Schema versioning for forward compatibility
export const PROJECT_SCHEMA_VERSION = 2;

// Shape of the exported file (lightweight wrapper around ProjectData)
export interface ExportedProject<T=any> {
    schemaVersion: number;
    exportedAt: string;
    app: {
        name: string; // "UrbanEyes"
        build?: string; // optional build hash
    };
    project: T; // Raw ProjectData object
}

// Serialize a project object to a downloadable JSON Blob and trigger save
export const downloadProjectAsJson = (project: any, fileName?: string, opts?: { compress?: boolean; warnIfLargeMb?: number }) => {
    if (!project) return;
    const payload: ExportedProject = {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        app: { name: 'UrbanEyes' },
        project
    };
    const json = JSON.stringify(payload, null, 2);
    const sizeBytes = new Blob([json]).size;
    const warnMb = opts?.warnIfLargeMb ?? 5;
    if (sizeBytes > warnMb * 1024 * 1024) {
        const proceed = confirm(`This project file is ${(sizeBytes/1024/1024).toFixed(2)} MB. Do you want to continue${opts?.compress ? ' with compression' : ''}?`);
        if (!proceed) return;
    }

    if (opts?.compress) {
        // Dynamic import for compression to avoid bundle bloat if unused
        import('pako').then(pako => {
            const gzipData: Uint8Array = pako.gzip(json);
            // Create a new Uint8Array copy referencing only the needed bytes to avoid SharedArrayBuffer issues
            const cleanBuffer = new Uint8Array(gzipData); // ensures standard ArrayBuffer
            const blob = new Blob([cleanBuffer], { type: 'application/gzip' });
            triggerDownload(blob, `${fileName || project.name || 'urbaneyes-project'}.urbaneyes.json.gz`);
        }).catch(() => {
            // Fallback to plain JSON if compression fails
            const blob = new Blob([json], { type: 'application/json' });
            triggerDownload(blob, `${fileName || project.name || 'urbaneyes-project'}.urbaneyes.json`);
        });
    } else {
        const blob = new Blob([json], { type: 'application/json' });
        triggerDownload(blob, `${fileName || project.name || 'urbaneyes-project'}.urbaneyes.json`);
    }
};

const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Read an uploaded JSON file and parse into an ExportedProject
export const importProjectFromFile = (file: File): Promise<ExportedProject> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                // Try to parse JSON; if gzipped binary slipped through, surface error clearly
                const parsed = JSON.parse(text);
                if (!parsed.project || !parsed.schemaVersion) {
                    return reject(new Error('Invalid project file: missing required fields'));
                }
                resolve(parsed as ExportedProject);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// Basic validator to ensure minimal ProjectData structure (non-exhaustive)
export const validateImportedProject = (data: any): string[] => {
    const errors: string[] = [];
    if (!data) { errors.push('No data provided'); return errors; }
    if (!data.id) errors.push('Missing project id');
    if (!data.name) errors.push('Missing project name');
    if (!Array.isArray(data.analysisResult)) errors.push('analysisResult should be an array');
    // Optional fields can be skipped; add more as needed
    return errors;
};

// --- Schema migration ---
// Migrate older exported projects to the current schema version.
export const migrateProjectIfNeeded = (exported: ExportedProject): ExportedProject => {
    let { schemaVersion } = exported;
    let project = exported.project as any;

    // Example migration path from v1 -> v2
    if (schemaVersion === 1) {
        // v2 adds no breaking fields in this pass, but this is the hook to transform
        // e.g., ensure dashboardDisplayImage default
        if (!project.dashboardDisplayImage) project.dashboardDisplayImage = 'site';
        schemaVersion = 2;
    }

    return { ...exported, schemaVersion, project };
};
