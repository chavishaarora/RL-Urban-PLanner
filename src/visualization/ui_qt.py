"""
Professional Qt-based UI for Urban Park RL
Production-grade interface with modern design
"""

from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton, 
                             QLabel, QSlider, QFrame, QProgressBar, QGroupBox, QComboBox)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtGui import QFont, QPalette, QColor


class ModernButton(QPushButton):
    """Styled button with hover effects"""
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self.setMinimumHeight(45)
        self.setStyleSheet("""
            QPushButton {
                background-color: #409CFF;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #54B0FF;
            }
            QPushButton:pressed {
                background-color: #2C88EB;
            }
            QPushButton:disabled {
                background-color: #3A3F50;
                color: #646974;
            }
        """)


class MetricDisplay(QWidget):
    """Custom widget for displaying metrics with progress bar"""
    def __init__(self, label, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout()
        layout.setSpacing(5)
        
        # Label
        self.label = QLabel(label)
        self.label.setStyleSheet("color: #DCE1EB; font-size: 14px;")
        layout.addWidget(self.label)
        
        # Progress bar
        self.progress = QProgressBar()
        self.progress.setMinimum(0)
        self.progress.setMaximum(100)
        self.progress.setTextVisible(False)
        self.progress.setStyleSheet("""
            QProgressBar {
                border: none;
                border-radius: 3px;
                background-color: #2D3238;
                height: 10px;
            }
            QProgressBar::chunk {
                border-radius: 3px;
                background-color: #50C878;
            }
        """)
        layout.addWidget(self.progress)
        
        # Value label
        self.value_label = QLabel("0.00")
        self.value_label.setStyleSheet("color: #A0A5B4; font-size: 12px;")
        layout.addWidget(self.value_label)
        
        layout.setContentsMargins(0, 0, 0, 10)
        self.setLayout(layout)
    
    def set_value(self, value):
        """Update the metric value"""
        self.progress.setValue(int(value * 100))
        self.value_label.setText(f"{value:.2f}")
        
        # Color based on value
        if value > 0.7:
            color = "#50C878"  # Green
        elif value > 0.4:
            color = "#FFB400"  # Orange
        else:
            color = "#FF6464"  # Red
        
        self.progress.setStyleSheet(f"""
            QProgressBar {{
                border: none;
                border-radius: 3px;
                background-color: #2D3238;
                height: 10px;
            }}
            QProgressBar::chunk {{
                border-radius: 3px;
                background-color: {color};
            }}
        """)


class StyledGroupBox(QGroupBox):
    """Styled group box for panels"""
    def __init__(self, title, parent=None):
        super().__init__(title, parent)
        self.setStyleSheet("""
            QGroupBox {
                background-color: rgba(30, 35, 45, 240);
                border: 2px solid #409CFF;
                border-radius: 10px;
                margin-top: 10px;
                padding-top: 20px;
                font-size: 16px;
                font-weight: bold;
                color: #409CFF;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 20px;
                padding: 0 5px;
            }
        """)


class ProfessionalQtUI(QWidget):
    """Main Qt UI Widget"""
    
    # Signals
    update_requested = pyqtSignal()
    
    def __init__(self, app):
        super().__init__()
        self.app = app
        self.setWindowTitle("Urban Park RL - 3D Professional")
        self.setGeometry(100, 100, 1400, 900)
        
        # Set dark theme
        self._setup_theme()
        
        # Create UI
        self._create_ui()
        
        # Update timer
        self.timer = QTimer()
        self.timer.timeout.connect(self._update_ui)
        self.timer.start(100)  # Update every 100ms
    
    def _setup_theme(self):
        """Setup dark theme"""
        self.setAutoFillBackground(True)
        palette = self.palette()
        palette.setColor(QPalette.Window, QColor(15, 18, 25))
        palette.setColor(QPalette.WindowText, QColor(220, 225, 235))
        self.setPalette(palette)
        
        # Global stylesheet
        self.setStyleSheet("""
            QWidget {
                background-color: transparent;
                color: #DCE1EB;
                font-family: 'Arial', sans-serif;
            }
            QLabel {
                color: #DCE1EB;
            }
            QSlider::groove:horizontal {
                border: none;
                height: 6px;
                background: #2D3238;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #64ACFF;
                border: 2px solid #DCE1EB;
                width: 16px;
                height: 16px;
                margin: -6px 0;
                border-radius: 8px;
            }
            QSlider::handle:horizontal:hover {
                background: #409CFF;
            }
            QSlider::sub-page:horizontal {
                background: #409CFF;
                border-radius: 3px;
            }
        """)
    
    def _create_ui(self):
        """Create the UI layout"""
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(20)
        
        # Left panel - Design Controls
        left_panel = self._create_design_panel()
        main_layout.addWidget(left_panel, 0)
        
        # Center - OpenGL viewport (will be overlaid)
        main_layout.addStretch(1)
        
        # Right panel - Training & Metrics
        right_layout = QVBoxLayout()
        right_layout.setSpacing(20)
        
        training_panel = self._create_training_panel()
        right_layout.addWidget(training_panel)
        
        metrics_panel = self._create_metrics_panel()
        right_layout.addWidget(metrics_panel)
        
        right_layout.addStretch()
        
        right_widget = QWidget()
        right_widget.setLayout(right_layout)
        main_layout.addWidget(right_widget, 0)
        
        self.setLayout(main_layout)
    
    def _create_design_panel(self):
        """Create design control panel"""
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
        
        # Grid Size Control (NEW)
        layout.addSpacing(10)
        line_grid = QFrame()
        line_grid.setFrameShape(QFrame.HLine)
        line_grid.setStyleSheet("background-color: #506680;")
        layout.addWidget(line_grid)
        
        grid_size_label = QLabel("Grid Size")
        grid_size_label.setStyleSheet("color: #96C8FF; font-size: 14px; font-weight: bold;")
        layout.addWidget(grid_size_label)
        
        # Grid size selector (dropdown)
        self.grid_size_combo = QComboBox()
        self.grid_size_combo.addItems(["3×3 (Tiny)", "5×5 (Small)", "7×7 (Medium)", "10×10 (Large)"])
        self.grid_size_combo.setCurrentIndex(0)  # Default to 3x3
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
        
        # Stats
        layout.addSpacing(10)
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setStyleSheet("background-color: #506680;")
        layout.addWidget(line2)
        
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
    
    def _create_training_panel(self):
        """Create training control panel"""
        panel = StyledGroupBox("🤖 RL Training")
        layout = QVBoxLayout()
        layout.setSpacing(12)
        layout.setContentsMargins(20, 30, 20, 20)
        
        # Training buttons
        train1_btn = ModernButton("Train 1 Episode")
        train1_btn.clicked.connect(lambda: self.app.start_training(1))
        layout.addWidget(train1_btn)
        
        train10_btn = ModernButton("Train 10 Episodes")
        train10_btn.clicked.connect(lambda: self.app.start_training(10))
        layout.addWidget(train10_btn)
        
        train100_btn = ModernButton("Train 100 Episodes")
        train100_btn.clicked.connect(lambda: self.app.start_training(100))
        layout.addWidget(train100_btn)
        
        # Stop button
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
            QPushButton:pressed {
                background-color: #E05050;
            }
        """)
        stop_btn.clicked.connect(self.app.stop_training)
        layout.addWidget(stop_btn)
        
        # Status
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background-color: #506680;")
        layout.addWidget(line)
        
        self.training_status = QLabel("Status: Idle")
        self.training_status.setStyleSheet("color: #96FFB4; font-size: 13px;")
        layout.addWidget(self.training_status)
        
        self.training_episodes = QLabel("Episodes: 0")
        self.training_episodes.setStyleSheet("color: #DCE1EB; font-size: 13px;")
        layout.addWidget(self.training_episodes)
        
        panel.setLayout(layout)
        panel.setFixedWidth(340)
        return panel
    
    def _create_metrics_panel(self):
        """Create metrics display panel"""
        panel = StyledGroupBox("📊 Metrics")
        layout = QVBoxLayout()
        layout.setSpacing(5)
        layout.setContentsMargins(20, 30, 20, 20)
        
        # Metric displays
        self.comfort_metric = MetricDisplay("Comfort")
        layout.addWidget(self.comfort_metric)
        
        self.utilization_metric = MetricDisplay("Utilization")
        layout.addWidget(self.utilization_metric)
        
        self.coverage_metric = MetricDisplay("Coverage")
        layout.addWidget(self.coverage_metric)
        
        # Total score
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background-color: #506680;")
        layout.addWidget(line)
        
        self.total_score = QLabel("Total Score: 0.00")
        self.total_score.setStyleSheet("color: #FFFF96; font-size: 16px; font-weight: bold;")
        layout.addWidget(self.total_score)
        
        panel.setLayout(layout)
        panel.setFixedWidth(340)
        return panel
    
    def _on_agent_slider_changed(self, value):
        """FIXED: Handle agent slider change without losing agents"""
        self.agent_value_label.setText(f"Agents: {value}")
        
        # Use the safe set_agent_count method if available
        if hasattr(self.app.agent_manager, 'set_agent_count'):
            self.app.agent_manager.set_agent_count(value)
        else:
            # Fallback to manual adjustment with better error handling
            current = len(self.app.agent_manager.agents)
            
            if value > current:
                # Add agents
                agents_to_add = value - current
                for i in range(agents_to_add):
                    success = self.app.agent_manager.spawn_agent()
                    if not success:
                        print(f"Warning: Could only spawn {len(self.app.agent_manager.agents)} agents (target: {value})")
                        break
            elif value < current:
                # Remove agents
                for _ in range(current - value):
                    if self.app.agent_manager.agents:
                        self.app.agent_manager.agents.pop()
    
    def _on_grid_size_changed(self, index):
        """Handle grid size change"""
        # Map index to grid size
        grid_sizes = [3, 5, 7, 10]
        new_grid_size = grid_sizes[index]
        
        # Grid size names
        size_names = ["3×3 (Tiny)", "5×5 (Small)", "7×7 (Medium)", "10×10 (Large)"]
        
        # Calculate total cells
        total_cells = new_grid_size * new_grid_size
        
        # Update info label
        self.grid_size_info.setText(f"Current: {size_names[index]} ({total_cells} cells)")
        
        print(f"\n{'='*50}")
        print(f"Changing grid size to {new_grid_size}×{new_grid_size}")
        print(f"{'='*50}")
        
        # Apply the change to the park
        self.app.change_grid_size(new_grid_size)
        
        # Update UI
        self._update_ui()
    
    def _update_ui(self):
        """Update UI with current app state"""
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