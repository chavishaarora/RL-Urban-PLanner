import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocationData } from '../types';
import PopulationDensityMap from './PopulationDensityMap';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#a8dadc' }] },
];

interface PopulationDensityContextMapProps { location: LocationData; }

const PopulationDensityContextMap: React.FC<PopulationDensityContextMapProps> = ({ location }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any | null>(null);
  const center = useMemo(() => ({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);

  useEffect(() => {
    if (map || !containerRef.current) return;
    const mapInstance = new google.maps.Map(containerRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      mapTypeId: 'styled_map'
    });
    mapInstance.mapTypes.set('styled_map', new google.maps.StyledMapType(lightMapStyle, { name: 'Styled' }));
    if (location.boundary && location.boundary.length > 0) {
      const b = new google.maps.LatLngBounds();
      location.boundary.forEach(p => b.extend(p));
      mapInstance.fitBounds(b);
    }
    setMap(mapInstance);
  }, [map, center, location.boundary]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Population Density</h3>
        <div className="text-[11px] text-slate-500">Hybrid: OSM buildings + Google Places weighting</div>
      </div>
      <div ref={containerRef} className="w-full aspect-square max-h-[560px] rounded-3xl border border-slate-200 overflow-hidden relative shadow-lg">
        {map && (
          <PopulationDensityMap center={center} googleMap={map} />
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500 italic">Sources: OpenStreetMap (buildings) and Google Places (activity proxies). Respect licensing for derivative outputs.</p>
    </div>
  );
};

export default PopulationDensityContextMap;
