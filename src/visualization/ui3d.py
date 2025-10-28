"""
Professional UI Overlay for 3D Visualization
Provides control panels, metrics display, and interactive elements
"""

import pygame
from typing import List, Any
import math


class UIColors:
    BACKGROUND = (20, 24, 32, 200)
    PANEL = (30, 35, 45, 220)
    ACCENT = (64, 156, 255)
    TEXT = (220, 225, 235)
    TEXT_DIM = (150, 160, 175)
    SUCCESS = (80, 200, 120)
    WARNING = (255, 180, 0)
    ERROR = (255, 100, 100)
    BUTTON_HOVER = (80, 85, 100)
    SLIDER_TRACK = (50, 55, 65)
    SLIDER_THUMB = (100, 180, 255)


class Button:
    def __init__(self, x, y, width, height, text, callback):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.callback = callback
        self.hovered = False
        self.enabled = True
        self.color = UIColors.PANEL
    
    def draw(self, surface, font):
        color = UIColors.BUTTON_HOVER if self.hovered else self.color
        if not self.enabled:
            color = (50, 50, 50, 180)

        pygame.draw.rect(surface, color, self.rect, border_radius=4)
        pygame.draw.rect(surface, UIColors.ACCENT, self.rect, 2, border_radius=4)

        text_color = UIColors.TEXT if self.enabled else UIColors.TEXT_DIM
        text_surf = font.render(self.text, True, text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)
    
    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hovered = self.rect.collidepoint(event.pos)

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.hovered and self.enabled:
                self.callback()
                return True
        return False


class Slider:
    """Hybrid Slider: Drag OR click to select, click again to release"""
    
    def __init__(self, x, y, width, label, min_val, max_val, initial_val, callback):
        self.rect = pygame.Rect(x, y, width, 30)
        self.label = label
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial_val
        self.callback = callback
        
        self.dragging = False
        self.hovered = False
        self.selected = False
        
        self.track_rect = pygame.Rect(x, y + 20, width, 4)
        self.thumb_radius = 8
        self.thumb_pos = self._value_to_pos()
    
    def _value_to_pos(self):
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return int(self.rect.x + ratio * self.rect.width)
    
    def _pos_to_value(self, pos):
        ratio = (pos - self.rect.x) / self.rect.width
        ratio = max(0, min(1, ratio))
        return self.min_val + ratio * (self.max_val - self.min_val)
    
    def draw(self, surface, font):
        label_text = f"{self.label}: {int(self.value)}"
        surface.blit(font.render(label_text, True, UIColors.TEXT),
                     (self.rect.x, self.rect.y))

        pygame.draw.rect(surface, UIColors.SLIDER_TRACK,
                         self.track_rect, border_radius=2)

        thumb_color = UIColors.ACCENT if (self.hovered or self.selected or self.dragging) else UIColors.SLIDER_THUMB
        pygame.draw.circle(surface, thumb_color,
                           (self.thumb_pos, self.track_rect.centery),
                           self.thumb_radius)
        pygame.draw.circle(surface, UIColors.TEXT,
                           (self.thumb_pos, self.track_rect.centery),
                           self.thumb_radius, 2)
    
    def handle_event(self, event):
        thumb_rect = pygame.Rect(
            self.thumb_pos - self.thumb_radius,
            self.track_rect.centery - self.thumb_radius,
            self.thumb_radius * 2,
            self.thumb_radius * 2
        )

        if event.type == pygame.MOUSEMOTION:
            if not self.selected:
                self.hovered = thumb_rect.collidepoint(event.pos)

            if self.dragging:
                self.value = self._pos_to_value(event.pos[0])
                self.thumb_pos = self._value_to_pos()
                self.callback(self.value)
                return True

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if thumb_rect.collidepoint(event.pos):
                if not self.selected:
                    self.selected = True
                    self.dragging = True
                else:
                    self.selected = False
                    self.dragging = False
                return True

        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            if self.dragging:
                self.dragging = False
            return True if self.selected else False
        
        return False


