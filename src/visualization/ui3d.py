"""
Professional UI Overlay for 3D Visualization
Provides control panels, metrics display, and interactive elements
"""

import pygame
from typing import Optional, Tuple, List, Dict, Any
import math


class UIColors:
    """Color palette for UI"""
    BACKGROUND = (20, 24, 32, 200)  # Dark blue with transparency
    PANEL = (30, 35, 45, 220)
    ACCENT = (64, 156, 255)  # Bright blue
    TEXT = (220, 225, 235)
    TEXT_DIM = (150, 160, 175)
    SUCCESS = (80, 200, 120)
    WARNING = (255, 180, 0)
    ERROR = (255, 100, 100)
    BUTTON_HOVER = (80, 85, 100)
    SLIDER_TRACK = (50, 55, 65)
    SLIDER_THUMB = (100, 180, 255)


class Button:
    """Interactive button"""
    
    def __init__(self, x: int, y: int, width: int, height: int, text: str, callback):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.callback = callback
        self.hovered = False
        self.enabled = True
        self.color = UIColors.PANEL
    
    def draw(self, surface: pygame.Surface, font: pygame.font.Font):
        """Draw the button"""
        # Background
        color = UIColors.BUTTON_HOVER if self.hovered else self.color
        if not self.enabled:
            color = (50, 50, 50, 180)
        
        pygame.draw.rect(surface, color, self.rect, border_radius=4)
        pygame.draw.rect(surface, UIColors.ACCENT, self.rect, 2, border_radius=4)
        
        # Text
        text_color = UIColors.TEXT if self.enabled else UIColors.TEXT_DIM
        text_surf = font.render(self.text, True, text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)
    
    def handle_event(self, event) -> bool:
        """Handle mouse event, return True if consumed"""
        if event.type == pygame.MOUSEMOTION:
            self.hovered = self.rect.collidepoint(event.pos)
            return False
        
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.hovered and self.enabled:
                self.callback()
                return True
        
        return False


class Slider:
    """Slider control"""
    
    def __init__(self, x: int, y: int, width: int, label: str, 
                 min_val: float, max_val: float, initial_val: float, callback):
        self.rect = pygame.Rect(x, y, width, 30)
        self.label = label
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial_val
        self.callback = callback
        self.dragging = False
        self.hovered = False
        
        # Track and thumb
        self.track_rect = pygame.Rect(x, y + 20, width, 4)
        self.thumb_radius = 8
        self.thumb_pos = self._value_to_pos()
    
    def _value_to_pos(self) -> int:
        """Convert value to pixel position"""
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return int(self.rect.x + ratio * self.rect.width)
    
    def _pos_to_value(self, pos: int) -> float:
        """Convert pixel position to value"""
        ratio = (pos - self.rect.x) / self.rect.width
        ratio = max(0, min(1, ratio))
        return self.min_val + ratio * (self.max_val - self.min_val)
    
    def draw(self, surface: pygame.Surface, font: pygame.font.Font):
        """Draw the slider"""
        # Label
        label_text = f"{self.label}: {self.value:.1f}"
        text_surf = font.render(label_text, True, UIColors.TEXT)
        surface.blit(text_surf, (self.rect.x, self.rect.y))
        
        # Track
        pygame.draw.rect(surface, UIColors.SLIDER_TRACK, self.track_rect, border_radius=2)
        
        # Thumb
        thumb_color = UIColors.ACCENT if self.hovered or self.dragging else UIColors.SLIDER_THUMB
        pygame.draw.circle(surface, thumb_color, 
                          (self.thumb_pos, self.track_rect.centery), 
                          self.thumb_radius)
        pygame.draw.circle(surface, UIColors.TEXT, 
                          (self.thumb_pos, self.track_rect.centery), 
                          self.thumb_radius, 2)
    
    def handle_event(self, event) -> bool:
        """Handle mouse event"""
        thumb_rect = pygame.Rect(self.thumb_pos - self.thumb_radius,
                                self.track_rect.centery - self.thumb_radius,
                                self.thumb_radius * 2,
                                self.thumb_radius * 2)
        
        if event.type == pygame.MOUSEMOTION:
            # Only update hover if not dragging
            if not self.dragging:
                self.hovered = thumb_rect.collidepoint(event.pos)
            
            # If dragging, update value
            if self.dragging:
                self.value = self._pos_to_value(event.pos[0])
                self.thumb_pos = self._value_to_pos()
                self.callback(self.value)
                return True
        
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if thumb_rect.collidepoint(event.pos):
                self.dragging = True
                self.hovered = True
                return True
        
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            if self.dragging:
                self.dragging = False
                self.hovered = False
                return True
        
        return False


class Panel:
    """UI Panel container"""
    
    def __init__(self, x: int, y: int, width: int, height: int, title: str):
        self.rect = pygame.Rect(x, y, width, height)
        self.title = title
        self.elements: List[Any] = []
    
    def draw(self, surface: pygame.Surface, font: pygame.font.Font, title_font: pygame.font.Font):
        """Draw the panel"""
        # Background
        panel_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        surface.blit(panel_surf, self.rect.topleft)
        
        # Border
        pygame.draw.rect(surface, UIColors.ACCENT, self.rect, 2, border_radius=8)
        
        # Title
        title_surf = title_font.render(self.title, True, UIColors.ACCENT)
        surface.blit(title_surf, (self.rect.x + 15, self.rect.y + 10))
        
        # Draw elements
        for element in self.elements:
            element.draw(surface, font)
    
    def add_element(self, element):
        """Add an element to the panel"""
        self.elements.append(element)
    
    def handle_event(self, event) -> bool:
        """Handle events for all elements"""
        for element in self.elements:
            if element.handle_event(event):
                return True
        return False


