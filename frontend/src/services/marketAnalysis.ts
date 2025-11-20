/**
 * Market Analysis Service
 * Analyzes competition and market opportunities for businesses
 * Uses Google Places API for accurate, up-to-date business data
 */

import { getCachedData, setCachedData } from './osmCache';

declare const google: any;

export interface Competitor {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: number; // meters from site center
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number; // 0-4 (free to very expensive)
  openingHours?: string;
  phoneNumber?: string;
  website?: string;
  tags: Record<string, any>;
  source: 'google' | 'osm';
}

export interface MarketAnalysisResult {
  competitors: Competitor[];
  totalCount: number;
  nearestDistance: number;
  averageDistance: number;
  densityScore: number; // 0-10
  opportunityScore: number; // 0-10
  marketGaps: { lat: number; lng: number; radius: number }[];
  insights: string[];
  analytics?: MarketAnalytics; // Premium feature
}

export interface MarketAnalytics {
  averageRating: number;
  totalReviews: number;
  priceDistribution: { level: number; count: number }[];
  peakHours: { hour: number; popularity: number }[];
  dayOfWeekDistribution: { day: string; averagePopularity: number }[];
  openNowCount: number;
  hasPhotosCount: number;
}

// Map business types to OSM amenity/shop/office/leisure tags
const BUSINESS_TYPE_MAPPING: Record<string, { 
  amenity?: string[]; 
  shop?: string[]; 
  office?: string[];
  leisure?: string[];
}> = {
  // Food & Beverage
  'Restaurant': { amenity: ['restaurant', 'bistro'] },
  'Cafe': { amenity: ['cafe'], shop: ['coffee'] },
  'Fast Food': { amenity: ['fast_food'] },
  'Bar & Nightlife': { amenity: ['bar', 'pub', 'nightclub', 'biergarten'] },
  'Bakery & Pastry': { shop: ['bakery', 'pastry', 'confectionery'], amenity: ['bakery'] },
  'Ice Cream & Desserts': { amenity: ['ice_cream'], shop: ['ice_cream', 'chocolate', 'confectionery'] },
  'Food Court': { amenity: ['food_court'] },
  
  // Retail
  'Supermarket & Grocery': { shop: ['supermarket', 'grocery', 'greengrocer', 'butcher', 'seafood', 'convenience'] },
  'Pharmacy & Drugstore': { amenity: ['pharmacy'], shop: ['chemist'] },
  'Clothing & Fashion': { shop: ['clothes', 'fashion', 'boutique', 'shoes', 'jewelry'] },
  'Electronics & Tech': { shop: ['electronics', 'computer', 'mobile_phone'] },
  'Home & Furniture': { shop: ['furniture', 'interior_decoration', 'houseware'] },
  'Bookstore': { shop: ['books', 'stationery'] },
  
  // Services
  'Salon & Spa': { shop: ['hairdresser', 'beauty', 'barber', 'massage'], amenity: ['spa'] },
  'Fitness & Gym': { 
    amenity: ['gym', 'fitness_centre', 'sports_centre'], 
    shop: ['sports', 'fitness'], 
    leisure: ['fitness_centre', 'sports_centre', 'fitness_station'] 
  },
  'Laundry & Dry Cleaning': { shop: ['laundry', 'dry_cleaning'], amenity: ['laundry'] },
  'Car Services': { 
    amenity: ['car_wash', 'charging_station', 'fuel', 'parking'], 
    shop: ['car_repair', 'car', 'car_parts', 'tyres'] 
  },
  'Bank & Finance': { amenity: ['bank', 'atm', 'bureau_de_change'] },
  'Post Office': { amenity: ['post_office', 'post_box'] },
  'Real Estate Office': { shop: ['estate_agent'], office: ['estate_agent', 'property_management'] },
  'Travel Agency': { shop: ['travel_agency'], office: ['travel_agent'] },
  'Professional Services': { 
    office: ['lawyer', 'accountant', 'insurance', 'consulting', 'financial', 'tax_advisor', 'architect', 'engineer'] 
  },
  'Business Center': { 
    office: ['coworking', 'serviced_offices'], 
    amenity: ['coworking_space', 'conference_centre'] 
  },
  
  // Healthcare
  'Hospital': { amenity: ['hospital'] },
  'Clinic & Doctor': { amenity: ['clinic', 'doctors'] },
  'Dentist': { amenity: ['dentist'] },
  'Pharmacy': { amenity: ['pharmacy'], shop: ['chemist', 'medical_supply'] },
  'Veterinary': { amenity: ['veterinary'] },
  'Physiotherapy': { amenity: ['physiotherapy'] },
  'Optician': { shop: ['optician'] },
  
  // Education & Entertainment
  'School & Kindergarten': { amenity: ['school', 'kindergarten'] },
  'University & College': { amenity: ['university', 'college'] },
  'Library': { amenity: ['library'] },
  'Cinema & Theater': { amenity: ['cinema', 'theatre'] },
  'Museum & Gallery': { amenity: ['museum', 'gallery', 'arts_centre'] },
  'Sports Facility': { amenity: ['sports_centre', 'stadium', 'swimming_pool'] },
  'Park & Recreation': { amenity: ['park'], shop: ['sports'] },
  'Coworking Space': { amenity: ['coworking_space'], shop: ['office_supplies'] },
};

