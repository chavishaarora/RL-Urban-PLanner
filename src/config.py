"""
Configuration file for Urban Park RL System
Contains all constants, hyperparameters, and settings
"""

import numpy as np
from dataclasses import dataclass
from typing import Tuple, Dict, Any
from enum import Enum

# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================

class ElementType(Enum):
    """Enumeration of park element types"""
    BENCH = "bench"
    TREE = "tree"
    FOUNTAIN = "fountain"
    STREET_LAMP = "lamp"
    GRASS_PATCH = "grass"
    PATHWAY = "pathway"
    EMPTY = "empty"

@dataclass
class ParkConfig:
    """Park environment configuration"""
    size: float = 30.0  # Park size in meters
    grid_size: int = 3  # Grid dimensions (3x3)
    max_elements_per_type: int = 10
    ground_color: Tuple[int, int, int] = (10, 10, 10)  # Dark ground for night scene
    ambient_light: float = 0.3
    
    # Element sizes (in meters)
    element_sizes = {
        ElementType.BENCH: 2.0,
        ElementType.TREE: 3.0,
        ElementType.FOUNTAIN: 4.0,
        ElementType.STREET_LAMP: 1.0,
        ElementType.GRASS_PATCH: 5.0,
        ElementType.PATHWAY: 3.0
    }
    
    # Element colors (RGB)
    element_colors = {
        ElementType.BENCH: (139, 69, 19),  # Brown
        ElementType.TREE: (34, 139, 34),    # Forest green
        ElementType.FOUNTAIN: (64, 164, 223),  # Light blue
        ElementType.STREET_LAMP: (255, 223, 0),  # Golden yellow
        ElementType.GRASS_PATCH: (124, 252, 0),  # Lawn green
        ElementType.PATHWAY: (128, 128, 128)  # Gray
    }

# ============================================
# REINFORCEMENT LEARNING CONFIGURATION
# ============================================

@dataclass
class RLConfig:
    """Reinforcement Learning hyperparameters"""
    # Q-Learning parameters
    learning_rate: float = 0.1
    discount_factor: float = 0.95
    epsilon_start: float = 0.3
    epsilon_min: float = 0.01
    epsilon_decay: float = 0.995
    
    # Training settings
    episodes: int = 100
    max_steps_per_episode: int = 50
    batch_size: int = 32
    
    # Experience replay
    replay_buffer_size: int = 10000
    min_replay_size: int = 100
    
    # State representation
    state_encoding_size: int = 54  # 9 positions × 6 element types
    action_space_size: int = 54    # 9 positions × 6 element types

# ============================================
# METRICS CONFIGURATION
# ============================================

@dataclass
class MetricsConfig:
    """Metrics calculation configuration"""
    # Comfort metrics
    comfort_bench_tree_radius: float = 5.0  # Meters
    comfort_bench_fountain_radius: float = 8.0
    comfort_bench_lamp_radius: float = 4.0
    
    # Coverage thresholds
    min_shade_coverage: float = 0.3  # 30%
    optimal_shade_coverage: float = 0.5  # 50%
    min_light_coverage: float = 0.6  # 60% for night scene
    
    # Distribution parameters
    distribution_sigma: float = 5.0
    optimal_distribution_score: float = 0.8
    
    # Utilization targets
    min_utilization: float = 0.3
    optimal_utilization: float = 0.7
    
    # Reward weights
    reward_weights = {
        'comfort': 50.0,
        'utilization': 30.0,
        'shade_coverage': 20.0,
        'light_coverage': 30.0,  # Higher weight for night scene
        'distribution': 20.0,
        'element_penalty': -5.0  # Per element over limit
    }

# ============================================
# AGENT CONFIGURATION
# ============================================

@dataclass
class AgentConfig:
    """Pedestrian agent configuration"""
    num_agents: int = 10
    spawn_rate: float = 0.5  # Agents per second
    
    # Movement parameters
    min_speed: float = 1.0  # m/s
    max_speed: float = 2.0  # m/s
    wander_strength: float = 0.5
    attraction_strength: float = 0.3
    
    # Behavior parameters
    rest_probability: float = 0.1  # Probability of sitting on bench
    rest_duration: Tuple[float, float] = (5.0, 15.0)  # Min/max rest time
    
    # Pathfinding
    avoidance_radius: float = 1.5
    goal_reached_threshold: float = 2.0

# ============================================
# VISUALIZATION CONFIGURATION
# ============================================

@dataclass
class VisualizationConfig:
    """Visualization and rendering configuration"""
    # Window settings
    window_width: int = 1280
    window_height: int = 720
    fps: int = 60
    
    # Camera settings
    camera_distance: float = 43.0
    camera_height: float = 30.0
    camera_angle: float = np.pi / 4
    camera_fov: float = 60.0
    
    # Rendering options
    enable_shadows: bool = True
    enable_antialiasing: bool = True
    enable_particles: bool = False  # For fountain effects
    
    # UI settings
    ui_panel_width: int = 320
    ui_panel_opacity: float = 0.95
    ui_font_size: int = 13
    
    # Colors (RGB)
    ui_background: Tuple[int, int, int] = (15, 15, 25)
    ui_text: Tuple[int, int, int] = (255, 255, 255)
    ui_accent: Tuple[int, int, int] = (102, 187, 106)
    ui_warning: Tuple[int, int, int] = (255, 167, 38)
    ui_error: Tuple[int, int, int] = (239, 83, 80)
    ui_ai: Tuple[int, int, int] = (171, 71, 188)

# ============================================
# LOGGING CONFIGURATION
# ============================================

@dataclass
class LoggingConfig:
    """Logging configuration"""
    log_level: str = "INFO"
    log_file: str = "data/logs/training.log"
    console_output: bool = True
    save_interval: int = 10  # Save model every N episodes
    
    # Metrics logging
    log_metrics: bool = True
    metrics_file: str = "data/logs/metrics.csv"
    
    # Tensorboard
    use_tensorboard: bool = False
    tensorboard_dir: str = "data/logs/tensorboard"

# ============================================
# GLOBAL CONFIGURATION INSTANCES
# ============================================

park_config = ParkConfig()
rl_config = RLConfig()
metrics_config = MetricsConfig()
agent_config = AgentConfig()
viz_config = VisualizationConfig()
log_config = LoggingConfig()

# ============================================
# HELPER FUNCTIONS
# ============================================

def get_config_dict() -> Dict[str, Any]:
    """Get all configuration as a dictionary"""
    return {
        'park': park_config.__dict__,
        'rl': rl_config.__dict__,
        'metrics': metrics_config.__dict__,
        'agent': agent_config.__dict__,
        'visualization': viz_config.__dict__,
        'logging': log_config.__dict__
    }

def update_config_from_dict(config_dict: Dict[str, Any]):
    """Update configuration from a dictionary"""
    for key, value in config_dict.items():
        if hasattr(park_config, key):
            setattr(park_config, key, value)
        elif hasattr(rl_config, key):
            setattr(rl_config, key, value)
        elif hasattr(metrics_config, key):
            setattr(metrics_config, key, value)
        elif hasattr(agent_config, key):
            setattr(agent_config, key, value)
        elif hasattr(viz_config, key):
            setattr(viz_config, key, value)
        elif hasattr(log_config, key):
            setattr(log_config, key, value)