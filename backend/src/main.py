"""
UrbanEyes Thermal Comfort API
Research-grade UTCI/PET calculations with building-aware physics
Globally accurate weather and solar data
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Dict, Optional
import numpy as np
from pythermalcomfort.models import utci, pet_steady
from pythermalcomfort.utilities import v_relative
import math
from datetime import datetime, timezone
import traceback
import pytz
from timezonefinder import TimezoneFinder
from weather_service import WeatherService

app = FastAPI(
    title="UrbanEyes Thermal Comfort API",
    description="Research-grade microclimate analysis with UTCI/PET models",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002", "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"❌ Validation Error: {exc.errors()}")
    print(f"❌ Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())}
    )

# ============================================================================
# DATA MODELS
# ============================================================================

class Building(BaseModel):
    id: str
    geometry: List[List[float]]  # [[lat, lng], ...]
    height: float

class Weather(BaseModel):
    temperature: float      # °C
    humidity: float        # 0-100%
    wind_speed: float      # m/s
    wind_direction: float  # degrees
    cloud_cover: float     # 0-1

class Bounds(BaseModel):
    south: float
    north: float
    west: float
    east: float

class ThermalComfortRequest(BaseModel):
    bounds: Bounds
    buildings: List[Building]
    weather: Weather
    date: str
    resolution: int = 100
    analysis_type: str = "utci"  # "utci", "pet", "wind", "solar"
    use_real_weather: bool = False  # Fetch live weather data

# ============================================================================
# BUILDING-AWARE PHYSICS
# ============================================================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lng points"""
    R = 6371000  # Earth radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def point_in_polygon(x: float, y: float, polygon: List[List[float]]) -> bool:
    """Check if point is inside polygon using ray casting"""
    n = len(polygon)
    inside = False
    
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    
    return inside

def calculate_wind_shelter(
    lat: float,
    lng: float,
    wind_speed: float,
    wind_direction: float,
    buildings: List[Building],
    bounds: Bounds
) -> float:
    """
    Calculate wind speed reduction due to building shelter
    Returns actual wind speed at point (m/s)
    """
    # Check if point is inside a building
    for building in buildings:
        if point_in_polygon(lat, lng, building.geometry):
            return 0.1  # Almost no wind inside buildings
    
    # Calculate distance to nearest upwind building
    wind_rad = math.radians(wind_direction)
    upwind_dx = -math.sin(wind_rad)  # Wind coming FROM this direction
    upwind_dy = -math.cos(wind_rad)
    
    min_distance = float('inf')
    shelter_height = 0
    
    for building in buildings:
        # Get building centroid
        centroid_lat = sum(p[0] for p in building.geometry) / len(building.geometry)
        centroid_lng = sum(p[1] for p in building.geometry) / len(building.geometry)
        
        # Vector from point to building
        dx = centroid_lng - lng
        dy = centroid_lat - lat
        
        # Check if building is upwind (dot product > 0)
        dot = dx * upwind_dx + dy * upwind_dy
        
        if dot > 0:
            dist = haversine_distance(lat, lng, centroid_lat, centroid_lng)
            if dist < min_distance:
                min_distance = dist
                shelter_height = building.height
    
    # Urban canyon wind reduction (Oke 1987)
    if min_distance < shelter_height * 3:  # Within shelter zone
        shelter_factor = min(1.0, min_distance / (shelter_height * 3))
        # Log profile with roughness
        z0 = 1.0  # Roughness length (urban)
        z = 1.5   # Pedestrian height
        reduced_speed = wind_speed * shelter_factor * (math.log(z / z0) / math.log(10 / z0))
        return max(0.5, reduced_speed)  # Minimum 0.5 m/s
    
    return wind_speed

