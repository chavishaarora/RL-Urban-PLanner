"""
Movement Module
Handles movement patterns and pathfinding for agents
"""

import numpy as np
from typing import List, Tuple, Optional, Dict
from enum import Enum
import heapq
from dataclasses import dataclass

try:
    from environment.park import Position, Park
except ImportError:
    from ..environment.park import Position, Park

class MovementPattern(Enum):
    """Types of movement patterns"""
    RANDOM_WALK = "random_walk"
    GOAL_DIRECTED = "goal_directed"
    PATROL = "patrol"
    FOLLOW_PATH = "follow_path"
    FLOCK = "flock"
    AVOID = "avoid"

@dataclass
class Waypoint:
    """A waypoint for path following"""
    position: Position
    wait_time: float = 0.0
    radius: float = 1.0

class MovementController:
    """Controls agent movement with various patterns"""
    
    def __init__(self, park: Park):
        self.park = park
        self.paths_cache: Dict[str, List[Position]] = {}
    
    def random_walk(self, current_pos: Position, 
                    speed: float,
                    delta_time: float,
                    bounds: Optional[Tuple[float, float, float, float]] = None) -> Position:
        """
        Random walk movement pattern
        
        Args:
            current_pos: Current position
            speed: Movement speed (m/s)
            delta_time: Time step
            bounds: Optional (min_x, min_y, max_x, max_y) boundaries
        
        Returns:
            New position
        """
        # Random direction
        angle = np.random.uniform(0, 2 * np.pi)
        dx = np.cos(angle) * speed * delta_time
        dy = np.sin(angle) * speed * delta_time
        
        new_x = current_pos.x + dx
        new_y = current_pos.y + dy
        
        # Apply bounds
        if bounds:
            new_x = np.clip(new_x, bounds[0], bounds[2])
            new_y = np.clip(new_y, bounds[1], bounds[3])
        
        return Position(new_x, new_y, current_pos.z)
    
    def move_toward_goal(self, current_pos: Position,
                        goal_pos: Position,
                        speed: float,
                        delta_time: float,
                        arrival_radius: float = 1.0) -> Tuple[Position, bool]:
        """
        Move directly toward a goal position
        
        Returns:
            Tuple of (new_position, reached_goal)
        """
        # Calculate direction to goal
        dx = goal_pos.x - current_pos.x
        dy = goal_pos.y - current_pos.y
        distance = np.sqrt(dx**2 + dy**2)
        
        # Check if arrived
        if distance <= arrival_radius:
            return current_pos, True
        
        # Normalize direction
        dx /= distance
        dy /= distance
        
        # Move toward goal
        step = min(speed * delta_time, distance)
        new_x = current_pos.x + dx * step
        new_y = current_pos.y + dy * step
        
        return Position(new_x, new_y, current_pos.z), False
    
    def patrol_movement(self, current_pos: Position,
                       waypoints: List[Waypoint],
                       current_waypoint_idx: int,
                       speed: float,
                       delta_time: float) -> Tuple[Position, int]:
        """
        Patrol between waypoints
        
        Returns:
            Tuple of (new_position, current_waypoint_index)
        """
        if not waypoints:
            return current_pos, 0
        
        target_waypoint = waypoints[current_waypoint_idx]
        new_pos, reached = self.move_toward_goal(
            current_pos,
            target_waypoint.position,
            speed,
            delta_time,
            target_waypoint.radius
        )
        
        # Move to next waypoint if reached
        if reached:
            current_waypoint_idx = (current_waypoint_idx + 1) % len(waypoints)
        
        return new_pos, current_waypoint_idx
    
    def flocking_movement(self, agent_pos: Position,
                         agent_vel: np.ndarray,
                         nearby_agents: List[Tuple[Position, np.ndarray]],
                         speed: float,
                         delta_time: float,
                         perception_radius: float = 5.0) -> Tuple[Position, np.ndarray]:
        """
        Flocking behavior (separation, alignment, cohesion)
        
        Args:
            agent_pos: Current agent position
            agent_vel: Current agent velocity
            nearby_agents: List of (position, velocity) for nearby agents
            
        Returns:
            Tuple of (new_position, new_velocity)
        """
        if not nearby_agents:
            # No flocking without neighbors
            return self.random_walk(agent_pos, speed, delta_time), agent_vel
        
        # Initialize forces
        separation = np.array([0.0, 0.0])
        alignment = np.array([0.0, 0.0])
        cohesion = np.array([0.0, 0.0])
        
        for other_pos, other_vel in nearby_agents:
            distance = agent_pos.distance_to(other_pos)
            
            if distance > 0 and distance < perception_radius:
                # Separation: steer away from nearby agents
                diff = np.array([agent_pos.x - other_pos.x, 
                               agent_pos.y - other_pos.y])
                separation += diff / (distance + 0.01)
                
                # Alignment: match velocity with neighbors
                alignment += other_vel
                
                # Cohesion: move toward center of neighbors
                cohesion += np.array([other_pos.x, other_pos.y])
        
        # Average the forces
        num_neighbors = len(nearby_agents)
        if num_neighbors > 0:
            alignment /= num_neighbors
            cohesion = cohesion / num_neighbors - np.array([agent_pos.x, agent_pos.y])
        
        # Weight the forces
        separation *= 1.5  # Separation is most important
        alignment *= 1.0
        cohesion *= 0.5
        
        # Combine forces
        acceleration = separation + alignment + cohesion
        
        # Update velocity
        new_velocity = agent_vel + acceleration * delta_time
        
        # Limit speed
        speed_sq = np.dot(new_velocity, new_velocity)
        if speed_sq > speed * speed:
            new_velocity = new_velocity / np.sqrt(speed_sq) * speed
        
        # Update position
        new_x = agent_pos.x + new_velocity[0] * delta_time
        new_y = agent_pos.y + new_velocity[1] * delta_time
        
        return Position(new_x, new_y, agent_pos.z), new_velocity
    
    def avoid_obstacles(self, current_pos: Position,
                       desired_velocity: np.ndarray,
                       obstacles: List[Position],
                       avoidance_radius: float = 2.0) -> np.ndarray:
        """
        Adjust velocity to avoid obstacles
        
        Returns:
            Adjusted velocity vector
        """
        avoidance_force = np.array([0.0, 0.0])
        
        for obstacle in obstacles:
            distance = current_pos.distance_to(obstacle)
            
            if distance < avoidance_radius and distance > 0:
                # Calculate repulsive force
                diff = np.array([current_pos.x - obstacle.x,
                               current_pos.y - obstacle.y])
                force_magnitude = (avoidance_radius - distance) / avoidance_radius
                avoidance_force += diff / distance * force_magnitude
        
        # Combine with desired velocity
        adjusted_velocity = desired_velocity + avoidance_force * 2.0
        
        return adjusted_velocity
    
    def find_path_astar(self, start: Position, 
                       goal: Position,
                       grid_resolution: int = 20) -> List[Position]:
        """
        Find path using A* algorithm
        
        Returns:
            List of positions forming the path
        """
        # Check cache
        cache_key = f"{start.x:.1f},{start.y:.1f}-{goal.x:.1f},{goal.y:.1f}"
        if cache_key in self.paths_cache:
            return self.paths_cache[cache_key]
        
        # Convert to grid coordinates
        park_size = self.park.size
        
        def pos_to_grid(pos: Position) -> Tuple[int, int]:
            x = int((pos.x + park_size/2) / park_size * grid_resolution)
            y = int((pos.y + park_size/2) / park_size * grid_resolution)
            return max(0, min(grid_resolution-1, x)), max(0, min(grid_resolution-1, y))
        
        def grid_to_pos(x: int, y: int) -> Position:
            world_x = (x + 0.5) / grid_resolution * park_size - park_size/2
            world_y = (y + 0.5) / grid_resolution * park_size - park_size/2
            return Position(world_x, world_y, 0)
        
        start_grid = pos_to_grid(start)
        goal_grid = pos_to_grid(goal)
        
        # A* implementation
        def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> float:
            return abs(a[0] - b[0]) + abs(a[1] - b[1])
        
        # Priority queue: (priority, counter, position, path)
        counter = 0
        frontier = [(0, counter, start_grid, [])]
        visited = set()
        
        while frontier:
            _, _, current, path = heapq.heappop(frontier)
            
            if current == goal_grid:
                # Reconstruct path
                final_path = [start]
                for grid_pos in path:
                    final_path.append(grid_to_pos(grid_pos[0], grid_pos[1]))
                final_path.append(goal)
                
                # Cache the path
                self.paths_cache[cache_key] = final_path
                return final_path
            
            if current in visited:
                continue
            
            visited.add(current)
            
            # Check neighbors
            for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0), 
                          (1, 1), (-1, 1), (1, -1), (-1, -1)]:
                next_x = current[0] + dx
                next_y = current[1] + dy
                
                if (0 <= next_x < grid_resolution and 
                    0 <= next_y < grid_resolution and 
                    (next_x, next_y) not in visited):
                    
                    # Check if walkable (simplified - check for obstacles)
                    pos = grid_to_pos(next_x, next_y)
                    walkable = True
                    
                    # Check collision with elements
                    for element in self.park.elements:
                        if pos.distance_to(element.position) < element.size:
                            walkable = False
                            break
                    
                    if walkable:
                        new_path = path + [(next_x, next_y)]
                        cost = len(new_path) + heuristic((next_x, next_y), goal_grid)
                        counter += 1
                        heapq.heappush(frontier, (cost, counter, (next_x, next_y), new_path))
        
        # No path found - return direct line
        return [start, goal]
    
    def smooth_path(self, path: List[Position], 
                   smoothing_factor: float = 0.5) -> List[Position]:
        """
        Smooth a path using simple averaging
        
        Args:
            path: Original path
            smoothing_factor: How much to smooth (0-1)
            
        Returns:
            Smoothed path
        """
        if len(path) < 3:
            return path
        
        smoothed = [path[0]]  # Keep start
        
        for i in range(1, len(path) - 1):
            prev_pos = path[i - 1]
            curr_pos = path[i]
            next_pos = path[i + 1]
            
            # Average with neighbors
            smooth_x = curr_pos.x * (1 - smoothing_factor) + \
                      (prev_pos.x + next_pos.x) / 2 * smoothing_factor
            smooth_y = curr_pos.y * (1 - smoothing_factor) + \
                      (prev_pos.y + next_pos.y) / 2 * smoothing_factor
            
            smoothed.append(Position(smooth_x, smooth_y, curr_pos.z))
        
        smoothed.append(path[-1])  # Keep end
        
        return smoothed
    
    def calculate_flow_field(self, targets: List[Position],
                           resolution: int = 20) -> np.ndarray:
        """
        Calculate a flow field for efficient crowd movement
        
        Args:
            targets: List of target positions
            resolution: Grid resolution for flow field
            
        Returns:
            2D array of direction vectors
        """
        flow_field = np.zeros((resolution, resolution, 2))
        park_size = self.park.size
        
        for i in range(resolution):
            for j in range(resolution):
                # Convert grid to world position
                world_x = (i + 0.5) / resolution * park_size - park_size/2
                world_y = (j + 0.5) / resolution * park_size - park_size/2
                pos = Position(world_x, world_y, 0)
                
                # Find direction to nearest target
                if targets:
                    min_dist = float('inf')
                    best_dir = np.array([0.0, 0.0])
                    
                    for target in targets:
                        dist = pos.distance_to(target)
                        if dist < min_dist and dist > 0:
                            min_dist = dist
                            dx = target.x - pos.x
                            dy = target.y - pos.y
                            best_dir = np.array([dx, dy]) / dist
                    
                    flow_field[i, j] = best_dir
        
        return flow_field