"""
Replay Buffer Module
Experience replay buffer for Q-Learning
"""

import random
from collections import deque
from typing import List, Tuple, Any


class ReplayBuffer:
    """Experience replay buffer for storing and sampling transitions"""
    
    def __init__(self, capacity: int = 10000):
        """
        Initialize replay buffer
        
        Args:
            capacity: Maximum number of transitions to store
        """
        self.buffer = deque(maxlen=capacity)
        self.capacity = capacity
    
    def add(self, 
            state: Any,
            action: int,
            reward: float,
            next_state: Any,
            done: bool):
        """
        Add a transition to the buffer
        
        Args:
            state: Current state (state hash string)
            action: Action taken
            reward: Reward received
            next_state: Next state (state hash string)
            done: Whether episode ended
        """
        transition = (state, action, reward, next_state, done)
        self.buffer.append(transition)
    
    def sample(self, batch_size: int) -> List[Tuple]:
        """
        Sample a random batch of transitions
        
        Args:
            batch_size: Number of transitions to sample
            
        Returns:
            List of transitions
        """
        batch_size = min(batch_size, len(self.buffer))
        return random.sample(self.buffer, batch_size)
    
    def __len__(self) -> int:
        """Get current size of buffer"""
        return len(self.buffer)
    
    def clear(self):
        """Clear all transitions from buffer"""
        self.buffer.clear()
    
    def is_full(self) -> bool:
        """Check if buffer is at capacity"""
        return len(self.buffer) >= self.capacity
    
    def get_statistics(self) -> dict:
        """Get buffer statistics"""
        if not self.buffer:
            return {
                'size': 0,
                'capacity': self.capacity,
                'utilization': 0.0
            }
        
        return {
            'size': len(self.buffer),
            'capacity': self.capacity,
            'utilization': len(self.buffer) / self.capacity
        }