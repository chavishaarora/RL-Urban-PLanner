"""
Temperature-Aware Comfort Metric Calculator
Calculates comfort scores based on element placement AND temperature
"""

import numpy as np
from typing import List

try:
    from environment.park import Park, ParkElement, Position
    from config import ElementType, metrics_config, park_config
except ImportError:
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"


class ComfortCalculator:
    """Calculates temperature-aware comfort scores for park design"""
    
    def __init__(self, park: Park):
        self.park = park
    
    def calculate_total_comfort(self) -> float:
        """
        Calculate overall comfort score (0-1) with temperature awareness
        """
        benches = self.park.get_elements_by_type(ElementType.BENCH)
        
        if not benches:
            return 0.0
        
        total_comfort = 0.0
        
        for bench in benches:
            comfort = self._calculate_bench_comfort_with_temperature(bench)
            total_comfort += comfort
        
        # Normalize by number of benches
        return total_comfort / len(benches) if benches else 0.0
    
    def _calculate_bench_comfort_with_temperature(self, bench: ParkElement) -> float:
        """
        Calculate temperature-aware comfort score for a single bench
        
        Considers:
        - Base comfort
        - Nearby amenities (trees, fountains, lamps)
        - Temperature effects on each amenity's value
        """
        temperature = self.park.get_temperature()
        temp_min, temp_max = park_config.comfortable_temp_range
        
        comfort = 0.2  # Reduced base comfort (bench alone is not enough)
        
        # Get thermal comfort at bench position
        thermal_comfort = self.park.get_thermal_comfort_at_position(bench.position)
        comfort += 0.1 * thermal_comfort  # Small base bonus for good thermal conditions
        
        try:
            tree_radius = metrics_config.comfort_bench_tree_radius
            fountain_radius = metrics_config.comfort_bench_fountain_radius
            lamp_radius = metrics_config.comfort_bench_lamp_radius
        except:
            tree_radius = 5.0
            fountain_radius = 8.0
            lamp_radius = 4.0
        
        # === TREES (Shade) - Temperature Dependent ===
        nearby_trees = self._get_nearby_elements(bench, ElementType.TREE, tree_radius)
        
        if nearby_trees:
            if temperature > temp_max:
                # HOT: Shade is VERY valuable
                temp_excess = temperature - temp_max
                shade_value = 0.3 + min(0.4, temp_excess * park_config.shade_value_per_degree_above_comfort)
                comfort += shade_value
            elif temperature < temp_min:
                # COLD: Shade is LESS valuable (might even be negative)
                temp_deficit = temp_min - temperature
                shade_penalty = min(0.15, temp_deficit * 0.01)
                comfort += max(0.05, 0.2 - shade_penalty)
            else:
                # COMFORTABLE: Shade has moderate value
                comfort += 0.25
        
        # === FOUNTAINS (Cooling + Aesthetic) - Temperature Dependent ===
        nearby_fountains = self._get_nearby_elements(bench, ElementType.FOUNTAIN, fountain_radius)
        
        if nearby_fountains:
            if temperature > temp_max:
                # HOT: Fountains provide cooling relief
                temp_excess = temperature - temp_max
                fountain_value = 0.25 + min(0.25, temp_excess * 0.02)
                comfort += fountain_value
            elif temperature < temp_min:
                # COLD: Fountains less appealing (water is cold)
                comfort += 0.1
            else:
                # COMFORTABLE: Fountains have aesthetic value
                comfort += 0.2
        
        # === LAMPS (Safety + Warmth perception) - Slightly Temperature Dependent ===
        nearby_lamps = self._get_nearby_elements(bench, ElementType.STREET_LAMP, lamp_radius)
        
        if nearby_lamps:
            if temperature < temp_min:
                # COLD: Light associated with warmth (psychological)
                comfort += 0.25
            else:
                # WARM/HOT: Light has standard safety value
                comfort += 0.15
        
        # === COMBINATION BONUSES ===
        # Tree + Fountain combo (especially good when hot)
        if nearby_trees and nearby_fountains:
            if temperature > temp_max:
                comfort += 0.15  # Extra bonus for shade + cooling
        
        # All amenities present (well-appointed bench)
        if nearby_trees and nearby_fountains and nearby_lamps:
            comfort += 0.1  # Completeness bonus
        
        return min(1.0, comfort)
    
    def _get_nearby_elements(self, 
                            element: ParkElement,
                            target_type: ElementType,
                            radius: float) -> List[ParkElement]:
        """Get elements of specific type within radius"""
        nearby = []
        target_elements = self.park.get_elements_by_type(target_type)
        
        for target in target_elements:
            distance = element.position.distance_to(target.position)
            if distance <= radius:
                nearby.append(target)
        
        return nearby
    
    def calculate_thermal_comfort_score(self) -> float:
        """
        Calculate park-wide thermal comfort score (0-1)
        Higher when more of the park has comfortable effective temperatures
        """
        resolution = 20
        comfortable_points = 0
        total_points = resolution * resolution
        
        half_size = self.park.size / 2
        
        for i in range(resolution):
            for j in range(resolution):
                x = (j / resolution - 0.5) * self.park.size
                y = (i / resolution - 0.5) * self.park.size
                pos = Position(x, y, 0)
                
                thermal_comfort = self.park.get_thermal_comfort_at_position(pos)
                comfortable_points += thermal_comfort
        
        return comfortable_points / total_points
    
    def calculate_shade_utility_score(self) -> float:
        """
        Calculate how well shade is utilized given current temperature
        Returns 0-1 score
        """
        temperature = self.park.get_temperature()
        temp_min, temp_max = park_config.comfortable_temp_range
        
        # Get shade coverage
        trees = self.park.get_elements_by_type(ElementType.TREE)
        
        if not trees:
            # No shade available
            if temperature > temp_max:
                return 0.0  # Bad: need shade when hot
            else:
                return 0.5  # Neutral: no shade needed anyway
        
        # Calculate how well-placed shade is
        if temperature > temp_max:
            # Hot: shade should be accessible from benches
            benches = self.park.get_elements_by_type(ElementType.BENCH)
            if not benches:
                return 0.3  # Have shade but no seating
            
            benches_with_shade = 0
            for bench in benches:
                nearby_trees = self._get_nearby_elements(
                    bench, ElementType.TREE, metrics_config.comfort_bench_tree_radius
                )
                if nearby_trees:
                    benches_with_shade += 1
            
            return benches_with_shade / len(benches)
        
        elif temperature < temp_min:
            # Cold: having shade is less important
            # Return moderate score (shade exists but not critical)
            return 0.6
        
        else:
            # Comfortable: shade has moderate value
            benches = self.park.get_elements_by_type(ElementType.BENCH)
            if not benches:
                return 0.5
            
            benches_with_shade = 0
            for bench in benches:
                nearby_trees = self._get_nearby_elements(
                    bench, ElementType.TREE, metrics_config.comfort_bench_tree_radius
                )
                if nearby_trees:
                    benches_with_shade += 1
            
            # Moderate value: 0.5 + (shade coverage bonus)
            coverage_bonus = (benches_with_shade / len(benches)) * 0.3
            return 0.5 + coverage_bonus
    
    def get_comfort_heatmap(self, resolution: int = 20) -> np.ndarray:
        """Generate temperature-aware comfort heatmap for the park"""
        heatmap = np.zeros((resolution, resolution))
        
        for i in range(resolution):
            for j in range(resolution):
                # Convert to world coordinates
                x = (j / resolution - 0.5) * self.park.size
                y = (i / resolution - 0.5) * self.park.size
                pos = Position(x, y, 0)
                
                # Calculate comfort at this point
                comfort = self._calculate_point_comfort_with_temperature(pos)
                heatmap[i, j] = comfort
        
        return heatmap
    
    def _calculate_point_comfort_with_temperature(self, pos: Position) -> float:
        """Calculate temperature-aware comfort at a specific point"""
        temperature = self.park.get_temperature()
        temp_min, temp_max = park_config.comfortable_temp_range
        
        # Start with thermal comfort
        thermal_comfort = self.park.get_thermal_comfort_at_position(pos)
        comfort = thermal_comfort * 0.4
        
        # Check proximity to amenities with temperature weights
        nearby = self.park.get_elements_near(pos, 5.0)
        
        has_tree = any(e.element_type == ElementType.TREE for e in nearby)
        has_fountain = any(e.element_type == ElementType.FOUNTAIN for e in nearby)
        has_lamp = any(e.element_type == ElementType.STREET_LAMP for e in nearby)
        has_bench = any(e.element_type == ElementType.BENCH for e in nearby)
        
        # Temperature-weighted bonuses
        if has_tree:
            if temperature > temp_max:
                comfort += 0.3  # High value when hot
            elif temperature < temp_min:
                comfort += 0.05  # Low value when cold
            else:
                comfort += 0.15
        
        if has_fountain:
            if temperature > temp_max:
                comfort += 0.2
            else:
                comfort += 0.1
        
        if has_lamp:
            if temperature < temp_min:
                comfort += 0.2
            else:
                comfort += 0.1
        
        if has_bench:
            comfort += 0.15
        
        return min(1.0, comfort)
    
    def get_temperature_comfort_breakdown(self) -> dict:
        """Get detailed breakdown of temperature effects on comfort"""
        temperature = self.park.get_temperature()
        temp_min, temp_max = park_config.comfortable_temp_range
        
        breakdown = {
            'temperature': temperature,
            'is_comfortable': temp_min <= temperature <= temp_max,
            'thermal_comfort_score': self.calculate_thermal_comfort_score(),
            'shade_utility_score': self.calculate_shade_utility_score(),
            'overall_comfort': self.calculate_total_comfort(),
        }
        
        if temperature > temp_max:
            breakdown['condition'] = 'hot'
            breakdown['temp_excess'] = temperature - temp_max
            breakdown['shade_importance'] = 'critical'
        elif temperature < temp_min:
            breakdown['condition'] = 'cold'
            breakdown['temp_deficit'] = temp_min - temperature
            breakdown['shade_importance'] = 'low'
        else:
            breakdown['condition'] = 'comfortable'
            breakdown['shade_importance'] = 'moderate'
        
        return breakdown