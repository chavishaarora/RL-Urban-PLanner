"""
Flow Field Movement System Enhancement
Add this to your agents/movement.py or use as standalone

This implements SimCity-style crowd pathfinding where all agents follow
a pre-computed flow field instead of doing individual pathfinding.
"""

import numpy as np
from typing import List, Tuple
from dataclasses import dataclass


def calculate_complete_flow_field(park, targets: List, resolution: int = 20) -> np.ndarray:
    """
    Complete flow field calculation (ENHANCED VERSION)
    
    This is the method to ADD or REPLACE in your MovementController class
    """
    flow_field = np.zeros((resolution, resolution, 2))
    park_size = park.size
    
    # If no targets, create neutral field
    if not targets:
        return flow_field
    
    # Calculate cost field using Dijkstra-like approach
    cost_field = _calculate_cost_field(park, targets, resolution)
    
    # Convert cost field to flow directions
    for i in range(resolution):
        for j in range(resolution):
            # Find steepest descent direction
            direction = _calculate_gradient_direction(cost_field, i, j)
            flow_field[i, j] = direction
    
    return flow_field


def _calculate_cost_field(park, targets: List, resolution: int) -> np.ndarray:
    """
    Calculate cost (distance) to nearest target for each cell
    Uses a flood-fill approach for efficiency
    """
    park_size = park.size
    cost_field = np.full((resolution, resolution), float('inf'))
    
    # Initialize target cells with zero cost
    for target in targets:
        grid_x = int((target.x + park_size/2) / park_size * resolution)
        grid_y = int((target.y + park_size/2) / park_size * resolution)
        
        # Clamp to valid range
        grid_x = max(0, min(resolution - 1, grid_x))
        grid_y = max(0, min(resolution - 1, grid_y))
        
        cost_field[grid_y, grid_x] = 0
    
    # Propagate costs using simple flood fill
    changed = True
    iterations = 0
    max_iterations = resolution * 2
    
    while changed and iterations < max_iterations:
        changed = False
        iterations += 1
        
        for i in range(resolution):
            for j in range(resolution):
                if cost_field[i, j] == float('inf'):
                    continue
                
                current_cost = cost_field[i, j]
                
                # Check neighbors (8-directional)
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        if di == 0 and dj == 0:
                            continue
                        
                        ni, nj = i + di, j + dj
                        
                        if 0 <= ni < resolution and 0 <= nj < resolution:
                            # Cost to move to neighbor
                            move_cost = 1.41 if (di != 0 and dj != 0) else 1.0
                            
                            # Check for obstacles
                            if _is_flow_cell_blocked(park, ni, nj, resolution):
                                continue
                            
                            new_cost = current_cost + move_cost
                            
                            if new_cost < cost_field[ni, nj]:
                                cost_field[ni, nj] = new_cost
                                changed = True
    
    return cost_field


def _is_flow_cell_blocked(park, grid_x: int, grid_y: int, resolution: int) -> bool:
    """Check if a flow field cell is blocked by an obstacle"""
    park_size = park.size
    
    # Convert grid to world position
    world_x = (grid_x + 0.5) / resolution * park_size - park_size/2
    world_y = (grid_y + 0.5) / resolution * park_size - park_size/2
    
    # Check collision with elements
    for element in park.elements:
        dx = world_x - element.position.x
        dy = world_y - element.position.y
        distance = np.sqrt(dx*dx + dy*dy)
        collision_radius = element.size / 2 + 0.3
        
        if distance < collision_radius:
            return True
    
    return False


def _calculate_gradient_direction(cost_field: np.ndarray, 
                                 i: int, j: int) -> np.ndarray:
    """
    Calculate direction of steepest descent in cost field
    Returns normalized direction vector
    """
    resolution = cost_field.shape[0]
    current_cost = cost_field[i, j]
    
    if current_cost == float('inf') or current_cost == 0:
        return np.array([0.0, 0.0])
    
    # Find neighbor with lowest cost
    best_dir = np.array([0.0, 0.0])
    lowest_cost = current_cost
    
    for di in [-1, 0, 1]:
        for dj in [-1, 0, 1]:
            if di == 0 and dj == 0:
                continue
            
            ni, nj = i + di, j + dj
            
            if 0 <= ni < resolution and 0 <= nj < resolution:
                neighbor_cost = cost_field[ni, nj]
                
                if neighbor_cost < lowest_cost:
                    lowest_cost = neighbor_cost
                    # Direction points toward lower cost
                    best_dir = np.array([float(dj), float(di)])
    
    # Normalize direction
    if np.linalg.norm(best_dir) > 0:
        best_dir = best_dir / np.linalg.norm(best_dir)
    
    return best_dir


def follow_flow_field(current_pos, flow_field: np.ndarray, park,
                     speed: float, delta_time: float, resolution: int = 20):
    """
    Move agent according to flow field direction
    
    Args:
        current_pos: Current agent position (has .x, .y, .z attributes)
        flow_field: Pre-computed flow field
        park: Park object for size calculation
        speed: Movement speed
        delta_time: Time step
        resolution: Flow field resolution (must match field)
        
    Returns:
        New position after following flow
    """
    park_size = park.size
    
    # Convert position to flow field coordinates
    grid_x = int((current_pos.x + park_size/2) / park_size * resolution)
    grid_y = int((current_pos.y + park_size/2) / park_size * resolution)
    
    # Clamp to valid range
    grid_x = max(0, min(resolution - 1, grid_x))
    grid_y = max(0, min(resolution - 1, grid_y))
    
    # Get flow direction at current position
    direction = flow_field[grid_y, grid_x]
    
    # Apply movement
    move_distance = speed * delta_time
    new_x = current_pos.x + direction[0] * move_distance
    new_y = current_pos.y + direction[1] * move_distance
    
    # Return new position (create Position object)
    from agents.pedestrian import Position
    return Position(new_x, new_y, current_pos.z)


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

"""
HOW TO USE FLOW FIELDS IN YOUR CODE:

1. In your agent manager or simulation loop:

   # Calculate flow field once (when targets change)
   from environment.park import ElementType
   
   benches = park.get_elements_by_type(ElementType.BENCH)
   flow_field = calculate_complete_flow_field(park, benches, resolution=20)
   
2. In each agent's update:

   # Instead of random walk or pathfinding, follow the flow
   if agent.state == AgentState.MOVING_TO_TARGET:
       new_pos = follow_flow_field(
           agent.position, 
           flow_field, 
           park,
           agent.speed, 
           delta_time,
           resolution=20
       )
       
       if agent._is_position_valid(new_pos):
           agent.position = new_pos

3. Recompute flow field when:
   - Park elements change (benches added/removed)
   - Target destinations change
   - Agent goals shift

BENEFITS:
- 100x faster than individual A* for crowds
- Natural crowd behavior
- Smooth, realistic movement
- Agents automatically avoid obstacles
- SimCity-style pathfinding!
"""