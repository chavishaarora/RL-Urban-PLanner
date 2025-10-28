#!/usr/bin/env python3
"""
Setup and Test Script for 3D Version
Checks dependencies and verifies OpenGL works
"""

import sys
import subprocess

def check_dependency(package_name, import_name=None):
    """Check if a package is installed"""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        print(f"✓ {package_name} installed")
        return True
    except ImportError:
        print(f"✗ {package_name} NOT installed")
        return False

def main():
    print("="*60)
    print("URBAN PARK RL - 3D VERSION SETUP CHECK")
    print("="*60)
    
    print("\n1. Checking Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    else:
        print(f"✗ Python {version.major}.{version.minor} (need 3.8+)")
        return False
    
    print("\n2. Checking required packages...")
    required = [
        ("numpy", "numpy"),
        ("pygame", "pygame"),
        ("scipy", "scipy"),
        ("PyOpenGL", "OpenGL"),
        ("PyOpenGL_accelerate", "OpenGL_accelerate")
    ]
    
    all_installed = True
    missing = []
    
    for package, import_name in required:
        if not check_dependency(package, import_name):
            all_installed = False
            missing.append(package)
    
    if not all_installed:
        print("\n❌ Missing packages detected!")
        print("\nTo install missing packages, run:")
        print(f"   pip install {' '.join(missing)}")
        print("\nOr install all at once:")
        print("   pip install -r requirements_3d.txt")
        return False
    
    print("\n3. Testing OpenGL...")
    try:
        import OpenGL
        import OpenGL.GL as gl
        import OpenGL.GLU as glu
        print(f"✓ OpenGL version: {OpenGL.__version__}")
        print("✓ OpenGL functions accessible")
    except Exception as e:
        print(f"✗ OpenGL test failed: {e}")
        return False

    print("\n4. Testing Pygame + OpenGL integration...")
    try:
        import pygame
        from pygame.locals import DOUBLEBUF, OPENGL, HIDDEN

        pygame.init()
        screen = pygame.display.set_mode((100, 100), DOUBLEBUF | OPENGL | HIDDEN)

        gl.glClearColor(0, 0, 0, 1)
        gl.glClear(gl.GL_COLOR_BUFFER_BIT)
        
        pygame.quit()
        print("✓ Pygame + OpenGL integration working")
    except Exception as e:
        print(f"✗ Pygame + OpenGL test failed: {e}")
        return False

    
    print("\n5. Testing project imports...")
    try:
        sys.path.insert(0, 'src')
        from config import park_config, ElementType
        from environment.park import Park
        from rl.q_learning import QLearningAgent
        print("✓ All project modules import successfully")
    except Exception as e:
        print(f"✗ Import test failed: {e}")
        return False
    
    print("\n" + "="*60)
    print("✅ ALL CHECKS PASSED!")
    print("="*60)
    print("\nYou're ready to run the 3D version!")
    print("\nTo start:")
    print("  python main3d.py")
    print("\nControls:")
    print("  Left Mouse Drag - Rotate camera")
    print("  Right Mouse Drag - Pan view")
    print("  Mouse Wheel - Zoom in/out")
    print("  ESC - Exit")
    print("\nUI:")
    print("  Left Panel - Design controls (sliders)")
    print("  Bottom Left - Metrics display")
    print("  Right Panel - RL training controls")
    print("="*60)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)