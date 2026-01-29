"""
Professional 3D Urban Park RL Application with Dynamic Grid Sizing AND TEMPERATURE CONTROL
Qt-based UI with embedded OpenGL rendering - ENHANCED VERSION WITH TEMPERATURE
INCLUDES: SimCity-style Heat Maps, Influence Radii, and Flow Fields
"""

import sys
import os
from PyQt5.QtWidgets import QApplication, QWidget, QHBoxLayout, QVBoxLayout
from PyQt5.QtCore import QTimer
from PyQt5.QtOpenGL import QGLWidget
from OpenGL.GL import *
from OpenGL.GLU import *

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from config import ElementType
from environment.park import Park
from agents.pedestrian import AgentManager
from rl.q_learning import QLearningAgent, ParkDesignTrainer
from rl.state import StateEncoder
from rl.actions import ActionSpace
from metrics.comfort import ComfortCalculator
from metrics.coverage import CoverageCalculator
from metrics.utilization import UtilizationCalculator
from metrics.distribution import DistributionCalculator
from utils.logger import Logger
from utils.data_manager import DataManager

# Import components
sys.path.insert(0, os.path.dirname(__file__))
from visualization.renderer3d import Renderer3DQt
from visualization.ui_qt import ProfessionalQtUI

# ========== SIMCITY FEATURES IMPORTS ==========
from sim_city_features.heatmap_system import HeatMapType
from sim_city_features.heatmap_renderer import HeatMapRenderer, InfluenceRadiusRenderer
from sim_city_features.flow_field_system import calculate_complete_flow_field, follow_flow_field


class OpenGLWidget(QGLWidget):
    """OpenGL widget that can be embedded in Qt"""
    
    def __init__(self, app, parent=None):
        super().__init__(parent)
        self.app = app
        self.renderer = None
        self.mouse_dragging = False
        self.last_mouse_pos = None
        self.mouse_button = None
        
    def initializeGL(self):
        """Initialize OpenGL context"""
        from visualization.renderer3d import Renderer3DQt
        self.renderer = Renderer3DQt(self.app.park)
        self.renderer.setup_opengl()
        
    def resizeGL(self, width, height):
        """Handle resize"""
        if self.renderer:
            self.renderer.resize(width, height)
    
    def paintGL(self):
        """Paint the scene"""
        if self.renderer:
            self.renderer.render(agent_manager=self.app.agent_manager)
            
            # ========== SIMCITY FEATURES RENDERING ==========
            # Render heat maps
            if hasattr(self.app, 'heatmap_renderer'):
                self.app.heatmap_renderer.render(self.app.agent_manager)
            
            # Render influence radii
            if hasattr(self.app, 'influence_renderer'):
                self.app.influence_renderer.render()
    
    def mousePressEvent(self, event):
        """Handle mouse press"""
        self.mouse_dragging = True
        self.last_mouse_pos = event.pos()
        self.mouse_button = event.button()
    
    def mouseReleaseEvent(self, event):
        """Handle mouse release"""
        self.mouse_dragging = False
        self.mouse_button = None
        self.last_mouse_pos = None
    
    def mouseMoveEvent(self, event):
        """Handle mouse move"""
        if self.mouse_dragging and self.last_mouse_pos and self.renderer:
            dx = event.x() - self.last_mouse_pos.x()
            dy = event.y() - self.last_mouse_pos.y()
            
            if self.mouse_button == 1:  # Left button
                self.renderer.camera.rotate(dx, -dy)
            elif self.mouse_button == 2:  # Right button
                sensitivity = 0.05
                self.renderer.camera.target[0] -= dx * sensitivity
                self.renderer.camera.target[2] += dy * sensitivity
            
            self.last_mouse_pos = event.pos()
            self.update()
    
    def wheelEvent(self, event):
        """Handle mouse wheel"""
        if self.renderer:
            delta = event.angleDelta().y() / 120.0
            self.renderer.camera.zoom(delta)
            self.update()


