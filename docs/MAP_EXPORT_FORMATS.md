# Context Maps Export Formats

## Overview
UrbanEyes now supports exporting context maps in three different formats: **PNG**, **SVG**, and **GeoJSON**. Each format serves different use cases for urban planning and analysis workflows.

## Export Formats

### 1. PNG (Portable Network Graphics)
**Best for:** Print, presentations, reports

**Features:**
- High-resolution raster image (2x scale)
- **Exports the currently visible map only** (not all 8 maps)
- Automatically captures whichever sub-map is active (Type, Height, Age, etc.)
- Resolution: Variable based on viewport size (scaled 2x for quality)
- Color-coded based on analysis type
- Waits 10 seconds for map tiles and overlays to load

**Output:** `{LocationName}_{MapType}_{Date}.png` (single file)

---

### 2. SVG (Scalable Vector Graphics)
**Best for:** Design software (Adobe Illustrator, Figma), infinite scaling, web graphics

**Features:**
- Vector format - scales infinitely without quality loss
- **Organized in layers by category/color** for easy editing in Illustrator
- Each layer is a separate `<g>` group with descriptive IDs
- Editable in vector graphics software
- Smaller file size than PNG
- Preserves color coding from OSM data
- Includes title and location metadata
- Canvas size: 1200x1200 viewBox (scalable)

**Layer Organization:**
- Features are grouped by category (e.g., "Residential", "Commercial", "Park")
- Each layer has a unique ID like `layer_Residential`, `layer_Commercial`
- Layers include data attributes for color and category
- Easy to show/hide layers in Illustrator's Layers panel
- Easy to change colors per layer

**Supported Maps:**
- ✅ Building Types (layers: Residential, Commercial, Office, etc.)
- ✅ Building Height (layers: <10m, 10-20m, 20-30m, etc.)
- ✅ Building Footprint
- ✅ Building Age (layers: Pre-1960, 1960-1975, etc.)
- ✅ Land Use (layers: Residential, Park, Industrial, etc.)
- ✅ Street Hierarchy (layers: Primary, Secondary, Tertiary, etc.)
- ✅ Accessibility
- ❌ Population Density (only PNG - rendered visualization)

**Technical Details:**
- Polygons: Building footprints and land use zones
- LineStrings: Road network segments
- Colors: Extracted from OSM tags and classification
- Stroke width: Varies by road hierarchy
- Layer metadata: Includes category, color, and feature count

**Output:** `{LocationName}_{MapType}_{Date}.svg`

---

### 3. GeoJSON
**Best for:** GIS software (QGIS, ArcGIS), spatial analysis, web mapping libraries

**Features:**
- Standard geographic data format (RFC 7946)
- **Organized with layer information** for easy filtering in GIS software
- Contains actual coordinates (latitude/longitude)
- Preserves all OSM tags and metadata
- Color information included in properties
- Can be imported into any GIS tool
- Supports both polygons and linestrings
- Includes layer count and feature statistics

**Layer Organization:**
- Features are grouped by category in the `layers` array
- Each layer contains features of the same type/color
- Easy to filter by layer name or category in QGIS/ArcGIS
- Layer metadata includes name, color, category, and feature array
- Main `features` array still contains all features for compatibility

**Supported Maps:**
- ✅ Building Types (with `buildingType` property, organized by type)
- ✅ Building Height (with `estimatedHeight` and `heightRange` properties)
- ✅ Building Footprint (basic geometry + tags)
- ✅ Building Age (with `buildingAge` and `buildYear` properties)
- ✅ Land Use (with `landUseType` property, organized by land use)
- ✅ Street Hierarchy (with `roadType` property, organized by road type)
- ✅ Accessibility (road network with accessibility info)
- ❌ Population Density (only PNG - grid-based visualization)

**Structure:**
```json
{
  "type": "FeatureCollection",
  "features": [...],
  "layers": [
    {
      "name": "Residential",
      "color": "#3b82f6",
      "category": "Residential",
      "features": [...]
    },
    {
      "name": "Commercial",
      "color": "#a855f7",
      "category": "Commercial",
      "features": [...]
    }
  ],
  "metadata": {
    "location": "Site Name",
    "bounds": {...},
    "exported": "2025-11-10T...",
    "source": "OpenStreetMap",
    "layerCount": 5,
    "featureCount": 234
  }
}
```

**Output:** `{LocationName}_{MapType}_{Date}.geojson`

---

## Working with Layers

### In Adobe Illustrator:
1. **Open SVG file** in Illustrator
2. **Layers Panel** (Window > Layers) will show organized layers by category
3. **Layer names** correspond to categories (e.g., `layer_Residential`, `layer_Commercial`)
4. **Show/Hide layers** by clicking the eye icon
5. **Edit layer properties** by selecting a layer and changing fill/stroke
6. **Lock layers** to prevent accidental edits
7. **Reorder layers** by dragging in the Layers panel

**Tips:**
- All features of the same color/category are grouped together
- Use "Select All in Layer" to quickly modify all buildings of one type
- Export as PDF from Illustrator to maintain vector quality

### In Figma:
1. **Import SVG** (Cmd/Ctrl + Shift + K)
2. **Layers appear** in left sidebar organized by category
3. **Toggle visibility** with eye icon
4. **Modify colors** by selecting layer and changing fill
5. **Group layers** for complex edits

### In QGIS (GeoJSON):
1. **Add Vector Layer** > Select GeoJSON file
2. **Layer Properties** > Symbology
3. **Categorized** symbology based on `buildingType`, `roadType`, or other property
4. **Filter by layer** using the `category` property
5. Use **Expression Filter** to show specific layers:
   ```sql
   "category" = 'Residential'
   ```