def calculate_solar_radiation(
    lat: float,
    lng: float,
    date: datetime,
    cloud_cover: float,
    buildings: List[Building],
    pressure: float = 1013.25
) -> float:
    """
    Calculate solar radiation at point considering building shadows
    Uses pvlib for globally accurate solar position and irradiance models
    Returns W/m²
    """
    from pvlib import solarposition, irradiance, atmosphere
    import pandas as pd
    
    # Ensure timezone-aware datetime
    if date.tzinfo is None:
        tf = TimezoneFinder()
        tz_str = tf.timezone_at(lat=lat, lng=lng) or 'UTC'
        tz = pytz.timezone(tz_str)
        date = tz.localize(date)
    
    # Get sun position with pvlib (globally accurate)
    times = pd.DatetimeIndex([date])
    sun_pos = solarposition.get_solarposition(times, lat, lng, pressure=pressure*100)
    altitude = sun_pos['apparent_elevation'].iloc[0]
    azimuth = sun_pos['azimuth'].iloc[0]
    zenith = sun_pos['apparent_zenith'].iloc[0]
    
    # If sun is below horizon, no solar radiation
    if altitude <= 0:
        return 0.0
    
    # Calculate air mass and extraterrestrial radiation
    airmass = atmosphere.get_relative_airmass(zenith)
    etr = irradiance.get_extra_radiation(times).iloc[0]
    
    # Use Ineichen clear sky model (more accurate than ASHRAE)
    # Linke turbidity varies by location and season (2.5-5.0 typical)
    linke_turbidity = 3.0 + cloud_cover * 2.0  # Adjust for clouds
    
    clearsky = irradiance.ineichen(
        zenith,
        airmass,
        linke_turbidity,
        altitude=0,  # Sea level default (can be enhanced with DEM)
        dni_extra=etr
    )
    
    # Get GHI (Global Horizontal Irradiance)
    GHI = clearsky['ghi']
    DNI = clearsky['dni']
    DHI = clearsky['dhi']
    
    # Cloud cover attenuation (research-based model)
    cloud_factor = 1.0 - 0.75 * (cloud_cover ** 3.4)
    GHI *= cloud_factor
    
    # Building shadow analysis (improved)
    sun_az_rad = math.radians(azimuth)
    sun_alt_rad = math.radians(altitude)
    shadow_factor = 1.0
    
    for building in buildings:
        # Check if building blocks sun
        centroid_lat = sum(p[0] for p in building.geometry) / len(building.geometry)
        centroid_lng = sum(p[1] for p in building.geometry) / len(building.geometry)
        
        # Vector from point to building (in meters)
        dx = (centroid_lng - lng) * 111320 * math.cos(math.radians(lat))
        dy = (centroid_lat - lat) * 111320
        dist = math.sqrt(dx**2 + dy**2)
        
        if dist < 1:  # Skip if very close
            continue
        
        # Angle to building
        angle_to_building = math.atan2(dx, dy)
        angle_diff = abs(angle_to_building - sun_az_rad)
        
        # Normalize angle difference to [0, π]
        if angle_diff > math.pi:
            angle_diff = 2 * math.pi - angle_diff
        
        # Shadow casting: building is between point and sun
        shadow_length = building.height / math.tan(sun_alt_rad) if sun_alt_rad > 0 else 0
        
        if angle_diff < math.radians(45) and dist < shadow_length:
            # Point is in shadow - only diffuse radiation
            shadow_factor = 0.15  # ~15% diffuse light reaches shadowed areas
            break
    
    return GHI * shadow_factor

def calculate_mean_radiant_temperature(
    tdb: float,
    solar_radiation: float,
    wind_speed: float
) -> float:
    """
    Calculate mean radiant temperature from solar radiation
    Simplified model for pedestrian environment
    """
    # Stefan-Boltzmann constant
    sigma = 5.67e-8
    
    # Longwave radiation (from surroundings)
    T_surf_k = tdb + 273.15
    longwave = sigma * T_surf_k**4
    
    # Solar radiation contribution (absorbed by person)
    # Assuming 0.7 absorption coefficient and 0.3 projected area factor
    solar_absorbed = solar_radiation * 0.7 * 0.3
    
    # Mean radiant temperature
    T_mrt_k = ((longwave + solar_absorbed) / sigma)**0.25
    T_mrt = T_mrt_k - 273.15
    
    return T_mrt

