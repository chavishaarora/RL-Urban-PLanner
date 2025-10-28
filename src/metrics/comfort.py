"""
Comfort Metric Calculator
Calculates comfort scores based on element placement
"""

import numpy as np
from typing import List

try:
    from environment.park import Park, ParkElement
    from config import ElementType, metrics_config
except ImportError:
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"


class ComfortCalculator:
    """Calculates comfort scores for park design"""
    
    def __init__(self, park: Park):
        self.park = park
    
    def calculate_total_comfort(self) -> float:
        """Calculate overall comfort score (0-1)"""
        benches = self.park.get_elements_by_type(ElementType.BENCH)
        
        if not benches:
            return 0.0
        
        total_comfort = 0.0
        
        for bench in benches:
            comfort = self._calculate_bench_comfort(bench)
            total_comfort += comfort
        
        # Normalize by number of benches
        return total_comfort / len(benches) if benches else 0.0
    
    def _calculate_bench_comfort(self, bench: ParkElement) -> float:
        """Calculate comfort score for a single bench"""
        comfort = 0.3  # Base comfort
        
        # Check for nearby amenities
        try:
            tree_radius = metrics_config.comfort_bench_tree_radius
            fountain_radius = metrics_config.comfort_bench_fountain_radius
            lamp_radius = metrics_config.comfort_bench_lamp_radius
        except:
            tree_radius = 5.0
            fountain_radius = 8.0
            lamp_radius = 4.0
        
        # Bonus for nearby trees (shade)
        nearby_trees = self._get_nearby_elements(
            bench, ElementType.TREE, tree_radius
        )
        if nearby_trees:
            comfort += 0.3
        
        # Bonus for nearby fountain (aesthetic/cooling)
        nearby_fountains = self._get_nearby_elements(
            bench, ElementType.FOUNTAIN, fountain_radius
        )
        if nearby_fountains:
            comfort += 0.2
        
        # Bonus for nearby lamp (safety at night)
        nearby_lamps = self._get_nearby_elements(
            bench, ElementType.STREET_LAMP, lamp_radius
        )
        if nearby_lamps:
            comfort += 0.2
        
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
    
    def get_comfort_heatmap(self, resolution: int = 20) -> np.ndarray:
        """Generate comfort heatmap for the park"""
        heatmap = np.zeros((resolution, resolution))
        half_size = self.park.size / 2
        
        for i in range(resolution):
            for j in range(resolution):
                # Convert to world coordinates
                x = (j / resolution - 0.5) * self.park.size
                y = (i / resolution - 0.5) * self.park.size
                
                # Calculate comfort at this point
                comfort = self._calculate_point_comfort(x, y)
                heatmap[i, j] = comfort
        
        return heatmap
    
    def _calculate_point_comfort(self, x: float, y: float) -> float:
        """Calculate comfort at a specific point"""
        from environment.park import Position
        point = Position(x, y, 0)
        
        comfort = 0.2  # Base comfort
        
        # Check proximity to amenities
        nearby = self.park.get_elements_near(point, 5.0)
        
        has_tree = any(e.element_type == ElementType.TREE for e in nearby)
        has_fountain = any(e.element_type == ElementType.FOUNTAIN for e in nearby)
        has_lamp = any(e.element_type == ElementType.STREET_LAMP for e in nearby)
        has_bench = any(e.element_type == ElementType.BENCH for e in nearby)
        
        if has_tree:
            comfort += 0.2
        if has_fountain:
            comfort += 0.2
        if has_lamp:
            comfort += 0.2
        if has_bench:
            comfort += 0.2
        
        return min(1.0, comfort)