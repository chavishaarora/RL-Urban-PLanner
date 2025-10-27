# Urban Park Design with Reinforcement Learning

A Python-based reinforcement learning system for optimizing urban park design. This project uses Q-Learning to intelligently place park elements (benches, trees, fountains, lamps, etc.) to maximize comfort, utility, and aesthetic metrics.

##Features

- **Reinforcement Learning**: Q-Learning algorithm with experience replay
- **3D Visualization**: Real-time park rendering using Pygame and OpenGL
- **Multiple Park Elements**: Trees, benches, fountains, street lamps, grass patches, pathways
- **Smart Metrics**: Comfort scores, shade coverage, space utilization, distribution analysis
- **Agent Simulation**: Simulated pedestrians to evaluate park usability
- **Modular Architecture**: Clean separation of concerns with organized module structure

##Project Structure

```
urban-park-rl/
│
├── src/
│   ├── __init__.py
│   ├── main.py                 # Main entry point
│   ├── config.py               # Configuration and constants
│   │
│   ├── environment/
│   │   ├── __init__.py
│   │   ├── park.py            # Park environment class
│   │   ├── elements.py        # Park elements (Tree, Bench, etc.)
│   │   └── grid.py            # Grid system for placement
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── pedestrian.py      # Pedestrian agent simulation
│   │   └── movement.py        # Movement patterns and pathfinding
│   │
│   ├── rl/
│   │   ├── __init__.py
│   │   ├── q_learning.py      # Q-Learning implementation
│   │   ├── state.py           # State representation
│   │   ├── actions.py         # Action space definition
│   │   └── replay_buffer.py   # Experience replay buffer
│   │
│   ├── metrics/
│   │   ├── __init__.py
│   │   ├── comfort.py         # Comfort score calculation
│   │   ├── utilization.py     # Space utilization metrics
│   │   ├── coverage.py        # Shade and lighting coverage
│   │   └── distribution.py    # Element distribution analysis
│   │
│   ├── visualization/
│   │   ├── __init__.py
│   │   ├── renderer.py        # 3D rendering engine
│   │   ├── camera.py          # Camera controls
│   │   ├── lighting.py        # Lighting system
│   │   └── ui.py              # User interface components
│   │
│   └── utils/
│       ├── __init__.py
│       ├── logger.py          # Logging utilities
│       ├── data_manager.py    # Save/load functionality
│       └── helpers.py         # Helper functions
│
├── tests/
│   ├── __init__.py
│   ├── test_environment.py
│   ├── test_rl.py
│   ├── test_metrics.py
│   └── test_agents.py
│
├── experiments/
│   ├── baseline_random.py     # Random baseline experiments
│   ├── training_runs.py       # Training experiments
│   └── analysis.ipynb        # Jupyter notebook for analysis
│
├── data/
│   ├── models/               # Saved Q-tables and models
│   ├── logs/                 # Training logs
│   └── results/              # Experiment results
│
├── assets/
│   ├── textures/             # Texture files for 3D elements
│   ├── models/               # 3D model files (if any)
│   └── icons/                # UI icons
│
├── docs/
│   ├── architecture.md       # System architecture
│   ├── api.md                # API documentation
│   └── algorithms.md         # Algorithm explanations
│
├── requirements.txt          # Python dependencies
├── setup.py                  # Package setup
├── .gitignore               # Git ignore file
└── LICENSE                   # License file
```

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/urban-park-rl.git
cd urban-park-rl
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

##Usage

### Quick Start

Run the main simulation:
```bash
python src/main.py
```

### Training the RL Agent

```bash
python src/main.py --mode train --episodes 1000
```

### Testing with Random Baseline

```bash
python experiments/baseline_random.py
```

### Interactive Mode

```bash
python src/main.py --mode interactive
```

##Algorithm Details

The system uses Q-Learning with the following specifications:

- **State Space**: 3x3 grid representation with element encoding
- **Action Space**: Place element at position (6 element types × 9 positions)
- **Reward Function**: Weighted combination of comfort, utilization, coverage, and distribution metrics
- **Learning Rate**: 0.1 (configurable)
- **Discount Factor**: 0.95 (configurable)
- **Epsilon**: 0.3 with decay (configurable)

##Metrics

1. **Comfort Score**: Evaluates placement of benches near shade and amenities
2. **Utilization**: Percentage of effectively used space
3. **Shade Coverage**: Tree canopy coverage percentage
4. **Distribution**: Uniformity of element placement
5. **Total Score**: Weighted combination of all metrics

##Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

##License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##Acknowledgments

- Inspired by urban planning optimization research
- Built with Python scientific computing stack
- Special thanks to the reinforcement learning community

## 📧 Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter) - email@example.com

Project Link: [https://github.com/yourusername/urban-park-rl](https://github.com/yourusername/urban-park-rl)
