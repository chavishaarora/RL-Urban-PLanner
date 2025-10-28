"""
Professional UI Overlay for 3D Visualization
Pure Pygame implementation - reliable and beautiful
"""

import pygame
from typing import List, Any
import math


class UIColors:
    """Professional color palette"""
    # Backgrounds
    PANEL_BG = (25, 28, 35, 235)
    PANEL_HEADER = (35, 40, 50, 245)
    
    # Accent colors
    PRIMARY = (64, 156, 255)
    PRIMARY_HOVER = (84, 176, 255)
    PRIMARY_ACTIVE = (44, 136, 235)
    
    # Semantic colors
    SUCCESS = (80, 200, 120)
    WARNING = (255, 180, 0)
    ERROR = (255, 100, 100)
    INFO = (100, 180, 255)
    
    # Text
    TEXT_PRIMARY = (220, 225, 235)
    TEXT_SECONDARY = (160, 165, 180)
    TEXT_DISABLED = (100, 105, 120)
    
    # UI elements
    BUTTON_BG = (50, 120, 200, 200)
    BUTTON_HOVER = (70, 140, 220, 230)
    BUTTON_ACTIVE = (40, 100, 180, 255)
    
    SLIDER_TRACK = (45, 50, 60)
    SLIDER_FILL = (64, 156, 255)
    SLIDER_THUMB = (100, 180, 255)
    
    BORDER = (64, 156, 255, 180)
    SEPARATOR = (80, 90, 110)


def draw_rounded_rect(surface, color, rect, radius=8, border=0, border_color=None):
    """Draw a rounded rectangle"""
    # Main rectangle
    rect_obj = pygame.Rect(rect)
    
    # Create a surface for the rounded rect
    if len(color) == 4:  # Has alpha
        rounded_surf = pygame.Surface((rect_obj.width, rect_obj.height), pygame.SRCALPHA)
        pygame.draw.rect(rounded_surf, color, rounded_surf.get_rect(), border_radius=radius)
        surface.blit(rounded_surf, rect_obj.topleft)
    else:
        pygame.draw.rect(surface, color, rect_obj, border_radius=radius)
    
    # Border
    if border > 0 and border_color:
        pygame.draw.rect(surface, border_color, rect_obj, border, border_radius=radius)


class Button:
    """Modern button with hover effects"""
    
    def __init__(self, x, y, width, height, text, callback):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.callback = callback
        self.hovered = False
        self.pressed = False
        self.enabled = True
    
    def draw(self, surface, font):
        # Choose color based on state
        if not self.enabled:
            bg_color = (40, 45, 55, 150)
            text_color = UIColors.TEXT_DISABLED
        elif self.pressed:
            bg_color = UIColors.BUTTON_ACTIVE
            text_color = UIColors.TEXT_PRIMARY
        elif self.hovered:
            bg_color = UIColors.BUTTON_HOVER
            text_color = UIColors.TEXT_PRIMARY
        else:
            bg_color = UIColors.BUTTON_BG
            text_color = UIColors.TEXT_PRIMARY
        
        # Draw button background
        draw_rounded_rect(surface, bg_color, self.rect, radius=6, 
                         border=2, border_color=UIColors.PRIMARY if self.hovered else UIColors.BORDER)
        
        # Draw text
        text_surf = font.render(self.text, True, text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)
    
    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hovered = self.rect.collidepoint(event.pos)
            return False
        
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.hovered and self.enabled:
                self.pressed = True
                return True
        
        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            if self.pressed and self.hovered and self.enabled:
                self.callback()
                self.pressed = False
                return True
            self.pressed = False
        
        return False


