import { GoogleGenAI, Type, Modality } from "@google/genai";
import { LocationData, AnalysisSectionData, QuantitativeData, ImageFile, ExtractedPdfStats, HousingOptionsData, ConceptualPlan, CostEstimate, PlanShape } from '../types';
import { generateCostEstimate } from '@/utils/costEstimation';
import { calculatePolygonArea } from '@/utils/geometry';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const generateVisualAnalysis = async (base64Image: string, prompt: string, analysisType: string): Promise<string | null> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
            },
        };

        let fullPromptText = '';

        if (analysisType === 'Strategic Generative Recommendations') {
            fullPromptText = `
You are a precise digital architect. Your task is to generate a photorealistic, top-down render of a park design.

**THE SINGLE MOST IMPORTANT RULE:** The user has provided an image with a semi-transparent blue polygon marking the project site. Your design MUST be generated **exclusively and perfectly** inside this blue boundary. **NOTHING outside the blue polygon may be altered in any way.** The surrounding buildings, roads, and landscape must remain 100% identical to the original image. Treat the blue polygon as an uncrossable property line. Any spillover is a failure.

**TASK:**
1.  **Replace the Area:** Completely replace the ground inside the blue polygon with the new park design. The original ground inside the polygon should not be visible.
2.  **Be Photorealistic:** Create a high-quality render that looks like a real drone photograph. Include realistic lighting, shadows, textures, and varied plants.
3.  **Add Labels:** After rendering, add simple, elegant white text labels (with a subtle drop shadow) to identify key features of your design.
4.  **Final Image:** The final output should be a clean render. Do NOT include the blue polygon, analytical lines, or arrows.

**Design Brief:** Create a design for the site based on this concept: ${prompt}
            `;
        } else if (analysisType === 'Street View Render') {
            fullPromptText = `
You are a master architectural visualization artist. Your task is to generate a photorealistic, street-level render of a park design.

**CONTEXT:** The user has provided an image showing a project site (marked by a semi-transparent blue polygon) and its immediate surroundings from a top-down perspective. You will receive a design brief to implement within that site.

**THE SINGLE MOST IMPORTANT RULE:** Your render must be from a human, eye-level perspective, as if standing on a sidewalk or road adjacent to the park, looking into it. The design you create inside the park should be consistent with the design brief. The surroundings (buildings, roads, etc., outside the park) must be contextually appropriate based on the provided top-down image.

**TASK:**
1.  **Establish Perspective:** Create a street-level viewpoint from outside the park boundary, looking in.
2.  **Render the Design:** Populate the park area with the elements described in the design brief. The design should be vibrant and alive.
3.  **Be Photorealistic:** The final image must be indistinguishable from a real photograph. Pay close attention to lighting (e.g., golden hour, sunny day), shadows, textures, material details, and atmospheric effects. Include realistic people enjoying the park.
4.  **Maintain Context:** The visible buildings and infrastructure surrounding the park should match the style and scale seen in the original top-down image.

**Design Brief:** Create a street-level view of a park with this concept: ${prompt}
`;
        } else {
            let stylePrompt = '';
            switch (analysisType) {
                case 'Ecological and Environmental Opportunities':
                    stylePrompt = `
                    Adopt the persona of an environmental designer. Create an illustrative, semi-transparent overlay.
                    Use soft, organic shapes and nature-inspired icons (like leaves, water drops, wind gusts) to represent ecological factors.
                    The style should be evocative and slightly artistic, focusing on flows and natural systems.
                    `;
                    break;
                default: // For 'Urban Context and Accessibility' and 'Site Potential and Constraints'
                    stylePrompt = `
                    Adopt the persona of an urban analyst creating a technical diagram.
                    - Use solid colored arrows to show movement and access.
                    - Use semi-transparent shaded polygons to highlight important zones.
                    - Use simple, clear labels.
                    The style should be clean, precise, and easy to understand.
                    `;
                    break;
            }
            fullPromptText = `As an expert urban planning illustrator, overlay analytical diagrams onto the provided map screenshot.
Do not change the underlying map. Only add clear, illustrative overlays, icons, and text labels.
${stylePrompt}
Instruction: ${prompt}`;
        }
        
        const textPart = {
            text: fullPromptText,
        };


        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/jpeg;base64,${base64ImageBytes}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Visual analysis generation failed:", error);
        return null; // Don't block the whole analysis if one image fails
    }
};

