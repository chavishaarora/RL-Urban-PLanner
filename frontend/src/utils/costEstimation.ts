import { CostEstimate, CostItem, LocationData, DesignTemplate } from '../types';

/**
 * Breaks down high-level base costs into more granular line items based on industry-standard percentages.
 * @param baseCosts - The high-level cost categories from the template (e.g., { construction: 1200 }).
 * @param siteArea - The total area of the site in square meters.
 * @param templateName - The name of the design template.
 * @returns An array of detailed CostItem objects.
 */
const breakdownBaseCosts = (baseCosts: { [key: string]: number }, siteArea: number, templateName: string): CostItem[] => {
    const items: CostItem[] = [];
    const breakdownPercentages: { [key: string]: { [subKey: string]: number } } = {
        construction: { 'Substructure & Foundation': 0.15, 'Superstructure (Framing)': 0.40, 'Facade & Exterior Finishes': 0.25, 'MEP Systems': 0.20 },
        landscape: { 'Hardscape (Paving, Walkways)': 0.60, 'Softscape (Planting, Soil, Irrigation)': 0.40 },
        amenities: { 'Community Spaces (Lobby, Lounges)': 0.50, 'Recreational Facilities (Gym, Pool)': 0.30, 'Operational & Service Areas': 0.20 },
        infrastructure: { 'Utilities (Water, Power, Data)': 0.50, 'Site Access & Internal Roads': 0.50 },
        sustainability: { 'Renewable Energy Systems (Solar)': 0.60, 'Water Management (Harvesting, Swales)': 0.40 },
    };

    for (const [key, costPerSqm] of Object.entries(baseCosts)) {
        const totalCategoryCost = siteArea * costPerSqm;
        const breakdown = breakdownPercentages[key];

        const categoryName = key.charAt(0).toUpperCase() + key.slice(1);

        if (breakdown) {
            for (const [subItem, percentage] of Object.entries(breakdown)) {
                const subItemCost = totalCategoryCost * percentage;
                if (subItemCost > 0) {
                    items.push({
                        category: categoryName,
                        item: subItem,
                        quantity: siteArea,
                        unit: 'm²',
                        unitCost: costPerSqm * percentage,
                        totalCost: subItemCost,
                    });
                }
            }
        } else {
            // If no breakdown is defined, add it as a single line item.
            items.push({
                category: categoryName,
                item: `${templateName} - ${key}`,
                quantity: siteArea,
                unit: 'm²',
                unitCost: costPerSqm,
                totalCost: totalCategoryCost,
            });
        }
    }
    return items;
};


/**
 * Generate a cost estimate based on site area and design template
 */