class UrbanParkRL3D:
    """Main application with Qt UI and embedded OpenGL rendering"""
    
    def __init__(self):
        print("Initializing Urban Park RL 3D with Temperature Control...")
        
        # Initialize park with default size and temperature
        self.park = Park(size=30.0, grid_size=3, temperature=25.0)
        self.agent_manager = AgentManager(self.park, num_agents=10)
        
        # Initialize RL
        self.rl_agent = QLearningAgent()
        self.trainer = ParkDesignTrainer(self.park, self.rl_agent)
        
        # Initialize metrics
        self.comfort_calc = ComfortCalculator(self.park)
        self.coverage_calc = CoverageCalculator(self.park)
        self.utilization_calc = UtilizationCalculator(self.park)
        self.distribution_calc = DistributionCalculator(self.park)
        
        # Utilities
        self.logger = Logger()
        self.data_manager = DataManager()
        
        # State
        self.running = True
        self.training_active = False
        self.training_episodes_remaining = 0
        self._total_training_episodes = 0
        
        # ========== SIMCITY FEATURES INITIALIZATION ==========
        print("Initializing SimCity features...")
        self.heatmap_renderer = HeatMapRenderer(self.park)
        self.influence_renderer = InfluenceRadiusRenderer(self.park)
        self.flow_field = None
        self.use_flow_field = False
        
        print("✨ SimCity features initialized!")
        print("  Press H to cycle heat maps")
        print("  Press I to toggle influence radii")
        print("  Press F to toggle flow field movement")
        print("  Press 1, 2, 3 for quick heat map access")
        
        # Remove any pathways or grass patches that might exist
        self.remove_disabled_elements()
        
        print("Initialization complete!")
    
    def remove_disabled_elements(self):
        """Remove pathways and grass patches from current park"""
        disabled_types = [ElementType.PATHWAY, ElementType.GRASS_PATCH]
        
        original_count = len(self.park.elements)
        self.park.elements = [
            elem for elem in self.park.elements 
            if elem.element_type not in disabled_types
        ]
        removed_count = original_count - len(self.park.elements)
        
        if removed_count > 0:
            print(f"Removed {removed_count} disabled elements (pathways/grass patches)")
    
    def change_grid_size(self, new_grid_size: int):
        """
        Change the grid size of the park - MORE cells in SAME space
        
        Args:
            new_grid_size: New grid dimensions (e.g., 3, 5, 7, 10)
        """
        print(f"\nChanging grid size from {self.park.grid_size}×{self.park.grid_size} to {new_grid_size}×{new_grid_size}")
        
        # Store current agent count and temperature
        current_agent_count = len(self.agent_manager.agents)
        current_temperature = self.park.get_temperature()
        
        # FIXED: Keep park size constant, change cell size
        park_size = self.park.size
        new_cell_size = park_size / new_grid_size
        
        print(f"  - Park size: {park_size}×{park_size} (UNCHANGED)")
        print(f"  - Cell size: {self.park.cell_size}×{self.park.cell_size} → {new_cell_size}×{new_cell_size}")
        print(f"  - Total cells: {self.park.grid_size * self.park.grid_size} → {new_grid_size * new_grid_size}")
        
        # Clear current park
        self.park.clear()
        self.agent_manager.clear_all_agents()
        
        # Update park dimensions
        self.park.grid_size = new_grid_size
        self.park.cell_size = new_cell_size
        self.park.grid_occupancy = [[False for _ in range(new_grid_size)] 
                                    for _ in range(new_grid_size)]
        
        # Restore temperature
        self.park.set_temperature(current_temperature)
        
        # Reinitialize RL components with new grid size
        print("  - Reinitializing RL components...")
        
        # Update state encoder
        self.rl_agent.state_encoder = StateEncoder(grid_size=new_grid_size)
        
        # Update action space
        self.rl_agent.action_space = ActionSpace(grid_size=new_grid_size)
        
        # Update action space size
        old_action_size = self.rl_agent.action_size
        self.rl_agent.action_size = self.rl_agent.action_space.action_space_size
        
        print(f"  - Action space: {old_action_size} → {self.rl_agent.action_size} actions")
        
        # Clear Q-table since action space changed
        if old_action_size != self.rl_agent.action_size:
            print(f"  - Clearing Q-table (action space changed)")
            self.rl_agent.q_table = {}
            self.rl_agent.best_reward = float('-inf')
            self.rl_agent.best_design = None
        
        # Respawn agents
        print(f"  - Respawning {current_agent_count} agents...")
        for _ in range(current_agent_count):
            self.agent_manager.spawn_agent()
        
        # ========== CLEAR SIMCITY CACHES ==========
        if hasattr(self, 'heatmap_renderer'):
            self.heatmap_renderer.clear_cache()
        
        print(f"✓ Grid size changed successfully!")
        print(f"  Grid: {new_grid_size}×{new_grid_size}")
        print(f"  Park size: {park_size}×{park_size} meters (SAME)")
        print(f"  Cell size: {new_cell_size:.2f}×{new_cell_size:.2f} meters (SMALLER)")
        print(f"  Temperature: {current_temperature:.1f}°C (PRESERVED)")
        print(f"  Cells: {new_grid_size * new_grid_size}")
        print(f"  Agents: {len(self.agent_manager.agents)}")
    
    def update(self, delta_time: float):
        """Update simulation"""
        self.agent_manager.update(delta_time)
        
        if self.training_active and self.training_episodes_remaining > 0:
            reward = self.trainer.train_episode(max_steps=10)
            self.training_episodes_remaining -= 1
            
            print(f"Episode {self.trainer.episode_num}: Reward = {reward:.2f}")
            
            if self.training_episodes_remaining <= 0:
                self.training_active = False
                print("Training completed!")
    
    def get_metrics(self) -> dict:
        """Get current metrics"""
        return {
            'comfort': self.comfort_calc.calculate_total_comfort(),
            'utilization': self.utilization_calc.calculate_utilization(),
            'shade_coverage': self.coverage_calc.calculate_shade_coverage(),
            'light_coverage': self.coverage_calc.calculate_light_coverage(),
            'distribution': self.distribution_calc.calculate_distribution_score(),
            'total_score': self.trainer.calculate_reward(),
            'temperature': self.park.get_temperature()
        }
    
    def start_training(self, episodes: int):
        """Start training"""
        self.training_active = True
        self.training_episodes_remaining = episodes
        self._total_training_episodes = episodes
        print(f"Starting training for {episodes} episodes with temperature variation...")
    
    def stop_training(self):
        """Stop training"""
        self.training_active = False
        self.training_episodes_remaining = 0
        print("Training stopped")
    
    def clear_park(self):
        """Clear park"""
        self.park.clear()
        # ========== CLEAR SIMCITY CACHES ==========
        if hasattr(self, 'heatmap_renderer'):
            self.heatmap_renderer.clear_cache()
        print("Park cleared")
    
    def apply_best_design(self):
        """Apply best design"""
        if self.rl_agent.best_design:
            self.park.from_dict(self.rl_agent.best_design)
            # ========== CLEAR SIMCITY CACHES ==========
            if hasattr(self, 'heatmap_renderer'):
                self.heatmap_renderer.clear_cache()
            print(f"Applied best design (reward: {self.rl_agent.best_reward:.2f})")
        else:
            print("No best design available")
    
    def generate_random_design(self):
        """Generate random design (excluding pathways and grass patches)"""
        import random
        self.park.clear()
        
        element_types = [ElementType.BENCH, ElementType.TREE, 
                        ElementType.FOUNTAIN, ElementType.STREET_LAMP]
        
        num_elements = random.randint(3, min(9, self.park.grid_size * self.park.grid_size))
        available = self.park.get_available_cells()
        
        for _ in range(num_elements):
            if not available:
                break
            x, y = random.choice(available)
            available.remove((x, y))
            self.park.add_element(random.choice(element_types), x, y)
        
        # ========== CLEAR SIMCITY CACHES ==========
        if hasattr(self, 'heatmap_renderer'):
            self.heatmap_renderer.clear_cache()
        
        print(f"Random design generated: {num_elements} elements")


