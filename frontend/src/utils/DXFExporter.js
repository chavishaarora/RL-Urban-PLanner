// DXF Exporter for UrbanEyes 2D CAD Export
// Exports scaled 2D drawings compatible with AutoCAD, QCAD, LibreCAD, etc.

/**
 * Converts UrbanEyes shapes to DXF format with real-world coordinates
 * @param {Array} shapes - Array of PlanShape objects
 * @param {Object} location - Location data with boundary
 * @param {string} projectName - Name of the project
 * @returns {string} DXF file content
 */
export function exportToDXF(shapes, location, projectName = 'UrbanEyes_Project') {
    const dxf = [];

    // DXF Header Section
    dxf.push('0');
    dxf.push('SECTION');
    dxf.push('2');
    dxf.push('HEADER');
    dxf.push('9');
    dxf.push('$ACADVER');
    dxf.push('1');
    dxf.push('AC1015'); // AutoCAD 2000 format
    dxf.push('9');
    dxf.push('$INSUNITS');
    dxf.push('70');
    dxf.push('6'); // Units: meters
    dxf.push('0');
    dxf.push('ENDSEC');

    // Tables Section (Layers)
    dxf.push('0');
    dxf.push('SECTION');
    dxf.push('2');
    dxf.push('TABLES');

    // Layer Table
    dxf.push('0');
    dxf.push('TABLE');
    dxf.push('2');
    dxf.push('LAYER');
    dxf.push('70');
    dxf.push('10'); // Max number of layers

    // Define layers
    const layers = [
        { name: 'SITE_BOUNDARY', color: 1 }, // Red
        { name: 'SETBACK', color: 4 }, // Cyan
        { name: 'BUILDINGS', color: 5 }, // Blue
        { name: 'RESIDENTIAL', color: 6 }, // Magenta
        { name: 'COMMERCIAL', color: 3 }, // Green
        { name: 'LANDSCAPE', color: 2 }, // Yellow
        { name: 'CIRCULATION', color: 8 }, // Dark Gray
        { name: 'AMENITIES', color: 7 }, // White
        { name: 'LABELS', color: 7 } // White
    ];

    layers.forEach(layer => {
        dxf.push('0');
        dxf.push('LAYER');
        dxf.push('2');
        dxf.push(layer.name);
        dxf.push('70');
        dxf.push('0');
        dxf.push('62');
        dxf.push(layer.color.toString());
        dxf.push('6');
        dxf.push('CONTINUOUS');
    });

    dxf.push('0');
    dxf.push('ENDTAB');
    dxf.push('0');
    dxf.push('ENDSEC');

    // Entities Section
    dxf.push('0');
    dxf.push('SECTION');
    dxf.push('2');
    dxf.push('ENTITIES');

    // Add title text
    dxf.push('0');
    dxf.push('TEXT');
    dxf.push('8');
    dxf.push('LABELS');
    dxf.push('10');
    dxf.push('0.0'); // X
    dxf.push('20');
    dxf.push('0.0'); // Y
    dxf.push('40');
    dxf.push('5.0'); // Text height
    dxf.push('1');
    dxf.push(`${projectName} - UrbanEyes Export`);

    // Export Site Boundary
    if (location?.boundary && location.boundary.length > 0) {
        const boundary = location.boundary;

        // Convert lat/lng to local meters (same as 3D viewer)
        const R = 6371000; // Earth radius in meters
        const minLat = Math.min(...boundary.map(p => p.lat));
        const minLng = Math.min(...boundary.map(p => p.lng));

        const localBoundary = boundary.map(p => {
            const dx = (p.lng - minLng) * Math.cos((minLat * Math.PI) / 180) * (Math.PI / 180) * R;
            const dy = (p.lat - minLat) * (Math.PI / 180) * R;
            return { x: dx, y: dy };
        });

        // Draw boundary as POLYLINE
        dxf.push('0');
        dxf.push('LWPOLYLINE');
        dxf.push('8');
        dxf.push('SITE_BOUNDARY');
        dxf.push('90');
        dxf.push(localBoundary.length.toString());
        dxf.push('70');
        dxf.push('1'); // Closed polyline

        localBoundary.forEach(point => {
            dxf.push('10');
            dxf.push(point.x.toFixed(3));
            dxf.push('20');
            dxf.push(point.y.toFixed(3));
        });
    }

    // Export all shapes
    shapes.forEach((shape, index) => {
        if (!shape.points || shape.points.length < 2) return;

        // Determine layer based on category
        let layer = 'BUILDINGS';
        if (shape.category === 'Setback') {
            layer = 'SETBACK';
        } else if (shape.category === 'Residential') {
            layer = 'RESIDENTIAL';
        } else if (shape.category === 'Commercial') {
            layer = 'COMMERCIAL';
        } else if (shape.category === 'Circulation') {
            layer = 'CIRCULATION';
        } else if (shape.objectType && ['tree', 'shrub', 'bench', 'playzone'].includes(shape.objectType)) {
            layer = 'LANDSCAPE';
        } else if (shape.objectType && ['kiosk', 'lamp', 'dustbin'].includes(shape.objectType)) {
            layer = 'AMENITIES';
        }

        // Draw shape as LWPOLYLINE
        dxf.push('0');
        dxf.push('LWPOLYLINE');
        dxf.push('8');
        dxf.push(layer);
        dxf.push('90');
        dxf.push(shape.points.length.toString());
        dxf.push('70');
        dxf.push('1'); // Closed polyline

        shape.points.forEach(point => {
            dxf.push('10');
            dxf.push(point.x.toFixed(3));
            dxf.push('20');
            dxf.push(point.y.toFixed(3));
        });

        // Add label as TEXT if present
        if (shape.label) {
            // Calculate center point
            const centerX = shape.points.reduce((sum, p) => sum + p.x, 0) / shape.points.length;
            const centerY = shape.points.reduce((sum, p) => sum + p.y, 0) / shape.points.length;

            dxf.push('0');
            dxf.push('TEXT');
            dxf.push('8');
            dxf.push('LABELS');
            dxf.push('10');
            dxf.push(centerX.toFixed(3));
            dxf.push('20');
            dxf.push(centerY.toFixed(3));
            dxf.push('40');
            dxf.push('2.0'); // Text height in meters
            dxf.push('1');
            dxf.push(shape.label);

            // Add area info if available
            if (shape.floors) {
                dxf.push('0');
                dxf.push('TEXT');
                dxf.push('8');
                dxf.push('LABELS');
                dxf.push('10');
                dxf.push(centerX.toFixed(3));
                dxf.push('20');
                dxf.push((centerY - 3).toFixed(3));
                dxf.push('40');
                dxf.push('1.5');
                dxf.push('1');
                dxf.push(`${shape.floors} floors`);
            }
        }
    });

    // End Section
    dxf.push('0');
    dxf.push('ENDSEC');

    // End of File
    dxf.push('0');
    dxf.push('EOF');

    return dxf.join('\n');
}

/**
 * Downloads DXF file to user's computer
 * @param {string} dxfContent - DXF file content
 * @param {string} filename - Output filename
 */
export function downloadDXF(dxfContent, filename = 'urbaneyes_plan.dxf') {
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
