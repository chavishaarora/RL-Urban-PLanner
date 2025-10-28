#!/usr/bin/env python3
"""
Quick Test Script
Tests basic functionality without visualization
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("=" * 60)
print("URBAN PARK RL - SYSTEM TEST")
print("=" * 60)

# Test imports
print("\n1. Testing imports...")
try:
    from config import park_config, rl_config, ElementType
    print("   ✓ Config module")
    
    from environment.park import Park, Position, ParkElement
    print("   ✓ Park environment")
    
    from agents.pedestrian import PedestrianAgent, AgentManager
    print("   ✓ Pedestrian agents")
    
    from rl.q_learning import QLearningAgent, ParkDesignTrainer
    print("   ✓ Q-Learning agent")
    
    from rl.actions import ActionSpace
    print("   ✓ Action space")
    
    from rl.state import StateEncoder
    print("   ✓ State encoder")
    
    from metrics.comfort import ComfortCalculator
    from metrics.coverage import CoverageCalculator
    from metrics.utilization import UtilizationCalculator
    from metrics.distribution import DistributionCalculator
    print("   ✓ All metrics calculators")
    
    from utils.logger import Logger
    from utils.data_manager import DataManager
    print("   ✓ Utility modules")
    
    print("\n   All imports successful! ✓")
except ImportError as e:
    print(f"\n   ✗ Import error: {e}")
    sys.exit(1)

# Test basic functionality
print("\n2. Testing basic functionality...")

try:
    # Create park
    park = Park(size=30.0, grid_size=3)
    print(f"   ✓ Created park: {park}")
    
    # Add some elements
    bench = park.add_element(ElementType.BENCH, 0, 0)
    tree = park.add_element(ElementType.TREE, 1, 1)
    lamp = park.add_element(ElementType.STREET_LAMP, 2, 2)
    print(f"   ✓ Added {len(park.elements)} elements")
    
    # Test metrics
    comfort_calc = ComfortCalculator(park)
    comfort = comfort_calc.calculate_total_comfort()
    print(f"   ✓ Comfort score: {comfort:.2f}")
    
    coverage_calc = CoverageCalculator(park)
    shade = coverage_calc.calculate_shade_coverage()
    light = coverage_calc.calculate_light_coverage()
    print(f"   ✓ Coverage - Shade: {shade:.2f}, Light: {light:.2f}")
    
    util_calc = UtilizationCalculator(park)
    utilization = util_calc.calculate_utilization()
    print(f"   ✓ Utilization: {utilization:.2f}")
    
    dist_calc = DistributionCalculator(park)
    distribution = dist_calc.calculate_distribution_score()
    print(f"   ✓ Distribution: {distribution:.2f}")
    
    print("\n   All metrics working! ✓")
except Exception as e:
    print(f"\n   ✗ Error in basic functionality: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test RL components
print("\n3. Testing RL components...")

try:
    # Create RL agent
    agent = QLearningAgent()
    print(f"   ✓ Created Q-Learning agent")
    
    # Test state encoding
    encoder = StateEncoder()
    state_hash = encoder.encode_state(park)
    print(f"   ✓ State encoding: {state_hash[:16]}...")
    
    # Test action space
    action_space = ActionSpace(grid_size=3)
    valid_actions = action_space.get_valid_actions(park)
    print(f"   ✓ Action space: {len(valid_actions)} valid actions")
    
    # Test action selection
    park.clear()
    action = agent.choose_action(park, training=False)
    if action:
        grid_x, grid_y, element_type = action
        print(f"   ✓ Action selection: place {element_type.value} at ({grid_x}, {grid_y})")
    
    print("\n   RL components working! ✓")
except Exception as e:
    print(f"\n   ✗ Error in RL components: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test training (one episode)
print("\n4. Testing training...")

try:
    park.clear()
    trainer = ParkDesignTrainer(park, agent)
    reward = trainer.train_episode(max_steps=5)
    print(f"   ✓ Completed one training episode: reward = {reward:.2f}")
    print(f"   ✓ Elements placed: {len(park.elements)}")
    
    print("\n   Training system working! ✓")
except Exception as e:
    print(f"\n   ✗ Error in training: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test data persistence
print("\n5. Testing data persistence...")

try:
    data_manager = DataManager(base_dir="data")
    
    # Save test results
    test_results = {
        'test': 'success',
        'elements': len(park.elements),
        'reward': float(reward)
    }
    saved_path = data_manager.save_results(test_results, 'test_results.json')
    print(f"   ✓ Saved results to: {saved_path}")
    
    # Load results
    loaded = data_manager.load_results('test_results.json')
    print(f"   ✓ Loaded results: {loaded}")
    
    print("\n   Data persistence working! ✓")
except Exception as e:
    print(f"\n   ✗ Error in data persistence: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("ALL TESTS PASSED! ✓")
print("=" * 60)
print("\nThe system is ready to use!")
print("\nTo run the full application:")
print("  cd src")
print("  python main.py --mode interactive")
print("\nTo train the agent:")
print("  cd src")
print("  python main.py --mode train --episodes 100")
print("=" * 60)