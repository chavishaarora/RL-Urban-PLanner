"""
Professional 3D Renderer using PyOpenGL
Matches the original HTML Three.js visualization
"""

import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLU import *
import numpy as np
import math
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
        self.angle_x = 45.0  # degrees
        self.angle_y = 45.0  # degrees
        self.target = [0, 0, 0]
        self.zoom_speed = 2.0
        self.rotation_speed = 0.5
        
    def apply(self):
        """Apply camera transformation"""
        glLoadIdentity()
        
        # Calculate camera position
        rad_x = math.radians(self.angle_x)
        rad_y = math.radians(self.angle_y)
        
        cam_x = self.distance * math.cos(rad_y) * math.cos(rad_x)
        cam_y = self.distance * math.sin(rad_y)
        cam_z = self.distance * math.cos(rad_y) * math.sin(rad_x)
        
        gluLookAt(
            cam_x, cam_y, cam_z,  # Camera position
            self.target[0], self.target[1], self.target[2],  # Look at
            0, 1, 0  # Up vector
        )
    
    def rotate(self, dx: float, dy: float):
        """Rotate camera"""
        self.angle_x += dx * self.rotation_speed
        self.angle_y = max(-89, min(89, self.angle_y + dy * self.rotation_speed))
    
    def zoom(self, delta: float):
        """Zoom camera"""
        self.distance = max(10, min(100, self.distance - delta * self.zoom_speed))


