"""
Configuration file for Urban Park RL System with Temperature System
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
    
    # Temperature settings (in Celsius)
    default_temperature: float = 25.0  # Default comfortable temperature
    min_temperature: float = 5.0       # Minimum (cold winter day)
    max_temperature: float = 42.0      # Maximum (extreme heat)
    comfortable_temp_range: Tuple[float, float] = (18.0, 26.0)  # Comfortable range
    
    # Temperature effect multipliers
    shade_value_per_degree_above_comfort: float = 0.05  # How much shade matters when hot
    cooling_radius_fountain: float = 8.0  # Fountain cooling effect radius
    fountain_cooling_effect: float = 2.0  # Degrees of cooling near fountain
    tree_shade_cooling: float = 3.0  # Degrees of cooling under tree shade
    
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
# METRICS CONFIGURATION WITH TEMPERATURE
# ============================================

@dataclass
class MetricsConfig:
    """Metrics calculation configuration with temperature awareness"""
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
    
    # Temperature-based reward weights
    # These are BASE weights - they get adjusted by temperature
    reward_weights_base = {
        'comfort': 50.0,
        'utilization': 30.0,
        'shade_coverage': 20.0,
        'light_coverage': 30.0,
        'distribution': 20.0,
        'thermal_comfort': 40.0,  # NEW: thermal comfort bonus
        'element_penalty': -5.0
    }
    
    # Temperature weight adjustments
    # At extreme temperatures, these multipliers are applied
    temp_weight_multipliers_hot = {  # Applied when temp > comfortable_max
        'shade_coverage': 2.5,  # Shade becomes 2.5x more important
        'thermal_comfort': 2.0,
        'comfort': 1.5,  # General comfort more important
        'light_coverage': 0.5,  # Light less important in hot day
    }
    
    temp_weight_multipliers_cold = {  # Applied when temp < comfortable_min
        'shade_coverage': 0.3,  # Shade less important when cold
        'thermal_comfort': 1.5,
        'light_coverage': 1.5,  # Light more important (warmth association)
    }
    
    # Reward weights property that gets dynamically adjusted
    reward_weights = reward_weights_base.copy()

# ============================================
# AGENT CONFIGURATION WITH TEMPERATURE
# ============================================

@dataclass
class AgentConfig:
    """Pedestrian agent configuration with temperature awareness"""
    num_agents: int = 10
    spawn_rate: float = 0.5  # Agents per second
    
    # Movement parameters
    min_speed: float = 1.0  # m/s
    max_speed: float = 2.0  # m/s
    wander_strength: float = 0.5
    attraction_strength: float = 0.3
    
    # Behavior parameters
    rest_probability: float = 0.1  # Base probability
    rest_duration: Tuple[float, float] = (5.0, 15.0)  # Min/max rest time
    
    # Temperature-affected behavior
    shade_seeking_temp_threshold: float = 28.0  # Above this, strongly seek shade
    cold_seeking_temp_threshold: float = 12.0  # Below this, avoid shade
    
    # Temperature behavior multipliers
    shade_preference_multiplier_hot: float = 5.0  # How much more agents prefer shade when hot
    fountain_preference_multiplier_hot: float = 3.0  # Cooling effect attraction
    rest_probability_multiplier_hot: float = 1.5  # Rest more when hot
    rest_duration_multiplier_hot: float = 1.3  # Rest longer when hot
    
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
    
    # Temperature visualization colors
    temp_cold_color: Tuple[int, int, int] = (100, 150, 255)  # Blue
    temp_comfortable_color: Tuple[int, int, int] = (100, 255, 100)  # Green
    temp_hot_color: Tuple[int, int, int] = (255, 100, 50)  # Orange-red

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

def update_reward_weights_for_temperature(temperature: float):
    """
    Dynamically adjust reward weights based on current temperature
    
    Args:
        temperature: Current temperature in Celsius
    """
    global metrics_config
    
    # Start with base weights
    metrics_config.reward_weights = metrics_config.reward_weights_base.copy()
    
    # Get comfortable range
    temp_min, temp_max = park_config.comfortable_temp_range
    
    if temperature > temp_max:
        # HOT conditions - shade and thermal comfort are critical
        temp_excess = temperature - temp_max
        intensity = min(1.0, temp_excess / 10.0)  # Caps at 10 degrees over comfort
        
        for key, multiplier in metrics_config.temp_weight_multipliers_hot.items():
            if key in metrics_config.reward_weights:
                # Interpolate between 1.0 and multiplier based on intensity
                adjusted_mult = 1.0 + (multiplier - 1.0) * intensity
                metrics_config.reward_weights[key] *= adjusted_mult
    
    elif temperature < temp_min:
        # COLD conditions - shade less important, light/warmth more important
        temp_deficit = temp_min - temperature
        intensity = min(1.0, temp_deficit / 10.0)  # Caps at 10 degrees under comfort
        
        for key, multiplier in metrics_config.temp_weight_multipliers_cold.items():
            if key in metrics_config.reward_weights:
                # Interpolate between 1.0 and multiplier based on intensity
                adjusted_mult = 1.0 + (multiplier - 1.0) * intensity
                metrics_config.reward_weights[key] *= adjusted_mult
    
    # Log the adjustment
    if temperature > temp_max or temperature < temp_min:
        print(f"[Temperature] Adjusted reward weights for {temperature:.1f}°C:")
        print(f"  Shade coverage weight: {metrics_config.reward_weights['shade_coverage']:.1f}")
        print(f"  Thermal comfort weight: {metrics_config.reward_weights['thermal_comfort']:.1f}")
        print(f"  Light coverage weight: {metrics_config.reward_weights['light_coverage']:.1f}")

def get_temperature_description(temperature: float) -> str:
    """Get human-readable description of temperature"""
    if temperature < 10:
        return "Freezing"
    elif temperature < 15:
        return "Cold"
    elif temperature < 18:
        return "Cool"
    elif temperature < 26:
        return "Comfortable"
    elif temperature < 30:
        return "Warm"
    elif temperature < 35:
        return "Hot"
    else:
        return "Extreme Heat"

def get_temperature_color(temperature: float) -> Tuple[int, int, int]:
    """Get color representing temperature for visualization"""
    temp_min, temp_max = park_config.comfortable_temp_range
    
    if temperature < temp_min:
        # Blue for cold
        intensity = max(0.0, min(1.0, (temp_min - temperature) / 15.0))
        return (
            int(100 + 155 * (1 - intensity)),
            int(150 + 105 * (1 - intensity)),
            255
        )
    elif temperature > temp_max:
        # Red/Orange for hot
        intensity = max(0.0, min(1.0, (temperature - temp_max) / 15.0))
        return (
            255,
            int(100 + 155 * (1 - intensity)),
            int(50 + 205 * (1 - intensity))
        )
    else:
        # Green for comfortable
        return viz_config.temp_comfortable_color