export const generateCostEstimate = (
    siteArea: number, // in square meters
    template?: DesignTemplate
): CostEstimate => {
    let items: CostItem[] = [];
    
    if (template?.baseCosts) {
        items = breakdownBaseCosts(template.baseCosts, siteArea, template.name);
    } else if (template?.elements) {
        // FIX: The `elements` array now contains strings. We need to map them to objects with cost and type for the old logic to work.
        // This block serves as a fallback for older template formats that might not have `baseCosts`.
        const elementDetailsMap: { [key: string]: { type: string; estimatedCostPerUnit: number } } = {
            'Playground': { type: 'playground', estimatedCostPerUnit: 25000 },
            'Open Lawn': { type: 'lawn', estimatedCostPerUnit: 35 },
            'Seating Areas': { type: 'seating', estimatedCostPerUnit: 1500 },
            'Pathways': { type: 'paths', estimatedCostPerUnit: 120 },
            'Multi-Use Courts': { type: 'sports-court', estimatedCostPerUnit: 40000 },
            'Fitness Stations': { type: 'fitness-zone', estimatedCostPerUnit: 5000 },
            'Cycling Paths': { type: 'bike-path', estimatedCostPerUnit: 150 },
            'Shade Structures': { type: 'shelter', estimatedCostPerUnit: 8000 },
            'Raised Beds': { type: 'garden-beds', estimatedCostPerUnit: 80 },
            'Tool Shed': { type: 'shed', estimatedCostPerUnit: 3000 },
            'Community Garden': { type: 'garden-beds', estimatedCostPerUnit: 80 },
            'Dog Park': { type: 'dog-run-large', estimatedCostPerUnit: 10000 },
            'Urban Plaza': { type: 'paving', estimatedCostPerUnit: 150 },
            'Benches': { type: 'benches', estimatedCostPerUnit: 1200 },
            'Trees': { type: 'trees', estimatedCostPerUnit: 300 },
            'Water Feature': { type: 'water-feature', estimatedCostPerUnit: 15000 },
            'Boardwalks': { type: 'boardwalk', estimatedCostPerUnit: 300 },
            'Lighting': { type: 'lighting', estimatedCostPerUnit: 400 },
            'Furniture': { type: 'furniture', estimatedCostPerUnit: 500 },
        };

        template.elements.forEach(elementName => {
            // Create a temporary element object to work with the old logic's structure.
            const details = elementDetailsMap[elementName] || {
                type: elementName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                estimatedCostPerUnit: 10000 // Default cost for unmapped, likely complex items
            };

            const element = {
                type: details.type,
                label: elementName,
                estimatedCostPerUnit: details.estimatedCostPerUnit
            };

            let quantity = 0;
            let unit = '';
            let unitCost = element.estimatedCostPerUnit;
            
            switch (element.type) {
                case 'paths': case 'paving': case 'lawn': case 'wetland': case 'garden-beds':
                case 'native-plants': case 'sensory-garden': case 'dog-run-large': case 'dog-run-small':
                case 'sports-court':
                    quantity = siteArea * getAreaPercentage(element.type);
                    unit = 'm²';
                    break;
                case 'trees':
                    quantity = Math.floor(siteArea / 50);
                    unit = 'trees';
                    break;
                case 'benches': case 'seating':
                    quantity = Math.floor(siteArea / 100);
                    unit = 'units';
                    break;
                case 'playground': case 'agility': case 'shed': case 'kiosk': case 'shelter':
                case 'water-feature': case 'observation': case 'art': case 'boardwalk': case 'bike-path':
                    quantity = siteArea > 2000 ? 2 : 1;
                    unit = 'installation';
                    break;
                case 'fitness-zone': case 'exercise': case 'water-station': case 'compost':
                    quantity = Math.max(1, Math.floor(siteArea / 500));
                    unit = 'stations';
                    break;
                case 'lighting':
                    quantity = Math.floor(siteArea / 200);
                    unit = 'fixtures';
                    break;
                case 'furniture':
                    quantity = Math.floor(siteArea / 50);
                    unit = 'pieces';
                    break;
                default:
                    quantity = 1;
                    unit = 'item';
            }
            
            const totalCost = quantity * unitCost;
            
            if (quantity > 0) {
                items.push({
                    category: getCategoryForElement(element.type),
                    item: element.label,
                    quantity,
                    unit,
                    unitCost,
                    totalCost
                });
            }
        });
    } else {
        // Default generic estimate
        items.push(
            { category: 'Site Preparation', item: 'Clearing and Grading', quantity: siteArea, unit: 'm²', unitCost: 25, totalCost: siteArea * 25 },
            { category: 'Hardscape', item: 'Pathways and Paving', quantity: siteArea * 0.3, unit: 'm²', unitCost: 120, totalCost: siteArea * 0.3 * 120 },
            { category: 'Softscape', item: 'Lawn and Planting', quantity: siteArea * 0.5, unit: 'm²', unitCost: 35, totalCost: siteArea * 0.5 * 35 },
            { category: 'Amenities', item: 'Basic Amenities (Seating, Lighting)', quantity: 1, unit: 'lot', unitCost: 20000, totalCost: 20000, }
        );
    }
    
    if (!items.some(item => item.category === 'Site Preparation') && !template?.baseCosts) {
        items.unshift({
            category: 'Site Preparation',
            item: 'Clearing, Grading & Soil Preparation',
            quantity: siteArea,
            unit: 'm²',
            unitCost: 25,
            totalCost: siteArea * 25
        });
    }
    
    if (!items.some(item => item.category === 'Infrastructure') && !template?.baseCosts) {
        items.push({
            category: 'Infrastructure',
            item: 'Water, Drainage & Electrical',
            quantity: 1,
            unit: 'system',
            unitCost: Math.max(15000, siteArea * 8),
            totalCost: Math.max(15000, siteArea * 8)
        });
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);
    const contingency = 15; // 15% contingency
    const totalCost = subtotal * (1 + contingency / 100);
    
    const constructionCost = totalCost * 0.85;
    const maintenanceYearlyCost = constructionCost * 0.04;
    
    return {
        items,
        subtotal,
        contingency,
        totalCost,
        constructionCost,
        maintenanceYearlyCost
    };
};

// Helper function to get a more granular category for an element type
const getCategoryForElement = (type: string): string => {
    const categoryMap: { [key: string]: string } = {
        'paths': 'Hardscape', 'paving': 'Hardscape', 'boardwalk': 'Hardscape', 'bike-path': 'Hardscape', 'sports-court': 'Hardscape',
        'trees': 'Softscape', 'lawn': 'Softscape', 'native-plants': 'Softscape', 'garden-beds': 'Softscape', 'sensory-garden': 'Softscape', 'wetland': 'Softscape',
        'benches': 'Amenities - Seating', 'seating': 'Amenities - Seating', 'furniture': 'Amenities - Seating',
        'lighting': 'Amenities - Lighting',
        'water-feature': 'Amenities - Water Features',
        'water-station': 'Amenities - Utilities',
        'playground': 'Recreation - Play Areas',
        'agility': 'Recreation - Pet Areas',
        'fitness-zone': 'Recreation - Fitness',
        'exercise': 'Recreation - Fitness',
        'dog-run-large': 'Recreation - Pet Areas',
        'dog-run-small': 'Recreation - Pet Areas',
        'shed': 'Structures', 'kiosk': 'Structures', 'shelter': 'Structures', 'observation': 'Structures', 'art': 'Structures', 'compost': 'Structures'
    };
    return categoryMap[type] || 'Miscellaneous';
};

// Helper function to estimate area percentage for different elements
const getAreaPercentage = (type: string): number => {
    const percentages: { [key: string]: number } = {
        'paths': 0.25, 'paving': 0.40, 'lawn': 0.50, 'wetland': 0.60, 'garden-beds': 0.30,
        'native-plants': 0.45, 'sensory-garden': 0.20, 'dog-run-large': 0.40,
        'dog-run-small': 0.15, 'sports-court': 0.35, 'boardwalk': 0.15, 'bike-path': 0.20
    };
    return percentages[type] || 0.30;
};