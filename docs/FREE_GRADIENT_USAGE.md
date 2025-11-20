# FREE GRADIENT SYSTEM - USAGE GUIDE

## 🎯 Complete Free/Open-Source Environmental Gradient System

This is a **100% free and open-source** alternative to commercial gradient systems like infrared.city, using only:
- ✅ OpenStreetMap building data
- ✅ Free physics models (ASHRAE, urban canyon meteorology)
- ✅ Free color schemes (Matplotlib)
- ✅ WebGL GPU acceleration
- ✅ Open-source libraries (Three.js, React Three Fiber, SunCalc)

---

## 📦 Installation

```bash
# All dependencies are already in your package.json
npm install three @react-three/fiber suncalc
npm install --save-dev @types/three
```

---

## 🚀 Quick Start

### 1. Basic Usage in React Three Fiber

```tsx
import { Canvas } from '@react-three/fiber';
import { FreeEnvironmentalGradient } from './components/FreeEnvironmentalGradient';

function App() {
    return (
        <Canvas>
            <FreeEnvironmentalGradient
                mode="solar"
                bounds={{
                    minLat: 40.7589,
                    maxLat: 40.7599,
                    minLon: -73.9851,
                    maxLon: -73.9841
                }}
                sceneBounds={{
                    minX: -50,
                    maxX: 50,
                    minZ: -50,
                    maxZ: 50
                }}
                date={new Date('2024-06-21T12:00:00')} // Summer solstice noon
                weather={{
                    temperature: 25,
                    windSpeed: 3,
                    windDirection: 270,
                    humidity: 60,
                    cloudCover: 0.2
                }}
            />
        </Canvas>
    );
}
```

### 2. Solar Radiation Analysis

```tsx
<FreeEnvironmentalGradient
    mode="solar"
    date={new Date('2024-12-21T14:00:00')} // Winter afternoon
    weather={{ cloudCover: 0.0 }} // Clear sky
    options={{
        colorScheme: 'plasma', // Yellow-orange-red for heat
        smoothing: 3,
        buildingFeather: 0.9, // Soft shadows
        bloomIntensity: 0.5 // Glow on sunny spots
    }}
/>
```

### 3. Shadow Analysis

```tsx
<FreeEnvironmentalGradient
    mode="shadow"
    date={new Date('2024-06-21T08:00:00')} // Morning shadows
    options={{
        colorScheme: 'inferno', // Dark-to-light
        smoothing: 1, // Sharper edges
        buildingFeather: 0.5, // Less blur
        bloomIntensity: 0.1
    }}
/>
```

### 4. Wind Analysis with Vectors

```tsx
<FreeEnvironmentalGradient
    mode="wind"
    weather={{
        windSpeed: 5,
        windDirection: 315, // Northwest
    }}
    options={{
        colorScheme: 'viridis', // Blue-green-yellow
        smoothing: 2,
        showWindVectors: true, // ARROWS!
        resolution: 128 // Higher detail
    }}
/>
```

### 5. Thermal Comfort

```tsx
<FreeEnvironmentalGradient
    mode="comfort"
    date={new Date('2024-07-15T15:00:00')} // Hot summer afternoon
    weather={{
        temperature: 32,
        humidity: 75,
        windSpeed: 1,
        cloudCover: 0.3
    }}
    options={{
        colorScheme: 'magma', // Purple-red for discomfort
        bloomIntensity: 0.4
    }}
/>
```

---

## 🎨 Customization Options

### Color Schemes (FREE - Matplotlib)
```tsx
options={{
    colorScheme: 'viridis' | 'plasma' | 'inferno' | 'magma'
}}
```

- **viridis**: Blue → Green → Yellow (perceptually uniform)
- **plasma**: Purple → Orange → Yellow (vibrant)
- **inferno**: Black → Red → Yellow (dramatic)
- **magma**: Black → Purple → Pink (warm)

### Smoothing Levels
```tsx
options={{
    smoothing: 0 // No blur (sharp)
    smoothing: 2 // Medium (recommended)
    smoothing: 5 // Maximum (very smooth)
}}
```

### Building Edge Effects
```tsx
options={{
    buildingFeather: 0.0 // Sharp edges
    buildingFeather: 0.8 // Soft transition (recommended)
    buildingFeather: 1.0 // Very soft
}}
```

### Bloom (Glow Effect)
```tsx
options={{
    bloomIntensity: 0.0 // No glow
    bloomIntensity: 0.3 // Subtle (recommended)
    bloomIntensity: 0.7 // Strong glow
}}
```

