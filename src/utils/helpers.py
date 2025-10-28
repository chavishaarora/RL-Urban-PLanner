"""
Helpers Module
Utility functions and helpers for the Urban Park RL system
"""

import numpy as np
import json
import pickle
import os
from typing import Any, Dict, List, Tuple, Optional, Union
from datetime import datetime
import hashlib
import random
import math


# ============================================
# Math Utilities
# ============================================

def normalize_vector(vector: np.ndarray) -> np.ndarray:
    """Normalize a vector to unit length"""
    norm = np.linalg.norm(vector)
    if norm > 0:
        return vector / norm
    return vector


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min and max"""
    return max(min_val, min(max_val, value))


def lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation between a and b"""
    return a + (b - a) * clamp(t, 0.0, 1.0)


def distance_2d(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Calculate 2D Euclidean distance"""
    return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)


def angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    """Calculate angle between two vectors in radians"""
    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    return math.acos(clamp(cos_angle, -1.0, 1.0))


def rotate_point(point: Tuple[float, float], 
                 angle: float, 
                 center: Tuple[float, float] = (0, 0)) -> Tuple[float, float]:
    """Rotate a 2D point around a center"""
    s = math.sin(angle)
    c = math.cos(angle)
    
    # Translate to origin
    x = point[0] - center[0]
    y = point[1] - center[1]
    
    # Rotate
    new_x = x * c - y * s
    new_y = x * s + y * c
    
    # Translate back
    return (new_x + center[0], new_y + center[1])


# ============================================
# File I/O Utilities
# ============================================

def save_json(data: Any, filepath: str, indent: int = 2):
    """Save data to JSON file"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=indent, default=str)


def load_json(filepath: str) -> Any:
    """Load data from JSON file"""
    with open(filepath, 'r') as f:
        return json.load(f)


def save_pickle(data: Any, filepath: str):
    """Save data to pickle file"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        pickle.dump(data, f)


def load_pickle(filepath: str) -> Any:
    """Load data from pickle file"""
    with open(filepath, 'rb') as f:
        return pickle.load(f)


def save_numpy(array: np.ndarray, filepath: str):
    """Save numpy array to file"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    np.save(filepath, array)


def load_numpy(filepath: str) -> np.ndarray:
    """Load numpy array from file"""
    return np.load(filepath)


# ============================================
# String Utilities
# ============================================

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = ''.join(random.choices('0123456789abcdef', k=6))
    return f"{prefix}{timestamp}_{random_suffix}"


def hash_string(text: str) -> str:
    """Generate MD5 hash of a string"""
    return hashlib.md5(text.encode()).hexdigest()


def format_time(seconds: float) -> str:
    """Format seconds to human-readable time"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        secs = seconds % 60
        return f"{minutes}m {secs:.0f}s"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m"


def truncate_string(text: str, max_length: int, suffix: str = "...") -> str:
    """Truncate string to maximum length"""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix


# ============================================
# Color Utilities
# ============================================

def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB to hex color"""
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def blend_colors(color1: Tuple[int, int, int], 
                color2: Tuple[int, int, int], 
                ratio: float = 0.5) -> Tuple[int, int, int]:
    """Blend two RGB colors"""
    ratio = clamp(ratio, 0.0, 1.0)
    return tuple(int(c1 * (1 - ratio) + c2 * ratio) 
                 for c1, c2 in zip(color1, color2))


def adjust_brightness(color: Tuple[int, int, int], 
                     factor: float) -> Tuple[int, int, int]:
    """Adjust brightness of RGB color"""
    return tuple(clamp(int(c * factor), 0, 255) for c in color)


# ============================================
# Grid Utilities
# ============================================

def get_neighbors_2d(x: int, y: int, 
                     width: int, height: int,
                     include_diagonals: bool = True) -> List[Tuple[int, int]]:
    """Get valid neighbor coordinates in 2D grid"""
    neighbors = []
    
    # Orthogonal neighbors
    for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < width and 0 <= ny < height:
            neighbors.append((nx, ny))
    
    # Diagonal neighbors
    if include_diagonals:
        for dx, dy in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                neighbors.append((nx, ny))
    
    return neighbors


def manhattan_distance(p1: Tuple[int, int], p2: Tuple[int, int]) -> int:
    """Calculate Manhattan distance between two points"""
    return abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])


