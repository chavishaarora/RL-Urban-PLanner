declare const google: any;

export interface GooglePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  types: string[];
  category: string;
  rating?: number;
  userRatingsTotal?: number;
}

// Map Google Places types to our amenity categories
export function categorizeGooglePlace(types: string[]): string {
  // Education
  if (types.some(t => ['school', 'university', 'library', 'primary_school', 'secondary_school'].includes(t))) {
    return 'Education';
  }
  
  // Healthcare
  if (types.some(t => ['hospital', 'doctor', 'dentist', 'pharmacy', 'physiotherapist', 'health'].includes(t))) {
    return 'Healthcare';
  }
  
  // Retail
  if (types.some(t => ['store', 'shopping_mall', 'supermarket', 'clothing_store', 'electronics_store', 'furniture_store', 'home_goods_store', 'shoe_store', 'book_store', 'jewelry_store'].includes(t))) {
    return 'Retail';
  }
  
  // Food & Drink
  if (types.some(t => ['restaurant', 'cafe', 'bar', 'food', 'bakery', 'meal_delivery', 'meal_takeaway'].includes(t))) {
    return 'Food & Drink';
  }
  
  // Transit
  if (types.some(t => ['transit_station', 'bus_station', 'subway_station', 'train_station', 'light_rail_station', 'airport'].includes(t))) {
    return 'Transit';
  }
  
  // Culture
  if (types.some(t => ['museum', 'art_gallery', 'movie_theater', 'theater', 'tourist_attraction', 'aquarium', 'zoo'].includes(t))) {
    return 'Culture';
  }
  
  // Recreation
  if (types.some(t => ['gym', 'park', 'stadium', 'bowling_alley', 'amusement_park', 'night_club', 'spa'].includes(t))) {
    return 'Recreation';
  }
  
  return 'Other';
}

export async function fetchGooglePlacesNearby(
  center: { lat: number; lng: number },
  radiusMeters: number = 700
): Promise<GooglePlace[]> {
  return new Promise((resolve) => {
    try {
      if (!google?.maps?.places?.PlacesService) {
        console.warn('Google Places API not available');
        resolve([]);
        return;
      }

      // Create a temporary map div for PlacesService (required by API)
      const tempDiv = document.createElement('div');
      const service = new google.maps.places.PlacesService(tempDiv);

      const request = {
        location: new google.maps.LatLng(center.lat, center.lng),
        radius: radiusMeters,
        // Request multiple types to get comprehensive coverage
        type: ['restaurant', 'cafe', 'store', 'school', 'hospital', 'bank', 'park', 'gym', 'transit_station']
      };

      service.nearbySearch(request, (results: any[], status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: GooglePlace[] = results
            .filter(place => place.geometry?.location && place.name)
            .map(place => ({
              id: place.place_id || `gplace-${Math.random()}`,
              name: place.name,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              types: place.types || [],
              category: categorizeGooglePlace(place.types || []),
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total
            }))
            // Filter out 'Other' category
            .filter(place => place.category !== 'Other');

          resolve(places);
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

// Merge Google Places with OSM amenities, removing duplicates
export function mergeAmenities(
  osmAmenities: any[],
  googlePlaces: GooglePlace[]
): any[] {
  const merged = [...osmAmenities];
  const osmPositions = new Set(
    osmAmenities.map(a => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`)
  );

  // Add Google Places that aren't duplicates (not within ~10m of OSM amenities)
  googlePlaces.forEach(place => {
    const posKey = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
    
    // Check if this position is already covered by OSM
    const isDuplicate = osmPositions.has(posKey);
    
    if (!isDuplicate) {
      // Add as amenity in our format
      merged.push({
        id: place.id,
        lat: place.lat,
        lng: place.lng,
        tags: {
          name: place.name,
          rating: place.rating,
          source: 'google'
        },
        amenityType: place.category
      });
    }
  });

  return merged;
}
