"""
Park Environment Module
Core park environment with elements and grid management
"""

import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum

# Import from config (assumes config is in same directory or parent)
try:
    from config import ElementType, park_config
except ImportError:
    # Fallback if running standalone
    class ElementType(Enum):
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"
        GRASS_PATCH = "grass"
        PATHWAY = "pathway"
        EMPTY = "empty"


@dataclass
class Position:
    """3D position in the park"""
    x: float
    y: float
    z: float = 0.0
    
    def distance_to(self, other: 'Position') -> float:
        """Calculate Euclidean distance to another position"""
        return np.sqrt(
            (self.x - other.x)**2 + 
            (self.y - other.y)**2 + 
            (self.z - other.z)**2
        )
    
    def to_tuple(self) -> Tuple[float, float, float]:
        """Convert to tuple"""
        return (self.x, self.y, self.z)
    
    def __repr__(self) -> str:
        return f"Position({self.x:.2f}, {self.y:.2f}, {self.z:.2f})"


class ParkElement:
    """Base class for park elements"""
    
    def __init__(self, 
                 element_type: ElementType,
                 position: Position,
                 size: float = 2.0,
                 color: Tuple[int, int, int] = (100, 100, 100)):
        self.element_type = element_type
        self.position = position
        self.size = size
        self.color = color
        self.id = None  # Will be set by park
        
        # Additional properties
        self.is_active = True
        self.metadata = {}
    
    def update(self, delta_time: float):
        """Update element state"""
        pass
    
    def get_bounds(self) -> Tuple[float, float, float, float]:
        """Get bounding box (min_x, min_y, max_x, max_y)"""
        half_size = self.size / 2
        return (
            self.position.x - half_size,
            self.position.y - half_size,
            self.position.x + half_size,
            self.position.y + half_size
        )
    
    def contains_point(self, point: Position) -> bool:
        """Check if point is within element bounds"""
        min_x, min_y, max_x, max_y = self.get_bounds()
        return (min_x <= point.x <= max_x and 
                min_y <= point.y <= max_y)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'type': self.element_type.value,
            'position': self.position.to_tuple(),
            'size': self.size,
            'color': self.color,
            'is_active': self.is_active,
            'metadata': self.metadata
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'ParkElement':
        """Create element from dictionary"""
        element_type = ElementType(data['type'])
        position = Position(*data['position'])
        element = ParkElement(element_type, position, data['size'], data['color'])
        element.is_active = data.get('is_active', True)
        element.metadata = data.get('metadata', {})
        return element


