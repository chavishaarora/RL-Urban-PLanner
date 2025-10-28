"""
Pedestrian Agent Module
Simulates pedestrian agents moving through the park
"""

import numpy as np
from typing import List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import random

try:
    from environment.park import Park, Position
    from config import agent_config, ElementType
except ImportError:
    # Fallback for standalone testing
    @dataclass
    class Position:
        x: float
        y: float
        z: float = 0.0
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"


class AgentState(Enum):
    """Possible states for pedestrian agents"""
    WANDERING = "wandering"
    MOVING_TO_TARGET = "moving_to_target"
    RESTING = "resting"
    OBSERVING = "observing"


class PedestrianAgent:
    """Individual pedestrian agent"""
    
    def __init__(self, agent_id: int, spawn_position: Position, park: Park):
        self.id = agent_id
        self.position = spawn_position
        self.park = park
        
        # Movement properties
        try:
            self.speed = random.uniform(agent_config.min_speed, agent_config.max_speed)
        except:
            self.speed = random.uniform(1.0, 2.0)
        
        self.velocity = np.array([0.0, 0.0])
        self.direction = random.uniform(0, 2 * np.pi)
        
        # State
        self.state = AgentState.WANDERING
        self.target_position: Optional[Position] = None
        self.rest_time_remaining = 0.0
        
        # Behavior parameters
        self.wander_strength = 0.5
        self.attraction_radius = 5.0
        self.avoidance_radius = 1.5
        
        # Statistics
        self.total_distance_traveled = 0.0
        self.time_resting = 0.0
        self.benches_used = 0
    
    def update(self, delta_time: float):
        """Update agent state and position"""
        if self.state == AgentState.RESTING:
            self.rest_time_remaining -= delta_time
            if self.rest_time_remaining <= 0:
                self.state = AgentState.WANDERING
        
        elif self.state == AgentState.MOVING_TO_TARGET:
            if self.target_position:
                self._move_toward_target(delta_time)
            else:
                self.state = AgentState.WANDERING
        
        elif self.state == AgentState.WANDERING:
            self._wander(delta_time)
            self._check_attractions()
        
        # Update statistics
        distance = np.linalg.norm(self.velocity) * delta_time
        self.total_distance_traveled += distance
    
    def _wander(self, delta_time: float):
        """Random wandering behavior"""
        # Random direction change
        self.direction += random.uniform(-0.5, 0.5) * self.wander_strength
        
        # Calculate velocity
        self.velocity = np.array([
            np.cos(self.direction) * self.speed,
            np.sin(self.direction) * self.speed
        ])
        
        # Update position
        new_x = self.position.x + self.velocity[0] * delta_time
        new_y = self.position.y + self.velocity[1] * delta_time
        new_position = Position(new_x, new_y, 0)
        
        # Check bounds
        if self.park.is_position_valid(new_position):
            self.position = new_position
        else:
            # Bounce off boundary
            self.direction += np.pi
    
    def _move_toward_target(self, delta_time: float):
        """Move toward target position"""
        if not self.target_position:
            return
        
        # Calculate direction to target
        dx = self.target_position.x - self.position.x
        dy = self.target_position.y - self.position.y
        distance = np.sqrt(dx**2 + dy**2)
        
        # Check if reached
        if distance < 0.5:
            self.state = AgentState.WANDERING
            self.target_position = None
            return
        
        # Move toward target
        self.velocity = np.array([dx / distance * self.speed,
                                 dy / distance * self.speed])
        
        self.position.x += self.velocity[0] * delta_time
        self.position.y += self.velocity[1] * delta_time
    
    def _check_attractions(self):
        """Check for nearby attractions (benches, fountains)"""
        # Find nearby benches
        nearby_elements = self.park.get_elements_near(
            self.position, 
            self.attraction_radius
        )
        
        for element in nearby_elements:
            if element.element_type == ElementType.BENCH:
                # Chance to sit on bench
                if random.random() < 0.1:  # 10% chance
                    self._sit_on_bench(element)
                    break
    
    def _sit_on_bench(self, bench_element):
        """Sit on a bench"""
        self.state = AgentState.RESTING
        self.rest_time_remaining = random.uniform(5.0, 15.0)
        self.position = bench_element.position
        self.velocity = np.array([0.0, 0.0])
        self.benches_used += 1
        self.time_resting += self.rest_time_remaining
    
    def set_target(self, target: Position):
        """Set a target position to move toward"""
        self.target_position = target
        self.state = AgentState.MOVING_TO_TARGET
    
    def get_comfort_score(self) -> float:
        """Calculate agent's current comfort level"""
        comfort = 0.5  # Base comfort
        
        # Check for nearby amenities
        nearby = self.park.get_elements_near(self.position, 5.0)
        
        has_shade = any(e.element_type == ElementType.TREE for e in nearby)
        has_water = any(e.element_type == ElementType.FOUNTAIN for e in nearby)
        has_light = any(e.element_type == ElementType.STREET_LAMP for e in nearby)
        
        if has_shade:
            comfort += 0.2
        if has_water:
            comfort += 0.2
        if has_light:
            comfort += 0.1
        
        return min(1.0, comfort)


class AgentManager:
    """Manages all pedestrian agents in the park"""
    
    def __init__(self, park: Park, num_agents: int = 10):
        self.park = park
        self.agents: List[PedestrianAgent] = []
        self.agent_id_counter = 0
        
        # Spawn initial agents
        for _ in range(num_agents):
            self.spawn_agent()
    
    def spawn_agent(self) -> PedestrianAgent:
        """Spawn a new agent at a random position"""
        # Random spawn position
        half_size = self.park.size / 2
        spawn_x = random.uniform(-half_size * 0.8, half_size * 0.8)
        spawn_y = random.uniform(-half_size * 0.8, half_size * 0.8)
        spawn_pos = Position(spawn_x, spawn_y, 0)
        
        agent = PedestrianAgent(self.agent_id_counter, spawn_pos, self.park)
        self.agent_id_counter += 1
        self.agents.append(agent)
        
        return agent
    
    def remove_agent(self, agent: PedestrianAgent):
        """Remove an agent"""
        if agent in self.agents:
            self.agents.remove(agent)
    
    def update(self, delta_time: float):
        """Update all agents"""
        for agent in self.agents:
            agent.update(delta_time)
    
    def get_average_comfort(self) -> float:
        """Get average comfort across all agents"""
        if not self.agents:
            return 0.0
        
        total_comfort = sum(agent.get_comfort_score() for agent in self.agents)
        return total_comfort / len(self.agents)
    
    def get_agent_statistics(self) -> dict:
        """Get statistics about agents"""
        if not self.agents:
            return {
                'num_agents': 0,
                'average_speed': 0.0,
                'total_distance': 0.0,
                'average_comfort': 0.0,
                'resting_agents': 0
            }
        
        return {
            'num_agents': len(self.agents),
            'average_speed': np.mean([a.speed for a in self.agents]),
            'total_distance': sum(a.total_distance_traveled for a in self.agents),
            'average_comfort': self.get_average_comfort(),
            'resting_agents': sum(1 for a in self.agents if a.state == AgentState.RESTING)
        }