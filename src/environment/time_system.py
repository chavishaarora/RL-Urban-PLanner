"""
Time-Integrated 3D Renderer
Integrates the time-of-day system with OpenGL rendering

Features to add to your renderer3d.py:
1. Dynamic sky colors based on time
2. Moving sun/directional light
3. Automatic street lamp control
4. Shadow direction following sun
5. Ambient light changes
"""

from OpenGL.GL import *
from OpenGL.GLU import *
import math


# ========== ADD THIS TO YOUR Renderer3DQt CLASS ==========

class TimeIntegratedRenderer3D:
    """
    Extension methods for your Renderer3DQt class
    Adds time-of-day lighting
    """
    
    def __init__(self, park, time_system):
        """
        Args:
            park: Park instance
            time_system: TimeSystem instance
        """
        # ... your existing __init__ code ...
        
        # Time system
        self.time_system = time_system
        
        # Lighting state
        self.sun_light_id = GL_LIGHT0
        self.fill_light_id = GL_LIGHT1
        
    def setup_lighting_with_time(self):
        """
        Enhanced lighting setup that uses time system
        Call this instead of setup_lighting()
        """
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        glEnable(self.sun_light_id)
        glEnable(self.fill_light_id)
        glEnable(GL_COLOR_MATERIAL)
        glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
        
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        # Initial lighting setup
        self.update_lighting_from_time()
        
        glShadeModel(GL_SMOOTH)
    
    def update_lighting_from_time(self):
        """Update OpenGL lighting based on current time"""
        sun_pos = self.time_system.sun_position
        sun_color = self.time_system.get_sun_color()
        ambient = self.time_system.ambient_light
        
        # ========== MAIN SUN LIGHT (GL_LIGHT0) ==========
        # This is a directional light that follows the sun
        
        # Position (w=0 for directional, w=1 for positional)
        # Scale up for better visibility
        sun_direction = [
            sun_pos.x * 50.0,
            sun_pos.y * 50.0,
            sun_pos.z * 50.0,
            0.0  # Directional light
        ]
        glLightfv(self.sun_light_id, GL_POSITION, sun_direction)
        
        # Ambient component (soft indirect light)
        sun_ambient = [
            ambient[0],
            ambient[1],
            ambient[2],
            1.0
        ]
        glLightfv(self.sun_light_id, GL_AMBIENT, sun_ambient)
        
        # Diffuse component (main sunlight)
        sun_diffuse = [
            sun_color[0] * sun_pos.intensity,
            sun_color[1] * sun_pos.intensity,
            sun_color[2] * sun_pos.intensity,
            1.0
        ]
        glLightfv(self.sun_light_id, GL_DIFFUSE, sun_diffuse)
        
        # Specular component (sun reflections)
        sun_specular = [
            sun_color[0] * sun_pos.intensity * 0.8,
            sun_color[1] * sun_pos.intensity * 0.8,
            sun_color[2] * sun_pos.intensity * 0.8,
            1.0
        ]
        glLightfv(self.sun_light_id, GL_SPECULAR, sun_specular)
        
        # ========== FILL LIGHT (GL_LIGHT1) ==========
        # Subtle sky/environment light from opposite direction
        # This prevents shadows from being pitch black
        
        fill_direction = [
            -sun_pos.x * 30.0,
            abs(sun_pos.y) * 20.0 + 10.0,  # Always from above
            -sun_pos.z * 30.0,
            0.0
        ]
        glLightfv(self.fill_light_id, GL_POSITION, fill_direction)
        
        # Sky-colored fill light
        sky_color = self.time_system.sky_color
        fill_intensity = 0.2 + sun_pos.intensity * 0.1
        
        fill_ambient = [
            sky_color[0] * 0.1,
            sky_color[1] * 0.1,
            sky_color[2] * 0.1,
            1.0
        ]
        glLightfv(self.fill_light_id, GL_AMBIENT, fill_ambient)
        
        fill_diffuse = [
            sky_color[0] * fill_intensity,
            sky_color[1] * fill_intensity,
            sky_color[2] * fill_intensity,
            1.0
        ]
        glLightfv(self.fill_light_id, GL_DIFFUSE, fill_diffuse)
        
        # No specular for fill light
        glLightfv(self.fill_light_id, GL_SPECULAR, [0.0, 0.0, 0.0, 1.0])
        
        # ========== MATERIAL PROPERTIES ==========
        # Adjust how materials interact with light
        specular = [0.3, 0.3, 0.3, 1.0]
        shininess = [20.0]
        
        glMaterialfv(GL_FRONT, GL_SPECULAR, specular)
        glMaterialfv(GL_FRONT, GL_SHININESS, shininess)
    
    def update_sky_color(self):
        """Update the clear color (sky) based on time"""
        sky = self.time_system.sky_color
        glClearColor(sky[0], sky[1], sky[2], 1.0)
    
    def draw_sun_moon(self):
        """
        Draw sun or moon in the sky
        Call this in your render() method
        """
        sun_pos = self.time_system.sun_position
        
        glDisable(GL_LIGHTING)  # Draw without lighting
        glEnable(GL_BLEND)
        
        if sun_pos.altitude > 0:
            # Draw sun
            self._draw_sun(sun_pos)
        elif sun_pos.altitude > -10:
            # Draw moon (when sun just set)
            self._draw_moon()
        
        glEnable(GL_LIGHTING)
    
    def _draw_sun(self, sun_pos):
        """Draw the sun in the sky"""
        # Calculate sun position in world
        distance = 100.0  # Far away
        sun_x = sun_pos.x * distance
        sun_y = sun_pos.y * distance
        sun_z = sun_pos.z * distance
        
        glPushMatrix()
        glTranslatef(sun_x, sun_y, sun_z)
        
        # Sun color (yellow-white)
        sun_color = self.time_system.get_sun_color()
        
        # Glow effect - multiple overlapping spheres
        for i in range(3):
            size = 3.0 + i * 1.5
            alpha = (1.0 - i * 0.3) * sun_pos.intensity
            
            glColor4f(
                sun_color[0],
                sun_color[1],
                sun_color[2],
                alpha
            )
            
            quad = gluNewQuadric()
            gluSphere(quad, size, 20, 20)
            gluDeleteQuadric(quad)
        
        glPopMatrix()
    
    def _draw_moon(self):
        """Draw the moon"""
        # Moon is opposite the sun
        sun_pos = self.time_system.sun_position
        distance = 100.0
        
        moon_x = -sun_pos.x * distance
        moon_y = max(10, -sun_pos.y * distance)  # Keep above horizon
        moon_z = -sun_pos.z * distance
        
        glPushMatrix()
        glTranslatef(moon_x, moon_y, moon_z)
        
        # Moon color (bluish white)
        glColor4f(0.9, 0.9, 1.0, 0.9)
        
        quad = gluNewQuadric()
        gluSphere(quad, 2.5, 20, 20)
        gluDeleteQuadric(quad)
        
        glPopMatrix()
    
    def should_draw_lamp_light(self) -> bool:
        """Check if street lamps should be glowing"""
        return self.time_system.should_lamps_be_on()
    
    def draw_lamp_glow(self, lamp_position: tuple):
        """
        Draw a glowing light around a street lamp
        Call this when drawing lamps at night
        
        Args:
            lamp_position: (x, y, z) position of lamp
        """
        if not self.should_draw_lamp_light():
            return
        
        glDisable(GL_LIGHTING)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE)  # Additive blending for glow
        
        glPushMatrix()
        glTranslatef(lamp_position[0], lamp_position[1], lamp_position[2])
        
        # Draw multiple spheres for glow effect
        # Warm yellow/orange light
        light_color = (1.0, 0.9, 0.6)
        
        for i in range(4):
            size = 0.3 + i * 0.15
            alpha = 0.6 / (i + 1)
            
            glColor4f(
                light_color[0],
                light_color[1],
                light_color[2],
                alpha
            )
            
            quad = gluNewQuadric()
            gluSphere(quad, size, 12, 12)
            gluDeleteQuadric(quad)
        
        glPopMatrix()
        
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)  # Reset blending
        glEnable(GL_LIGHTING)
    
    def draw_simple_shadows(self, elements):
        """
        Draw simple blob shadows under objects
        Call this before drawing elements
        
        Args:
            elements: List of park elements
        """
        sun_pos = self.time_system.sun_position
        
        # Only draw shadows when sun is up
        if sun_pos.altitude <= 0:
            return
        
        glDisable(GL_LIGHTING)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        
        # Shadow color (semi-transparent dark)
        shadow_alpha = 0.3 * sun_pos.intensity
        glColor4f(0.0, 0.0, 0.0, shadow_alpha)
        
        # Get shadow direction
        shadow_dir = self.time_system.get_shadow_direction()
        shadow_length = min(5.0, self.time_system.get_shadow_length_multiplier())
        
        for element in elements:
            glPushMatrix()
            
            # Position at ground level
            glTranslatef(element.position.x, 0.01, element.position.y)
            
            # Offset shadow based on sun direction
            # Shadow should point away from sun
            offset_x = -shadow_dir[0] * shadow_length * 0.5
            offset_z = -shadow_dir[2] * shadow_length * 0.5
            glTranslatef(offset_x, 0, offset_z)
            
            # Draw elliptical shadow
            # Stretch shadow based on sun angle
            stretch = 1.0 + shadow_length * 0.3
            
            glBegin(GL_TRIANGLE_FAN)
            glVertex3f(0, 0, 0)
            
            # Create elongated circle
            segments = 16
            for i in range(segments + 1):
                angle = (i / segments) * 2 * math.pi
                x = math.cos(angle) * stretch
                z = math.sin(angle)
                glVertex3f(x, 0, z)
            
            glEnd()
            
            glPopMatrix()
        
        glEnable(GL_LIGHTING)


