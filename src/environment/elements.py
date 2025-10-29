"""
Elements Module
Individual park element classes with detailed properties
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import numpy as np
from enum import Enum

class MaterialType(Enum):
    """Material types for elements"""
    WOOD = "wood"
    METAL = "metal"
    STONE = "stone"
    CONCRETE = "concrete"
    GRASS = "grass"
    WATER = "water"

@dataclass
class ElementProperties:
    """Properties shared by all park elements"""
    durability: float = 1.0  # 0-1, degrades over time
    maintenance_cost: float = 0.0
    installation_cost: float = 0.0
    aesthetic_value: float = 0.5
    age: int = 0  # Days since installation

class ParkBench:
    """Detailed bench implementation"""
    
    def __init__(self, capacity: int = 3, material: MaterialType = MaterialType.WOOD):
        self.capacity = capacity
        self.material = material
        self.properties = ElementProperties(
            durability=0.8 if material == MaterialType.WOOD else 0.95,
            maintenance_cost=50 if material == MaterialType.WOOD else 30,
            installation_cost=500,
            aesthetic_value=0.7
        )
        self.occupants = []
        self.comfort_rating = self._calculate_comfort_rating()
    
    def _calculate_comfort_rating(self) -> float:
        """Calculate comfort based on material and design"""
        comfort_scores = {
            MaterialType.WOOD: 0.9,
            MaterialType.METAL: 0.6,
            MaterialType.STONE: 0.5,
            MaterialType.CONCRETE: 0.4
        }
        return comfort_scores.get(self.material, 0.5)
    
    def add_occupant(self, agent_id: int) -> bool:
        """Add an occupant if space available"""
        if len(self.occupants) < self.capacity:
            self.occupants.append(agent_id)
            return True
        return False
    
    def remove_occupant(self, agent_id: int):
        """Remove an occupant"""
        if agent_id in self.occupants:
            self.occupants.remove(agent_id)

class ParkTree:
    """Detailed tree implementation"""
    
    def __init__(self, species: str = "Oak", age_years: int = 5):
        self.species = species
        self.age_years = age_years
        self.height = self._calculate_height()
        self.canopy_radius = self._calculate_canopy_radius()
        self.properties = ElementProperties(
            durability=0.95,
            maintenance_cost=100,
            installation_cost=300,
            aesthetic_value=0.9
        )
        self.health = 1.0
        self.growth_rate = 0.3  # Meters per year
        self.co2_absorption = self._calculate_co2_absorption()
        self.shade_quality = self._calculate_shade_quality()
    
    def _calculate_height(self) -> float:
        """Calculate tree height based on age"""
        # Logarithmic growth model
        return min(20, 2 + np.log(self.age_years + 1) * 3)
    
    def _calculate_canopy_radius(self) -> float:
        """Calculate canopy radius based on height"""
        return self.height * 0.6
    
    def _calculate_co2_absorption(self) -> float:
        """Calculate CO2 absorption rate (kg/year)"""
        return self.height * 2.3  # Simplified model
    
    def _calculate_shade_quality(self) -> float:
        """Calculate shade quality based on canopy density"""
        return min(1.0, self.canopy_radius / 10)
    
    def grow(self, years: float = 1.0):
        """Simulate tree growth"""
        self.age_years += years
        self.height = self._calculate_height()
        self.canopy_radius = self._calculate_canopy_radius()
        self.co2_absorption = self._calculate_co2_absorption()

class ParkFountain:
    """Detailed fountain implementation"""
    
    def __init__(self, size: str = "medium", has_lights: bool = True):
        self.size = size
        self.has_lights = has_lights
        self.water_flow_rate = self._get_flow_rate()
        self.properties = ElementProperties(
            durability=0.7,
            maintenance_cost=200,
            installation_cost=5000,
            aesthetic_value=0.95
        )
        self.is_active = True
        self.water_height = 2.0 if size == "large" else 1.0
        self.spray_pattern = "circular"
        self.ambient_cooling = self._calculate_cooling_effect()
    
    def _get_flow_rate(self) -> float:
        """Get water flow rate based on size (liters/minute)"""
        rates = {"small": 50, "medium": 100, "large": 200}
        return rates.get(self.size, 100)
    
    def _calculate_cooling_effect(self) -> float:
        """Calculate cooling effect radius in meters"""
        return 5.0 if self.size == "large" else 3.0
    
    def toggle_active(self):
        """Turn fountain on/off"""
        self.is_active = not self.is_active
    
    def set_pattern(self, pattern: str):
        """Change water spray pattern"""
        patterns = ["circular", "linear", "dancing", "mist"]
        if pattern in patterns:
            self.spray_pattern = pattern

class ParkLamp:
    """Detailed street lamp implementation"""
    
    def __init__(self, style: str = "modern", bulb_type: str = "LED"):
        self.style = style
        self.bulb_type = bulb_type
        self.height = 4.0 if style == "modern" else 3.5
        self.properties = ElementProperties(
            durability=0.9,
            maintenance_cost=30,
            installation_cost=800,
            aesthetic_value=0.6
        )
        self.is_on = True
        self.brightness = 1.0  # 0-1 scale
        self.energy_consumption = self._calculate_energy_consumption()
        self.light_color = (255, 223, 100) if bulb_type == "sodium" else (255, 255, 255)
        self.coverage_radius = 8.0
    
    def _calculate_energy_consumption(self) -> float:
        """Calculate energy consumption in watts"""
        consumption = {
            "LED": 30,
            "sodium": 70,
            "halogen": 100,
            "incandescent": 150
        }
        return consumption.get(self.bulb_type, 50)
    
    def dim(self, level: float):
        """Dim the light to specified level"""
        self.brightness = max(0.0, min(1.0, level))
    
    def calculate_illumination_at_point(self, distance: float) -> float:
        """Calculate illumination intensity at a given distance"""
        if not self.is_on or distance > self.coverage_radius:
            return 0.0
        # Inverse square law
        return self.brightness * (1 - (distance / self.coverage_radius) ** 2)

# ============================================================================
# DEPRECATED CLASSES - These elements have been removed from the application
# ============================================================================
# The following classes are kept for backwards compatibility but are no longer
# used in the main application. GRASS_PATCH and PATHWAY elements have been
# removed from the design system.
# ============================================================================

class GrassPatch:
    """Detailed grass patch implementation
    
    DEPRECATED: This element type has been removed from the application.
    This class is kept for backwards compatibility only.
    """
    
    def __init__(self, grass_type: str = "bermuda"):
        self.grass_type = grass_type
        self.properties = ElementProperties(
            durability=0.6,
            maintenance_cost=20,
            installation_cost=100,
            aesthetic_value=0.7
        )
        self.health = 1.0
        self.height = 0.05  # Meters
        self.density = 1.0  # 0-1 scale
        self.water_requirement = self._get_water_requirement()
        self.wear_resistance = self._get_wear_resistance()
    
    def _get_water_requirement(self) -> float:
        """Get water requirement based on grass type (liters/day/m²)"""
        requirements = {
            "bermuda": 3.0,
            "kentucky_blue": 4.0,
            "fescue": 2.5,
            "zoysia": 2.0
        }
        return requirements.get(self.grass_type, 3.0)
    
    def _get_wear_resistance(self) -> float:
        """Get wear resistance based on grass type"""
        resistance = {
            "bermuda": 0.9,
            "kentucky_blue": 0.6,
            "fescue": 0.7,
            "zoysia": 0.8
        }
        return resistance.get(self.grass_type, 0.7)
    
    def apply_foot_traffic(self, intensity: float):
        """Apply wear from foot traffic"""
        damage = intensity * (1 - self.wear_resistance) * 0.1
        self.health = max(0.0, self.health - damage)
        self.density = self.health
    
    def maintain(self):
        """Perform maintenance to restore health"""
        self.health = min(1.0, self.health + 0.2)
        self.density = self.health

class PathwaySection:
    """Detailed pathway implementation
    
    DEPRECATED: This element type has been removed from the application.
    This class is kept for backwards compatibility only.
    """
    
    def __init__(self, material: MaterialType = MaterialType.CONCRETE, width: float = 2.0):
        self.material = material
        self.width = width
        self.properties = ElementProperties(
            durability=0.95 if material == MaterialType.CONCRETE else 0.8,
            maintenance_cost=10,
            installation_cost=200,
            aesthetic_value=0.5
        )
        self.condition = 1.0  # 0-1 scale
        self.slip_resistance = self._get_slip_resistance()
        self.accessibility_rating = self._get_accessibility_rating()
    
    def _get_slip_resistance(self) -> float:
        """Get slip resistance based on material"""
        resistance = {
            MaterialType.CONCRETE: 0.8,
            MaterialType.STONE: 0.7,
            MaterialType.WOOD: 0.5,
            MaterialType.METAL: 0.4
        }
        return resistance.get(self.material, 0.7)
    
    def _get_accessibility_rating(self) -> float:
        """Get accessibility rating for wheelchairs/strollers"""
        if self.width < 1.5:
            return 0.3
        elif self.width < 2.0:
            return 0.7
        else:
            return 1.0
    
    def degrade(self, amount: float = 0.01):
        """Apply wear and degradation"""
        self.condition = max(0.0, self.condition - amount)
    
    def repair(self):
        """Repair pathway to full condition"""
        self.condition = 1.0