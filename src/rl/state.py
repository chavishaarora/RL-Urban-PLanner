"""
State Encoder Module
Encodes park state for Q-Learning
"""

import hashlib
import numpy as np
from typing import Dict, Any

try:
    from environment.park import Park
    from config import ElementType
except ImportError:
    class ElementType:
        EMPTY = "empty"
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"
        GRASS_PATCH = "grass"
        PATHWAY = "pathway"


class StateEncoder:
    """Encodes park state into a hashable representation"""
    
    def __init__(self, grid_size: int = 3):
        self.grid_size = grid_size
        
        # UPDATED: Element type to index mapping (removed GRASS_PATCH and PATHWAY)
        self.element_to_idx = {
            ElementType.EMPTY: 0,
            ElementType.BENCH: 1,
            ElementType.TREE: 2,
            ElementType.FOUNTAIN: 3,
            ElementType.STREET_LAMP: 4
        }
    
    def encode_state(self, park: Park) -> str:
        """
        Encode park state as a hash string
        
        Args:
            park: Park environment
            
        Returns:
            Hash string representing the state
        """
        # Create grid representation
        grid = np.zeros((self.grid_size, self.grid_size), dtype=np.int32)
        
        for element in park.elements:
            grid_x, grid_y = park.world_to_grid(element.position)
            if 0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size:
                element_idx = self.element_to_idx.get(element.element_type, 0)
                grid[grid_x, grid_y] = element_idx
        
        # Convert to string and hash
        grid_str = grid.tobytes()
        return hashlib.md5(grid_str).hexdigest()
    
    def encode_state_vector(self, park: Park) -> np.ndarray:
        """
        Encode park state as a vector
        
        Args:
            park: Park environment
            
        Returns:
            State vector (flattened grid with one-hot encoding)
        """
        # Create grid representation with one-hot encoding
        num_element_types = len(self.element_to_idx)
        state_vector = np.zeros(
            (self.grid_size, self.grid_size, num_element_types),
            dtype=np.float32
        )
        
        for element in park.elements:
            grid_x, grid_y = park.world_to_grid(element.position)
            if 0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size:
                element_idx = self.element_to_idx.get(element.element_type, 0)
                state_vector[grid_x, grid_y, element_idx] = 1.0
        
        # Flatten to 1D vector
        return state_vector.flatten()
    
    def decode_state(self, state_hash: str, park: Park) -> Dict[str, Any]:
        """
        Decode state hash back to grid (for visualization)
        Note: This is approximate since hash is one-way
        """
        # This would require storing the original state
        # For now, just return the current park state
        grid = np.zeros((self.grid_size, self.grid_size), dtype=np.int32)
        
        for element in park.elements:
            grid_x, grid_y = park.world_to_grid(element.position)
            if 0 <= grid_x < self.grid_size and 0 <= grid_y < self.grid_size:
                element_idx = self.element_to_idx.get(element.element_type, 0)
                grid[grid_x, grid_y] = element_idx
        
        return {
            'grid': grid.tolist(),
            'num_elements': len(park.elements)
        }