### Resolution
```tsx
options={{
    resolution: 64   // Fast, lower quality
    resolution: 100  // Balanced (default)
    resolution: 256  // Slow, highest quality
}}
```

---

## 🔧 Advanced Integration

### With Existing Viewer3D Component

Replace your current `PedestrianEnvironmentalAnalysis` with:

```tsx
// In Viewer3D.tsx
import { FreeEnvironmentalGradient } from '../components/FreeEnvironmentalGradient';

// Inside your Canvas
{environmentalMode && (
    <FreeEnvironmentalGradient
        mode={environmentalMode}
        bounds={{
            minLat: selectedSite.minLat,
            maxLat: selectedSite.maxLat,
            minLon: selectedSite.minLon,
            maxLon: selectedSite.maxLon
        }}
        sceneBounds={{
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        }}
        date={currentDate}
        weather={weatherData}
        buildingMeshes={buildingMeshes}
        options={{
            colorScheme: getColorScheme(environmentalMode),
            smoothing: 2,
            buildingFeather: 0.8,
            bloomIntensity: 0.3,
            showWindVectors: environmentalMode === 'wind'
        }}
    />
)}
```

### Real-Time Updates

The component automatically updates when:
- Mode changes (solar → wind)
- Date/time changes (slider)
- Weather changes (wind speed, direction)
- Bounds change (pan/zoom)

### Performance Optimization

```tsx
// For large areas, reduce resolution
<FreeEnvironmentalGradient
    options={{ resolution: 64 }}
/>

// For mobile, disable vectors
<FreeEnvironmentalGradient
    options={{ showWindVectors: false }}
/>

// For static scenes, disable bloom
<FreeEnvironmentalGradient
    options={{ bloomIntensity: 0 }}
/>
```

---

## 📊 Data Sources (ALL FREE)

### Building Data
- **Source**: OpenStreetMap Overpass API
- **License**: ODbL (Open Database License)
- **Coverage**: Worldwide
- **Update**: Fetched on-demand

### Solar Position
- **Source**: SunCalc library
- **License**: MIT
- **Formula**: NOAA solar position algorithm

### Physics Models
- **Solar**: ASHRAE clear sky model
- **Shadow**: Ray-casting (Three.js)
- **Wind**: Urban canyon meteorology (Oke 1987)
- **Comfort**: Simplified PET (Höppe 1999)

### Color Schemes
- **Source**: Matplotlib
- **License**: BSD
- **Quality**: Perceptually uniform

---

## 🐛 Troubleshooting

### "No buildings found"
- Check your bounds are correct
- Ensure lat/lon order is correct (minLat < maxLat)
- Try a larger area

### "Gradient not visible"
- Check mesh position matches scene bounds
- Verify mode is set correctly
- Ensure date/weather values are reasonable

### "Low performance"
- Reduce resolution to 64
- Disable wind vectors
- Disable bloom
- Use smaller bounds

### "Colors look wrong"
- Try different color scheme
- Check value ranges (min/max)
- Adjust smoothing

---

## 🔬 How It Works

1. **Data Fetching**: Queries OSM Overpass API for buildings
2. **Spatial Grid**: Rasterizes buildings to uniform grid
3. **Physics Simulation**: Calculates environmental values per cell
4. **GPU Rendering**: Uploads data to WebGL texture
5. **Shader Processing**: Applies color mapping, smoothing, bloom
6. **Real-Time Update**: Re-computes on parameter change

**ALL steps use free/open-source tools!**

---

## 📚 References

- OpenStreetMap: https://www.openstreetmap.org
- Overpass API: https://overpass-api.de
- SunCalc: https://github.com/mourner/suncalc
- ASHRAE Handbook: https://www.ashrae.org
- Urban Canyon Meteorology: Oke, T.R. (1987)
- PET Model: Höppe, P. (1999)
- Matplotlib Colormaps: https://matplotlib.org/stable/tutorials/colors/colormaps.html

---

## 📄 License

This gradient system is **100% free and open-source**:
- Code: MIT License
- Data: ODbL License (OpenStreetMap)
- Color schemes: BSD License (Matplotlib)

**No commercial APIs, no paid services, no subscription fees!**

---

## 🎯 Next Steps

1. **Test it**: Reload your scene in wind/solar/shadow modes
2. **Adjust**: Try different color schemes and smoothing
3. **Optimize**: Tune resolution for your hardware
4. **Extend**: Add more weather parameters (precipitation, UV)
5. **Share**: This is open-source!

**You now have infrared.city-quality gradients with ZERO licensing costs! 🎉**
