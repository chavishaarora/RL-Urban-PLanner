import React from 'react';

interface ProgressBarProps {
  progress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="w-full my-4">
      <div className="w-full bg-gradient-to-r from-slate-100 to-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out relative overflow-hidden
                     bg-gradient-to-r from-teal-400 via-teal-500 to-cyan-500
                     shadow-md shadow-teal-500/30"
          style={{ width: `${progress}%` }}
        >
          {/* Animated shimmer effect */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent
                       animate-shimmer"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear'
            }}
          />
        </div>
      </div>
    </div>
  );
};