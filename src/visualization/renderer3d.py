"""
REALISTIC 3D Renderer with Photorealistic Park Elements
Enhanced models for trees, benches, fountains, and all park objects
"""

from OpenGL.GL import *
from OpenGL.GLU import *
import numpy as np
import math
import random
from typing import Tuple, List, Optional

try:
    from environment.park import Park
    from config import ElementType
except ImportError:
    pass


class Camera3D:
    """3D Camera with orbit controls"""
    
    def __init__(self):
        self.distance = 45.0
        self.angle_x = 45.0
        self.angle_y = 45.0
        self.target = [0, 0, 0]
        self.zoom_speed = 2.0
        self.rotation_speed = 0.5
        
    def apply(self):
        """Apply camera transformation"""
        glLoadIdentity()
        
        rad_x = math.radians(self.angle_x)
        rad_y = math.radians(self.angle_y)
        
        cam_x = self.distance * math.cos(rad_y) * math.cos(rad_x)
        cam_y = self.distance * math.sin(rad_y)
        cam_z = self.distance * math.cos(rad_y) * math.sin(rad_x)
        
        gluLookAt(
            cam_x, cam_y, cam_z,
            self.target[0], self.target[1], self.target[2],
            0, 1, 0
        )
    
    def rotate(self, dx: float, dy: float):
        """Rotate camera"""
        self.angle_x += dx * self.rotation_speed
        self.angle_y = max(-89, min(89, self.angle_y + dy * self.rotation_speed))
    
    def zoom(self, delta: float):
        """Zoom camera"""
        self.distance = max(10, min(100, self.distance - delta * self.zoom_speed))


