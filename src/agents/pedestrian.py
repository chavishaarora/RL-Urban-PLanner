"""
TEMPERATURE-AWARE Agent Manager
Agents adjust behavior based on temperature:
- Seek shade when hot
- Avoid cold areas when cold  
- Rest longer in extreme temperatures
- Prefer cooling fountains when hot
"""

import random
import math
from typing import List, Optional, Tuple
from enum import Enum

try:
    from config import agent_config, park_config
except ImportError:
    pass


class AgentState(Enum):
    """Agent behavior states"""
    WANDERING = "wandering"
    MOVING_TO_TARGET = "moving_to_target"
    RESTING = "resting"
    SEEKING_SHADE = "seeking_shade"  # NEW: Active shade seeking
    SEEKING_COOLNESS = "seeking_coolness"  # NEW: Seeking fountain/cool area


class Position:
    """Simple 2D position"""
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
    
    def distance_to(self, other: 'Position') -> float:
        dx = self.x - other.x
        dy = self.y - other.y
        return math.sqrt(dx * dx + dy * dy)
    
    def copy(self):
        return Position(self.x, self.y)


class PedestrianAgent:
    """Temperature-aware pedestrian agent with intelligent behavior"""
    
    def __init__(self, park, position: Position):
        self.park = park
        self.position = position
        self.last_position = position.copy()
        self.target = None
        self.state = AgentState.WANDERING
        self.speed = random.uniform(0.8, 1.8)
        
        # Rest parameters (temperature-affected)
        self.rest_timer = 0
        self.base_rest_duration = random.uniform(1.5, 4.0)
        self.rest_duration = self.base_rest_duration
        
        # Movement tracking
        self.stuck_timer = 0
        self.stuck_threshold = 3.0
        self.time_since_last_move = 0
        
        # Temperature preferences
        self.heat_tolerance = random.uniform(0.7, 1.3)  # Individual variation
        self.cold_tolerance = random.uniform(0.7, 1.3)
        
        # Thermal state
        self.discomfort_level = 0.0  # 0-1, how uncomfortable the agent is
        self.time_in_discomfort = 0.0
        
    def update(self, delta_time: float):
        """Update agent behavior with temperature awareness"""
        
        # Update thermal state
        self._update_thermal_state(delta_time)
        
        # Check if agent actually moved
        distance_moved = self.position.distance_to(self.last_position)
        
        if distance_moved < 0.01:
            self.time_since_last_move += delta_time
        else:
            self.time_since_last_move = 0
            self.last_position = self.position.copy()
        
        # Force unstuck if needed
        if self.time_since_last_move > self.stuck_threshold:
            self._force_unstuck()
            self.time_since_last_move = 0
        
        # Temperature-driven behavior override
        if self._should_seek_shade():
            if self.state != AgentState.SEEKING_SHADE:
                self.state = AgentState.SEEKING_SHADE
                self.target = None
        
        elif self._should_seek_coolness():
            if self.state != AgentState.SEEKING_COOLNESS:
                self.state = AgentState.SEEKING_COOLNESS
                self.target = None
        
        # Normal behavior based on state
        if self.state == AgentState.WANDERING:
            self._wander()
        elif self.state == AgentState.MOVING_TO_TARGET:
            self._move_to_target(delta_time)
        elif self.state == AgentState.RESTING:
            self._rest(delta_time)
        elif self.state == AgentState.SEEKING_SHADE:
            self._seek_shade(delta_time)
        elif self.state == AgentState.SEEKING_COOLNESS:
            self._seek_coolness(delta_time)
    
    def _update_thermal_state(self, delta_time: float):
        """Update agent's thermal comfort state"""
        try:
            temperature = self.park.get_temperature()
            effective_temp = self.park.get_effective_temperature_at_position(
                self._position_to_park_pos(self.position)
            )
            temp_min, temp_max = park_config.comfortable_temp_range
            
            # Calculate discomfort
            if effective_temp > temp_max * self.heat_tolerance:
                # Too hot
                excess = effective_temp - (temp_max * self.heat_tolerance)
                self.discomfort_level = min(1.0, excess / 10.0)
                self.time_in_discomfort += delta_time
            elif effective_temp < temp_min * self.cold_tolerance:
                # Too cold
                deficit = (temp_min * self.cold_tolerance) - effective_temp
                self.discomfort_level = min(1.0, deficit / 10.0)
                self.time_in_discomfort += delta_time
            else:
                # Comfortable
                self.discomfort_level = max(0.0, self.discomfort_level - delta_time * 0.1)
                if self.discomfort_level < 0.1:
                    self.time_in_discomfort = 0.0
        except:
            self.discomfort_level = 0.0
    
    def _should_seek_shade(self) -> bool:
        """Determine if agent should actively seek shade"""
        try:
            temperature = self.park.get_temperature()
            threshold = agent_config.shade_seeking_temp_threshold * self.heat_tolerance
            
            # Seek shade if:
            # 1. Temperature is high AND
            # 2. Agent is not already in shade AND
            # 3. Agent has been uncomfortable for a while
            if temperature > threshold:
                in_shade = self.park.is_position_in_shade(
                    self._position_to_park_pos(self.position)
                )
                
                if not in_shade and self.time_in_discomfort > 2.0:
                    return True
        except:
            pass
        
        return False
    
    def _should_seek_coolness(self) -> bool:
        """Determine if agent should seek fountain/cool area"""
        try:
            temperature = self.park.get_temperature()
            threshold = agent_config.shade_seeking_temp_threshold * self.heat_tolerance
            
            # Seek coolness if very hot and really uncomfortable
            if temperature > threshold + 3 and self.discomfort_level > 0.6:
                return True
        except:
            pass
        
        return False
    
    def _seek_shade(self, delta_time: float):
        """Actively seek shaded area (under trees)"""
        if not self.target:
            # Find nearest shaded spot
            shade_target = self._find_nearest_shade()
            
            if shade_target:
                self.target = shade_target
            else:
                # No shade available, just wander
                self.state = AgentState.WANDERING
                return
        
        # Move to shade target
        self._move_to_target(delta_time)
        
        # Check if we've reached shade
        if self.target:
            in_shade = self.park.is_position_in_shade(
                self._position_to_park_pos(self.position)
            )
            
            if in_shade:
                # Found shade! Rest here
                self.state = AgentState.RESTING
                self.rest_timer = 0
                # Stay longer in shade when it's hot
                self.rest_duration = self.base_rest_duration * 1.5
                self.target = None
    
    def _seek_coolness(self, delta_time: float):
        """Actively seek fountain or cool area"""
        if not self.target:
            # Find nearest fountain
            coolness_target = self._find_nearest_fountain()
            
            if coolness_target:
                self.target = coolness_target
            else:
                # No fountain, try shade instead
                self.state = AgentState.SEEKING_SHADE
                return
        
        # Move to coolness target
        self._move_to_target(delta_time)
        
        # Check if we've reached cool area
        if self.target:
            dist_to_target = self.position.distance_to(self.target)
            if dist_to_target < 1.0:
                # Reached cool area! Rest here
                self.state = AgentState.RESTING
                self.rest_timer = 0
                # Stay even longer near fountain when very hot
                self.rest_duration = self.base_rest_duration * 2.0
                self.target = None
    
    def _find_nearest_shade(self) -> Optional[Position]:
        """Find position under nearest tree"""
        from environment.park import ElementType
        
        trees = self.park.get_elements_by_type(ElementType.TREE)
        
        if not trees:
            return None
        
        # Find nearest tree
        min_dist = float('inf')
        nearest_tree = None
        
        for tree in trees:
            dist = math.sqrt(
                (self.position.x - tree.position.x) ** 2 +
                (self.position.y - tree.position.y) ** 2
            )
            
            if dist < min_dist:
                min_dist = dist
                nearest_tree = tree
        
        if nearest_tree:
            # Target a position under the tree
            return Position(nearest_tree.position.x, nearest_tree.position.y)
        
        return None
    
    def _find_nearest_fountain(self) -> Optional[Position]:
        """Find position near nearest fountain"""
        from environment.park import ElementType
        
        fountains = self.park.get_elements_by_type(ElementType.FOUNTAIN)
        
        if not fountains:
            return None
        
        # Find nearest fountain
        min_dist = float('inf')
        nearest_fountain = None
        
        for fountain in fountains:
            dist = math.sqrt(
                (self.position.x - fountain.position.x) ** 2 +
                (self.position.y - fountain.position.y) ** 2
            )
            
            if dist < min_dist:
                min_dist = dist
                nearest_fountain = fountain
        
        if nearest_fountain:
            # Target a position near the fountain
            return Position(nearest_fountain.position.x, nearest_fountain.position.y)
        
        return None
    
    def _position_to_park_pos(self, pos: Position):
        """Convert agent position to park Position"""
        from environment.park import Position as ParkPosition
        return ParkPosition(pos.x, pos.y, 0)
    
    def _force_unstuck(self):
        """Forcefully unstuck the agent"""
        # Try to teleport to a valid position
        for distance in [2.0, 3.0, 5.0]:
            for angle in range(0, 360, 45):
                rad = math.radians(angle)
                new_x = self.position.x + math.cos(rad) * distance
                new_y = self.position.y + math.sin(rad) * distance
                new_pos = Position(new_x, new_y)
                
                if self._is_position_valid(new_pos):
                    self.position = new_pos
                    self.state = AgentState.WANDERING
                    self.target = None
                    self.stuck_timer = 0
                    return
        
        # If all else fails, move to edge
        self.position = self._get_edge_position()
        self.state = AgentState.WANDERING
        self.target = None
    
    def _get_edge_position(self) -> Position:
        """Get a position at the edge of the park"""
        half_size = self.park.size / 2 - 2
        side = random.choice(['top', 'bottom', 'left', 'right'])
        
        if side == 'top':
            return Position(random.uniform(-half_size, half_size), half_size)
        elif side == 'bottom':
            return Position(random.uniform(-half_size, half_size), -half_size)
        elif side == 'left':
            return Position(-half_size, random.uniform(-half_size, half_size))
        else:
            return Position(half_size, random.uniform(-half_size, half_size))
    
    def _wander(self):
        """Find a random target with temperature preferences"""
        # Try to find a thermally comfortable target
        for attempt in range(20):
            target_pos = self._get_random_position()
            
            if self._is_position_valid(target_pos):
                # Check thermal comfort of target
                thermal_comfort = self._get_thermal_comfort_at_pos(target_pos)
                
                # If uncomfortable, prefer comfortable spots
                if self.discomfort_level > 0.3:
                    if thermal_comfort > 0.6 or attempt > 15:
                        self.target = target_pos
                        self.state = AgentState.MOVING_TO_TARGET
                        return
                else:
                    # Not uncomfortable, any valid position is fine
                    self.target = target_pos
                    self.state = AgentState.MOVING_TO_TARGET
                    return
        
        # Fallback to far position
        half_size = self.park.size / 2 - 3
        far_positions = [
            Position(half_size, half_size),
            Position(-half_size, half_size),
            Position(half_size, -half_size),
            Position(-half_size, -half_size),
        ]
        
        self.target = random.choice(far_positions)
        self.state = AgentState.MOVING_TO_TARGET
    
    def _get_thermal_comfort_at_pos(self, pos: Position) -> float:
        """Get thermal comfort score at a position"""
        try:
            park_pos = self._position_to_park_pos(pos)
            return self.park.get_thermal_comfort_at_position(park_pos)
        except:
            return 0.5
    
    def _move_to_target(self, delta_time: float):
        """Move towards target"""
        if not self.target:
            self.state = AgentState.WANDERING
            return
        
        dx = self.target.x - self.position.x
        dy = self.target.y - self.position.y
        dist = math.sqrt(dx * dx + dy * dy)
        
        if dist < 0.3:
            self._handle_arrival()
            return
        
        if dist > 0:
            move_dist = self.speed * delta_time
            if move_dist > dist:
                move_dist = dist
            
            new_x = self.position.x + (dx / dist) * move_dist
            new_y = self.position.y + (dy / dist) * move_dist
            new_pos = Position(new_x, new_y)
            
            if self._is_position_valid(new_pos):
                self.position = new_pos
                self.stuck_timer = 0
            else:
                if not self._try_alternative_path(delta_time):
                    self.stuck_timer += delta_time
                    if self.stuck_timer > 1.0:
                        self.state = AgentState.WANDERING
                        self.stuck_timer = 0
    
    def _try_alternative_path(self, delta_time: float) -> bool:
        """Try to move around obstacle"""
        if not self.target:
            return False
        
        angles = [30, -30, 60, -60, 90, -90, 120, -120, 45, -45]
        
        for angle_offset in angles:
            dx = self.target.x - self.position.x
            dy = self.target.y - self.position.y
            current_angle = math.atan2(dy, dx)
            
            new_angle = current_angle + math.radians(angle_offset)
            move_dist = self.speed * delta_time * 0.7
            
            new_x = self.position.x + math.cos(new_angle) * move_dist
            new_y = self.position.y + math.sin(new_angle) * move_dist
            new_pos = Position(new_x, new_y)
            
            if self._is_position_valid(new_pos):
                self.position = new_pos
                return True
        
        return False
    
    def _handle_arrival(self):
        """Handle reaching target with temperature-aware behavior"""
        nearby_element = self._get_nearby_element()
        
        # Adjust rest probability based on temperature and discomfort
        base_rest_prob = 0.3
        
        try:
            temperature = self.park.get_temperature()
            threshold_hot = agent_config.shade_seeking_temp_threshold
            
            if temperature > threshold_hot:
                # Hot: rest more often, especially in shade
                if self.park.is_position_in_shade(self._position_to_park_pos(self.position)):
                    rest_prob = base_rest_prob * agent_config.rest_probability_multiplier_hot
                else:
                    rest_prob = base_rest_prob * 0.5  # Less likely to rest in sun when hot
            elif temperature < agent_config.cold_seeking_temp_threshold:
                # Cold: rest less
                rest_prob = base_rest_prob * 0.5
            else:
                rest_prob = base_rest_prob
        except:
            rest_prob = base_rest_prob
        
        if nearby_element and random.random() < rest_prob:
            self.state = AgentState.RESTING
            self.rest_timer = 0
            
            # Adjust rest duration based on temperature
            try:
                if temperature > threshold_hot:
                    self.rest_duration = self.base_rest_duration * agent_config.rest_duration_multiplier_hot
                else:
                    self.rest_duration = self.base_rest_duration
            except:
                self.rest_duration = self.base_rest_duration
        else:
            self.state = AgentState.WANDERING
    
    def _rest(self, delta_time: float):
        """Rest at current location"""
        self.rest_timer += delta_time
        
        # If discomfort increases while resting, cut it short
        if self.discomfort_level > 0.7 and self.rest_timer > 2.0:
            self.state = AgentState.WANDERING
            self.rest_timer = 0
            return
        
        if self.rest_timer >= self.rest_duration:
            self.state = AgentState.WANDERING
            self.rest_timer = 0
    
    def _get_random_position(self) -> Position:
        """Get a random position within park bounds"""
        margin = 2.0
        half_size = self.park.size / 2 - margin
        
        return Position(
            random.uniform(-half_size, half_size),
            random.uniform(-half_size, half_size)
        )
    
    def _is_position_valid(self, pos: Position) -> bool:
        """Check if position is valid"""
        half_size = self.park.size / 2
        if (abs(pos.x) > half_size or abs(pos.y) > half_size):
            return False
        
        for element in self.park.elements:
            dist = math.sqrt(
                (pos.x - element.position.x) ** 2 + 
                (pos.y - element.position.y) ** 2
            )
            
            collision_radius = element.size / 2 + 0.4
            
            if dist < collision_radius:
                return False
        
        return True
    
    def _get_nearby_element(self):
        """Get nearby park element if any"""
        for element in self.park.elements:
            dist = math.sqrt(
                (self.position.x - element.position.x) ** 2 +
                (self.position.y - element.position.y) ** 2
            )
            if dist < 2.5:
                return element
        return None


