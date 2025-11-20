# Export Layer Organization Guide

## Overview
Context map exports now feature **intelligent layer organization** for seamless editing in design and GIS software.

---

## SVG Layer Structure

### How Layers are Organized
Features are automatically grouped by **category and color** into named layers:

```xml
<svg>
  <!-- Layer: Residential (120 features, #3b82f6) -->
  <g id="layer_Residential" class="layer" data-category="Residential" data-color="#3b82f6">
    <path id="Residential_0_0" d="..." fill="#3b82f6" />
    <path id="Residential_1_0" d="..." fill="#3b82f6" />
    ...
  </g>
  
  <!-- Layer: Commercial (85 features, #a855f7) -->
  <g id="layer_Commercial" class="layer" data-category="Commercial" data-color="#a855f7">
    <path id="Commercial_0_0" d="..." fill="#a855f7" />
    ...
  </g>
  
  <!-- Layer: Title and Metadata -->
  <g id="layer_Title_Metadata">
    <text>...</text>
  </g>
</svg>
```

### Benefits
- ✅ **Quick editing**: Select entire categories at once
- ✅ **Easy visibility control**: Toggle layers on/off
- ✅ **Color management**: Change colors per category
- ✅ **Non-destructive editing**: Lock layers to prevent changes
- ✅ **Export flexibility**: Export individual layers as separate files

### Layer Naming Convention
- `layer_{Category}` - Main layer group
- `{Category}_{Index}_{Ring}` - Individual feature IDs
- `layer_Title_Metadata` - Always on top

---

## GeoJSON Layer Structure

### Enhanced Schema
```json
{
  "type": "FeatureCollection",
  "features": [...],  // All features (standard GeoJSON)
  "layers": [         // NEW: Organized by category
    {
      "name": "Residential",
      "color": "#3b82f6",
      "category": "Residential",
      "features": [
        {
          "type": "Feature",
          "geometry": {...},
          "properties": {
            "buildingType": "Residential",
            "color": "#3b82f6",
            ...
          }
        }
      ]
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
    "layerCount": 5,      // NEW
    "featureCount": 234   // NEW
  }
}
```

### Benefits
- ✅ **Pre-filtered groups**: Access features by category without filtering
- ✅ **Faster processing**: Skip features you don't need
- ✅ **Statistics ready**: Layer and feature counts included
- ✅ **Backward compatible**: Standard `features` array still present
- ✅ **Rule-based styling**: Use layer info for automatic symbolization

### Using Layers in QGIS
```python
# Python console in QGIS
import json

# Load GeoJSON
with open('export.geojson') as f:
    data = json.load(f)

# Access pre-organized layers
for layer in data['layers']:
    print(f"{layer['name']}: {len(layer['features'])} features")
    
# Filter to specific layer
residential = [f for f in data['features'] 
               if f['properties'].get('category') == 'Residential']
```

---

## Example Workflows

### Workflow 1: Quick Color Adjustment in Illustrator
1. Export SVG from UrbanEyes
2. Open in Illustrator
3. Go to **Layers Panel** (Window > Layers)
4. Select `layer_Residential`
5. Change fill color to custom brand color
6. Lock layer to prevent changes
7. Repeat for other categories

### Workflow 2: Land Use Analysis in QGIS
1. Export GeoJSON from UrbanEyes
2. Add to QGIS project
3. Open **Attribute Table**
4. Filter by `category = 'Park'` to see only green spaces
5. Calculate total area: `$area` in Field Calculator
6. Export filtered layer as Shapefile

### Workflow 3: Urban Design Presentation
1. Export SVG (Building Types)
2. Open in Illustrator
3. Hide all layers except `layer_Residential` and `layer_Commercial`
4. Add custom annotations and design elements
5. Export as high-res PDF for client presentation

### Workflow 4: Multi-Layer Analysis in ArcGIS
1. Export GeoJSON (Building Height)
2. Import to ArcGIS Pro
3. Create **Definition Queries** for each height range:
   - `heightRange = '<10m'`
   - `heightRange = '10-20m'`
   - etc.
4. Apply graduated color scheme
5. Generate 3D visualization using height values

---

## Layer Categories by Map Type

