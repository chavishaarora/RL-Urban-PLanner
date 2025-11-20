
// FIX: Removed circular import of CostEstimate from its own file.
export interface UserProfile {
    id: string;
    name: string;
    picture?: string;
    company?: string;
    age?: number;
    location?: string;
    favoriteAnimal?: string;
}

export interface LocationData {
    name: string;
    latitude: number; // Center of the area
    longitude: number; // Center of the area
    boundary?: { lat: number; lng: number }[];
    area?: number; // Area in square meters
}

export interface ImageFile {
    name: string;
    type: string;
    base64: string;
}

export interface AnalysisSectionData {
    title: string;
    content: string;
    imageUrls: {
        urban: string | null;
        site: string | null;
        street: string | null;
    };
}

export interface ProximityItem {
    name: string;
    distance: string; // e.g., "500m"
    category: string; // e.g., "Healthcare", "Education", "Safety"
    latitude: number;
    longitude: number;
}

export interface CaseStudyProject {
    name: string;
    location: string;
    description: string;
    relevance: string;
    imageUrl?: string;
    sourceUrl?: string;
}

export interface AmenityBreakdown {
    category: string;
    count: number;
}

export interface QuantitativeData {
    ageDemographics: { ageRange: string; percentage: number }[];
    ageDemographicsRationale?: string;
    landUse: { type: string; percentage: number }[];
    landUseRationale?: string;
    potentialVisitors: string; // Changed to support ranges, e.g., "500-800"
    potentialVisitorsRationale: string;
    busiestHours: string[];
    location?: LocationData;
    publicTransportAccess?: string;
    publicTransportAccessRationale?: string;
    averageIncome?: string;
    averageIncomeRationale?: string;
    averageIncomeNumeric?: number; // In local currency
    averageIncomeUnit?: string; // e.g., "INR/month", "USD/year"
    greenSpaceRatio?: number;
    greenSpaceRatioRationale?: string;
    monthlyTemperatures?: { month: string; temp: number }[];
    monthlyWinds?: { month: string; direction: string }[];
    // Detailed monthly wind rose (optional, preferred for accuracy)
    monthlyWindRose?: {
        speedBins: number[]; // m/s thresholds like [0,2,4,6,8,10,12]
        directionLabels?: string[]; // e.g., 16-sector: ['N','NNE',...]
        unit?: 'hours' | 'percent';
        totalPerMonth?: number; // if unit='hours', total observation hours per month
        months: {
            month: string; // Jan..Dec
            // For each direction sector, stacked frequencies by speed bin
            directionBins: {
                direction: string; // must be in directionLabels
                speedFrequencies: number[]; // length === speedBins.length - 1
            }[];
        }[];
    };
    monthlyRainfall?: { month: string; rainfall: number }[]; // in mm
    monthlyHumidity?: { month: string; humidity: number }[]; // in percentage
    climaticDataRationale?: string;
    rainfallRationale?: string;
    constructionMaterials?: string[];
    constructionStyle?: string;
    constructionRationale?: string;
    walkabilityScore?: number;
    walkabilityScoreRationale?: string;
    noiseLevel?: string;
    noiseLevelRationale?: string;
    floodRisk?: string;
    floodRiskRationale?: string;
    nearbyPOIs?: number;
    nearbyPOIsRationale?: string;
    proximityAnalysis?: ProximityItem[];
    amenityBreakdown?: AmenityBreakdown[]; // Categorized count of amenities
    caseStudyProjects?: CaseStudyProject[]; // Relevant case studies
    
    // Urban Context & Regulation
    zoningFAR?: number; // Floor Area Ratio (m²/m²)
    zoningFARRationale?: string;
    setbackLimits?: string; // e.g., "5m front, 3m side"
    setbackLimitsRationale?: string;
    heightLimit?: number; // in meters
    heightLimitRationale?: string;
    imperviousSurfaceRatio?: number; // percentage
    imperviousSurfaceRatioRationale?: string;
    utilityDistanceWater?: number; // meters to nearest water line
    utilityDistanceWaterRationale?: string;
    utilityDistanceSewer?: number; // meters
    utilityDistanceSewerRationale?: string;
    utilityDistanceElectricity?: number; // meters
    utilityDistanceElectricityRationale?: string;
    landValueIndex?: number; // € or local currency per m²
    landValueIndexRationale?: string;
    landValueUnit?: string; // e.g., "EUR/m²", "INR/m²"
    permitProcessingTime?: number; // days
    permitProcessingTimeRationale?: string;
    permitFees?: number; // in local currency
    permitFeesRationale?: string;
    permitFeesUnit?: string; // e.g., "EUR", "INR"
    
