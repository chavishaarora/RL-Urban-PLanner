import html2canvas from 'html2canvas';

declare const google: any;

export interface MapExportOptions {
  map: any;
  boundary: { lat: number; lng: number }[];
  locationName: string;
  layerName: string;
}

/**
 * Exports a map with consistent zoom and centering based on boundary
 */
export async function exportMapWithBoundary(options: MapExportOptions): Promise<void> {
  const { map, boundary, locationName, layerName } = options;

  if (!map || !boundary || boundary.length === 0) {
    console.error('Cannot export: missing map or boundary');
    return;
  }

  // Store original state
  const originalZoom = map.getZoom();
  const originalCenter = map.getCenter();

  try {
    // Create bounds from boundary
    const bounds = new google.maps.LatLngBounds();
    boundary.forEach((point: { lat: number; lng: number }) => {
      bounds.extend(new google.maps.LatLng(point.lat, point.lng));
    });

    // Fit map to bounds with wider padding for better framing
    map.fitBounds(bounds, {
      top: 180,
      right: 180,
      bottom: 180,
      left: 180,
    });

    // Wait for initial fit, then zoom out slightly for better context
    await new Promise(resolve => setTimeout(resolve, 500));

    // Zoom out by 2 levels to show more context
    const currentZoom = map.getZoom();
    map.setZoom(Math.max(0, currentZoom - 2));

    // Wait for map to finish rendering at new zoom
    await new Promise(resolve => setTimeout(resolve, 800));

    // Find the map container (should have data-map-capture attribute)
    const mapElement = document.querySelector('[data-map-capture="true"]') as HTMLElement;

    if (!mapElement) {
      console.error('Cannot find map element with data-map-capture attribute');
      return;
    }

    // Capture the map using html2canvas
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2, // High resolution
      logging: false,
    });

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${locationName}_${layerName}_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');

  } catch (error) {
    console.error('Error exporting map:', error);
  } finally {
    // Restore original view
    map.setZoom(originalZoom);
    map.setCenter(originalCenter);
  }
}
