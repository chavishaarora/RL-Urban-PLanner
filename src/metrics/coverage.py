"""
Coverage Metric Calculator
Calculates shade and lighting coverage
"""

import numpy as np
from typing import Tuple

try:
    from environment.park import Park
    from config import ElementType
except ImportError:
    class ElementType:
        TREE = "tree"
        STREET_LAMP = "lamp"


class CoverageCalculator:
    """Calculates coverage metrics for park design"""
    
    def __init__(self, park: Park):
        self.park = park
        self.resolution = 50  # Resolution for coverage grid
    
    def calculate_shade_coverage(self) -> float:
        """Calculate percentage of park covered by shade (0-1)"""
        coverage_grid = self._generate_coverage_grid(ElementType.TREE)
        return np.mean(coverage_grid)
    
    def calculate_light_coverage(self) -> float:
        """Calculate percentage of park covered by lighting (0-1)"""
        coverage_grid = self._generate_coverage_grid(ElementType.STREET_LAMP)
        return np.mean(coverage_grid)
    
    def _generate_coverage_grid(self, element_type: ElementType) -> np.ndarray:
        """Generate binary coverage grid for element type"""
        grid = np.zeros((self.resolution, self.resolution))
        
        # Get all elements of specified type
        elements = self.park.get_elements_by_type(element_type)
        
        if not elements:
            return grid
        
        # Define coverage radius based on element type
        if element_type == ElementType.TREE:
            coverage_radius = 3.0  # Tree canopy radius
        elif element_type == ElementType.STREET_LAMP:
            coverage_radius = 8.0  # Light radius
        else:
            coverage_radius = 2.0
        
        half_size = self.park.size / 2
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                # Convert to world coordinates
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                
                # Check if any element covers this point
                for element in elements:
                    dx = x - element.position.x
                    dy = y - element.position.y
                    distance = np.sqrt(dx**2 + dy**2)
                    
                    if distance <= coverage_radius:
                        grid[i, j] = 1.0
                        break
        
        return grid
    
    def get_coverage_map(self, element_type: ElementType) -> np.ndarray:
        """Get detailed coverage intensity map"""
        intensity_map = np.zeros((self.resolution, self.resolution))
        
        elements = self.park.get_elements_by_type(element_type)
        
        if not elements:
            return intensity_map
        
        # Define coverage radius based on element type
        if element_type == ElementType.TREE:
            coverage_radius = 3.0
        elif element_type == ElementType.STREET_LAMP:
            coverage_radius = 8.0
        else:
            coverage_radius = 2.0
        
        half_size = self.park.size / 2
        
        for i in range(self.resolution):
            for j in range(self.resolution):
                # Convert to world coordinates
                x = (j / self.resolution) * self.park.size - half_size
                y = (i / self.resolution) * self.park.size - half_size
                
                # Calculate cumulative intensity from all elements
                total_intensity = 0.0
                
                for element in elements:
                    dx = x - element.position.x
                    dy = y - element.position.y
                    distance = np.sqrt(dx**2 + dy**2)
                    
                    if distance <= coverage_radius:
                        # Intensity decreases with distance
                        intensity = 1.0 - (distance / coverage_radius)
                        total_intensity += intensity
                
                intensity_map[i, j] = min(1.0, total_intensity)
        
        return intensity_map
    
    def calculate_coverage_overlap(self) -> float:
        """Calculate how much shade and light coverage overlap"""
        shade_grid = self._generate_coverage_grid(ElementType.TREE)
        light_grid = self._generate_coverage_grid(ElementType.STREET_LAMP)
        
        # Calculate overlap
        overlap = np.logical_and(shade_grid > 0, light_grid > 0)
        overlap_ratio = np.sum(overlap) / (self.resolution * self.resolution)
        
        return overlap_ratio
    
    def get_uncovered_areas(self) -> Tuple[float, np.ndarray]:
        """Get percentage and locations of uncovered areas"""
        shade_grid = self._generate_coverage_grid(ElementType.TREE)
        light_grid = self._generate_coverage_grid(ElementType.STREET_LAMP)
        
        # Areas with neither shade nor light
        uncovered = np.logical_and(shade_grid == 0, light_grid == 0)
        uncovered_ratio = np.sum(uncovered) / (self.resolution * self.resolution)
        
        return uncovered_ratio, uncovered
    
    def calculate_balanced_coverage(self) -> float:
        """Calculate balanced coverage score"""
        shade = self.calculate_shade_coverage()
        light = self.calculate_light_coverage()
        
        # Optimal: ~50% shade, ~70% light (for night scene)
        try:
            from config import metrics_config
            optimal_shade = metrics_config.optimal_shade_coverage
            min_light = metrics_config.min_light_coverage
        except:
            optimal_shade = 0.5
            min_light = 0.6
        
        # Calculate how close we are to optimal
        shade_score = 1.0 - abs(shade - optimal_shade) / optimal_shade
        light_score = min(1.0, light / min_light) if light > 0 else 0.0
        
        # Weighted average (light more important for night scene)
        balanced_score = shade_score * 0.4 + light_score * 0.6
        
        return balanced_score