**Tips:**
- The `layers` array in GeoJSON provides pre-organized groups
- Use layer information to set up rule-based styling automatically
- Export filtered layers to separate shapefiles if needed

### In ArcGIS (GeoJSON):
1. **Add Data** > Select GeoJSON file
2. **Symbology** > Unique Values > Field: `category`
3. **Definition Query** to filter by layer:
   ```sql
   category = 'Commercial'
   ```
4. **Export Layer** to save filtered features

---

## Use Cases by Format

### In the Context Maps View:

1. **Navigate to Context Maps** tab
2. **Select a site** from your projects
3. Click the **"Download As..."** button in the header
4. Choose your preferred format:
## How to Use

### In the Context Maps View:

1. **Navigate to Context Maps** tab
2. **Select a site** from your projects
| Use Case | Recommended Format |
|----------|-------------------|
| PowerPoint presentation | PNG |
| Printed reports | PNG |
| Design in Illustrator/Figma | SVG |
| Import to QGIS/ArcGIS | GeoJSON |
| Web mapping (Mapbox, Leaflet) | GeoJSON |
| Infinite zoom/scaling needed | SVG |
| Spatial analysis | GeoJSON |
| Quick sharing | PNG |
| Export specific map only | PNG, SVG, or GeoJSON |export captures exactly what you see on screen, so make sure the map has fully loaded before downloading.
| Import to QGIS/ArcGIS | GeoJSON |
| Web mapping (Mapbox, Leaflet) | GeoJSON |
| Infinite zoom/scaling needed | SVG |
| Spatial analysis | GeoJSON |
| Quick sharing | PNG |

---

## Implementation Details

### File Structure
```
services/
  ├── mapExportService.ts       # PNG export (existing)
  └── mapFormatExporter.ts      # SVG & GeoJSON export (new)

components/
  └── ContextMapsView.tsx        # UI with format dropdown
```

### Key Functions
**PNG Export:**
```typescript
exportSingleMap(locationName, mapName, options)
```
- Captures currently visible map from DOM
- Uses html2canvas for screenshot
- Waits for tiles to load (10 seconds)
- Downloads single PNG file directly0 seconds per map)
- Packages in ZIP with JSZip

**SVG Export:**
```typescript
exportContextMap(location, mapType, 'svg')
```
- Fetches OSM data via Overpass API
- Converts coordinates to SVG paths
- Preserves colors from classification
- Generates standalone SVG file

**GeoJSON Export:**
```typescript
exportContextMap(location, mapType, 'geojson')
```
- Fetches OSM data via Overpass API
- Converts to GeoJSON Feature Collection
- Includes all properties and metadata
- RFC 7946 compliant

---

## Data Sources

All exports use **OpenStreetMap** data fetched via the Overpass API:
- Buildings: `way["building"]` and `relation["building"]`
- Land Use: `way["landuse"]` and `relation["landuse"]`
- Roads: `way["highway"]`

**Radius:** 600 meters from site center

**Endpoints:**
1. Primary: `https://overpass-api.de/api/interpreter`
2. Fallback: `https://overpass.kumi.systems/api/interpreter`

---

## Classification Systems

### Building Types
- Residential (blue)
- Commercial (purple)
- Industrial (orange)
- Institutional (teal)
- Mixed-Use (pink)
- Other (gray)

### Building Heights
- <10m (light blue)
- 10-20m (blue)
- 20-30m (indigo)
- 30-50m (purple)
- >50m (violet)
- Unknown (gray)

### Building Age
- <1960 (amber)
- 1960-1975 (orange)
- 1975-1990 (red)
- 1990-2005 (pink)
- >2005 (teal)
- Unknown (gray)

### Land Use Types
- Residential (light blue)
- Commercial (purple)
- Industrial (orange)
- Park/Green (green)
- Water (blue)
- Agricultural (yellow)
- Institutional (teal)
- Other (gray)

### Road Types
- Motorway (red)
- Primary (orange)
- Secondary (yellow)
- Tertiary (green)
- Residential (light blue)
- Service (gray)
- Other (light gray)

---

## Limitations

1. **Population Density** map only supports PNG export (rendered visualization, not vector data)
2. **Data availability** depends on OSM coverage in the area
3. **Export size** limited by browser memory (typically <100MB)
4. **Overpass API** has rate limits (wait if many exports)
5. **Coordinate system** is WGS84 (EPSG:4326) for GeoJSON

---

## Future Enhancements

Potential additions:
- [ ] PDF export with legends
- [ ] DXF/SHP formats for CAD software
- [ ] Custom .urbx format with all project data
- [ ] Batch export multiple sites
- [ ] Custom color schemes
- [ ] Export with elevation data (3D GeoJSON)
- [ ] Export to Google Earth (KML/KMZ)

---

## Troubleshooting

**Issue:** SVG/GeoJSON export fails
- **Solution:** Check internet connection (needs OSM data)
- **Solution:** Try again in a few seconds (Overpass rate limit)

**Issue:** PNG export incomplete
- **Solution:** Increase wait time in mapExportService.ts
- **Solution:** Ensure stable internet for map tiles

**Issue:** GeoJSON has no features
- **Solution:** Area might have limited OSM data
- **Solution:** Try a different location with better coverage

**Issue:** SVG colors don't match
- **Solution:** Colors based on OSM tags, not visual appearance
- **Solution:** Edit SVG in vector software to customize

---

## Technical Support

For issues or enhancements:
1. Check browser console for errors
2. Verify OSM data coverage at openstreetmap.org
3. Test with different locations
4. Contact development team

---

*Last updated: November 10, 2025*
*UrbanEyes v5.0*
