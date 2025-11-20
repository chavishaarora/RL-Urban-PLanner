import { PlanShape, LocationData } from '../types';

export interface DesignRecommendation {
    id: string;
    category: 'sustainability' | 'compliance' | 'solar' | 'accessibility' | 'safety' | 'efficiency' | 'community';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    actionable: boolean;
    suggestedAction?: string;
}

export interface DesignAnalysis {
    totalArea: number;
    buildingArea: number;
    greenArea: number;
    pathArea: number;
    parkingSpaces: number;
    buildingCount: number;
    greenCoverage: number;
    buildUpRatio: number;
}

export async function generateSmartRecommendations(
    shapes: PlanShape[],
    location: LocationData | null,
    apiKey: string
): Promise<DesignRecommendation[]> {
    
    // Analyze current design
    const analysis = analyzeDesign(shapes, location);
    
    // Build context for AI
    const context = buildDesignContext(analysis, location);
    
    // Call Gemini AI for intelligent recommendations
    const aiRecommendations = await getAIRecommendations(context, apiKey);
    
    // Combine with rule-based recommendations
    const ruleBasedRecommendations = getRuleBasedRecommendations(analysis, location);
    
    return [...aiRecommendations, ...ruleBasedRecommendations];
}

function analyzeDesign(shapes: PlanShape[], location: LocationData | null): DesignAnalysis {
    let totalArea = 0;
    let buildingArea = 0;
    let greenArea = 0;
    let pathArea = 0;
    let parkingSpaces = 0;
    let buildingCount = 0;

    // Calculate site boundary area
    if (location?.boundary && location.boundary.length > 0) {
        totalArea = calculatePolygonArea(location.boundary.map(p => ({ x: p.lng, y: p.lat })));
    }

    shapes.forEach(shape => {
        const area = calculateShapeArea(shape);
        
        if (shape.objectType === 'building' || shape.label?.includes('BHK')) {
            buildingArea += area;
            buildingCount++;
        } else if (shape.objectType === 'tree' || shape.objectType === 'shrub' || shape.objectType === 'playzone') {
            greenArea += area;
        } else if (shape.objectType === 'path') {
            pathArea += area;
        } else if (shape.objectType === 'bikeparking') {
            parkingSpaces += Math.floor(area / 2); // Rough estimate
        }
    });

    const greenCoverage = totalArea > 0 ? (greenArea / totalArea) * 100 : 0;
    const buildUpRatio = totalArea > 0 ? (buildingArea / totalArea) * 100 : 0;

    return {
        totalArea,
        buildingArea,
        greenArea,
        pathArea,
        parkingSpaces,
        buildingCount,
        greenCoverage,
        buildUpRatio
    };
}

function calculateShapeArea(shape: PlanShape): number {
    if (!shape.points || shape.points.length < 3) return 0;
    
    let area = 0;
    const points = shape.points;
    
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area / 2);
}

function calculatePolygonArea(points: { x: number; y: number }[]): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area / 2) * 111000 * 111000; // Rough conversion to m²
}

function buildDesignContext(analysis: DesignAnalysis, location: LocationData | null): string {
    const locationName = location?.address || 'Unknown Location';
    const lat = location?.boundary?.[0]?.lat || 0;
    const lng = location?.boundary?.[0]?.lng || 0;
    
    // Determine climate zone
    const climate = getClimateZone(lat);
    
    return `
URBAN DESIGN ANALYSIS REQUEST

Location: ${locationName}
Coordinates: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
Climate Zone: ${climate}

Current Design Metrics:
- Total Site Area: ${analysis.totalArea.toFixed(0)} m²
- Building Coverage: ${analysis.buildUpRatio.toFixed(1)}%
- Green Coverage: ${analysis.greenCoverage.toFixed(1)}%
- Number of Buildings: ${analysis.buildingCount}
- Building Area: ${analysis.buildingArea.toFixed(0)} m²
- Green Space: ${analysis.greenArea.toFixed(0)} m²
- Pathways: ${analysis.pathArea.toFixed(0)} m²
- Parking Spaces: ${analysis.parkingSpaces}

Please analyze this urban design proposal and provide 5-8 specific, actionable recommendations considering:

1. LOCAL BYLAWS & REGULATIONS:
   - Typical building codes for this region
   - FAR (Floor Area Ratio) requirements
   - Green space mandates
   - Parking requirements
   - Setback regulations

2. CLIMATE & ENVIRONMENTAL FACTORS:
   - Solar orientation for the ${climate} climate
   - Natural ventilation strategies
   - Water management (rainfall patterns)
   - Heat island effect mitigation
   - Sustainable design practices

3. SOCIAL & COMMUNITY NEEDS:
   - Accessibility (universal design)
   - Community gathering spaces
   - Safety and visibility
   - Pedestrian connectivity
   - Age-friendly design

4. FUTURE-PROOFING:
   - Climate change adaptation
   - Flexibility for future modifications
   - Technology integration readiness
   - Population growth considerations

5. DESIGN EXCELLENCE:
   - Aesthetic quality
   - Spatial efficiency
   - Connection to context
   - Human scale and proportions

Format each recommendation as:
CATEGORY: [sustainability/compliance/solar/accessibility/safety/efficiency/community]
PRIORITY: [high/medium/low]
TITLE: [Brief action-oriented title]
DESCRIPTION: [Detailed explanation]
IMPACT: [Expected positive outcome]
ACTION: [Specific steps to implement]

Focus on practical, measurable improvements that respect local context and best practices.
`;
}