class Park:
    """Main park environment"""
    
    def __init__(self, size: float = 30.0, grid_size: int = 3):
        self.size = size  # Park size in meters
        self.grid_size = grid_size  # Grid dimensions
        self.cell_size = size / grid_size
        
        # Elements storage
        self.elements: List[ParkElement] = []
        self.element_id_counter = 0
        
        # Grid occupancy (for quick spatial queries)
        self.grid_occupancy = [[False for _ in range(grid_size)] 
                               for _ in range(grid_size)]
        
        # Element counts by type
        self.element_counts = {element_type: 0 for element_type in ElementType}
    
    def add_element(self, 
                   element_type: ElementType,
                   grid_x: int,
                   grid_y: int) -> Optional[ParkElement]:
        """
        Add an element to the park at specified grid position
        
        Args:
            element_type: Type of element to add
            grid_x: Grid x coordinate (0 to grid_size-1)
            grid_y: Grid y coordinate (0 to grid_size-1)
            
        Returns:
            Created ParkElement or None if placement failed
        """
        # Validate grid position
        if not (0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size):
            return None
        
        # Check if cell is occupied
        if self.grid_occupancy[grid_x][grid_y]:
            return None
        
        # Convert grid to world position (center of cell)
        world_pos = self.grid_to_world(grid_x, grid_y)
        
        # Get element properties from config
        try:
            size = park_config.element_sizes.get(element_type, 2.0)
            color = park_config.element_colors.get(element_type, (100, 100, 100))
        except:
            size = 2.0
            color = (100, 100, 100)
        
        # Create element
        element = ParkElement(element_type, world_pos, size, color)
        element.id = self.element_id_counter
        self.element_id_counter += 1
        
        # Add to park
        self.elements.append(element)
        self.grid_occupancy[grid_x][grid_y] = True
        self.element_counts[element_type] += 1
        
        return element
    
    def remove_element(self, element: ParkElement) -> bool:
        """Remove an element from the park"""
        if element in self.elements:
            self.elements.remove(element)
            
            # Update grid occupancy
            grid_x, grid_y = self.world_to_grid(element.position)
            if 0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size:
                self.grid_occupancy[grid_x][grid_y] = False
            
            # Update counts
            self.element_counts[element.element_type] -= 1
            
            return True
        return False
    
    def clear(self):
        """Remove all elements from the park"""
        self.elements.clear()
        self.grid_occupancy = [[False for _ in range(self.grid_size)] 
                               for _ in range(self.grid_size)]
        self.element_counts = {element_type: 0 for element_type in ElementType}
    
    def get_elements_by_type(self, element_type: ElementType) -> List[ParkElement]:
        """Get all elements of a specific type"""
        return [e for e in self.elements if e.element_type == element_type]
    
    def get_elements_near(self, position: Position, radius: float) -> List[ParkElement]:
        """Get all elements within radius of a position"""
        nearby = []
        for element in self.elements:
            if element.position.distance_to(position) <= radius:
                nearby.append(element)
        return nearby
    
    def grid_to_world(self, grid_x: int, grid_y: int) -> Position:
        """Convert grid coordinates to world position (center of cell)"""
        half_size = self.size / 2
        world_x = (grid_x + 0.5) * self.cell_size - half_size
        world_y = (grid_y + 0.5) * self.cell_size - half_size
        return Position(world_x, world_y, 0.0)
    
    def world_to_grid(self, position: Position) -> Tuple[int, int]:
        """Convert world position to grid coordinates"""
        half_size = self.size / 2
        norm_x = (position.x + half_size) / self.size
        norm_y = (position.y + half_size) / self.size
        
        grid_x = int(norm_x * self.grid_size)
        grid_y = int(norm_y * self.grid_size)
        
        # Clamp to valid range
        grid_x = max(0, min(self.grid_size - 1, grid_x))
        grid_y = max(0, min(self.grid_size - 1, grid_y))
        
        return grid_x, grid_y
    
    def is_position_valid(self, position: Position) -> bool:
        """Check if position is within park bounds"""
        half_size = self.size / 2
        return (-half_size <= position.x <= half_size and
                -half_size <= position.y <= half_size)
    
    def get_available_cells(self) -> List[Tuple[int, int]]:
        """Get list of available grid cells"""
        available = []
        for x in range(self.grid_size):
            for y in range(self.grid_size):
                if not self.grid_occupancy[x][y]:
                    available.append((x, y))
        return available
    
    def get_occupancy_rate(self) -> float:
        """Get percentage of occupied cells"""
        total_cells = self.grid_size * self.grid_size
        occupied = sum(sum(row) for row in self.grid_occupancy)
        return occupied / total_cells if total_cells > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert park state to dictionary"""
        return {
            'size': self.size,
            'grid_size': self.grid_size,
            'elements': [e.to_dict() for e in self.elements],
            'element_counts': {k.value: v for k, v in self.element_counts.items()}
        }
    
    def from_dict(self, data: Dict[str, Any]):
        """Load park state from dictionary"""
        self.clear()
        self.size = data['size']
        self.grid_size = data['grid_size']
        self.cell_size = self.size / self.grid_size
        
        # Restore elements
        for element_data in data['elements']:
            element = ParkElement.from_dict(element_data)
            element.id = self.element_id_counter
            self.element_id_counter += 1
            self.elements.append(element)
            
            # Update grid occupancy
            grid_x, grid_y = self.world_to_grid(element.position)
            if 0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size:
                self.grid_occupancy[grid_x][grid_y] = True
            
            # Update counts
            self.element_counts[element.element_type] += 1
    
    def __repr__(self) -> str:
        return f"Park(size={self.size}, grid={self.grid_size}x{self.grid_size}, elements={len(self.elements)})"