class Slider:
    """Modern slider with smooth interaction"""
    
    def __init__(self, x, y, width, label, min_val, max_val, initial_val, callback):
        self.rect = pygame.Rect(x, y, width, 50)
        self.label = label
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial_val
        self.callback = callback
        
        self.dragging = False
        self.hovered = False
        
        # Track area
        self.track_rect = pygame.Rect(x, y + 35, width, 6)
        self.thumb_radius = 10
        self.thumb_pos = self._value_to_pos()
    
    def _value_to_pos(self):
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return int(self.track_rect.x + ratio * self.track_rect.width)
    
    def _pos_to_value(self, pos):
        ratio = (pos - self.track_rect.x) / self.track_rect.width
        ratio = max(0, min(1, ratio))
        return self.min_val + ratio * (self.max_val - self.min_val)
    
    def draw(self, surface, font):
        # Label with value
        label_text = f"{self.label}: {int(self.value)}"
        text_surf = font.render(label_text, True, UIColors.TEXT_PRIMARY)
        surface.blit(text_surf, (self.rect.x, self.rect.y))
        
        # Track background
        draw_rounded_rect(surface, UIColors.SLIDER_TRACK, self.track_rect, radius=3)
        
        # Filled portion
        fill_width = self.thumb_pos - self.track_rect.x
        if fill_width > 0:
            fill_rect = pygame.Rect(self.track_rect.x, self.track_rect.y, fill_width, self.track_rect.height)
            draw_rounded_rect(surface, UIColors.SLIDER_FILL, fill_rect, radius=3)
        
        # Thumb
        thumb_color = UIColors.PRIMARY if (self.hovered or self.dragging) else UIColors.SLIDER_THUMB
        pygame.draw.circle(surface, thumb_color, 
                          (self.thumb_pos, self.track_rect.centery), 
                          self.thumb_radius)
        pygame.draw.circle(surface, UIColors.TEXT_PRIMARY,
                          (self.thumb_pos, self.track_rect.centery),
                          self.thumb_radius, 2)
        
        # Glow effect when active
        if self.dragging:
            glow_surf = pygame.Surface((self.thumb_radius*4, self.thumb_radius*4), pygame.SRCALPHA)
            pygame.draw.circle(glow_surf, (*UIColors.PRIMARY, 60),
                             (self.thumb_radius*2, self.thumb_radius*2),
                             self.thumb_radius*2)
            surface.blit(glow_surf, (self.thumb_pos - self.thumb_radius*2, 
                                    self.track_rect.centery - self.thumb_radius*2))
    
    def handle_event(self, event):
        thumb_rect = pygame.Rect(self.thumb_pos - self.thumb_radius - 5,
                                self.track_rect.centery - self.thumb_radius - 5,
                                (self.thumb_radius + 5) * 2,
                                (self.thumb_radius + 5) * 2)
        
        if event.type == pygame.MOUSEMOTION:
            if not self.dragging:
                self.hovered = thumb_rect.collidepoint(event.pos)
            
            if self.dragging:
                self.value = self._pos_to_value(event.pos[0])
                self.thumb_pos = self._value_to_pos()
                return True
        
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if thumb_rect.collidepoint(event.pos) or self.track_rect.collidepoint(event.pos):
                self.dragging = True
                self.value = self._pos_to_value(event.pos[0])
                self.thumb_pos = self._value_to_pos()
                return True
        
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            if self.dragging:
                self.dragging = False
                self.callback(self.value)
                self.hovered = thumb_rect.collidepoint(event.pos)
                return True
        
        return False


class Panel:
    """Modern panel with header"""
    
    def __init__(self, x, y, width, height, title, icon=""):
        self.rect = pygame.Rect(x, y, width, height)
        self.title = title
        self.icon = icon
        self.elements: List[Any] = []
    
    def draw(self, surface, font, title_font):
        # Panel background
        draw_rounded_rect(surface, UIColors.PANEL_BG, self.rect, radius=10,
                         border=2, border_color=UIColors.BORDER)
        
        # Header area
        header_rect = pygame.Rect(self.rect.x, self.rect.y, self.rect.width, 50)
        draw_rounded_rect(surface, UIColors.PANEL_HEADER, header_rect, radius=10)
        
        # Title with icon
        title_text = f"{self.icon} {self.title}" if self.icon else self.title
        title_surf = title_font.render(title_text, True, UIColors.PRIMARY)
        surface.blit(title_surf, (self.rect.x + 20, self.rect.y + 15))
        
        # Separator line
        separator_y = self.rect.y + 50
        pygame.draw.line(surface, UIColors.SEPARATOR,
                        (self.rect.x + 10, separator_y),
                        (self.rect.right - 10, separator_y), 1)
        
        # Draw elements
        for element in self.elements:
            element.draw(surface, font)
    
    def add_element(self, element):
        self.elements.append(element)
    
    def handle_event(self, event):
        for element in self.elements:
            if element.handle_event(event):
                return True
        return False


class ProgressBar:
    """Modern progress bar"""
    
    def __init__(self, x, y, width, height=8):
        self.rect = pygame.Rect(x, y, width, height)
        self.value = 0.0
    
    def draw(self, surface):
        # Background
        draw_rounded_rect(surface, UIColors.SLIDER_TRACK, self.rect, radius=4)
        
        # Fill
        fill_width = int(self.rect.width * self.value)
        if fill_width > 0:
            fill_rect = pygame.Rect(self.rect.x, self.rect.y, fill_width, self.rect.height)
            
            # Gradient effect
            color = UIColors.SUCCESS if self.value > 0.7 else (UIColors.WARNING if self.value > 0.3 else UIColors.ERROR)
            draw_rounded_rect(surface, color, fill_rect, radius=4)
    
    def set_value(self, value):
        self.value = max(0.0, min(1.0, value))