def spiral_coordinates(center: Tuple[int, int], 
                      radius: int) -> List[Tuple[int, int]]:
    """Generate coordinates in a spiral pattern"""
    coords = [center]
    x, y = center
    
    for r in range(1, radius + 1):
        # Move right
        x += 1
        coords.append((x, y))
        
        # Move up
        for _ in range(2 * r - 1):
            y -= 1
            coords.append((x, y))
        
        # Move left
        for _ in range(2 * r):
            x -= 1
            coords.append((x, y))
        
        # Move down
        for _ in range(2 * r):
            y += 1
            coords.append((x, y))
        
        # Move right
        for _ in range(2 * r):
            x += 1
            coords.append((x, y))
    
    return coords


# ============================================
# Statistics Utilities
# ============================================

def moving_average(values: List[float], window_size: int) -> List[float]:
    """Calculate moving average of a series"""
    if len(values) < window_size:
        return values
    
    averaged = []
    for i in range(len(values) - window_size + 1):
        window = values[i:i + window_size]
        averaged.append(sum(window) / window_size)
    
    return averaged


def calculate_percentile(values: List[float], percentile: float) -> float:
    """Calculate percentile of a list of values"""
    if not values:
        return 0.0
    
    sorted_values = sorted(values)
    index = int(len(sorted_values) * percentile / 100)
    index = min(index, len(sorted_values) - 1)
    
    return sorted_values[index]


def normalize_values(values: List[float]) -> List[float]:
    """Normalize values to [0, 1] range"""
    if not values:
        return []
    
    min_val = min(values)
    max_val = max(values)
    
    if max_val == min_val:
        return [0.5] * len(values)
    
    return [(v - min_val) / (max_val - min_val) for v in values]


def calculate_entropy(probabilities: List[float]) -> float:
    """Calculate Shannon entropy"""
    entropy = 0.0
    for p in probabilities:
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


# ============================================
# Validation Utilities
# ============================================

def validate_config(config: Dict[str, Any], 
                   required_keys: List[str]) -> Tuple[bool, List[str]]:
    """Validate configuration dictionary"""
    missing_keys = []
    
    for key in required_keys:
        if key not in config:
            missing_keys.append(key)
    
    is_valid = len(missing_keys) == 0
    return is_valid, missing_keys


def validate_range(value: float, 
                  min_val: float, 
                  max_val: float, 
                  name: str = "value") -> Tuple[bool, Optional[str]]:
    """Validate if value is within range"""
    if value < min_val:
        return False, f"{name} is below minimum ({value} < {min_val})"
    elif value > max_val:
        return False, f"{name} is above maximum ({value} > {max_val})"
    return True, None


def validate_probability(value: float, name: str = "probability") -> Tuple[bool, Optional[str]]:
    """Validate if value is a valid probability"""
    return validate_range(value, 0.0, 1.0, name)


# ============================================
# Performance Utilities
# ============================================

class Timer:
    """Simple timer for performance measurement"""
    
    def __init__(self):
        self.start_time = None
        self.elapsed = 0.0
    
    def start(self):
        """Start the timer"""
        self.start_time = datetime.now()
    
    def stop(self) -> float:
        """Stop the timer and return elapsed time in seconds"""
        if self.start_time:
            self.elapsed = (datetime.now() - self.start_time).total_seconds()
            self.start_time = None
        return self.elapsed
    
    def __enter__(self):
        """Context manager entry"""
        self.start()
        return self
    
    def __exit__(self, *args):
        """Context manager exit"""
        self.stop()


def profile_function(func):
    """Decorator to profile function execution time"""
    def wrapper(*args, **kwargs):
        timer = Timer()
        timer.start()
        result = func(*args, **kwargs)
        elapsed = timer.stop()
        print(f"{func.__name__} took {elapsed:.4f} seconds")
        return result
    return wrapper


# ============================================
# Random Utilities
# ============================================

def set_random_seed(seed: int):
    """Set random seed for reproducibility"""
    random.seed(seed)
    np.random.seed(seed)


def weighted_choice(choices: List[Any], weights: List[float]) -> Any:
    """Make a weighted random choice"""
    return random.choices(choices, weights=weights, k=1)[0]


def shuffle_list(items: List[Any]) -> List[Any]:
    """Return shuffled copy of list"""
    shuffled = items.copy()
    random.shuffle(shuffled)
    return shuffled


def random_point_in_circle(center: Tuple[float, float], 
                          radius: float) -> Tuple[float, float]:
    """Generate random point within a circle"""
    angle = random.uniform(0, 2 * math.pi)
    r = radius * math.sqrt(random.random())
    
    x = center[0] + r * math.cos(angle)
    y = center[1] + r * math.sin(angle)
    
    return (x, y)


def random_point_in_rectangle(min_x: float, min_y: float,
                             max_x: float, max_y: float) -> Tuple[float, float]:
    """Generate random point within a rectangle"""
    x = random.uniform(min_x, max_x)
    y = random.uniform(min_y, max_y)
    return (x, y)