class Panel:
    def __init__(self, x, y, width, height, title):
        self.rect = pygame.Rect(x, y, width, height)
        self.title = title
        self.elements: List[Any] = []
    
    def draw(self, surface, font, title_font):
        panel_surf = pygame.Surface((self.rect.width, self.rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        surface.blit(panel_surf, self.rect.topleft)

        pygame.draw.rect(surface, UIColors.ACCENT, self.rect, 2, border_radius=8)

        title_surf = title_font.render(self.title, True, UIColors.ACCENT)
        surface.blit(title_surf, (self.rect.x + 15, self.rect.y + 10))

        for element in self.elements:
            element.draw(surface, font)
    
    def add_element(self, element):
        self.elements.append(element)
    
    def handle_event(self, event):
        for element in self.elements:
            if element.handle_event(event):
                return True
        return False


class ProfessionalUI:
    def __init__(self, surface, app):
        self.surface = surface
        self.app = app
        self.width = surface.get_width()
        self.height = surface.get_height()

        pygame.font.init()
        self.font = pygame.font.Font(None, 20)
        self.title_font = pygame.font.Font(None, 28)
        self.small_font = pygame.font.Font(None, 18)

        self.panels = []
        self._create_panels()
    
    def _create_panels(self):
        design_panel = Panel(20, 20, 280, 400, "Park Design")

        button_y = 60
        spacing = 50

        design_panel.add_element(Button(35, button_y, 250, 40, "Clear Park", self.app.clear_park))
        button_y += spacing

        design_panel.add_element(Button(35, button_y, 250, 40, "Random Design", self.app.generate_random_design))
        button_y += spacing

        design_panel.add_element(Button(35, button_y, 250, 40, "Apply Best Design", self.app.apply_best_design))
        button_y += spacing

        slider_y = button_y + 20

        def update_agent_count(value):
            current = len(self.app.agent_manager.agents)
            target = int(value)
            if target > current:
                for _ in range(target - current):
                    self.app.agent_manager.spawn_agent()
            elif target < current:
                for _ in range(current - target):
                    if self.app.agent_manager.agents:
                        self.app.agent_manager.agents.pop()

        self.agent_slider = Slider(35, slider_y, 250, "Agent Count",
                                   5, 50, len(self.app.agent_manager.agents),
                                   update_agent_count)
        design_panel.add_element(self.agent_slider)
        self.panels.append(design_panel)

        training_panel = Panel(self.width - 300, 20, 280, 350, "RL Training")

        button_y = 60
        training_panel.add_element(Button(self.width - 285, button_y, 250, 40,
                                          "Train 1 Episode", lambda: self.app.start_training(1)))
        button_y += spacing

        training_panel.add_element(Button(self.width - 285, button_y, 250, 40,
                                          "Train 10 Episodes", lambda: self.app.start_training(10)))
        button_y += spacing

        training_panel.add_element(Button(self.width - 285, button_y, 250, 40,
                                          "Train 100 Episodes", lambda: self.app.start_training(100)))
        button_y += spacing

        training_panel.add_element(Button(self.width - 285, button_y, 250, 40, "Stop Training",
                                          self.app.stop_training))
        button_y += spacing

        training_panel.add_element(Button(self.width - 285, button_y, 250, 40, "Test Baseline",
                                          self.app.test_baseline))

        self.panels.append(training_panel)

    def draw(self):
        if hasattr(self, 'agent_slider'):
            if not self.agent_slider.dragging and not self.agent_slider.selected:
                target = len(self.app.agent_manager.agents)
                if int(self.agent_slider.value) != target:
                    self.agent_slider.value = target
                    self.agent_slider.thumb_pos = self.agent_slider._value_to_pos()

        for panel in self.panels:
            panel.draw(self.surface, self.font, self.title_font)

        self._draw_metrics()

        if self.app.training_active:
            self._draw_training_status()
    
    def _draw_metrics(self):
        metrics = self.app.get_metrics()

        rect = pygame.Rect(20, self.height - 180, 280, 160)
        panel_surf = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        self.surface.blit(panel_surf, rect.topleft)
        pygame.draw.rect(self.surface, UIColors.ACCENT, rect, 2, border_radius=8)

        title = self.title_font.render("Metrics", True, UIColors.ACCENT)
        self.surface.blit(title, (rect.x + 15, rect.y + 10))

        y_offset = rect.y + 45
        for k, v in metrics.items():
            text = self.font.render(f"{k.title()}: {v:.2f}", True, UIColors.TEXT)
            self.surface.blit(text, (rect.x + 15, y_offset))
            y_offset += 22

    def _draw_training_status(self):
        rect = pygame.Rect(self.width // 2 - 150, 20, 300, 60)
        panel_surf = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, UIColors.PANEL, panel_surf.get_rect(), border_radius=8)
        self.surface.blit(panel_surf, rect.topleft)
        pygame.draw.rect(self.surface, UIColors.SUCCESS, rect, 2, border_radius=8)
        
        status_text = f"Training: {self.app.training_episodes_remaining} episodes left"
        text = self.title_font.render(status_text, True, UIColors.SUCCESS)
        self.surface.blit(text, text.get_rect(center=rect.center))

    def handle_event(self, event):
        for panel in self.panels:
            if panel.handle_event(event):
                return True
        return False
