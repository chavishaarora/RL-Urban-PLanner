"""
Action Space Module
Defines the action space for the RL agent
"""

from typing import List, Tuple, Optional
import numpy as np

try:
    from config import ElementType, park_config
    from environment.park import Park
except ImportError:
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"
        GRASS_PATCH = "grass"
        PATHWAY = "pathway"


class ActionSpace:
    """Manages the action space for park design"""
    
    def __init__(self, grid_size: int = 3):
        self.grid_size = grid_size
        
        # UPDATED: Element types (excluding EMPTY, GRASS_PATCH, PATHWAY)
        self.element_types = [
            ElementType.BENCH,
            ElementType.TREE,
            ElementType.FOUNTAIN,
            ElementType.STREET_LAMP
        ]
        
        # Total action space size: grid_size^2 * num_element_types
        self.num_positions = grid_size * grid_size
        self.num_element_types = len(self.element_types)  # Now 4 instead of 6
        self.action_space_size = self.num_positions * self.num_element_types  # 36 instead of 54
    
    def action_to_index(self, grid_x: int, grid_y: int, element_type: ElementType) -> int:
        """Convert action (position + element_type) to index"""
        position_idx = grid_x * self.grid_size + grid_y
        element_idx = self.element_types.index(element_type)
        return position_idx * self.num_element_types + element_idx
    
    def index_to_action(self, action_index: int) -> Tuple[int, int, ElementType]:
        """Convert action index to (grid_x, grid_y, element_type)"""
        position_idx = action_index // self.num_element_types
        element_idx = action_index % self.num_element_types
        
        grid_x = position_idx // self.grid_size
        grid_y = position_idx % self.grid_size
        element_type = self.element_types[element_idx]
        
        return grid_x, grid_y, element_type
    
    def get_valid_actions(self, park: Park) -> List[int]:
        """Get list of valid action indices for current park state"""
        valid_actions = []
        
        # Get available cells
        available_cells = park.get_available_cells()
        
        # For each available cell, all element types are valid
        for grid_x, grid_y in available_cells:
            for element_type in self.element_types:
                action_idx = self.action_to_index(grid_x, grid_y, element_type)
                valid_actions.append(action_idx)
        
        return valid_actions
    
    def sample_random_action(self, park: Park) -> Optional[int]:
        """Sample a random valid action"""
        valid_actions = self.get_valid_actions(park)
        if valid_actions:
            return np.random.choice(valid_actions)
        return None
    
    def get_action_mask(self, park: Park) -> np.ndarray:
        """Get binary mask of valid actions (1=valid, 0=invalid)"""
        mask = np.zeros(self.action_space_size, dtype=np.float32)
        valid_actions = self.get_valid_actions(park)
        mask[valid_actions] = 1.0
        return mask