# ============================================================================
# THERMAL COMFORT CALCULATIONS
# ============================================================================

@app.post("/api/thermal-comfort")
async def calculate_thermal_comfort(request: ThermalComfortRequest):
    """
    Calculate UTCI/PET values for entire site grid at pedestrian level (1.5m height)
    Returns building-aware thermal comfort analysis with globally accurate data
    """
    try:
        print(f"[API] Calculating {request.analysis_type} for {request.resolution}x{request.resolution} grid")
        print(f"[API] Bounds: {request.bounds.south:.4f} to {request.bounds.north:.4f}, {request.bounds.west:.4f} to {request.bounds.east:.4f}")
        print(f"[API] Buildings: {len(request.buildings)}, Weather: {request.weather.temperature}°C, {request.weather.wind_speed}m/s")
        print(f"[API] Real weather: {request.use_real_weather}")
    except Exception as e:
        print(f"❌ Error in initial logging: {e}")
        traceback.print_exc()
    
    # Parse date with timezone awareness
    date_obj = datetime.fromisoformat(request.date.replace('Z', '+00:00'))
    
    # Get center point for weather and timezone
    center_lat = (request.bounds.south + request.bounds.north) / 2
    center_lng = (request.bounds.west + request.bounds.east) / 2
    
    # Fetch real weather if requested
    weather_data = None
    if request.use_real_weather:
        try:
            print(f"[API] Fetching real weather for {center_lat:.4f}, {center_lng:.4f}...")
            weather_data = WeatherService.get_current_weather(center_lat, center_lng, date_obj)
            print(f"[API] Real weather: {weather_data['temperature']:.1f}°C, {weather_data['wind_speed']:.1f}m/s, {weather_data['cloud_cover']:.0%} clouds")
            
            # Override request weather with real data
            request.weather.temperature = weather_data['temperature']
            request.weather.humidity = weather_data['humidity']
            request.weather.wind_speed = weather_data['wind_speed']
            request.weather.wind_direction = weather_data['wind_direction']
            request.weather.cloud_cover = weather_data['cloud_cover']
        except Exception as e:
            print(f"⚠️  Could not fetch real weather: {e}, using provided values")
    
    # Create spatial grid
    resolution = request.resolution
    lats = np.linspace(request.bounds.south, request.bounds.north, resolution)
    lngs = np.linspace(request.bounds.west, request.bounds.east, resolution)
    
    values = np.zeros((resolution, resolution))
    
    for y, lat in enumerate(lats):
        for x, lng in enumerate(lngs):
            
            if request.analysis_type == "wind":
                # Wind speed analysis
                wind_speed = calculate_wind_shelter(
                    lat, lng,
                    request.weather.wind_speed,
                    request.weather.wind_direction,
                    request.buildings,
                    request.bounds
                )
                values[y, x] = wind_speed
                
            elif request.analysis_type == "solar":
                # Solar radiation analysis with pressure for better accuracy
                pressure = weather_data['pressure'] if weather_data else 1013.25
                solar = calculate_solar_radiation(
                    lat, lng,
                    date_obj,
                    request.weather.cloud_cover,
                    request.buildings,
                    pressure
                )
                values[y, x] = solar / 100  # Scale for visualization
                
            elif request.analysis_type == "utci":
                # UTCI thermal comfort
                wind_speed = calculate_wind_shelter(
                    lat, lng,
                    request.weather.wind_speed,
                    request.weather.wind_direction,
                    request.buildings,
                    request.bounds
                )
                
                pressure = weather_data['pressure'] if weather_data else 1013.25
                solar = calculate_solar_radiation(
                    lat, lng,
                    date_obj,
                    request.weather.cloud_cover,
                    request.buildings,
                    pressure
                )
                
                t_mrt = calculate_mean_radiant_temperature(
                    request.weather.temperature,
                    solar,
                    wind_speed
                )
                
                # Calculate UTCI
                utci_value = utci(
                    tdb=request.weather.temperature,
                    tr=t_mrt,
                    v=wind_speed,
                    rh=request.weather.humidity
                )
                
                values[y, x] = utci_value
                
            elif request.analysis_type == "pet":
                # PET thermal comfort
                wind_speed = calculate_wind_shelter(
                    lat, lng,
                    request.weather.wind_speed,
                    request.weather.wind_direction,
                    request.buildings,
                    request.bounds
                )
                
                pressure = weather_data['pressure'] if weather_data else 1013.25
                solar = calculate_solar_radiation(
                    lat, lng,
                    date_obj,
                    request.weather.cloud_cover,
                    request.buildings,
                    pressure
                )
                
                t_mrt = calculate_mean_radiant_temperature(
                    request.weather.temperature,
                    solar,
                    wind_speed
                )
                
                # Calculate PET (metabolic rate for walking, climate-adaptive clothing)
                result = pet_steady(
                    tdb=request.weather.temperature,
                    tr=t_mrt,
                    v=wind_speed,
                    rh=request.weather.humidity,
                    met=2.0,   # Walking
                    clo=0.5,   # Light clothing (adjust based on season/climate if needed)
                    p_atm=pressure
                )
                
                values[y, x] = result.pet
    
    # Compute statistics
    flat_values = values.flatten()
    
    print(f"[API] Complete - min: {flat_values.min():.2f}, max: {flat_values.max():.2f}, mean: {flat_values.mean():.2f}")
    
    return {
        "values": flat_values.tolist(),
        "min": float(flat_values.min()),
        "max": float(flat_values.max()),
        "mean": float(flat_values.mean()),
        "resolution": resolution,
        "analysis_type": request.analysis_type
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "thermal-comfort-api"}

