"""
Park Environment Module with Temperature System
Core park environment with elements, grid management, and temperature
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
    """Main park environment with temperature system"""
    
    def __init__(self, size: float = 30.0, grid_size: int = 3, temperature: float = None):
        self.size = size  # Park size in meters
        self.grid_size = grid_size  # Grid dimensions
        self.cell_size = size / grid_size
        
        # Temperature system
        if temperature is None:
            self.temperature = park_config.default_temperature
        else:
            self.temperature = temperature
        
        # Elements storage
        self.elements: List[ParkElement] = []
        self.element_id_counter = 0
        
        # Grid occupancy (for quick spatial queries)
        self.grid_occupancy = [[False for _ in range(grid_size)] 
                               for _ in range(grid_size)]
        
        # Element counts by type
        self.element_counts = {element_type: 0 for element_type in ElementType}
        
        # Thermal zones cache (for performance)
        self._thermal_zones_cache = None
        self._thermal_zones_cache_dirty = True
    
    def set_temperature(self, temperature: float):
        """Set the park temperature and update thermal zones"""
        self.temperature = np.clip(
            temperature,
            park_config.min_temperature,
            park_config.max_temperature
        )
        self._thermal_zones_cache_dirty = True
        
        # Update reward weights based on new temperature
        try:
            from config import update_reward_weights_for_temperature
            update_reward_weights_for_temperature(self.temperature)
        except ImportError:
            pass
    
    def get_temperature(self) -> float:
        """Get current park temperature"""
        return self.temperature
    
    def get_effective_temperature_at_position(self, position: Position) -> float:
        """
        Calculate the effective temperature at a specific position
        considering shade, fountains, etc.
        
        Returns:
            Effective temperature (can be lower than ambient in shade/near fountain)
        """
        effective_temp = self.temperature
        
        # Check for tree shade
        trees = self.get_elements_by_type(ElementType.TREE)
        for tree in trees:
            distance = position.distance_to(tree.position)
            shade_radius = tree.size / 2 + 1.0  # Shade extends beyond tree
            
            if distance < shade_radius:
                # Under shade - reduce temperature
                shade_intensity = 1.0 - (distance / shade_radius)
                effective_temp -= park_config.tree_shade_cooling * shade_intensity
        
        # Check for fountain cooling
        fountains = self.get_elements_by_type(ElementType.FOUNTAIN)
        for fountain in fountains:
            distance = position.distance_to(fountain.position)
            cooling_radius = park_config.cooling_radius_fountain
            
            if distance < cooling_radius:
                # Near fountain - cooling effect
                cooling_intensity = 1.0 - (distance / cooling_radius)
                effective_temp -= park_config.fountain_cooling_effect * cooling_intensity
        
        return effective_temp
    
    def is_position_in_shade(self, position: Position) -> bool:
        """Check if a position is in shade (under tree canopy)"""
        trees = self.get_elements_by_type(ElementType.TREE)
        for tree in trees:
            distance = position.distance_to(tree.position)
            shade_radius = tree.size / 2 + 1.0
            
            if distance < shade_radius:
                return True
        
        return False
    
    def get_thermal_comfort_at_position(self, position: Position) -> float:
        """
        Calculate thermal comfort score at a position (0-1)
        1.0 = perfectly comfortable
        0.0 = very uncomfortable
        """
        effective_temp = self.get_effective_temperature_at_position(position)
        temp_min, temp_max = park_config.comfortable_temp_range
        
        if temp_min <= effective_temp <= temp_max:
            # In comfortable range
            return 1.0
        elif effective_temp < temp_min:
            # Too cold
            deficit = temp_min - effective_temp
            return max(0.0, 1.0 - deficit / 15.0)  # Drops to 0 at -15 from comfort
        else:
            # Too hot
            excess = effective_temp - temp_max
            return max(0.0, 1.0 - excess / 15.0)  # Drops to 0 at +15 from comfort
    
    def get_thermal_zones(self) -> Dict[str, List[Position]]:
        """
        Get thermal zones in the park for visualization
        Returns dict with 'cool', 'comfortable', 'hot' zones
        """
        if not self._thermal_zones_cache_dirty and self._thermal_zones_cache:
            return self._thermal_zones_cache
        
        zones = {'cool': [], 'comfortable': [], 'hot': []}
        
        # Sample grid
        resolution = 20
        half_size = self.size / 2
        
        for i in range(resolution):
            for j in range(resolution):
                x = (j / resolution - 0.5) * self.size
                y = (i / resolution - 0.5) * self.size
                pos = Position(x, y, 0)
                
                temp = self.get_effective_temperature_at_position(pos)
                temp_min, temp_max = park_config.comfortable_temp_range
                
                if temp < temp_min:
                    zones['cool'].append(pos)
                elif temp > temp_max:
                    zones['hot'].append(pos)
                else:
                    zones['comfortable'].append(pos)
        
        self._thermal_zones_cache = zones
        self._thermal_zones_cache_dirty = False
        return zones
    
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
        
        # Invalidate thermal cache
        self._thermal_zones_cache_dirty = True
        
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
            
            # Invalidate thermal cache
            self._thermal_zones_cache_dirty = True
            
            return True
        return False
    
    def clear(self):
        """Remove all elements from the park"""
        self.elements.clear()
        self.grid_occupancy = [[False for _ in range(self.grid_size)] 
                               for _ in range(self.grid_size)]
        self.element_counts = {element_type: 0 for element_type in ElementType}
        self._thermal_zones_cache_dirty = True
    
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
            'temperature': self.temperature,
            'elements': [e.to_dict() for e in self.elements],
            'element_counts': {k.value: v for k, v in self.element_counts.items()}
        }
    
    def from_dict(self, data: Dict[str, Any]):
        """Load park state from dictionary"""
        self.clear()
        self.size = data['size']
        self.grid_size = data['grid_size']
        self.cell_size = self.size / self.grid_size
        self.temperature = data.get('temperature', park_config.default_temperature)
        
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
        
        self._thermal_zones_cache_dirty = True
    
    def __repr__(self) -> str:
        return f"Park(size={self.size}, grid={self.grid_size}x{self.grid_size}, elements={len(self.elements)}, temp={self.temperature:.1f}°C)"