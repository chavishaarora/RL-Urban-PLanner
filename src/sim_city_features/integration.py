"""
🎮 SIMCITY-STYLE FEATURES - COMPLETE INTEGRATION GUIDE
=====================================================

This guide shows you how to integrate all three features:
1. Heat Maps (interactive data layers)
2. Influence Radius Visualization (coverage circles)
3. Flow Field Pathfinding (realistic crowd movement)

QUICK START - Add to your main3d.py or application class:
"""

# ============================================================================
# STEP 1: ADD IMPORTS
# ============================================================================

import sys
sys.path.insert(0, '/home/claude')

from heatmap_system import HeatMapType
from heatmap_renderer import HeatMapRenderer, InfluenceRadiusRenderer
from flow_field_system import calculate_complete_flow_field, follow_flow_field


# ============================================================================
# STEP 2: INITIALIZE IN YOUR APPLICATION CLASS
# ============================================================================

class YourParkApplication:
    """
    Add these to your existing application __init__
    """
    
    def __init__(self):
        # ... your existing initialization ...
        
        # NEW: Add heat map system
        self.heatmap_renderer = HeatMapRenderer(self.park)
        
        # NEW: Add influence radius system
        self.influence_renderer = InfluenceRadiusRenderer(self.park)
        
        # NEW: Flow field cache (recompute when needed)
        self.flow_field = None
        self.flow_field_targets = []
        
        print("✨ SimCity features initialized!")
        print("  Press H to cycle heat maps")
        print("  Press I to toggle influence radii")
        print("  Press F to toggle flow field movement")


# ============================================================================
# STEP 3: ADD TO YOUR RENDER LOOP
# ============================================================================

    def render(self):
        """
        Add to your existing render method in renderer3d.py
        """
        # ... your existing rendering code ...
        
        # Draw ground
        glCallList(self.display_lists['ground'])
        
        # NEW: Render heat map overlay
        self.heatmap_renderer.render(self.agent_manager)
        
        # NEW: Render influence radii
        self.influence_renderer.render()
        
        # Draw park elements
        for element in self.park.elements:
            self.draw_element(element)
        
        # Draw agents (they now follow flow field if enabled)
        if self.agent_manager:
            self.draw_pedestrians(self.agent_manager)


# ============================================================================
# STEP 4: ADD KEYBOARD CONTROLS
# ============================================================================

    def handle_keypress(self, key):
        """
        Add to your keyboard handler
        """
        
        if key == 'h' or key == 'H':
            # Cycle through heat maps
            self._cycle_heatmap()
        
        elif key == 'i' or key == 'I':
            # Toggle influence radii
            self.influence_renderer.toggle_all()
        
        elif key == 'f' or key == 'F':
            # Toggle flow field movement
            self._toggle_flow_field()
        
        elif key == '1':
            # Quick access: Thermal comfort
            self.heatmap_renderer.set_heatmap_type(HeatMapType.THERMAL_COMFORT)
        
        elif key == '2':
            # Quick access: Pedestrian density
            self.heatmap_renderer.set_heatmap_type(HeatMapType.PEDESTRIAN_DENSITY)
        
        elif key == '3':
            # Quick access: Overall quality
            self.heatmap_renderer.set_heatmap_type(HeatMapType.OVERALL_QUALITY)
    
    def _cycle_heatmap(self):
        """Cycle through available heat maps"""
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
        
        current = self.heatmap_renderer.current_type
        current_idx = heatmap_types.index(current)
        next_idx = (current_idx + 1) % len(heatmap_types)
        
        self.heatmap_renderer.set_heatmap_type(heatmap_types[next_idx])
    
    def _toggle_flow_field(self):
        """Toggle flow field movement for agents"""
        if not hasattr(self, 'use_flow_field'):
            self.use_flow_field = False
        
        self.use_flow_field = not self.use_flow_field
        
        if self.use_flow_field:
            # Recompute flow field
            self._update_flow_field()
            print("🌊 Flow Field: ON (agents follow natural paths)")
        else:
            self.flow_field = None
            print("🌊 Flow Field: OFF (agents use default movement)")


