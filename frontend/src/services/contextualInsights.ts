import { GoogleGenAI } from "@google/genai";
import { QuantitativeData, LocationData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ContextualInsight {
    category: string;
    title: string;
    summary: string;
    impact: string;
    designConsiderations: string[];
    strategicRecommendations: string[];
    keyMetrics: {
        label: string;
        value: string | number;
        unit?: string;
        trend?: 'positive' | 'negative' | 'neutral';
        context: string;
    }[];
    visualizations: {
        type: 'chart' | 'graph' | 'heatmap' | 'comparison';
        data: any;
        title: string;
        description: string;
    }[];
    caseStudies?: {
        project: string;
        location: string;
        strategy: string;
        outcome: string;
    }[];
    factChecks: {
        fact: string;
        source: string;
    }[];
}

export async function generateContextualInsight(
    category: string,
    quantitativeData: QuantitativeData,
    projectType: string,
    templateName?: string,
    templateDescription?: string
): Promise<ContextualInsight> {
    try {
        const model = 'gemini-2.5-pro';
        
        const categoryMapping: Record<string, string> = {
            'demographics': 'Demographics & Population',
            'landuse': 'Land Use & Urban Fabric',
            'climate': 'Climate & Environmental Conditions',
            'mobility': 'Mobility & Accessibility',
            'economy': 'Economic & Social Context',
            'regulations': 'Regulations & Planning Controls'
        };

        const displayCategory = categoryMapping[category.toLowerCase()] || category;
        
        // Extract relevant data based on category
        let relevantData: any = {};
        
        switch(category.toLowerCase()) {
            case 'demographics':
                relevantData = {
                    ageDemographics: quantitativeData.ageDemographics,
                    potentialVisitors: quantitativeData.potentialVisitors,
                    populationDensity: quantitativeData.populationDensity,
                    householdSize: quantitativeData.householdSize,
                    educationIndex: quantitativeData.educationIndex,
                    diversityMigrationIndex: quantitativeData.diversityMigrationIndex,
                    annualGrowthRate: quantitativeData.annualGrowthRate
                };
                break;
            case 'landuse':
                relevantData = {
                    landUse: quantitativeData.landUse,
                    greenSpaceRatio: quantitativeData.greenSpaceRatio,
                    constructionStyle: quantitativeData.constructionStyle,
                    constructionMaterials: quantitativeData.constructionMaterials,
                    buildingDensity: quantitativeData.landUse,
                    proximityAnalysis: quantitativeData.proximityAnalysis
                };
                break;
            case 'climate':
                relevantData = {
                    monthlyTemperatures: quantitativeData.monthlyTemperatures,
                    monthlyRainfall: quantitativeData.monthlyRainfall,
                    monthlyWinds: quantitativeData.monthlyWinds,
                    monthlyHumidity: quantitativeData.monthlyHumidity,
                    solarRadiation: quantitativeData.solarRadiation,
                    outdoorComfortHours: quantitativeData.outdoorComfortHours,
                    treeCanopyCoverage: quantitativeData.treeCanopyCoverage,
                    airQualityPM25: quantitativeData.airQualityPM25,
                    airQualityNO2: quantitativeData.airQualityNO2
                };
                break;
            case 'mobility':
                relevantData = {
                    publicTransportAccess: quantitativeData.publicTransportAccess,
                    transitFrequency: quantitativeData.transitFrequency,
                    walkabilityScore: quantitativeData.walkabilityScore,
                    cyclingInfrastructureDensity: quantitativeData.cyclingInfrastructureDensity,
                    fifteenMinuteCityIndex: quantitativeData.fifteenMinuteCityIndex,
                    parkingRatio: quantitativeData.parkingRatio,
                    connectivityScore: quantitativeData.connectivityScore,
                    proximityAnalysis: quantitativeData.proximityAnalysis?.filter(p => 
                        p.category === 'Transit' || p.category === 'Transport' || p.category === 'Parking'
                    )
                };
                break;
            case 'economy':
                relevantData = {
                    averageIncome: quantitativeData.averageIncome,
                    averageIncomeNumeric: quantitativeData.averageIncomeNumeric,
                    medianRent: quantitativeData.medianRent,
                    medianPropertyPrice: quantitativeData.medianPropertyPrice,
                    landValueIndex: quantitativeData.landValueIndex,
                    employmentSectorSplit: quantitativeData.employmentSectorSplit,
                    nearbyPOIs: quantitativeData.nearbyPOIs,
                    amenityBreakdown: quantitativeData.amenityBreakdown
                };
                break;
            case 'regulations':
                relevantData = {
                    zoningFAR: quantitativeData.zoningFAR,
                    setbackLimits: quantitativeData.setbackLimits,
                    heightLimit: quantitativeData.heightLimit,
                    imperviousSurfaceRatio: quantitativeData.imperviousSurfaceRatio,
                    permitProcessingTime: quantitativeData.permitProcessingTime,
                    permitFees: quantitativeData.permitFees,
                    floodRisk: quantitativeData.floodRisk,
                    noiseLevel: quantitativeData.noiseLevel
                };
                break;
        }

        const prompt = `
You are a world-class urban planning consultant providing hyper-tailored, contextual insights for a ${projectType} project${templateName ? ` using the "${templateName}" design template` : ''}.

**Location Context:**
- Site: ${quantitativeData.location?.name || 'Unknown'}
- Coordinates: ${quantitativeData.location?.latitude || 0}°N, ${quantitativeData.location?.longitude || 0}°E

${templateName ? `**Design Template:** ${templateName}
${templateDescription || ''}
` : ''}

**Analysis Category:** ${displayCategory}

**Available Data for this Category:**
${JSON.stringify(relevantData, null, 2)}

**YOUR TASK:**
Generate a comprehensive, data-driven insight analysis specifically for the "${displayCategory}" category that directly impacts design strategy for this ${projectType} project. Your analysis must be:

1. **HYPER-SPECIFIC**: Reference actual data points, compare to benchmarks, and provide concrete numbers
2. **ACTIONABLE**: Every recommendation must have clear design implications
3. **CONTEXTUAL**: Consider the project type, template (if provided), and location characteristics
4. **FACT-BASED**: Support claims with data, research, and best practices
5. **STRATEGIC**: Focus on how these insights shape critical design decisions

**Output a JSON object with this exact structure:**

{
  "category": "${displayCategory}",
  "title": "A compelling, specific title that captures the key insight (e.g., 'Young Demographic Demands Active Recreation Programming')",
  "summary": "2-3 sentence executive summary highlighting the most critical finding and its design implication",
  "impact": "Clear statement of how this impacts the ${projectType} design strategy - be specific about opportunities and constraints",
  "designConsiderations": [
    "3-5 specific design considerations with concrete examples",
    "Each should be actionable and reference actual data points",
    "Example: 'With 35% population aged 18-34, prioritize flexible multi-use spaces that support co-working, fitness, and social gatherings'"
  ],
  "strategicRecommendations": [
    "3-5 strategic recommendations ordered by priority",
    "Each must be specific, measurable, and achievable",
    "Include expected outcomes and metrics where possible"
  ],
  "keyMetrics": [
    {
      "label": "Clear metric name",
      "value": "Actual value from data",
      "unit": "Unit of measurement",
      "trend": "positive/negative/neutral (based on context)",
      "context": "Why this metric matters and what it means for design - 1-2 sentences"
    }
  ],
  "visualizations": [
    {
      "type": "chart/graph/heatmap/comparison",
      "data": "Structured data for visualization (arrays, objects, etc.)",
      "title": "Visualization title",
      "description": "What the visualization shows and why it matters"
    }
  ],
  "caseStudies": [
    {
      "project": "Real project name",
      "location": "City, Country",
      "strategy": "Specific strategy they used related to this insight",
      "outcome": "Measurable outcome or success metric"
    }
  ],
  "factChecks": [
    {
      "fact": "A specific, verifiable fact related to this analysis",
      "source": "Where this fact comes from (e.g., 'WHO Guidelines', 'Local Building Code', 'Urban Planning Research')"
    }
  ]
}

**CRITICAL REQUIREMENTS:**
- Include 4-6 keyMetrics with real values from the data
- Provide 2-3 visualizations with actual data structures ready for charting
- Reference 2-3 relevant case studies from real projects worldwide
- Include 3-5 fact checks from authoritative sources
- Make every recommendation specific to the project type and location
- Use exact numbers and data points throughout
- Connect insights directly to design decisions

Generate the response as valid JSON only, wrapped in a markdown code block.
`;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const textResponse = response.text;
        const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : textResponse.trim();
        
        return JSON.parse(jsonText) as ContextualInsight;
    } catch (error) {
        console.error('Error generating contextual insight:', error);
        // Return a fallback insight
        return generateFallbackInsight(category, quantitativeData, projectType);
    }
}

function generateFallbackInsight(
    category: string,
    data: QuantitativeData,
    projectType: string
): ContextualInsight {
    return {
        category,
        title: `${category} Analysis for ${projectType}`,
        summary: 'Unable to generate detailed insights at this time. Please try again.',
        impact: 'Data analysis is temporarily unavailable.',
        designConsiderations: ['Review available data manually', 'Consult with local experts'],
        strategicRecommendations: ['Conduct additional site analysis', 'Gather more contextual data'],
        keyMetrics: [],
        visualizations: [],
        factChecks: []
    };
}