class AgentManager:
    """Temperature-aware Agent Manager"""
    
    def __init__(self, park, num_agents: int = 20):
        self.park = park
        self.agents: List[PedestrianAgent] = []
        self.max_spawn_attempts = 50
        
        for _ in range(num_agents):
            self.spawn_agent()
    
    def spawn_agent(self) -> bool:
        """Spawn a new agent in a valid position"""
        for attempt in range(self.max_spawn_attempts):
            pos = self._get_spawn_position()
            
            if self._is_spawn_position_valid(pos):
                agent = PedestrianAgent(self.park, pos)
                self.agents.append(agent)
                return True
        
        safe_pos = self._get_emergency_spawn_position()
        agent = PedestrianAgent(self.park, safe_pos)
        self.agents.append(agent)
        return True
    
    def _get_spawn_position(self) -> Position:
        """Get a random spawn position"""
        margin = 3.0
        half_size = self.park.size / 2 - margin
        
        return Position(
            random.uniform(-half_size, half_size),
            random.uniform(-half_size, half_size)
        )
    
    def _get_emergency_spawn_position(self) -> Position:
        """Get a safe emergency spawn position"""
        half_size = self.park.size / 2 - 1
        side = random.choice(['top', 'bottom', 'left', 'right'])
        
        if side == 'top':
            return Position(random.uniform(-half_size, half_size), half_size)
        elif side == 'bottom':
            return Position(random.uniform(-half_size, half_size), -half_size)
        elif side == 'left':
            return Position(-half_size, random.uniform(-half_size, half_size))
        else:
            return Position(half_size, random.uniform(-half_size, half_size))
    
    def _is_spawn_position_valid(self, pos: Position) -> bool:
        """Check if spawn position is valid"""
        half_size = self.park.size / 2
        if (abs(pos.x) > half_size or abs(pos.y) > half_size):
            return False
        
        for element in self.park.elements:
            dist = math.sqrt(
                (pos.x - element.position.x) ** 2 + 
                (pos.y - element.position.y) ** 2
            )
            
            if dist < element.size / 2 + 1.5:
                return False
        
        for agent in self.agents:
            if pos.distance_to(agent.position) < 1.0:
                return False
        
        return True
    
    def update(self, delta_time: float):
        """Update all agents"""
        for agent in self.agents:
            agent.update(delta_time)
    
    def set_agent_count(self, target_count: int):
        """Safely adjust agent count"""
        current_count = len(self.agents)
        
        if target_count > current_count:
            for _ in range(target_count - current_count):
                self.spawn_agent()
        elif target_count < current_count:
            for _ in range(current_count - target_count):
                if self.agents:
                    self.agents.pop()
    
    def get_agent_count(self) -> int:
        """Get current number of agents"""
        return len(self.agents)
    
    def clear_all_agents(self):
        """Remove all agents"""
        self.agents.clear()
    
    def respawn_all_agents(self, num_agents: int = None):
        """Clear and respawn all agents"""
        if num_agents is None:
            num_agents = len(self.agents)
        
        self.clear_all_agents()
        
        for _ in range(num_agents):
            self.spawn_agent()
    
    def get_thermal_statistics(self) -> dict:
        """Get statistics about agent thermal comfort"""
        if not self.agents:
            return {
                'avg_discomfort': 0.0,
                'agents_in_shade': 0,
                'agents_near_fountain': 0,
                'agents_seeking_shade': 0
            }
        
        total_discomfort = sum(agent.discomfort_level for agent in self.agents)
        agents_in_shade = sum(
            1 for agent in self.agents
            if self.park.is_position_in_shade(
                agent._position_to_park_pos(agent.position)
            )
        )
        
        from environment.park import ElementType
        fountains = self.park.get_elements_by_type(ElementType.FOUNTAIN)
        agents_near_fountain = 0
        for agent in self.agents:
            for fountain in fountains:
                dist = agent.position.distance_to(
                    Position(fountain.position.x, fountain.position.y)
                )
                if dist < 5.0:
                    agents_near_fountain += 1
                    break
        
        agents_seeking_shade = sum(
            1 for agent in self.agents
            if agent.state == AgentState.SEEKING_SHADE
        )
        
        return {
            'avg_discomfort': total_discomfort / len(self.agents),
            'agents_in_shade': agents_in_shade,
            'agents_near_fountain': agents_near_fountain,
            'agents_seeking_shade': agents_seeking_shade,
            'total_agents': len(self.agents)
        }