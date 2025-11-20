import ExcelJS from 'exceljs';
import { QuantitativeData, ProximityItem, LocationData } from '../types';

export interface ExcelExportOptions {
  fileName?: string;
  brand?: {
    primary?: string; // teal
    accent?: string;  // lighter teal
    text?: string;    // dark text
  };
  logoDataUrl?: string; // data:image/png;base64,...
  location?: LocationData | null;
  chartImages?: {
    landUse?: string;             // data URL (PNG) for the pie chart
    ageDemographics?: string;     // data URL (PNG) for the bar chart
    temperature?: string;
    rainfall?: string;
    wind?: string;
  };
  groupedProximity?: Record<string, ProximityItem[]>; // optional – if not provided we'll group here
}

const DEFAULT_BRAND = {
  primary: '#14b8a6',
  accent: '#5eead4',
  text: '#0f172a',
};

function b64FromDataUrl(dataUrl: string): string {
  if (!dataUrl) return '';
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
}

async function fetchPublicImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

function groupProximity(list?: ProximityItem[]): Record<string, ProximityItem[]> {
  if (!list) return {};
  return list.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {} as Record<string, ProximityItem[]>);
}

function addHeader(ws: ExcelJS.Worksheet, title: string, brand = DEFAULT_BRAND) {
  ws.mergeCells('A1', 'H1');
  const cell = ws.getCell('A1');
  cell.value = title;
  cell.font = { name: 'Inter', size: 18, bold: true, color: { argb: brand.text.replace('#', '') } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;
  
  // Thin underline separator
  const sep = ws.getRow(2);
  for (let c = 1; c <= 8; c++) {
    const cell = ws.getCell(2, c);
    cell.border = { bottom: { style: 'thin', color: { argb: brand.primary.replace('#', '') } } };
  }
  ws.getRow(2).height = 6;
}

function setDefaultColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { width: 20 }, { width: 25 }, { width: 25 }, { width: 18 },
    { width: 18 }, { width: 22 }, { width: 22 }, { width: 30 },
  ];
}

function cell(ws: ExcelJS.Worksheet, addr: string, value: any, opts?: { bold?: boolean; color?: string; }) {
  const c = ws.getCell(addr);
  c.value = value as any;
  const font: Partial<ExcelJS.Font> = { name: 'Inter', size: 11 };
  if (opts?.bold) font.bold = true;
  if (opts?.color) font.color = { argb: opts.color.replace('#', '') };
  c.font = font as ExcelJS.Font;
  return c;
}

