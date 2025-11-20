// Feature removed: Amenities & POIs map.
// Keeping a minimal stub export to avoid dangling import errors elsewhere during transition.
import { LocationData } from '../types';
interface OSMAmenitiesMapProps { location: LocationData }
export const OSMAmenitiesMap: React.FC<OSMAmenitiesMapProps> = () => (
  <div className="w-full p-6 rounded-3xl border border-slate-200 bg-white text-sm text-slate-600">
    Amenities & POIs feature has been removed.
  </div>
);
export default OSMAmenitiesMap;