# ========== USAGE EXAMPLE FOR YOUR renderer3d.py ==========

"""
# In your Renderer3DQt class __init__, add:

from time_system import TimeSystem

self.time_system = TimeSystem(
    start_hour=12.0,    # Start at noon
    time_scale=60.0,    # 60 game seconds = 1 real second (1 minute/sec)
    latitude=40.0       # Your location's latitude
)

# In your setup_opengl() method, replace setup_lighting() with:

def setup_opengl(self):
    # ... existing code ...
    self.setup_lighting_with_time()  # Instead of setup_lighting()
    # ... rest of code ...

# In your render() method, add these calls:

def render(self, agent_manager=None, delta_time=0.016):
    # Update time
    self.time_system.update(delta_time)
    
    # Update lighting and sky
    self.update_sky_color()
    self.update_lighting_from_time()
    
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    
    self.camera.apply()
    
    # Draw sun/moon
    self.draw_sun_moon()
    
    # Draw shadows
    self.draw_simple_shadows(self.park.elements)
    
    # Draw ground
    glCallList(self.display_lists['ground'])
    
    # Draw all elements
    for element in self.park.elements:
        self.draw_element(element)
        
        # Add lamp glow if it's a lamp
        if element.element_type == ElementType.STREET_LAMP:
            lamp_pos = (element.position.x, 3.5, element.position.y)
            self.draw_lamp_glow(lamp_pos)
    
    # Draw pedestrians
    if agent_manager:
        self.draw_pedestrians(agent_manager)
    
    glFlush()

# Add time control methods:

def pause_time(self):
    self.time_system.is_paused = True

def resume_time(self):
    self.time_system.is_paused = False

def set_time_speed(self, speed: float):
    '''Set how fast time moves (1.0 = real time, 60.0 = 1 min/sec)'''
    self.time_system.time_scale = speed

def set_time(self, hour: float):
    '''Set time directly (0-24)'''
    self.time_system.set_time(hour)

def get_time_stats(self) -> dict:
    return self.time_system.get_statistics()
"""