export const analyzeSiteWithMaps = async (
    siteLocation: LocationData,
    urbanScreenshotBase64: string,
    siteScreenshotBase64: string,
    userLocation: { latitude: number, longitude: number },
    onProgress: (message: string, progress: number) => void,
    // FIX: Reordered parameters to place the required `projectType` before optional parameters.
    projectType: string,
    template?: any, // DesignTemplate
    language: string = 'English',
    housingOptions?: HousingOptionsData
): Promise<{
    analysisResult: AnalysisSectionData[],
    quantitativeData: QuantitativeData
}> => {
    onProgress("Warming up the satellites… scanning your site's pulse.", 15);
    
    const model = 'gemini-2.5-pro';

    const siteDefinition = siteLocation.boundary
        ? `Site to Analyze (within this polygon boundary):
- Name: ${siteLocation.name}
- Boundary Coordinates: ${JSON.stringify(siteLocation.boundary)}
- Area: ${siteLocation.area?.toFixed(0)} m²`
        : `Site to Analyze (centered at this point):
- Name: ${siteLocation.name}
- Latitude: ${siteLocation.latitude}
- Longitude: ${siteLocation.longitude}`;

    // Add template guidance if provided
    const templateGuidance = template ? `
    
DESIGN TEMPLATE APPLIED: "${template.name}"
Template Description: ${template.description}
Template Category: ${template.category}

When generating the 'Strategic Generative Recommendations' section, incorporate the following design elements and approach:
${template.aiPrompt}

Ensure the design recommendations align with this template's vision while adapting to the specific site context.
` : '';

    const housingGuidance = housingOptions ? `
    
HOUSING SPECIFICATIONS:
- Unit Mix: ${housingOptions.unitMix}
- Target Income Group: ${housingOptions.incomeGroup}
- Maximum Floors: ${housingOptions.maxFloors}

When generating the design, adhere to these housing specifications. Also consider typical local building bylaws for residential development regarding setbacks, Floor Space Index (FSI), and parking requirements to ensure a realistic proposal.
`: '';

    // --- Proximity Analysis Prompt Generation ---
    const placesMapping: Record<string, Record<string, string[]>> = {
        'Housing': {
            'Safety': ['police', 'fire_station'],
            'Healthcare': ['hospital', 'doctor', 'pharmacy'],
            'Daily Needs': ['supermarket', 'grocery_or_supermarket'],
            'Lifestyle': ['shopping_mall'],
            'Recreation': ['park'],
            'Education': ['school', 'university'],
            'Child Care': ['school'], // Special instruction needed
            'Work': ['establishment'], // Special instruction needed
            'Nature': ['natural_feature', 'lake', 'river'],
            'Transit': ['transit_station', 'bus_station', 'subway_station'],
            'Civic': ['local_government_office']
        },
        'Commercial': {
            'Work': ['establishment'], // "coworking space"
            'Finance': ['bank', 'atm'],
            'Logistics': ['post_office'],
            'Transit': ['transit_station', 'bus_station', 'subway_station'],
            'Parking': ['parking'],
            'Food & Drink': ['restaurant', 'cafe'],
            'Wellness': ['gym'],
            'Civic': ['local_government_office'],
            'Hospitality': ['hotel']
        },
        'Industrial': {
            'Transport': [], // Special instruction for highway
            'Logistics': ['storage'],
            'Safety': ['fire_station'],
            'Utilities': [], // Special instruction for water/sewer/electrical
            'Sustainability': ['recycling_center']
        },
        'Recreation': {
            'Transit': ['transit_station', 'bus_station', 'subway_station'],
            'Food & Drink': ['restaurant', 'cafe'],
            'Parking': ['parking'],
            'Shopping': ['shopping_mall'],
            'Culture': ['museum', 'art_gallery', 'movie_theater'],
            'Hospitality': ['hotel']
        }
    };

    const projectTypeKey = projectType as keyof typeof placesMapping;
    const categoriesToSearch = placesMapping[projectTypeKey] || placesMapping['Recreation'];

    let searchInstructions = Object.entries(categoriesToSearch).map(([category, places]) => {
        let instruction = `- **${category}:** Search for places with types: \`${places.join(', ')}\`.`;
        if (projectType === 'Housing' && category === 'Child Care') instruction += ` Specifically look for "Play School" or "Day Care".`;
        if (projectType === 'Commercial' && category === 'Work') instruction += ` Specifically look for "Coworking Space".`;
        return instruction;
    }).join('\n');

    if (projectType === 'Industrial') {
        searchInstructions += `
- **Transport:** Identify the nearest major highway and report its name and approximate distance.
- **Utilities:** Use your general knowledge and map data to infer the likely proximity to essential utilities like water/sewer lines and electrical substations, and report this qualitatively (e.g., "Likely available nearby").`;
    }

    const proximityAnalysisPrompt = `
**Proximity Analysis (proximityAnalysis):**
Based on the selected project type "${projectType}", use your Google Maps tool to find the nearest relevant points of interest **within a 1km radius** of the site's center. For each point found, you MUST provide its name, distance from the site center (e.g., "500m"), the category from the list below, and its precise latitude and longitude.

**Search Instructions:**
${searchInstructions}

**Rules:**
- Find only the closest 1-2 examples for each category. Do not return a long list.
- If no place is found for a category within 1km, omit that category from the results.
- The 'distance' must be a string like "250m" or "1.2km".`;
        
    const prompt = `
    You are an expert urban planner. Analyze the urban site specified by the geographic data below to produce a comprehensive planning report.
    Use your map data to understand the site's context. The user performing this analysis is at a different location, provided for context.
    
    **CRITICAL INSTRUCTION: All textual analysis in the 'content' fields of the 'analysisResult' array MUST be generated in ${language}.**

    The final 'content' text should be a clean, professional report; do not include any bracketed numerical citations like [1, 2, 3].
    ${templateGuidance}
    ${housingGuidance}
    ${proximityAnalysisPrompt}
    
    ${siteDefinition}
    
    User's Current Location:
    - Latitude: ${userLocation.latitude}
    - Longitude: ${userLocation.longitude}

    Generate a JSON object that adheres to the provided schema. Wrap the JSON object in a markdown code block (\`\`\`json ... \`\`\`).

    **JSON Schema:**
    {
      "analysisResult": [
        {
          "title": "string (one of 'Urban Context and Accessibility', 'Site Potential and Constraints', 'Ecological and Environmental Opportunities', 'Strategic Generative Recommendations')",
          "content": "string (detailed description with markdown bullet points using '*')",
          "visual_prompts": {
            "urban": "string (A prompt for an AI illustrator to overlay diagrams on a WIDE-AREA, urban context map. This should describe WHAT to draw, not how.)",
            "site": "string | null (A prompt for an AI illustrator to overlay diagrams on a ZOOMED-IN site map. THIS SHOULD ONLY BE PROVIDED for the 'Strategic Generative Recommendations' section. For all others, it must be null.)",
            "street": "string | null (A prompt for an AI illustrator to generate a photorealistic, human-eye level, street-view render looking into the proposed design from a nearby road. THIS SHOULD ONLY BE PROVIDED for the 'Strategic Generative Recommendations' section. For all others, it must be null.)"
          }
        }
      ],
      "quantitativeData": {
        "location": { "name": "string", "latitude": "number", "longitude": "number" },
        "potentialVisitors": "string (A realistic daily visitor estimate as a range, e.g., '500-800')",
        "potentialVisitorsRationale": "string (A brief 1-2 sentence explanation for the visitor estimate, based on surrounding context like population, POIs, and transit.)",
        "busiestHours": ["string"],
        "landUse": [{ "type": "string", "percentage": "number" }],
        "landUseRationale": "string (Briefly explain how you estimated the land use percentages, e.g., 'Based on visual analysis of building types and zoning data from Google Maps.')",
        "ageDemographics": [{ "ageRange": "string ('0-17', '18-34', '35-54', '55+)", "percentage": "number" }],
        "ageDemographicsRationale": "string (Briefly explain the source for this data, e.g., 'Based on publicly available demographic data for this census tract.')",
        "publicTransportAccess": "string ('Excellent', 'Good', 'Fair', or 'Poor')",
        "publicTransportAccessRationale": "string (Justify the rating, e.g., 'Based on the proximity of 2 metro stations and multiple bus stops within 500m.')",
        "averageIncome": "string ('Low', 'Medium', 'High')",
        "averageIncomeRationale": "string (Briefly explain the source for this data, e.g., 'Estimated from local real estate values and business types in the area.')",
        "averageIncomeNumeric": "number (Average household income in local currency as a number, e.g., 50000)",
        "averageIncomeUnit": "string (The currency and period, e.g., 'INR/month', 'USD/year', 'EUR/month')",
        "greenSpaceRatio": "number",
        "greenSpaceRatioRationale": "string (Explain how this was calculated, e.g., 'Calculated from the percentage of parks and vegetative cover visible on the satellite map within a 1km radius.')",
        "monthlyTemperatures": [{ "month": "string (3-letter abbreviation, e.g., 'Jan')", "temp": "number (average temperature in Celsius)" }],
        "monthlyWinds": [{ "month": "string (3-letter abbreviation, e.g., 'Jan')", "direction": "string (dominant wind direction, e.g., 'NW')" }],
        "monthlyRainfall": [{ "month": "string (3-letter abbreviation, e.g., 'Jan')", "rainfall": "number (average rainfall in mm)" }],
        "monthlyHumidity": [{ "month": "string (3-letter abbreviation, e.g., 'Jan')", "humidity": "number (average relative humidity percentage, 0-100)" }],
        "climaticDataRationale": "string (Cite the general source of this climate data, e.g., 'Based on historical climate data for the city.')",
        "rainfallRationale": "string (Explain rainfall patterns for this city)",
        "constructionMaterials": ["string (common materials, e.g., 'Concrete', 'Brick', 'Steel', 'Wood', 'Stone')"],
        "constructionStyle": "string (brief description, e.g., 'Mediterranean vernacular', 'Modern high-rise', 'Colonial brick')",
        "constructionRationale": "string (Explain what informed this assessment based on visible buildings)",
        "walkabilityScore": "number (A score from 0-100 representing the walkability of the immediate area, considering sidewalks, road connectivity and nearby amenities)",
        "walkabilityScoreRationale": "string (Justify the score, e.g., 'High score due to dense grid of streets, presence of sidewalks, and numerous amenities within a short walk.')",
        "noiseLevel": "string ('Low', 'Moderate', 'High', based on proximity to major roads, rail, and commercial activity)",
        "noiseLevelRationale": "string (Justify the estimate, e.g., 'Estimated as High due to proximity to a major highway and commercial corridor.')",
        "noiseDay": "number (average daytime noise in dB)",
        "noiseDayRationale": "string",
        "noiseNight": "number (average nighttime noise in dB)",
        "noiseNightRationale": "string",
        "floodRisk": "string ('Low', 'Moderate', 'High', based on elevation, proximity to water bodies, and historical data)",
        "floodRiskRationale": "string (Justify the rating, e.g., 'Based on map elevation data and distance from the nearby river.')",
        "groundPermeability": "string ('High', 'Medium', 'Low')",
        "groundPermeabilityRationale": "string",
        "airQualityPM25": "number (PM 2.5 in µg/m³)",
        "airQualityPM25Rationale": "string",
        "airQualityNO2": "number (NO₂ in µg/m³)",
        "airQualityNO2Rationale": "string",
        "treeCanopyCoverage": "number (percentage within 500m)",
        "treeCanopyCoverageRationale": "string",
        "nearbyPOIs": "number (Count of points of interest like cafes, shops, schools within a 500m radius)",
        "nearbyPOIsRationale": "string (Explain the source, e.g., 'Counted from points of interest data available on Google Maps within a 500m radius.')",
        "amenityBreakdown": [{ "category": "string (e.g., 'Restaurants & Cafes', 'Schools & Education', 'Healthcare', 'Shopping')", "count": "number (count of amenities in this category)" }],
        "proximityAnalysis": [{ "name": "string", "distance": "string", "category": "string", "latitude": "number", "longitude": "number" }],
        "caseStudyProjects": [{ 
          "name": "string (Name of the case study project)", 
          "location": "string (City and country of the project)", 
          "description": "string (Brief 2-3 sentence description of the project and its key features)",
          "relevance": "string (Explain why this project is relevant - similar climate, program, context, or innovative strategies)",
          "sourceUrl": "string (optional - URL to more information about the project)"
        }],
        "zoningFAR": "number (Floor Area Ratio in m²/m²)",
        "zoningFARRationale": "string",
        "setbackLimits": "string (e.g., '5m front, 3m side, 2m rear')",
        "setbackLimitsRationale": "string",
        "heightLimit": "number (in meters)",
        "heightLimitRationale": "string",
        "imperviousSurfaceRatio": "number (percentage)",
        "imperviousSurfaceRatioRationale": "string",
        "utilityDistanceWater": "number (meters to nearest water line)",
        "utilityDistanceWaterRationale": "string",
        "utilityDistanceSewer": "number (meters)",
        "utilityDistanceSewerRationale": "string",
        "utilityDistanceElectricity": "number (meters)",
        "utilityDistanceElectricityRationale": "string",
        "landValueIndex": "number (local currency per m²)",
        "landValueIndexRationale": "string",
        "landValueUnit": "string (e.g., 'EUR/m²', 'INR/m²')",
        "permitProcessingTime": "number (days)",
        "permitProcessingTimeRationale": "string",
        "permitFees": "number (in local currency)",
        "permitFeesRationale": "string",
        "permitFeesUnit": "string (e.g., 'EUR', 'INR')",
        "solarRadiation": [{ "orientation": "string (N/S/E/W)", "kWhPerM2PerDay": "number" }],
        "solarRadiationRationale": "string",
        "windSpeedRange": "string (e.g., '2-5 m/s')",
        "windSpeedRangeRationale": "string",
        "windDirectionSeasonal": "string (e.g., 'NW (winter), SE (summer)')",
        "windDirectionSeasonalRationale": "string",
        "outdoorComfortHours": "number (percentage of year)",
        "outdoorComfortHoursRationale": "string",
        "transitFrequency": "number (buses/trams per hour)",
        "transitFrequencyRationale": "string",
        "cyclingInfrastructureDensity": "number (meters of cycle track per km²)",
        "cyclingInfrastructureDensityRationale": "string",
        "fifteenMinuteCityIndex": "number (percentage of essential services within 15 min walk)",
        "fifteenMinuteCityIndexRationale": "string",
        "parkingRatio": "number (parking spaces per 1000 m²)",
        "parkingRatioRationale": "string",
        "connectivityScore": "number (0-100 based on amenities integration)",
        "connectivityScoreRationale": "string",
        "medianRent": "number (local currency per m²)",
        "medianRentRationale": "string",
        "medianRentUnit": "string (e.g., 'EUR/m²/month')",
        "medianPropertyPrice": "number (local currency per m²)",
        "medianPropertyPriceRationale": "string",
        "medianPropertyPriceUnit": "string (e.g., 'EUR/m²')",
        "householdSize": "number (average)",
        "householdSizeRationale": "string",
        "employmentSectorSplit": [{ "sector": "string (e.g., 'Service', 'Technology', 'Industry')", "percentage": "number" }],
        "employmentSectorSplitRationale": "string",
        "educationIndex": "number (percentage with tertiary degree)",
        "educationIndexRationale": "string",
        "populationDensity": "number (people per km²)",
        "populationDensityRationale": "string",
        "annualGrowthRate": "number (percentage)",
        "annualGrowthRateRationale": "string",
        "diversityMigrationIndex": "number (0-100 score)",
        "diversityMigrationIndexRationale": "string"
      }
    }

    **Analysis Sections (analysisResult):**
    Generate exactly four analysis sections with these titles: 'Urban Context and Accessibility', 'Site Potential and Constraints', 'Ecological and Environmental Opportunities', 'Strategic Generative Recommendations'.
    For each section, provide an 'urban' visual_prompt. The prompts should be concise and direct commands.
    - For 'Urban Context' and 'Site Potential', the prompts should focus on analytical diagrams (e.g., 'Draw arrows from transit stops to the site', 'Highlight surrounding commercial zones in yellow').
    - For 'Ecological and Environmental Opportunities', the prompts should describe natural systems (e.g., 'Illustrate prevailing wind direction with arrows', 'Show areas of high sun exposure in a yellow wash').
    - For 'Strategic Generative Recommendations', the prompts should describe a single, coherent design option for a park. Crucially, these recommendations must be based on the context from the previous analysis sections.

    **CRITICAL:** For the 'Strategic Generative Recommendations' section, you must ALSO provide a 'site' visual_prompt and a 'street' visual_prompt.
    The 'site' prompt should detail a specific, creative design proposal that can be built *strictly within* the site's boundary.
    The 'street' prompt should describe the same design but from a human-level perspective, as if standing on an adjacent street.
    For all other sections, the 'site' and 'street' prompts must be null.

    **Quantitative Insights (quantitativeData):**
    Provide COMPREHENSIVE, CONCRETE DATA for any site globally. Use real-world databases, typical values for the region/climate, and best estimates based on the location.
    
    **CRITICAL: Financial data MUST be realistic and properly researched:**
    - Average household income should be ANNUAL income in local currency with realistic ranges:
      * Spain/Portugal: €30,000-40,000/year
      * USA: $65,000-75,000/year
      * India: ₹500,000-800,000/year (₹40k-70k/month)
      * Japan: ¥5,000,000-7,000,000/year
      * Australia: A$85,000-100,000/year
      * South Africa: R200,000-300,000/year
      * Netherlands: €35,000-45,000/year
      * Brazil: R$40,000-60,000/year
      * Argentina: AR$500,000-800,000/year
      * Chile: CL$10,000,000-15,000,000/year
      * Colombia: CO$35,000,000-50,000,000/year
      * Mexico: MX$200,000-300,000/year
      * UAE: د.إ180,000-250,000/year
      * Saudi Arabia: ر.س120,000-180,000/year
      * UK: £30,000-40,000/year
    - Median rent should be realistic monthly rates per m²:
      * Barcelona/Madrid: €15-20/m²/month
      * Manhattan/San Francisco: $80-120/m²/month
      * Mumbai/Delhi: ₹700-1,200/m²/month
      * Tokyo/Osaka: ¥3,000-5,000/m²/month
      * Sydney/Melbourne: A$40-60/m²/month
      * Cape Town/Johannesburg: R120-180/m²/month
      * Amsterdam/Rotterdam: €18-25/m²/month
      * São Paulo/Rio: R$40-70/m²/month
      * Dubai: د.إ100-150/m²/month
    - Property prices should reflect actual market rates per m²:
      * Barcelona: €4,000-6,000/m²
      * London: £8,000-12,000/m²
      * New York: $15,000-25,000/m²
      * Mumbai: ₹150,000-250,000/m²
      * Tokyo: ¥800,000-1,200,000/m²
      * Sydney: A$10,000-15,000/m²
      * Cape Town: R25,000-40,000/m²
      * Amsterdam: €6,000-9,000/m²
      * Dubai: د.إ12,000-18,000/m²
    - Do NOT provide unrealistic low values like €2,800/year for household income - this would be poverty level everywhere
    - Always provide values in the LOCAL CURRENCY for that country (Euros for Spain/France/Germany/Netherlands, Pounds for UK, Dollars for USA/Australia, Rupees for India, Yen for Japan, Rand for South Africa, etc.)
    - Research typical salary ranges, rent prices, and property values for the specific city/region
    
    For 'potentialVisitors', provide a realistic estimated daily range (e.g., "500-800") and a brief 'potentialVisitorsRationale' based on factors from the map data like population density, nearby amenities, transit access, and the size of the site. Your estimate should be grounded and conservative.
    
    Provide estimated average monthly temperatures (in Celsius), humidity (percentage), and dominant monthly wind directions for all 12 months for the city. Ensure environmental data are realistic for the specified city's climate.
    
    For Urban Context & Regulation: Provide typical zoning FAR, setback limits, height limits for the region. Estimate utility distances, land values, and permit processing based on the city/country norms.
    
    For Microclimate & Environmental Comfort: Provide solar radiation by orientation (N/S/E/W), wind speed ranges, outdoor comfort hours, tree canopy coverage, air quality metrics (PM2.5, NO2), and noise levels (day/night) based on urban context.
    
    For Advanced Mobility: Estimate transit frequency, cycling infrastructure density, 15-minute city index, parking ratios, and connectivity scores based on the urban fabric.
    
    For Socio-Economic Fabric: Provide median rent, property prices, household size, population density, growth rates, education levels, employment sector splits, and diversity indices based on the city/region. ENSURE ALL FINANCIAL VALUES ARE REALISTIC AND MATCH ACTUAL MARKET CONDITIONS.
    
    For amenityBreakdown, categorize nearby amenities (within 500m) into logical groups like 'Restaurants & Cafes', 'Schools & Education', 'Healthcare', 'Shopping', 'Parks & Recreation', 'Transit', etc., and provide counts for each category.
    
    For caseStudyProjects, research and provide 3-5 relevant architectural or urban design projects from around the world that share similarities with this project in terms of: climate conditions, program type (${projectType}), scale, context, or innovative design strategies. Focus on well-documented projects that would serve as valuable precedents.
    
    For each data point, you MUST provide a corresponding '...Rationale' field explaining how you derived the information or the source of the data. This is crucial for transparency.
    `;

    onProgress("Syncing with Google Maps and decoding the city's whispers.", 20);

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            tools: [{googleMaps: {}}],
        }
    });

    onProgress("Translating city data into design insights…", 40);
    const textResponse = response.text || '';
    const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : textResponse.trim();
    
    let result;
    try {
        result = JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse JSON response from Gemini:", jsonText);
        throw new Error("The AI model returned an invalid response. Please try again.");
    }

    // Post-process to remove bracketed citations from content
    result.analysisResult.forEach((section: any) => {
        if (section.content && typeof section.content === 'string') {
            section.content = section.content.replace(/ \[\d+(, ?\d+)*\]/g, '').trim();
        }
    });
    
    result.quantitativeData.location = {
        name: siteLocation.name,
        latitude: siteLocation.latitude,
        longitude: siteLocation.longitude,
    };

    const analysisResultWithVisualPrompts: (Omit<AnalysisSectionData, 'imageUrls'> & { visual_prompts: { urban: string, site: string | null, street: string | null } })[] = result.analysisResult;
    const analysisResultWithImages: AnalysisSectionData[] = [];

    const totalVisualsToGenerate = analysisResultWithVisualPrompts.length + 2; // 4 urban + 1 site + 1 street
    let currentProgress = 50;
    const progressStep = 40 / totalVisualsToGenerate;


    for (const section of analysisResultWithVisualPrompts) {
        let siteImageUrl: string | null = null;
        let streetImageUrl: string | null = null;
        
        // Custom progress messages for each section
        let progressMessage = '';
        if (section.title === 'Urban Context and Accessibility') {
            progressMessage = "Uncovering the neighborhood's hidden patterns and potentials…";
        } else if (section.title === 'Site Potential and Constraints') {
            progressMessage = "Spotlighting constraints that shape your site's story…";
        } else if (section.title === 'Ecological and Environmental Opportunities') {
            progressMessage = "Mapping green corridors, breeze paths, and solar moods…";
        } else if (section.title === 'Strategic Generative Recommendations') {
            progressMessage = "Drafting early strategies that make sense and feel right.";
        } else {
            progressMessage = `Generating urban visual: ${section.title}`;
        }
        
        onProgress(progressMessage, currentProgress);
        const urbanImageUrl = section.visual_prompts.urban 
            ? await generateVisualAnalysis(urbanScreenshotBase64, section.visual_prompts.urban, section.title)
            : null;
        currentProgress += progressStep;

        // Only generate site-specific visual for the design recommendations section
        if (section.title === 'Strategic Generative Recommendations') {
            if (section.visual_prompts.site) {
                onProgress("Sketching how your site could breathe, connect, and thrive.", currentProgress);
                siteImageUrl = await generateVisualAnalysis(siteScreenshotBase64, section.visual_prompts.site, section.title);
                currentProgress += progressStep;
            }
            if (section.visual_prompts.street) {
                onProgress("Zooming in to street-level and seeing it as people would.", currentProgress);
                streetImageUrl = await generateVisualAnalysis(siteScreenshotBase64, section.visual_prompts.street, 'Street View Render');
                currentProgress += progressStep;
            }
        }
        
        analysisResultWithImages.push({
            title: section.title,
            content: section.content,
            imageUrls: {
                urban: urbanImageUrl,
                site: siteImageUrl,
                street: streetImageUrl,
            }
        });
    }
    
    onProgress("Polishing insights and preparing your tailored site report.", 95);

    return {
        analysisResult: analysisResultWithImages,
        quantitativeData: result.quantitativeData,
    };
};

