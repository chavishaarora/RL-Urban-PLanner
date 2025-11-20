// 3D Environmental Analysis Component
// Real-time WebGIS analysis for solar radiation, wind flow, and shadow analysis

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Grid, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { LocationData } from '../types';
import { fetchOSMBuildingsAround, OSMBuildingPolygon } from '@/services/osmBuildings';
import {
  generateSolarHeatmap,
  calculateDailySunPath,
  calculateSeasonalSunPaths,
  SunPosition,
  SolarRadiationHeatmap,
  findOptimalSolarLocations
} from '@/services/solarAnalysis3D';
import {
  generateWindFlowField,
  WindFlowField,
  WindAnalysisParams,
  analyzeWindForActivity
} from '@/services/windAnalysis3D';
import {
  generateDailyShadowTimelapse,
  generateAnnualShadowAnalysis,
  ShadowTimelapseData,
  createShadowHeatmapTexture
} from '@/services/shadowAnalysis3D';

type AnalysisMode = 'solar' | 'wind' | 'shadow' | 'combined';

interface Environmental3DAnalysisProps {
  location: LocationData;
  onClose?: () => void;
}

// Convert OSM building polygon to Three.js mesh
function createBuildingMesh(building: OSMBuildingPolygon, centerLat: number, centerLng: number): THREE.Mesh {
  const height = parseFloat(building.tags.height || building.tags['building:levels'] * 3 || '15');
  
  // Convert lat/lng to local coordinates
  const points = building.nodes.map(node => {
    const x = (node.lng - centerLng) * 111000 * Math.cos(centerLat * Math.PI / 180);
    const z = (node.lat - centerLat) * 111000;
    return new THREE.Vector2(x, z);
  });
  
  // Create extruded geometry
  const shape = new THREE.Shape(points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false
  });
  
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height / 2, 0);
  
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.7,
    metalness: 0.3
  });
  
  return new THREE.Mesh(geometry, material);
}

// Sun sphere component
const Sun: React.FC<{ position: THREE.Vector3; visible: boolean }> = ({ position, visible }) => {
  if (!visible) return null;
  
  return (
    <mesh position={position}>
      <sphereGeometry args={[50, 32, 32]} />
      <meshBasicMaterial color={0xffff00} />
      {/* Sun glow */}
      <mesh scale={1.5}>
        <sphereGeometry args={[50, 32, 32]} />
        <meshBasicMaterial color={0xffff00} transparent opacity={0.3} />
      </mesh>
    </mesh>
  );
};

