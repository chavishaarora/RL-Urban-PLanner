"""
Professional 3D Urban Park RL Application with Dynamic Grid Sizing AND TEMPERATURE CONTROL
Qt-based UI with embedded OpenGL rendering - ENHANCED VERSION WITH TEMPERATURE
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
            'temperature': self.park.get_temperature()  # NEW: Include temperature
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
        print("Park cleared")
    
    def apply_best_design(self):
        """Apply best design"""
        if self.rl_agent.best_design:
            self.park.from_dict(self.rl_agent.best_design)
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
        
        print(f"Random design generated: {num_elements} elements")


class MainWindow(QWidget):
    """Main window that combines UI and 3D viewport"""
    
    def __init__(self, app):
        super().__init__()
        self.app = app
        self.setWindowTitle("Urban Park RL - 3D Professional with Temperature")
        self.setGeometry(100, 100, 1600, 900)
        
        # Create layout
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Left panel (340px)
        from visualization.ui_qt import StyledGroupBox, ModernButton, QSlider, QLabel, QFrame
        from PyQt5.QtCore import Qt
        
        left_panel = self._create_left_panel()
        main_layout.addWidget(left_panel)
        
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
        
        # ========== NEW: TEMPERATURE CONTROL ==========
        layout.addSpacing(10)
        line_temp = QFrame()
        line_temp.setFrameShape(QFrame.HLine)
        line_temp.setStyleSheet("background-color: #506680;")
        layout.addWidget(line_temp)
        
        temp_label = QLabel("🌡️ Temperature (°C)")
        temp_label.setStyleSheet("color: #FF9664; font-size: 14px; font-weight: bold;")
        layout.addWidget(temp_label)
        
        self.temp_slider = QSlider(Qt.Horizontal)
        self.temp_slider.setMinimum(5)   # 5°C (cold)
        self.temp_slider.setMaximum(42)  # 42°C (extreme heat)
        self.temp_slider.setValue(int(self.app.park.get_temperature()))
        self.temp_slider.valueChanged.connect(self._on_temp_slider_changed)
        layout.addWidget(self.temp_slider)
        
        self.temp_value_label = QLabel(f"Current: {self.temp_slider.value()}°C (Comfortable)")
        self.temp_value_label.setStyleSheet("color: #A0A5B4; font-size: 13px;")
        layout.addWidget(self.temp_value_label)
        # ========== END TEMPERATURE CONTROL ==========
        
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
        
        # ========== NEW: TEMPERATURE DISPLAY ==========
        self.temp_display = QLabel("Temperature: 25.0°C")
        self.temp_display.setStyleSheet("color: #96FF96; font-size: 14px; font-weight: bold;")
        metrics_layout.addWidget(self.temp_display)
        
        line_temp = QFrame()
        line_temp.setFrameShape(QFrame.HLine)
        line_temp.setStyleSheet("background-color: #506680;")
        metrics_layout.addWidget(line_temp)
        # ========== END TEMPERATURE DISPLAY ==========
        
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
    
    # ========== NEW: TEMPERATURE SLIDER HANDLER ==========
    def _on_temp_slider_changed(self, value):
        """Handle temperature slider change"""
        from config import get_temperature_description, get_temperature_color
        
        # Update temperature in park
        self.app.park.set_temperature(float(value))
        
        # Get description
        description = get_temperature_description(float(value))
        
        # Update label with color
        color = get_temperature_color(float(value))
        color_hex = f"#{color[0]:02x}{color[1]:02x}{color[2]:02x}"
        
        self.temp_value_label.setText(f"Current: {value}°C ({description})")
        self.temp_value_label.setStyleSheet(f"color: {color_hex}; font-size: 13px; font-weight: bold;")
    # ========== END TEMPERATURE SLIDER HANDLER ==========
    
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
        # ========== NEW: UPDATE TEMPERATURE DISPLAY ==========
        from config import get_temperature_description, get_temperature_color
        temp = self.app.park.get_temperature()
        temp_desc = get_temperature_description(temp)
        temp_color = get_temperature_color(temp)
        color_hex = f"#{temp_color[0]:02x}{temp_color[1]:02x}{temp_color[2]:02x}"
        
        self.temp_display.setText(f"Temperature: {temp:.1f}°C ({temp_desc})")
        self.temp_display.setStyleSheet(f"color: {color_hex}; font-size: 14px; font-weight: bold;")
        # ========== END TEMPERATURE DISPLAY UPDATE ==========
        
        # Update stats
        num_elements = len(self.app.park.elements)
        occupancy = self.app.park.get_occupancy_rate()
        
        self.stat_elements.setText(f"Elements: {num_elements}")
        self.stat_occupancy.setText(f"Occupancy: {occupancy*100:.1f}%")
        
        # Update metrics
        try:
            metrics = self.app.get_metrics()
            self.comfort_metric.set_value(metrics['comfort'])
            self.utilization_metric.set_value(metrics['utilization'])
            self.coverage_metric.set_value(metrics['shade_coverage'])
            self.total_score.setText(f"Total Score: {metrics['total_score']:.2f}")
        except:
            pass
        
        # Update training status
        if self.app.training_active:
            self.training_status.setText("Status: Training...")
            self.training_status.setStyleSheet("color: #96FFB4; font-size: 13px;")
            self.training_episodes.setText(f"Episodes: {self.app.training_episodes_remaining}")
        else:
            self.training_status.setText("Status: Idle")
            self.training_status.setStyleSheet("color: #C8C8C8; font-size: 13px;")
            self.training_episodes.setText("Episodes: 0")


def main():
    """Main entry point"""
    qt_app = QApplication(sys.argv)
    
    app = UrbanParkRL3D()
    
    window = MainWindow(app)
    window.show()
    
    sys.exit(qt_app.exec_())


if __name__ == "__main__":
    main()