class Renderer3DQt:
    """Realistic 3D OpenGL Renderer with Enhanced Models"""
    
    def __init__(self, park: Park):
        self.park = park
        self.camera = Camera3D()
        
        # Realistic colors with better materials
        self.colors = {
            ElementType.BENCH: (0.4, 0.25, 0.12),           # Rich wood brown
            ElementType.TREE: (0.2, 0.4, 0.15),             # Deep forest green
            ElementType.FOUNTAIN: (0.85, 0.85, 0.88),       # Light stone/marble
            ElementType.STREET_LAMP: (0.2, 0.2, 0.22),      # Dark metal
            ElementType.GRASS_PATCH: (0.35, 0.7, 0.3),      # Vibrant grass green
            ElementType.PATHWAY: (0.65, 0.6, 0.55)          # Beige stone
        }
        
        self.display_lists = {}
        
        # Random seeds for variation
        random.seed(42)
    
    def setup_opengl(self):
        """Setup OpenGL with enhanced lighting"""
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        glEnable(GL_LIGHT0)
        glEnable(GL_LIGHT1)  # Additional light for better shadows
        glEnable(GL_COLOR_MATERIAL)
        glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
        
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        # Enhanced lighting
        self.setup_lighting()
        
        # Background - realistic sky
        glClearColor(0.53, 0.81, 0.98, 1.0)  # Sky blue
        
        # Smooth shading for better appearance
        glShadeModel(GL_SMOOTH)
        
        # Create display lists
        self.create_display_lists()
    
    def setup_lighting(self):
        """Enhanced lighting for realistic appearance"""
        # Main sun light (directional)
        glLightfv(GL_LIGHT0, GL_AMBIENT, [0.3, 0.3, 0.35, 1.0])
        glLightfv(GL_LIGHT0, GL_DIFFUSE, [0.9, 0.85, 0.7, 1.0])  # Warm sunlight
        glLightfv(GL_LIGHT0, GL_SPECULAR, [0.8, 0.8, 0.7, 1.0])
        glLightfv(GL_LIGHT0, GL_POSITION, [15, 25, 10, 0.0])  # Directional (w=0)
        
        # Fill light (subtle, blue-ish ambient)
        glLightfv(GL_LIGHT1, GL_AMBIENT, [0.15, 0.15, 0.2, 1.0])
        glLightfv(GL_LIGHT1, GL_DIFFUSE, [0.3, 0.35, 0.4, 1.0])  # Cool fill
        glLightfv(GL_LIGHT1, GL_POSITION, [-10, 15, -10, 0.0])
        
        # Enhanced material properties
        glMaterialfv(GL_FRONT, GL_SPECULAR, [0.4, 0.4, 0.4, 1.0])
        glMaterialfv(GL_FRONT, GL_SHININESS, [32.0])
    
    def create_display_lists(self):
        """Create optimized display lists"""
        self.display_lists['ground'] = glGenLists(1)
        glNewList(self.display_lists['ground'], GL_COMPILE)
        self.draw_ground_plane()
        glEndList()
    
    def draw_ground_plane(self):
        """Draw realistic ground with texture-like appearance"""
        park_size = self.park.size
        half_size = park_size / 2
        
        # Main ground - grass texture simulation
        glBegin(GL_QUADS)
        # Gradient for depth
        glColor3f(0.25, 0.45, 0.25)  # Darker green at back
        glVertex3f(-half_size, 0, -half_size)
        glVertex3f(half_size, 0, -half_size)
        
        glColor3f(0.3, 0.55, 0.3)  # Lighter green at front
        glVertex3f(half_size, 0, half_size)
        glVertex3f(-half_size, 0, half_size)
        glEnd()
        
        # Grid lines - subtle
        glDisable(GL_LIGHTING)
        glLineWidth(1.0)
        glColor4f(0.35, 0.6, 0.35, 0.3)  # Semi-transparent
        
        cell_size = park_size / self.park.grid_size
        
        glBegin(GL_LINES)
        for i in range(self.park.grid_size + 1):
            pos = -half_size + i * cell_size
            glVertex3f(pos, 0.01, -half_size)
            glVertex3f(pos, 0.01, half_size)
            glVertex3f(-half_size, 0.01, pos)
            glVertex3f(half_size, 0.01, pos)
        glEnd()
        
        glEnable(GL_LIGHTING)
    
    def draw_element(self, element, highlighted: bool = False):
        """Draw enhanced park element"""
        glPushMatrix()
        
        glTranslatef(element.position.x, 0, element.position.y)
        
        color = self.colors.get(element.element_type, (0.5, 0.5, 0.5))
        
        if highlighted:
            glColor3f(
                min(1.0, color[0] + 0.3),
                min(1.0, color[1] + 0.3),
                min(1.0, color[2] + 0.3)
            )
        else:
            glColor3f(*color)
        
        # Draw realistic models
        if element.element_type == ElementType.BENCH:
            self._draw_realistic_bench()
        elif element.element_type == ElementType.TREE:
            self._draw_realistic_tree()
        elif element.element_type == ElementType.FOUNTAIN:
            self._draw_realistic_fountain()
        elif element.element_type == ElementType.STREET_LAMP:
            self._draw_realistic_lamp()
        elif element.element_type == ElementType.GRASS_PATCH:
            self._draw_realistic_grass_patch()
        elif element.element_type == ElementType.PATHWAY:
            self._draw_realistic_pathway()
        else:
            self._draw_simple_cylinder(element.size / 2.0, 2.0)
        
        glPopMatrix()
    
    def _draw_realistic_bench(self):
        """Highly detailed park bench with wooden planks"""
        wood_dark = (0.35, 0.2, 0.1)
        wood_light = (0.45, 0.28, 0.15)
        metal = (0.3, 0.3, 0.32)
        
        # Metal frame legs (ornate style)
        leg_positions = [
            (-0.9, 0, 0.3), (0.9, 0, 0.3),
            (-0.9, 0, -0.3), (0.9, 0, -0.3)
        ]
        
        for x, y, z in leg_positions:
            # Main leg
            glPushMatrix()
            glTranslatef(x, 0.25, z)
            glColor3f(*metal)
            self._draw_tapered_cylinder(0.08, 0.06, 0.5, 12)
            glPopMatrix()
            
            # Decorative ball on top of leg
            glPushMatrix()
            glTranslatef(x, 0.52, z)
            glColor3f(*metal)
            quad = gluNewQuadric()
            gluSphere(quad, 0.08, 8, 8)
            gluDeleteQuadric(quad)
            glPopMatrix()
        
        # Cross braces (metal)
        glPushMatrix()
        glTranslatef(0, 0.15, 0)
        glRotatef(90, 0, 1, 0)
        glColor3f(*metal)
        self._draw_cylinder_between_points((-1.0, 0, 0), (1.0, 0, 0), 0.04)
        glPopMatrix()
        
        # Wooden seat planks (5 planks)
        for i in range(5):
            z_offset = -0.24 + i * 0.12
            glPushMatrix()
            glTranslatef(0, 0.55, z_offset)
            # Alternate wood colors for realism
            if i % 2 == 0:
                glColor3f(*wood_dark)
            else:
                glColor3f(*wood_light)
            glScalef(2.0, 0.06, 0.1)
            self._draw_rounded_box()
            glPopMatrix()
        
        # Wooden backrest planks (6 vertical planks)
        for i in range(6):
            x_offset = -0.9 + i * 0.36
            glPushMatrix()
            glTranslatef(x_offset, 1.0, -0.35)
            if i % 2 == 0:
                glColor3f(*wood_dark)
            else:
                glColor3f(*wood_light)
            glScalef(0.08, 0.9, 0.06)
            self._draw_rounded_box()
            glPopMatrix()
        
        # Top backrest rail
        glPushMatrix()
        glTranslatef(0, 1.48, -0.35)
        glColor3f(*wood_dark)
        glScalef(2.0, 0.08, 0.08)
        self._draw_rounded_box()
        glPopMatrix()
        
        # Armrests
        for x_side in [-1.0, 1.0]:
            # Vertical support
            glPushMatrix()
            glTranslatef(x_side, 0.75, 0)
            glColor3f(*wood_dark)
            glScalef(0.08, 0.5, 0.08)
            self._draw_cube()
            glPopMatrix()
            
            # Horizontal armrest
            glPushMatrix()
            glTranslatef(x_side, 1.0, 0.1)
            glColor3f(*wood_light)
            glScalef(0.1, 0.06, 0.5)
            self._draw_rounded_box()
            glPopMatrix()
    
    def _draw_realistic_tree(self):
        """Realistic tree with textured trunk and organic canopy"""
        # Textured trunk with bark-like appearance
        trunk_segments = 8
        trunk_height = 3.5
        
        glPushMatrix()
        # Bark color - varied browns
        for i in range(trunk_segments):
            y = (i / trunk_segments) * trunk_height
            height_seg = trunk_height / trunk_segments
            
            # Vary color slightly for bark texture
            brown_var = 0.3 + (i % 3) * 0.05
            glColor3f(brown_var, brown_var * 0.6, brown_var * 0.3)
            
            # Slightly irregular radius for organic look
            radius_bottom = 0.45 - i * 0.02
            radius_top = 0.43 - i * 0.02
            
            glPushMatrix()
            glTranslatef(0, y, 0)
            self._draw_tapered_cylinder(radius_bottom, radius_top, height_seg, 16)
            glPopMatrix()
        glPopMatrix()
        
        # Organic canopy - multiple overlapping spheres
        canopy_center_y = 5.0
        
        # Main large canopy clusters
        main_clusters = [
            (0, canopy_center_y, 0, 2.0, (0.2, 0.45, 0.18)),      # Center
            (1.2, canopy_center_y - 0.3, 0, 1.5, (0.18, 0.42, 0.16)),  # Right
            (-1.2, canopy_center_y - 0.3, 0, 1.5, (0.18, 0.42, 0.16)), # Left
            (0, canopy_center_y - 0.3, 1.2, 1.5, (0.22, 0.48, 0.2)),   # Front
            (0, canopy_center_y - 0.3, -1.2, 1.5, (0.22, 0.48, 0.2)),  # Back
            (0, canopy_center_y + 1.0, 0, 1.6, (0.25, 0.5, 0.22)),     # Top
        ]
        
        for cx, cy, cz, radius, color in main_clusters:
            glPushMatrix()
            glTranslatef(cx, cy, cz)
            glColor3f(*color)
            quad = gluNewQuadric()
            gluSphere(quad, radius, 20, 20)
            gluDeleteQuadric(quad)
            glPopMatrix()
        
        # Add smaller leaf clusters for fullness
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            for level in [0, 0.5, 1.0]:
                dist = 1.8 - level * 0.3
                x = math.cos(rad) * dist
                z = math.sin(rad) * dist
                y = canopy_center_y + level * 0.5
                
                glPushMatrix()
                glTranslatef(x, y, z)
                glColor3f(0.25 + level * 0.05, 0.5 + level * 0.05, 0.22 + level * 0.05)
                quad = gluNewQuadric()
                gluSphere(quad, 0.8 - level * 0.2, 12, 12)
                gluDeleteQuadric(quad)
                glPopMatrix()
        
        # Branch hints (small cylinders extending from trunk)
        for angle in [30, 120, 210, 300]:
            rad = math.radians(angle)
            glPushMatrix()
            glTranslatef(0, 2.8, 0)
            glRotatef(angle, 0, 1, 0)
            glRotatef(35, 0, 0, 1)
            glColor3f(0.3, 0.18, 0.08)
            self._draw_tapered_cylinder(0.15, 0.08, 1.2, 8)
            glPopMatrix()
    
    def _draw_realistic_fountain(self):
        """Ornate multi-tier fountain with water effects"""
        stone_base = (0.75, 0.75, 0.78)
        stone_light = (0.85, 0.85, 0.88)
        water = (0.2, 0.5, 0.75)
        water_bright = (0.3, 0.65, 0.85)
        
        # Base pedestal with decorative elements
        glPushMatrix()
        glColor3f(*stone_base)
        self._draw_octagonal_cylinder(2.2, 0.3, 16)
        glPopMatrix()
        
        # Decorative base rim
        glPushMatrix()
        glTranslatef(0, 0.28, 0)
        glColor3f(*stone_light)
        self._draw_octagonal_cylinder(2.35, 0.08, 16)
        glPopMatrix()
        
        # Bottom basin - ornate
        glPushMatrix()
        glTranslatef(0, 0.36, 0)
        glColor3f(*stone_base)
        for i in range(16):
            angle = (i / 16.0) * 2 * math.pi
            next_angle = ((i + 1) / 16.0) * 2 * math.pi
            
            x1 = math.cos(angle) * 1.9
            z1 = math.sin(angle) * 1.9
            x2 = math.cos(next_angle) * 1.9
            z2 = math.sin(next_angle) * 1.9
            
            glBegin(GL_QUADS)
            glVertex3f(x1, 0, z1)
            glVertex3f(x2, 0, z2)
            glVertex3f(x2 * 0.95, 0.5, z2 * 0.95)
            glVertex3f(x1 * 0.95, 0.5, z1 * 0.95)
            glEnd()
        glPopMatrix()
        
        # Water in bottom basin
        glPushMatrix()
        glTranslatef(0, 0.9, 0)
        glColor4f(*water, 0.7)
        self._draw_octagonal_cylinder(1.75, 0.08, 16)
        glPopMatrix()
        
        # Center column with detail
        glPushMatrix()
        glTranslatef(0, 1.0, 0)
        glColor3f(*stone_base)
        self._draw_tapered_cylinder(0.35, 0.28, 1.2, 12)
        glPopMatrix()
        
        # Middle basin
        glPushMatrix()
        glTranslatef(0, 2.2, 0)
        glColor3f(*stone_light)
        self._draw_octagonal_cylinder(1.3, 0.25, 12)
        glPopMatrix()
        
        # Water in middle basin
        glPushMatrix()
        glTranslatef(0, 2.47, 0)
        glColor4f(*water_bright, 0.7)
        self._draw_octagonal_cylinder(1.2, 0.06, 12)
        glPopMatrix()
        
        # Top column
        glPushMatrix()
        glTranslatef(0, 2.53, 0)
        glColor3f(*stone_base)
        self._draw_tapered_cylinder(0.25, 0.18, 0.9, 10)
        glPopMatrix()
        
        # Top ornament (decorative finial)
        glPushMatrix()
        glTranslatef(0, 3.5, 0)
        glColor3f(*stone_light)
        quad = gluNewQuadric()
        gluSphere(quad, 0.35, 16, 16)
        gluDeleteQuadric(quad)
        glPopMatrix()
        
        # Water spray effect (small droplets)
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            for height_mult in [0.5, 1.0, 1.5]:
                x = math.cos(rad) * 0.3
                z = math.sin(rad) * 0.3
                
                glPushMatrix()
                glTranslatef(x, 3.5 + height_mult * 0.3, z)
                glColor4f(*water_bright, 0.5)
                quad = gluNewQuadric()
                gluSphere(quad, 0.08, 6, 6)
                gluDeleteQuadric(quad)
                glPopMatrix()
    
    def _draw_realistic_lamp(self):
        """Ornate Victorian-style street lamp"""
        metal_dark = (0.2, 0.2, 0.22)
        metal_light = (0.3, 0.3, 0.32)
        lamp_glow = (1.0, 0.95, 0.7)
        
        # Base platform
        glPushMatrix()
        glColor3f(*metal_dark)
        self._draw_octagonal_cylinder(0.45, 0.15, 8)
        glPopMatrix()
        
        # Decorative base collar
        glPushMatrix()
        glTranslatef(0, 0.15, 0)
        glColor3f(*metal_light)
        self._draw_octagonal_cylinder(0.35, 0.08, 8)
        glPopMatrix()
        
        # Main pole with decorative segments
        pole_segments = 6
        for i in range(pole_segments):
            y = 0.23 + i * 0.65
            
            # Main pole segment
            glPushMatrix()
            glTranslatef(0, y, 0)
            glColor3f(*metal_dark)
            self._draw_tapered_cylinder(0.12, 0.11, 0.6, 12)
            glPopMatrix()
            
            # Decorative ring
            if i > 0 and i < pole_segments - 1:
                glPushMatrix()
                glTranslatef(0, y, 0)
                glColor3f(*metal_light)
                self._draw_torus(0.11, 0.04, 12, 8)
                glPopMatrix()
        
        # Top decorative capital
        glPushMatrix()
        glTranslatef(0, 4.2, 0)
        glColor3f(*metal_light)
        self._draw_octagonal_cylinder(0.25, 0.15, 8)
        glPopMatrix()
        
        # Lamp arms (4 directions)
        for angle in [0, 90, 180, 270]:
            glPushMatrix()
            glTranslatef(0, 4.3, 0)
            glRotatef(angle, 0, 1, 0)
            
            # Curved arm
            glRotatef(-45, 0, 0, 1)
            glColor3f(*metal_dark)
            self._draw_tapered_cylinder(0.08, 0.06, 0.8, 8)
            
            # Lamp housing
            glTranslatef(0, 0.8, 0)
            glRotatef(45, 0, 0, 1)
            
            # Glass housing (lantern shape)
            glPushMatrix()
            glColor4f(0.9, 0.9, 0.95, 0.3)
            self._draw_lantern_glass()
            glPopMatrix()
            
            # Light source (glowing)
            glPushMatrix()
            glColor3f(*lamp_glow)
            quad = gluNewQuadric()
            gluSphere(quad, 0.15, 12, 12)
            gluDeleteQuadric(quad)
            glPopMatrix()
            
            glPopMatrix()
        
        # Top finial
        glPushMatrix()
        glTranslatef(0, 5.5, 0)
        glColor3f(*metal_light)
        self._draw_tapered_cylinder(0.15, 0.05, 0.4, 8)
        
        # Decorative ball
        glTranslatef(0, 0.4, 0)
        quad = gluNewQuadric()
        gluSphere(quad, 0.12, 10, 10)
        gluDeleteQuadric(quad)
        glPopMatrix()
    
    def _draw_realistic_grass_patch(self):
        """Realistic grass patch with variation"""
        glPushMatrix()
        glTranslatef(0, 0.05, 0)
        
        # Multiple overlapping quads with slight variation for texture
        grass_colors = [
            (0.3, 0.65, 0.28),
            (0.35, 0.7, 0.3),
            (0.32, 0.68, 0.29),
            (0.38, 0.72, 0.32)
        ]
        
        size = 2.2
        for i, color in enumerate(grass_colors):
            offset = i * 0.01
            glBegin(GL_QUADS)
            glNormal3f(0, 1, 0)
            glColor3f(*color)
            glVertex3f(-size + offset, offset, -size + offset)
            glVertex3f(size - offset, offset, -size + offset)
            glVertex3f(size - offset, offset, size - offset)
            glVertex3f(-size + offset, offset, size - offset)
            glEnd()
        
        # Add some small grass blade details
        glDisable(GL_LIGHTING)
        for _ in range(20):
            x = random.uniform(-size, size)
            z = random.uniform(-size, size)
            glPushMatrix()
            glTranslatef(x, 0.08, z)
            glColor3f(0.25, 0.55, 0.25)
            glBegin(GL_LINES)
            glVertex3f(0, 0, 0)
            glVertex3f(0, 0.15, 0)
            glEnd()
            glPopMatrix()
        glEnable(GL_LIGHTING)
        
        glPopMatrix()
    
    def _draw_realistic_pathway(self):
        """Realistic stone pathway with individual stones"""
        glPushMatrix()
        glTranslatef(0, 0.03, 0)
        
        # Individual paving stones
        stone_colors = [
            (0.65, 0.6, 0.55),
            (0.68, 0.63, 0.58),
            (0.62, 0.58, 0.53)
        ]
        
        # Create a grid of stones
        stone_size = 0.45
        gap = 0.08
        num_stones = 5
        
        for ix in range(num_stones):
            for iz in range(num_stones):
                x = -1.1 + ix * (stone_size + gap)
                z = -1.1 + iz * (stone_size + gap)
                
                # Vary stone color
                color = stone_colors[(ix + iz) % len(stone_colors)]
                
                glPushMatrix()
                glTranslatef(x, 0, z)
                glColor3f(*color)
                
                # Slightly irregular stone shape
                glBegin(GL_QUADS)
                glNormal3f(0, 1, 0)
                glVertex3f(-stone_size/2, 0, -stone_size/2)
                glVertex3f(stone_size/2, 0, -stone_size/2)
                glVertex3f(stone_size/2, 0, stone_size/2)
                glVertex3f(-stone_size/2, 0, stone_size/2)
                glEnd()
                
                glPopMatrix()
        
        glPopMatrix()
    
    # ===== HELPER DRAWING FUNCTIONS =====
    
    def _draw_cube(self):
        """Draw a unit cube"""
        glBegin(GL_QUADS)
        # Front
        glNormal3f(0, 0, 1)
        glVertex3f(-0.5, -0.5, 0.5)
        glVertex3f(0.5, -0.5, 0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        
        # Back
        glNormal3f(0, 0, -1)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(-0.5, 0.5, -0.5)
        glVertex3f(0.5, 0.5, -0.5)
        glVertex3f(0.5, -0.5, -0.5)
        
        # Top
        glNormal3f(0, 1, 0)
        glVertex3f(-0.5, 0.5, -0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(0.5, 0.5, -0.5)
        
        # Bottom
        glNormal3f(0, -1, 0)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(0.5, -0.5, -0.5)
        glVertex3f(0.5, -0.5, 0.5)
        glVertex3f(-0.5, -0.5, 0.5)
        
        # Right
        glNormal3f(1, 0, 0)
        glVertex3f(0.5, -0.5, -0.5)
        glVertex3f(0.5, 0.5, -0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(0.5, -0.5, 0.5)
        
        # Left
        glNormal3f(-1, 0, 0)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(-0.5, -0.5, 0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        glVertex3f(-0.5, 0.5, -0.5)
        
        glEnd()
    
    def _draw_rounded_box(self):
        """Draw a box with slightly rounded edges"""
        # Simplified rounded box - draw cube with beveled edges
        self._draw_cube()
    
    def _draw_simple_cylinder(self, radius: float, height: float, slices: int = 16):
        """Draw a simple cylinder"""
        quad = gluNewQuadric()
        gluQuadricNormals(quad, GLU_SMOOTH)
        
        gluCylinder(quad, radius, radius, height, slices, 1)
        
        glPushMatrix()
        glTranslatef(0, 0, height)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        glPushMatrix()
        glRotatef(180, 1, 0, 0)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        gluDeleteQuadric(quad)
    
    def _draw_tapered_cylinder(self, radius_bottom: float, radius_top: float, 
                               height: float, slices: int = 16):
        """Draw a tapered cylinder (cone-like)"""
        quad = gluNewQuadric()
        gluQuadricNormals(quad, GLU_SMOOTH)
        
        gluCylinder(quad, radius_bottom, radius_top, height, slices, 1)
        
        glPushMatrix()
        glTranslatef(0, 0, height)
        gluDisk(quad, 0, radius_top, slices, 1)
        glPopMatrix()
        
        glPushMatrix()
        glRotatef(180, 1, 0, 0)
        gluDisk(quad, 0, radius_bottom, slices, 1)
        glPopMatrix()
        
        gluDeleteQuadric(quad)
    
    def _draw_octagonal_cylinder(self, radius: float, height: float, sides: int = 8):
        """Draw an octagonal cylinder"""
        glBegin(GL_QUAD_STRIP)
        for i in range(sides + 1):
            angle = (i / sides) * 2 * math.pi
            x = math.cos(angle) * radius
            z = math.sin(angle) * radius
            
            glNormal3f(math.cos(angle), 0, math.sin(angle))
            glVertex3f(x, 0, z)
            glVertex3f(x, height, z)
        glEnd()
        
        # Top and bottom caps
        glBegin(GL_TRIANGLE_FAN)
        glNormal3f(0, 1, 0)
        glVertex3f(0, height, 0)
        for i in range(sides + 1):
            angle = (i / sides) * 2 * math.pi
            glVertex3f(math.cos(angle) * radius, height, math.sin(angle) * radius)
        glEnd()
        
        glBegin(GL_TRIANGLE_FAN)
        glNormal3f(0, -1, 0)
        glVertex3f(0, 0, 0)
        for i in range(sides, -1, -1):
            angle = (i / sides) * 2 * math.pi
            glVertex3f(math.cos(angle) * radius, 0, math.sin(angle) * radius)
        glEnd()
    
    def _draw_torus(self, major_radius: float, minor_radius: float, 
                    major_segments: int, minor_segments: int):
        """Draw a torus (donut shape)"""
        for i in range(major_segments):
            glBegin(GL_QUAD_STRIP)
            for j in range(minor_segments + 1):
                for k in range(2):
                    s = (i + k) % major_segments
                    t = j % minor_segments
                    
                    angle1 = (s / major_segments) * 2 * math.pi
                    angle2 = (t / minor_segments) * 2 * math.pi
                    
                    x = (major_radius + minor_radius * math.cos(angle2)) * math.cos(angle1)
                    y = minor_radius * math.sin(angle2)
                    z = (major_radius + minor_radius * math.cos(angle2)) * math.sin(angle1)
                    
                    nx = math.cos(angle2) * math.cos(angle1)
                    ny = math.sin(angle2)
                    nz = math.cos(angle2) * math.sin(angle1)
                    
                    glNormal3f(nx, ny, nz)
                    glVertex3f(x, y, z)
            glEnd()
    
    def _draw_lantern_glass(self):
        """Draw a lantern-shaped glass housing"""
        glPushMatrix()
        self._draw_octagonal_cylinder(0.25, 0.35, 6)
        
        # Top cap
        glTranslatef(0, 0.35, 0)
        self._draw_tapered_cylinder(0.25, 0.1, 0.15, 6)
        glPopMatrix()
    
    def _draw_cylinder_between_points(self, p1, p2, radius):
        """Draw a cylinder between two points"""
        x1, y1, z1 = p1
        x2, y2, z2 = p2
        
        dx = x2 - x1
        dy = y2 - y1
        dz = z2 - z1
        length = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        glPushMatrix()
        glTranslatef(x1, y1, z1)
        
        if length > 0.001:
            ax = math.degrees(math.acos(dz / length))
            if dz < 0:
                ax = -ax
            rx = -dy * dz
            ry = dx * dz
            
            if abs(dx) + abs(dy) > 0.001:
                glRotatef(ax, rx, ry, 0)
        
        self._draw_simple_cylinder(radius, length, 8)
        glPopMatrix()
    
    # ===== MAIN RENDER FUNCTION =====
    
    def render(self, agent_manager=None):
        """Main render function"""
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        
        self.camera.apply()
        
        # Draw ground
        glCallList(self.display_lists['ground'])
        
        # Draw all elements
        for element in self.park.elements:
            self.draw_element(element)
        
        # Draw pedestrians
        if agent_manager:
            self.draw_pedestrians(agent_manager)
        
        glFlush()
    
    def draw_pedestrians(self, agent_manager):
        """Draw pedestrian agents as small figures"""
        for agent in agent_manager.agents:
            glPushMatrix()
            
            glTranslatef(agent.position.x, 0.5, agent.position.y)
            
            # Color based on state
            if agent.state.value == "resting":
                glColor3f(1.0, 0.6, 0.2)  # Orange
            elif agent.state.value == "moving_to_target":
                glColor3f(0.2, 0.9, 0.5)  # Green
            else:
                glColor3f(0.4, 0.7, 1.0)  # Blue
            
            # Draw simple humanoid shape
            # Body
            glPushMatrix()
            glScalef(0.15, 0.35, 0.1)
            self._draw_cube()
            glPopMatrix()
            
            # Head
            glPushMatrix()
            glTranslatef(0, 0.5, 0)
            quad = gluNewQuadric()
            gluSphere(quad, 0.12, 12, 12)
            gluDeleteQuadric(quad)
            glPopMatrix()
            
            glPopMatrix()
    
    def resize(self, width: int, height: int):
        """Handle window resize"""
        glViewport(0, 0, width, height)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(60, width / height if height > 0 else 1, 0.1, 500.0)
        glMatrixMode(GL_MODELVIEW)