// Sun path visualization
const SunPath: React.FC<{ positions: SunPosition[]; color: number }> = ({ positions, color }) => {
  const points = positions.map(p => p.position);
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeometry = new THREE.TubeGeometry(curve, 100, 2, 8, false);
  
  return (
    <mesh geometry={tubeGeometry}>
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
};

// Wind vector field visualization
const WindVectors: React.FC<{ flowField: WindFlowField | null }> = ({ flowField }) => {
  if (!flowField) return null;
  
  return (
    <group>
      {flowField.vectors.slice(0, 200).map((arrow, i) => {
        const speed = arrow.line?.geometry.boundingSphere?.radius || 1;
        const color = speed < 5 ? 0x00ff00 : speed < 10 ? 0xffff00 : 0xff0000;
        
        return (
          <arrowHelper
            key={i}
            args={[
              arrow.line?.geometry.boundingSphere?.center || new THREE.Vector3(),
              arrow.cone?.geometry.boundingSphere?.center || new THREE.Vector3(),
              speed * 2,
              color
            ]}
          />
        );
      })}
    </group>
  );
};

// Heatmap plane component
const HeatmapPlane: React.FC<{ 
  texture: THREE.Texture | null; 
  size: { width: number; height: number };
  opacity?: number;
}> = ({ texture, size, opacity = 0.7 }) => {
  if (!texture) return null;
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
      <planeGeometry args={[size.width, size.height]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
};

// Shadow meshes
const ShadowMeshes: React.FC<{ snapshots: ShadowTimelapseData | null; timeIndex: number }> = ({ 
  snapshots, 
  timeIndex 
}) => {
  if (!snapshots || !snapshots.snapshots[timeIndex]) return null;
  
  const snapshot = snapshots.snapshots[timeIndex];
  
  return (
    <group>
      {snapshot.shadowGeometry.map((shadowMesh, i) => (
        <primitive key={i} object={shadowMesh} />
      ))}
    </group>
  );
};

// Analysis controls UI
const AnalysisControls: React.FC<{
  mode: AnalysisMode;
  setMode: (mode: AnalysisMode) => void;
  date: Date;
  setDate: (date: Date) => void;
  timeOfDay: number;
  setTimeOfDay: (hour: number) => void;
  showSunPath: boolean;
  setShowSunPath: (show: boolean) => void;
  showWind: boolean;
  setShowWind: (show: boolean) => void;
  windSpeed: number;
  setWindSpeed: (speed: number) => void;
  windDirection: number;
  setWindDirection: (direction: number) => void;
}> = ({ 
  mode, setMode, date, setDate, timeOfDay, setTimeOfDay,
  showSunPath, setShowSunPath, showWind, setShowWind,
  windSpeed, setWindSpeed, windDirection, setWindDirection
}) => {
  return (
    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 max-w-sm z-10">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Environmental Analysis</h3>
      
      {/* Analysis Mode */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(['solar', 'wind', 'shadow', 'combined'] as AnalysisMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Date Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Date</label>
        <input
          type="date"
          value={date.toISOString().split('T')[0]}
          onChange={(e) => setDate(new Date(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setDate(new Date(new Date().getFullYear(), 11, 21))}
            className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Winter Solstice
          </button>
          <button
            onClick={() => setDate(new Date(new Date().getFullYear(), 5, 21))}
            className="flex-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          >
            Summer Solstice
          </button>
        </div>
      </div>
      
      {/* Time of Day */}
      {(mode === 'solar' || mode === 'shadow' || mode === 'combined') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Time: {timeOfDay}:00
          </label>
          <input
            type="range"
            min="6"
            max="20"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}
      
      {/* Solar Options */}
      {(mode === 'solar' || mode === 'combined') && (
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showSunPath}
              onChange={(e) => setShowSunPath(e.target.checked)}
              className="rounded text-teal-600"
            />
            Show Sun Path
          </label>
        </div>
      )}
      
      {/* Wind Options */}
      {(mode === 'wind' || mode === 'combined') && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showWind}
              onChange={(e) => setShowWind(e.target.checked)}
              className="rounded text-teal-600"
            />
            Show Wind Vectors
          </label>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Wind Speed: {windSpeed} m/s
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={windSpeed}
              onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Wind Direction: {windDirection}°
            </label>
            <input
              type="range"
              min="0"
              max="359"
              value={windDirection}
              onChange={(e) => setWindDirection(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>N</span>
              <span>E</span>
              <span>S</span>
              <span>W</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <h4 className="text-xs font-semibold text-slate-600 mb-2">Legend</h4>
        {mode === 'solar' && (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-red-500 rounded"></div>
              <span>Solar Radiation (Low → High)</span>
            </div>
          </div>
        )}
        {mode === 'wind' && (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Comfortable (&lt;5 m/s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Acceptable (5-10 m/s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Uncomfortable (&gt;10 m/s)</span>
            </div>
          </div>
        )}
        {mode === 'shadow' && (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-white to-black rounded border"></div>
              <span>Shadow Hours (0 → 12+)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stats panel
const StatsPanel: React.FC<{
  mode: AnalysisMode;
  solarData: SolarRadiationHeatmap | null;
  windData: WindFlowField | null;
  shadowData: ShadowTimelapseData | null;
}> = ({ mode, solarData, windData, shadowData }) => {
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 z-10">
      <h4 className="text-sm font-bold text-slate-800 mb-3">Analysis Results</h4>
      
      {mode === 'solar' && solarData && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Avg Radiation:</span>
            <span className="font-semibold text-teal-600">
              {solarData.average.toFixed(2)} kWh/m²/day
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Max Radiation:</span>
            <span className="font-semibold">{solarData.max.toFixed(2)} kWh/m²/day</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Optimal Locations:</span>
            <span className="font-semibold">{findOptimalSolarLocations(solarData).length}</span>
          </div>
        </div>
      )}
      
      {mode === 'wind' && windData && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Comfortable Zones:</span>
            <span className="font-semibold text-green-600">
              {windData.comfortZones.filter(z => z.comfort === 'comfortable').length}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Avg Wind Speed:</span>
            <span className="font-semibold">
              {(windData.points.reduce((s, p) => s + p.speed, 0) / windData.points.length).toFixed(1)} m/s
            </span>
          </div>
        </div>
      )}
      
      {mode === 'shadow' && shadowData && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Avg Shadow Coverage:</span>
            <span className="font-semibold">{shadowData.averageShadowCoverage.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Time Snapshots:</span>
            <span className="font-semibold">{shadowData.snapshots.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Main 3D Scene
const Scene: React.FC<{
  buildings: THREE.Mesh[];
  mode: AnalysisMode;
  sunPosition: SunPosition | null;
  sunPath: SunPosition[] | null;
  showSunPath: boolean;
  solarHeatmap: SolarRadiationHeatmap | null;
  windFlowField: WindFlowField | null;
  showWind: boolean;
  shadowData: ShadowTimelapseData | null;
  timeIndex: number;
}> = ({ 
  buildings, mode, sunPosition, sunPath, showSunPath, 
  solarHeatmap, windFlowField, showWind, shadowData, timeIndex 
}) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      {sunPosition && (
        <directionalLight
          position={[sunPosition.position.x / 100, sunPosition.position.y / 100, sunPosition.position.z / 100]}
          intensity={1.5}
          castShadow
        />
      )}
      
      {/* Sky */}
      <Sky sunPosition={sunPosition?.position.toArray() || [0, 1, 0]} />
      
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color={0x90ee90} />
      </mesh>
      
      {/* Grid */}
      <Grid args={[2000, 2000]} cellColor={0xaaaaaa} sectionColor={0x888888} />
      
      {/* Buildings */}
      {buildings.map((building, i) => (
        <primitive key={i} object={building} castShadow receiveShadow />
      ))}
      
      {/* Sun */}
      {(mode === 'solar' || mode === 'combined') && sunPosition && (
        <Sun position={sunPosition.position.clone().divideScalar(100)} visible={true} />
      )}
      
      {/* Sun Path */}
      {showSunPath && sunPath && sunPath.length > 0 && (
        <SunPath 
          positions={sunPath.map(p => ({ 
            ...p, 
            position: p.position.clone().divideScalar(100) 
          }))} 
          color={0xffaa00} 
        />
      )}
      
      {/* Solar Heatmap */}
      {(mode === 'solar' || mode === 'combined') && solarHeatmap?.texture && (
        <HeatmapPlane texture={solarHeatmap.texture} size={{ width: 500, height: 500 }} />
      )}
      
      {/* Wind Vectors */}
      {(mode === 'wind' || mode === 'combined') && showWind && windFlowField && (
        <WindVectors flowField={windFlowField} />
      )}
      
      {/* Shadow Visualization */}
      {(mode === 'shadow' || mode === 'combined') && shadowData && (
        <ShadowMeshes snapshots={shadowData} timeIndex={timeIndex} />
      )}
      
      {/* Controls */}
      <OrbitControls makeDefault />
      <PerspectiveCamera makeDefault position={[300, 200, 300]} fov={50} />
    </>
  );
};

export const Environmental3DAnalysis: React.FC<Environmental3DAnalysisProps> = ({ 
  location, 
  onClose 
}) => {
  const [mode, setMode] = useState<AnalysisMode>('solar');
  const [date, setDate] = useState(new Date());
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [showSunPath, setShowSunPath] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [windSpeed, setWindSpeed] = useState(5);
  const [windDirection, setWindDirection] = useState(180); // South
  
  const [buildings, setBuildings] = useState<THREE.Mesh[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [sunPosition, setSunPosition] = useState<SunPosition | null>(null);
  const [sunPath, setSunPath] = useState<SunPosition[] | null>(null);
  const [solarHeatmap, setSolarHeatmap] = useState<SolarRadiationHeatmap | null>(null);
  const [windFlowField, setWindFlowField] = useState<WindFlowField | null>(null);
  const [shadowData, setShadowData] = useState<ShadowTimelapseData | null>(null);
  const [timeIndex, setTimeIndex] = useState(0);
  
  // Load buildings from OSM
  useEffect(() => {
    const loadBuildings = async () => {
      setLoading(true);
      try {
        const data = await fetchOSMBuildingsAround(
          { lat: location.latitude, lng: location.longitude },
          500
        );
        const meshes = data.buildings.map(b => 
          createBuildingMesh(b, location.latitude, location.longitude)
        );
        setBuildings(meshes);
      } catch (error) {
        console.error('Failed to load buildings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadBuildings();
  }, [location]);
  
  // Update analyses when parameters change
  useEffect(() => {
    if (buildings.length === 0) return;
    
    const analysisDate = new Date(date);
    analysisDate.setHours(timeOfDay, 0, 0, 0);
    
    // Solar analysis
    if (mode === 'solar' || mode === 'combined') {
      import('suncalc').then(() => {
        const { calculateSunPosition, calculateDailySunPath, generateSolarHeatmap } = 
          require('../services/solarAnalysis3D');
        
        const sunPos = calculateSunPosition(location.latitude, location.longitude, analysisDate);
        setSunPosition(sunPos);
        
        const path = calculateDailySunPath(location.latitude, location.longitude, date, 30);
        setSunPath(path);
        
        const heatmap = generateSolarHeatmap(
          location.latitude,
          location.longitude,
          buildings,
          analysisDate,
          { width: 500, height: 500, resolution: 50 }
        );
        setSolarHeatmap(heatmap);
      });
    }
    
    // Wind analysis
    if (mode === 'wind' || mode === 'combined') {
      const params: WindAnalysisParams = {
        prevailingWindDirection: windDirection,
        windSpeed,
        referenceHeight: 10,
        temperature: 20,
        season: 'summer'
      };
      
      const flowField = generateWindFlowField(
        buildings,
        params,
        { width: 500, height: 500, resolution: 20 }
      );
      setWindFlowField(flowField);
    }
    
    // Shadow analysis
    if (mode === 'shadow' || mode === 'combined') {
      const timelapse = generateDailyShadowTimelapse(
        buildings,
        location.latitude,
        location.longitude,
        date,
        1,
        { width: 500, height: 500 }
      );
      setShadowData(timelapse);
      setTimeIndex(Math.min(timeOfDay - 6, timelapse.snapshots.length - 1));
    }
  }, [mode, buildings, date, timeOfDay, windSpeed, windDirection, location]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading 3D environment...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-screen bg-slate-900">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Controls */}
      <AnalysisControls
        mode={mode}
        setMode={setMode}
        date={date}
        setDate={setDate}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        showSunPath={showSunPath}
        setShowSunPath={setShowSunPath}
        showWind={showWind}
        setShowWind={setShowWind}
        windSpeed={windSpeed}
        setWindSpeed={setWindSpeed}
        windDirection={windDirection}
        setWindDirection={setWindDirection}
      />
      
      {/* Stats */}
      <StatsPanel
        mode={mode}
        solarData={solarHeatmap}
        windData={windFlowField}
        shadowData={shadowData}
      />
      
      {/* 3D Canvas */}
      <Canvas shadows>
        <Scene
          buildings={buildings}
          mode={mode}
          sunPosition={sunPosition}
          sunPath={sunPath}
          showSunPath={showSunPath}
          solarHeatmap={solarHeatmap}
          windFlowField={windFlowField}
          showWind={showWind}
          shadowData={shadowData}
          timeIndex={timeIndex}
        />
      </Canvas>
    </div>
  );
};

export default Environmental3DAnalysis;
