// Type definitions for openmeteo
declare module 'openmeteo' {
  export interface WeatherApiResponse {
    latitude(): number;
    longitude(): number;
    utcOffsetSeconds(): number;
    timezone(): string;
    timezoneAbbreviation(): string;
    hourly(): {
      time(): Int32Array;
      variables(index: number): {
        valuesArray(): Float32Array;
      } | null;
    } | null;
  }

  export function fetchWeatherApi(
    url: string,
    params: {
      latitude: number;
      longitude: number;
      hourly?: string[];
      daily?: string[];
      start_date?: string;
      end_date?: string;
      timezone?: string;
      [key: string]: any;
    }
  ): Promise<WeatherApiResponse[]>;
}
