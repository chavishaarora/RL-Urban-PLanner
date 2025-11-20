# UrbanEyes Thermal Comfort Backend

Research-grade microclimate analysis using UTCI/PET models with building-aware physics.

## 🚀 Quick Start

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
python main.py
```

Server will start at **http://localhost:8000**

### 3. Test the API

Open **http://localhost:8000/docs** to see interactive API documentation.

## 📊 Features

### Thermal Comfort Models
- ✅ **UTCI** (Universal Thermal Climate Index) - ISO 7730
- ✅ **PET** (Physiological Equivalent Temperature) - VDI 3787
- ✅ Building-aware wind shelter
- ✅ Solar radiation with shadow casting
- ✅ Mean radiant temperature calculation

### Analysis Types
- `utci` - Thermal comfort (perceived temperature)
- `pet` - Physiological equivalent temperature
- `wind` - Wind speed with building effects
- `solar` - Solar radiation with shadows

## 🔬 Physics Models

### Wind Shelter (Urban Canyon)
Based on **Oke (1987)** urban meteorology:
- Logarithmic wind profile
- Building wake effects
- Shelter zone calculation (3× building height)

### Solar Radiation
Using **ASHRAE Clear Sky Model**:
- Direct normal irradiance (DNI)
- Diffuse horizontal irradiance (DHI)
- Cloud cover attenuation
- Building shadow ray-casting

### Mean Radiant Temperature
Simplified **6-direction view factor**:
- Longwave radiation from surfaces
- Shortwave solar absorption
- Pedestrian-specific geometry

## 📡 API Example

```python
import requests

response = requests.post('http://localhost:8000/api/thermal-comfort', json={
    "bounds": {
        "south": 40.758,
        "north": 40.760,
        "west": -73.986,
        "east": -73.984
    },
    "buildings": [
        {
            "id": "1",
            "geometry": [[40.759, -73.985], [40.759, -73.9845], [40.7595, -73.9845], [40.7595, -73.985]],
            "height": 30
        }
    ],
    "weather": {
        "temperature": 25,
        "humidity": 60,
        "wind_speed": 3,
        "wind_direction": 270,
        "cloud_cover": 0.2
    },
    "date": "2024-06-21T14:00:00",
    "resolution": 100,
    "analysis_type": "utci"
})

data = response.json()
print(f"UTCI range: {data['min']:.1f}°C to {data['max']:.1f}°C")
```

## 🎨 UTCI Comfort Categories

| UTCI (°C) | Category | Color (Recommended) |
|-----------|----------|---------------------|
| < -40 | Extreme cold stress | Dark purple |
| -40 to -27 | Very strong cold stress | Purple |
| -27 to -13 | Strong cold stress | Blue-purple |
| -13 to +9 | Moderate cold stress | Blue |
| +9 to +26 | No thermal stress | Green |
| +26 to +32 | Moderate heat stress | Yellow |
| +32 to +38 | Strong heat stress | Orange |
| +38 to +46 | Very strong heat stress | Red |
| > +46 | Extreme heat stress | Dark red |

## 📚 References

- **UTCI**: Błażejczyk et al. (2013) - Universal Thermal Climate Index
- **PET**: Höppe (1999) - The physiological equivalent temperature
- **Urban Wind**: Oke (1987) - Boundary Layer Climates
- **Solar**: ASHRAE Handbook - Fundamentals
- **pythermalcomfort**: Tartarini et al. (2020) - DOI: 10.1016/j.softx.2020.100578

## ⚡ Performance

- 100×100 grid: ~2-3 seconds
- 200×200 grid: ~8-10 seconds
- Scales linearly with resolution²

## 🔧 Troubleshooting

### ImportError: No module named 'pythermalcomfort'
```bash
pip install pythermalcomfort
```

### CORS errors from frontend
Check that your frontend URL is in the `allow_origins` list in `main.py`.

### Slow performance
Reduce `resolution` parameter (try 50 or 75 instead of 100).