class ProfessionalUI:
    """Main UI manager"""
    
    def __init__(self, surface: pygame.Surface, app):
        self.surface = surface
        self.app = app
        self.width = surface.get_width()
        self.height = surface.get_height()
        
        # Fonts
        pygame.font.init()
        self.font = pygame.font.Font(None, 20)
        self.title_font = pygame.font.Font(None, 28)
        self.small_font = pygame.font.Font(None, 18)
        
        # Panels
        self.panels: List[Panel] = []
        self._create_panels()
    
    def _create_panels(self):
        """Create all UI panels"""
        # Left panel - Design controls
        design_panel = Panel(20, 20, 280, 400, "Park Design")
        
        # Add buttons
        button_y = 60
        button_spacing = 50
        
        design_panel.add_element(Button(
            35, button_y, 250, 40,
            "Clear Park",
            self.app.clear_park
        ))
        button_y += button_spacing
        
        design_panel.add_element(Button(
            35, button_y, 250, 40,
            "Random Design",
            self.app.generate_random_design
        ))
        button_y += button_spacing
        
        design_panel.add_element(Button(
            35, button_y, 250, 40,
            "Apply Best Design",
            self.app.apply_best_design
        ))
        button_y += button_spacing
        
        # Add sliders with actual functionality
        slider_y = button_y + 20
        
        def update_agent_count(value):
            """Update the number of agents"""
            current = len(self.app.agent_manager.agents)
            target = int(value)
            
            if target > current:
                # Add agents
                for _ in range(target - current):
                    self.app.agent_manager.spawn_agent()
            elif target < current:
                # Remove agents
                for _ in range(current - target):
                    if self.app.agent_manager.agents:
                        self.app.agent_manager.agents.pop()
        
        self.agent_slider = Slider(
            35, slider_y, 250,
            "Agent Count",
            5, 50, len(self.app.agent_manager.agents),
            update_agent_count
        )
        design_panel.add_element(self.agent_slider)
        
        self.panels.append(design_panel)
        
        # Right panel - Training controls
        training_panel = Panel(self.width - 300, 20, 280, 350, "RL Training")
        
        button_y = 60
        training_panel.add_element(Button(
            self.width - 285, button_y, 250, 40,
            "Train 1 Episode",
            lambda: self.app.start_training(1)
        ))
        button_y += button_spacing
        
        training_panel.add_element(Button(
            self.width - 285, button_y, 250, 40,
            "Train 10 Episodes",
            lambda: self.app.start_training(10)
        ))
        button_y += button_spacing
        
        training_panel.add_element(Button(
            self.width - 285, button_y, 250, 40,
            "Train 100 Episodes",
            lambda: self.app.start_training(100)
        ))
        button_y += button_spacing
        
        training_panel.add_element(Button(
            self.width - 285, button_y, 250, 40,
            "Stop Training",
            self.app.stop_training
        ))
        button_y += button_spacing
        
        training_panel.add_element(Button(
            self.width - 285, button_y, 250, 40,
            "Test Baseline",
            self.app.test_baseline
        ))
        
        self.panels.append(training_panel)
    
    def draw(self):
        """Draw all UI elements"""
        # Update agent slider value to match actual count
        if hasattr(self, 'agent_slider'):
            current_count = len(self.app.agent_manager.agents)
            self.agent_slider.value = current_count
            self.agent_slider.thumb_pos = self.agent_slider._value_to_pos()
        
        # Draw panels
        for panel in self.panels:
            panel.draw(self.surface, self.font, self.title_font)
        
        # Draw metrics at bottom left
        self._draw_metrics()
        
        # Draw training status if active
        if self.app.training_active:
            self._draw_training_status()
    
    def _draw_metrics(self):
        """Draw metrics display"""
        metrics = self.app.get_metrics()
        
        # Background panel
        metrics_rect = pygame.Rect(20, self.height - 180, 280, 160)
        panel_surf = pygame.Surface((metrics_rect.width, metrics_rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        self.surface.blit(panel_surf, metrics_rect.topleft)
        pygame.draw.rect(self.surface, UIColors.ACCENT, metrics_rect, 2, border_radius=8)
        
        # Title
        title = self.title_font.render("Metrics", True, UIColors.ACCENT)
        self.surface.blit(title, (metrics_rect.x + 15, metrics_rect.y + 10))
        
        # Metrics
        y_offset = metrics_rect.y + 45
        line_height = 22
        
        metric_lines = [
            f"Comfort: {metrics['comfort']:.2f}",
            f"Utilization: {metrics['utilization']:.2f}",
            f"Coverage: {metrics['shade_coverage']:.2f}",
            f"Lighting: {metrics['light_coverage']:.2f}",
            f"Total Score: {metrics['total_score']:.2f}"
        ]
        
        for line in metric_lines:
            text = self.font.render(line, True, UIColors.TEXT)
            self.surface.blit(text, (metrics_rect.x + 15, y_offset))
            y_offset += line_height
    
    def _draw_training_status(self):
        """Draw training status indicator"""
        # Background
        status_rect = pygame.Rect(self.width // 2 - 150, 20, 300, 60)
        panel_surf = pygame.Surface((status_rect.width, status_rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        self.surface.blit(panel_surf, status_rect.topleft)
        pygame.draw.rect(self.surface, UIColors.SUCCESS, status_rect, 2, border_radius=8)
        
        # Text
        status_text = f"Training: {self.app.training_episodes_remaining} episodes remaining"
        text = self.title_font.render(status_text, True, UIColors.SUCCESS)
        text_rect = text.get_rect(center=status_rect.center)
        self.surface.blit(text, text_rect)
    
    def handle_event(self, event) -> bool:
        """Handle UI events"""
        # Check panels
        for panel in self.panels:
            if panel.handle_event(event):
                return True
        
        return False