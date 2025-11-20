import html2canvas from 'html2canvas';
import JSZip from 'jszip';

export const CARTOGRAPHY_FACTS = [
  "The oldest known map is from 600 BCE, found in Babylonian clay tablets.",
  "The Mercator projection, created in 1569, distorts Greenland to appear as large as Africa (in reality, Africa is 14 times larger).",
  "OpenStreetMap has over 10 million registered contributors worldwide.",
  "The first Google Street View car hit the roads in 2007 in San Francisco.",
  "Medieval maps often placed Jerusalem at the center of the world.",
  "Antarctica wasn't accurately mapped until satellite imagery became available in the 1960s.",
  "The Peters projection shows countries at their true relative sizes, unlike Mercator.",
  "Charles Booth's 1889 poverty maps of London pioneered modern thematic mapping.",
  "The term 'cartography' comes from the Greek 'chartis' (map) and 'graphein' (write).",
  "John Snow's 1854 cholera map helped prove diseases spread through water, not air.",
  "Tokyo's metro map has over 280 stations across 13 lines.",
  "OpenStreetMap contains over 9 billion data points as of 2025.",
  "The first topographic maps with contour lines appeared in France in the 1770s.",
  "NASA's Blue Marble image (1972) was the first full-Earth photograph.",
  "Ancient Polynesian navigators used stick charts made from palm fronds to map ocean swells.",
  "The International Date Line zigzags to avoid splitting countries.",
  "Mount Everest's height was first calculated in 1856 using trigonometry from 160km away.",
  "Lewis and Clark's 1804 expedition maps opened the American West to settlement.",
  "Barcelona's street grid expands in 113m × 113m 'superblocks'.",
  "Singapore reclaimed 25% of its land area from the sea since 1960.",
  "The Netherlands has 2,500 km of sea dikes protecting land below sea level.",
  "Curitiba, Brazil pioneered Bus Rapid Transit (BRT) systems in 1974.",
  "Copenhagen's 'finger plan' from 1947 still shapes its urban form today.",
  "Phoenix's urban heat island can be 11°C hotter than surrounding desert.",
  "Hong Kong has the world's highest residential density at 130,000 people/km²."
];

export interface MapExportProgress {
  currentMap: number;
  totalMaps: number;
  mapName: string;
  fact: string;
  percentage: number;
}

export type ProgressCallback = (progress: MapExportProgress) => void;

export type ExportFraming = 'normal' | 'wide' | 'xwide';
export interface ExportOptions {
  framing?: ExportFraming;
}

interface MapCapture {
  name: string;
  buttonSelector: string;
  waitTime: number;
}

// Increased waitTime baseline; final stability also checks data-export-ready attr
const MAP_CAPTURES: MapCapture[] = [
  { name: 'BuildingTypes', buttonSelector: 'Type', waitTime: 2600 },
  { name: 'BuildingHeight', buttonSelector: 'Height', waitTime: 2600 },
  { name: 'BuildingFootprint', buttonSelector: 'Footprint', waitTime: 2600 },
  { name: 'BuildingAge', buttonSelector: 'Age', waitTime: 3000 },
  { name: 'LandUse', buttonSelector: 'Land Use', waitTime: 2800 },
  { name: 'PopulationDensity', buttonSelector: 'Population', waitTime: 3200 },
  { name: 'StreetHierarchy', buttonSelector: 'Street Hierarchy', waitTime: 2600 },
  { name: 'Accessibility', buttonSelector: 'Accessibility', waitTime: 3000 },
];

function getRandomFact(): string {
  return CARTOGRAPHY_FACTS[Math.floor(Math.random() * CARTOGRAPHY_FACTS.length)];
}

async function waitForMapToLoad(delayMs: number = 2000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function captureMapElement(element: HTMLElement): Promise<Blob> {
  // Scroll into view to encourage tiles to load
  element.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center', inline: 'center' });
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scale: 2, // High quality export
    logging: false,
    imageTimeout: 0,
  });
  // Convert to Blob to reduce memory footprint
  return new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b as Blob), 'image/png'));
}

