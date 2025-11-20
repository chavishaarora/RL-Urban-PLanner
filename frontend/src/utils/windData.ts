// Prevailing wind directions for different regions and months
// Based on meteorological data for common wind patterns

export interface WindData {
    direction: number; // degrees (0 = North, 90 = East, 180 = South, 270 = West)
    speed: number; // m/s
    description: string;
}

/**
 * Get prevailing wind direction and speed based on location and month
 * @param latitude - Location latitude
 * @param longitude - Location longitude  
 * @param month - Month (1-12)
 * @returns Wind data with direction and speed
 */
export function getPrevailingWind(latitude: number, longitude: number, month: number): WindData {
    // Determine hemisphere and climate zone
    const isNorthernHemisphere = latitude > 0;
    const absLatitude = Math.abs(latitude);
    
    // Climate zones
    const isTropical = absLatitude < 23.5;
    const isSubtropical = absLatitude >= 23.5 && absLatitude < 35;
    const isTemperate = absLatitude >= 35 && absLatitude < 60;
    const isPolar = absLatitude >= 60;

    // Seasonal adjustment
    const isWinter = isNorthernHemisphere 
        ? (month >= 11 || month <= 2) 
        : (month >= 5 && month <= 8);
    const isSummer = isNorthernHemisphere 
        ? (month >= 5 && month <= 8) 
        : (month >= 11 || month <= 2);

    let direction = 270; // Default: West
    let speed = 3; // Default: 3 m/s
    let description = "Moderate westerly winds";

    // Tropical zone (Trade winds)
    if (isTropical) {
        if (isNorthernHemisphere) {
            direction = 90; // East (Northeast trades)
            speed = 5;
            description = "Northeast trade winds";
        } else {
            direction = 90; // East (Southeast trades)
            speed = 5;
            description = "Southeast trade winds";
        }
    }
    
    // Subtropical zone
    else if (isSubtropical) {
        if (isWinter) {
            // Winter: Polar winds from north/south
            direction = isNorthernHemisphere ? 0 : 180;
            speed = 4;
            description = isNorthernHemisphere ? "Northerly winter winds" : "Southerly winter winds";
        } else {
            // Summer: Sea breezes and monsoons
            if (longitude > -20 && longitude < 60) {
                // Asian monsoon region
                direction = isSummer ? 180 : 0;
                speed = 6;
                description = isSummer ? "Summer monsoon" : "Winter monsoon";
            } else {
                direction = 270; // Westerlies
                speed = 4;
                description = "Subtropical westerlies";
            }
        }
    }
    
    // Temperate zone (Prevailing Westerlies)
    else if (isTemperate) {
        direction = 270; // West
        speed = isWinter ? 6 : 4;
        description = isWinter ? "Strong westerly winter winds" : "Moderate westerlies";
        
        // Continental regions have more variable patterns
        if (Math.abs(longitude) > 20 && Math.abs(longitude) < 140) {
            // Continental interior
            if (isWinter) {
                direction = isNorthernHemisphere ? 315 : 135; // NW in NH, SE in SH
                speed = 5;
                description = "Continental winter winds";
            }
        }
        
        // Coastal regions
        if (Math.abs(longitude) < 20 || Math.abs(longitude) > 140) {
            // Atlantic/Pacific coasts
            speed = isWinter ? 7 : 5;
            description = isWinter ? "Strong coastal westerlies" : "Moderate sea breezes";
        }
    }
    
    // Polar zone (Polar Easterlies)
    else if (isPolar) {
        direction = 90; // East
        speed = isWinter ? 8 : 4;
        description = isWinter ? "Strong polar easterlies" : "Moderate polar winds";
    }

    // Add some monthly variation
    const monthlyVariation = Math.sin((month - 1) * Math.PI / 6) * 15; // ±15 degrees
    direction = (direction + monthlyVariation + 360) % 360;

    return {
        direction,
        speed,
        description
    };
}

/**
 * Get wind direction name from degrees
 */
