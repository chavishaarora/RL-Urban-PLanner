"""
Grid System Module
Manages the grid-based placement system for park elements
"""

import numpy as np
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass
from enum import Enum

try:
    from environment.park import ParkElement, Position
except ImportError:
    from .park import ParkElement, Position

class CellType(Enum):
    """Types of grid cells"""
    EMPTY = 0
    OCCUPIED = 1
    RESERVED = 2
    BLOCKED = 3
    WATER = 4
    PATH = 5

@dataclass
class GridCell:
    """Represents a single cell in the grid"""
    x: int
    y: int
    cell_type: CellType = CellType.EMPTY
    element: Optional[ParkElement] = None
    elevation: float = 0.0
    terrain_type: str = "grass"
    walkable: bool = True
    buildable: bool = True
    
    def is_available(self) -> bool:
        """Check if cell is available for placement"""
        return (self.cell_type == CellType.EMPTY and 
                self.buildable and 
                self.element is None)
    
    def clear(self):
        """Clear the cell"""
        self.cell_type = CellType.EMPTY
        self.element = None

class GridSystem:
    """Advanced grid management system for park layout"""
    
    def __init__(self, size: int, cell_size: float):
        """
        Initialize grid system
        
        Args:
            size: Number of cells per dimension (e.g., 3 for 3x3)
            cell_size: Size of each cell in meters
        """
        self.size = size
        self.cell_size = cell_size
        self.world_size = size * cell_size
        
        # Initialize grid
        self.grid = [[GridCell(x, y) for y in range(size)] 
                     for x in range(size)]
        
        # Distance matrix for optimization
        self.distance_matrix = self._create_distance_matrix()
        
        # Adjacency information
        self.adjacency = self._create_adjacency_map()
        
        # Zones for different purposes
        self.zones: Dict[str, List[Tuple[int, int]]] = {}
        
    def _create_distance_matrix(self) -> np.ndarray:
        """Create matrix of distances between all cells"""
        n = self.size * self.size
        matrix = np.zeros((n, n))
        
        for i in range(n):
            x1, y1 = self.index_to_coord(i)
            for j in range(n):
                x2, y2 = self.index_to_coord(j)
                distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                matrix[i, j] = distance
        
        return matrix
    
    def _create_adjacency_map(self) -> Dict[Tuple[int, int], List[Tuple[int, int]]]:
        """Create map of adjacent cells for each position"""
        adjacency = {}
        
        for x in range(self.size):
            for y in range(self.size):
                neighbors = []
                
                # 8-directional adjacency
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.size and 0 <= ny < self.size:
                            neighbors.append((nx, ny))
                
                adjacency[(x, y)] = neighbors
        
        return adjacency
    
    def world_to_grid(self, world_pos: Position) -> Tuple[int, int]:
        """Convert world position to grid coordinates"""
        half_world = self.world_size / 2
        
        # Normalize to 0-1 range
        norm_x = (world_pos.x + half_world) / self.world_size
        norm_y = (world_pos.y + half_world) / self.world_size
        
        # Convert to grid coordinates
        grid_x = int(norm_x * self.size)
        grid_y = int(norm_y * self.size)
        
        # Clamp to valid range
        grid_x = max(0, min(self.size - 1, grid_x))
        grid_y = max(0, min(self.size - 1, grid_y))
        
        return grid_x, grid_y
    
    def grid_to_world(self, grid_x: int, grid_y: int) -> Position:
        """Convert grid coordinates to world position (center of cell)"""
        half_world = self.world_size / 2
        
        # Calculate cell center in world coordinates
        world_x = (grid_x + 0.5) * self.cell_size - half_world
        world_y = (grid_y + 0.5) * self.cell_size - half_world
        
        return Position(world_x, world_y, 0)
    
    def coord_to_index(self, x: int, y: int) -> int:
        """Convert 2D coordinates to 1D index"""
        return x * self.size + y
    
    def index_to_coord(self, index: int) -> Tuple[int, int]:
        """Convert 1D index to 2D coordinates"""
        return index // self.size, index % self.size
    
    def get_cell(self, x: int, y: int) -> Optional[GridCell]:
        """Get cell at specified coordinates"""
        if 0 <= x < self.size and 0 <= y < self.size:
            return self.grid[x][y]
        return None
    
    def set_cell(self, x: int, y: int, element: ParkElement) -> bool:
        """Place element in cell"""
        cell = self.get_cell(x, y)
        if cell and cell.is_available():
            cell.element = element
            cell.cell_type = CellType.OCCUPIED
            return True
        return False
    
    def clear_cell(self, x: int, y: int) -> bool:
        """Clear a cell"""
        cell = self.get_cell(x, y)
        if cell:
            cell.clear()
            return True
        return False
    
    def get_available_cells(self) -> List[Tuple[int, int]]:
        """Get list of all available cells"""
        available = []
        for x in range(self.size):
            for y in range(self.size):
                if self.grid[x][y].is_available():
                    available.append((x, y))
        return available
    
    def get_occupied_cells(self) -> List[Tuple[int, int]]:
        """Get list of all occupied cells"""
        occupied = []
        for x in range(self.size):
            for y in range(self.size):
                if self.grid[x][y].element is not None:
                    occupied.append((x, y))
        return occupied
    
    def get_neighbors(self, x: int, y: int, 
                     radius: int = 1,
                     include_diagonals: bool = True) -> List[GridCell]:
        """Get neighboring cells within radius"""
        neighbors = []
        
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if dx == 0 and dy == 0:
                    continue
                    
                if not include_diagonals and abs(dx) + abs(dy) > radius:
                    continue
                    
                nx, ny = x + dx, y + dy
                cell = self.get_cell(nx, ny)
                if cell:
                    neighbors.append(cell)
        
        return neighbors
    
    def find_clusters(self) -> List[List[Tuple[int, int]]]:
        """Find clusters of occupied cells"""
        visited = set()
        clusters = []
        
        for x in range(self.size):
            for y in range(self.size):
                if (x, y) not in visited and self.grid[x][y].element:
                    cluster = self._explore_cluster(x, y, visited)
                    if cluster:
                        clusters.append(cluster)
        
        return clusters
    
    def _explore_cluster(self, x: int, y: int, 
                        visited: set) -> List[Tuple[int, int]]:
        """Explore a cluster using DFS"""
        if (x, y) in visited or not self.get_cell(x, y):
            return []
        
        cell = self.grid[x][y]
        if not cell.element:
            return []
        
        visited.add((x, y))
        cluster = [(x, y)]
        
        # Explore neighbors
        for nx, ny in self.adjacency.get((x, y), []):
            if (nx, ny) not in visited and self.grid[nx][ny].element:
                cluster.extend(self._explore_cluster(nx, ny, visited))
        
        return cluster
    
    def create_zone(self, name: str, cells: List[Tuple[int, int]]):
        """Create a named zone in the grid"""
        self.zones[name] = cells
        
        # Mark cells as part of zone
        for x, y in cells:
            cell = self.get_cell(x, y)
            if cell:
                cell.terrain_type = f"zone_{name}"
    
    def get_zone_cells(self, zone_name: str) -> List[Tuple[int, int]]:
        """Get cells belonging to a zone"""
        return self.zones.get(zone_name, [])
    
    def calculate_connectivity(self) -> float:
        """Calculate connectivity score of placed elements"""
        occupied = self.get_occupied_cells()
        if len(occupied) < 2:
            return 0.0
        
        # Build adjacency graph
        connections = 0
        for x, y in occupied:
            neighbors = self.get_neighbors(x, y, radius=1)
            for neighbor in neighbors:
                if neighbor.element:
                    connections += 1
        
        # Maximum possible connections
        max_connections = len(occupied) * 8
        
        return connections / max_connections if max_connections > 0 else 0.0
    
    def find_optimal_placement(self, element_type: str,
                              existing_elements: List[Tuple[int, int]],
                              criteria: Dict[str, float]) -> Optional[Tuple[int, int]]:
        """
        Find optimal placement for an element based on criteria
        
        Args:
            element_type: Type of element to place
            existing_elements: List of existing element positions
            criteria: Dictionary of criteria weights (e.g., {'spacing': 0.5, 'centrality': 0.3})
        
        Returns:
            Optimal grid position or None if no valid position
        """
        available = self.get_available_cells()
        if not available:
            return None
        
        best_score = -float('inf')
        best_position = None
        
        for x, y in available:
            score = 0.0
            
            # Spacing score
            if 'spacing' in criteria and existing_elements:
                min_dist = float('inf')
                for ex, ey in existing_elements:
                    dist = np.sqrt((x - ex)**2 + (y - ey)**2)
                    min_dist = min(min_dist, dist)
                spacing_score = min_dist / (self.size * np.sqrt(2))
                score += spacing_score * criteria['spacing']
            
            # Centrality score
            if 'centrality' in criteria:
                center = self.size / 2
                dist_to_center = np.sqrt((x - center)**2 + (y - center)**2)
                centrality_score = 1 - (dist_to_center / (center * np.sqrt(2)))
                score += centrality_score * criteria['centrality']
            
            # Edge avoidance score
            if 'edge_avoidance' in criteria:
                edge_dist = min(x, y, self.size - 1 - x, self.size - 1 - y)
                edge_score = edge_dist / (self.size / 2)
                score += edge_score * criteria['edge_avoidance']
            
            if score > best_score:
                best_score = score
                best_position = (x, y)
        
        return best_position
    
    def to_matrix(self) -> np.ndarray:
        """Convert grid to numpy matrix representation"""
        matrix = np.zeros((self.size, self.size))
        
        for x in range(self.size):
            for y in range(self.size):
                cell = self.grid[x][y]
                if cell.element:
                    # Encode element type as number
                    # This would need mapping from element types to numbers
                    matrix[x, y] = 1  # Simplified: 1 for occupied
                else:
                    matrix[x, y] = cell.cell_type.value
        
        return matrix
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get grid statistics"""
        occupied = self.get_occupied_cells()
        available = self.get_available_cells()
        
        return {
            'total_cells': self.size * self.size,
            'occupied_cells': len(occupied),
            'available_cells': len(available),
            'occupancy_rate': len(occupied) / (self.size * self.size),
            'connectivity': self.calculate_connectivity(),
            'num_clusters': len(self.find_clusters()),
            'zones': list(self.zones.keys())
        }