class ProfessionalUI:
    """Beautiful modern UI"""
    
    def __init__(self, surface, app):
        self.surface = surface
        self.app = app
        self.width = surface.get_width()
        self.height = surface.get_height()
        
        # Fonts
        pygame.font.init()
        self.font = pygame.font.SysFont('Arial', 16)
        self.title_font = pygame.font.SysFont('Arial', 20, bold=True)
        self.small_font = pygame.font.SysFont('Arial', 14)
        
        # Panels
        self.panels = []
        self.progress_bars = {}
        self._create_panels()
    
    def _create_panels(self):
        # Left panel - Design
        design_panel = Panel(20, 20, 320, 470, "Park Design", "🏗")
        
        y = 80
        spacing = 55
        
        design_panel.add_element(Button(40, y, 280, 45, "Clear Park", self.app.clear_park))
        y += spacing
        
        design_panel.add_element(Button(40, y, 280, 45, "Random Design", self.app.generate_random_design))
        y += spacing
        
        design_panel.add_element(Button(40, y, 280, 45, "Apply Best Design", self.app.apply_best_design))
        y += spacing + 20
        
        # Slider
        def update_agents(value):
            current = len(self.app.agent_manager.agents)
            target = int(value)
            if target > current:
                for _ in range(target - current):
                    self.app.agent_manager.spawn_agent()
            elif target < current:
                for _ in range(current - target):
                    if self.app.agent_manager.agents:
                        self.app.agent_manager.agents.pop()
        
        self.agent_slider = Slider(40, y, 280, "Agents", 5, 50, 
                                   len(self.app.agent_manager.agents), update_agents)
        design_panel.add_element(self.agent_slider)
        
        self.panels.append(design_panel)
        
        # Right panel - Training
        training_panel = Panel(self.width - 340, 20, 320, 420, "RL Training", "🤖")
        
        y = 80
        training_panel.add_element(Button(self.width - 320, y, 280, 45, 
                                         "Train 1 Episode", lambda: self.app.start_training(1)))
        y += spacing
        
        training_panel.add_element(Button(self.width - 320, y, 280, 45,
                                         "Train 10 Episodes", lambda: self.app.start_training(10)))
        y += spacing
        
        training_panel.add_element(Button(self.width - 320, y, 280, 45,
                                         "Train 100 Episodes", lambda: self.app.start_training(100)))
        y += spacing
        
        training_panel.add_element(Button(self.width - 320, y, 280, 45,
                                         "Stop Training", self.app.stop_training))
        
        self.panels.append(training_panel)
        
        # Bottom left - Metrics
        self.metrics_panel = Panel(20, self.height - 230, 320, 210, "Metrics", "📊")
        
        # Create progress bars
        y_offset = self.height - 230 + 70
        for metric in ['comfort', 'utilization', 'coverage']:
            self.progress_bars[metric] = ProgressBar(40, y_offset, 280, 10)
            y_offset += 45
        
        self.panels.append(self.metrics_panel)
    
    def draw(self):
        # Draw panels
        for panel in self.panels:
            panel.draw(self.surface, self.font, self.title_font)
        
        # Draw metrics manually (not as panel elements)
        self._draw_metrics_content()
        
        # Training status
        if self.app.training_active:
            self._draw_training_status()
    
    def _draw_metrics_content(self):
        """Draw metrics with progress bars"""
        metrics = self.app.get_metrics()
        
        y = self.height - 230 + 70
        x = 40
        
        for key, label in [('comfort', 'Comfort'), ('utilization', 'Utilization'), 
                          ('coverage', 'Coverage')]:
            # Label
            text = self.font.render(label, True, UIColors.TEXT_PRIMARY)
            self.surface.blit(text, (x, y - 20))
            
            # Progress bar
            self.progress_bars[key].set_value(metrics[key])
            self.progress_bars[key].draw(self.surface)
            
            # Value text
            value_text = self.small_font.render(f"{metrics[key]:.2f}", True, UIColors.TEXT_SECONDARY)
            self.surface.blit(value_text, (x + 285, y - 18))
            
            y += 45
        
        # Total score
        total_text = self.title_font.render(f"Total: {metrics['total_score']:.2f}", 
                                           True, UIColors.SUCCESS)
        self.surface.blit(total_text, (x, y + 5))
    
    def _draw_training_status(self):
        """Draw training status banner"""
        banner_rect = pygame.Rect(self.width // 2 - 200, 20, 400, 60)
        draw_rounded_rect(self.surface, UIColors.PANEL_BG, banner_rect, radius=8,
                         border=2, border_color=UIColors.SUCCESS)
        
        status = f"Training: {self.app.training_episodes_remaining} episodes left"
        text = self.title_font.render(status, True, UIColors.SUCCESS)
        text_rect = text.get_rect(center=banner_rect.center)
        self.surface.blit(text, text_rect)
    
    def handle_event(self, event):
        for panel in self.panels:
            if panel.handle_event(event):
                return True
        return False