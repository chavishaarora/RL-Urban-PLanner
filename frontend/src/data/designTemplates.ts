import { DesignTemplate } from '../types';

export const DESIGN_TEMPLATES: DesignTemplate[] = [
    // --- RECREATION ---
    {
        id: 'family-friendly-park',
        name: 'Family-Friendly Park',
        description: 'A welcoming space with play areas, seating, and open lawns perfect for families.',
        category: 'Recreation',
        elements: ['Playground', 'Open Lawn', 'Seating Areas', 'Pathways'],
        baseCosts: { construction: 180, landscape: 120, amenities: 90 },
        aiPrompt: 'Design a family-friendly park with a central playground for ages 2-12, curved pathways connecting seating areas under mature trees, and open lawn spaces for informal recreation. Include accessible routes and clear sightlines for supervision.'
    },
    {
        id: 'urban-pocket-park',
        name: 'Urban Pocket Park',
        description: 'A compact oasis with seating, green walls, and quiet spaces for relaxation.',
        category: 'Recreation',
        elements: ['Seating Alcoves', 'Vertical Gardens', 'Water Feature', 'Compact Design'],
        baseCosts: { construction: 220, landscape: 150, amenities: 100 },
        aiPrompt: 'Design a compact urban pocket park maximizing small space with vertical gardens, intimate seating alcoves, a small decorative water feature, and textured paving. Focus on creating a tranquil escape from the city with layered planting and ambient lighting.'
    },
    {
        id: 'active-sports-park',
        name: 'Active Sports & Fitness Park',
        description: 'Multi-sport facilities with courts, fitness stations, and cycling paths.',
        category: 'Recreation',
        elements: ['Multi-Use Courts', 'Fitness Stations', 'Cycling Paths', 'Shade Structures'],
        baseCosts: { construction: 250, amenities: 80, infrastructure: 70 },
        aiPrompt: 'Design an active sports park with a multi-use court for basketball/tennis, outdoor fitness stations with shade structures, dedicated cycling paths, and a perimeter tree buffer. Include water fountains and storage for equipment.'
    },
    {
        id: 'community-garden',
        name: 'Community Garden Hub',
        description: 'Raised beds, tool storage, and social gathering spaces for local residents.',
        category: 'Recreation',
        elements: ['Raised Beds', 'Tool Shed', 'Communal Area', 'Composting Station'],
        baseCosts: { infrastructure: 100, amenities: 60, landscape: 50 },
        aiPrompt: 'Design a community garden with organized raised beds, wide accessible paths, a central tool shed with water access, shaded communal seating area, composting station, and notice board. Include rain barrels and educational signage.'
    },
    {
        id: 'dog-park',
        name: 'Dog Park & Pet Area',
        description: 'Dedicated zones for large and small dogs, with agility equipment and water stations.',
        category: 'Recreation',
        elements: ['Fenced Zones', 'Agility Course', 'Water Stations', 'Shaded Seating'],
        baseCosts: { fencing: 50, surfacing: 70, amenities: 40, landscape: 20 },
        aiPrompt: 'Design a dog park with separate fenced areas for large and small dogs. Include agility elements like ramps and tunnels, a dog-friendly water fountain, durable ground cover (e.g., turf or wood chips), and shaded seating for owners. Ensure double-gated entry for safety.'
    },
    {
        id: 'urban-plaza',
        name: 'Urban Plaza & Gathering Space',
        description: 'A versatile open space for events, markets, and performances with integrated seating.',
        category: 'Recreation',
        elements: ['Open Plaza', 'Integrated Benches', 'Event Lighting', 'Flexible Space'],
        baseCosts: { paving: 200, seating: 150, lighting: 80, infrastructure: 120 },
        aiPrompt: 'Design a flexible urban plaza suitable for public gatherings, markets, and performances. Use high-quality paving, integrated benches and seat walls, feature lighting, and electrical hookups for events. Include space for temporary stages or food trucks.'
    },
    {
        id: 'ecological-wetland-park',
        name: 'Ecological Wetland Park',
        description: 'A natural habitat with boardwalks, native plantings, and stormwater management features.',
        category: 'Recreation',
        elements: ['Native Plants', 'Boardwalks', 'Stormwater Mgt.', 'Habitat Creation'],
        baseCosts: { earthworks: 80, planting: 150, boardwalks: 250, signage: 20 },
        aiPrompt: 'Design an ecological park focused on a created wetland for stormwater management and habitat creation. Include elevated boardwalks for observation, extensive native planting, and educational signage about the local ecosystem. Prioritize biodiversity and natural processes.'
    },
    {
        id: 'senior-wellness-garden',
        name: 'Senior Wellness Garden',
        description: 'A therapeutic space with accessible paths, sensory plants, and low-impact exercise stations.',
        category: 'Recreation',
        elements: ['Accessible Paths', 'Sensory Plants', 'Low-Impact Fitness', 'Shaded Seating'],
        baseCosts: { pathways: 130, planting: 100, seating: 120, exercise: 90 },
        aiPrompt: 'Design a senior wellness garden with wide, smooth, and gently sloped accessible pathways. Incorporate raised planters with sensory plants (scent, touch), ample shaded seating with backrests and armrests, and low-impact fitness stations. Ensure the design is peaceful, safe, and comfortable.'
    },
    
    // --- HOUSING ---
    {
        id: "low-density-villa-enclave",
        name: "Low-Density Villa Enclave",
        category: "Housing",
        description: "Independent villas with private gardens and shared community facilities.",
        elements: ['Private Gardens', 'Community Club', 'Cul-de-sacs', 'Pedestrian Paths'],
        aiPrompt: `Design a low-density residential enclave with detached villas, 40% built-up, 35% green, 25% roads. Ensure privacy, cul-de-sac road layout, and clear pedestrian-vehicle separation.`,
        baseCosts: { construction: 1350, landscape: 120, amenities: 300 },
    },
    {
        id: "mid-rise-apartment-cluster",
        name: "Mid-Rise Apartment Cluster",
        category: "Housing",
        description: "6–8 storey apartment blocks arranged around a shared courtyard.",
        elements: ['Shared Courtyard', 'Underground Parking', 'Natural Daylight', '6-8 Storeys'],
        aiPrompt: `Create mid-rise housing with efficient floor plates, central courtyard, and 20% green area. Provide underground parking, fire tender access, and natural daylight for all units.`,
        baseCosts: { construction: 1200, landscape: 90, amenities: 350 },
    },
    {
        id: "high-rise-residential-tower",
        name: "High-Rise Residential Tower",
        category: "Housing",
        description: "Multi-tower complex with amenities deck and podium parking.",
        elements: ['Podium Amenities', 'Multi-Tower', 'Podium Parking', 'High-Rise'],
        aiPrompt: `Design vertical living towers with podium-level gardens and clubhouse. Maintain 6m fire clearance and daylight for all facades.`,
        baseCosts: { construction: 1500, amenities: 500, infrastructure: 200 },
    },
    {
        id: "affordable-housing-block",
        name: "Affordable Housing Block",
        category: "Housing",
        description: "Compact apartments designed for economic efficiency and maximum light.",
        elements: ['Compact Units', 'Cross Ventilation', 'Shared Courtyards', 'High Density'],
        aiPrompt: `Design affordable housing with 2BHK units on 45–60m² average. Target high density but adequate cross ventilation and courtyards.`,
        baseCosts: { construction: 950, amenities: 150, infrastructure: 100 },
    },
    {
        id: "student-housing-pod",
        name: "Student Housing Pod",
        category: "Housing",
        description: "Compact modular units with shared kitchens and lounges.",
        elements: ['Modular Pods', 'Shared Kitchens', 'Study Lounges', 'Bike Parking'],
        aiPrompt: `Design student accommodation with modular pods grouped around shared courtyards and study lounges. Include bike parking and shaded social zones.`,
        baseCosts: { construction: 900, amenities: 250, energy: 70 },
    },
    {
        id: "senior-wellness-housing",
        name: "Senior Wellness Housing",
        category: "Housing",
        description: "Barrier-free living for senior citizens with medical and recreational facilities.",
        elements: ['Barrier-Free', 'Therapeutic Gardens', 'Medical Facilities', 'Accessible'],
        aiPrompt: `Design low-rise units connected by accessible pathways, therapeutic gardens, and community halls. Ensure 100% accessibility, ramps, and 1.8m-wide corridors.`,
        baseCosts: { construction: 1100, landscape: 150, amenities: 280 },
    },
    {
        id: "co-living-urban-block",
        name: "Co-Living Urban Block",
        category: "Housing",
        description: "Flexible living modules for professionals, with shared kitchens and lounges.",
        elements: ['Shared Kitchens', 'Coworking Space', 'Shared Terraces', 'Flexible Layouts'],
        aiPrompt: `Create co-living units organized in clusters with shared kitchens, coworking, and gym. Focus on natural light, shared terraces, and flexible partitions.`,
        baseCosts: { construction: 1150, amenities: 320, energy: 80 },
    },
    {
        id: "eco-housing-community",
        name: "Eco-Housing Community",
        category: "Housing",
        description: "Sustainable housing complex using passive cooling and renewable energy.",
        elements: ['Rainwater Harvest', 'Solar Panels', 'Bio-Swales', 'Green Materials'],
        aiPrompt: `Design housing using renewable materials, rainwater harvesting, and solar panels. Limit hardscape to 20%, use bio-swales and porous paving.`,
        baseCosts: { construction: 1250, sustainability: 150, amenities: 200 },
    },
    {
        id: "mixed-income-housing",
        name: "Mixed-Income Housing",
        category: "Housing",
        description: "Integrated residential blocks with varied unit types and shared facilities.",
        elements: ['Varied Unit Types', 'Shared Greens', 'Retail Edge', 'Walkable Streets'],
        aiPrompt: `Design mixed-income community with EWS, LIG, and MIG units. Include shared greens, crèche, retail edge, and walkable streets.`,
        baseCosts: { construction: 1050, landscape: 110, amenities: 250 },
    },

    // --- INDUSTRIAL ---
    {
        id: "light-manufacturing-park",
        name: "Light Manufacturing Park",
        category: "Industrial",
        description: "Clean production units with integrated utilities and admin block.",
        elements: ['Modular Sheds', 'Truck Access', 'Loading Docks', 'Admin Block'],
        aiPrompt: `Plan modular sheds (1000–2000 m²) with 20m road access and truck turning radius. Include fire exits, loading docks, and 10% landscaped buffers.`,
        baseCosts: { construction: 900, infrastructure: 200, safety: 80 },
    },
    {
        id: "heavy-industry-complex",
        name: "Heavy Industry Complex",
        category: "Industrial",
        description: "Large-scale production and assembly lines with logistics corridors.",
        elements: ['Large Plots', 'HGV Circulation', 'Utility Yards', 'Buffer Zones'],
        aiPrompt: `Design industrial zone with 60% plot coverage, 20m buffer, and internal circulation for HGVs. Include chimneys, utility yards, and 2 access gates.`,
        baseCosts: { construction: 1100, infrastructure: 300, energy: 150 },
    },
    {
        id: "warehouse-logistics-hub",
        name: "Warehouse & Logistics Hub",
        category: "Industrial",
        description: "Distribution warehouses with truck docks and stacking areas.",
        elements: ['Truck Docks', 'High Ceilings', 'Solar Roofs', 'Office Mezzanine'],
        aiPrompt: `Design warehouses (30m span) with docks on both sides, wide turning radius, and solar roof. Include office mezzanine and truck lay-by area.`,
        baseCosts: { construction: 800, infrastructure: 250, logistics: 100 },
    },
    {
        id: "recycling-material-recovery-plant",
        name: "Recycling & Material Recovery Plant",
        category: "Industrial",
        description: "Material segregation and processing facility integrated with renewable systems.",
        elements: ['Sorting Zones', 'Conveyor Lines', 'Compost Yard', 'Water Recycling'],
        aiPrompt: `Plan covered sorting zones, conveyor lines, and composting yard. Include water recycling, biogas, and waste storage zones.`,
        baseCosts: { construction: 950, sustainability: 180, infrastructure: 150 },
    },
    {
        id: "renewable-tech-campus",
        name: "Renewable Tech Campus",
        category: "Industrial",
        description: "Hybrid zone for solar, battery, and EV manufacturing.",
        elements: ['Modular Blocks', 'Green Corridors', 'Training Center', 'Testing Labs'],
        aiPrompt: `Design modular manufacturing blocks with solar roofs and green corridors. Include training center, assembly yard, and testing labs.`,
        baseCosts: { construction: 1200, sustainability: 220, amenities: 100 },
    },
    {
        id: "agro-processing-park",
        name: "Agro-Processing Park",
        category: "Industrial",
        description: "Cold storage, milling, and packaging units with rural employment focus.",
        elements: ['Cold Storage', 'Milling Units', 'Packaging Units', 'Logistics Spine'],
        aiPrompt: `Design agro-processing units around a shared cold chain and logistics spine. Include solar driers, warehouses, and water management.`,
        baseCosts: { construction: 950, infrastructure: 200, energy: 100 },
    },
    {
        id: "bio-tech-research-park",
        name: "Bio-Tech Research Park",
        category: "Industrial",
        description: "Clean labs, R&D units, and incubators for biotech firms.",
        elements: ['Clean Labs', 'R&D Units', 'Incubators', 'Collaborative Space'],
        aiPrompt: `Plan modular lab blocks with 50% open green. Ensure controlled environments, safe effluent systems, and collaborative spaces.`,
        baseCosts: { construction: 1300, amenities: 250, safety: 120 },
    },
    {
        id: "circular-industry-cluster",
        name: "Circular Industry Cluster",
        category: "Industrial",
        description: "Shared manufacturing ecosystem using waste exchange networks.",
        elements: ['Waste Exchange', 'Resource Recovery', 'Monitoring Center', 'Reuse Depot'],
        aiPrompt: `Design a cluster where waste of one unit becomes raw material for another. Include resource recovery hubs, monitoring center, and reuse depot.`,
        baseCosts: { construction: 1000, sustainability: 200, infrastructure: 250 },
    },

    // --- COMMERCIAL ---
    {
        id: "high-street-retail-spine",
        name: "High-Street Retail Spine",
        category: "Commercial",
        description: "Linear retail street with plazas and active frontages.",
        elements: ['Active Frontages', 'Shaded Arcades', 'Seating Plazas', 'Pedestrian-Friendly'],
        aiPrompt: `Design a pedestrian-friendly retail boulevard with 2–3 storey shops, shaded arcades, and seating plazas. Include parking pockets and food kiosks.`,
        baseCosts: { construction: 1300, landscape: 100, amenities: 250 },
    },
    {
        id: "business-park-campus",
        name: "Business Park Campus",
        category: "Commercial",
        description: "Office clusters within landscaped environment.",
        elements: ['Office Clusters', 'Landscaped Courts', 'EV Parking', 'Solar Pergolas'],
        aiPrompt: `Create 4–5 office blocks around a green courtyard, with shaded walkways and water features. Provide EV parking and solar pergolas.`,
        baseCosts: { construction: 1500, landscape: 150, energy: 100 },
    },
    {
        id: "tech-innovation-hub",
        name: "Tech Innovation Hub",
        category: "Commercial",
        description: "R&D and startup incubator spaces with shared labs and conference facilities.",
        elements: ['Flexible Workspaces', 'Shared Labs', 'Amphitheater', 'Open Terraces'],
        aiPrompt: `Design flexible workspaces with co-working labs, open terraces, and amphitheater. Ensure daylight optimization and natural ventilation.`,
        baseCosts: { construction: 1400, amenities: 300, infrastructure: 120 },
    },
    {
        id: "urban-mall-leisure-center",
        name: "Urban Mall & Leisure Center",
        category: "Commercial",
        description: "Retail mall with food courts, multiplex, and green terraces.",
        elements: ['Retail Atrium', 'Food Courts', 'Multiplex', 'Rooftop Deck'],
        aiPrompt: `Design vertical mall with atrium skylight, multi-level parking, and roof leisure deck. Include outdoor spill-out and pedestrian promenade.`,
        baseCosts: { construction: 1600, amenities: 400, energy: 150 },
    },
    {
        id: "mixed-use-tower-block",
        name: "Mixed-Use Tower Block",
        category: "Commercial",
        description: "Vertical block combining offices, retail, and residential units.",
        elements: ['Retail Base', 'Office Floors', 'Residential Units', 'Rooftop Lounge'],
        aiPrompt: `Design a 20–25 storey tower with retail base, 10 floors office, 8 floors housing, and rooftop lounge. Ensure fire safety and vertical zoning clarity.`,
        baseCosts: { construction: 1700, amenities: 350, infrastructure: 200 },
    },
    {
        id: "convention-expo-center",
        name: "Convention & Expo Center",
        category: "Commercial",
        description: "Large-span exhibition halls with conference facilities and green forecourts.",
        elements: ['Exhibition Halls', 'Conference Rooms', 'Green Forecourts', 'Large Span'],
        aiPrompt: `Plan modular halls with 40m spans, pre-function spaces, and shaded entrance plazas. Integrate parking and service roads separately.`,
        baseCosts: { construction: 1450, infrastructure: 200, amenities: 250 },
    },
    {
        id: "hospitality-resort-complex",
        name: "Hospitality & Resort Complex",
        category: "Commercial",
        description: "Eco-resort with cottages, banquet, and wellness facilities.",
        elements: ['Cottage Clusters', 'Central Pool', 'Wellness Spa', 'Banquet Hall'],
        aiPrompt: `Design resort layout with clusters of cottages, central pool, and spa. Use natural materials, contour-sensitive design, and local vegetation.`,
        baseCosts: { construction: 1300, landscape: 250, sustainability: 150 },
    },
    {
        id: "transit-oriented-retail-node",
        name: "Transit-Oriented Retail Node",
        category: "Commercial",
        description: "Commercial node integrated with metro or bus terminal.",
        elements: ['Direct Transit Access', 'Mixed Commercial', 'Shaded Connectors', 'Compact Design'],
        aiPrompt: `Plan compact retail and office mix with direct access to transit station. Ensure 60% built-up, 20% open, 20% circulation, with shaded connectors.`,
        baseCosts: { construction: 1400, infrastructure: 150, amenities: 180 },
    },
    {
        id: "creative-art-culture-center",
        name: "Creative Art & Culture Center",
        category: "Commercial",
        description: "Cultural and performance hub with studios, galleries, and amphitheater.",
        elements: ['Flexible Galleries', 'Artist Studios', 'Amphitheater', 'Performance Space'],
        aiPrompt: `Design flexible galleries, small studios, and outdoor performance stage. Ensure 30% open amphitheater and night lighting effects.`,
        baseCosts: { construction: 1200, amenities: 250, landscape: 200 },
    },
];


export const getTemplateById = (id: string): DesignTemplate | undefined => {
    return DESIGN_TEMPLATES.find(t => t.id === id);
};

export const getTemplatesByCategory = (category: string): DesignTemplate[] => {
    return DESIGN_TEMPLATES.filter(t => t.category === category);
};

export const getAllCategories = (): string[] => {
    return Array.from(new Set(DESIGN_TEMPLATES.map(t => t.category)));
};