export async function exportQuantitativeToExcel(
  data: QuantitativeData,
  opts: ExcelExportOptions = {}
): Promise<void> {
  const brand = { ...DEFAULT_BRAND, ...(opts.brand || {}) };
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.creator = 'UrbanEyes';

  // Theme-like styles
  const titleColor = brand.primary.replace('#', '');

  // Summary sheet
  const summary = workbook.addWorksheet('Summary');
  setDefaultColumns(summary);
  addHeader(summary, 'UrbanEyes – Quantitative Analysis', brand);

  // Logo top-right
  try {
    const logoB64 = opts.logoDataUrl ? b64FromDataUrl(opts.logoDataUrl) : await fetchPublicImageAsBase64('/urbaneyes-logo.png');
    const imgId = workbook.addImage({ base64: logoB64, extension: 'png' });
    summary.addImage(imgId, {
      tl: { col: 6.6, row: 0.3 },
      ext: { width: 140, height: 40 },
      editAs: 'absolute',
    });
  } catch {}

  // Project/location block
  const locName = opts.location?.name || data.location?.name || 'Selected Location';
  cell(summary, 'A3', 'Location', { bold: true, color: brand.text });
  cell(summary, 'B3', locName);
  if (opts.location?.latitude && opts.location?.longitude) {
    cell(summary, 'A4', 'Coordinates', { bold: true });
    cell(summary, 'B4', `${opts.location.latitude.toFixed(6)}, ${opts.location.longitude.toFixed(6)}`);
  }

  // KPI Cards area (styled rows)
  const kpiStartRow = 6;
  const kpis: Array<{ label: string; value?: string | number; unit?: string }> = [
    { label: 'Potential Visitors (daily)', value: data.potentialVisitors },
    { label: 'Green Space Ratio', value: data.greenSpaceRatio, unit: '%' },
    { label: 'Public Transport Access', value: data.publicTransportAccess },
    { label: 'Average Income', value: data.averageIncome },
    { label: 'Walkability Score', value: data.walkabilityScore, unit: '/100' },
    { label: 'Nearby Amenities (500m)', value: data.nearbyPOIs },
    { label: 'Estimated Noise', value: data.noiseLevel },
    { label: 'Flood Risk', value: data.floodRisk },
  ];

  kpis.forEach((k, idx) => {
    const r = kpiStartRow + idx;
    const labelCell = cell(summary, `A${r}`, k.label, { bold: true, color: brand.text });
    const valCell = cell(summary, `B${r}`, k.value !== undefined && k.value !== null ? `${k.value}${k.unit ? ' ' + k.unit : ''}` : '—');
    labelCell.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: brand.accent.replace('#', '') },
    };
    labelCell.border = { left: { style: 'thin', color: { argb: titleColor } }, top: { style: 'thin', color: { argb: titleColor } }, bottom: { style: 'thin', color: { argb: titleColor } } };
    valCell.border = { right: { style: 'thin', color: { argb: titleColor } }, top: { style: 'thin', color: { argb: titleColor } }, bottom: { style: 'thin', color: { argb: titleColor } } };
  });

  // Dashboard sheet (no embedded images, purely data-driven KPIs & mini tables)
  const dashboard = workbook.addWorksheet('Dashboard');
  setDefaultColumns(dashboard);
  addHeader(dashboard, 'UrbanEyes – Planning Dashboard', brand);

  // KPI Grid (using merged cells for layout)
  const kpiLabels = [
    ['Potential Visitors', data.potentialVisitors || '—'],
    ['Green Space %', data.greenSpaceRatio !== undefined ? data.greenSpaceRatio + '%' : '—'],
    ['Public Transport', data.publicTransportAccess || '—'],
    ['Avg Income', data.averageIncome || '—'],
    ['Walkability', data.walkabilityScore !== undefined ? data.walkabilityScore + '/100' : '—'],
    ['Nearby Amenities', data.nearbyPOIs !== undefined ? String(data.nearbyPOIs) : '—'],
    ['Estimated Noise', data.noiseLevel || '—'],
    ['Flood Risk', data.floodRisk || '—'],
  ];
  // Render KPIs in two rows
  kpiLabels.forEach((kpi, idx) => {
    const col = (idx % 4) * 2 + 1; // span 2 columns each
    const row = Math.floor(idx / 4) + 3;
    const cellAddr = `${String.fromCharCode(64 + col)}${row}`; // crude mapping A,B,...
    const endAddr = `${String.fromCharCode(64 + col + 1)}${row}`;
    dashboard.mergeCells(`${cellAddr}:${endAddr}`);
    const c = dashboard.getCell(cellAddr);
    c.value = `${kpi[0]}: ${kpi[1]}`;
    c.font = { name: 'Inter', size: 12, bold: true, color: { argb: brand.text.replace('#', '') } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand.accent.replace('#', '') } };
    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Demographics mini table
  let dRow = 6;
  cell(dashboard, `A${dRow}`, 'Age Demographics (1km)', { bold: true, color: brand.text });
  dRow++;
  cell(dashboard, `A${dRow}`, 'Age Range', { bold: true });
  cell(dashboard, `B${dRow}`, 'Percentage', { bold: true });
  (data.ageDemographics || []).forEach((ad, i) => {
    cell(dashboard, `A${dRow + 1 + i}`, ad.ageRange);
    cell(dashboard, `B${dRow + 1 + i}`, ad.percentage);
  });
  dRow = dRow + 2 + (data.ageDemographics?.length || 0);

  // Land Use mini table
  cell(dashboard, `A${dRow}`, 'Land Use Types (1km)', { bold: true, color: brand.text });
  dRow++;
  cell(dashboard, `A${dRow}`, 'Type', { bold: true });
  cell(dashboard, `B${dRow}`, 'Percentage', { bold: true });
  (data.landUse || []).forEach((lu, i) => {
    cell(dashboard, `A${dRow + 1 + i}`, lu.type);
    cell(dashboard, `B${dRow + 1 + i}`, lu.percentage);
  });
  dRow = dRow + 2 + (data.landUse?.length || 0);

  // Climate summary (averages)
  const avgTemp = data.monthlyTemperatures && data.monthlyTemperatures.length > 0 ? (data.monthlyTemperatures.reduce((a,b)=>a+b.temp,0)/data.monthlyTemperatures.length).toFixed(2) : '—';
  const totalRain = data.monthlyRainfall && data.monthlyRainfall.length > 0 ? data.monthlyRainfall.reduce((a,b)=>a+b.rainfall,0) : '—';
  cell(dashboard, `A${dRow}`, 'Climate Summary', { bold: true, color: brand.text });
  dRow++;
  cell(dashboard, `A${dRow}`, 'Avg Temp (°C)', { bold: true }); cell(dashboard, `B${dRow}`, avgTemp);
  cell(dashboard, `C${dRow}`, 'Total Rainfall (mm)', { bold: true }); cell(dashboard, `D${dRow}`, totalRain);
  dRow++;
  if (data.monthlyWinds && data.monthlyWinds.length) {
    // Dominant wind direction frequency
    const freq: Record<string, number> = {};
    data.monthlyWinds.forEach(w => { freq[w.direction] = (freq[w.direction]||0)+1; });
    const dominant = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
    cell(dashboard, `A${dRow}`, 'Dominant Wind', { bold: true }); cell(dashboard, `B${dRow}`, dominant ? `${dominant[0]} (${dominant[1]})` : '—');
    dRow++;
  }

  // Proximity sheet – grouped table
  const prox = workbook.addWorksheet('Proximity');
  setDefaultColumns(prox);
  addHeader(prox, 'Proximity Analysis (1km)', brand);

  const grouped = opts.groupedProximity || groupProximity(data.proximityAnalysis);
  cell(prox, 'A3', 'Category', { bold: true });
  cell(prox, 'B3', 'Place', { bold: true });
  cell(prox, 'C3', 'Distance', { bold: true });
  let r = 4;
  Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).forEach(([cat, items]) => {
    const start = r;
    items.forEach(it => {
      cell(prox, `A${r}`, cat);
      cell(prox, `B${r}`, it.name);
      cell(prox, `C${r}`, it.distance);
      r++;
    });
    // subtle category band coloring
    for (let i = start; i < r; i++) {
      prox.getCell(i, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDFA' } }; // teal-50
    }
  });
  prox.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, r-1), column: 3 } };

  // Raw Data sheet – exhaustive listing of all available fields
  const raw = workbook.addWorksheet('Raw Data');
  setDefaultColumns(raw);
  addHeader(raw, 'Underlying Data', brand);

  // Land use
  cell(raw, 'A3', 'Land Use Type', { bold: true });
  cell(raw, 'B3', 'Percentage', { bold: true });
  (data.landUse || []).forEach((lu, idx) => {
    cell(raw, `A${4+idx}`, lu.type);
    cell(raw, `B${4+idx}`, lu.percentage);
  });

  // Age
  let base = 6 + (data.landUse?.length || 0);
  cell(raw, `A${base}`, 'Age Range', { bold: true });
  cell(raw, `B${base}`, 'Percentage', { bold: true });
  (data.ageDemographics || []).forEach((ad, i) => {
    cell(raw, `A${base+1+i}`, ad.ageRange);
    cell(raw, `B${base+1+i}`, ad.percentage);
  });

  // Climate (monthly detailed)
  base = base + 3 + (data.ageDemographics?.length || 0);
  cell(raw, `A${base}`, 'Month', { bold: true });
  cell(raw, `B${base}`, 'Temperature (°C)', { bold: true });
  cell(raw, `C${base}`, 'Rainfall (mm)', { bold: true });
  cell(raw, `D${base}`, 'Humidity (%)', { bold: true });
  cell(raw, `E${base}`, 'Wind Direction', { bold: true });
  (data.monthlyTemperatures || []).forEach((t, i) => {
    cell(raw, `A${base+1+i}`, t.month);
    cell(raw, `B${base+1+i}`, t.temp);
  });
  (data.monthlyRainfall || []).forEach((rf, i) => {
    cell(raw, `C${base+1+i}`, rf.rainfall);
  });
  (data.monthlyHumidity || []).forEach((h, i) => {
    cell(raw, `D${base+1+i}`, h.humidity);
  });
  (data.monthlyWinds || []).forEach((w, i) => {
    cell(raw, `E${base+1+i}`, w.direction);
  });

  // Environmental & Regulatory metrics
  let envStart = base + 3 + Math.max(
    data.monthlyTemperatures?.length || 0,
    data.monthlyRainfall?.length || 0,
    data.monthlyHumidity?.length || 0,
    data.monthlyWinds?.length || 0
  );
  cell(raw, `A${envStart}`, 'Key Metrics', { bold: true, color: brand.text });
  const metrics: Array<[string, any]> = [
    ['Walkability Score', data.walkabilityScore],
    ['Noise Level', data.noiseLevel],
    ['Flood Risk', data.floodRisk],
    ['Zoning FAR', data.zoningFAR],
    ['Height Limit (m)', data.heightLimit],
    ['Impervious Surface Ratio (%)', data.imperviousSurfaceRatio],
    ['Tree Canopy Coverage (%)', data.treeCanopyCoverage],
    ['Air Quality PM2.5', data.airQualityPM25],
    ['Air Quality NO2', data.airQualityNO2],
    ['Transit Frequency (vehicles/hr)', data.transitFrequency],
    ['Cycling Infrastructure Density (m/km²)', data.cyclingInfrastructureDensity],
    ['15-Min City Index (%)', data.fifteenMinuteCityIndex],
    ['Parking Ratio (spaces/1000m²)', data.parkingRatio],
    ['Connectivity Score', data.connectivityScore],
    ['Median Rent', data.medianRent],
    ['Median Property Price', data.medianPropertyPrice],
    ['Average Household Size', data.householdSize],
    ['Population Density (people/km²)', data.populationDensity],
    ['Annual Growth Rate (%)', data.annualGrowthRate],
    ['Education Index (%)', data.educationIndex],
    ['Diversity Migration Index (/100)', data.diversityMigrationIndex],
  ];
  metrics.forEach((m, i) => {
    cell(raw, `A${envStart + 1 + i}`, m[0]);
    cell(raw, `B${envStart + 1 + i}`, m[1] !== undefined ? m[1] : '');
  });

  // Employment sector split
  if (data.employmentSectorSplit && data.employmentSectorSplit.length) {
    let empStart = envStart + 3 + metrics.length;
    cell(raw, `A${empStart}`, 'Employment Sector Split', { bold: true, color: brand.text });
    cell(raw, `A${empStart+1}`, 'Sector', { bold: true });
    cell(raw, `B${empStart+1}`, 'Percentage', { bold: true });
    data.employmentSectorSplit.forEach((s, i) => {
      cell(raw, `A${empStart+2+i}`, s.sector);
      cell(raw, `B${empStart+2+i}`, s.percentage);
    });
  }

  // Finish and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safeName = (opts.fileName || `${locName}_Quantitative_Export`).replace(/[^a-z0-9-_]+/gi, '_');
  a.download = `${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
