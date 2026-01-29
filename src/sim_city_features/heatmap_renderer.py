"""
Heat Map Rendering Extension for Renderer3D - FIXED IMPORTS VERSION
Add this to your renderer3d.py file
"""

# Import numpy at module level (safe)
import numpy as np
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from sim_city_features.heatmap_system import HeatMapGenerator, HeatMapType
    from config import ElementType
except ImportError as e:
    print(f"Warning: Import error in heatmap_renderer: {e}")
    # Minimal stubs
    class HeatMapType:
        NONE = "none"
    class HeatMapGenerator: pass
    class ElementType:
        BENCH = "bench"
        TREE = "tree"
        FOUNTAIN = "fountain"
        STREET_LAMP = "lamp"


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
        
        # Import OpenGL only when rendering (lazy import)
        try:
            from OpenGL import GL
        except ImportError:
            print("Warning: OpenGL not available, skipping heat map rendering")
            return
        
        # Generate heat map data
        heatmap_data = self.generator.generate(self.current_type, agent_manager)
        
        if heatmap_data is None:
            return
        
        # Render heat map as colored quads
        self._render_heatmap_overlay(heatmap_data, GL)
        
    def _render_heatmap_overlay(self, heatmap_data: np.ndarray, GL):
        """Render heat map as ground overlay"""
        GL.glDisable(GL.GL_LIGHTING)
        GL.glEnable(GL.GL_BLEND)
        GL.glBlendFunc(GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA)
        
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
                GL.glColor4f(r, g, b, a)
                GL.glBegin(GL.GL_QUADS)
                GL.glVertex3f(x, 0.02, y)
                GL.glVertex3f(x + cell_size, 0.02, y)
                GL.glVertex3f(x + cell_size, 0.02, y + cell_size)
                GL.glVertex3f(x, 0.02, y + cell_size)
                GL.glEnd()
        
        GL.glEnable(GL.GL_LIGHTING)
    
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
        
        # Import OpenGL only when rendering
        try:
            from OpenGL import GL
        except ImportError:
            print("Warning: OpenGL not available, skipping influence radius rendering")
            return
        
        GL.glDisable(GL.GL_LIGHTING)
        GL.glEnable(GL.GL_BLEND)
        GL.glBlendFunc(GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA)
        GL.glLineWidth(2.0)
        
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
            self._draw_circle_filled(element.position.x, element.position.y, radius, color, 32, GL)
            
            # Draw border
            self._draw_circle_border(element.position.x, element.position.y, radius, border_color, 32, GL)
        
        GL.glLineWidth(1.0)
        GL.glEnable(GL.GL_LIGHTING)
    
    def _draw_circle_filled(self, x, z, radius, color, segments, GL):
        """Draw a filled circle on the ground"""
        GL.glColor4f(*color)
        GL.glBegin(GL.GL_TRIANGLE_FAN)
        GL.glVertex3f(x, 0.01, z)
        for i in range(segments + 1):
            angle = (i / segments) * 2 * 3.14159
            cx = x + np.cos(angle) * radius
            cz = z + np.sin(angle) * radius
            GL.glVertex3f(cx, 0.01, cz)
        GL.glEnd()
    
    def _draw_circle_border(self, x, z, radius, color, segments, GL):
        """Draw a circle border on the ground"""
        GL.glColor4f(*color)
        GL.glBegin(GL.GL_LINE_LOOP)
        for i in range(segments):
            angle = (i / segments) * 2 * 3.14159
            cx = x + np.cos(angle) * radius
            cz = z + np.sin(angle) * radius
            GL.glVertex3f(cx, 0.01, cz)
        GL.glEnd()