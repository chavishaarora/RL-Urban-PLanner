import { useState, useEffect } from 'react';

export interface ColorConfig {
  color: string;
  opacity: number;
  visible: boolean;
}

export type MapColorConfigType = { [category: string]: ColorConfig };

/**
 * Hook to manage map color configuration with localStorage persistence per project
 * @param projectId - Unique identifier for the project
 * @param mapType - Type of map (e.g., 'landuse', 'building-type')
 * @param defaultColors - Default color scheme
 * @param defaultOpacity - Default opacity value (0-1)
 */
export function useMapColorConfig(
  projectId: string,
  mapType: string,
  defaultColors: { [category: string]: string },
  defaultOpacity: number = 0.7
) {
  const storageKey = `map-colors-${projectId}-${mapType}`;

  // Initialize config from defaults
  const getDefaultConfig = (): MapColorConfigType => {
    const config: MapColorConfigType = {};
    Object.entries(defaultColors).forEach(([category, color]) => {
      config[category] = {
        color,
        opacity: defaultOpacity,
        visible: true,
      };
    });
    return config;
  };

  // Load from localStorage or use defaults
  const loadConfig = (): MapColorConfigType => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new categories
        const defaultConfig = getDefaultConfig();
        return { ...defaultConfig, ...parsed };
      }
    } catch (error) {
      console.error('Error loading map color config:', error);
    }
    return getDefaultConfig();
  };

  const [config, setConfig] = useState<MapColorConfigType>(loadConfig);

  // Save to localStorage whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving map color config:', error);
    }
  }, [config, storageKey]);

  // Reset to defaults
  const resetConfig = () => {
    setConfig(getDefaultConfig());
  };

  // Get color for a category
  const getColor = (category: string): string => {
    return config[category]?.color || defaultColors[category] || '#94a3b8';
  };

  // Get opacity for a category
  const getOpacity = (category: string): number => {
    return config[category]?.opacity ?? defaultOpacity;
  };

  // Check if category is visible
  const isVisible = (category: string): boolean => {
    return config[category]?.visible ?? true;
  };

  return {
    config,
    setConfig,
    resetConfig,
    getColor,
    getOpacity,
    isVisible,
  };
}
