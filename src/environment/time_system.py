"""
Time System Module
Implements time-of-day with dynamic sun position, sky colors, and lighting
"""

import math
import numpy as np
from dataclasses import dataclass
from typing import Tuple


@dataclass
class SunPosition:
    """Represents the sun's position in the sky"""
    x: float
    y: float
    z: float
    intensity: float
    altitude: float  # Degrees above horizon
    azimuth: float   # Compass direction


class TimeSystem:
    """Manages time-of-day with realistic sun movement and lighting"""
    
    def __init__(self, start_hour: float = 12.0, time_scale: float = 60.0, latitude: float = 40.0):
        """
        Initialize time system
        
        Args:
            start_hour: Starting hour (0-24)
            time_scale: Time multiplier (60 = 1 game minute per real second)
            latitude: Geographic latitude for sun path (-90 to 90)
        """
        self.current_hour = start_hour
        self.time_scale = time_scale
        self.latitude = latitude
        self.is_paused = False
        
        # Sun position
        self.sun_position = self._calculate_sun_position()
        
        # Sky and ambient colors
        self.sky_color = self._calculate_sky_color()
        self.ambient_light = self._calculate_ambient_light()
        
    def update(self, delta_time: float):
        """Update time"""
        if not self.is_paused:
            # delta_time is in seconds, time_scale converts to game hours
            hours_elapsed = (delta_time * self.time_scale) / 3600.0
            self.current_hour += hours_elapsed
            
            # Wrap around 24 hours
            if self.current_hour >= 24.0:
                self.current_hour -= 24.0
            
            # Update sun position and colors
            self.sun_position = self._calculate_sun_position()
            self.sky_color = self._calculate_sky_color()
            self.ambient_light = self._calculate_ambient_light()
    
    def set_time(self, hour: float):
        """Set time directly (0-24)"""
        self.current_hour = hour % 24.0
        self.sun_position = self._calculate_sun_position()
        self.sky_color = self._calculate_sky_color()
        self.ambient_light = self._calculate_ambient_light()
    
    def _calculate_sun_position(self) -> SunPosition:
        """Calculate sun position based on time and latitude"""
        hour = self.current_hour
        
        # Solar noon is at 12:00
        # Hour angle: 0° at noon, ±15° per hour
        hour_angle = (hour - 12.0) * 15.0
        hour_angle_rad = math.radians(hour_angle)
        
        # Sun declination (simplified - assumes equinox)
        declination = 0.0
        declination_rad = math.radians(declination)
        
        # Latitude
        latitude_rad = math.radians(self.latitude)
        
        # Calculate altitude (elevation above horizon)
        sin_altitude = (math.sin(latitude_rad) * math.sin(declination_rad) + 
                       math.cos(latitude_rad) * math.cos(declination_rad) * math.cos(hour_angle_rad))
        altitude = math.degrees(math.asin(max(-1, min(1, sin_altitude))))
        
        # Calculate azimuth (compass direction)
        cos_azimuth = ((math.sin(declination_rad) - math.sin(latitude_rad) * sin_altitude) / 
                      (math.cos(latitude_rad) * math.cos(math.radians(altitude))))
        cos_azimuth = max(-1, min(1, cos_azimuth))
        azimuth = math.degrees(math.acos(cos_azimuth))
        
        # Adjust azimuth for afternoon (west)
        if hour > 12:
            azimuth = 360 - azimuth
        
        # Convert to Cartesian coordinates
        altitude_rad = math.radians(altitude)
        azimuth_rad = math.radians(azimuth)
        
        x = math.cos(altitude_rad) * math.sin(azimuth_rad)
        y = math.sin(altitude_rad)
        z = math.cos(altitude_rad) * math.cos(azimuth_rad)
        
        # Calculate intensity (0-1) based on altitude
        if altitude > 0:
            intensity = min(1.0, altitude / 90.0)
        else:
            intensity = 0.0
        
        return SunPosition(x, y, z, intensity, altitude, azimuth)
    
    def _calculate_sky_color(self) -> Tuple[float, float, float]:
        """Calculate sky color based on time of day"""
        altitude = self.sun_position.altitude
        
        if altitude > 10:
            # Daytime - blue sky
            return (0.53, 0.81, 0.98)
        elif altitude > 0:
            # Sunrise/sunset - orange/pink
            t = altitude / 10.0
            day_color = (0.53, 0.81, 0.98)
            sunset_color = (1.0, 0.6, 0.4)
            return self._lerp_color(sunset_color, day_color, t)
        elif altitude > -6:
            # Twilight - deep blue
            t = (altitude + 6) / 6.0
            twilight_color = (0.2, 0.3, 0.5)
            sunset_color = (1.0, 0.6, 0.4)
            return self._lerp_color(twilight_color, sunset_color, t)
        else:
            # Night - dark blue
            return (0.05, 0.05, 0.15)
    
    def _calculate_ambient_light(self) -> Tuple[float, float, float]:
        """Calculate ambient light level"""
        altitude = self.sun_position.altitude
        
        if altitude > 0:
            # Day - bright ambient
            intensity = min(0.5, altitude / 90.0 * 0.5)
            return (intensity, intensity, intensity)
        elif altitude > -6:
            # Twilight - dim ambient
            t = (altitude + 6) / 6.0
            intensity = t * 0.2
            return (intensity, intensity, intensity * 1.1)
        else:
            # Night - very dim blue ambient
            return (0.05, 0.05, 0.1)
    
    def get_sun_color(self) -> Tuple[float, float, float]:
        """Get sun color based on altitude"""
        altitude = self.sun_position.altitude
        
        if altitude > 30:
            # High sun - white/yellow
            return (1.0, 1.0, 0.95)
        elif altitude > 0:
            # Low sun - orange/red
            t = altitude / 30.0
            low_color = (1.0, 0.5, 0.2)
            high_color = (1.0, 1.0, 0.95)
            return self._lerp_color(low_color, high_color, t)
        else:
            # Below horizon - no light
            return (0.0, 0.0, 0.0)
    
    def should_lamps_be_on(self) -> bool:
        """Determine if street lamps should be on"""
        return self.sun_position.altitude < 5.0
    
    def calculate_shadow_direction(self) -> Tuple[float, float, float]:
        """Calculate shadow direction (opposite of sun)"""
        return (-self.sun_position.x, -self.sun_position.y, -self.sun_position.z)
    
    def calculate_shadow_length_multiplier(self) -> float:
        """Calculate how long shadows should be based on sun angle"""
        altitude = self.sun_position.altitude
        
        if altitude <= 0:
            return 0.0
        elif altitude < 15:
            # Very long shadows at low sun
            return 10.0 - (altitude / 15.0) * 9.0
        else:
            # Shorter shadows at high sun
            return max(0.5, 1.0 / math.tan(math.radians(altitude)))
    
    def get_time_of_day(self) -> str:
        """Get descriptive time of day"""
        hour = self.current_hour
        
        if hour < 5:
            return "Night"
        elif hour < 6:
            return "Pre-Dawn"
        elif hour < 7:
            return "Sunrise"
        elif hour < 12:
            return "Morning"
        elif hour < 13:
            return "Noon"
        elif hour < 17:
            return "Afternoon"
        elif hour < 19:
            return "Sunset"
        elif hour < 21:
            return "Dusk"
        else:
            return "Night"
    
    def get_statistics(self) -> dict:
        """Get time statistics"""
        hours = int(self.current_hour)
        minutes = int((self.current_hour - hours) * 60)
        
        return {
            'current_hour': self.current_hour,
            'formatted_time': f"{hours:02d}:{minutes:02d}",
            'time_of_day': self.get_time_of_day(),
            'sun_altitude': self.sun_position.altitude,
            'sun_azimuth': self.sun_position.azimuth,
            'sun_intensity': self.sun_position.intensity,
            'lamps_on': self.should_lamps_be_on(),
            'time_scale': self.time_scale,
            'is_paused': self.is_paused
        }
    
    def _lerp_color(self, c1: Tuple[float, float, float], 
                   c2: Tuple[float, float, float], 
                   t: float) -> Tuple[float, float, float]:
        """Linear interpolation between two colors"""
        return (
            c1[0] + (c2[0] - c1[0]) * t,
            c1[1] + (c2[1] - c1[1]) * t,
            c1[2] + (c2[2] - c1[2]) * t
        )