function getClimateZone(latitude: number): string {
    const absLat = Math.abs(latitude);
    
    if (absLat < 15) return 'Tropical';
    if (absLat < 35) return 'Subtropical/Mediterranean';
    if (absLat < 50) return 'Temperate';
    if (absLat < 66.5) return 'Continental';
    return 'Polar';
}

async function getAIRecommendations(context: string, apiKey: string): Promise<DesignRecommendation[]> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: context }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    }
                })
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        return parseAIRecommendations(text);
    } catch (error) {
        console.error('AI Recommendations Error:', error);
        return [];
    }
}

function parseAIRecommendations(text: string): DesignRecommendation[] {
    const recommendations: DesignRecommendation[] = [];
    const blocks = text.split(/(?=CATEGORY:)/gi);
    
    blocks.forEach((block, index) => {
        const categoryMatch = block.match(/CATEGORY:\s*\[?([^\]\n]+)\]?/i);
        const priorityMatch = block.match(/PRIORITY:\s*\[?([^\]\n]+)\]?/i);
        const titleMatch = block.match(/TITLE:\s*\[?([^\]\n]+)\]?/i);
        const descriptionMatch = block.match(/DESCRIPTION:\s*\[?([^\]\n]+)\]?/i);
        const impactMatch = block.match(/IMPACT:\s*\[?([^\]\n]+)\]?/i);
        const actionMatch = block.match(/ACTION:\s*\[?([^\]\n]+)\]?/i);
        
        if (categoryMatch && titleMatch) {
            recommendations.push({
                id: `ai-rec-${index}`,
                category: categoryMatch[1].trim().toLowerCase() as any || 'efficiency',
                priority: priorityMatch?.[1].trim().toLowerCase() as any || 'medium',
                title: titleMatch[1].trim(),
                description: descriptionMatch?.[1].trim() || '',
                impact: impactMatch?.[1].trim() || '',
                actionable: true,
                suggestedAction: actionMatch?.[1].trim()
            });
        }
    });
    
    return recommendations;
}

function getRuleBasedRecommendations(analysis: DesignAnalysis, location: LocationData | null): DesignRecommendation[] {
    const recommendations: DesignRecommendation[] = [];
    
    // Green space recommendations
    if (analysis.greenCoverage < 20) {
        const deficit = 20 - analysis.greenCoverage;
        recommendations.push({
            id: 'rule-green-1',
            category: 'sustainability',
            priority: 'high',
            title: `Increase green coverage by ${deficit.toFixed(1)}%`,
            description: `Current green space is ${analysis.greenCoverage.toFixed(1)}%, below the recommended 20% minimum for sustainable urban development.`,
            impact: 'Improves air quality, reduces heat island effect, enhances biodiversity, and provides community wellness benefits.',
            actionable: true,
            suggestedAction: `Add approximately ${(analysis.totalArea * deficit / 100).toFixed(0)} m² of green space through rooftop gardens, additional trees, or green corridors.`
        });
    }
    
    // Building coverage check
    if (analysis.buildUpRatio > 40) {
        recommendations.push({
            id: 'rule-coverage-1',
            category: 'compliance',
            priority: 'high',
            title: 'Building coverage exceeds typical limits',
            description: `Current building coverage is ${analysis.buildUpRatio.toFixed(1)}%, which may exceed local zoning regulations (typically 30-40%).`,
            impact: 'Ensures regulatory compliance, improves open space, reduces urban density stress.',
            actionable: true,
            suggestedAction: 'Consider reducing building footprint or increasing site area to meet compliance standards.'
        });
    }
    
    // Parking assessment
    if (analysis.parkingSpaces < analysis.buildingCount * 1.5) {
        recommendations.push({
            id: 'rule-parking-1',
            category: 'efficiency',
            priority: 'medium',
            title: 'Insufficient parking provision',
            description: `Current design has approximately ${analysis.parkingSpaces} parking spaces for ${analysis.buildingCount} buildings.`,
            impact: 'Prevents street congestion, ensures resident convenience, meets municipal requirements.',
            actionable: true,
            suggestedAction: `Add ${Math.ceil(analysis.buildingCount * 1.5 - analysis.parkingSpaces)} additional parking spaces or consider shared parking strategies.`
        });
    }
    
    return recommendations;
}
