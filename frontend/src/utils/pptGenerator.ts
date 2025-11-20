import { ProjectData, DesignAlternative } from '../types';

/**
 * Generate a PowerPoint presentation of the analysis
 * Note: This creates an XML-based PPTX structure
 */
export const generatePowerPointReport = async (projectData: ProjectData) => {
    // For a real implementation, we'd use a library like pptxgenjs
    // For now, let's create a simplified version that downloads structured data
    
    const presentation = {
        title: `UrbanEyes Analysis - ${projectData.quantitativeData?.location?.name || 'Untitled'}`,
        slides: [] as any[]
    };

    // Slide 1: Title
    presentation.slides.push({
        type: 'title',
        title: 'UrbanEyes Urban Analysis Report',
        subtitle: projectData.quantitativeData?.location?.name || 'Site Analysis',
        footer: new Date().toLocaleDateString()
    });

    // Slide 2: Project Overview
    if (projectData.location) {
        presentation.slides.push({
            type: 'content',
            title: 'Project Overview',
            content: [
                `Location: ${projectData.location.name}`,
                `Coordinates: ${projectData.location.latitude.toFixed(4)}, ${projectData.location.longitude.toFixed(4)}`,
                `Site Area: ${projectData.location.area ? `${projectData.location.area.toFixed(0)} m² (${(projectData.location.area * 10.764).toFixed(0)} ft²)` : 'N/A'}`
            ]
        });
    }

    // Slide 3: Cost Summary (if available)
    if (projectData.costEstimate) {
        presentation.slides.push({
            type: 'cost',
            title: 'Cost Estimate Summary',
            data: {
                totalCost: projectData.costEstimate.totalCost,
                constructionCost: projectData.costEstimate.constructionCost,
                maintenanceYearlyCost: projectData.costEstimate.maintenanceYearlyCost,
                contingency: projectData.costEstimate.contingency
            }
        });
    }

    // Slide 4-7: Analysis Sections
    projectData.analysisResult.forEach(section => {
        presentation.slides.push({
            type: 'analysis',
            title: section.title,
            content: section.content,
            images: {
                urban: section.imageUrls.urban,
                site: section.imageUrls.site
            }
        });
    });

    // Slide 8: Quantitative Data
    if (projectData.quantitativeData) {
        presentation.slides.push({
            type: 'metrics',
            title: 'Key Performance Metrics',
            metrics: {
                potentialVisitors: projectData.quantitativeData.potentialVisitors,
                greenSpaceRatio: projectData.quantitativeData.greenSpaceRatio,
                publicTransportAccess: projectData.quantitativeData.publicTransportAccess,
                averageIncome: projectData.quantitativeData.averageIncome
            }
        });
    }

    // Slide 9: Alternatives Comparison (if available)
    if (projectData.alternatives && projectData.alternatives.length > 0) {
        presentation.slides.push({
            type: 'comparison',
            title: 'Design Alternatives Comparison',
            alternatives: projectData.alternatives.map(alt => ({
                name: alt.name,
                cost: alt.costEstimate?.totalCost,
                description: alt.description
            }))
        });
    }

    // Create a JSON representation that could be converted to PPTX
    const jsonString = JSON.stringify(presentation, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'urbaneyes-presentation-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Show user instructions
    alert('PowerPoint data exported! \n\nNote: This is a JSON export of your presentation data. For full PowerPoint functionality, you can:\n1. Use this data with a PPTX converter tool\n2. Manually create slides using this structured data\n3. Upload to presentation software that accepts JSON input');
};

/**
 * Alternative: Create a simple HTML presentation that can be saved as PDF
 */
export const generateHtmlPresentation = (projectData: ProjectData): string => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>UrbanEyes Analysis - ${projectData.quantitativeData?.location?.name || 'Report'}</title>
    <style>
        @page { size: 1024px 768px; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .slide {
            width: 1024px;
            height: 768px;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            padding: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .slide.content { background: white; color: #333; }
        .slide-title { font-size: 48px; font-weight: bold; color: white; margin-bottom: 20px; }
        .slide.content .slide-title { color: #333; border-bottom: 4px solid #667eea; padding-bottom: 20px; }
        .slide-subtitle { font-size: 32px; color: rgba(255,255,255,0.9); }
        .slide-content { font-size: 24px; line-height: 1.6; flex: 1; }
        .slide.content .slide-content { color: #555; }
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
        .metric-card { background: #f8f9fa; padding: 30px; border-radius: 10px; border-left: 5px solid #667eea; }
        .metric-label { font-size: 18px; color: #666; margin-bottom: 10px; }
        .metric-value { font-size: 36px; font-weight: bold; color: #333; }
        .image-container { margin: 20px 0; max-height: 400px; }
        .image-container img { max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        ul { margin-left: 30px; margin-top: 20px; }
        li { margin-bottom: 15px; }
        .cost-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 18px; }
        .cost-table th, .cost-table td { text-align: left; padding: 12px 15px; border-bottom: 1px solid #eee; }
        .cost-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
        .cost-table tr:last-child td { border-bottom: none; }
        .cost-table td:last-child { text-align: right; font-weight: 600; font-family: monospace; }
    </style>
</head>
<body>
    <!-- Title Slide -->
    <div class="slide">
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <div class="slide-title">UrbanEyes Analysis Report</div>
            <div class="slide-subtitle">${projectData.quantitativeData?.location?.name || 'Urban Site Analysis'}</div>
            <div style="margin-top: 40px; font-size: 20px; color: rgba(255,255,255,0.8);">
                ${new Date().toLocaleDateString()}
            </div>
        </div>
    </div>
    `;

    // Project Overview Slide
    if (projectData.location) {
        html += `
    <div class="slide content">
        <div class="slide-title">Project Overview</div>
        <div class="slide-content">
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Location</div>
                    <div class="metric-value" style="font-size: 24px;">${projectData.location.name}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Site Area</div>
                    <div class="metric-value">${projectData.location.area ? `${projectData.location.area.toFixed(0)} m²` : 'N/A'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Latitude</div>
                    <div class="metric-value">${projectData.location.latitude.toFixed(4)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Longitude</div>
                    <div class="metric-value">${projectData.location.longitude.toFixed(4)}</div>
                </div>
            </div>
        </div>
    </div>
        `;
    }

    // Cost Summary Slide
    if (projectData.costEstimate) {
        html += `
    <div class="slide content">
        <div class="slide-title">Cost Estimate Summary</div>
        <div class="slide-content">
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Project Cost</div>
                    <div class="metric-value">${formatCurrency(projectData.costEstimate.totalCost)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Construction Cost</div>
                    <div class="metric-value">${formatCurrency(projectData.costEstimate.constructionCost)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Annual Maintenance</div>
                    <div class="metric-value">${formatCurrency(projectData.costEstimate.maintenanceYearlyCost)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Contingency</div>
                    <div class="metric-value">${projectData.costEstimate.contingency}%</div>
                </div>
            </div>
        </div>
    </div>
        `;
    }

    // Cost Breakdown Slide
    if (projectData.costEstimate) {
        const groupedItems: { [category: string]: number } = {};
        projectData.costEstimate.items.forEach(item => {
            if (!groupedItems[item.category]) {
                groupedItems[item.category] = 0;
            }
            groupedItems[item.category] += item.totalCost;
        });

        html += `
    <div class="slide content">
        <div class="slide-title">Cost Breakdown by Category</div>
        <div class="slide-content">
            <table class="cost-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Estimated Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(groupedItems).map(([category, total]) => `
                        <tr>
                            <td>${category}</td>
                            <td>${formatCurrency(total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
        `;
    }

    // Analysis Section Slides
    projectData.analysisResult.forEach(section => {
        html += `
    <div class="slide content">
        <div class="slide-title">${section.title}</div>
        <div class="slide-content">
            ${section.imageUrls.site ? `
                <div class="image-container">
                    <img src="${section.imageUrls.site}" alt="${section.title}">
                </div>
            ` : ''}
            <div style="font-size: 18px; margin-top: 20px;">
                ${section.content.split('\n').slice(0, 6).map(line => 
                    line.trim() ? `<p style="margin-bottom: 10px;">${line.replace(/\*\*/g, '').replace(/\*/g, '•')}</p>` : ''
                ).join('')}
            </div>
        </div>
    </div>
        `;
    });

    // Metrics Slide
    if (projectData.quantitativeData) {
        html += `
    <div class="slide content">
        <div class="slide-title">Key Performance Metrics</div>
        <div class="slide-content">
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Potential Daily Visitors</div>
                    <div class="metric-value">${projectData.quantitativeData.potentialVisitors.toLocaleString()}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Green Space Ratio</div>
                    <div class="metric-value">${projectData.quantitativeData.greenSpaceRatio}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Public Transport Access</div>
                    <div class="metric-value" style="font-size: 28px;">${projectData.quantitativeData.publicTransportAccess}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Average Income Level</div>
                    <div class="metric-value" style="font-size: 28px;">${projectData.quantitativeData.averageIncome}</div>
                </div>
            </div>
        </div>
    </div>
        `;
    }

    html += `
</body>
</html>
    `;

    return html;
};

export const downloadHtmlPresentation = (projectData: ProjectData) => {
    const html = generateHtmlPresentation(projectData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'urbaneyes-presentation.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};