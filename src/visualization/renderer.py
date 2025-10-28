"""
Renderer Module
Simplified 2D renderer for park visualization
"""

import pygame
import numpy as np
from typing import Tuple, Optional

try:
    from environment.park import Park
    from config import ElementType, viz_config
except ImportError:
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"
        GRASS_PATCH = "grass"
        PATHWAY = "pathway"


class ParkRenderer:
    """Simple 2D renderer for park visualization"""
    
    def __init__(self, screen: pygame.Surface, park: Park):
        self.screen = screen
        self.park = park
        self.screen_width = screen.get_width()
        self.screen_height = screen.get_height()
        
        # Rendering settings
        self.cell_size = min(self.screen_width, self.screen_height) / (park.grid_size + 2)
        self.offset_x = self.screen_width // 2
        self.offset_y = self.screen_height // 2
        
        # Colors
        self.colors = {
            ElementType.BENCH: (139, 69, 19),
            ElementType.TREE: (34, 139, 34),
            ElementType.FOUNTAIN: (64, 164, 223),
            ElementType.STREET_LAMP: (255, 223, 0),
            ElementType.GRASS_PATCH: (124, 252, 0),
            ElementType.PATHWAY: (128, 128, 128)
        }
    
    def world_to_screen(self, world_x: float, world_y: float) -> Tuple[int, int]:
        """Convert world coordinates to screen coordinates"""
        screen_x = int(self.offset_x + world_x * self.cell_size)
        screen_y = int(self.offset_y - world_y * self.cell_size)  # Y is flipped
        return screen_x, screen_y
    
    def render(self):
        """Render the park"""
        # Draw background (dark green for park ground)
        self.screen.fill((20, 40, 20))
        
        # Draw park boundary
        self._draw_park_boundary()
        
        # Draw grid
        self._draw_grid()
        
        # Draw elements
        for element in self.park.elements:
            self._draw_element(element)
        
        # Show helpful message if park is empty
        if len(self.park.elements) == 0:
            self._draw_empty_message()
        
        # Draw info
        self._draw_info()
    
    def _draw_empty_message(self):
        """Draw message when park is empty"""
        font_large = pygame.font.Font(None, 48)
        font_small = pygame.font.Font(None, 28)
        
        messages = [
            "Welcome to Urban Park RL!",
            "",
            "Press 'T' to start training the AI",
            "or click on the grid to place elements"
        ]
        
        y = self.screen_height // 2 - 60
        
        for i, msg in enumerate(messages):
            if msg:
                font = font_large if i == 0 else font_small
                color = (255, 255, 100) if i == 0 else (200, 255, 200)
                text = font.render(msg, True, color)
                rect = text.get_rect(center=(self.screen_width // 2, y))
                
                # Draw text shadow
                shadow = font.render(msg, True, (0, 0, 0))
                shadow_rect = shadow.get_rect(center=(self.screen_width // 2 + 2, y + 2))
                self.screen.blit(shadow, shadow_rect)
                
                self.screen.blit(text, rect)
            y += 40
    
    def _draw_park_boundary(self):
        """Draw the park boundary"""
        half_size = self.park.size / 2
        
        # Get corners
        top_left = self.world_to_screen(-half_size, half_size)
        top_right = self.world_to_screen(half_size, half_size)
        bottom_right = self.world_to_screen(half_size, -half_size)
        bottom_left = self.world_to_screen(-half_size, -half_size)
        
        # Draw boundary rectangle
        points = [top_left, top_right, bottom_right, bottom_left]
        pygame.draw.polygon(self.screen, (30, 60, 30), points)
        pygame.draw.polygon(self.screen, (100, 200, 100), points, 3)
    
    def _draw_grid(self):
        """Draw grid lines"""
        half_size = self.park.size / 2
        
        # Grid lines
        for i in range(self.park.grid_size + 1):
            pos = -half_size + i * self.park.cell_size
            
            # Vertical line
            start_x, start_y = self.world_to_screen(pos, -half_size)
            end_x, end_y = self.world_to_screen(pos, half_size)
            pygame.draw.line(self.screen, (80, 150, 80), 
                           (start_x, start_y), (end_x, end_y), 1)
            
            # Horizontal line
            start_x, start_y = self.world_to_screen(-half_size, pos)
            end_x, end_y = self.world_to_screen(half_size, pos)
            pygame.draw.line(self.screen, (80, 150, 80),
                           (start_x, start_y), (end_x, end_y), 1)
    
    def _draw_element(self, element):
        """Draw a single element"""
        screen_x, screen_y = self.world_to_screen(
            element.position.x, 
            element.position.y
        )
        
        color = self.colors.get(element.element_type, (100, 100, 100))
        radius = max(15, int(element.size * self.cell_size / 2.5))
        
        # Draw glow/shadow effect
        for i in range(3, 0, -1):
            glow_color = tuple(min(255, c + 30) for c in color)
            pygame.draw.circle(self.screen, glow_color, 
                             (screen_x, screen_y), radius + i * 2, 1)
        
        # Draw filled circle for element
        pygame.draw.circle(self.screen, color, (screen_x, screen_y), radius)
        
        # Draw bright outline
        pygame.draw.circle(self.screen, (255, 255, 255), 
                         (screen_x, screen_y), radius, 2)
        
        # Draw label with background
        font = pygame.font.Font(None, 20)
        label = element.element_type.value[:4].upper()
        text = font.render(label, True, (255, 255, 255))
        text_rect = text.get_rect(center=(screen_x, screen_y))
        
        # Draw text background
        bg_rect = text_rect.inflate(4, 2)
        bg_surface = pygame.Surface(bg_rect.size)
        bg_surface.set_alpha(180)
        bg_surface.fill((0, 0, 0))
        self.screen.blit(bg_surface, bg_rect.topleft)
        
        # Draw text
        self.screen.blit(text, text_rect)
    
    def _draw_info(self):
        """Draw information overlay"""
        font = pygame.font.Font(None, 28)
        
        # Check training status
        training_status = "TRAINING" if hasattr(self.park, '_training_active') and self.park._training_active else "IDLE"
        
        info_text = [
            f"Elements: {len(self.park.elements)}",
            f"Occupancy: {self.park.get_occupancy_rate():.1%}",
            f"Status: {training_status}",
            "",
            "Controls:",
            "H - Help",
            "M - Metrics", 
            "C - Clear",
            "T - Train",
            "ESC - Exit"
        ]
        
        # Draw background panel
        panel_width = 200
        panel_height = len(info_text) * 28 + 20
        panel = pygame.Surface((panel_width, panel_height))
        panel.set_alpha(220)
        panel.fill((20, 20, 40))
        self.screen.blit(panel, (10, 10))
        
        # Draw border
        border_color = (100, 255, 100) if training_status == "TRAINING" else (100, 150, 200)
        pygame.draw.rect(self.screen, border_color, 
                        (10, 10, panel_width, panel_height), 3)
        
        # Draw text
        y = 20
        for text_line in info_text:
            if text_line:
                # Color coding
                if "TRAINING" in text_line:
                    color = (100, 255, 100)
                elif ":" in text_line:
                    color = (255, 255, 150)
                else:
                    color = (200, 200, 255)
                surface = font.render(text_line, True, color)
                self.screen.blit(surface, (20, y))
            y += 28