import React from 'react';
import { MapExportProgress as ProgressData } from '@/services/mapExportService';

interface MapExportProgressProps {
  progress: ProgressData;
  isOpen: boolean;
}

export const MapExportProgress: React.FC<MapExportProgressProps> = ({ progress, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Exporting Maps</h3>
          <p className="text-sm text-slate-600">
            Capturing <span className="font-semibold text-teal-600">{progress.mapName}</span>
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <span>Map {progress.currentMap} of {progress.totalMaps}</span>
            <span className="font-semibold text-teal-600">{Math.round(progress.percentage)}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Fun Fact (icon removed for cleaner look) */}
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-6 border border-teal-100">
          <h4 className="text-xs font-semibold text-teal-900 mb-2 uppercase tracking-wide">Did You Know?</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{progress.fact}</p>
        </div>

        {/* Note */}
        <p className="text-xs text-center text-slate-500 mt-6 italic">
          Please don't close this window. This may take 20-30 seconds.
        </p>
      </div>
    </div>
  );
};

export default MapExportProgress;
