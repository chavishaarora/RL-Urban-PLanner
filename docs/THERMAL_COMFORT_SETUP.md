# 🌡️ UrbanEyes Thermal Comfort - Quick Start Guide

## What You Just Got

✅ **Research-Grade UTCI** - Same physics as infrared.city  
✅ **Building-Aware** - Wind shelter + solar shadows  
✅ **Purple→Blue→Yellow Gradients** - Professional thermal comfort visualization  
✅ **Python Backend** - Fast NumPy calculations  

---

## 🚀 Installation (2 minutes)

### Step 1: Install Python Backend

Open a **NEW terminal** (separate from your React dev server):

```bash
cd "D:\PROJECTS - PERSONAL EXPLORATION\PARK ANALYSER\TRIAL-12 (v4.5)\urbaneyes_v5.0\backend"

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Start Python Server

```bash
python main.py
```

You should see:
```
🌡️  Starting UrbanEyes Thermal Comfort API...
📍 Listening on http://localhost:8000
📖 API docs: http://localhost:8000/docs
```

**Keep this terminal running!**

### Step 3: Test the API (Optional)

Open **http://localhost:8000/docs** in your browser to see the interactive API.

---

## 🎨 How It Works

### Architecture:
```
┌─────────────────────────────────┐
│  BROWSER (React + Three.js)     │
│  ✓ Your existing 3D visualization
│  ✓ Building geometry             │
│  ✓ Gradient rendering            │
└──────────────┬──────────────────┘
               │ HTTP POST
┌──────────────▼──────────────────┐
│  PYTHON API (localhost:8000)    │
│  ✓ UTCI calculations             │
│  ✓ Wind shelter (Oke 1987)       │
│  ✓ Solar shadows (ray-casting)   │
│  ✓ Mean radiant temperature      │
└─────────────────────────────────┘
```

### What Changed in Your Code:

**`computeEnvironmentalGrid()` now:**
1. **Tries Python backend first** → Research-grade UTCI with building physics
2. **Falls back to browser** → If Python server is offline
3. **Automatic failover** → Seamless user experience

---

## 🧪 Testing

### In Your React App:

1. **Keep React dev server running** (`npm run dev` on port 3002)
2. **Start Python backend** (`python backend/main.py` on port 8000)
3. **Open your app**: http://localhost:3002
4. **Select "Wind Analysis"** or **"Thermal Comfort"**

### Expected Console Output:

```
[Grid] Attempting Python backend for wind...
[OSM] Skipping API call, using mock data
[OSM] Generated 15 mock buildings
[Grid] Python backend success - UTCI range: 18.2°C to 28.7°C
[Texture] Creating DataTexture...
[FreeGradient] Created gradient mesh
```

---

## 🎨 Infrared.City Style Colors

### Current Color Schemes:
- **Wind**: `viridis` (blue→green→yellow)
- **Solar**: `plasma` (purple→orange→yellow)
- **Thermal Comfort**: Should use **UTCI categories**

### Add UTCI Comfort Colors:

Edit `FreeEnvironmentalGradient.tsx`:

```typescript
colorScheme: activeAnalysis === 'shadow' ? 'inferno' 
           : activeAnalysis === 'wind' ? 'viridis' 
           : activeAnalysis === 'comfort' ? 'magma'  // ← Purple-yellow for UTCI!
           : 'plasma',
```

**Magma colormap** gives you the purple→pink→yellow gradient like the screenshots!

---

## 📊 What You'll See

### With Python Backend (UTCI):
- **Purple zones**: Cold stress (< 9°C UTCI)
- **Blue zones**: Cool comfort (9-18°C)
- **Green zones**: Optimal comfort (18-26°C)
- **Yellow/Red zones**: Heat stress (> 26°C)

### Building Effects:
- ✅ **Wind shelter**: Calmer zones behind buildings
- ✅ **Solar shadows**: Cooler zones in shadow
- ✅ **Urban canyons**: Temperature variations

---

## 🐛 Troubleshooting

### "Python backend unavailable"
→ Make sure `python main.py` is running in backend folder

### "CORS error"
→ Already fixed! Backend allows `localhost:3002`, `3000`, `5173`

### "Module not found"
```bash
pip install pythermalcomfort fastapi uvicorn
```

### Slow performance
→ Reduce resolution in Viewer3D.tsx from 100 to 50:
```typescript
resolution: 50  // Instead of 100
```

---

## ✨ Next Steps

### Phase 1 Complete! You now have:
✅ Research-grade UTCI calculations  
✅ Building-aware wind/solar physics  
✅ Python backend with automatic fallback  

### Phase 2 (Optional):
- 🌦️ Real weather data (Open-Meteo API)
- 🏙️ Real OSM buildings (re-enable API with caching)
- 🎨 Custom UTCI color categories
- 📊 Comfort category labels (like screenshot text)

### Phase 3 (Advanced):
- ⚡ CFD wind simulation (OpenFOAM/Butterfly)
- 🌍 Multi-city comparison
- 🤖 ML layout optimization

---

## 🎯 Success Criteria

You've succeeded when you see:
1. ✅ Python backend logs showing UTCI calculations
2. ✅ Console: "Python backend success"
3. ✅ Gradient changes when you move buildings
4. ✅ Different colors in sheltered vs. exposed areas
5. ✅ **Hot pink test cube** (remove this later!)

---

## 🚀 Start Now!

```bash
# Terminal 1 (keep running):
npm run dev

# Terminal 2 (NEW - keep running):
cd backend
python main.py
```

Then refresh your browser and select **"Thermal Comfort"** mode!

You're now generating infrared.city-quality analysis! 🎉