class Renderer3D:
    """Professional 3D OpenGL Renderer"""
    
    def __init__(self, park: Park, width: int = 1400, height: int = 900):
        self.park = park
        self.width = width
        self.height = height
        
        # Initialize Pygame and OpenGL
        pygame.init()
        self.screen = pygame.display.set_mode(
            (width, height), 
            DOUBLEBUF | OPENGL
        )
        pygame.display.set_caption("Urban Park RL - 3D Design Optimization")
        
        # Setup OpenGL
        self.setup_opengl()
        
        # Camera
        self.camera = Camera3D()
        
        # Colors matching the original
        self.colors = {
            ElementType.BENCH: (0.545, 0.271, 0.075),      # Brown
            ElementType.TREE: (0.133, 0.545, 0.133),       # Forest green
            ElementType.FOUNTAIN: (0.251, 0.643, 0.875),   # Light blue
            ElementType.STREET_LAMP: (1.0, 0.875, 0.0),    # Golden yellow
            ElementType.GRASS_PATCH: (0.486, 0.988, 0.0),  # Lawn green
            ElementType.PATHWAY: (0.502, 0.502, 0.502)     # Gray
        }
        
        # Lighting
        self.setup_lighting()
        
        # Display lists for optimized rendering
        self.display_lists = {}
        self.create_display_lists()
    
    def setup_opengl(self):
        """Setup OpenGL context"""
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        glEnable(GL_LIGHT0)
        glEnable(GL_COLOR_MATERIAL)
        glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
        
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        # Set up perspective
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(60, self.width / self.height, 0.1, 500.0)
        glMatrixMode(GL_MODELVIEW)
        
        # Background color (sky blue like original)
        glClearColor(0.529, 0.808, 0.922, 1.0)  # Light blue
    
    def setup_lighting(self):
        """Setup lighting to match original"""
        # Ambient light
        glLightfv(GL_LIGHT0, GL_AMBIENT, [0.4, 0.4, 0.4, 1.0])
        glLightfv(GL_LIGHT0, GL_DIFFUSE, [0.8, 0.8, 0.8, 1.0])
        glLightfv(GL_LIGHT0, GL_SPECULAR, [1.0, 1.0, 1.0, 1.0])
        glLightfv(GL_LIGHT0, GL_POSITION, [10, 20, 10, 1.0])
        
        # Material properties
        glMaterialfv(GL_FRONT, GL_SPECULAR, [1.0, 1.0, 1.0, 1.0])
        glMaterialfv(GL_FRONT, GL_SHININESS, [50.0])
    
    def create_display_lists(self):
        """Create optimized display lists for common shapes"""
        # Cylinder for elements
        self.display_lists['cylinder'] = glGenLists(1)
        glNewList(self.display_lists['cylinder'], GL_COMPILE)
        self.draw_cylinder(1.0, 2.0, 32)
        glEndList()
        
        # Ground plane
        self.display_lists['ground'] = glGenLists(1)
        glNewList(self.display_lists['ground'], GL_COMPILE)
        self.draw_ground_plane()
        glEndList()
    
    def draw_cylinder(self, radius: float, height: float, slices: int = 32):
        """Draw a cylinder (used for park elements)"""
        quad = gluNewQuadric()
        gluQuadricNormals(quad, GLU_SMOOTH)
        gluQuadricTexture(quad, GL_TRUE)
        
        # Draw cylinder body
        gluCylinder(quad, radius, radius, height, slices, 1)
        
        # Draw top cap
        glPushMatrix()
        glTranslatef(0, 0, height)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        # Draw bottom cap
        glPushMatrix()
        glRotatef(180, 1, 0, 0)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        gluDeleteQuadric(quad)
    
    def draw_ground_plane(self):
        """Draw the ground plane with grid"""
        park_size = self.park.size
        half_size = park_size / 2
        
        # Draw ground
        glBegin(GL_QUADS)
        glColor3f(0.2, 0.5, 0.2)  # Dark green
        glVertex3f(-half_size, 0, -half_size)
        glVertex3f(half_size, 0, -half_size)
        glVertex3f(half_size, 0, half_size)
        glVertex3f(-half_size, 0, half_size)
        glEnd()
        
        # Draw grid lines
        glDisable(GL_LIGHTING)
        glLineWidth(1.0)
        glColor3f(0.3, 0.6, 0.3)
        
        cell_size = park_size / self.park.grid_size
        
        glBegin(GL_LINES)
        for i in range(self.park.grid_size + 1):
            pos = -half_size + i * cell_size
            # Vertical lines
            glVertex3f(pos, 0.01, -half_size)
            glVertex3f(pos, 0.01, half_size)
            # Horizontal lines
            glVertex3f(-half_size, 0.01, pos)
            glVertex3f(half_size, 0.01, pos)
        glEnd()
        
        glEnable(GL_LIGHTING)
    
    def draw_element(self, element, highlighted: bool = False):
        """Draw a park element as a detailed 3D model"""
        glPushMatrix()
        
        # Position
        glTranslatef(element.position.x, 0, element.position.y)
        
        # Get color
        color = self.colors.get(element.element_type, (0.5, 0.5, 0.5))
        
        # Highlight if selected
        if highlighted:
            glColor3f(
                min(1.0, color[0] + 0.3),
                min(1.0, color[1] + 0.3),
                min(1.0, color[2] + 0.3)
            )
        else:
            glColor3f(*color)
        
        # Draw different models based on type
        if element.element_type == ElementType.BENCH:
            self._draw_bench()
        elif element.element_type == ElementType.TREE:
            self._draw_tree()
        elif element.element_type == ElementType.FOUNTAIN:
            self._draw_fountain()
        elif element.element_type == ElementType.STREET_LAMP:
            self._draw_lamp()
        elif element.element_type == ElementType.GRASS_PATCH:
            self._draw_grass_patch()
        elif element.element_type == ElementType.PATHWAY:
            self._draw_pathway()
        else:
            # Fallback: simple cylinder
            self._draw_simple_cylinder(element.size / 2.0, 2.0)
        
        glPopMatrix()
    
    def _draw_bench(self):
        """Draw a park bench matching HTML - detailed with proper proportions"""
        bench_color = (0.45, 0.25, 0.10)  # Rich brown
        
        # Main seat - longer and thinner
        glPushMatrix()
        glTranslatef(0, 0.5, 0)
        glColor3f(*bench_color)
        glScalef(2.0, 0.08, 0.7)  # Long, thin seat
        self._draw_cube()
        glPopMatrix()
        
        # Seat support slats (3 horizontal bars under seat)
        for i in range(3):
            x_pos = -0.8 + i * 0.8
            glPushMatrix()
            glTranslatef(x_pos, 0.42, 0)
            glColor3f(*bench_color)
            glScalef(0.6, 0.05, 0.6)
            self._draw_cube()
            glPopMatrix()
        
        # Backrest - taller and properly positioned
        glPushMatrix()
        glTranslatef(0, 1.1, -0.3)
        glColor3f(*bench_color)
        glScalef(2.0, 1.0, 0.08)  # Tall, thin backrest
        self._draw_cube()
        glPopMatrix()
        
        # Backrest slats (horizontal bars in backrest)
        for i in range(4):
            y_pos = 0.7 + i * 0.22
            glPushMatrix()
            glTranslatef(0, y_pos, -0.32)
            glColor3f(0.50, 0.28, 0.12)  # Slightly lighter
            glScalef(1.9, 0.06, 0.06)
            self._draw_cube()
            glPopMatrix()
        
        # Legs (4 sturdy legs)
        leg_positions = [
            (-0.85, 0.25, -0.25),
            (-0.85, 0.25, 0.25),
            (0.85, 0.25, -0.25),
            (0.85, 0.25, 0.25)
        ]
        
        for lx, ly, lz in leg_positions:
            glPushMatrix()
            glTranslatef(lx, ly, lz)
            glColor3f(0.40, 0.22, 0.08)  # Darker for legs
            glScalef(0.12, 0.5, 0.12)
            self._draw_cube()
            glPopMatrix()
        
        # Armrests (optional - makes it look more complete)
        for x_side in [-0.9, 0.9]:
            # Armrest top
            glPushMatrix()
            glTranslatef(x_side, 0.7, 0)
            glColor3f(*bench_color)
            glScalef(0.15, 0.08, 0.6)
            self._draw_cube()
            glPopMatrix()
            
            # Armrest support
            glPushMatrix()
            glTranslatef(x_side, 0.6, 0.25)
            glColor3f(*bench_color)
            glScalef(0.1, 0.25, 0.1)
            self._draw_cube()
            glPopMatrix()
    
    def _draw_tree(self):
        """Draw a tree matching HTML version - fuller canopy with multiple spheres"""
        # Trunk (darker brown, slightly tapered)
        glPushMatrix()
        glColor3f(0.35, 0.20, 0.08)  # Darker brown for trunk
        quad = gluNewQuadric()
        gluCylinder(quad, 0.4, 0.3, 3.0, 16, 1)  # Tapered trunk
        gluDeleteQuadric(quad)
        glPopMatrix()
        
        # Main canopy - larger central sphere
        glPushMatrix()
        glTranslatef(0, 4.0, 0)
        glColor3f(0.15, 0.5, 0.15)  # Darker forest green
        quad = gluNewQuadric()
        gluSphere(quad, 2.2, 20, 20)  # Larger main canopy
        gluDeleteQuadric(quad)
        glPopMatrix()
        
        # Additional canopy spheres for fuller look (like HTML)
        canopy_positions = [
            (0.8, 4.2, 0.8),
            (-0.8, 4.2, 0.8),
            (0.8, 4.2, -0.8),
            (-0.8, 4.2, -0.8),
            (0, 4.8, 0),  # Top
        ]
        
        for cx, cy, cz in canopy_positions:
            glPushMatrix()
            glTranslatef(cx, cy, cz)
            glColor3f(0.18, 0.52, 0.18)  # Slightly lighter green
            quad = gluNewQuadric()
            gluSphere(quad, 1.3, 16, 16)
            gluDeleteQuadric(quad)
            glPopMatrix()
    
    def _draw_fountain(self):
        """Draw a fountain matching HTML - multi-tier with detailed structure"""
        # Bottom tier - large base basin
        glPushMatrix()
        glColor3f(0.55, 0.55, 0.60)  # Stone gray
        self._draw_simple_cylinder(2.0, 0.4)
        glPopMatrix()
        
        # Bottom water
        glPushMatrix()
        glTranslatef(0, 0.4, 0)
        glColor3f(0.20, 0.55, 0.75)  # Darker water blue
        self._draw_simple_cylinder(1.9, 0.15)
        glPopMatrix()
        
        # Middle tier - medium basin
        glPushMatrix()
        glTranslatef(0, 0.8, 0)
        glColor3f(0.6, 0.6, 0.65)  # Slightly lighter stone
        self._draw_simple_cylinder(1.2, 0.35)
        glPopMatrix()
        
        # Middle water
        glPushMatrix()
        glTranslatef(0, 1.15, 0)
        glColor3f(0.22, 0.58, 0.78)  # Medium water blue
        self._draw_simple_cylinder(1.1, 0.12)
        glPopMatrix()
        
        # Top tier - small basin
        glPushMatrix()
        glTranslatef(0, 1.5, 0)
        glColor3f(0.65, 0.65, 0.70)  # Lighter stone
        self._draw_simple_cylinder(0.6, 0.3)
        glPopMatrix()
        
        # Top water
        glPushMatrix()
        glTranslatef(0, 1.8, 0)
        glColor3f(0.25, 0.60, 0.80)  # Bright water blue
        self._draw_simple_cylinder(0.55, 0.1)
        glPopMatrix()
        
        # Center column connecting tiers
        glPushMatrix()
        glTranslatef(0, 0.4, 0)
        glColor3f(0.5, 0.5, 0.55)
        self._draw_simple_cylinder(0.25, 1.5)
        glPopMatrix()
        
        # Top ornamental sphere
        glPushMatrix()
        glTranslatef(0, 2.2, 0)
        glColor3f(0.25, 0.60, 0.80)  # Water blue
        quad = gluNewQuadric()
        gluSphere(quad, 0.35, 16, 16)
        gluDeleteQuadric(quad)
        glPopMatrix()
        
        # Water droplets effect (small spheres around top)
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            x = math.cos(rad) * 0.5
            z = math.sin(rad) * 0.5
            glPushMatrix()
            glTranslatef(x, 2.3, z)
            glColor4f(0.3, 0.65, 0.85, 0.7)  # Translucent water
            quad = gluNewQuadric()
            gluSphere(quad, 0.1, 8, 8)
            gluDeleteQuadric(quad)
            glPopMatrix()
    
    def _draw_lamp(self):
        """Draw a street lamp (pole + lamp head)"""
        # Pole
        glPushMatrix()
        glColor3f(0.3, 0.3, 0.3)  # Dark gray pole
        self._draw_simple_cylinder(0.15, 4.0)
        glPopMatrix()
        
        # Lamp head (cone + sphere)
        glPushMatrix()
        glTranslatef(0, 4.0, 0)
        
        # Top sphere
        glColor3f(1.0, 0.875, 0.0)  # Yellow
        quad = gluNewQuadric()
        gluSphere(quad, 0.4, 12, 12)
        gluDeleteQuadric(quad)
        glPopMatrix()
        
        # Lamp shade (inverted cone)
        glPushMatrix()
        glTranslatef(0, 3.6, 0)
        glRotatef(180, 1, 0, 0)
        glColor3f(0.2, 0.2, 0.2)
        quad = gluNewQuadric()
        gluCylinder(quad, 0.6, 0.3, 0.5, 16, 1)
        gluDeleteQuadric(quad)
        glPopMatrix()
    
    def _draw_grass_patch(self):
        """Draw grass patch (flat textured square)"""
        glPushMatrix()
        glTranslatef(0, 0.05, 0)
        
        # Draw as a flat square slightly above ground
        glBegin(GL_QUADS)
        glNormal3f(0, 1, 0)
        size = 2.0
        glVertex3f(-size, 0, -size)
        glVertex3f(size, 0, -size)
        glVertex3f(size, 0, size)
        glVertex3f(-size, 0, size)
        glEnd()
        
        glPopMatrix()
    
    def _draw_pathway(self):
        """Draw pathway (flat stone path)"""
        glPushMatrix()
        glTranslatef(0, 0.02, 0)
        
        # Draw as a flat rectangle
        glBegin(GL_QUADS)
        glNormal3f(0, 1, 0)
        width = 2.5
        length = 2.5
        glVertex3f(-width, 0, -length)
        glVertex3f(width, 0, -length)
        glVertex3f(width, 0, length)
        glVertex3f(-width, 0, length)
        glEnd()
        
        glPopMatrix()
    
    def _draw_cube(self):
        """Draw a unit cube"""
        glBegin(GL_QUADS)
        
        # Front face
        glNormal3f(0, 0, 1)
        glVertex3f(-0.5, -0.5, 0.5)
        glVertex3f(0.5, -0.5, 0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        
        # Back face
        glNormal3f(0, 0, -1)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(-0.5, 0.5, -0.5)
        glVertex3f(0.5, 0.5, -0.5)
        glVertex3f(0.5, -0.5, -0.5)
        
        # Top face
        glNormal3f(0, 1, 0)
        glVertex3f(-0.5, 0.5, -0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(0.5, 0.5, -0.5)
        
        # Bottom face
        glNormal3f(0, -1, 0)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(0.5, -0.5, -0.5)
        glVertex3f(0.5, -0.5, 0.5)
        glVertex3f(-0.5, -0.5, 0.5)
        
        # Right face
        glNormal3f(1, 0, 0)
        glVertex3f(0.5, -0.5, -0.5)
        glVertex3f(0.5, 0.5, -0.5)
        glVertex3f(0.5, 0.5, 0.5)
        glVertex3f(0.5, -0.5, 0.5)
        
        # Left face
        glNormal3f(-1, 0, 0)
        glVertex3f(-0.5, -0.5, -0.5)
        glVertex3f(-0.5, -0.5, 0.5)
        glVertex3f(-0.5, 0.5, 0.5)
        glVertex3f(-0.5, 0.5, -0.5)
        
        glEnd()
    
    def _draw_simple_cylinder(self, radius: float, height: float, slices: int = 16):
        """Draw a simple cylinder"""
        quad = gluNewQuadric()
        gluQuadricNormals(quad, GLU_SMOOTH)
        
        # Draw cylinder body
        gluCylinder(quad, radius, radius, height, slices, 1)
        
        # Draw top cap
        glPushMatrix()
        glTranslatef(0, 0, height)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        # Draw bottom cap
        glPushMatrix()
        glRotatef(180, 1, 0, 0)
        gluDisk(quad, 0, radius, slices, 1)
        glPopMatrix()
        
        gluDeleteQuadric(quad)
    
    def render(self, agent_manager=None):
        """Main render function"""
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        
        # Apply camera
        self.camera.apply()
        
        # Draw ground
        glCallList(self.display_lists['ground'])
        
        # Draw all elements
        for element in self.park.elements:
            self.draw_element(element)
        
        # Draw pedestrians if available
        if agent_manager:
            self.draw_pedestrians(agent_manager)
        
        # Flush
        glFlush()
    
    def draw_pedestrians(self, agent_manager):
        """Draw pedestrian agents as small spheres"""
        from OpenGL.GLU import gluNewQuadric, gluSphere, gluDeleteQuadric
        
        for agent in agent_manager.agents:
            glPushMatrix()
            
            # Position
            glTranslatef(agent.position.x, 0.5, agent.position.y)  # Slight elevation
            
            # Color based on state
            if agent.state.value == "resting":
                glColor3f(1.0, 0.5, 0.0)  # Orange for resting
            elif agent.state.value == "moving_to_target":
                glColor3f(0.0, 1.0, 0.5)  # Green for moving
            else:
                glColor3f(0.3, 0.6, 1.0)  # Blue for wandering
            
            # Draw sphere
            quad = gluNewQuadric()
            gluSphere(quad, 0.3, 16, 16)  # Small sphere
            gluDeleteQuadric(quad)
            
            glPopMatrix()
    
    def handle_mouse_drag(self, dx: int, dy: int, button: int):
        """Handle mouse drag for camera control"""
        if button == 1:  # Left button - rotate
            self.camera.rotate(dx, -dy)
        elif button == 3:  # Right button - pan
            # Pan camera target
            sensitivity = 0.05
            self.camera.target[0] -= dx * sensitivity
            self.camera.target[2] += dy * sensitivity
    
    def handle_mouse_wheel(self, delta: int):
        """Handle mouse wheel for zoom"""
        self.camera.zoom(delta)
    
    def resize(self, width: int, height: int):
        """Handle window resize"""
        self.width = width
        self.height = height
        glViewport(0, 0, width, height)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(60, width / height, 0.1, 500.0)
        glMatrixMode(GL_MODELVIEW)