async function waitForMapStable(element: HTMLElement, timeoutMs: number = 12000): Promise<void> {
  const start = Date.now();
  const gm = () => element.querySelector('.gm-style') || element;
  const isTilesStable = () => {
    const root = gm();
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    const canvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[];
    const imgsReady = imgs.length >= 6 && imgs.every(i => i.complete && i.naturalWidth > 0);
    const canvasReady = canvases.some(c => c.width > 0 && c.height > 0);
    return imgsReady || canvasReady;
  };
  const isOverlayReady = () => element.getAttribute('data-export-ready') === 'true';

  while (Date.now() - start < timeoutMs) {
    if (isTilesStable() && isOverlayReady()) {
      // extra settle
      await waitForMapToLoad(500);
      return;
    }
    await waitForMapToLoad(250);
  }
}

function clickButton(label: string): boolean {
  const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  const btn = buttons.find(b => (b.textContent || '').trim() === label);
  if (btn) { btn.click(); return true; }
  return false;
}

export async function exportAllMaps(
  locationName: string,
  optionsOrCb?: ExportOptions | ProgressCallback,
  onProgress?: ProgressCallback
): Promise<void> {
  const options: ExportOptions = (typeof optionsOrCb === 'function') ? {} : (optionsOrCb || {});
  const progressCb: ProgressCallback | undefined = (typeof optionsOrCb === 'function') ? optionsOrCb as ProgressCallback : onProgress;
  const framing: ExportFraming = options.framing || 'wide';
  const zip = new JSZip();
  const folder = zip.folder(`${locationName}_ContextMaps`);
  
  if (!folder) {
    throw new Error('Failed to create ZIP folder');
  }

  // First, ensure we're on the Building Analysis tab
  const buildingTab = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent?.trim() === 'Building Analysis'
  );
  if (buildingTab) buildingTab.click();
  await waitForMapToLoad(1000);

  const totalMaps = MAP_CAPTURES.length;

  for (let i = 0; i < totalMaps; i++) {
    const capture = MAP_CAPTURES[i];
    const fact = getRandomFact();
    
    // Update progress
    if (progressCb) {
      progressCb({
        currentMap: i + 1,
        totalMaps,
        mapName: capture.name,
        fact,
        percentage: ((i + 1) / totalMaps) * 100,
      });
    }

    // Determine which top-level tab to open
    if (i <= 3) {
      clickButton('Building Analysis');
    } else if (i <= 5) {
      clickButton('Land Use');
    } else {
      clickButton('Road Network');
    }

  await waitForMapToLoad(600); // allow tab switch + initial tile request

    // Reset viewport for consistent framing
  window.dispatchEvent(new CustomEvent('uexport-reset-view', { detail: { framing } }));
  await waitForMapToLoad(800); // give time for fitBounds + zoom padding

    // Select the specific sub-mode
    clickButton(capture.buttonSelector);

    // Find the map container and capture it
    const mapContainer = document.querySelector('[data-map-capture="true"]') as HTMLElement;
    if (mapContainer) {
    // Wait until tiles + overlays signal ready (attribute) with extended timeout
  // Wait 10 seconds for each map to load before capture
  await waitForMapStable(mapContainer, 10000);
      const blob = await captureMapElement(mapContainer);
      // Add to ZIP directly as Blob
      folder.file(`${locationName}_${capture.name}.png`, blob);
      // Small gap to let the UI breathe between captures
      await waitForMapToLoad(500);
    }
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().split('T')[0];
  link.download = `${locationName}_ContextMaps_${timestamp}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export single visible map as PNG
export async function exportSingleMap(
  locationName: string,
  mapName: string,
  options?: ExportOptions
): Promise<void> {
  const framing: ExportFraming = options?.framing || 'wide';
  
  // Find the map container
  const mapContainer = document.querySelector('[data-map-capture="true"]') as HTMLElement;
  if (!mapContainer) {
    throw new Error('No map found to export');
  }

  // Reset viewport for consistent framing
  window.dispatchEvent(new CustomEvent('uexport-reset-view', { detail: { framing } }));
  await waitForMapToLoad(800);

  // Wait until tiles + overlays are ready
  await waitForMapStable(mapContainer, 10000);

  // Capture the map
  const blob = await captureMapElement(mapContainer);
  
  // Download immediately
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().split('T')[0];
  link.download = `${locationName}_${mapName}_${timestamp}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