### Building Types
- Residential
- Commercial
- Office
- School/University
- Industrial
- Institutional
- Mixed-Use
- Other

### Building Heights
- <10m
- 10-20m
- 20-30m
- 30-50m
- >50m
- Unknown

### Building Age
- Pre-1960
- 1960-1975
- 1975-1990
- 1990-2005
- 2005+
- Unknown

### Land Use
- Residential
- Commercial
- Industrial
- Park/Green
- Water
- Agricultural
- Institutional
- Other

### Road Types
- Motorway
- Primary
- Secondary
- Tertiary
- Residential
- Service
- Other

---

## Advanced Tips

### Illustrator Power Users
- **Global Color Changes**: Use "Edit > Edit Colors > Recolor Artwork" to change all instances of a color
- **Layer Comps**: Save different layer visibility states for presentations
- **Symbol Libraries**: Convert repeated elements to symbols for consistency
- **Clipping Masks**: Use site boundary as clipping mask for clean edges

### QGIS Power Users
- **Virtual Layers**: Combine multiple layers using SQL queries
- **Model Builder**: Automate layer filtering and analysis workflows
- **Atlas Generation**: Create map series using layer categories as iterator
- **Layer Actions**: Add clickable actions to show OSM details in browser

### Performance Optimization
- **Large datasets**: Filter by layer before loading to reduce memory usage
- **Batch processing**: Use layer information to process categories in parallel
- **Selective export**: Only export layers you need for specific analysis

---

## Technical Implementation

### SVG Grouping Algorithm
```typescript
// Group features by category and color
const layerGroups: Map<string, GeoJSONLayer> = new Map();

geoJSON.features.forEach(feature => {
  const category = feature.properties.buildingType || 
                  feature.properties.landUseType || ...;
  const color = feature.properties.color;
  const key = `${category}_${color}`;
  
  if (!layerGroups.has(key)) {
    layerGroups.set(key, { color, category, features: [] });
  }
  layerGroups.get(key).features.push(feature);
});

// Render each group as <g> element
layerGroups.forEach((group, key) => {
  svgContent += `<g id="layer_${group.category}">\n`;
  // ... render features
  svgContent += `</g>\n`;
});
```

### GeoJSON Layer Organization
```typescript
function organizeGeoJSONLayers(geoJSON: GeoJSONFeatureCollection) {
  const layerMap = new Map();
  
  geoJSON.features.forEach(feature => {
    const category = determineCategory(feature.properties);
    const color = feature.properties.color;
    const key = `${category}_${color}`;
    
    if (!layerMap.has(key)) {
      layerMap.set(key, {
        name: category,
        color,
        category,
        features: []
      });
    }
    layerMap.get(key).features.push(feature);
  });
  
  return {
    ...geoJSON,
    layers: Array.from(layerMap.values()),
    metadata: {
      ...geoJSON.metadata,
      layerCount: layerMap.size,
      featureCount: geoJSON.features.length
    }
  };
}
```

---

## Compatibility

### SVG Layers Compatible With:
- ✅ Adobe Illustrator (2020+)
- ✅ Figma
- ✅ Sketch
- ✅ Inkscape
- ✅ Affinity Designer
- ✅ CorelDRAW (2021+)
- ✅ Web browsers (with CSS layer styling)

### GeoJSON Layers Compatible With:
- ✅ QGIS (3.x)
- ✅ ArcGIS Pro (2.x+)
- ✅ ArcGIS Online
- ✅ Mapbox Studio
- ✅ Leaflet (with custom parsing)
- ✅ OpenLayers (with custom parsing)
- ✅ Python GeoPandas
- ✅ R sf package

---

## Future Enhancements

Planned improvements:
- [ ] Custom layer naming/renaming
- [ ] Layer visibility presets (save/load configurations)
- [ ] Layer-based statistics in metadata
- [ ] Color palette export for design systems
- [ ] Layer splitting (export each layer as separate file)
- [ ] Style files for QGIS (.qml) and ArcGIS (.lyr)
- [ ] Layer filtering in export UI

---

*Last updated: November 10, 2025*
*UrbanEyes v5.0 - Intelligent Layer Organization*