    // Microclimate & Environmental Comfort
    solarRadiation?: { orientation: string; kWhPerM2PerDay: number }[]; // by orientation
    solarRadiationRationale?: string;
    windSpeedRange?: string; // e.g., "2-5 m/s"
    windSpeedRangeRationale?: string;
    windDirectionSeasonal?: string; // e.g., "NW (winter), SE (summer)"
    windDirectionSeasonalRationale?: string;
    outdoorComfortHours?: number; // percentage of year
    outdoorComfortHoursRationale?: string;
    treeCanopyCoverage?: number; // percentage within 500m
    treeCanopyCoverageRationale?: string;
    airQualityPM25?: number; // PM 2.5 in µg/m³
    airQualityPM25Rationale?: string;
    airQualityNO2?: number; // NO₂ in µg/m³
    airQualityNO2Rationale?: string;
    noiseDay?: number; // average dB during day
    noiseDayRationale?: string;
    noiseNight?: number; // average dB at night
    noiseNightRationale?: string;
    groundPermeability?: string; // e.g., "High", "Medium", "Low"
    groundPermeabilityRationale?: string;
    
    // Mobility & Accessibility Metrics
    transitFrequency?: number; // buses/trams per hour
    transitFrequencyRationale?: string;
    cyclingInfrastructureDensity?: number; // meters of cycle track per km²
    cyclingInfrastructureDensityRationale?: string;
    fifteenMinuteCityIndex?: number; // percentage of essential services within 15 min walk
    fifteenMinuteCityIndexRationale?: string;
    parkingRatio?: number; // parking spaces per 1000 m²
    parkingRatioRationale?: string;
    connectivityScore?: number; // 0-100 based on amenities integration
    connectivityScoreRationale?: string;
    
    // Socio-Economic Fabric
    medianRent?: number; // € or local currency per m²
    medianRentRationale?: string;
    medianRentUnit?: string; // e.g., "EUR/m²/month"
    medianPropertyPrice?: number; // € or local currency per m²
    medianPropertyPriceRationale?: string;
    medianPropertyPriceUnit?: string; // e.g., "EUR/m²"
    householdSize?: number; // average
    householdSizeRationale?: string;
    employmentSectorSplit?: { sector: string; percentage: number }[]; // service/tech/industry
    employmentSectorSplitRationale?: string;
    educationIndex?: number; // percentage with tertiary degree
    educationIndexRationale?: string;
    populationDensity?: number; // people per km²
    populationDensityRationale?: string;
    annualGrowthRate?: number; // percentage
    annualGrowthRateRationale?: string;
    diversityMigrationIndex?: number; // 0-100 score
    diversityMigrationIndexRationale?: string;
}

export interface WebSource {
    uri: string;
    title: string;
}

export interface MapSource {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets?: {
            uri: string;
            title: string;
        }[];
    }[];
}

export interface Message {
    role: 'user' | 'model';
    text: string;
    sources?: { web?: WebSource, maps?: MapSource }[];
}

// Cost estimation types
export interface CostItem {
    category: string;
    item: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
}

export interface CostEstimate {
    items: CostItem[];
    subtotal: number;
    contingency: number; // percentage
    totalCost: number;
    constructionCost: number;
    maintenanceYearlyCost: number;
}

// Design alternative for comparison
export interface DesignAlternative {
    id: string;
    name: string;
    description: string;
    analysisResult: AnalysisSectionData[];
    quantitativeData: QuantitativeData | null;
    costEstimate: CostEstimate | null;
    createdAt: string;
}

// Design template
export interface DesignTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    elements?: string[];
    baseCosts?: { [key: string]: number };
    aiPrompt: string;
}

// Housing specific options
export interface HousingOptionsData {
    unitMix: string;
    incomeGroup: string;
    maxFloors: number;
}

