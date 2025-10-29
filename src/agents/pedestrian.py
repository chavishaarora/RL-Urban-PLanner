"""
IMPROVED Agent Manager - Prevents both disappearing AND freezing
Key improvements:
1. Agents never disappear (already fixed)
2. Agents ALWAYS keep moving (new fix)
3. Better stuck detection with forced recovery
4. Shorter rest times
5. More aggressive unstuck behavior
"""

import random
import math
from typing import List, Optional, Tuple
from enum import Enum


class AgentState(Enum):
    """Agent behavior states"""
    WANDERING = "wandering"
    MOVING_TO_TARGET = "moving_to_target"
    RESTING = "resting"


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
    """Individual pedestrian agent with improved movement"""
    
    def __init__(self, park, position: Position):
        self.park = park
        self.position = position
        self.last_position = position.copy()  # Track last position
        self.target = None
        self.state = AgentState.WANDERING
        self.speed = random.uniform(0.8, 1.8)  # Faster agents
        self.rest_timer = 0
        self.rest_duration = random.uniform(1.5, 4.0)  # Shorter rest times
        self.stuck_timer = 0
        self.stuck_threshold = 3.0  # Reduced from 5.0 - detect stuck faster
        self.time_since_last_move = 0  # Track actual movement
        
    def update(self, delta_time: float):
        """Update agent behavior with improved stuck detection"""
        
        # Check if agent actually moved since last update
        distance_moved = self.position.distance_to(self.last_position)
        
        if distance_moved < 0.01:  # Basically not moving
            self.time_since_last_move += delta_time
        else:
            self.time_since_last_move = 0
            self.last_position = self.position.copy()
        
        # FORCE UNSTUCK if not moving for too long
        if self.time_since_last_move > self.stuck_threshold:
            self._force_unstuck()
            self.time_since_last_move = 0
        
        # Normal behavior based on state
        if self.state == AgentState.WANDERING:
            self._wander()
        elif self.state == AgentState.MOVING_TO_TARGET:
            self._move_to_target(delta_time)
        elif self.state == AgentState.RESTING:
            self._rest(delta_time)
    
    def _force_unstuck(self):
        """Forcefully unstuck the agent"""
        print(f"Agent stuck at ({self.position.x:.1f}, {self.position.y:.1f}), forcing movement...")
        
        # Try to teleport to a nearby valid position
        for distance in [2.0, 3.0, 5.0]:  # Try progressively farther
            for angle in range(0, 360, 45):
                rad = math.radians(angle)
                new_x = self.position.x + math.cos(rad) * distance
                new_y = self.position.y + math.sin(rad) * distance
                new_pos = Position(new_x, new_y)
                
                if self._is_position_valid(new_pos):
                    # Teleport here!
                    self.position = new_pos
                    self.state = AgentState.WANDERING
                    self.target = None
                    self.stuck_timer = 0
                    print(f"  → Teleported to ({new_pos.x:.1f}, {new_pos.y:.1f})")
                    return
        
        # If all else fails, move to random edge
        self.position = self._get_edge_position()
        self.state = AgentState.WANDERING
        self.target = None
        print(f"  → Moved to edge position")
    
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
        """Find a random target to move to - try harder to find one"""
        # Try more attempts to find a valid target
        for attempt in range(20):  # Increased from 10
            target_pos = self._get_random_position()
            if self._is_position_valid(target_pos):
                self.target = target_pos
                self.state = AgentState.MOVING_TO_TARGET
                return
        
        # If still no valid position, pick a far away position
        # (likely to be valid since it's far from elements)
        half_size = self.park.size / 2 - 3
        far_positions = [
            Position(half_size, half_size),
            Position(-half_size, half_size),
            Position(half_size, -half_size),
            Position(-half_size, -half_size),
        ]
        
        self.target = random.choice(far_positions)
        self.state = AgentState.MOVING_TO_TARGET
    
    def _move_to_target(self, delta_time: float):
        """Move towards target with better obstacle avoidance"""
        if not self.target:
            self.state = AgentState.WANDERING
            return
        
        # Calculate direction
        dx = self.target.x - self.position.x
        dy = self.target.y - self.position.y
        dist = math.sqrt(dx * dx + dy * dy)
        
        if dist < 0.3:  # Reached target
            self._handle_arrival()
            return
        
        # Try to move
        if dist > 0:
            move_dist = self.speed * delta_time
            if move_dist > dist:
                move_dist = dist
            
            new_x = self.position.x + (dx / dist) * move_dist
            new_y = self.position.y + (dy / dist) * move_dist
            new_pos = Position(new_x, new_y)
            
            if self._is_position_valid(new_pos):
                # Can move directly
                self.position = new_pos
                self.stuck_timer = 0
            else:
                # Try alternative paths
                if not self._try_alternative_path(delta_time):
                    # Couldn't find alternative, try a completely different target
                    self.stuck_timer += delta_time
                    if self.stuck_timer > 1.0:  # Give up on this target quickly
                        self.state = AgentState.WANDERING
                        self.stuck_timer = 0
    
    def _try_alternative_path(self, delta_time: float) -> bool:
        """Try to move around obstacle - return True if successful"""
        if not self.target:
            return False
        
        # Try more angles for better navigation
        angles = [30, -30, 60, -60, 90, -90, 120, -120, 45, -45]
        
        for angle_offset in angles:
            dx = self.target.x - self.position.x
            dy = self.target.y - self.position.y
            current_angle = math.atan2(dy, dx)
            
            new_angle = current_angle + math.radians(angle_offset)
            move_dist = self.speed * delta_time * 0.7  # Move a bit slower when avoiding
            
            new_x = self.position.x + math.cos(new_angle) * move_dist
            new_y = self.position.y + math.sin(new_angle) * move_dist
            new_pos = Position(new_x, new_y)
            
            if self._is_position_valid(new_pos):
                self.position = new_pos
                return True
        
        return False
    
    def _handle_arrival(self):
        """Handle reaching target"""
        nearby_element = self._get_nearby_element()
        
        # Only rest 30% of the time (reduced from 60%)
        if nearby_element and random.random() < 0.3:
            self.state = AgentState.RESTING
            self.rest_timer = 0
        else:
            # Keep moving!
            self.state = AgentState.WANDERING
    
    def _rest(self, delta_time: float):
        """Rest at current location - but not for too long"""
        self.rest_timer += delta_time
        
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
        
        # Check collision with park elements
        for element in self.park.elements:
            dist = math.sqrt(
                (pos.x - element.position.x) ** 2 + 
                (pos.y - element.position.y) ** 2
            )
            
            # Slightly smaller collision radius so agents can get closer
            collision_radius = element.size / 2 + 0.4  # Reduced from 0.5
            
            if dist < collision_radius:
                return False
        
        return True
    
    def _get_nearby_element(self):
        """Get nearby park element if any"""
        for element in self.park.elements:
            dist = self.position.distance_to(element.position)
            if dist < 2.5:  # Slightly larger detection range
                return element
        return None


class AgentManager:
    """
    Improved Agent Manager - Agents never disappear AND never freeze!
    """
    
    def __init__(self, park, num_agents: int = 20):
        self.park = park
        self.agents: List[PedestrianAgent] = []
        self.max_spawn_attempts = 50
        
        # Spawn initial agents
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
        
        # Emergency spawn at edge
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
        """Get a safe emergency spawn position (park edges)"""
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
            
            collision_radius = element.size / 2 + 1.5
            
            if dist < collision_radius:
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
            agents_to_add = target_count - current_count
            
            for _ in range(agents_to_add):
                self.spawn_agent()
                
        elif target_count < current_count:
            agents_to_remove = current_count - target_count
            
            for _ in range(agents_to_remove):
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