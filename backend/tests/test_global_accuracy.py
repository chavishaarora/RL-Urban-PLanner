"""
Test script for global accuracy of solar and weather calculations
Tests sunrise/sunset times for major cities: Barcelona, NYC, Delhi, Rotterdam
"""

from weather_service import WeatherService
from datetime import datetime, timezone
import pytz

# Test cities with known coordinates
CITIES = {
    "Barcelona": {"lat": 41.3851, "lon": 2.1734, "tz": "Europe/Madrid"},
    "New York": {"lat": 40.7128, "lon": -74.0060, "tz": "America/New_York"},
    "Delhi": {"lat": 28.6139, "lon": 77.2090, "tz": "Asia/Kolkata"},
    "Rotterdam": {"lat": 51.9225, "lon": 4.47917, "tz": "Europe/Amsterdam"},
    "Sydney": {"lat": -33.8688, "lon": 151.2093, "tz": "Australia/Sydney"},
    "Tokyo": {"lat": 35.6762, "lon": 139.6503, "tz": "Asia/Tokyo"},
}

def test_sunrise_sunset():
    """Test sunrise/sunset calculations for accuracy"""
    print("=" * 80)
    print("SUNRISE/SUNSET ACCURACY TEST")
    print("=" * 80)
    print()
    
    # Test for summer and winter solstice
    test_dates = [
        datetime(2025, 6, 21, 12, 0, 0),  # Summer solstice
        datetime(2025, 12, 21, 12, 0, 0),  # Winter solstice
        datetime(2025, 3, 20, 12, 0, 0),   # Spring equinox
    ]
    
    for date in test_dates:
        print(f"\n📅 {date.strftime('%B %d, %Y')} (UTC)")
        print("-" * 80)
        
        for city, coords in CITIES.items():
            try:
                # Get timezone-aware date
                tz = pytz.timezone(coords['tz'])
                local_date = tz.localize(date)
                
                sun_data = WeatherService.get_sunrise_sunset(
                    coords['lat'],
                    coords['lon'],
                    local_date
                )
                
                sunrise = sun_data['sunrise']
                sunset = sun_data['sunset']
                day_length = sun_data['day_length']
                
                sunrise_str = sunrise.strftime('%H:%M') if sunrise else "N/A (polar night)"
                sunset_str = sunset.strftime('%H:%M') if sunset else "N/A (polar night)"
                
                print(f"{city:15} | Sunrise: {sunrise_str:10} | Sunset: {sunset_str:10} | Day: {day_length:5.2f}h")
                
            except Exception as e:
                print(f"{city:15} | ERROR: {e}")
    
    print()

def test_weather_accuracy():
    """Test weather data fetching"""
    print("=" * 80)
    print("WEATHER DATA ACCURACY TEST")
    print("=" * 80)
    print()
    
    date = datetime.now(timezone.utc)
    print(f"📍 Current conditions ({date.strftime('%Y-%m-%d %H:%M UTC')})")
    print("-" * 80)
    
    for city, coords in CITIES.items():
        try:
            weather = WeatherService.get_current_weather(
                coords['lat'],
                coords['lon'],
                date
            )
            
            print(f"{city:15} | {weather['temperature']:5.1f}°C | "
                  f"{weather['wind_speed']:4.1f}m/s | "
                  f"{weather['humidity']:3.0f}% RH | "
                  f"{weather['cloud_cover']*100:3.0f}% clouds | "
                  f"{weather['solar_radiation']:6.0f}W/m²")
            
        except Exception as e:
            print(f"{city:15} | Using climate defaults: {str(e)[:50]}")
    
    print()

def test_timezone_detection():
    """Test timezone detection accuracy"""
    print("=" * 80)
    print("TIMEZONE DETECTION TEST")
    print("=" * 80)
    print()
    
    for city, coords in CITIES.items():
        detected_tz = WeatherService.get_timezone(coords['lat'], coords['lon'])
        expected_tz = coords['tz']
        match = "✅" if detected_tz == expected_tz else "⚠️"
        
        print(f"{city:15} | Expected: {expected_tz:25} | Detected: {detected_tz:25} {match}")
    
    print()

if __name__ == "__main__":
    print()
    print("🌍 GLOBAL ACCURACY VERIFICATION")
    print("Testing solar position, weather data, and timezone detection")
    print()
    
    test_timezone_detection()
    test_sunrise_sunset()
    test_weather_accuracy()
    
    print("=" * 80)
    print("✅ Testing complete!")
    print()
    print("References for verification:")
    print("  • Sunrise/sunset: https://www.timeanddate.com/sun/")
    print("  • Weather: https://open-meteo.com/")
    print("=" * 80)