// Map business types to Google Places types
const GOOGLE_PLACES_TYPE_MAPPING: Record<string, string[]> = {
  // Food & Beverage
  'Restaurant': ['restaurant'],
  'Cafe': ['cafe', 'coffee_shop'],
  'Fast Food': ['meal_takeaway', 'meal_delivery'],
  'Bar & Nightlife': ['bar', 'night_club'],
  'Bakery & Pastry': ['bakery'],
  'Ice Cream & Desserts': ['ice_cream_shop', 'dessert_shop'],
  'Food Court': ['food_court'],
  
  // Retail
  'Supermarket & Grocery': ['supermarket', 'grocery_or_supermarket', 'convenience_store'],
  'Pharmacy & Drugstore': ['pharmacy', 'drugstore'],
  'Clothing & Fashion': ['clothing_store', 'shoe_store', 'jewelry_store'],
  'Electronics & Tech': ['electronics_store', 'computer_store', 'mobile_phone_shop'],
  'Home & Furniture': ['furniture_store', 'home_goods_store'],
  'Bookstore': ['book_store'],
  
  // Services
  'Salon & Spa': ['hair_care', 'beauty_salon', 'spa'],
  'Fitness & Gym': ['gym', 'fitness_center'],
  'Laundry & Dry Cleaning': ['laundry'],
  'Car Services': ['car_wash', 'car_repair', 'gas_station', 'parking'],
  'Bank & Finance': ['bank', 'atm', 'finance'],
  'Post Office': ['post_office'],
  'Real Estate Office': ['real_estate_agency'],
  'Travel Agency': ['travel_agency'],
  'Professional Services': ['lawyer', 'accounting', 'insurance_agency'],
  'Business Center': ['business_center'],
  
  // Healthcare
  'Hospital': ['hospital'],
  'Clinic & Doctor': ['doctor', 'health'],
  'Dentist': ['dentist'],
  'Pharmacy': ['pharmacy'],
  'Veterinary': ['veterinary_care'],
  'Physiotherapy': ['physiotherapist'],
  'Optician': ['eye_care', 'optician'],
  
  // Education & Entertainment
  'School & Kindergarten': ['school', 'primary_school', 'secondary_school'],
  'University & College': ['university'],
  'Library': ['library'],
  'Cinema & Theater': ['movie_theater'],
  'Museum & Gallery': ['museum', 'art_gallery'],
  'Sports Facility': ['stadium', 'sports_complex'],
  'Park & Recreation': ['park'],
  'Coworking Space': ['coworking_space'],
};

/**
 * Fetch competitors from Google Places API
 */
