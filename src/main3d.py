"""
Professional 3D Urban Park RL Application
Integrates OpenGL 3D rendering with RL training
"""

import sys
import os
import pygame
from pygame.locals import *
from OpenGL.GL import *
import numpy as np

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from config import park_config, rl_config, ElementType
from environment.park import Park
from agents.pedestrian import AgentManager
from rl.q_learning import QLearningAgent, ParkDesignTrainer
from metrics.comfort import ComfortCalculator
from metrics.coverage import CoverageCalculator
from metrics.utilization import UtilizationCalculator
from metrics.distribution import DistributionCalculator
from utils.logger import Logger
from utils.data_manager import DataManager

# Import our new 3D components
sys.path.insert(0, os.path.dirname(__file__))
from visualization.renderer3d import Renderer3D
from visualization.ui3d import ProfessionalUI


class UrbanParkRL3D:
    """Main 3D Application"""
    
    def __init__(self):
        print("Initializing Urban Park RL 3D...")
        
        # Initialize park
        self.park = Park(size=30.0, grid_size=3)
        self.agent_manager = AgentManager(self.park, num_agents=10)
        
        # Initialize RL
        self.rl_agent = QLearningAgent()
        self.trainer = ParkDesignTrainer(self.park, self.rl_agent)
        
        # Initialize metrics
        self.comfort_calc = ComfortCalculator(self.park)
        self.coverage_calc = CoverageCalculator(self.park)
        self.utilization_calc = UtilizationCalculator(self.park)
        self.distribution_calc = DistributionCalculator(self.park)
        
        # Initialize 3D renderer
        self.renderer = Renderer3D(self.park, width=1400, height=900)
        
        # Initialize UI overlay
        # Create a separate pygame surface for UI
        self.ui_surface = pygame.Surface((1400, 900), pygame.SRCALPHA)
        self.ui = ProfessionalUI(self.ui_surface, self)
        
        # Utilities
        self.logger = Logger()
        self.data_manager = DataManager()
        
        # State
        self.running = True
        self.training_active = False
        self.training_episodes_remaining = 0
        self.clock = pygame.time.Clock()
        
        # Mouse state
        self.mouse_dragging = False
        self.last_mouse_pos = None
        self.mouse_button = None
        
        print("Initialization complete!")
        print("\nControls:")
        print("  Left Mouse - Rotate camera")
        print("  Right Mouse - Pan camera")
        print("  Mouse Wheel - Zoom")
        print("  ESC - Exit")
    
    def run(self):
        """Main application loop"""
        while self.running:
            delta_time = self.clock.tick(60) / 1000.0
            
            self.handle_events()
            self.update(delta_time)
            self.render()
        
        pygame.quit()
        sys.exit()
    
    def handle_events(self):
        """Handle all events"""
        for event in pygame.event.get():
            if event.type == QUIT:
                self.running = False
            
            elif event.type == KEYDOWN:
                if event.key == K_ESCAPE:
                    self.running = False
            
            # Mouse events for camera control
            elif event.type == MOUSEBUTTONDOWN:
                if event.button in [1, 3]:  # Left or right button
                    # Check if clicking on UI
                    if not self.ui.handle_event(event):
                        self.mouse_dragging = True
                        self.mouse_button = event.button
                        self.last_mouse_pos = event.pos
                elif event.button == 4:  # Wheel up
                    self.renderer.handle_mouse_wheel(1)
                elif event.button == 5:  # Wheel down
                    self.renderer.handle_mouse_wheel(-1)
            
            elif event.type == MOUSEBUTTONUP:
                if event.button in [1, 3]:
                    self.mouse_dragging = False
                    self.mouse_button = None
                    self.last_mouse_pos = None
            
            elif event.type == MOUSEMOTION:
                if self.mouse_dragging and self.last_mouse_pos:
                    dx = event.pos[0] - self.last_mouse_pos[0]
                    dy = event.pos[1] - self.last_mouse_pos[1]
                    self.renderer.handle_mouse_drag(dx, dy, self.mouse_button)
                    self.last_mouse_pos = event.pos
                else:
                    # Pass to UI for hover effects
                    self.ui.handle_event(event)
            
            elif event.type == VIDEORESIZE:
                self.renderer.resize(event.w, event.h)
                self.ui_surface = pygame.Surface((event.w, event.h), pygame.SRCALPHA)
                self.ui = ProfessionalUI(self.ui_surface, self)
            
            else:
                # Pass other events to UI
                self.ui.handle_event(event)
    
    def update(self, delta_time: float):
        """Update simulation"""
        # Update agents
        self.agent_manager.update(delta_time)
        
        # Training update
        if self.training_active and self.training_episodes_remaining > 0:
            reward = self.trainer.train_episode(max_steps=10)
            self.training_episodes_remaining -= 1
            
            print(f"Episode {self.trainer.episode_num}: Reward = {reward:.2f}, "
                  f"Elements = {len(self.park.elements)}")
            
            if self.training_episodes_remaining <= 0:
                self.training_active = False
                print("Training completed!")
    
    def render(self):
        """Render everything"""
        # Render 3D scene with agents
        self.renderer.render(agent_manager=self.agent_manager)
        
        # Render 2D UI overlay
        self.render_ui_overlay()
        
        # Swap buffers
        pygame.display.flip()
    
    def render_ui_overlay(self):
        """Render UI as 2D overlay on top of 3D"""
        # Switch to 2D rendering mode
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        glOrtho(0, self.renderer.width, self.renderer.height, 0, -1, 1)
        glMatrixMode(GL_MODELVIEW)
        glPushMatrix()
        glLoadIdentity()
        
        glDisable(GL_DEPTH_TEST)
        glDisable(GL_LIGHTING)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        # Clear UI surface
        self.ui_surface.fill((0, 0, 0, 0))
        
        # Draw UI
        self.ui.draw()
        
        # Convert pygame surface to OpenGL texture
        ui_string = pygame.image.tostring(self.ui_surface, 'RGBA', True)
        glDrawPixels(self.renderer.width, self.renderer.height, 
                     GL_RGBA, GL_UNSIGNED_BYTE, ui_string)
        
        # Restore 3D mode
        glPopMatrix()
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)
        
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
    
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
    
    def start_training(self, episodes: int = 1):
        """Start training"""
        self.training_active = True
        self.training_episodes_remaining = episodes
        print(f"Starting training for {episodes} episodes...")
    
    def stop_training(self):
        """Stop training"""
        self.training_active = False
        self.training_episodes_remaining = 0
        print("Training stopped")
    
    def clear_park(self):
        """Clear all elements"""
        self.park.clear()
        print("Park cleared")
    
    def apply_best_design(self):
        """Apply best design found"""
        if self.rl_agent.best_design:
            self.park.from_dict(self.rl_agent.best_design)
            print(f"Applied best design (reward: {self.rl_agent.best_reward:.2f})")
        else:
            print("No best design available yet")
    
    def generate_random_design(self):
        """Generate random design"""
        import random
        self.park.clear()
        
        element_types = [
            ElementType.BENCH, ElementType.TREE, ElementType.FOUNTAIN,
            ElementType.STREET_LAMP, ElementType.GRASS_PATCH, ElementType.PATHWAY
        ]
        
        num_elements = random.randint(3, 9)
        available = self.park.get_available_cells()
        
        for _ in range(num_elements):
            if not available:
                break
            x, y = random.choice(available)
            available.remove((x, y))
            elem_type = random.choice(element_types)
            self.park.add_element(elem_type, x, y)
        
        reward = self.trainer.calculate_reward()
        print(f"Random design generated: {num_elements} elements, reward = {reward:.2f}")
    
    def test_baseline(self):
        """Test random baseline"""
        print("Testing random baseline (100 designs)...")
        mean, std = self.trainer.test_random_baseline(100)
        print(f"Random baseline: {mean:.2f} ± {std:.2f}")


def main():
    """Main entry point"""
    try:
        import OpenGL
        print("OpenGL version:", OpenGL.__version__)
    except ImportError:
        print("ERROR: PyOpenGL not installed!")
        print("Please install: pip install PyOpenGL PyOpenGL_accelerate")
        sys.exit(1)
    
    print("="*60)
    print("URBAN PARK RL - 3D PROFESSIONAL VERSION")
    print("="*60)
    
    app = UrbanParkRL3D()
    app.run()


if __name__ == "__main__":
    main()