class MainWindow(QWidget):
    """Main window that combines UI and 3D viewport"""
    
    def __init__(self, app):
        super().__init__()
        self.app = app
        self.setWindowTitle("Urban Park RL - 3D Professional with Temperature & SimCity Features")
        self.setGeometry(100, 100, 1600, 900)
        
        # Create layout
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Left panel (340px)
        from visualization.ui_qt import StyledGroupBox, ModernButton, QSlider, QLabel, QFrame
        from PyQt5.QtCore import Qt
        
        left_container = self._create_left_container()
        main_layout.addWidget(left_container)
        
        # Center - OpenGL viewport (flexible)
        self.gl_widget = OpenGLWidget(app)
        self.gl_widget.setMinimumWidth(600)
        main_layout.addWidget(self.gl_widget, 1)
        
        # Right panel (340px)
        right_panel = self._create_right_panel()
        main_layout.addWidget(right_panel)
        
        self.setLayout(main_layout)
        
        # Set dark background
        self.setStyleSheet("""
            QWidget {
                background-color: #0F1219;
                color: #DCE1EB;
                font-family: 'Arial', sans-serif;
            }
        """)
        
        # Update timers
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self._update)
        self.update_timer.start(16)  # ~60 FPS
        
        self.ui_timer = QTimer()
        self.ui_timer.timeout.connect(self._update_ui)
        self.ui_timer.start(100)  # Update UI every 100ms
    
    # ========== SIMCITY KEYBOARD CONTROLS ==========
    def keyPressEvent(self, event):
        """Handle keyboard input for SimCity features"""
        key = event.text().lower()
        
        if key == 'h':
            # Cycle through heat maps
            self._cycle_heatmap()
        
        elif key == 'i':
            # Toggle influence radii
            if hasattr(self.app, 'influence_renderer'):
                self.app.influence_renderer.toggle_all()
                self.gl_widget.update()
        
        elif key == 'f':
            # Toggle flow field
            self._toggle_flow_field()
        
        elif key == '1':
            # Quick: Thermal Comfort
            if hasattr(self.app, 'heatmap_renderer'):
                self.app.heatmap_renderer.set_heatmap_type(HeatMapType.THERMAL_COMFORT)
                self.gl_widget.update()
        
        elif key == '2':
            # Quick: Pedestrian Density
            if hasattr(self.app, 'heatmap_renderer'):
                self.app.heatmap_renderer.set_heatmap_type(HeatMapType.PEDESTRIAN_DENSITY)
                self.gl_widget.update()
        
        elif key == '3':
            # Quick: Overall Quality
            if hasattr(self.app, 'heatmap_renderer'):
                self.app.heatmap_renderer.set_heatmap_type(HeatMapType.OVERALL_QUALITY)
                self.gl_widget.update()
    
    def _cycle_heatmap(self):
        """Cycle through available heat maps"""
        if not hasattr(self.app, 'heatmap_renderer'):
            return
        
        heatmap_types = [
            HeatMapType.NONE,
            HeatMapType.THERMAL_COMFORT,
            HeatMapType.SHADE_COVERAGE,
            HeatMapType.LIGHT_COVERAGE,
            HeatMapType.PEDESTRIAN_DENSITY,
            HeatMapType.ACCESSIBILITY,
            HeatMapType.EFFECTIVE_TEMPERATURE,
            HeatMapType.OVERALL_QUALITY
        ]
        
        current = self.app.heatmap_renderer.current_type
        try:
            current_idx = heatmap_types.index(current)
        except ValueError:
            current_idx = 0
        
        next_idx = (current_idx + 1) % len(heatmap_types)
        self.app.heatmap_renderer.set_heatmap_type(heatmap_types[next_idx])
        self.gl_widget.update()
    
    def _toggle_flow_field(self):
        """Toggle flow field movement for agents"""
        if not hasattr(self.app, 'use_flow_field'):
            self.app.use_flow_field = False
        
        self.app.use_flow_field = not self.app.use_flow_field
        
        if self.app.use_flow_field:
            # Recompute flow field
            benches = self.app.park.get_elements_by_type(ElementType.BENCH)
            if benches:
                self.app.flow_field = calculate_complete_flow_field(
                    self.app.park, 
                    benches, 
                    resolution=20
                )
                print("🌊 Flow Field: ON (agents follow natural paths)")
            else:
                print("⚠️  No benches for flow field targets")
                self.app.use_flow_field = False
        else:
            self.app.flow_field = None
            print("🌊 Flow Field: OFF (agents use default movement)")
    
    # ========== REST OF THE METHODS (unchanged) ==========
    
    def _create_left_panel(self):
        """Create left control panel"""
        from visualization.ui_qt import StyledGroupBox, ModernButton, QSlider, QLabel, QFrame, QComboBox
        from PyQt5.QtCore import Qt
        from PyQt5.QtWidgets import QVBoxLayout
        
        panel = StyledGroupBox("🏗 Park Design")
        layout = QVBoxLayout()
        layout.setSpacing(15)
        layout.setContentsMargins(20, 30, 20, 20)
        
        # Buttons
        clear_btn = ModernButton("Clear Park")
        clear_btn.clicked.connect(self.app.clear_park)
        layout.addWidget(clear_btn)
        
        random_btn = ModernButton("Random Design")
        random_btn.clicked.connect(self.app.generate_random_design)
        layout.addWidget(random_btn)
        
        best_btn = ModernButton("Apply Best Design")
        best_btn.clicked.connect(self.app.apply_best_design)
        layout.addWidget(best_btn)
        
        # Separator
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background-color: #506680;")
        layout.addWidget(line)
        
        # Grid Size Control
        grid_size_label = QLabel("Grid Size")
        grid_size_label.setStyleSheet("color: #96C8FF; font-size: 14px; font-weight: bold;")
        layout.addWidget(grid_size_label)
        
        self.grid_size_combo = QComboBox()
        self.grid_size_combo.addItems(["3×3 (Tiny)", "5×5 (Small)", "7×7 (Medium)", "10×10 (Large)"])
        self.grid_size_combo.setCurrentIndex(0)
        self.grid_size_combo.setStyleSheet("""
            QComboBox {
                background-color: #2C3E50;
                color: #ECF0F1;
                border: 2px solid #34495E;
                border-radius: 5px;
                padding: 8px;
                font-size: 13px;
            }
            QComboBox:hover {
                border-color: #5DADE2;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox QAbstractItemView {
                background-color: #34495E;
                color: #ECF0F1;
                selection-background-color: #5DADE2;
            }
        """)
        self.grid_size_combo.currentIndexChanged.connect(self._on_grid_size_changed)
        layout.addWidget(self.grid_size_combo)
        
        self.grid_size_info = QLabel(f"Current: 3×3 (9 cells)")
        self.grid_size_info.setStyleSheet("color: #A0A5B4; font-size: 12px;")
        layout.addWidget(self.grid_size_info)
        
        # ========== TEMPERATURE CONTROL ==========
        layout.addSpacing(10)
        line_temp = QFrame()
        line_temp.setFrameShape(QFrame.HLine)
        line_temp.setStyleSheet("background-color: #506680;")
        layout.addWidget(line_temp)
        
        temp_label = QLabel("🌡️ Temperature (°C)")
        temp_label.setStyleSheet("color: #FF9664; font-size: 14px; font-weight: bold;")
        layout.addWidget(temp_label)
        
        self.temp_slider = QSlider(Qt.Horizontal)
        self.temp_slider.setMinimum(5)
        self.temp_slider.setMaximum(42)
        self.temp_slider.setValue(int(self.app.park.get_temperature()))
        self.temp_slider.valueChanged.connect(self._on_temp_slider_changed)
        layout.addWidget(self.temp_slider)
        
        self.temp_value_label = QLabel(f"Current: {self.temp_slider.value()}°C (Comfortable)")
        self.temp_value_label.setStyleSheet("color: #A0A5B4; font-size: 13px;")
        layout.addWidget(self.temp_value_label)
        
        # Separator
        layout.addSpacing(10)
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setStyleSheet("background-color: #506680;")
        layout.addWidget(line2)
        
        # Agent slider
        agent_label = QLabel("Agent Count")
        agent_label.setStyleSheet("color: #96C896; font-size: 14px; font-weight: bold;")
        layout.addWidget(agent_label)
        
        self.agent_slider = QSlider(Qt.Horizontal)
        self.agent_slider.setMinimum(5)
        self.agent_slider.setMaximum(50)
        self.agent_slider.setValue(len(self.app.agent_manager.agents))
        self.agent_slider.valueChanged.connect(self._on_agent_slider_changed)
        layout.addWidget(self.agent_slider)
        
        self.agent_value_label = QLabel(f"Agents: {self.agent_slider.value()}")
        self.agent_value_label.setStyleSheet("color: #A0A5B4; font-size: 13px;")
        layout.addWidget(self.agent_value_label)
        
        # Stats
        layout.addSpacing(10)
        line3 = QFrame()
        line3.setFrameShape(QFrame.HLine)
        line3.setStyleSheet("background-color: #506680;")
        layout.addWidget(line3)
        
        stats_label = QLabel("Park Statistics")
        stats_label.setStyleSheet("color: #FFC864; font-size: 14px; font-weight: bold;")
        layout.addWidget(stats_label)
        
        self.stat_elements = QLabel("Elements: 0")
        self.stat_elements.setStyleSheet("color: #DCE1EB; font-size: 13px;")
        layout.addWidget(self.stat_elements)
        
        self.stat_occupancy = QLabel("Occupancy: 0%")
        self.stat_occupancy.setStyleSheet("color: #DCE1EB; font-size: 13px;")
        layout.addWidget(self.stat_occupancy)
        
        layout.addStretch()
        
        panel.setLayout(layout)
        panel.setFixedWidth(340)
        return panel
    
    def _on_time_slider_changed(self, value):
        """Handle time slider change"""
        hour = value / 10.0
        
        if hasattr(self.gl_widget, 'renderer') and self.gl_widget.renderer:
            self.gl_widget.renderer.set_time(hour)
        
        self._update_time_display()

    def _on_speed_button_clicked(self, speed):
        """Handle speed button click"""
        if hasattr(self.gl_widget, 'renderer') and self.gl_widget.renderer:
            if speed == 0:
                self.gl_widget.renderer.pause_time()
                self.speed_display.setText("Speed: PAUSED")
            else:
                self.gl_widget.renderer.resume_time()
                self.gl_widget.renderer.set_time_speed(speed)
                
                if speed == 1:
                    self.speed_display.setText("Speed: Real-time")
                else:
                    seconds_per_hour = 3600 / speed
                    if seconds_per_hour >= 60:
                        minutes = seconds_per_hour / 60
                        self.speed_display.setText(f"Speed: {speed}x ({minutes:.1f} min/hour)")
                    else:
                        self.speed_display.setText(f"Speed: {speed}x ({seconds_per_hour:.1f} sec/hour)")
        
        for btn, btn_speed in self.speed_buttons:
            if btn_speed == speed:
                btn.setStyleSheet("""
                    QPushButton {
                        background-color: #96D4FF;
                        color: #0A0F1A;
                        border: 2px solid #96D4FF;
                        border-radius: 5px;
                        padding: 5px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                """)
            else:
                btn.setStyleSheet("""
                    QPushButton {
                        background-color: #2D3E50;
                        color: white;
                        border: 2px solid #3A5266;
                        border-radius: 5px;
                        padding: 5px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    QPushButton:hover {
                        background-color: #3A5266;
                        border-color: #96D4FF;
                    }
                """)

    def _set_time_preset(self, hour):
        """Set time to a preset value"""
        if hasattr(self.gl_widget, 'renderer') and self.gl_widget.renderer:
            self.gl_widget.renderer.set_time(hour)
            self.time_slider.setValue(int(hour * 10))
            self._update_time_display()

    def _update_time_display(self):
        """Update time display label"""
        if not hasattr(self.gl_widget, 'renderer') or not self.gl_widget.renderer:
            return
        
        stats = self.gl_widget.renderer.get_time_stats()
        
        time_str = stats['formatted_time']
        time_of_day = stats['time_of_day']
        
        emoji_map = {
            'Night': '🌙',
            'Pre-Dawn': '🌌',
            'Sunrise': '🌅',
            'Morning': '🌄',
            'Noon': '☀️',
            'Afternoon': '🌞',
            'Sunset': '🌆',
            'Dusk': '🌇'
        }
        emoji = emoji_map.get(time_of_day, '⏰')
        
        self.time_display.setText(f"{emoji} Time: {time_str} - {time_of_day}")
        
        alt = stats['sun_altitude']
        az = stats['sun_azimuth']
        intensity = stats['sun_intensity']
        
        if alt > 0:
            self.sun_info.setText(f"☀️ Sun: Alt {alt:.1f}°, Az {az:.1f}° (Intensity: {intensity:.1%})")
            self.sun_info.setStyleSheet("color: #FFD700; font-size: 12px;")
        else:
            self.sun_info.setText(f"🌙 Sun: Below Horizon ({alt:.1f}°)")
            self.sun_info.setStyleSheet("color: #6B7280; font-size: 12px;")
        
        if stats['lamps_on']:
            self.lighting_info.setText("💡 Street Lamps: ON")
            self.lighting_info.setStyleSheet("color: #FFE66D; font-size: 12px;")
        else:
            self.lighting_info.setText("💡 Street Lamps: OFF")
            self.lighting_info.setStyleSheet("color: #6B7280; font-size: 12px;")
    

    def _create_time_control_panel(self):
        """Create time control panel"""
        from visualization.ui_qt import StyledGroupBox, ModernButton, QSlider, QLabel, QFrame, QComboBox
        from PyQt5.QtCore import Qt
        from PyQt5.QtWidgets import QVBoxLayout, QHBoxLayout
        
        panel = StyledGroupBox("⏰ Time & Lighting")
        layout = QVBoxLayout()
        layout.setSpacing(15)
        layout.setContentsMargins(20, 30, 20, 20)
        
        self.time_display = QLabel("Time: 14:00 - Afternoon")
        self.time_display.setStyleSheet("""
            color: #FFE66D;
            font-size: 16px;
            font-weight: bold;
            background-color: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-radius: 5px;
        """)
        layout.addWidget(self.time_display)
        
        time_label = QLabel("Time of Day")
        time_label.setStyleSheet("color: #FFE66D; font-size: 14px; font-weight: bold;")
        layout.addWidget(time_label)
        
        self.time_slider = QSlider(Qt.Horizontal)
        self.time_slider.setMinimum(0)
        self.time_slider.setMaximum(240)
        self.time_slider.setValue(140)
        self.time_slider.valueChanged.connect(self._on_time_slider_changed)
        self.time_slider.setStyleSheet("""
            QSlider::groove:horizontal {
                border: none;
                height: 8px;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #1a1a2e,
                    stop:0.25 #ff6b6b,
                    stop:0.5 #ffd93d,
                    stop:0.75 #ff6b6b,
                    stop:1 #1a1a2e);
                border-radius: 4px;
            }
            QSlider::handle:horizontal {
                background: #FFE66D;
                border: 3px solid #fff;
                width: 20px;
                height: 20px;
                margin: -7px 0;
                border-radius: 10px;
            }
            QSlider::handle:horizontal:hover {
                background: #FFF;
            }
        """)
        layout.addWidget(self.time_slider)
        
        time_markers = QLabel("🌙 00:00     🌅 06:00     ☀️ 12:00     🌆 18:00     🌙 24:00")
        time_markers.setStyleSheet("color: #A0A5B4; font-size: 10px;")
        layout.addWidget(time_markers)
        
        layout.addSpacing(10)
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setStyleSheet("background-color: #506680;")
        layout.addWidget(separator)
        
        speed_label = QLabel("Time Speed")
        speed_label.setStyleSheet("color: #96D4FF; font-size: 14px; font-weight: bold;")
        layout.addWidget(speed_label)
        
        speed_buttons_layout = QHBoxLayout()
        speed_buttons_layout.setSpacing(10)
        
        speeds = [
            ("Pause", 0),
            ("Real", 1),
            ("5x", 5),
            ("30x", 30),
            ("120x", 120),
            ("Fast", 360)
        ]
        
        self.speed_buttons = []
        for label, speed in speeds:
            btn = ModernButton(label)
            btn.setMaximumWidth(70)
            btn.setMinimumHeight(35)
            btn.clicked.connect(lambda checked, s=speed: self._on_speed_button_clicked(s))
            btn.setStyleSheet("""
                QPushButton {
                    background-color: #2D3E50;
                    color: white;
                    border: 2px solid #3A5266;
                    border-radius: 5px;
                    padding: 5px;
                    font-size: 11px;
                    font-weight: bold;
                }
                QPushButton:hover {
                    background-color: #3A5266;
                    border-color: #96D4FF;
                }
                QPushButton:pressed {
                    background-color: #96D4FF;
                }
            """)
            speed_buttons_layout.addWidget(btn)
            self.speed_buttons.append((btn, speed))
        
        layout.addLayout(speed_buttons_layout)
        
        self.speed_display = QLabel("Speed: 120x (1 hour = 30 sec)")
        self.speed_display.setStyleSheet("color: #A0A5B4; font-size: 12px;")
        layout.addWidget(self.speed_display)
        
        layout.addSpacing(10)
        separator2 = QFrame()
        separator2.setFrameShape(QFrame.HLine)
        separator2.setStyleSheet("background-color: #506680;")
        layout.addWidget(separator2)
        
        preset_label = QLabel("Quick Time Presets")
        preset_label.setStyleSheet("color: #FFA07A; font-size: 14px; font-weight: bold;")
        layout.addWidget(preset_label)
        
        presets_layout = QHBoxLayout()
        presets_layout.setSpacing(8)
        
        time_presets = [
            ("🌅 Dawn", 6.0),
            ("☀️ Noon", 12.0),
            ("🌆 Dusk", 18.0),
            ("🌙 Night", 22.0)
        ]
        
        for label, hour in time_presets:
            btn = ModernButton(label)
            btn.setMaximumWidth(80)
            btn.setMinimumHeight(35)
            btn.clicked.connect(lambda checked, h=hour: self._set_time_preset(h))
            btn.setStyleSheet("""
                QPushButton {
                    background-color: #3D2E5A;
                    color: white;
                    border: 2px solid #4A3768;
                    border-radius: 5px;
                    padding: 5px;
                    font-size: 11px;
                    font-weight: bold;
                }
                QPushButton:hover {
                    background-color: #4A3768;
                    border-color: #FFA07A;
                }
            """)
            presets_layout.addWidget(btn)
        
        layout.addLayout(presets_layout)
        
        layout.addSpacing(10)
        separator3 = QFrame()
        separator3.setFrameShape(QFrame.HLine)
        separator3.setStyleSheet("background-color: #506680;")
        layout.addWidget(separator3)
        
        self.sun_info = QLabel("☀️ Sun: Altitude 45°, Azimuth 180°")
        self.sun_info.setStyleSheet("color: #FFD700; font-size: 12px;")
        layout.addWidget(self.sun_info)
        
        self.lighting_info = QLabel("💡 Street Lamps: OFF")
        self.lighting_info.setStyleSheet("color: #A0A5B4; font-size: 12px;")
        layout.addWidget(self.lighting_info)
        
        layout.addStretch()
        
        panel.setLayout(layout)
        panel.setFixedWidth(340)
        return panel
    
    def _create_right_panel(self):
        """Create right panel with training and metrics"""
        from visualization.ui_qt import StyledGroupBox, ModernButton, MetricDisplay, QLabel, QFrame
        from PyQt5.QtWidgets import QVBoxLayout, QWidget
        
        widget = QWidget()
        main_layout = QVBoxLayout()
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(0, 20, 20, 20)
        
        # Training panel
        training_panel = StyledGroupBox("🤖 RL Training")
        training_layout = QVBoxLayout()
        training_layout.setSpacing(12)
        training_layout.setContentsMargins(20, 30, 20, 20)
        
        train1_btn = ModernButton("Train 1 Episode")
        train1_btn.clicked.connect(lambda: self.app.start_training(1))
        training_layout.addWidget(train1_btn)
        
        train10_btn = ModernButton("Train 10 Episodes")
        train10_btn.clicked.connect(lambda: self.app.start_training(10))
        training_layout.addWidget(train10_btn)
        
        train100_btn = ModernButton("Train 100 Episodes")
        train100_btn.clicked.connect(lambda: self.app.start_training(100))
        training_layout.addWidget(train100_btn)
        
        stop_btn = ModernButton("Stop Training")
        stop_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF6464;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #FF8080;
            }
        """)
        stop_btn.clicked.connect(self.app.stop_training)
        training_layout.addWidget(stop_btn)
        
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background-color: #506680;")
        training_layout.addWidget(line)
        
        self.training_status = QLabel("Status: Idle")
        self.training_status.setStyleSheet("color: #96FFB4; font-size: 13px;")
        training_layout.addWidget(self.training_status)
        
        self.training_episodes = QLabel("Episodes: 0")
        self.training_episodes.setStyleSheet("color: #DCE1EB; font-size: 13px;")
        training_layout.addWidget(self.training_episodes)
        
        training_panel.setLayout(training_layout)
        training_panel.setFixedWidth(340)
        main_layout.addWidget(training_panel)
        
        # Metrics panel
        metrics_panel = StyledGroupBox("📊 Metrics")
        metrics_layout = QVBoxLayout()
        metrics_layout.setSpacing(5)
        metrics_layout.setContentsMargins(20, 30, 20, 20)
        
        self.temp_display = QLabel("Temperature: 25.0°C")
        self.temp_display.setStyleSheet("color: #96FF96; font-size: 14px; font-weight: bold;")
        metrics_layout.addWidget(self.temp_display)
        
        line_temp = QFrame()
        line_temp.setFrameShape(QFrame.HLine)
        line_temp.setStyleSheet("background-color: #506680;")
        metrics_layout.addWidget(line_temp)
        
        self.comfort_metric = MetricDisplay("Comfort")
        metrics_layout.addWidget(self.comfort_metric)
        
        self.utilization_metric = MetricDisplay("Utilization")
        metrics_layout.addWidget(self.utilization_metric)
        
        self.coverage_metric = MetricDisplay("Coverage")
        metrics_layout.addWidget(self.coverage_metric)
        
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setStyleSheet("background-color: #506680;")
        metrics_layout.addWidget(line2)
        
        self.total_score = QLabel("Total Score: 0.00")
        self.total_score.setStyleSheet("color: #FFFF96; font-size: 16px; font-weight: bold;")
        metrics_layout.addWidget(self.total_score)
        
        metrics_panel.setLayout(metrics_layout)
        metrics_panel.setFixedWidth(340)
        main_layout.addWidget(metrics_panel)
        
        main_layout.addStretch()
        
        widget.setLayout(main_layout)
        return widget
    
    def _on_grid_size_changed(self, index):
        """Handle grid size change"""
        grid_sizes = [3, 5, 7, 10]
        new_grid_size = grid_sizes[index]
        
        size_names = ["3×3 (Tiny)", "5×5 (Small)", "7×7 (Medium)", "10×10 (Large)"]
        total_cells = new_grid_size * new_grid_size
        
        self.grid_size_info.setText(f"Current: {size_names[index]} ({total_cells} cells)")
        
        print(f"\n{'='*50}")
        print(f"Changing grid size to {new_grid_size}×{new_grid_size}")
        print(f"{'='*50}")
        
        self.app.change_grid_size(new_grid_size)
        self._update_ui()
    
    def _create_left_container(self):
        """Create left container with both panels"""
        from PyQt5.QtWidgets import QVBoxLayout, QWidget
        
        container = QWidget()
        layout = QVBoxLayout()
        layout.setSpacing(20)
        layout.setContentsMargins(0, 0, 0, 0)
        
        design_panel = self._create_left_panel()
        layout.addWidget(design_panel)
        
        time_panel = self._create_time_control_panel()
        layout.addWidget(time_panel)
        
        layout.addStretch()
        
        container.setLayout(layout)
        return container
    
    def _on_temp_slider_changed(self, value):
        """Handle temperature slider change"""
        from config import get_temperature_description, get_temperature_color
        
        self.app.park.set_temperature(float(value))
        
        description = get_temperature_description(float(value))
        
        color = get_temperature_color(float(value))
        color_hex = f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
        
        self.temp_value_label.setText(f"Current: {value}°C ({description})")
        self.temp_value_label.setStyleSheet(f"color: {color_hex}; font-size: 13px; font-weight: bold;")
        
        # Clear heat map cache when temperature changes
        if hasattr(self.app, 'heatmap_renderer'):
            self.app.heatmap_renderer.clear_cache()
    
    def _on_agent_slider_changed(self, value):
        """Handle agent slider change"""
        self.agent_value_label.setText(f"Agents: {value}")
        
        current = len(self.app.agent_manager.agents)
        if value > current:
            for _ in range(value - current):
                self.app.agent_manager.spawn_agent()
        elif value < current:
            for _ in range(current - value):
                if self.app.agent_manager.agents:
                    self.app.agent_manager.agents.pop()
    
    def _update(self):
        """Update loop"""
        self.app.update(1/60)
        self.gl_widget.update()
    
    def _update_ui(self):
        """Update UI elements"""
        from config import get_temperature_description, get_temperature_color
        temp = self.app.park.get_temperature()
        temp_desc = get_temperature_description(temp)
        temp_color = get_temperature_color(temp)
        color_hex = f"#{temp_color[0]:02x}{temp_color[1]:02x}{temp_color[2]:02x}"
        
        self.temp_display.setText(f"Temperature: {temp:.1f}°C ({temp_desc})")
        self.temp_display.setStyleSheet(f"color: {color_hex}; font-size: 14px; font-weight: bold;")
        
        num_elements = len(self.app.park.elements)
        occupancy = self.app.park.get_occupancy_rate()
        
        self.stat_elements.setText(f"Elements: {num_elements}")
        self.stat_occupancy.setText(f"Occupancy: {occupancy*100:.1f}%")
        
        try:
            metrics = self.app.get_metrics()
            self.comfort_metric.set_value(metrics['comfort'])
            self.utilization_metric.set_value(metrics['utilization'])
            self.coverage_metric.set_value(metrics['shade_coverage'])
            self.total_score.setText(f"Total Score: {metrics['total_score']:.2f}")
        except:
            pass
        
        if self.app.training_active:
            self.training_status.setText("Status: Training...")
            self.training_status.setStyleSheet("color: #96FFB4; font-size: 13px;")
            self.training_episodes.setText(f"Episodes: {self.app.training_episodes_remaining}")
        else:
            self.training_status.setText("Status: Idle")
            self.training_status.setStyleSheet("color: #C8C8C8; font-size: 13px;")
            self.training_episodes.setText("Episodes: 0")
        
        self._update_time_display()


def main():
    """Main entry point"""
    qt_app = QApplication(sys.argv)
    
    app = UrbanParkRL3D()
    
    window = MainWindow(app)
    window.show()
    
    print("\n" + "="*70)
    print("  🎮 SIMCITY FEATURES ENABLED!")
    print("="*70)
    print("\n  Keyboard Controls:")
    print("    H   - Cycle through heat maps")
    print("    I   - Toggle influence radii (coverage circles)")
    print("    F   - Toggle flow field movement")
    print("    1   - Quick: Thermal Comfort heat map")
    print("    2   - Quick: Pedestrian Density heat map")
    print("    3   - Quick: Overall Quality heat map")
    print("\n" + "="*70 + "\n")
    
    sys.exit(qt_app.exec_())


if __name__ == "__main__":
    main()