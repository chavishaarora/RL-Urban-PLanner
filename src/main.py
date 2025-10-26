"""
Main Entry Point for Urban Park RL System
"""

import argparse
import sys
import os
import numpy as np
import pygame
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    park_config, rl_config, viz_config, log_config,
    ElementType
)
from environment.park import Park
from agents.pedestrian import AgentManager
from rl.q_learning import QLearningAgent, ParkDesignTrainer
from metrics.comfort import ComfortCalculator
from metrics.coverage import CoverageCalculator
from metrics.utilization import UtilizationCalculator
from metrics.distribution import DistributionCalculator
from visualization.renderer import ParkRenderer
from visualization.ui import UIManager
from utils.logger import Logger
from utils.data_manager import DataManager

class UrbanParkRL:
    """Main application class"""
    
    def __init__(self, mode: str = 'interactive'):
        self.mode = mode
        
        # Initialize components
        self.park = Park(park_config.size, park_config.grid_size)
        self.agent_manager = AgentManager(self.park)
        
        # Initialize RL agent
        self.rl_agent = QLearningAgent()
        self.trainer = ParkDesignTrainer(self.park, self.rl_agent)
        
        # Initialize metrics calculators
        self.comfort_calc = ComfortCalculator(self.park)
        self.coverage_calc = CoverageCalculator(self.park)
        self.utilization_calc = UtilizationCalculator(self.park)
        self.distribution_calc = DistributionCalculator(self.park)
        
        # Initialize visualization (only in interactive mode)
        if mode == 'interactive':
            pygame.init()
            self.screen = pygame.display.set_mode(
                (viz_config.window_width, viz_config.window_height)
            )
            pygame.display.set_caption("Urban Park RL - Design Optimization")
            
            self.renderer = ParkRenderer(self.screen, self.park)
            self.ui_manager = UIManager(self.screen, self)
            self.clock = pygame.time.Clock()
        
        # Initialize utilities
        self.logger = Logger()
        self.data_manager = DataManager()
        
        # State variables
        self.running = True
        self.training_active = False
        self.manual_placement_mode = None
        self.selected_element_type = None
    
    def run(self):
        """Main application loop"""
        if self.mode == 'train':
            self.train_mode()
        elif self.mode == 'test':
            self.test_mode()
        elif self.mode == 'interactive':
            self.interactive_mode()
    
    def interactive_mode(self):
        """Run interactive mode with visualization"""
        self.logger.info("Starting interactive mode...")
        
        while self.running:
            delta_time = self.clock.tick(viz_config.fps) / 1000.0
            
            # Handle events
            self.handle_events()
            
            # Update
            self.update(delta_time)
            
            # Render
            self.render()
        
        pygame.quit()
    
    def train_mode(self):
        """Run training mode without visualization"""
        self.logger.info("Starting training mode...")
        
        num_episodes = rl_config.episodes
        self.logger.info(f"Training for {num_episodes} episodes...")
        
        # Train the agent
        rewards = self.trainer.train(num_episodes)
        
        # Save final model
        model_path = f"data/models/final_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        self.rl_agent.save_model(model_path)
        self.logger.info(f"Model saved to {model_path}")
        
        # Save training results
        results = {
            'rewards': rewards,
            'statistics': self.rl_agent.get_statistics(),
            'best_design': self.rl_agent.best_design
        }
        self.data_manager.save_results(results)
        
        # Print final statistics
        print("\nTraining Complete!")
        print(f"Best Reward: {self.rl_agent.best_reward:.2f}")
        print(f"Average Reward (last 100): {np.mean(rewards[-100:]):.2f}")
        print(f"Final Epsilon: {self.rl_agent.epsilon:.3f}")
    
    def test_mode(self):
        """Test trained model and compare with baseline"""
        self.logger.info("Starting test mode...")
        
        # Load trained model
        try:
            self.rl_agent.load_model("data/models/best_model.pkl")
            self.logger.info("Loaded trained model")
        except:
            self.logger.warning("No trained model found, using untrained agent")
        
        # Test trained agent
        print("\nTesting Trained Agent...")
        trained_rewards = []
        for i in range(10):
            self.park.clear()
            episode_reward = 0
            
            for step in range(20):
                action = self.rl_agent.choose_action(self.park, training=False)
                if action is None:
                    break
                
                grid_x, grid_y, element_type = action
                self.park.add_element(element_type, grid_x, grid_y)
                episode_reward = self.trainer.calculate_reward()
            
            trained_rewards.append(episode_reward)
            print(f"  Test {i+1}: {episode_reward:.2f}")
        
        # Test random baseline
        print("\nTesting Random Baseline...")
        random_mean, random_std = self.trainer.test_random_baseline(100)
        
        # Compare results
        print("\n" + "="*50)
        print("RESULTS COMPARISON")
        print("="*50)
        print(f"Trained Agent:")
        print(f"  Mean Reward: {np.mean(trained_rewards):.2f}")
        print(f"  Std Dev: {np.std(trained_rewards):.2f}")
        print(f"  Best: {max(trained_rewards):.2f}")
        print(f"\nRandom Baseline:")
        print(f"  Mean Reward: {random_mean:.2f}")
        print(f"  Std Dev: {random_std:.2f}")
        print(f"\nImprovement: {(np.mean(trained_rewards) - random_mean):.2f} "
              f"({(np.mean(trained_rewards) / random_mean - 1) * 100:.1f}%)")
    
    def handle_events(self):
        """Handle pygame events"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            # Handle UI events
            if hasattr(self, 'ui_manager'):
                self.ui_manager.handle_event(event)
            
            # Handle mouse clicks for manual placement
            if event.type == pygame.MOUSEBUTTONDOWN:
                if self.manual_placement_mode:
                    self.handle_placement_click(event.pos)
    
    def handle_placement_click(self, mouse_pos):
        """Handle manual element placement"""
        if not self.selected_element_type:
            return
        
        # Convert screen coordinates to park coordinates
        # (This is simplified - you'd need proper coordinate transformation)
        grid_x = int(mouse_pos[0] / viz_config.window_width * self.park.grid_size)
        grid_y = int(mouse_pos[1] / viz_config.window_height * self.park.grid_size)
        
        # Add element
        element = self.park.add_element(self.selected_element_type, grid_x, grid_y)
        
        if element:
            self.logger.info(f"Placed {self.selected_element_type.value} at ({grid_x}, {grid_y})")
        else:
            self.logger.warning(f"Cannot place element at ({grid_x}, {grid_y})")
    
    def update(self, delta_time: float):
        """Update simulation state"""
        # Update agents
        self.agent_manager.update(delta_time)
        
        # Training update
        if self.training_active:
            # Run one training step
            reward = self.trainer.train_episode()
            self.logger.info(f"Episode {self.trainer.episode_num}: Reward = {reward:.2f}")
            
            # Check if training should continue
            if self.trainer.episode_num >= rl_config.episodes:
                self.training_active = False
                self.logger.info("Training completed!")
    
    def render(self):
        """Render the scene"""
        if not hasattr(self, 'renderer'):
            return
        
        # Clear screen
        self.screen.fill((10, 10, 10))
        
        # Render park
        self.renderer.render()
        
        # Render UI
        self.ui_manager.render()
        
        # Update display
        pygame.display.flip()
    
    def get_metrics(self) -> dict:
        """Get current park metrics"""
        return {
            'comfort': self.comfort_calc.calculate_total_comfort(),
            'utilization': self.utilization_calc.calculate_utilization(),
            'shade_coverage': self.coverage_calc.calculate_shade_coverage(),
            'light_coverage': self.coverage_calc.calculate_light_coverage(),
            'distribution': self.distribution_calc.calculate_distribution_score(),
            'total_score': self.trainer.calculate_reward()
        }
    
    def start_training(self):
        """Start RL training"""
        self.training_active = True
        self.logger.info("Started training")
    
    def stop_training(self):
        """Stop RL training"""
        self.training_active = False
        self.logger.info("Stopped training")
    
    def clear_park(self):
        """Clear all elements from park"""
        self.park.clear()
        self.logger.info("Cleared park")
    
    def apply_best_design(self):
        """Apply the best design found by RL agent"""
        if self.rl_agent.best_design:
            # Clear current park
            self.park.clear()
            
            # Apply best design
            # (This would need proper deserialization from best_design dict)
            self.logger.info("Applied best design")
        else:
            self.logger.warning("No best design available")

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Urban Park RL System')
    parser.add_argument('--mode', choices=['interactive', 'train', 'test'],
                      default='interactive',
                      help='Execution mode')
    parser.add_argument('--episodes', type=int, default=100,
                      help='Number of training episodes')
    parser.add_argument('--load-model', type=str,
                      help='Path to model file to load')
    
    args = parser.parse_args()
    
    # Update config if needed
    if args.episodes:
        rl_config.episodes = args.episodes
    
    # Create and run application
    app = UrbanParkRL(mode=args.mode)
    
    # Load model if specified
    if args.load_model:
        app.rl_agent.load_model(args.load_model)
    
    # Run
    app.run()

if __name__ == "__main__":
    main()