"""
Open-Meteo Weather Service
Free, no API key required, globally accurate weather data
https://open-meteo.com
"""

import requests
from typing import Dict, Optional
from datetime import datetime, timezone
import pytz
from timezonefinder import TimezoneFinder

class WeatherService:
    """
    Fetch real-time weather data from Open-Meteo (FREE)
    - No API key required
    - Global coverage
    - Historical and forecast data
    - Hourly resolution
    """
    
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    
    @staticmethod
    def get_timezone(lat: float, lon: float) -> str:
        """Get timezone string for coordinates"""
        tf = TimezoneFinder()
        tz_str = tf.timezone_at(lat=lat, lng=lon)
        return tz_str or 'UTC'
    
    @staticmethod
    def get_current_weather(lat: float, lon: float, date: Optional[datetime] = None) -> Dict:
        """
        Get weather data for specific location and time
        
        Returns:
            {
                'temperature': float (°C),
                'humidity': float (0-100),
                'wind_speed': float (m/s),
                'wind_direction': float (degrees),
                'cloud_cover': float (0-100),
                'pressure': float (hPa),
                'precipitation': float (mm),
                'solar_radiation': float (W/m²)
            }
        """
        try:
            # Use current time if not specified
            if date is None:
                date = datetime.now(timezone.utc)
            
            # Convert to UTC if timezone-aware
            if date.tzinfo is not None:
                date = date.astimezone(timezone.utc)
            
            # Format date for API
            date_str = date.strftime('%Y-%m-%d')
            hour = date.hour
            
            # Build API request
            params = {
                'latitude': lat,
                'longitude': lon,
                'hourly': [
                    'temperature_2m',
                    'relative_humidity_2m',
                    'wind_speed_10m',
                    'wind_direction_10m',
                    'cloud_cover',
                    'surface_pressure',
                    'precipitation',
                    'shortwave_radiation'
                ],
                'start_date': date_str,
                'end_date': date_str,
                'timezone': 'UTC'
            }
            
            response = requests.get(WeatherService.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if 'hourly' not in data:
                raise ValueError("Invalid response from weather API")
            
            hourly = data['hourly']
            
            # Get data for specific hour (or closest available)
            idx = min(hour, len(hourly['time']) - 1)
            
            return {
                'temperature': hourly['temperature_2m'][idx],
                'humidity': hourly['relative_humidity_2m'][idx],
                'wind_speed': hourly['wind_speed_10m'][idx],
                'wind_direction': hourly['wind_direction_10m'][idx],
                'cloud_cover': hourly['cloud_cover'][idx] / 100.0,  # Convert to 0-1
                'pressure': hourly['surface_pressure'][idx],
                'precipitation': hourly['precipitation'][idx],
                'solar_radiation': hourly['shortwave_radiation'][idx] or 0.0
            }
            
        except Exception as e:
            print(f"⚠️  Weather API error: {e}")
            # Return reasonable defaults for the location/season
            return WeatherService._get_climate_defaults(lat, date)
    
    @staticmethod
    def _get_climate_defaults(lat: float, date: Optional[datetime] = None) -> Dict:
        """
        Provide climate-appropriate defaults based on latitude and season
        """
        if date is None:
            date = datetime.now(timezone.utc)
        
        month = date.month
        
        # Determine hemisphere and season
        is_winter = (lat > 0 and month in [12, 1, 2]) or (lat < 0 and month in [6, 7, 8])
        is_summer = (lat > 0 and month in [6, 7, 8]) or (lat < 0 and month in [12, 1, 2])
        
        # Tropical (within ±23.5°)
        if abs(lat) < 23.5:
            temp = 28 if is_summer else 24
            humidity = 75
            wind = 3.5
        # Mid-latitudes (23.5° - 60°)
        elif abs(lat) < 60:
            temp = 22 if is_summer else 8 if is_winter else 15
            humidity = 65 if is_summer else 70
            wind = 4.0
        # Polar (> 60°)
        else:
            temp = 10 if is_summer else -5 if is_winter else 2
            humidity = 75
            wind = 5.5
        
        return {
            'temperature': temp,
            'humidity': humidity,
            'wind_speed': wind,
            'wind_direction': 270,  # Westerly default
            'cloud_cover': 0.3,
            'pressure': 1013.25,
            'precipitation': 0,
            'solar_radiation': 0
        }
    
    @staticmethod
    def get_sunrise_sunset(lat: float, lon: float, date: Optional[datetime] = None) -> Dict:
        """
        Get accurate sunrise/sunset times using pvlib
        
        Returns:
            {
                'sunrise': datetime,
                'sunset': datetime,
                'solar_noon': datetime,
                'day_length': float (hours)
            }
        """
        from pvlib import solarposition
        import pandas as pd
        
        if date is None:
            date = datetime.now(timezone.utc)
        
        # Get timezone for location
        tz_str = WeatherService.get_timezone(lat, lon)
        tz = pytz.timezone(tz_str)
        
        # Convert to local time for accurate sunrise/sunset
        if date.tzinfo is None:
            date = tz.localize(date)
        else:
            date = date.astimezone(tz)
        
        # Create full day time range
        start = date.replace(hour=0, minute=0, second=0)
        times = pd.date_range(start, periods=24*4, freq='15min', tz=tz)
        
        # Calculate solar position
        solar_pos = solarposition.get_solarposition(times, lat, lon)
        
        # Find sunrise (first time elevation > 0)
        above_horizon = solar_pos['apparent_elevation'] > 0
        sunrise_idx = above_horizon.idxmax() if above_horizon.any() else None
        sunrise = times[times.get_loc(sunrise_idx)] if sunrise_idx is not None else None
        
        # Find sunset (last time elevation > 0)
        sunset_idx = above_horizon[::-1].idxmax() if above_horizon.any() else None
        sunset = times[times.get_loc(sunset_idx)] if sunset_idx is not None else None
        
        # Find solar noon (maximum elevation)
        solar_noon_idx = solar_pos['apparent_elevation'].idxmax()
        solar_noon = times[times.get_loc(solar_noon_idx)]
        
        # Calculate day length
        day_length = 0
        if sunrise and sunset and sunrise != sunset:
            day_length = (sunset - sunrise).total_seconds() / 3600
        
        return {
            'sunrise': sunrise,
            'sunset': sunset,
            'solar_noon': solar_noon,
            'day_length': day_length,
            'timezone': tz_str
        }