// Conceptual Planner types
export interface PlanShape {
  id: string;
  type: 'rect' | 'polygon' | 'circle';
  x: number; // Bounding box top-left
  y: number; // Bounding box top-left
  width: number; // Bounding box width
  height: number; // Bounding box height
  rotation: number;
  fill: string;
  label: string;
  category: string;
  points?: { x: number; y: number }[]; // For polygons, relative to x/y
  floors?: number;
  floorHeight?: number;
  // New properties for custom styling
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  // FIX: Add missing properties for offset boundary feature
  isOffsetBoundary?: boolean;
  offsets?: number[];
  // Visibility toggle
  visible?: boolean; // If false, shape is hidden in the view
  // 3D object type for landscape elements
  objectType?: 'tree' | 'shrub' | 'bench' | 'kiosk' | 'playzone' | 'path' | 'lamp' | 'dustbin' | 'bikeparking' | 'fencing';
}

export interface ConceptualPlan {
  shapes: PlanShape[];
  previewImage?: string; // Data URL of the plan's visual representation
}


export interface ProjectData {
    id: string; // Unique ID for local storage
    name: string; // User-defined project name
    driveFileId?: string | null; // Google Drive file ID (legacy, can be removed)
    location: LocationData | null;
    analysisResult: AnalysisSectionData[];
    quantitativeData: QuantitativeData | null;
    chatHistory?: Message[];
    alternatives?: DesignAlternative[]; // Multiple design options
    currentAlternativeId?: string | null; // Which alternative is currently viewed
    costEstimate?: CostEstimate | null;
    conceptualPlan?: ConceptualPlan | null; // Data from the 2D conceptual planner
    conceptualCostEstimate?: CostEstimate | null;
    dashboardDisplayImage?: 'urban' | 'site' | 'street';
    lastSaved?: string; // ISO string of the last save time
    siteScreenshotBase64?: string | null; // Base64 of the site detail screenshot for context
    savedInsightCards?: SavedInsightCard[]; // Cards saved to dashboard
}

export interface SavedInsightCard {
    id: string;
    title: string;
    value: string | number;
    unit?: string;
    category: string; // e.g., "Demographics", "Climate", "Mobility"
    icon?: string;
    timestamp: string;
}

export interface ExtractedPdfStats {
    park_name: string;
    park_area_hectares: number;
    hardscape_percent: number;
    softscape_percent: number;
    tree_canopy_percent: number;
    building_height_stories: number;
    main_zones: string[];
    dominant_activities: string[];
    sun_exposure: string;
    access_points: string[];
    environmental_features: string[];
    summary: string;
}


// --- AI Layout Generator Types ---
export interface LayoutModule {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  type: 'rect' | 'polygon';
  points?: { x: number; y: number }[]; // For polygons, relative to its top-left corner (x, y)
}

export interface LayoutOption {
  id: string;
  description: string;
  modules: LayoutModule[];
  gfa: number;
  plotCoverage: number;
}

export interface GeneratedLayouts {
  projectType: string;
  subcategory: string;
  layoutOptions: LayoutOption[];
}

// User-configurable options for layout generation
export interface LayoutUserOptions {
    devModel?: 'Apartment' | 'Planned Society' | 'Mall' | 'Street Retail' | 'Office Tower' | 'Business Park' | 'Other';
    unitMix?: { [label: string]: number }; // counts per unit label
    roadWidth?: number; // meters for internal streets in community/park patterns
    // Genetic Algorithm specific (optional)
    floors?: number; // number of floors for apartment building
    totalUnits?: number; // target total units (all types)
    unitMixPercent?: { [label: string]: number }; // percentage distribution per unit type (should sum ~100)
    useGA?: boolean; // flag to trigger GA optimized generation
}

// Genetic Algorithm result metadata (optional extension)
export interface LayoutOptimizationMeta {
    algorithm?: 'GA' | 'rule-based';
    generations?: number;
    populationSize?: number;
    fitnessComponents?: {
        gfaScore: number;
        circulationScore: number;
        sunScore: number;
        mixScore: number;
        overall: number;
    };
}

export interface GAResultOption extends LayoutOption {
    meta?: LayoutOptimizationMeta;
}