async function fetchGooglePlacesCompetitors(
  center: { lat: number; lng: number },
  businessType: string,
  radiusMeters: number = 800
): Promise<Competitor[]> {
  return new Promise((resolve) => {
    try {
      if (!google?.maps?.places?.PlacesService) {
        console.warn('Google Places API not available, falling back to OSM');
        resolve([]);
        return;
      }

      const placeTypes = GOOGLE_PLACES_TYPE_MAPPING[businessType];
      if (!placeTypes || placeTypes.length === 0) {
        resolve([]);
        return;
      }

      const tempDiv = document.createElement('div');
      const service = new google.maps.places.PlacesService(tempDiv);

      const request = {
        location: new google.maps.LatLng(center.lat, center.lng),
        radius: radiusMeters,
        type: placeTypes[0], // Google only allows one type per request
      };

      service.nearbySearch(request, (results: any[], status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const competitors: Competitor[] = results
            .filter(place => place.geometry?.location)
            .map(place => {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const distance = calculateDistance(center.lat, center.lng, lat, lng);

              return {
                id: place.place_id || `gplace-${Math.random()}`,
                name: place.name || 'Unknown',
                type: businessType,
                lat,
                lng,
                distance,
                rating: place.rating,
                userRatingsTotal: place.user_ratings_total,
                priceLevel: place.price_level,
                openingHours: place.opening_hours?.open_now ? 'Open' : 'Closed',
                tags: {
                  vicinity: place.vicinity,
                  types: place.types,
                },
                source: 'google' as const,
              };
            });

          resolve(competitors);
        } else {
          console.warn('Google Places API request failed:', status);
          resolve([]);
        }
      });
    } catch (error) {
      console.error('Error fetching Google Places:', error);
      resolve([]);
    }
  });
}

/**
 * Fetch competitors from OSM (fallback)
 */