export function getWindDirectionName(degrees: number): string {
    const normalized = ((degrees % 360) + 360) % 360;
    
    if (normalized >= 337.5 || normalized < 22.5) return "N";
    if (normalized >= 22.5 && normalized < 67.5) return "NE";
    if (normalized >= 67.5 && normalized < 112.5) return "E";
    if (normalized >= 112.5 && normalized < 157.5) return "SE";
    if (normalized >= 157.5 && normalized < 202.5) return "S";
    if (normalized >= 202.5 && normalized < 247.5) return "SW";
    if (normalized >= 247.5 && normalized < 292.5) return "W";
    if (normalized >= 292.5 && normalized < 337.5) return "NW";
    
    return "N";
}

// --- Accurate monthly wind rose utilities ---

export interface WindObservation {
    timestamp: string | number | Date; // ISO or Date
    directionDeg: number; // 0-360
    speed: number; // m/s
}

export interface MonthlyWindRoseComputed {
    speedBins: number[];
    directionLabels: string[];
    unit: 'hours' | 'percent';
    totalPerMonth?: number;
    months: {
        month: string;
        directionBins: { direction: string; speedFrequencies: number[] }[];
    }[];
}

/**
 * Compute a monthly wind rose from raw observations.
 * - directionSectors: number of compass sectors (default 16)
 * - speedBins: edges in m/s (e.g., [0,2,4,6,8,10,12])
 * - unit: 'hours' to return hours per bin, or 'percent' for percentage of month samples
 */
export function computeMonthlyWindRose(
    observations: WindObservation[],
    opts?: {
        directionSectors?: 8 | 16;
        speedBins?: number[];
        unit?: 'hours' | 'percent';
        tzOffsetMinutes?: number; // optional fixed offset for timestamps
    }
): MonthlyWindRoseComputed {
    const sectors = opts?.directionSectors ?? 16;
    const speedBins = (opts?.speedBins ?? [0,2,4,6,8,10,12,100]).slice();
    if (speedBins[speedBins.length - 1] < 100) speedBins.push(100);
    const unit = opts?.unit ?? 'percent';

    const sectorLabels = sectors === 16
        ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
        : ['N','NE','E','SE','S','SW','W','NW'];

    const sectorSize = 360 / sectors;
    const dirIndexFromDeg = (deg: number) => {
        const d = ((deg % 360) + 360) % 360;
        const i = Math.floor((d + sectorSize/2) / sectorSize) % sectors;
        return i;
    };

    const byMonth = new Map<number, number[][]>(); // month -> [dir][speedBin]
    const countsByMonth = new Map<number, number>();

    for (const obs of observations) {
        const t = obs.timestamp instanceof Date ? obs.timestamp : new Date(obs.timestamp);
        // optional timezone correction (basic)
        if (opts?.tzOffsetMinutes && opts.tzOffsetMinutes !== 0) {
            t.setMinutes(t.getMinutes() + opts.tzOffsetMinutes);
        }
        const month = t.getUTCMonth(); // 0-11
        const dirIdx = dirIndexFromDeg(obs.directionDeg);
        let speedIdx = speedBins.findIndex((edge, idx) => idx < speedBins.length - 1 && obs.speed >= edge && obs.speed < speedBins[idx+1]);
        if (speedIdx < 0) speedIdx = speedBins.length - 2;

        if (!byMonth.has(month)) {
            const matrix = Array.from({ length: sectors }, () => Array(speedBins.length - 1).fill(0));
            byMonth.set(month, matrix);
            countsByMonth.set(month, 0);
        }
        const matrix = byMonth.get(month)!;
        matrix[dirIdx][speedIdx] += 1;
        countsByMonth.set(month, (countsByMonth.get(month) || 0) + 1);
    }

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const months = monthNames.map((name, mIdx) => {
        const matrix = byMonth.get(mIdx) || Array.from({ length: sectors }, () => Array(speedBins.length - 1).fill(0));
        const total = countsByMonth.get(mIdx) || 0;
        const directionBins = matrix.map((row, dirIdx) => {
            const frequencies = unit === 'percent' && total > 0
                ? row.map(v => (v / total) * 100)
                : row.slice(); // raw counts (approx hours if hourly obs)
            return { direction: sectorLabels[dirIdx], speedFrequencies: frequencies };
        });
        return { month: name, directionBins };
    });

    return {
        speedBins,
        directionLabels: sectorLabels,
        unit,
        months,
    };
}
