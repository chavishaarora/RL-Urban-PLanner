#!/usr/bin/env python3
"""
Demo Script - Adds sample elements to visualize the park
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from config import ElementType
from environment.park import Park
from visualization.renderer import ParkRenderer
import pygame

print("Starting Demo Visualization...")
print("\nThis will show you the park with some sample elements.")
print("\nControls:")
print("  ESC or Q - Exit")
print("  SPACE - Add random element")
print("  C - Clear park")

# Initialize pygame
pygame.init()
screen = pygame.display.set_mode((1280, 720))
pygame.display.set_caption("Urban Park RL - Demo")
clock = pygame.time.Clock()

# Create park
park = Park(size=30.0, grid_size=3)
renderer = ParkRenderer(screen, park)

# Add some demo elements to start
print("\nAdding demo elements...")
park.add_element(ElementType.TREE, 0, 0)
park.add_element(ElementType.BENCH, 1, 1)
park.add_element(ElementType.FOUNTAIN, 2, 2)
park.add_element(ElementType.STREET_LAMP, 0, 2)
park.add_element(ElementType.GRASS_PATCH, 2, 0)
print(f"Added {len(park.elements)} elements")

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                running = False
            elif event.key == pygame.K_SPACE:
                # Add random element
                import random
                element_types = [ElementType.BENCH, ElementType.TREE, 
                               ElementType.FOUNTAIN, ElementType.STREET_LAMP,
                               ElementType.GRASS_PATCH, ElementType.PATHWAY]
                available = park.get_available_cells()
                if available:
                    x, y = random.choice(available)
                    elem_type = random.choice(element_types)
                    park.add_element(elem_type, x, y)
                    print(f"Added {elem_type.value} at ({x}, {y})")
            elif event.key == pygame.K_c:
                park.clear()
                print("Cleared park")
    
    # Render
    screen.fill((10, 10, 10))
    renderer.render()
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
print("\nDemo ended.")