async function fetchOSMCompetitors(
  center: { lat: number; lng: number },
  businessType: string,
  radiusMeters: number = 800
): Promise<Competitor[]> {
  // Check cache
  const cacheKey = `${businessType}-${radiusMeters}`;
  const cached = getCachedData<Competitor[]>(center, radiusMeters, cacheKey);
  if (cached) return cached;

  const mapping = BUSINESS_TYPE_MAPPING[businessType];
  if (!mapping) return [];

  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };

  // Build Overpass query - each tag combination as separate query
  const queries: string[] = [];
  
  if (mapping.amenity) {
    mapping.amenity.forEach(amenityValue => {
      queries.push(`node["amenity"="${amenityValue}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`);
    });
  }
  
  if (mapping.shop) {
    mapping.shop.forEach(shopValue => {
      queries.push(`node["shop"="${shopValue}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`);
    });
  }
  
  if (mapping.office) {
    mapping.office.forEach(officeValue => {
      queries.push(`node["office"="${officeValue}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`);
    });
  }
  
  if (mapping.leisure) {
    mapping.leisure.forEach(leisureValue => {
      queries.push(`node["leisure"="${leisureValue}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`);
    });
  }

  const query = `[out:json][timeout:15];(${queries.join('')});out body;`;

  try {
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    let data = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ data: query })
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!data || !data.elements) return [];

    // Process competitors
    const competitors: Competitor[] = data.elements
      .filter((el: any) => el.type === 'node' && el.lat && el.lon)
      .map((el: any) => {
        const distance = calculateDistance(center.lat, center.lng, el.lat, el.lon);
        const name = el.tags?.name || el.tags?.brand || `Unnamed ${businessType}`;
        
        return {
          id: `osm-n${el.id}`,
          name,
          type: businessType,
          lat: el.lat,
          lng: el.lon,
          distance: Math.round(distance),
          tags: el.tags || {},
          source: 'osm' as const,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    // Cache result
    setCachedData(center, radiusMeters, cacheKey, competitors);

    return competitors;
  } catch (error) {
    console.error('Error fetching competitors:', error);
    return [];
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Merge and deduplicate competitors from Google Places and OSM
 */
function mergeCompetitors(googleCompetitors: Competitor[], osmCompetitors: Competitor[]): Competitor[] {
  const merged = [...googleCompetitors];
  const googlePositions = new Set(
    googleCompetitors.map(c => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`)
  );

  // Add OSM competitors that aren't duplicates
  osmCompetitors.forEach(osm => {
    const posKey = `${osm.lat.toFixed(5)},${osm.lng.toFixed(5)}`;
    if (!googlePositions.has(posKey)) {
      merged.push(osm);
    }
  });

  return merged.sort((a, b) => a.distance - b.distance);
}

/**
 * Fetch competitors (hybrid: Google Places + OSM fallback)
 */
export async function fetchCompetitors(
  center: { lat: number; lng: number },
  businessType: string,
  radiusMeters: number = 800,
  usePremium: boolean = true
): Promise<Competitor[]> {
  // Check cache first
  const cacheKey = `${usePremium ? 'google' : 'osm'}-${businessType}-${radiusMeters}`;
  const cached = getCachedData<Competitor[]>(center, radiusMeters, cacheKey);
  if (cached) return cached;

  // If Free mode (OSM only)
  if (!usePremium) {
    console.log(`Using Free (OSM only) mode for ${businessType}`);
    return await fetchOSMCompetitors(center, businessType, radiusMeters);
  }

  // Premium mode: Try Google Places first (better data)
  const googleCompetitors = await fetchGooglePlacesCompetitors(center, businessType, radiusMeters);
  
  // If Google returns good results, use those
  if (googleCompetitors.length > 0) {
    // Also fetch OSM as supplement
    const osmCompetitors = await fetchOSMCompetitors(center, businessType, radiusMeters);
    const merged = mergeCompetitors(googleCompetitors, osmCompetitors);
    
    // Cache the merged result
    setCachedData(center, radiusMeters, cacheKey, merged);
    return merged;
  }
  
  // Fallback to OSM only if Google fails
  console.log(`Using OSM fallback for ${businessType}`);
  return await fetchOSMCompetitors(center, businessType, radiusMeters);
}

/**
 * Generate market analytics from Google Places data (Premium feature)
 */
function generateMarketAnalytics(competitors: Competitor[]): MarketAnalytics | undefined {
  // Only generate analytics if we have Google Places data
  const googleCompetitors = competitors.filter(c => c.source === 'google' && c.rating);
  
  if (googleCompetitors.length === 0) {
    return undefined;
  }

  // Average rating
  const averageRating = googleCompetitors.reduce((sum, c) => sum + (c.rating || 0), 0) / googleCompetitors.length;
  
  // Total reviews
  const totalReviews = googleCompetitors.reduce((sum, c) => sum + (c.userRatingsTotal || 0), 0);
  
  // Price level distribution
  const priceDistribution: { level: number; count: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const count = googleCompetitors.filter(c => c.priceLevel === i).length;
    if (count > 0) {
      priceDistribution.push({ level: i, count });
    }
  }
  
  // Simulated peak hours (based on typical business patterns)
  // Note: Real popular_times data requires Places API Details call with place_id
  const peakHours = generateSimulatedPeakHours(competitors[0]?.type || 'Business');
  
  // Day of week distribution (simulated based on business type)
  const dayOfWeekDistribution = generateDayDistribution(competitors[0]?.type || 'Business');
  
  // Count places that are currently open
  const openNowCount = competitors.filter(c => c.openingHours === 'Open').length;
  
  // Count places with photos (assume Google Places have photos)
  const hasPhotosCount = googleCompetitors.length;

  return {
    averageRating,
    totalReviews,
    priceDistribution,
    peakHours,
    dayOfWeekDistribution,
    openNowCount,
    hasPhotosCount,
  };
}

/**
 * Generate simulated peak hours based on business type
 */
function generateSimulatedPeakHours(businessType: string): { hour: number; popularity: number }[] {
  const hours = [];
  
  // Different patterns for different business types
  const isFood = businessType.includes('Restaurant') || businessType.includes('Cafe') || businessType.includes('Bar');
  const isRetail = businessType.includes('Store') || businessType.includes('Shop') || businessType.includes('Mall');
  const isService = businessType.includes('Gym') || businessType.includes('Salon') || businessType.includes('Bank');
  
  for (let hour = 0; hour < 24; hour++) {
    let popularity = 0;
    
    if (isFood) {
      // Peak at lunch (12-14) and dinner (19-21)
      if (hour >= 12 && hour <= 14) popularity = 70 + Math.random() * 30;
      else if (hour >= 19 && hour <= 21) popularity = 80 + Math.random() * 20;
      else if (hour >= 8 && hour <= 22) popularity = 30 + Math.random() * 40;
      else popularity = Math.random() * 20;
    } else if (isRetail) {
      // Peak in afternoon/evening
      if (hour >= 15 && hour <= 20) popularity = 60 + Math.random() * 40;
      else if (hour >= 10 && hour <= 22) popularity = 40 + Math.random() * 30;
      else popularity = Math.random() * 20;
    } else if (isService) {
      // Peak in morning and after work
      if (hour >= 7 && hour <= 9) popularity = 60 + Math.random() * 30;
      else if (hour >= 17 && hour <= 19) popularity = 70 + Math.random() * 30;
      else if (hour >= 10 && hour <= 20) popularity = 40 + Math.random() * 30;
      else popularity = Math.random() * 15;
    } else {
      // Default pattern
      if (hour >= 9 && hour <= 18) popularity = 50 + Math.random() * 40;
      else popularity = Math.random() * 30;
    }
    
    hours.push({ hour, popularity: Math.round(popularity) });
  }
  
  return hours;
}

/**
 * Generate day of week distribution
 */
function generateDayDistribution(businessType: string): { day: string; averagePopularity: number }[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const isFood = businessType.includes('Restaurant') || businessType.includes('Cafe') || businessType.includes('Bar');
  
  return days.map((day, index) => {
    let popularity = 50;
    
    if (isFood) {
      // Restaurants busier on weekends
      if (index >= 5) popularity = 80 + Math.random() * 20; // Sat-Sun
      else if (index >= 3) popularity = 70 + Math.random() * 20; // Thu-Fri
      else popularity = 50 + Math.random() * 20;
    } else {
      // Retail/services busier on weekends
      if (index >= 5) popularity = 75 + Math.random() * 20;
      else popularity = 55 + Math.random() * 20;
    }
    
    return { day, averagePopularity: Math.round(popularity) };
  });
}

/**
 * Analyze market opportunity
 */
export function analyzeMarket(
  competitors: Competitor[],
  center: { lat: number; lng: number },
  radiusMeters: number = 800,
  isPremium: boolean = false
): MarketAnalysisResult {
  const totalCount = competitors.length;
  const nearestDistance = competitors.length > 0 ? competitors[0].distance : radiusMeters;
  const averageDistance = totalCount > 0
    ? competitors.reduce((sum, c) => sum + c.distance, 0) / totalCount
    : radiusMeters;

  // Calculate density score (0-10, higher = more saturated)
  // 0 competitors = 0, 1 per 100m = 5, >1 per 50m = 10
  const competitorsPerMeter = totalCount / radiusMeters;
  const densityScore = Math.min(10, competitorsPerMeter * 500);

  // Calculate opportunity score (0-10, higher = better opportunity)
  let opportunityScore = 10;
  
  // Factor 1: Competition density (inverse relationship)
  opportunityScore -= densityScore * 0.4;
  
  // Factor 2: Nearest competitor distance (closer = worse)
  if (nearestDistance < 100) opportunityScore -= 3;
  else if (nearestDistance < 200) opportunityScore -= 1.5;
  else if (nearestDistance > 400) opportunityScore += 2;
  
  // Factor 3: Market gaps (areas with no coverage)
  const gaps = findMarketGaps(competitors, center, radiusMeters);
  opportunityScore += Math.min(2, gaps.length * 0.5);
  
  // Clamp to 0-10
  opportunityScore = Math.max(0, Math.min(10, opportunityScore));

  // Generate insights
  const insights = generateInsights(competitors, totalCount, nearestDistance, densityScore, opportunityScore, gaps);

  // Generate analytics for premium users
  const analytics = isPremium ? generateMarketAnalytics(competitors) : undefined;

  return {
    competitors,
    totalCount,
    nearestDistance,
    averageDistance: Math.round(averageDistance),
    densityScore: Math.round(densityScore * 10) / 10,
    opportunityScore: Math.round(opportunityScore * 10) / 10,
    marketGaps: gaps,
    insights,
    analytics
  };
}

/**
 * Find market gaps (underserved areas)
 */
function findMarketGaps(
  competitors: Competitor[],
  center: { lat: number; lng: number },
  radiusMeters: number
): { lat: number; lng: number; radius: number }[] {
  const gaps: { lat: number; lng: number; radius: number }[] = [];
  
  if (competitors.length === 0) {
    // Entire area is a gap
    return [{ ...center, radius: radiusMeters }];
  }

  // Sample points in a grid
  const gridSize = 5;
  const step = (radiusMeters * 2) / gridSize;
  const latStep = step / 111000;
  const lngStep = step / (111000 * Math.cos((center.lat * Math.PI) / 180));

  for (let i = -gridSize / 2; i <= gridSize / 2; i++) {
    for (let j = -gridSize / 2; j <= gridSize / 2; j++) {
      const testPoint = {
        lat: center.lat + i * latStep,
        lng: center.lng + j * lngStep
      };

      // Find nearest competitor to this point
      const nearestDist = Math.min(
        ...competitors.map(c => calculateDistance(testPoint.lat, testPoint.lng, c.lat, c.lng))
      );

      // If no competitor within 300m, it's a gap
      if (nearestDist > 300) {
        gaps.push({ ...testPoint, radius: nearestDist });
      }
    }
  }

  return gaps.slice(0, 3); // Return top 3 gaps
}

/**
 * Generate market insights
 */
function generateInsights(
  competitors: Competitor[],
  totalCount: number,
  nearestDistance: number,
  densityScore: number,
  opportunityScore: number,
  gaps: { lat: number; lng: number; radius: number }[]
): string[] {
  const insights: string[] = [];

  // Average rating analysis (for Google Places data)
  const competitorsWithRatings = competitors.filter(c => c.rating && c.rating > 0);
  if (competitorsWithRatings.length > 0) {
    const avgRating = competitorsWithRatings.reduce((sum, c) => sum + (c.rating || 0), 0) / competitorsWithRatings.length;
    const avgReviews = competitorsWithRatings.reduce((sum, c) => sum + (c.userRatingsTotal || 0), 0) / competitorsWithRatings.length;
    
    insights.push(`Average competitor rating: ${avgRating.toFixed(1)}/5 (${Math.round(avgReviews)} reviews)`);
    
    if (avgRating < 3.5) {
      insights.push('Low competitor ratings - opportunity to provide better service!');
    } else if (avgRating > 4.5) {
      insights.push('High competitor ratings - strong competition, quality matters');
    }
  }

  // Competition level
  if (totalCount === 0) {
    insights.push('No direct competitors found in the area - untapped market!');
  } else if (totalCount <= 2) {
    insights.push('Low competition - excellent market entry opportunity');
  } else if (totalCount <= 5) {
    insights.push('Moderate competition - established market with room to grow');
  } else if (totalCount <= 10) {
    insights.push('High competition - market is well-served but not saturated');
  } else {
    insights.push('Very high competition - market may be saturated');
  }

  // Nearest competitor
  if (nearestDistance > 500) {
    insights.push('Nearest competitor is far away - potential to capture local demand');
  } else if (nearestDistance < 100) {
    insights.push('Very close competitor nearby - differentiation will be critical');
  }

  // Density assessment
  if (densityScore < 3) {
    insights.push('Low market density - opportunity for first-mover advantage');
  } else if (densityScore > 7) {
    insights.push('High market density - consider unique positioning or different location');
  }

  // Market gaps
  if (gaps.length > 0) {
    insights.push(`${gaps.length} underserved area${gaps.length > 1 ? 's' : ''} identified within radius`);
  }

  // Overall recommendation
  if (opportunityScore >= 7) {
    insights.push('Strong market opportunity - recommended for development');
  } else if (opportunityScore >= 5) {
    insights.push('Moderate opportunity - feasible with right strategy');
  } else if (opportunityScore >= 3) {
    insights.push('Limited opportunity - careful planning required');
  } else {
    insights.push('Low opportunity - consider alternative locations or business types');
  }

  return insights;
}