export const extractStatsFromPdf = async (pdfFile: ImageFile): Promise<ExtractedPdfStats> => {
    const model = 'gemini-2.5-pro'; // Use Pro for better complex document understanding
    const pdfPart = {
        inlineData: {
            data: pdfFile.base64,
            mimeType: pdfFile.type,
        },
    };

    const textPart = {
        text: `You are an expert urban planning data analyst. 
        Analyze the provided PDF document, which is an urban planning report for a park or public space.
        Extract the following key statistics and information. 
        If a specific piece of information is not available, use a sensible default (e.g., 0 for numbers, "N/A" for strings, or an empty array []).
        Return the result as a single JSON object that strictly adheres to the provided schema. Do not include any other text or markdown formatting.`,
    };

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [textPart, pdfPart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    park_name: { type: Type.STRING, description: "The name of the park or site." },
                    park_area_hectares: { type: Type.NUMBER, description: "Total area in hectares." },
                    hardscape_percent: { type: Type.NUMBER, description: "Percentage of hardscape (paved areas)." },
                    softscape_percent: { type: Type.NUMBER, description: "Percentage of softscape (lawn, planted areas)." },
                    tree_canopy_percent: { type: Type.NUMBER, description: "Percentage of tree canopy coverage." },
                    building_height_stories: { type: Type.NUMBER, description: "Average height of surrounding buildings in stories." },
                    main_zones: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of main functional zones (e.g., 'Playground', 'Sports Area')." },
                    dominant_activities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of observed dominant activities (e.g., 'Walking', 'Sitting', 'Sports')." },
                    sun_exposure: { type: Type.STRING, description: "General sun exposure (e.g., 'Mostly Sunny', 'Partially Shaded')." },
                    access_points: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of main access points or entrances." },
                    environmental_features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key environmental features (e.g., 'Water feature', 'Native plantings')." },
                    summary: { type: Type.STRING, description: "A one-paragraph summary of the report's key findings." },
                },
                required: [
                    "park_name", "park_area_hectares", "hardscape_percent", "softscape_percent", 
                    "tree_canopy_percent", "building_height_stories", "main_zones", 
                    "dominant_activities", "sun_exposure", "access_points", 
                    "environmental_features", "summary"
                ]
            }
        }
    });

    const jsonText = response.text;
    try {
        return JSON.parse(jsonText) as ExtractedPdfStats;
    } catch (e) {
        console.error("Failed to parse JSON response from Gemini for PDF extraction:", jsonText);
        throw new Error("The AI model returned an invalid response for the PDF analysis. Please try again.");
    }
};


