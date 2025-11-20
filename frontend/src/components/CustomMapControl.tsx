import React, { useState, useEffect } from 'react';

interface CustomMapControlProps {
    map: any | null; // google.maps.Map
}

export const CustomMapControl: React.FC<CustomMapControlProps> = ({ map }) => {
    const [currentMapType, setCurrentMapType] = useState('styled_map');
    const [currentTilt, setCurrentTilt] = useState(0);

    useEffect(() => {
        if (!map) return;

        const syncMapState = () => {
            const mapTypeId = map.getMapTypeId();
            if (mapTypeId === 'satellite' || mapTypeId === 'styled_map') {
                setCurrentMapType(mapTypeId);
            }
            setCurrentTilt(map.getTilt() || 0);
        };

        syncMapState();

        const typeListener = map.addListener('maptypeid_changed', syncMapState);
        const tiltListener = map.addListener('tilt_changed', syncMapState);

        return () => {
            typeListener.remove();
            tiltListener.remove();
        };
    }, [map]);

    const handleMapTypeChange = (type: 'styled_map' | 'satellite') => {
        if (map) {
            map.setMapTypeId(type);
        }
    };

    const handleTiltChange = (tilt: 0 | 45) => {
        if (map) {
            map.setTilt(tilt);
        }
    };

    if (!map) return null;
    
    const isSatellite = currentMapType === 'satellite';

    return (
        <div className="absolute top-4 right-4 z-30 flex gap-2 items-center">
            {isSatellite && (
                 <div className="btn-group">
                    <button
                        onClick={() => handleTiltChange(0)}
                        className={`btn ${currentTilt === 0 ? 'active' : ''}`}
                        aria-pressed={currentTilt === 0}
                        title="Top-down View (2D)"
                        style={{ pointerEvents: 'auto', zIndex: 1 }}
                    >
                        2D
                    </button>
                    <button
                        onClick={() => handleTiltChange(45)}
                        className={`btn ${currentTilt !== 0 ? 'active' : ''}`}
                        aria-pressed={currentTilt !== 0}
                        title="Angled View (3D)"
                        style={{ pointerEvents: 'auto', zIndex: 1 }}
                    >
                        3D
                    </button>
                </div>
            )}
            <div className="btn-group">
                <button
                    onClick={() => handleMapTypeChange('styled_map')}
                    className={`btn ${currentMapType === 'styled_map' ? 'active' : ''}`}
                    aria-pressed={currentMapType === 'styled_map'}
                    style={{ pointerEvents: 'auto', zIndex: 1 }}
                >
                    Styled
                </button>
                <button
                    onClick={() => handleMapTypeChange('satellite')}
                    className={`btn ${currentMapType === 'satellite' ? 'active' : ''}`}
                    aria-pressed={currentMapType === 'satellite'}
                    style={{ pointerEvents: 'auto', zIndex: 1 }}
                >
                    Satellite
                </button>
            </div>
        </div>
    );
};
