"""
SimCity-Style Heat Map System
Interactive data layer visualization for park analysis
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from enum import Enum

try:
    from ..environment.park import Park, Position
    from ..config import ElementType, park_config
except ImportError:
    pass


class HeatMapType(Enum):
    """Available heat map visualizations"""
    NONE = "none"
    THERMAL_COMFORT = "thermal_comfort"
    SHADE_COVERAGE = "shade_coverage"
    LIGHT_COVERAGE = "light_coverage"
    PEDESTRIAN_DENSITY = "pedestrian_density"
    ACCESSIBILITY = "accessibility"
    EFFECTIVE_TEMPERATURE = "effective_temperature"
    OVERALL_QUALITY = "overall_quality"


class HeatMapGenerator:
    """Generates heat map data for various metrics"""
    
    def __init__(self, park: Park, resolution: int = 40):
        self.park = park
        self.resolution = resolution
        self.current_type = HeatMapType.NONE
        self.cache = {}
        
    def generate(self, heatmap_type: HeatMapType, agent_manager=None) -> Optional[np.ndarray]:
        """Generate heat map data based on type"""
        
        if heatmap_type == HeatMapType.NONE:
            return None
            
        # Check cache (simple optimization)
        cache_key = f"{heatmap_type.value}_{len(self.park.elements)}"
        if cache_key in self.cache and heatmap_type != HeatMapType.PEDESTRIAN_DENSITY:
            return self.cache[cache_key]
        
        # Generate based on type
        if heatmap_type == HeatMapType.THERMAL_COMFORT:
            data = self._generate_thermal_comfort()
        elif heatmap_type == HeatMapType.SHADE_COVERAGE:
            data = self._generate_shade_coverage()
        elif heatmap_type == HeatMapType.LIGHT_COVERAGE:
            data = self._generate_light_coverage()
        elif heatmap_type == HeatMapType.PEDESTRIAN_DENSITY:
            data = self._generate_pedestrian_density(agent_manager)
        elif heatmap_type == HeatMapType.ACCESSIBILITY:
            data = self._generate_accessibility()
        elif heatmap_type == HeatMapType.EFFECTIVE_TEMPERATURE:
            data = self._generate_effective_temperature()
        elif heatmap_type == HeatMapType.OVERALL_QUALITY:
            data = self._generate_overall_quality()
        else:
            return None
        
        # Cache result (except density which changes constantly)
        if heatmap_type != HeatMapType.PEDESTRIAN_DENSITY:
            self.cache[cache_key] = data
            
        return data
    
    def clear_cache(self):
        """Clear the heat map cache (call when park changes)"""
        self.cache.clear()
    
    def _generate_thermal_comfort(self) -> np.ndarray:
        """Generate thermal comfort heat map (0-1, higher = more comfortable)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                pos = Position(x, y, 0)
                
                # Use park's thermal comfort calculation
                comfort = self.park.get_thermal_comfort_at_position(pos)
                heatmap[i, j] = comfort
        
        return heatmap
    
    def _generate_shade_coverage(self) -> np.ndarray:
        """Generate shade coverage heat map (0-1, 1 = full shade)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        trees = self.park.get_elements_by_type(ElementType.TREE)
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                pos = Position(x, y, 0)
                
                # Calculate shade intensity
                shade_intensity = 0.0
                for tree in trees:
                    distance = pos.distance_to(tree.position)
                    shade_radius = tree.size / 2 + 1.5
                    
                    if distance < shade_radius:
                        intensity = 1.0 - (distance / shade_radius)
                        shade_intensity = max(shade_intensity, intensity)
                
                heatmap[i, j] = shade_intensity
        
        return heatmap
    
    def _generate_light_coverage(self) -> np.ndarray:
        """Generate lighting coverage heat map (0-1, 1 = well lit)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        lamps = self.park.get_elements_by_type(ElementType.STREET_LAMP)
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                pos = Position(x, y, 0)
                
                # Calculate light intensity
                light_intensity = 0.0
                for lamp in lamps:
                    distance = pos.distance_to(lamp.position)
                    light_radius = 8.0  # Lamp coverage radius
                    
                    if distance < light_radius:
                        intensity = 1.0 - (distance / light_radius)
                        light_intensity += intensity * 0.7  # Allow overlap
                
                heatmap[i, j] = min(1.0, light_intensity)
        
        return heatmap
    
    def _generate_pedestrian_density(self, agent_manager) -> np.ndarray:
        """Generate pedestrian density heat map (higher = more crowded)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        if not agent_manager or not agent_manager.agents:
            return heatmap
        
        # Use Gaussian kernel for smooth density
        kernel_radius = 3.0  # Influence radius for each agent
        
        for agent in agent_manager.agents:
            # Convert agent position to grid
            agent_grid_x = int((agent.position.x + half_size) / self.park.size * self.resolution)
            agent_grid_y = int((agent.position.y + half_size) / self.park.size * self.resolution)
            
            # Apply Gaussian-like influence
            for i in range(self.resolution):
                for j in range(self.resolution):
                    dx = j - agent_grid_x
                    dy = i - agent_grid_y
                    distance = np.sqrt(dx**2 + dy**2)
                    
                    if distance < kernel_radius * (self.resolution / self.park.size):
                        influence = np.exp(-(distance**2) / (2 * (kernel_radius**2)))
                        heatmap[i, j] += influence
        
        # Normalize
        if np.max(heatmap) > 0:
            heatmap = heatmap / np.max(heatmap)
        
        return heatmap
    
    def _generate_accessibility(self) -> np.ndarray:
        """Generate accessibility heat map (distance to nearest amenity)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        if not self.park.elements:
            return heatmap
        
        max_distance = self.park.size / 2  # Maximum considered distance
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                pos = Position(x, y, 0)
                
                # Find nearest element
                min_distance = max_distance
                for element in self.park.elements:
                    distance = pos.distance_to(element.position)
                    min_distance = min(min_distance, distance)
                
                # Convert to accessibility score (closer = better)
                accessibility = 1.0 - (min_distance / max_distance)
                heatmap[i, j] = max(0.0, accessibility)
        
        return heatmap
    
    def _generate_effective_temperature(self) -> np.ndarray:
        """Generate effective temperature heat map (actual temperature considering shade/fountains)"""
        heatmap = np.zeros((self.resolution, self.resolution))
        half_size = self.park.size / 2
        
        ambient_temp = self.park.get_temperature()
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                pos = Position(x, y, 0)
                
                # Get effective temperature at this position
                effective_temp = self.park.get_effective_temperature_at_position(pos)
                
                # Normalize to 0-1 range for visualization
                # Assume temperature range from ambient-10 to ambient+10
                temp_min = ambient_temp - 10
                temp_max = ambient_temp + 10
                
                normalized = (effective_temp - temp_min) / (temp_max - temp_min)
                heatmap[i, j] = np.clip(normalized, 0, 1)
        
        return heatmap
    
    def _generate_overall_quality(self) -> np.ndarray:
        """Generate overall quality heat map (combination of multiple factors)"""
        # Combine thermal comfort, accessibility, and coverage
        thermal = self._generate_thermal_comfort()
        accessibility = self._generate_accessibility()
        
        # Check temperature to weight shade appropriately
        temp = self.park.get_temperature()
        temp_min, temp_max = park_config.comfortable_temp_range
        
        if temp > temp_max:
            # Hot: shade is important
            shade = self._generate_shade_coverage()
            quality = thermal * 0.4 + accessibility * 0.3 + shade * 0.3
        elif temp < temp_min:
            # Cold: light/warmth perception important
            light = self._generate_light_coverage()
            quality = thermal * 0.4 + accessibility * 0.3 + light * 0.3
        else:
            # Comfortable: balanced
            quality = thermal * 0.5 + accessibility * 0.5
        
        return quality
    
    @staticmethod
    def get_color_for_value(value: float, heatmap_type: HeatMapType) -> Tuple[float, float, float, float]:
        """
        Get RGBA color for a heat map value (0-1)
        Returns colors appropriate for the heat map type
        """
        # Clamp value
        value = np.clip(value, 0, 1)
        
        if heatmap_type == HeatMapType.THERMAL_COMFORT:
            # Blue (cold/uncomfortable) -> Green (comfortable) -> Red (hot/uncomfortable)
            if value > 0.5:
                # Comfortable to good
                r = 0.2 + (value - 0.5) * 1.0
                g = 0.8
                b = 0.2
            else:
                # Bad to comfortable
                r = 0.2
                g = 0.3 + value * 1.0
                b = 0.8 - value * 0.6
            alpha = 0.6
            
        elif heatmap_type == HeatMapType.SHADE_COVERAGE:
            # Yellow (no shade) -> Green (full shade)
            r = 1.0 - value * 0.5
            g = 0.5 + value * 0.5
            b = 0.2
            alpha = 0.5
            
        elif heatmap_type == HeatMapType.LIGHT_COVERAGE:
            # Dark blue (no light) -> Bright yellow (well lit)
            r = value * 1.0
            g = value * 0.9
            b = 0.3 + value * 0.2
            alpha = 0.5
            
        elif heatmap_type == HeatMapType.PEDESTRIAN_DENSITY:
            # Blue (empty) -> Red (crowded)
            r = value * 1.0
            g = 0.3 * (1 - value)
            b = (1 - value) * 0.8
            alpha = 0.4 + value * 0.3
            
        elif heatmap_type == HeatMapType.ACCESSIBILITY:
            # Red (far from amenities) -> Green (close to amenities)
            r = 1.0 - value
            g = value
            b = 0.2
            alpha = 0.5
            
        elif heatmap_type == HeatMapType.EFFECTIVE_TEMPERATURE:
            # Blue (cool) -> Yellow (warm) -> Red (hot)
            if value < 0.5:
                # Cool to moderate
                r = value * 0.4
                g = 0.6 + value * 0.4
                b = 1.0 - value * 0.8
            else:
                # Moderate to hot
                r = 0.2 + (value - 0.5) * 1.6
                g = 1.0 - (value - 0.5) * 0.8
                b = 0.2 - (value - 0.5) * 0.4
            alpha = 0.6
            
        elif heatmap_type == HeatMapType.OVERALL_QUALITY:
            # Red (poor) -> Yellow (okay) -> Green (excellent)
            if value < 0.5:
                r = 1.0
                g = value * 2.0
                b = 0.2
            else:
                r = 1.0 - (value - 0.5) * 2.0
                g = 1.0
                b = 0.2
            alpha = 0.6
            
        else:
            # Default gradient
            r = 1.0 - value
            g = value
            b = 0.5
            alpha = 0.5
        
        return (r, g, b, alpha)
    
    @staticmethod
    def get_legend_info(heatmap_type: HeatMapType) -> Dict[str, str]:
        """Get legend information for a heat map type"""
        legends = {
            HeatMapType.THERMAL_COMFORT: {
                'title': 'Thermal Comfort',
                'low': 'Uncomfortable',
                'mid': 'Comfortable',
                'high': 'Optimal',
                'description': 'Shows how comfortable the temperature feels'
            },
            HeatMapType.SHADE_COVERAGE: {
                'title': 'Shade Coverage',
                'low': 'No Shade',
                'mid': 'Partial',
                'high': 'Full Shade',
                'description': 'Areas covered by tree canopies'
            },
            HeatMapType.LIGHT_COVERAGE: {
                'title': 'Light Coverage',
                'low': 'Dark',
                'mid': 'Dim',
                'high': 'Well Lit',
                'description': 'Illumination from street lamps'
            },
            HeatMapType.PEDESTRIAN_DENSITY: {
                'title': 'Pedestrian Density',
                'low': 'Empty',
                'mid': 'Moderate',
                'high': 'Crowded',
                'description': 'Concentration of visitors (updates live)'
            },
            HeatMapType.ACCESSIBILITY: {
                'title': 'Accessibility',
                'low': 'Remote',
                'mid': 'Accessible',
                'high': 'Very Close',
                'description': 'Distance to nearest park amenity'
            },
            HeatMapType.EFFECTIVE_TEMPERATURE: {
                'title': 'Effective Temperature',
                'low': 'Cool',
                'mid': 'Moderate',
                'high': 'Hot',
                'description': 'Actual temperature after shade/fountain effects'
            },
            HeatMapType.OVERALL_QUALITY: {
                'title': 'Overall Quality',
                'low': 'Poor',
                'mid': 'Good',
                'high': 'Excellent',
                'description': 'Combined score of all factors'
            }
        }
        
        return legends.get(heatmap_type, {
            'title': 'Unknown',
            'low': 'Low',
            'mid': 'Medium',
            'high': 'High',
            'description': 'No description available'
        })