# ============================================================================
# STEP 5: FLOW FIELD MANAGEMENT
# ============================================================================

    def _update_flow_field(self):
        """
        Recompute flow field when park changes or targets change
        Call this when elements are added/removed
        """
        from environment.park import ElementType
        
        # Get all interesting targets (benches, fountains)
        benches = self.park.get_elements_by_type(ElementType.BENCH)
        fountains = self.park.get_elements_by_type(ElementType.FOUNTAIN)
        
        self.flow_field_targets = benches + fountains
        
        if self.flow_field_targets:
            self.flow_field = calculate_complete_flow_field(
                self.park, 
                self.flow_field_targets, 
                resolution=20
            )
            print(f"🌊 Flow field computed with {len(self.flow_field_targets)} targets")
        else:
            self.flow_field = None
            print("⚠️  No targets for flow field")
    
    def update_agents_with_flow_field(self, delta_time):
        """
        Update agent movement using flow field
        Call this in your agent update loop
        """
        if not self.use_flow_field or self.flow_field is None:
            # Use default agent movement
            self.agent_manager.update(delta_time)
            return
        
        # Update each agent with flow field
        for agent in self.agent_manager.agents:
            # Skip sitting agents
            if hasattr(agent, 'is_sitting') and agent.is_sitting:
                agent.update(delta_time)
                continue
            
            # Follow flow field when wandering or moving
            if agent.state.value in ["wandering", "moving_to_target"]:
                new_pos = follow_flow_field(
                    agent.position,
                    self.flow_field,
                    self.park,
                    agent.speed,
                    delta_time,
                    resolution=20
                )
                
                if agent._is_position_valid(new_pos):
                    agent.position = new_pos
            else:
                # Use default behavior for other states
                agent.update(delta_time)


# ============================================================================
# STEP 6: CLEAR CACHES WHEN PARK CHANGES
# ============================================================================

    def add_element(self, element_type, grid_x, grid_y):
        """
        Override or extend your add_element method
        """
        # Add element
        element = self.park.add_element(element_type, grid_x, grid_y)
        
        if element:
            # NEW: Clear caches
            self.heatmap_renderer.clear_cache()
            
            # NEW: Update flow field if using it
            if hasattr(self, 'use_flow_field') and self.use_flow_field:
                self._update_flow_field()
        
        return element
    
    def clear_park(self):
        """
        Override or extend your clear_park method
        """
        self.park.clear()
        
        # NEW: Clear all caches
        self.heatmap_renderer.clear_cache()
        self.flow_field = None
        self.flow_field_targets = []


# ============================================================================
# STEP 7: ADD UI INDICATORS (OPTIONAL)
# ============================================================================

    def draw_ui_overlays(self):
        """
        Draw on-screen indicators (call in your render loop)
        """
        # Show current heat map
        if self.heatmap_renderer.current_type != HeatMapType.NONE:
            legend = HeatMapGenerator.get_legend_info(
                self.heatmap_renderer.current_type
            )
            print(f"📊 {legend['title']}: {legend['description']}")
        
        # Show flow field status
        if hasattr(self, 'use_flow_field') and self.use_flow_field:
            if self.flow_field is not None:
                print(f"🌊 Flow Field Active ({len(self.flow_field_targets)} targets)")


# ============================================================================
# COMPLETE EXAMPLE - COPY THIS TO YOUR CODE
# ============================================================================

"""
COMPLETE INTEGRATION EXAMPLE:

In your main application file (main3d.py or similar), add:

1. At the top (imports):
   from heatmap_renderer import HeatMapRenderer, InfluenceRadiusRenderer
   from flow_field_system import calculate_complete_flow_field, follow_flow_field

2. In __init__:
   self.heatmap_renderer = HeatMapRenderer(self.park)
   self.influence_renderer = InfluenceRadiusRenderer(self.park)
   self.flow_field = None
   self.use_flow_field = False

3. In render (after ground, before elements):
   self.heatmap_renderer.render(self.agent_manager)
   self.influence_renderer.render()

4. In keyboard handler:
   if key == 'h': self._cycle_heatmap()
   if key == 'i': self.influence_renderer.toggle_all()
   if key == 'f': self._toggle_flow_field()

5. In update loop:
   if self.use_flow_field:
       self.update_agents_with_flow_field(delta_time)
   else:
       self.agent_manager.update(delta_time)

6. When park changes:
   self.heatmap_renderer.clear_cache()
   if self.use_flow_field: self._update_flow_field()

That's it! You now have SimCity-style features!
"""


# ============================================================================
# KEYBOARD SHORTCUTS SUMMARY
# ============================================================================

"""
CONTROLS:
=========

H          - Cycle through heat maps
             (None → Thermal → Shade → Light → Density → etc.)

I          - Toggle influence radii
             (Shows coverage circles for all elements)

F          - Toggle flow field movement
             (Agents follow natural crowd paths)

1          - Quick: Thermal Comfort heat map
2          - Quick: Pedestrian Density heat map
3          - Quick: Overall Quality heat map

ESC        - Exit application


HEAT MAP TYPES:
===============

• Thermal Comfort    - How comfortable the temperature feels
• Shade Coverage     - Areas covered by trees
• Light Coverage     - Illumination from lamps
• Pedestrian Density - Where visitors gather (live updates)
• Accessibility      - Distance to nearest amenity
• Effective Temp     - Actual temperature with shade/cooling
• Overall Quality    - Combined score of all factors


TIPS:
=====

• Heat maps are cached for performance - they update when park changes
• Density heat map updates in real-time as agents move
• Influence radii show why certain areas are comfortable/lit
• Flow fields make crowds look realistic (like SimCity!)
• Press H repeatedly to find the best view for your analysis
• Use heat maps while training RL to see why designs work/fail
"""

print(__doc__)