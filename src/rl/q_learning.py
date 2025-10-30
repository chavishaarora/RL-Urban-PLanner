"""
Q-Learning Implementation Module with TEMPERATURE VARIATION
Core reinforcement learning algorithm for park design optimization
NOW TRAINS ACROSS DIFFERENT TEMPERATURE CONDITIONS
"""

import numpy as np
import pickle
from typing import Tuple, Optional, List, Dict
from collections import deque
import random

try:
    from environment.park import Park, ElementType
    from config import (rl_config, metrics_config, park_config, 
                       get_temperature_description)  # NEW: Import temperature helper
    from rl.replay_buffer import ReplayBuffer
    from rl.state import StateEncoder
    from rl.actions import ActionSpace
except ImportError:
    from ..environment.park import Park, ElementType
    from ..config import (rl_config, metrics_config, park_config,
                         get_temperature_description)
    from .replay_buffer import ReplayBuffer
    from .state import StateEncoder
    from .actions import ActionSpace

class QLearningAgent:
    """Q-Learning agent for park design optimization"""
    
    def __init__(self, 
                 state_size: int = None,
                 action_size: int = None,
                 learning_rate: float = None,
                 discount_factor: float = None,
                 epsilon: float = None):
        
        # Set hyperparameters
        self.state_size = state_size or rl_config.state_encoding_size
        self.action_size = action_size or rl_config.action_space_size
        self.learning_rate = learning_rate or rl_config.learning_rate
        self.discount_factor = discount_factor or rl_config.discount_factor
        self.epsilon = epsilon or rl_config.epsilon_start
        self.epsilon_min = rl_config.epsilon_min
        self.epsilon_decay = rl_config.epsilon_decay
        
        # Initialize Q-table (using dictionary for sparse representation)
        self.q_table = {}
        
        # Experience replay buffer
        self.replay_buffer = ReplayBuffer(rl_config.replay_buffer_size)
        
        # State and action handlers
        self.state_encoder = StateEncoder()
        self.action_space = ActionSpace()
        
        # Training statistics
        self.episode_rewards = []
        self.training_step = 0
        self.best_reward = float('-inf')
        self.best_design = None
    
    def get_q_value(self, state_hash: str, action: int) -> float:
        """Get Q-value for state-action pair"""
        if state_hash not in self.q_table:
            self.q_table[state_hash] = np.zeros(self.action_size)
        return self.q_table[state_hash][action]
    
    def set_q_value(self, state_hash: str, action: int, value: float):
        """Set Q-value for state-action pair"""
        if state_hash not in self.q_table:
            self.q_table[state_hash] = np.zeros(self.action_size)
        self.q_table[state_hash][action] = value
    
    def choose_action(self, park: Park, training: bool = True) -> Optional[Tuple[int, int, ElementType]]:
        """Choose action using epsilon-greedy policy"""
        state_hash = self.state_encoder.encode_state(park)
        
        # Get valid actions (empty positions)
        valid_actions = self.action_space.get_valid_actions(park)
        
        if not valid_actions:
            return None
        
        if training and np.random.random() < self.epsilon:
            # Exploration: random action
            action_idx = random.choice(valid_actions)
        else:
            # Exploitation: best action based on Q-values
            q_values = []
            for action_idx in valid_actions:
                q_value = self.get_q_value(state_hash, action_idx)
                q_values.append((action_idx, q_value))
            
            # Select action with highest Q-value
            action_idx = max(q_values, key=lambda x: x[1])[0]
        
        # Convert action index to grid position and element type
        return self.action_space.index_to_action(action_idx)
    
    def learn(self, 
              state_hash: str,
              action: int,
              reward: float,
              next_state_hash: str,
              done: bool):
        """Update Q-values using Q-learning update rule"""
        current_q = self.get_q_value(state_hash, action)
        
        if done:
            target = reward
        else:
            # Get maximum Q-value for next state
            next_q_values = []
            for a in range(self.action_size):
                next_q_values.append(self.get_q_value(next_state_hash, a))
            max_next_q = max(next_q_values) if next_q_values else 0
            
            target = reward + self.discount_factor * max_next_q
        
        # Q-learning update
        new_q = current_q + self.learning_rate * (target - current_q)
        self.set_q_value(state_hash, action, new_q)
        
        self.training_step += 1
    
    def replay_experience(self, batch_size: int = None):
        """Train on a batch of experiences from replay buffer"""
        batch_size = batch_size or rl_config.batch_size
        
        if len(self.replay_buffer) < batch_size:
            return
        
        batch = self.replay_buffer.sample(batch_size)
        
        for state_hash, action, reward, next_state_hash, done in batch:
            self.learn(state_hash, action, reward, next_state_hash, done)
    
    def decay_epsilon(self):
        """Decay exploration rate"""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
    
    def save_model(self, filepath: str):
        """Save Q-table and parameters to file"""
        model_data = {
            'q_table': self.q_table,
            'epsilon': self.epsilon,
            'episode_rewards': self.episode_rewards,
            'best_reward': self.best_reward,
            'best_design': self.best_design,
            'training_step': self.training_step,
            'hyperparameters': {
                'learning_rate': self.learning_rate,
                'discount_factor': self.discount_factor,
                'state_size': self.state_size,
                'action_size': self.action_size
            }
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
    
    def load_model(self, filepath: str):
        """Load Q-table and parameters from file"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        
        self.q_table = model_data['q_table']
        self.epsilon = model_data['epsilon']
        self.episode_rewards = model_data['episode_rewards']
        self.best_reward = model_data['best_reward']
        self.best_design = model_data['best_design']
        self.training_step = model_data['training_step']
        
        # Update hyperparameters if they differ
        params = model_data['hyperparameters']
        self.learning_rate = params['learning_rate']
        self.discount_factor = params['discount_factor']
        self.state_size = params['state_size']
        self.action_size = params['action_size']
    
    def get_statistics(self) -> Dict:
        """Get training statistics"""
        recent_rewards = self.episode_rewards[-100:] if self.episode_rewards else []
        
        return {
            'total_episodes': len(self.episode_rewards),
            'training_steps': self.training_step,
            'epsilon': self.epsilon,
            'best_reward': self.best_reward,
            'average_reward': np.mean(recent_rewards) if recent_rewards else 0,
            'q_table_size': len(self.q_table),
            'replay_buffer_size': len(self.replay_buffer)
        }


class ParkDesignTrainer:
    """Trainer for park design optimization WITH TEMPERATURE VARIATION"""
    
    def __init__(self, park: Park, agent: QLearningAgent):
        self.park = park
        self.agent = agent
        self.episode_num = 0
        self.current_step = 0
        
        # ========== NEW: TEMPERATURE VARIATION SETTINGS ==========
        self.vary_temperature = True  # Enable temperature variation during training
        self.temp_range = (10.0, 38.0)  # Temperature range to test (cold to hot)
        self.temperature_history = []  # Track temperatures used in training
        # ========== END TEMPERATURE SETTINGS ==========
        
        # Import metrics calculators
        try:
            from metrics.comfort import ComfortCalculator
            from metrics.coverage import CoverageCalculator
            from metrics.utilization import UtilizationCalculator
            from metrics.distribution import DistributionCalculator
        except ImportError:
            from ..metrics.comfort import ComfortCalculator
            from ..metrics.coverage import CoverageCalculator
            from ..metrics.utilization import UtilizationCalculator
            from ..metrics.distribution import DistributionCalculator
        
        self.comfort_calc = ComfortCalculator(park)
        self.coverage_calc = CoverageCalculator(park)
        self.utilization_calc = UtilizationCalculator(park)
        self.distribution_calc = DistributionCalculator(park)
    
    def calculate_reward(self) -> float:
        """Calculate reward based on park metrics"""
        # Get individual metrics
        comfort = self.comfort_calc.calculate_total_comfort()
        utilization = self.utilization_calc.calculate_utilization()
        shade_coverage = self.coverage_calc.calculate_shade_coverage()
        light_coverage = self.coverage_calc.calculate_light_coverage()
        distribution = self.distribution_calc.calculate_distribution_score()
        
        # ========== NEW: THERMAL COMFORT ==========
        thermal_comfort = self.comfort_calc.calculate_thermal_comfort_score()
        # ========== END THERMAL COMFORT ==========
        
        # Apply weights from config (these are auto-adjusted by temperature)
        weights = metrics_config.reward_weights
        
        reward = (
            comfort * weights['comfort'] +
            utilization * weights['utilization'] +
            shade_coverage * weights['shade_coverage'] +
            light_coverage * weights['light_coverage'] +
            distribution * weights['distribution'] +
            thermal_comfort * weights.get('thermal_comfort', 0)  # NEW
        )
        
        # Add penalty for too many elements
        element_count = len(self.park.elements)
        max_elements = self.park.grid_size * self.park.grid_size
        if element_count > max_elements * 0.8:
            excess = element_count - max_elements * 0.8
            reward += excess * weights['element_penalty']
        
        return reward
    
    def train_episode(self, max_steps: int = None) -> float:
        """Train for one episode WITH TEMPERATURE VARIATION"""
        max_steps = max_steps or rl_config.max_steps_per_episode
        
        # ========== NEW: VARY TEMPERATURE EACH EPISODE ==========
        if self.vary_temperature:
            # Sample temperature from range with bias toward extremes and comfortable
            temp_samples = [
                random.uniform(10, 15),   # Cold
                random.uniform(18, 26),   # Comfortable (more common)
                random.uniform(18, 26),   # Comfortable (duplicate for higher probability)
                random.uniform(30, 38),   # Hot
            ]
            temperature = random.choice(temp_samples)
            self.park.set_temperature(temperature)
            self.temperature_history.append(temperature)
            
            # Log temperature every 10 episodes
            if self.episode_num % 10 == 0:
                try:
                    temp_desc = get_temperature_description(temperature)
                    print(f"  🌡️ Temperature: {temperature:.1f}°C ({temp_desc})")
                except:
                    print(f"  🌡️ Temperature: {temperature:.1f}°C")
        # ========== END TEMPERATURE VARIATION ==========
        
        # Reset park
        self.park.clear()
        self.current_step = 0
        episode_reward = 0
        
        # Store initial state
        state_hash = self.agent.state_encoder.encode_state(self.park)
        
        for step in range(max_steps):
            # Choose action
            action_result = self.agent.choose_action(self.park, training=True)
            
            if action_result is None:
                # No valid actions available
                break
            
            grid_x, grid_y, element_type = action_result
            action_idx = self.agent.action_space.action_to_index(grid_x, grid_y, element_type)
            
            # Execute action
            element = self.park.add_element(element_type, grid_x, grid_y)
            
            # Calculate reward
            step_reward = self.calculate_reward()
            episode_reward += step_reward
            
            # Get next state
            next_state_hash = self.agent.state_encoder.encode_state(self.park)
            
            # Check if episode is done
            max_elements = self.park.grid_size * self.park.grid_size
            done = (step == max_steps - 1) or (len(self.park.elements) >= max_elements)
            
            # Store experience
            self.agent.replay_buffer.add(
                state_hash, action_idx, step_reward, next_state_hash, done
            )
            
            # Learn from experience
            self.agent.learn(state_hash, action_idx, step_reward, next_state_hash, done)
            
            # Update state
            state_hash = next_state_hash
            self.current_step += 1
            
            if done:
                break
        
        # Replay experiences
        self.agent.replay_experience()
        
        # Update agent statistics
        self.agent.episode_rewards.append(episode_reward)
        
        # Check if this is the best design
        if episode_reward > self.agent.best_reward:
            self.agent.best_reward = episode_reward
            self.agent.best_design = self.park.to_dict()
        
        # Decay epsilon
        self.agent.decay_epsilon()
        
        self.episode_num += 1
        
        return episode_reward
    
    def train(self, num_episodes: int = None, save_interval: int = 10) -> List[float]:
        """Train for multiple episodes"""
        num_episodes = num_episodes or rl_config.episodes
        rewards = []
        
        print(f"\n{'='*60}")
        print(f"Starting training with TEMPERATURE VARIATION")
        print(f"Temperature range: {self.temp_range[0]:.1f}°C - {self.temp_range[1]:.1f}°C")
        print(f"{'='*60}\n")
        
        for episode in range(num_episodes):
            reward = self.train_episode()
            rewards.append(reward)
            
            # Save model periodically
            if (episode + 1) % save_interval == 0:
                self.agent.save_model(f'data/models/q_table_episode_{episode+1}.pkl')
            
            # Print progress
            if (episode + 1) % 10 == 0:
                recent_rewards = rewards[-10:]
                recent_temps = self.temperature_history[-10:] if self.temperature_history else []
                avg_temp = np.mean(recent_temps) if recent_temps else 0
                
                print(f"Episode {episode+1}/{num_episodes} - "
                      f"Reward: {reward:.2f} - "
                      f"Avg: {np.mean(recent_rewards):.2f} - "
                      f"Best: {self.agent.best_reward:.2f} - "
                      f"ε: {self.agent.epsilon:.3f} - "
                      f"Avg Temp: {avg_temp:.1f}°C")
        
        # ========== NEW: PRINT TEMPERATURE STATISTICS ==========
        if self.temperature_history:
            print(f"\n{'='*60}")
            print(f"Temperature Training Statistics:")
            print(f"  Min: {min(self.temperature_history):.1f}°C")
            print(f"  Max: {max(self.temperature_history):.1f}°C")
            print(f"  Mean: {np.mean(self.temperature_history):.1f}°C")
            print(f"  Std Dev: {np.std(self.temperature_history):.1f}°C")
            print(f"{'='*60}\n")
        # ========== END TEMPERATURE STATISTICS ==========
        
        return rewards
    
    def test_random_baseline(self, num_trials: int = 100) -> Tuple[float, float]:
        """Test random placement baseline"""
        rewards = []
        
        allowed_types = [
            ElementType.BENCH,
            ElementType.TREE,
            ElementType.FOUNTAIN,
            ElementType.STREET_LAMP
        ]
        
        for _ in range(num_trials):
            self.park.clear()
            
            # Random number of elements
            num_elements = np.random.randint(3, self.park.grid_size * self.park.grid_size)
            
            for _ in range(num_elements):
                # Random element type and position
                element_type = random.choice(allowed_types)
                grid_x = np.random.randint(0, self.park.grid_size)
                grid_y = np.random.randint(0, self.park.grid_size)
                
                self.park.add_element(element_type, grid_x, grid_y)
            
            reward = self.calculate_reward()
            rewards.append(reward)
        
        return np.mean(rewards), np.std(rewards)
    
    # ========== NEW: TEMPERATURE-SPECIFIC TESTING ==========
    def test_at_temperature(self, temperature: float, num_trials: int = 10) -> Dict:
        """Test the best design at a specific temperature"""
        if not self.agent.best_design:
            return {'error': 'No best design available'}
        
        # Set temperature
        original_temp = self.park.get_temperature()
        self.park.set_temperature(temperature)
        
        # Apply best design
        self.park.from_dict(self.agent.best_design)
        
        # Calculate metrics
        rewards = []
        for _ in range(num_trials):
            reward = self.calculate_reward()
            rewards.append(reward)
        
        results = {
            'temperature': temperature,
            'avg_reward': np.mean(rewards),
            'std_reward': np.std(rewards),
            'comfort': self.comfort_calc.calculate_total_comfort(),
            'thermal_comfort': self.comfort_calc.calculate_thermal_comfort_score(),
            'shade_coverage': self.coverage_calc.calculate_shade_coverage()
        }
        
        # Restore original temperature
        self.park.set_temperature(original_temp)
        
        return results
    
    def test_across_temperatures(self, temp_range: Tuple[float, float] = None, 
                                 num_samples: int = 5) -> List[Dict]:
        """Test the best design across a range of temperatures"""
        if temp_range is None:
            temp_range = self.temp_range
        
        temperatures = np.linspace(temp_range[0], temp_range[1], num_samples)
        results = []
        
        print(f"\nTesting best design across temperatures:")
        for temp in temperatures:
            result = self.test_at_temperature(temp)
            results.append(result)
            try:
                temp_desc = get_temperature_description(temp)
                print(f"  {temp:.1f}°C ({temp_desc}): Reward={result['avg_reward']:.2f}, "
                      f"Comfort={result['comfort']:.2f}, Shade={result['shade_coverage']:.2f}")
            except:
                print(f"  {temp:.1f}°C: Reward={result['avg_reward']:.2f}")
        
        return results
    # ========== END TEMPERATURE-SPECIFIC TESTING ==========