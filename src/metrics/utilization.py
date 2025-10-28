"""
Utilization Metric Calculator
Calculates space utilization efficiency
"""

import numpy as np

try:
    from environment.park import Park
    from config import ElementType
except ImportError:
    class ElementType:
        TREE = "tree"
        FOUNTAIN = "fountain"
        BENCH = "bench"
        STREET_LAMP = "lamp"
        GRASS_PATCH = "grass"
        PATHWAY = "pathway"


class UtilizationCalculator:
    """Calculates space utilization metrics"""
    
    def __init__(self, park: Park):
        self.park = park
    
    def calculate_utilization(self) -> float:
        """Calculate overall space utilization score (0-1)"""
        # Get basic occupancy
        occupancy = self.park.get_occupancy_rate()
        
        # Calculate effective utilization (not just occupancy)
        effective_space = self._calculate_effective_space_usage()
        
        # Combine metrics
        utilization_score = (occupancy * 0.4 + effective_space * 0.6)
        
        return utilization_score
    
    def _calculate_effective_space_usage(self) -> float:
        """Calculate how effectively the space is being used"""
        if not self.park.elements:
            return 0.0
        
        # Calculate total "influence area" of all elements
        total_influence = 0.0
        park_area = self.park.size * self.park.size
        
        # Each element has an influence radius
        influence_radii = {
            ElementType.TREE: 4.0,
            ElementType.FOUNTAIN: 5.0,
            ElementType.BENCH: 2.0,
            ElementType.STREET_LAMP: 8.0,
            ElementType.GRASS_PATCH: 3.0,
            ElementType.PATHWAY: 2.5
        }
        
        # Create influence grid
        resolution = 50
        influence_grid = np.zeros((resolution, resolution))
        half_size = self.park.size / 2
        
        for element in self.park.elements:
            radius = influence_radii.get(element.element_type, 2.0)
            
            # Mark influenced cells
            for i in range(resolution):
                for j in range(resolution):
                    x = (j / resolution) * self.park.size - half_size
                    y = (i / resolution) * self.park.size - half_size
                    
                    dx = x - element.position.x
                    dy = y - element.position.y
                    distance = np.sqrt(dx**2 + dy**2)
                    
                    if distance <= radius:
                        influence_grid[i, j] = 1.0
        
        # Calculate percentage of park influenced
        influenced_cells = np.sum(influence_grid)
        total_cells = resolution * resolution
        influence_ratio = influenced_cells / total_cells
        
        return min(1.0, influence_ratio)
    
    def calculate_element_efficiency(self, element_type: ElementType) -> float:
        """Calculate efficiency of specific element type"""
        elements = self.park.get_elements_by_type(element_type)
        
        if not elements:
            return 0.0
        
        # Calculate coverage per element
        total_coverage = 0.0
        
        for element in elements:
            # Simplified coverage calculation
            if element_type == ElementType.TREE:
                coverage = 3.14 * 4.0**2  # π * r²
            elif element_type == ElementType.FOUNTAIN:
                coverage = 3.14 * 5.0**2
            elif element_type == ElementType.STREET_LAMP:
                coverage = 3.14 * 8.0**2
            else:
                coverage = 3.14 * 2.0**2
            
            total_coverage += coverage
        
        # Normalize by park area
        park_area = self.park.size * self.park.size
        efficiency = min(1.0, total_coverage / park_area)
        
        return efficiency
    
    def calculate_density_score(self) -> float:
        """Calculate density score (not too sparse, not too crowded)"""
        num_elements = len(self.park.elements)
        max_elements = self.park.grid_size * self.park.grid_size
        
        density_ratio = num_elements / max_elements
        
        # Optimal density is around 60-70%
        optimal_density = 0.65
        
        if density_ratio == 0:
            return 0.0
        
        # Calculate score (peak at optimal density)
        score = 1.0 - abs(density_ratio - optimal_density) / optimal_density
        
        return max(0.0, min(1.0, score))
    
    def calculate_accessibility_score(self) -> float:
        """Calculate how accessible the park elements are"""
        if not self.park.elements:
            return 0.0
        
        # Check if pathways connect major elements
        pathways = self.park.get_elements_by_type(ElementType.PATHWAY)
        
        if not pathways:
            # Penalize for no pathways
            return 0.3
        
        # Calculate average distance from pathways to other elements
        total_distance = 0.0
        num_other_elements = 0
        
        for element in self.park.elements:
            if element.element_type != ElementType.PATHWAY:
                # Find nearest pathway
                min_distance = float('inf')
                for pathway in pathways:
                    distance = element.position.distance_to(pathway.position)
                    min_distance = min(min_distance, distance)
                
                total_distance += min_distance
                num_other_elements += 1
        
        if num_other_elements > 0:
            avg_distance = total_distance / num_other_elements
            # Normalize (assuming paths should be within 5m of elements)
            accessibility = max(0.0, 1.0 - avg_distance / 5.0)
        else:
            accessibility = 1.0
        
        return accessibility
    
    def calculate_wasted_space(self) -> float:
        """Calculate percentage of wasted/unused space"""
        # Areas that are too far from any element
        resolution = 50
        half_size = self.park.size / 2
        
        wasted_cells = 0
        max_distance_threshold = 6.0  # meters
        
        for i in range(resolution):
            for j in range(resolution):
                x = (j / resolution) * self.park.size - half_size
                y = (i / resolution) * self.park.size - half_size
                
                # Find nearest element
                from environment.park import Position
                point = Position(x, y, 0)
                
                if self.park.elements:
                    min_distance = min(
                        element.position.distance_to(point)
                        for element in self.park.elements
                    )
                    
                    if min_distance > max_distance_threshold:
                        wasted_cells += 1
                else:
                    wasted_cells += 1
        
        total_cells = resolution * resolution
        wasted_ratio = wasted_cells / total_cells
        
        return wasted_ratio
    
    def get_utilization_breakdown(self) -> dict:
        """Get detailed breakdown of utilization metrics"""
        return {
            'overall_utilization': self.calculate_utilization(),
            'occupancy_rate': self.park.get_occupancy_rate(),
            'density_score': self.calculate_density_score(),
            'accessibility_score': self.calculate_accessibility_score(),
            'wasted_space': self.calculate_wasted_space(),
            'effective_space': self._calculate_effective_space_usage()
        }