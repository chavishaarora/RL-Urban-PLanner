/**
 * OSM Data Cache Service
 * Caches OpenStreetMap API responses to improve performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = 'osm-cache-';

/**
 * Generate cache key from center point and radius
 */
function generateCacheKey(
  center: { lat: number; lng: number },
  radius: number,
  type: string
): string {
  // Round to 4 decimal places (~11m precision) to improve cache hits
  const lat = center.lat.toFixed(4);
  const lng = center.lng.toFixed(4);
  return `${type}-${lat}-${lng}-${radius}`;
}

/**
 * Get cached data if available and not expired
 */
export function getCachedData<T>(
  center: { lat: number; lng: number },
  radius: number,
  type: string
): T | null {
  try {
    const key = CACHE_PREFIX + generateCacheKey(center, radius, type);
    const stored = sessionStorage.getItem(key);
    
    if (!stored) return null;
    
    const entry: CacheEntry<T> = JSON.parse(stored);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - entry.timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    console.log(`✓ Cache hit for ${type} at ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
    return entry.data;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Store data in cache
 */
export function setCachedData<T>(
  center: { lat: number; lng: number },
  radius: number,
  type: string,
  data: T
): void {
  // DISABLED: Caching disabled for large OSM datasets to prevent quota errors
  console.log(`⚠️ Caching disabled for: ${type} (${radius}m radius)`);
  return;
  
  /* Original caching disabled to prevent quota errors
  try {
    const key = CACHE_PREFIX + generateCacheKey(center, radius, type);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      key
    };
    
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // If quota exceeded, clear old cache entries
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearOldCacheEntries();
      try {
        const key = CACHE_PREFIX + generateCacheKey(center, radius, type);
        const entry: CacheEntry<T> = { data, timestamp: Date.now(), key };
        sessionStorage.setItem(key, JSON.stringify(entry));
      } catch (retryError) {
        console.error('Failed to cache data after cleanup:', retryError);
      }
    } else {
      console.error('Error writing to cache:', error);
    }
  }
  */
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCacheEntries(): void {
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored) {
            const entry = JSON.parse(stored);
            if (now - entry.timestamp > CACHE_DURATION) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} old cache entries`);
  } catch (error) {
    console.error('Error clearing old cache entries:', error);
  }
}

/**
 * Clear all OSM cache entries
 */
export function clearOSMCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} OSM cache entries`);
  } catch (error) {
    console.error('Error clearing OSM cache:', error);
  }
}
