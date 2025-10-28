"""
Lighting Module
Handles lighting effects for the park visualization
"""

import numpy as np
import pygame
from typing import List, Tuple, Optional
from dataclasses import dataclass
import math

@dataclass
class Light:
    """Base class for all light sources"""
    position: Tuple[float, float, float]
    color: Tuple[int, int, int]
    intensity: float
    enabled: bool = True
    
    def calculate_illumination(self, point: Tuple[float, float, float]) -> float:
        """Calculate illumination at a given point"""
        if not self.enabled:
            return 0.0
        
        # Calculate distance
        dx = point[0] - self.position[0]
        dy = point[1] - self.position[1]
        dz = point[2] - self.position[2]
        distance = math.sqrt(dx**2 + dy**2 + dz**2)
        
        # Inverse square law
        if distance > 0:
            return self.intensity / (distance ** 2)
        return self.intensity


class PointLight(Light):
    """Omnidirectional point light source"""
    
    def __init__(self, position: Tuple[float, float, float],
                 color: Tuple[int, int, int] = (255, 255, 255),
                 intensity: float = 1.0,
                 radius: float = 10.0):
        super().__init__(position, color, intensity)
        self.radius = radius
        self.attenuation = (1.0, 0.1, 0.01)  # Constant, linear, quadratic
    
    def calculate_illumination(self, point: Tuple[float, float, float]) -> float:
        """Calculate illumination with attenuation"""
        if not self.enabled:
            return 0.0
        
        dx = point[0] - self.position[0]
        dy = point[1] - self.position[1]
        dz = point[2] - self.position[2]
        distance = math.sqrt(dx**2 + dy**2 + dz**2)
        
        if distance > self.radius:
            return 0.0
        
        # Attenuation formula
        attenuation = (self.attenuation[0] + 
                      self.attenuation[1] * distance + 
                      self.attenuation[2] * distance * distance)
        
        if attenuation > 0:
            return self.intensity / attenuation
        return 0.0


class SpotLight(Light):
    """Directional spotlight"""
    
    def __init__(self, position: Tuple[float, float, float],
                 direction: Tuple[float, float, float],
                 color: Tuple[int, int, int] = (255, 255, 255),
                 intensity: float = 1.0,
                 angle: float = 45.0,
                 focus: float = 1.0):
        super().__init__(position, color, intensity)
        self.direction = self._normalize(direction)
        self.angle = math.radians(angle)
        self.focus = focus
        self.range = 20.0
    
    def _normalize(self, vector: Tuple[float, float, float]) -> Tuple[float, float, float]:
        """Normalize a 3D vector"""
        length = math.sqrt(vector[0]**2 + vector[1]**2 + vector[2]**2)
        if length > 0:
            return (vector[0]/length, vector[1]/length, vector[2]/length)
        return (0, 0, 1)
    
    def calculate_illumination(self, point: Tuple[float, float, float]) -> float:
        """Calculate illumination for spotlight"""
        if not self.enabled:
            return 0.0
        
        # Vector from light to point
        to_point = (point[0] - self.position[0],
                   point[1] - self.position[1],
                   point[2] - self.position[2])
        distance = math.sqrt(to_point[0]**2 + to_point[1]**2 + to_point[2]**2)
        
        if distance > self.range or distance == 0:
            return 0.0
        
        # Normalize
        to_point = (to_point[0]/distance, to_point[1]/distance, to_point[2]/distance)
        
        # Dot product with direction
        dot = (to_point[0] * self.direction[0] + 
               to_point[1] * self.direction[1] + 
               to_point[2] * self.direction[2])
        
        # Check if within cone
        if dot < math.cos(self.angle):
            return 0.0
        
        # Apply focus falloff
        falloff = pow(dot, self.focus)
        
        # Distance attenuation
        attenuation = 1.0 - (distance / self.range)
        
        return self.intensity * falloff * attenuation


class AmbientLight:
    """Global ambient lighting"""
    
    def __init__(self, color: Tuple[int, int, int] = (50, 50, 60),
                 intensity: float = 0.3):
        self.color = color
        self.intensity = intensity
        self.enabled = True
    
    def get_ambient_color(self) -> Tuple[int, int, int]:
        """Get the ambient light color"""
        if not self.enabled:
            return (0, 0, 0)
        
        return tuple(int(c * self.intensity) for c in self.color)


