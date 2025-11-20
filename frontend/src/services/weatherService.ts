// Real Weather Data Service using Open-Meteo API
// Provides accurate wind, temperature, and solar radiation data

import { fetchWeatherApi } from 'openmeteo';

export interface WeatherData {
  temperature: number; // °C
  windSpeed: number; // m/s
  windDirection: number; // degrees
  relativeHumidity: number; // %
  directRadiation: number; // W/m²
  diffuseRadiation: number; // W/m²
  timestamp: Date;
}

export interface HourlyWeatherForecast {
  hourly: WeatherData[];
  latitude: number;
  longitude: number;
}

/**
 * Fetch real-time weather data from Open-Meteo API
 */
export async function fetchWeatherData(
  latitude: number,
  longitude: number,
  date?: Date
): Promise<WeatherData> {
  try {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const params = {
      latitude,
      longitude,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'direct_radiation',
        'diffuse_radiation'
      ],
      start_date: dateStr,
      end_date: dateStr,
      timezone: 'auto'
    };

    const url = 'https://api.open-meteo.com/v1/forecast';
    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];

    const utcOffsetSeconds = response.utcOffsetSeconds();
    const hourly = response.hourly()!;

    const hour = targetDate.getHours();
    
    return {
      temperature: hourly.variables(0)!.valuesArray()![hour] || 20,
      relativeHumidity: hourly.variables(1)!.valuesArray()![hour] || 50,
      windSpeed: hourly.variables(2)!.valuesArray()![hour] || 3,
      windDirection: hourly.variables(3)!.valuesArray()![hour] || 0,
      directRadiation: hourly.variables(4)!.valuesArray()![hour] || 0,
      diffuseRadiation: hourly.variables(5)!.valuesArray()![hour] || 0,
      timestamp: targetDate
    };
  } catch (error) {
    console.warn('Failed to fetch weather data, using defaults:', error);
    // Return default values if API fails
    return {
      temperature: 20,
      windSpeed: 3,
      windDirection: 0,
      relativeHumidity: 50,
      directRadiation: 500,
      diffuseRadiation: 100,
      timestamp: date || new Date()
    };
  }
}

/**
 * Calculate thermal comfort index (Universal Thermal Climate Index - UTCI approximation)
 * Returns comfort level: -4 (extreme cold) to +4 (extreme heat)
 */
export function calculateComfortIndex(
  temperature: number,
  windSpeed: number,
  relativeHumidity: number,
  solarRadiation: number
): {
  index: number;
  category: 'extreme_cold' | 'very_cold' | 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot' | 'very_hot' | 'extreme_heat';
  description: string;
} {
  // Simplified UTCI approximation
  // Adjust temperature based on wind chill and solar radiation
  
  // Wind chill effect (higher wind = feels colder)
  const windChillEffect = -1.5 * Math.sqrt(windSpeed);
  
  // Solar heating effect (more radiation = feels warmer)
  const solarEffect = solarRadiation / 200;
  
  // Humidity discomfort (high humidity makes hot feel hotter, cold feel colder)
  const humidityEffect = (relativeHumidity - 50) / 50 * Math.abs(temperature - 20) / 10;
  
  const perceivedTemp = temperature + windChillEffect + solarEffect + humidityEffect;
  
  // Categorize comfort
  if (perceivedTemp < -13) {
    return { index: -4, category: 'extreme_cold', description: 'Extreme cold stress' };
  } else if (perceivedTemp < -5) {
    return { index: -3, category: 'very_cold', description: 'Very strong cold stress' };
  } else if (perceivedTemp < 0) {
    return { index: -2, category: 'cold', description: 'Strong cold stress' };
  } else if (perceivedTemp < 9) {
    return { index: -1, category: 'cool', description: 'Moderate cold stress' };
  } else if (perceivedTemp < 26) {
    return { index: 0, category: 'comfortable', description: 'No thermal stress' };
  } else if (perceivedTemp < 32) {
    return { index: 1, category: 'warm', description: 'Moderate heat stress' };
  } else if (perceivedTemp < 38) {
    return { index: 2, category: 'hot', description: 'Strong heat stress' };
  } else if (perceivedTemp < 46) {
    return { index: 3, category: 'very_hot', description: 'Very strong heat stress' };
  } else {
    return { index: 4, category: 'extreme_heat', description: 'Extreme heat stress' };
  }
}
