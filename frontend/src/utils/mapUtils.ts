declare const google: any;

export const getPOIMarkerIcon = () => {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#10B981', // emerald-500
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
    };
};