class LightingSystem:
    """Manages all lights in the scene"""
    
    def __init__(self, screen_size: Tuple[int, int]):
        self.screen_width, self.screen_height = screen_size
        self.lights: List[Light] = []
        self.ambient_light = AmbientLight()
        
        # Light map for efficient rendering
        self.light_map_resolution = 50
        self.light_map = None
        self.shadow_map = None
        
        # Effects settings
        self.enable_shadows = True
        self.enable_bloom = False
        self.bloom_threshold = 0.8
        self.bloom_radius = 5
    
    def add_light(self, light: Light):
        """Add a light to the system"""
        self.lights.append(light)
    
    def remove_light(self, light: Light):
        """Remove a light from the system"""
        if light in self.lights:
            self.lights.remove(light)
    
    def clear_lights(self):
        """Remove all lights"""
        self.lights.clear()
    
    def calculate_lighting_at_point(self, point: Tuple[float, float, float]) -> Tuple[int, int, int]:
        """Calculate the total lighting at a point"""
        # Start with ambient
        r, g, b = self.ambient_light.get_ambient_color()
        
        # Add contribution from each light
        for light in self.lights:
            illumination = light.calculate_illumination(point)
            r += int(light.color[0] * illumination)
            g += int(light.color[1] * illumination)
            b += int(light.color[2] * illumination)
        
        # Clamp to valid range
        r = min(255, max(0, r))
        g = min(255, max(0, g))
        b = min(255, max(0, b))
        
        return (r, g, b)
    
    def generate_light_map(self, world_size: float) -> np.ndarray:
        """Generate a 2D light map for the ground plane"""
        resolution = self.light_map_resolution
        light_map = np.zeros((resolution, resolution, 3), dtype=np.uint8)
        
        # Add ambient light
        ambient = self.ambient_light.get_ambient_color()
        light_map[:, :] = ambient
        
        # Add light contributions
        for i in range(resolution):
            for j in range(resolution):
                # Convert to world coordinates
                x = (j / resolution - 0.5) * world_size
                y = (i / resolution - 0.5) * world_size
                z = 0  # Ground level
                
                # Calculate lighting
                for light in self.lights:
                    illumination = light.calculate_illumination((x, y, z))
                    
                    # Add light contribution
                    light_map[i, j, 0] = min(255, light_map[i, j, 0] + 
                                            int(light.color[0] * illumination))
                    light_map[i, j, 1] = min(255, light_map[i, j, 1] + 
                                            int(light.color[1] * illumination))
                    light_map[i, j, 2] = min(255, light_map[i, j, 2] + 
                                            int(light.color[2] * illumination))
        
        self.light_map = light_map
        return light_map
    
    def render_light_overlay(self, screen: pygame.Surface, 
                            world_to_screen_func) -> pygame.Surface:
        """Render lighting as an overlay"""
        # Create overlay surface
        overlay = pygame.Surface((self.screen_width, self.screen_height))
        overlay.set_alpha(200)
        overlay.fill((0, 0, 0))
        
        # Draw light circles for each light
        for light in self.lights:
            if not light.enabled:
                continue
            
            # Convert light position to screen
            screen_pos = world_to_screen_func(light.position[0], 
                                             light.position[1], 
                                             light.position[2])
            
            if screen_pos:
                if isinstance(light, PointLight):
                    # Draw radial gradient for point light
                    self._draw_radial_gradient(overlay, screen_pos, 
                                              light.radius * 10,  # Scale for screen
                                              light.color,
                                              light.intensity)
                
                elif isinstance(light, SpotLight):
                    # Draw cone for spotlight
                    self._draw_spot_cone(overlay, screen_pos,
                                        light.direction,
                                        light.angle,
                                        light.range * 10,
                                        light.color,
                                        light.intensity)
        
        return overlay
    
    def _draw_radial_gradient(self, surface: pygame.Surface,
                            center: Tuple[int, int],
                            radius: float,
                            color: Tuple[int, int, int],
                            intensity: float):
        """Draw a radial gradient for point lights"""
        radius = int(radius)
        
        for r in range(radius, 0, -2):
            # Calculate alpha based on distance
            alpha = int(255 * intensity * (1 - r / radius) ** 2)
            alpha = min(255, max(0, alpha))
            
            # Create color with alpha
            gradient_color = (*color, alpha)
            
            # Draw circle
            s = pygame.Surface((r*2, r*2), pygame.SRCALPHA)
            pygame.draw.circle(s, gradient_color, (r, r), r)
            surface.blit(s, (center[0]-r, center[1]-r), 
                        special_flags=pygame.BLEND_ADD)
    
    def _draw_spot_cone(self, surface: pygame.Surface,
                       position: Tuple[int, int],
                       direction: Tuple[float, float, float],
                       angle: float,
                       range: float,
                       color: Tuple[int, int, int],
                       intensity: float):
        """Draw a cone for spotlight"""
        # Calculate cone points
        angle_deg = math.degrees(angle)
        
        # Simplified 2D projection
        dir_angle = math.atan2(direction[1], direction[0])
        
        # Calculate cone edges
        left_angle = dir_angle - angle
        right_angle = dir_angle + angle
        
        # Create points for cone
        points = [position]
        
        left_x = position[0] + range * math.cos(left_angle)
        left_y = position[1] + range * math.sin(left_angle)
        points.append((int(left_x), int(left_y)))
        
        # Add arc points
        for i in range(5):
            t = (i + 1) / 6.0
            arc_angle = left_angle + (right_angle - left_angle) * t
            arc_x = position[0] + range * math.cos(arc_angle)
            arc_y = position[1] + range * math.sin(arc_angle)
            points.append((int(arc_x), int(arc_y)))
        
        right_x = position[0] + range * math.cos(right_angle)
        right_y = position[1] + range * math.sin(right_angle)
        points.append((int(right_x), int(right_y)))
        
        # Draw filled cone with transparency
        cone_surface = pygame.Surface((self.screen_width, self.screen_height), 
                                     pygame.SRCALPHA)
        pygame.draw.polygon(cone_surface, (*color, int(100 * intensity)), points)
        surface.blit(cone_surface, (0, 0), special_flags=pygame.BLEND_ADD)
    
    def apply_bloom_effect(self, screen: pygame.Surface) -> pygame.Surface:
        """Apply bloom effect to bright areas"""
        if not self.enable_bloom:
            return screen
        
        # Create bloom surface
        bloom_surface = pygame.Surface((self.screen_width, self.screen_height))
        
        # Extract bright pixels
        pixels = pygame.surfarray.array3d(screen)
        brightness = np.mean(pixels, axis=2)
        
        # Threshold
        bright_mask = brightness > (self.bloom_threshold * 255)
        
        # Apply Gaussian blur (simplified)
        for i in range(self.bloom_radius):
            bright_mask = self._blur_mask(bright_mask)
        
        # Create bloom overlay
        bloom_pixels = np.zeros_like(pixels)
        for c in range(3):
            bloom_pixels[:, :, c] = bright_mask * pixels[:, :, c]
        
        pygame.surfarray.blit_array(bloom_surface, bloom_pixels)
        
        # Blend with original
        screen.blit(bloom_surface, (0, 0), special_flags=pygame.BLEND_ADD)
        
        return screen
    
    def _blur_mask(self, mask: np.ndarray) -> np.ndarray:
        """Simple blur for bloom effect"""
        kernel = np.array([[1, 2, 1],
                          [2, 4, 2],
                          [1, 2, 1]]) / 16.0
        
        # Simplified convolution
        blurred = np.zeros_like(mask, dtype=float)
        h, w = mask.shape
        
        for i in range(1, h-1):
            for j in range(1, w-1):
                blurred[i, j] = np.sum(mask[i-1:i+2, j-1:j+2] * kernel)
        
        return blurred
    
    def create_shadow_map(self, light_position: Tuple[float, float, float],
                         obstacles: List) -> np.ndarray:
        """Create a shadow map for a light source"""
        # Simplified shadow mapping
        resolution = 100
        shadow_map = np.ones((resolution, resolution))
        
        # This would implement shadow casting logic
        # For now, return a simple shadow map
        
        self.shadow_map = shadow_map
        return shadow_map