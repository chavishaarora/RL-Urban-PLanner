"""
Heat Map Rendering Extension for Renderer3D
Add this to your renderer3d.py file
"""

from OpenGL.GL import *
import numpy as np
import sys
sys.path.insert(0, '/home/claude')
from heatmap_system import HeatMapGenerator, HeatMapType


class HeatMapRenderer:
    """Renders heat maps as overlay on the ground plane"""
    
    def __init__(self, park):
        self.park = park
        self.generator = HeatMapGenerator(park, resolution=40)
        self.current_type = HeatMapType.NONE
        self.show_legend = True
        
    def set_heatmap_type(self, heatmap_type: HeatMapType):
        """Switch to a different heat map type"""
        self.current_type = heatmap_type
        print(f"🗺️  Heat Map: {heatmap_type.value}")
        
    def toggle_legend(self):
        """Toggle legend visibility"""
        self.show_legend = not self.show_legend
        
    def render(self, agent_manager=None):
        """Render the current heat map"""
        if self.current_type == HeatMapType.NONE:
            return
        
        # Generate heat map data
        heatmap_data = self.generator.generate(self.current_type, agent_manager)
        
        if heatmap_data is None:
            return
        
        # Render heat map as colored quads
        self._render_heatmap_overlay(heatmap_data)
        
    def _render_heatmap_overlay(self, heatmap_data: np.ndarray):
        """Render heat map as ground overlay"""
        glDisable(GL_LIGHTING)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        resolution = heatmap_data.shape[0]
        half_size = self.park.size / 2
        cell_size = self.park.size / resolution
        
        for i in range(resolution):
            for j in range(resolution):
                value = heatmap_data[i, j]
                
                # Get color for this value
                r, g, b, a = HeatMapGenerator.get_color_for_value(value, self.current_type)
                
                # Calculate world position
                x = (j / resolution) * self.park.size - half_size
                y = (i / resolution) * self.park.size - half_size
                
                # Draw colored quad
                glColor4f(r, g, b, a)
                glBegin(GL_QUADS)
                glVertex3f(x, 0.02, y)
                glVertex3f(x + cell_size, 0.02, y)
                glVertex3f(x + cell_size, 0.02, y + cell_size)
                glVertex3f(x, 0.02, y + cell_size)
                glEnd()
        
        glEnable(GL_LIGHTING)
    
    def clear_cache(self):
        """Clear heat map cache when park changes"""
        self.generator.clear_cache()


class InfluenceRadiusRenderer:
    """Renders influence radii for park elements (SimCity-style)"""
    
    def __init__(self, park):
        self.park = park
        self.show_all = False
        self.show_type = None
        self.highlight_element = None
        
    def toggle_all(self):
        """Toggle showing all influence radii"""
        self.show_all = not self.show_all
        print(f"🔵 Influence Radii: {'ON' if self.show_all else 'OFF'}")
        
    def set_type_filter(self, element_type):
        """Show only radii for specific element type"""
        self.show_type = element_type
        self.show_all = True
        
    def set_highlight(self, element):
        """Highlight a specific element's radius"""
        self.highlight_element = element
        
    def render(self):
        """Render influence radii"""
        if not self.show_all and self.highlight_element is None:
            return
        
        glDisable(GL_LIGHTING)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        glLineWidth(2.0)
        
        from config import ElementType
        
        for element in self.park.elements:
            # Skip if type filter is active and doesn't match
            if self.show_type and element.element_type != self.show_type:
                continue
            
            # Skip if not highlighted and not showing all
            if not self.show_all and element != self.highlight_element:
                continue
            
            # Determine radius and color based on element type
            if element.element_type == ElementType.TREE:
                radius = element.size / 2 + 1.5  # Shade radius
                color = (0.2, 0.8, 0.2, 0.3)  # Green
                border_color = (0.2, 0.8, 0.2, 0.6)
            elif element.element_type == ElementType.FOUNTAIN:
                radius = 8.0  # Cooling radius
                color = (0.2, 0.5, 0.9, 0.25)  # Blue
                border_color = (0.2, 0.5, 0.9, 0.6)
            elif element.element_type == ElementType.STREET_LAMP:
                radius = 8.0  # Light radius
                color = (1.0, 0.9, 0.4, 0.2)  # Yellow
                border_color = (1.0, 0.9, 0.4, 0.5)
            elif element.element_type == ElementType.BENCH:
                radius = 2.5  # Comfort radius
                color = (0.8, 0.5, 0.2, 0.2)  # Orange
                border_color = (0.8, 0.5, 0.2, 0.5)
            else:
                continue
            
            # Highlight effect
            if element == self.highlight_element:
                color = (color[0], color[1], color[2], color[3] * 2)
                border_color = (1.0, 1.0, 1.0, 0.8)
            
            # Draw filled circle
            self._draw_circle_filled(element.position.x, element.position.y, radius, color, 32)
            
            # Draw border
            self._draw_circle_border(element.position.x, element.position.y, radius, border_color, 32)
        
        glLineWidth(1.0)
        glEnable(GL_LIGHTING)
    
    def _draw_circle_filled(self, x, z, radius, color, segments=32):
        """Draw a filled circle on the ground"""
        glColor4f(*color)
        glBegin(GL_TRIANGLE_FAN)
        glVertex3f(x, 0.01, z)
        for i in range(segments + 1):
            angle = (i / segments) * 2 * 3.14159
            cx = x + np.cos(angle) * radius
            cz = z + np.sin(angle) * radius
            glVertex3f(cx, 0.01, cz)
        glEnd()
    
    def _draw_circle_border(self, x, z, radius, color, segments=32):
        """Draw a circle border on the ground"""
        glColor4f(*color)
        glBegin(GL_LINE_LOOP)
        for i in range(segments):
            angle = (i / segments) * 2 * 3.14159
            cx = x + np.cos(angle) * radius
            cz = z + np.sin(angle) * radius
            glVertex3f(cx, 0.01, cz)
        glEnd()