export const iterateDesign = async (editedDesignImage: string): Promise<string | null> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: editedDesignImage.split(',')[1],
            },
        };

        const textPart = {
            text: `You are a world-class landscape architect and digital artist. The user has provided a marked-up image with colored drawings and text labels indicating their desired park design. 
Your task is to interpret these markings and generate a **photorealistic, highly detailed, top-down architectural render** of the final park design.

Interpret the colored drawings according to this legend:
- Brown (#a16207): Represents pathways or paved areas.
- Green (#16a34a): Represents trees, shrubs, lawns, or general green space.
- Gray (#64748b): Represents seating areas or individual benches.
- Yellow/Orange (#f59e0b): Represents a play area for children.
- Pink (#db2777): Represents a kiosk, food stall, or small structure.
- Purple (#7c3aed): Represents a designated pet-friendly or dog park area.
- Blue (#2563eb): Represents bike parking racks.

The text labels provide additional specific instructions.

- Transform the user's raw drawings into a beautiful, functional, and realistic park design.
- The final image should look like a **real photograph taken from a drone**, with realistic textures, lighting, shadows, and varied vegetation (different types of trees, flowers, etc.).
- After generating the realistic render, **add subtle, elegant, white text labels with a slight drop shadow** to the key areas you've designed based on the user's color-coded input. For example, label the area drawn in yellow as 'Playground', the area in purple as 'Dog Park', etc.
- IMPORTANT: Do not show the user's colored scribbles. Generate a completely new, clean, professional render based on their ideas. Do not change the underlying map context.`,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/jpeg;base64,${base64ImageBytes}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Design iteration failed:", error);
        throw new Error("The AI failed to generate a new design. Please try again.");
    }
};