# ========== PASTE THESE METHODS INTO YOUR Renderer3DQt CLASS ==========

METHOD_TO_ADD_1 = """
def setup_lighting_with_time(self):
    '''Enhanced lighting setup that uses time system'''
    from time_system import TimeSystem
    
    if not hasattr(self, 'time_system'):
        self.time_system = TimeSystem(start_hour=12.0, time_scale=60.0)
    
    glEnable(GL_DEPTH_TEST)
    glEnable(GL_LIGHTING)
    glEnable(GL_LIGHT0)
    glEnable(GL_LIGHT1)
    glEnable(GL_COLOR_MATERIAL)
    glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
    
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
    
    self.update_lighting_from_time()
    glShadeModel(GL_SMOOTH)
"""

METHOD_TO_ADD_2 = """
def update_lighting_from_time(self):
    '''Update OpenGL lighting based on current time'''
    sun_pos = self.time_system.sun_position
    sun_color = self.time_system.get_sun_color()
    ambient = self.time_system.ambient_light
    
    # Main sun light
    sun_direction = [sun_pos.x * 50.0, sun_pos.y * 50.0, sun_pos.z * 50.0, 0.0]
    glLightfv(GL_LIGHT0, GL_POSITION, sun_direction)
    
    sun_ambient = [ambient[0], ambient[1], ambient[2], 1.0]
    glLightfv(GL_LIGHT0, GL_AMBIENT, sun_ambient)
    
    sun_diffuse = [
        sun_color[0] * sun_pos.intensity,
        sun_color[1] * sun_pos.intensity,
        sun_color[2] * sun_pos.intensity,
        1.0
    ]
    glLightfv(GL_LIGHT0, GL_DIFFUSE, sun_diffuse)
    
    sun_specular = [
        sun_color[0] * sun_pos.intensity * 0.8,
        sun_color[1] * sun_pos.intensity * 0.8,
        sun_color[2] * sun_pos.intensity * 0.8,
        1.0
    ]
    glLightfv(GL_LIGHT0, GL_SPECULAR, sun_specular)
    
    # Fill light
    fill_direction = [-sun_pos.x * 30.0, abs(sun_pos.y) * 20.0 + 10.0, -sun_pos.z * 30.0, 0.0]
    glLightfv(GL_LIGHT1, GL_POSITION, fill_direction)
    
    sky_color = self.time_system.sky_color
    fill_intensity = 0.2 + sun_pos.intensity * 0.1
    
    fill_diffuse = [
        sky_color[0] * fill_intensity,
        sky_color[1] * fill_intensity,
        sky_color[2] * fill_intensity,
        1.0
    ]
    glLightfv(GL_LIGHT1, GL_DIFFUSE, fill_diffuse)
"""

print(__doc__)
print("\n" + "="*70)
print("INTEGRATION COMPLETE - Ready to add to renderer3d.py")
print("="*70)