@app.get("/api/sun-data")
async def get_sun_data(lat: float, lon: float, date: Optional[str] = None):
    """
    Get accurate sunrise/sunset times for any location globally
    Uses pvlib for research-grade solar position calculations
    """
    try:
        date_obj = datetime.fromisoformat(date) if date else None
        sun_data = WeatherService.get_sunrise_sunset(lat, lon, date_obj)
        
        return {
            "sunrise": sun_data['sunrise'].isoformat() if sun_data['sunrise'] else None,
            "sunset": sun_data['sunset'].isoformat() if sun_data['sunset'] else None,
            "solar_noon": sun_data['solar_noon'].isoformat(),
            "day_length_hours": sun_data['day_length'],
            "timezone": sun_data['timezone'],
            "location": {"lat": lat, "lon": lon}
        }
    except Exception as e:
        print(f"❌ Error calculating sun data: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/weather")
async def get_weather(lat: float, lon: float, date: Optional[str] = None):
    """
    Get current weather data for any location globally
    Uses Open-Meteo free API (no API key required)
    """
    try:
        date_obj = datetime.fromisoformat(date) if date else None
        weather = WeatherService.get_current_weather(lat, lon, date_obj)
        
        return {
            "temperature": weather['temperature'],
            "humidity": weather['humidity'],
            "wind_speed": weather['wind_speed'],
            "wind_direction": weather['wind_direction'],
            "cloud_cover": weather['cloud_cover'],
            "pressure": weather['pressure'],
            "precipitation": weather['precipitation'],
            "solar_radiation": weather['solar_radiation'],
            "location": {"lat": lat, "lon": lon}
        }
    except Exception as e:
        print(f"❌ Error fetching weather: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    print("🌡️  Starting UrbanEyes Thermal Comfort API...")
    print("📍 Listening on http://localhost:8000")
    print("📖 API docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