export const generateAICostEstimate = async (
    siteLocation: LocationData,
    projectType: string,
    conceptualPlan: ConceptualPlan | null,
    template?: any, // DesignTemplate
): Promise<CostEstimate> => {
    try {
        const model = 'gemini-2.5-pro';

        let designDescription = '';
        if (conceptualPlan && conceptualPlan.shapes.length > 0) {
            const getShapeArea = (shape: PlanShape): number => {
                if (shape.type === 'polygon' && shape.points) {
                    return calculatePolygonArea(shape.points);
                }
                if (shape.type === 'circle') {
                    return Math.PI * (shape.width / 2) * (shape.height / 2);
                }
                return shape.width * shape.height;
            };
            designDescription = "The conceptual plan consists of the following building masses:\n";
            conceptualPlan.shapes
                .filter(s => s.category !== 'Setback' && (s.floors ?? 0) > 0)
                .forEach(shape => {
                    const gfa = getShapeArea(shape) * (shape.floors ?? 1);
                    designDescription += `- A '${shape.label}' (${shape.category}) with a total Gross Floor Area of approximately ${gfa.toFixed(0)} m² across ${shape.floors} floors.\n`;
                });
        } else if (template) {
            designDescription = `The project is based on the "${template.name}" template, which is a ${projectType} project described as: ${template.description}. The total site area is ${siteLocation.area?.toFixed(0)} m².`;
        } else {
            designDescription = `This is a generic ${projectType} project on a site of ${siteLocation.area?.toFixed(0)} m².`;
        }

        const prompt = `
        You are an expert Quantity Surveyor and urban development Cost Estimator. Your task is to generate a detailed cost estimate for a construction project.

        **Project Details:**
        - **Location:** ${siteLocation.name}
        - **Site Area:** ${siteLocation.area?.toFixed(0)} m²
        - **Project Type:** ${projectType}
        - **Design Summary:** ${designDescription}

        **Instructions:**
        1.  **Use Your Tools:** Actively use your Google Search tool to find recent, location-specific data for construction costs (per square meter/foot), material prices, and labor rates for the city mentioned in the location.
        2.  **Be Context-Aware:** Consider the project type and scale. A luxury high-rise in a dense city center costs more than low-rise affordable housing in a suburb. Factor in typical local regulations and building standards that would affect costs.
        3.  **Provide a Detailed Breakdown:** The 'items' array should contain a granular breakdown of costs. Group items logically by category (e.g., 'Substructure', 'Superstructure', 'Finishes', 'MEP', 'External Works', 'Landscaping').
        4.  **Calculate Summaries:** Ensure all summary fields (subtotal, totalCost, etc.) are calculated correctly based on the itemized list. Use a standard contingency percentage (e.g., 15-20%). Calculate annual maintenance as a percentage of construction cost (e.g., 2-4%).
        5.  **Output JSON:** Your final output must be ONLY a single, valid JSON object that strictly adheres to the provided schema, wrapped in a markdown code block (\`\`\`json ... \`\`\`). All costs must be in Euros (€).

        **JSON Schema:**
        ${JSON.stringify({
            type: "object",
            properties: {
                items: { type: "array", items: { type: "object", properties: { category: { type: "string" }, item: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" }, unitCost: { type: "number" }, totalCost: { type: "number" } } } },
                subtotal: { type: "number" },
                contingency: { type: "number" },
                totalCost: { type: "number" },
                constructionCost: { type: "number" },
                maintenanceYearlyCost: { type: "number" }
            }
        }, null, 2)}
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        let jsonText = (response.text || '').trim();
        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        }

        try {
            return JSON.parse(jsonText) as CostEstimate;
        } catch (e) {
            console.error("Failed to parse JSON from AI cost estimate:", jsonText);
            throw new Error("AI returned an invalid JSON format for the cost estimate.");
        }

    } catch (error) {
        console.error("AI Cost Estimation failed, falling back to programmatic estimation:", error);
        return generateCostEstimate(siteLocation.area || 1000, template);
    }
};

export const generateConceptualPlanCostEstimate = async (
    shapes: PlanShape[],
    siteLocation: LocationData
): Promise<CostEstimate> => {
    
    const getShapeArea = (shape: PlanShape): number => {
        if (shape.type === 'polygon' && shape.points) {
            return calculatePolygonArea(shape.points);
        }
        if (shape.type === 'circle') {
            return Math.PI * (shape.width / 2) * (shape.height / 2);
        }
        return shape.width * shape.height;
    };

    let designDescription = "The conceptual plan consists of the following building masses:\n";
    shapes
        .filter(s => s.category !== 'Setback' && (s.floors ?? 0) > 0)
        .forEach(shape => {
            const floorArea = getShapeArea(shape);
            const gfa = floorArea * (shape.floors ?? 1);
            designDescription += `- A '${shape.label}' (${shape.category}) with a total Gross Floor Area of approximately ${gfa.toFixed(0)} m² across ${shape.floors} floors.\n`;
        });

    const projectTypeSummary = Array.from(new Set(shapes.filter(s => s.category !== 'Setback' && s.category).map(s => s.category))).join(', ');
    
    const prompt = `
    You are an expert Quantity Surveyor and urban development Cost Estimator. Your task is to generate a detailed cost estimate for a conceptual construction project.

    **Project Details:**
    - **Location:** ${siteLocation.name}
    - **Project Type(s):** ${projectTypeSummary || 'Undefined'}
    - **Design Summary:** ${designDescription}

    **Instructions:**
    1.  **Use Your Tools:** Actively use your Google Search tool to find recent, location-specific data for construction costs (per square meter), material prices, and labor rates for the city mentioned in the location.
    2.  **Be Context-Aware:** Consider the project type(s) and scale. A luxury high-rise in a dense city center costs more than low-rise affordable housing in a suburb. Factor in typical local regulations and building standards that would affect costs.
    3.  **Provide a Detailed Breakdown:** The 'items' array should contain a granular breakdown of costs. Group items logically by category (e.g., 'Substructure', 'Superstructure', 'Finishes', 'MEP', 'External Works', 'Landscaping').
    4.  **Calculate Summaries:** Ensure all summary fields (subtotal, totalCost, etc.) are calculated correctly based on the itemized list. Use a standard contingency percentage (e.g., 15-20%). Calculate annual maintenance as a percentage of construction cost (e.g., 2-4%).
    5.  **Output JSON:** Your final output must be ONLY a single, valid JSON object that strictly adheres to the provided schema, wrapped in a markdown code block (\`\`\`json ... \`\`\`). All costs must be in Euros (€).

    **JSON Schema:**
    ${JSON.stringify({
        type: "object",
        properties: {
            items: { type: "array", items: { type: "object", properties: { category: { type: "string" }, item: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" }, unitCost: { type: "number" }, totalCost: { type: "number" } } } },
            subtotal: { type: "number" },
            contingency: { type: "number" },
            totalCost: { type: "number" },
            constructionCost: { type: "number" },
            maintenanceYearlyCost: { type: "number" }
        }
    }, null, 2)}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        }
    });

    let jsonText = (response.text || '').trim();
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1];
    }
    
    try {
        return JSON.parse(jsonText) as CostEstimate;
    } catch (e) {
        console.error("Failed to parse JSON from conceptual plan cost estimate:", jsonText, e);
        throw new Error(`AI returned an invalid response. Raw output: ${jsonText}`);
    }
};