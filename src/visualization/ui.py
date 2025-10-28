"""
UI Module
User interface components for the application
"""

import pygame
from typing import Optional

try:
    from config import viz_config
except ImportError:
    pass


class UIManager:
    """Manages UI elements"""
    
    def __init__(self, screen: pygame.Surface, app):
        self.screen = screen
        self.app = app
        self.font = pygame.font.Font(None, 24)
        self.small_font = pygame.font.Font(None, 18)
        
        # UI state
        self.show_metrics = True
        self.show_help = False
    
    def handle_event(self, event: pygame.event.Event):
        """Handle UI events"""
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_h:
                self.show_help = not self.show_help
            elif event.key == pygame.K_m:
                self.show_metrics = not self.show_metrics
            elif event.key == pygame.K_c:
                self.app.clear_park()
            elif event.key == pygame.K_t:
                if hasattr(self.app, 'training_active'):
                    if self.app.training_active:
                        self.app.stop_training()
                    else:
                        self.app.start_training()
    
    def render(self):
        """Render UI elements"""
        if self.show_metrics:
            self._render_metrics()
        
        if self.show_help:
            self._render_help()
    
    def _render_metrics(self):
        """Render metrics panel"""
        # Get metrics
        try:
            metrics = self.app.get_metrics()
        except:
            return
        
        # Panel dimensions
        panel_width = 320
        panel_height = 240
        panel_x = self.screen.get_width() - panel_width - 10
        panel_y = 10
        
        # Panel background with border
        panel_surface = pygame.Surface((panel_width, panel_height))
        panel_surface.set_alpha(230)
        panel_surface.fill((25, 25, 45))
        self.screen.blit(panel_surface, (panel_x, panel_y))
        
        # Draw border
        pygame.draw.rect(self.screen, (100, 150, 200), 
                        (panel_x, panel_y, panel_width, panel_height), 3)
        
        # Draw metrics
        y = panel_y + 15
        x = panel_x + 15
        
        # Title
        title = self.font.render("📊 Metrics", True, (255, 255, 150))
        self.screen.blit(title, (x, y))
        y += 35
        
        # Separator line
        pygame.draw.line(self.screen, (100, 150, 200),
                        (x, y - 5), (panel_x + panel_width - 15, y - 5), 1)
        
        # Metrics
        for key, value in metrics.items():
            if isinstance(value, float):
                text = f"{key.replace('_', ' ').title()}: {value:.2f}"
                # Color code based on value
                if value < 0.3:
                    color = (255, 100, 100)  # Red
                elif value < 0.6:
                    color = (255, 200, 100)  # Yellow
                else:
                    color = (100, 255, 100)  # Green
            else:
                text = f"{key.replace('_', ' ').title()}: {value}"
                color = (200, 200, 255)
            
            surface = self.small_font.render(text, True, color)
            self.screen.blit(surface, (x, y))
            y += 24
    
    def _render_help(self):
        """Render help overlay"""
        help_text = [
            "🎮 URBAN PARK RL - CONTROLS",
            "",
            "H - Toggle Help",
            "M - Toggle Metrics Panel",
            "C - Clear Park",
            "T - Toggle AI Training",
            "",
            "ESC - Exit Application",
            "",
            "Press H again to close"
        ]
        
        # Background overlay
        overlay = pygame.Surface(self.screen.get_size())
        overlay.set_alpha(240)
        overlay.fill((10, 10, 20))
        self.screen.blit(overlay, (0, 0))
        
        # Help panel
        panel_width = 600
        panel_height = 400
        panel_x = (self.screen.get_width() - panel_width) // 2
        panel_y = (self.screen.get_height() - panel_height) // 2
        
        # Panel background
        panel_surface = pygame.Surface((panel_width, panel_height))
        panel_surface.fill((30, 30, 50))
        self.screen.blit(panel_surface, (panel_x, panel_y))
        
        # Panel border
        pygame.draw.rect(self.screen, (100, 200, 255),
                        (panel_x, panel_y, panel_width, panel_height), 4)
        
        # Text
        y = panel_y + 40
        
        for i, text in enumerate(help_text):
            if text:
                if i == 0:  # Title
                    font = pygame.font.Font(None, 42)
                    color = (255, 255, 150)
                elif text.startswith("Press"):
                    font = self.small_font
                    color = (150, 255, 150)
                else:
                    font = self.font
                    color = (255, 255, 255)
                
                surface = font.render(text, True, color)
                rect = surface.get_rect(center=(self.screen.get_width() // 2, y))
                self.screen.blit(surface, rect)
            y += 35