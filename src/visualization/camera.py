"""
Camera Module
Handles camera movement and projection for visualization
"""

import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass
import math

@dataclass
class Camera:
    """Camera for 3D-like visualization"""
    
    # Position
    x: float = 0.0
    y: float = 0.0
    z: float = 30.0
    
    # Rotation (in radians)
    pitch: float = -0.5  # Looking down
    yaw: float = 0.0
    roll: float = 0.0
    
    # Projection parameters
    fov: float = 60.0  # Field of view in degrees
    aspect_ratio: float = 16/9
    near_plane: float = 0.1
    far_plane: float = 100.0
    
    # Control parameters
    move_speed: float = 10.0
    rotate_speed: float = 1.0
    zoom_speed: float = 5.0
    
    # Constraints
    min_height: float = 5.0
    max_height: float = 50.0
    min_pitch: float = -math.pi/2
    max_pitch: float = 0.0
    
    def move(self, dx: float, dy: float, dz: float):
        """Move camera in world space"""
        self.x += dx
        self.y += dy
        self.z = np.clip(self.z + dz, self.min_height, self.max_height)
    
    def rotate(self, d_pitch: float, d_yaw: float, d_roll: float = 0):
        """Rotate camera"""
        self.pitch = np.clip(self.pitch + d_pitch, self.min_pitch, self.max_pitch)
        self.yaw += d_yaw
        self.roll += d_roll
        
        # Normalize yaw to [0, 2π]
        self.yaw = self.yaw % (2 * math.pi)
    
    def zoom(self, delta: float):
        """Zoom in/out by adjusting FOV or moving camera"""
        self.z = np.clip(self.z - delta * self.zoom_speed, 
                        self.min_height, self.max_height)
    
    def orbit(self, center_x: float, center_y: float, 
             d_angle: float, d_height: float = 0):
        """Orbit around a center point"""
        # Calculate current angle and radius
        dx = self.x - center_x
        dy = self.y - center_y
        current_radius = math.sqrt(dx**2 + dy**2)
        current_angle = math.atan2(dy, dx)
        
        # Update angle
        new_angle = current_angle + d_angle
        
        # Calculate new position
        self.x = center_x + current_radius * math.cos(new_angle)
        self.y = center_y + current_radius * math.sin(new_angle)
        self.z = np.clip(self.z + d_height, self.min_height, self.max_height)
        
        # Update yaw to look at center
        self.yaw = new_angle + math.pi
    
    def look_at(self, target_x: float, target_y: float, target_z: float = 0):
        """Point camera at a target position"""
        # Calculate direction vector
        dx = target_x - self.x
        dy = target_y - self.y
        dz = target_z - self.z
        
        # Calculate yaw (horizontal angle)
        self.yaw = math.atan2(dy, dx)
        
        # Calculate pitch (vertical angle)
        horizontal_distance = math.sqrt(dx**2 + dy**2)
        self.pitch = math.atan2(-dz, horizontal_distance)
        self.pitch = np.clip(self.pitch, self.min_pitch, self.max_pitch)
    
    def world_to_screen(self, world_x: float, world_y: float, world_z: float,
                       screen_width: int, screen_height: int) -> Optional[Tuple[int, int]]:
        """
        Convert world coordinates to screen coordinates
        
        Returns:
            Screen coordinates (x, y) or None if behind camera
        """
        # Transform to camera space
        # Translate
        tx = world_x - self.x
        ty = world_y - self.y
        tz = world_z - self.z
        
        # Rotate around yaw
        cos_yaw = math.cos(-self.yaw)
        sin_yaw = math.sin(-self.yaw)
        rx = tx * cos_yaw - ty * sin_yaw
        ry = tx * sin_yaw + ty * cos_yaw
        rz = tz
        
        # Rotate around pitch
        cos_pitch = math.cos(-self.pitch)
        sin_pitch = math.sin(-self.pitch)
        cx = rx
        cy = ry * cos_pitch - rz * sin_pitch
        cz = ry * sin_pitch + rz * cos_pitch
        
        # Check if behind camera
        if cz >= -self.near_plane:
            return None
        
        # Project to screen
        fov_rad = math.radians(self.fov)
        f = 1.0 / math.tan(fov_rad / 2.0)
        
        # Perspective projection
        proj_x = (cx * f) / (-cz)
        proj_y = (cy * f * self.aspect_ratio) / (-cz)
        
        # Convert to screen coordinates
        screen_x = int((proj_x + 1.0) * screen_width / 2.0)
        screen_y = int((1.0 - proj_y) * screen_height / 2.0)
        
        return screen_x, screen_y
    
    def screen_to_ray(self, screen_x: int, screen_y: int,
                      screen_width: int, screen_height: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert screen coordinates to a ray in world space
        
        Returns:
            Tuple of (ray_origin, ray_direction)
        """
        # Normalize screen coordinates to [-1, 1]
        norm_x = (2.0 * screen_x / screen_width) - 1.0
        norm_y = 1.0 - (2.0 * screen_y / screen_height)
        
        # Calculate ray in camera space
        fov_rad = math.radians(self.fov)
        tan_fov = math.tan(fov_rad / 2.0)
        
        ray_x = norm_x * tan_fov * self.aspect_ratio
        ray_y = norm_y * tan_fov
        ray_z = -1.0
        
        # Normalize ray direction
        ray_length = math.sqrt(ray_x**2 + ray_y**2 + ray_z**2)
        ray_x /= ray_length
        ray_y /= ray_length
        ray_z /= ray_length
        
        # Transform ray to world space
        # Rotate around pitch
        cos_pitch = math.cos(self.pitch)
        sin_pitch = math.sin(self.pitch)
        temp_y = ray_y * cos_pitch - ray_z * sin_pitch
        temp_z = ray_y * sin_pitch + ray_z * cos_pitch
        ray_y = temp_y
        ray_z = temp_z
        
        # Rotate around yaw
        cos_yaw = math.cos(self.yaw)
        sin_yaw = math.sin(self.yaw)
        temp_x = ray_x * cos_yaw - ray_y * sin_yaw
        temp_y = ray_x * sin_yaw + ray_y * cos_yaw
        ray_x = temp_x
        ray_y = temp_y
        
        ray_origin = np.array([self.x, self.y, self.z])
        ray_direction = np.array([ray_x, ray_y, ray_z])
        
        return ray_origin, ray_direction
    
    def get_view_matrix(self) -> np.ndarray:
        """Get the view transformation matrix"""
        # Create view matrix (simplified)
        view = np.eye(4)
        
        # Translation
        view[0, 3] = -self.x
        view[1, 3] = -self.y
        view[2, 3] = -self.z
        
        # Rotation (simplified - only yaw and pitch)
        cos_yaw = math.cos(self.yaw)
        sin_yaw = math.sin(self.yaw)
        cos_pitch = math.cos(self.pitch)
        sin_pitch = math.sin(self.pitch)
        
        rotation = np.array([
            [cos_yaw, -sin_yaw * cos_pitch, sin_yaw * sin_pitch, 0],
            [sin_yaw, cos_yaw * cos_pitch, -cos_yaw * sin_pitch, 0],
            [0, sin_pitch, cos_pitch, 0],
            [0, 0, 0, 1]
        ])
        
        return rotation @ view
    
    def get_projection_matrix(self) -> np.ndarray:
        """Get the projection transformation matrix"""
        fov_rad = math.radians(self.fov)
        f = 1.0 / math.tan(fov_rad / 2.0)
        
        projection = np.array([
            [f / self.aspect_ratio, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (self.far_plane + self.near_plane) / (self.near_plane - self.far_plane),
             (2 * self.far_plane * self.near_plane) / (self.near_plane - self.far_plane)],
            [0, 0, -1, 0]
        ])
        
        return projection


class CameraController:
    """Handles camera input and smooth movement"""
    
    def __init__(self, camera: Camera):
        self.camera = camera
        
        # Smooth movement
        self.velocity = np.array([0.0, 0.0, 0.0])
        self.angular_velocity = np.array([0.0, 0.0, 0.0])
        self.damping = 0.9
        
        # Mouse control
        self.mouse_sensitivity = 0.002
        self.is_dragging = False
        self.last_mouse_pos = (0, 0)
        
    def handle_keyboard(self, keys_pressed: dict, delta_time: float):
        """Handle keyboard input for camera movement"""
        move_speed = self.camera.move_speed * delta_time
        
        # WASD movement
        if keys_pressed.get('w', False):
            self.velocity[1] += move_speed
        if keys_pressed.get('s', False):
            self.velocity[1] -= move_speed
        if keys_pressed.get('a', False):
            self.velocity[0] -= move_speed
        if keys_pressed.get('d', False):
            self.velocity[0] += move_speed
        
        # Q/E for height
        if keys_pressed.get('q', False):
            self.velocity[2] -= move_speed
        if keys_pressed.get('e', False):
            self.velocity[2] += move_speed
        
        # Arrow keys for rotation
        if keys_pressed.get('left', False):
            self.angular_velocity[1] -= self.camera.rotate_speed * delta_time
        if keys_pressed.get('right', False):
            self.angular_velocity[1] += self.camera.rotate_speed * delta_time
        if keys_pressed.get('up', False):
            self.angular_velocity[0] += self.camera.rotate_speed * delta_time
        if keys_pressed.get('down', False):
            self.angular_velocity[0] -= self.camera.rotate_speed * delta_time
    
    def handle_mouse(self, mouse_x: int, mouse_y: int,
                    left_button: bool, right_button: bool,
                    middle_button: bool):
        """Handle mouse input for camera control"""
        if left_button:
            if self.is_dragging:
                # Calculate mouse delta
                dx = mouse_x - self.last_mouse_pos[0]
                dy = mouse_y - self.last_mouse_pos[1]
                
                # Rotate camera
                self.camera.rotate(
                    dy * self.mouse_sensitivity,
                    -dx * self.mouse_sensitivity
                )
            
            self.is_dragging = True
            self.last_mouse_pos = (mouse_x, mouse_y)
        else:
            self.is_dragging = False
        
        if right_button:
            # Pan camera
            if hasattr(self, 'last_pan_pos'):
                dx = mouse_x - self.last_pan_pos[0]
                dy = mouse_y - self.last_pan_pos[1]
                
                self.camera.move(
                    -dx * 0.05,
                    dy * 0.05,
                    0
                )
            
            self.last_pan_pos = (mouse_x, mouse_y)
    
    def handle_scroll(self, scroll_delta: float):
        """Handle mouse scroll for zoom"""
        self.camera.zoom(scroll_delta)
    
    def update(self, delta_time: float):
        """Update camera with smooth movement"""
        # Apply velocity
        self.camera.move(
            self.velocity[0],
            self.velocity[1],
            self.velocity[2]
        )
        
        # Apply angular velocity
        self.camera.rotate(
            self.angular_velocity[0],
            self.angular_velocity[1],
            self.angular_velocity[2]
        )
        
        # Apply damping
        self.velocity *= self.damping
        self.angular_velocity *= self.damping
        
        # Stop if velocity is very small
        if np.linalg.norm(self.velocity) < 0.01:
            self.velocity = np.array([0.0, 0.0, 0.0])
        if np.linalg.norm(self.angular_velocity) < 0.01:
            self.angular_velocity = np.array([0.0, 0.0, 0.0])