"""
Distribution Metric Calculator
Calculates how evenly elements are distributed
"""

import numpy as np
from typing import List
from scipy.spatial.distance import pdist

try:
    from environment.park import Park, ParkElement
    from config import ElementType
except ImportError:
    class ElementType:
        pass


class DistributionCalculator:
    """Calculates distribution metrics for park elements"""
    
    def __init__(self, park: Park):
        self.park = park
    
    def calculate_distribution_score(self) -> float:
        """Calculate overall distribution score (0-1)"""
        if len(self.park.elements) < 2:
            return 0.0
        
        # Calculate various distribution metrics
        spatial_score = self._calculate_spatial_distribution()
        clustering_score = self._calculate_clustering_penalty()
        coverage_score = self._calculate_grid_coverage()
        
        # Weighted combination
        total_score = (
            spatial_score * 0.4 +
            clustering_score * 0.3 +
            coverage_score * 0.3
        )
        
        return total_score
    
    def _calculate_spatial_distribution(self) -> float:
        """Calculate how evenly elements are spatially distributed"""
        if len(self.park.elements) < 2:
            return 0.0
        
        # Get all element positions
        positions = np.array([
            [e.position.x, e.position.y] 
            for e in self.park.elements
        ])
        
        # Calculate pairwise distances
        distances = pdist(positions)
        
        if len(distances) == 0:
            return 0.0
        
        # Calculate coefficient of variation (lower is more uniform)
        mean_dist = np.mean(distances)
        std_dist = np.std(distances)
        
        if mean_dist > 0:
            cv = std_dist / mean_dist
            # Convert to score (lower CV = higher score)
            score = 1.0 / (1.0 + cv)
        else:
            score = 0.0
        
        return score
    
    def _calculate_clustering_penalty(self) -> float:
        """Penalize clustering of elements"""
        if len(self.park.elements) < 2:
            return 1.0
        
        # Count elements too close to each other
        min_distance = self.park.cell_size * 0.5
        close_pairs = 0
        total_pairs = 0
        
        for i, elem1 in enumerate(self.park.elements):
            for j, elem2 in enumerate(self.park.elements[i+1:], i+1):
                distance = elem1.position.distance_to(elem2.position)
                total_pairs += 1
                
                if distance < min_distance:
                    close_pairs += 1
        
        if total_pairs > 0:
            clustering_ratio = close_pairs / total_pairs
            return 1.0 - clustering_ratio
        
        return 1.0
    
    def _calculate_grid_coverage(self) -> float:
        """Calculate how many grid cells are utilized"""
        occupied_cells = 0
        total_cells = self.park.grid_size * self.park.grid_size
        
        for x in range(self.park.grid_size):
            for y in range(self.park.grid_size):
                if self.park.grid_occupancy[x][y]:
                    occupied_cells += 1
        
        # Score based on coverage (not too sparse, not too dense)
        coverage_ratio = occupied_cells / total_cells
        
        # Optimal coverage is around 60-70%
        optimal_coverage = 0.65
        score = 1.0 - abs(coverage_ratio - optimal_coverage) / optimal_coverage
        
        return max(0.0, score)
    
    def calculate_type_distribution(self, element_type: ElementType) -> float:
        """Calculate distribution score for specific element type"""
        elements = self.park.get_elements_by_type(element_type)
        
        if len(elements) < 2:
            return 1.0 if len(elements) == 1 else 0.0
        
        # Get positions
        positions = np.array([
            [e.position.x, e.position.y] 
            for e in elements
        ])
        
        # Calculate pairwise distances
        distances = pdist(positions)
        
        # Calculate uniformity
        mean_dist = np.mean(distances)
        std_dist = np.std(distances)
        
        if mean_dist > 0:
            cv = std_dist / mean_dist
            score = 1.0 / (1.0 + cv)
        else:
            score = 0.0
        
        return score
    
    def calculate_diversity_score(self) -> float:
        """Calculate diversity of element types"""
        # Count unique element types
        unique_types = set(e.element_type for e in self.park.elements)
        
        # Maximum possible types (excluding EMPTY)
        max_types = 6
        
        diversity_ratio = len(unique_types) / max_types
        
        return diversity_ratio
    
    def get_distribution_heatmap(self, resolution: int = 20) -> np.ndarray:
        """Generate heatmap showing element density"""
        heatmap = np.zeros((resolution, resolution))
        half_size = self.park.size / 2
        
        # Kernel size for density calculation
        kernel_radius = 2
        
        for element in self.park.elements:
            # Convert element position to grid
            grid_x = int((element.position.x + half_size) / self.park.size * resolution)
            grid_y = int((element.position.y + half_size) / self.park.size * resolution)
            
            # Add density with Gaussian-like kernel
            for i in range(max(0, grid_x - kernel_radius), 
                          min(resolution, grid_x + kernel_radius + 1)):
                for j in range(max(0, grid_y - kernel_radius),
                              min(resolution, grid_y + kernel_radius + 1)):
                    dx = i - grid_x
                    dy = j - grid_y
                    distance = np.sqrt(dx**2 + dy**2)
                    
                    if distance <= kernel_radius:
                        intensity = 1.0 - (distance / kernel_radius)
                        heatmap[j, i] += intensity
        
        # Normalize
        if np.max(heatmap) > 0:
            heatmap = heatmap / np.max(heatmap)
        
        return heatmap
    
    def calculate_balance_score(self) -> float:
        """Calculate how balanced the element counts are"""
        # Get counts for each type
        counts = []
        for element_type in [ElementType.BENCH, ElementType.TREE, 
                            ElementType.FOUNTAIN, ElementType.STREET_LAMP,
                            ElementType.GRASS_PATCH, ElementType.PATHWAY]:
            count = len(self.park.get_elements_by_type(element_type))
            if count > 0:
                counts.append(count)
        
        if not counts:
            return 0.0
        
        # Calculate variance
        mean_count = np.mean(counts)
        variance = np.var(counts)
        
        if mean_count > 0:
            cv = np.sqrt(variance) / mean_count
            balance_score = 1.0 / (1.0 + cv)
        else:
            balance_score = 0.0
        
        return balance_score