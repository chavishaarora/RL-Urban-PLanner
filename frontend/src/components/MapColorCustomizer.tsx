import React, { useState } from 'react';

interface ColorConfig {
  color: string;
  opacity: number;
  visible: boolean;
}

interface MapColorCustomizerProps {
  mapType: string;
  categories: { [key: string]: string }; // Default colors
  currentConfig: { [key: string]: ColorConfig };
  onConfigChange: (config: { [key: string]: ColorConfig }) => void;
  onReset: () => void;
}

export const MapColorCustomizer: React.FC<MapColorCustomizerProps> = ({
  mapType,
  categories,
  currentConfig,
  onConfigChange,
  onReset,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorChange = (category: string, color: string) => {
    onConfigChange({
      ...currentConfig,
      [category]: { ...currentConfig[category], color },
    });
  };

  const handleOpacityChange = (category: string, opacity: number) => {
    onConfigChange({
      ...currentConfig,
      [category]: { ...currentConfig[category], opacity },
    });
  };

  const handleVisibilityToggle = (category: string) => {
    onConfigChange({
      ...currentConfig,
      [category]: {
        ...currentConfig[category],
        visible: !currentConfig[category].visible,
      },
    });
  };

  return (
    <div className="absolute top-4 right-4 z-[1001]">
      {/* Sleek Toggle Button with Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group relative px-4 py-2.5 bg-gradient-to-br from-white/90 to-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium border border-white/40 overflow-hidden ${
          isOpen ? 'ring-2 ring-teal-400/50' : ''
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
            Customize
          </span>
          <svg 
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Animated Dropdown Panel */}
      <div
        className={`absolute top-full right-0 mt-3 origin-top-right transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-br from-white/95 via-white/90 to-white/85 backdrop-blur-2xl rounded-2xl shadow-2xl p-5 w-[320px] max-h-[450px] overflow-y-auto border border-white/50 ring-1 ring-slate-200/50 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200/60">
            <h3 className="font-bold text-slate-800 text-base bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Color Palette
            </h3>
            <button
              onClick={onReset}
              className="group text-xs text-teal-600 hover:text-teal-700 font-semibold px-3 py-1.5 rounded-xl hover:bg-teal-50/80 transition-all duration-200 border border-transparent hover:border-teal-200/50"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </span>
            </button>
          </div>

          {/* Category Items */}
          <div className="space-y-2.5">
            {Object.entries(categories).map(([category, defaultColor], index) => {
              const config = currentConfig[category] || {
                color: defaultColor,
                opacity: 0.7,
                visible: true,
              };

              return (
                <div
                  key={category}
                  className="group rounded-xl p-3 space-y-3 bg-gradient-to-br from-slate-50/80 to-slate-50/40 border border-slate-200/60 hover:border-teal-300/50 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Toggle with smooth animation */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleVisibilityToggle(category)}
                        className={`relative w-8 h-8 rounded-full cursor-pointer transition-all duration-300 hover:scale-110 flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 ${
                          config.visible 
                            ? 'bg-gradient-to-br from-teal-500 to-teal-600' 
                            : 'bg-gradient-to-br from-slate-300 to-slate-400'
                        }`}
                      >
                        <div
                          className={`transition-all duration-300 ${
                            config.visible
                              ? 'w-2 h-2 bg-white rounded-full scale-100 opacity-100'
                              : 'w-0 h-0 scale-0 opacity-0'
                          }`}
                        ></div>
                      </button>
                      <span className="text-xs font-semibold text-slate-700 truncate">
                        {category}
                      </span>
                    </div>
                    
                    {/* Color picker with glow effect */}
                    <label className="cursor-pointer group/color">
                      <div
                        className={`w-8 h-8 rounded-full border-2 transition-all duration-300 shadow-md hover:shadow-xl hover:scale-110 active:scale-95 ${
                          config.visible 
                            ? 'border-white hover:border-teal-300' 
                            : 'border-slate-300 opacity-50'
                        }`}
                        style={{ 
                          backgroundColor: config.color,
                          boxShadow: config.visible ? `0 0 20px ${config.color}40` : 'none'
                        }}
                      />
                      <input
                        type="color"
                        value={config.color}
                        onChange={(e) => handleColorChange(category, e.target.value)}
                        className="w-0 h-0 opacity-0 absolute pointer-events-none"
                        disabled={!config.visible}
                      />
                    </label>
                  </div>

                  {/* Enhanced Opacity slider */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[60px]">
                      <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-[10px] text-slate-500 font-semibold">Opacity</span>
                    </div>
                    <div className="flex-1 relative group/slider">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.opacity * 100}
                        onChange={(e) =>
                          handleOpacityChange(category, parseInt(e.target.value) / 100)
                        }
                        className="relative w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-teal-600 rounded-full appearance-none cursor-pointer opacity-slider"
                        disabled={!config.visible}
                      />
                    </div>
                    <span className="text-[11px] text-slate-700 font-bold w-9 text-right tabular-nums bg-slate-100/80 px-1.5 py-0.5 rounded-lg">
                      {Math.round(config.opacity * 100)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #14b8a6 transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #14b8a6;
          border-radius: 10px;
          transition: background 0.3s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0d9488;
        }
        
        .opacity-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff, #f1f5f9);
          cursor: pointer;
          border: 3px solid #0d9488;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3), 0 0 0 0 rgba(13, 148, 136, 0.4);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .opacity-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.4), 0 0 0 4px rgba(13, 148, 136, 0.1);
        }
        .opacity-slider::-webkit-slider-thumb:active {
          transform: scale(1.1);
          box-shadow: 0 2px 4px rgba(13, 148, 136, 0.4), 0 0 0 6px rgba(13, 148, 136, 0.15);
        }
        
        .opacity-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff, #f1f5f9);
          cursor: pointer;
          border: 3px solid #0d9488;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .opacity-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.4), 0 0 0 4px rgba(13, 148, 136, 0.1);
        }
        
        .opacity-slider:disabled::-webkit-slider-thumb {
          border-color: #cbd5e1;
          background: #e2e8f0;
          cursor: not-allowed;
          box-shadow: none;
        }
        .opacity-slider:disabled::-moz-range-thumb {
          border-color: #cbd5e1;
          background: #e2e8f0;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}} />
    </div>
  );
};
