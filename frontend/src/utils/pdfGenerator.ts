import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { ProjectData } from '../types';
import { formatCurrency as formatCurrencyUtil, getCurrencyFromLocation } from './currencyUtils';

const addTextWithWrap = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * lineHeight;
};

// Enhanced helper to add section headers with gradient background
const addSectionHeader = (doc: jsPDF, title: string, yPos: number, pageWidth: number, margin: number) => {
    doc.setFillColor(13, 148, 136); // Teal gradient
    doc.rect(margin - 5, yPos - 7, pageWidth - (margin * 2) + 10, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'normal');
    return yPos + 15;
};

// Add page number footer
const addPageFooter = (doc: jsPDF, pageNum: number, projectName: string) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${projectName} | UrbanEyes Report`, 15, pageHeight - 10);
    doc.text(`Page ${pageNum}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
};

/**
 * Generate the legacy (basic) PDF report. (Kept for backward compatibility.)
 */
export const generatePdfReport = async (projectData: ProjectData, quantAnalysisElement: HTMLElement | null): Promise<void> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    const currencyInfo = getCurrencyFromLocation(projectData.location?.name || '');

    // --- Title Page ---
    doc.setFillColor(210, 240, 225); // Pastel green
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(6, 78, 59); // Dark green
    doc.setFontSize(32);
    doc.text('UrbanEyes Analysis Report', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    doc.setFontSize(20);
    doc.text(projectData.location?.name || 'Site Analysis', pageWidth / 2, pageHeight / 2, { align: 'center' });
    doc.setFontSize(12);
    doc.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
    doc.addPage();
    yPos = margin;

    // --- Overview ---
    doc.setTextColor(6, 78, 59);
    doc.setFontSize(22);
    doc.text('1. Project Overview', margin, yPos);
    yPos += 10;

    if (projectData.location) {
        doc.setFontSize(12);
        const overviewData = [
            ['Location Name', projectData.location.name],
            ['Coordinates', `${projectData.location.latitude.toFixed(4)}, ${projectData.location.longitude.toFixed(4)}`],
            ['Site Area (m²)', projectData.location.area ? projectData.location.area.toFixed(1) : 'N/A'],
        ];
        autoTable(doc, {
            startY: yPos,
            head: [['Metric', 'Value']],
            body: overviewData,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] }, // theme green
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- Quantitative Analysis ---
    if (quantAnalysisElement) {
        doc.setFontSize(22);
        doc.text('2. Quantitative Insights', margin, yPos);
        yPos += 10;

        try {
            const canvas = await html2canvas(quantAnalysisElement, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const imgWidth = contentWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            if (yPos + imgHeight > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
            }

            doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 15;
        } catch (e) {
            console.error("Error capturing quantitative analysis element:", e);
            doc.setFontSize(10);
            doc.setTextColor(255, 0, 0);
            doc.text("Could not generate image of quantitative analysis.", margin, yPos);
            doc.setTextColor(6, 78, 59);
            yPos += 10;
        }
    }

    // --- Analysis Sections ---
    if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
    }
    doc.setFontSize(22);
    doc.text('3. Detailed Analysis', margin, yPos);
    yPos += 15;

    for (const section of projectData.analysisResult) {
        if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = margin;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(5, 150, 105);
        doc.text(section.title, margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(6, 78, 59);
        const contentHeight = addTextWithWrap(doc, section.content.replace(/\* /g, '• ').replace(/\*\*/g, ''), margin, yPos, contentWidth, 5);
        yPos += contentHeight + 10;

        const imageUrl = section.imageUrls.site || section.imageUrls.urban;
        if (imageUrl) {
             try {
                const imgWidth = contentWidth * 0.7;
                const imgHeight = imgWidth * (9/16);
                
                if (yPos + imgHeight > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                
                doc.addImage(imageUrl, 'JPEG', margin + (contentWidth - imgWidth) / 2, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 15;
            } catch (e) {
                console.error("Failed to add image to PDF:", e);
                 doc.setFontSize(10);
                 doc.setTextColor(255, 0, 0);
                 doc.text("Could not add visual analysis image.", margin, yPos);
                 doc.setTextColor(6, 78, 59);
                 yPos += 10;
            }
        }
    }
    
    // --- Cost Estimate ---
    if (projectData.costEstimate) {
         if (yPos > pageHeight - 70) {
            doc.addPage();
            yPos = margin;
        }
        doc.setFontSize(22);
        doc.text('4. Cost Estimate', margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        const costSummary = [
            ['Total Project Cost', `${formatCurrencyUtil(projectData.costEstimate.totalCost, currencyInfo)}`],
            ['Construction Cost', `${formatCurrencyUtil(projectData.costEstimate.constructionCost, currencyInfo)}`],
            ['Annual Maintenance', `${formatCurrencyUtil(projectData.costEstimate.maintenanceYearlyCost, currencyInfo)}`],
            ['Contingency', `${projectData.costEstimate.contingency}%`]
        ];
        autoTable(doc, {
            startY: yPos,
            head: [['Cost Metric', 'Value']],
            body: costSummary,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;

        const costItems = projectData.costEstimate.items.map(item => [
            item.category,
            item.item,
            `${item.quantity.toFixed(1)} ${item.unit}`,
            `${formatCurrencyUtil(item.unitCost, currencyInfo)}`,
            `${formatCurrencyUtil(item.totalCost, currencyInfo)}`
        ]);
        
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = margin;
        }
        autoTable(doc, {
            startY: yPos,
            head: [['Category', 'Item', 'Quantity', 'Unit Cost', 'Total']],
            body: costItems,
            theme: 'striped',
            headStyles: { fillColor: [6, 78, 59] },
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- Design Alternatives ---
    if (projectData.alternatives && projectData.alternatives.length > 0) {
        doc.addPage();
        yPos = margin;
        doc.setFontSize(22);
        doc.text('5. Design Alternatives', margin, yPos);
        yPos += 15;

        for (const alt of projectData.alternatives) {
            if (yPos > pageHeight - 80) { // Check for page break before starting an alternative
                doc.addPage();
                yPos = margin;
            }

            doc.setFontSize(18);
            doc.setTextColor(4, 120, 87); // mid-green
            doc.text(alt.name, margin, yPos);
            yPos += 7;
            
            doc.setFontSize(10);
            doc.setTextColor(6, 78, 59);
            const descHeight = addTextWithWrap(doc, alt.description, margin, yPos, contentWidth, 5);
            yPos += descHeight + 10;
            
            const designSection = alt.analysisResult.find(s => s.title === 'Strategic Generative Recommendations');
            const imageUrl = designSection?.imageUrls.site;
            if (imageUrl) {
                 try {
                    const imgWidth = contentWidth * 0.8;
                    const imgHeight = imgWidth * (9/16);
                    if (yPos + imgHeight > pageHeight - margin) {
                        doc.addPage();
                        yPos = margin;
                    }
                    doc.addImage(imageUrl, 'JPEG', margin + (contentWidth - imgWidth) / 2, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                } catch (e) { 
                    console.error("Failed to add alt image to PDF:", e); 
                    doc.text("Could not add visual for this alternative.", margin, yPos);
                    yPos += 10;
                }
            }

            if (alt.costEstimate) {
                 const costSummary = [
                    ['Total Project Cost', `${formatCurrencyUtil(alt.costEstimate.totalCost, currencyInfo)}`],
                    ['Construction Cost', `${formatCurrencyUtil(alt.costEstimate.constructionCost, currencyInfo)}`],
                    ['Annual Maintenance', `${formatCurrencyUtil(alt.costEstimate.maintenanceYearlyCost, currencyInfo)}`],
                ];
                autoTable(doc, {
                    startY: yPos,
                    head: [[`${alt.name} - Cost Summary`, '']],
                    body: costSummary,
                    theme: 'striped',
                    headStyles: { fillColor: [6, 95, 70] },
                });
                yPos = (doc as any).lastAutoTable.finalY + 15;
            }
        }
    }


    doc.save(`UrbanEyes-Report-${projectData.location?.name.replace(/ /g, '_') || 'Site'}.pdf`);
};

export const generateDashboardPdf = async (dashboardElement: HTMLElement, projectName: string): Promise<void> => {
    try {
        const canvas = await html2canvas(dashboardElement, {
            useCORS: true,
            scale: 2, // Higher resolution capture
            backgroundColor: '#f8fafc', // App background color
            width: dashboardElement.scrollWidth,
            height: dashboardElement.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();

        const ratio = imgWidth / imgHeight;
        
        // Calculate the total height of the image when scaled to the PDF's width
        const scaledImgHeight = pdfWidth / ratio;

        let heightLeft = scaledImgHeight;
        let position = 0;

        // Add the first page
        doc.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
        heightLeft -= pdfHeight;

        // Add more pages if the content is taller than one page
        while (heightLeft > 0) {
            position -= pdfHeight; // Move the image "up" on the new page to show the next part
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
            heightLeft -= pdfHeight;
        }

        doc.save(`UrbanEyes-Dashboard-${projectName.replace(/ /g, '_')}.pdf`);
    } catch (e) {
        console.error("Error generating dashboard PDF:", e);
        alert("Sorry, there was an error creating the PDF. Please try again.");
    }
};


/**
 * NEW Comprehensive report generator including:
 * 1. Title & Project Overview
 * 2. All Analysis Sections (text + all available images)
 * 3. Quantitative Data (tabulated)
 * 4. Conceptual Plan (2D snapshot + optional 3D view snapshot)
 * 5. Area Statement (derived from conceptual plan shapes)
 * 6. Cost Estimation (detailed)
 * 7. Design Alternatives (if any)
 * 8. Conclusion (auto-generated synthesis)
 */
export interface ComprehensiveElements {
    quantElement?: HTMLElement | null;
    conceptual2DElement?: HTMLElement | null; // e.g. the 2D plan canvas/container
    conceptual3DElement?: HTMLElement | null; // e.g. Three.js viewer canvas/container
}

export const generateComprehensivePdf = async (projectData: ProjectData, elements: ComprehensiveElements = {}): Promise<void> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    let pageNum = 1;
    const projectName = projectData.name || projectData.location?.name || 'Project';
    const reportCurrency = getCurrencyFromLocation(projectData.location?.name || '');

    const ensureSpace = (needed: number) => {
        if (yPos + needed > pageHeight - margin) {
            addPageFooter(doc, pageNum++, projectName);
            doc.addPage();
            yPos = margin;
        }
    };

    // Title Page
    doc.setFillColor(240, 253, 250); // teal-50
    doc.rect(0,0,pageWidth,pageHeight,'F');
    doc.setTextColor(13,148,136); // teal-600
    doc.setFont('helvetica','bold');
    doc.setFontSize(30);
    doc.text(projectName, pageWidth/2, pageHeight/2 - 25, {align:'center'});
    doc.setFontSize(16);
    doc.text('Comprehensive UrbanEyes Documentation', pageWidth/2, pageHeight/2, {align:'center'});
    doc.setFontSize(11);
    doc.setFont('helvetica','normal');
    doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth/2, pageHeight/2 + 10, {align:'center'});
    addPageFooter(doc, pageNum++, projectName);
    doc.addPage();
    yPos = margin;

    // 1. Project Overview
    yPos = addSectionHeader(doc, '1. Project Overview', yPos, pageWidth, margin);
    doc.setFontSize(11);
    doc.setTextColor(30,41,59);
    const overviewRows: string[][] = [];
    if (projectData.location) {
        overviewRows.push(['Location', projectData.location.name]);
        overviewRows.push(['Coordinates', `${projectData.location.latitude.toFixed(4)}, ${projectData.location.longitude.toFixed(4)}`]);
        if (projectData.location.area) overviewRows.push(['Site Area (m²)', projectData.location.area.toFixed(1)]);
    }
    if (projectData.conceptualPlan?.shapes) {
        overviewRows.push(['Conceptual Plan Shapes', projectData.conceptualPlan.shapes.length.toString()]);
    }
    if (projectData.costEstimate) {
        overviewRows.push(['Total Cost', formatCurrencyUtil(projectData.costEstimate.totalCost, reportCurrency)]);
    }
    if (overviewRows.length) {
        autoTable(doc, { startY: yPos, head: [['Metric','Value']], body: overviewRows, theme: 'grid', headStyles:{fillColor:[13,148,136]}, styles:{fontSize:9} });
        yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // 2. Analysis Sections (text + images)
    yPos = addSectionHeader(doc, '2. Analysis', yPos, pageWidth, margin);
    for (const section of projectData.analysisResult) {
        ensureSpace(25);
        doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(15,118,110); // teal-700
        doc.text(section.title, margin, yPos); yPos += 6;
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59);
        const cleaned = section.content.replace(/\* /g,'• ').replace(/\*\*|__/g,'').trim();
        const textHeight = addTextWithWrap(doc, cleaned, margin, yPos, contentWidth, 4.2); yPos += textHeight + 4;
        // Add all available images in section.imageUrls
        const imageKeys = Object.keys(section.imageUrls || {}).filter(k => (section.imageUrls as any)[k]);
        for (const key of imageKeys) {
            const url = (section.imageUrls as any)[key];
            if (!url) continue;
            try {
                ensureSpace(70);
                const imgW = contentWidth * 0.6;
                const imgH = imgW * 0.56; // approximate 16:9 crop
                doc.setFontSize(8); doc.setTextColor(100); doc.text(`Visual (${key})`, margin, yPos);
                doc.addImage(url, 'JPEG', margin + (contentWidth - imgW)/2, yPos + 2, imgW, imgH);
                yPos += imgH + 10;
            } catch(err){
                doc.setFontSize(8); doc.setTextColor(200,30,30); doc.text(`Could not embed image (${key}).`, margin, yPos); yPos += 5; doc.setTextColor(30,41,59);
            }
        }
    }

    // 3. Quantitative Data
    yPos = addSectionHeader(doc, '3. Quantitative Data', yPos, pageWidth, margin);
    const q = projectData.quantitativeData;
    if (q) {
        const addSimpleTable = (title: string, rows: string[][]) => {
            if (!rows.length) return;
            ensureSpace(20 + rows.length*5);
            doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(15,118,110); doc.text(title, margin, yPos); yPos += 5;
            autoTable(doc,{startY:yPos,head:[['Metric','Value']],body:rows,theme:'striped',headStyles:{fillColor:[13,148,136]},styles:{fontSize:8}});
            yPos = (doc as any).lastAutoTable.finalY + 6;
        };
        // Demographics
        if (q.ageDemographics?.length) addSimpleTable('Age Demographics', q.ageDemographics.map(d=>[d.ageRange, d.percentage + '%']));
        if (q.landUse?.length) addSimpleTable('Land Use', q.landUse.map(l=>[l.type, l.percentage + '%']));
        const basicMetrics: string[][] = [];
        if (q.greenSpaceRatio != null) basicMetrics.push(['Green Space Ratio (%)', q.greenSpaceRatio.toString()]);
        if (q.walkabilityScore != null) basicMetrics.push(['Walkability Score', q.walkabilityScore.toString()]);
        if (q.noiseLevel) basicMetrics.push(['Noise Level', q.noiseLevel]);
        if (q.floodRisk) basicMetrics.push(['Flood Risk', q.floodRisk]);
        if (q.nearbyPOIs != null) basicMetrics.push(['Nearby Points of Interest', q.nearbyPOIs.toString()]);
        if (basicMetrics.length) addSimpleTable('Core Environment Metrics', basicMetrics);
        if (q.monthlyTemperatures?.length) addSimpleTable('Monthly Temperatures (°C)', q.monthlyTemperatures.map(m=>[m.month, m.temp.toString()]));
        if (q.monthlyRainfall?.length) addSimpleTable('Monthly Rainfall (mm)', q.monthlyRainfall.map(r=>[r.month, r.rainfall.toString()]));
        if (q.employmentSectorSplit?.length) addSimpleTable('Employment Sector Split', q.employmentSectorSplit.map(s=>[s.sector, s.percentage + '%']));
    } else {
        doc.setFontSize(10); doc.text('No quantitative data available.', margin, yPos); yPos += 6;
    }

    // Optional embedded screenshot of quantitative UI element
    if (elements.quantElement) {
        try {
            const canvas = await html2canvas(elements.quantElement, {useCORS:true, scale:2, backgroundColor:'#ffffff'});
            const imgData = canvas.toDataURL('image/png');
            const imgW = contentWidth; const imgH = (canvas.height * imgW)/canvas.width;
            ensureSpace(imgH + 10);
            doc.addImage(imgData,'PNG',margin,yPos,imgW,imgH); yPos += imgH + 8;
        } catch(err) {
            doc.setFontSize(8); doc.setTextColor(200,30,30); doc.text('Could not embed quantitative panel screenshot.', margin, yPos); yPos += 5; doc.setTextColor(30,41,59);
        }
    }

    // 4. Conceptual Plan
    yPos = addSectionHeader(doc,'4. Conceptual Plan', yPos, pageWidth, margin);
    if (projectData.conceptualPlan?.shapes?.length) {
        doc.setFontSize(10); doc.text(`Total Shapes: ${projectData.conceptualPlan.shapes.length}`, margin, yPos); yPos += 5;
        // 2D snapshot
        if (elements.conceptual2DElement) {
            try {
                const canvas2d = await html2canvas(elements.conceptual2DElement, {useCORS:true, scale:2, backgroundColor:'#ffffff'});
                const imgData = canvas2d.toDataURL('image/png');
                const imgW = contentWidth * 0.9; const imgH = (canvas2d.height * imgW)/canvas2d.width;
                ensureSpace(imgH + 8);
                doc.setFontSize(8); doc.text('2D Plan View', margin, yPos); yPos += 3;
                doc.addImage(imgData,'PNG', margin + (contentWidth - imgW)/2, yPos, imgW, imgH); yPos += imgH + 6;
            } catch(err){ doc.setFontSize(8); doc.setTextColor(200,30,30); doc.text('Could not embed 2D plan view.', margin, yPos); yPos += 5; doc.setTextColor(30,41,59);}        
        } else if (projectData.conceptualPlan?.previewImage) {
            // Fallback: use saved preview image
            try {
                const imgW = contentWidth * 0.9; const imgH = imgW * 0.6;
                ensureSpace(imgH + 8);
                doc.setFontSize(8); doc.text('2D Plan View (Preview)', margin, yPos); yPos += 3;
                doc.addImage(projectData.conceptualPlan.previewImage, 'PNG', margin + (contentWidth - imgW)/2, yPos, imgW, imgH); yPos += imgH + 6;
            } catch { /* ignore */ }
        }
        // 3D snapshot
        if (elements.conceptual3DElement) {
            try {
                const canvas3d = await html2canvas(elements.conceptual3DElement, {useCORS:true, scale:2, backgroundColor:'#ffffff'});
                const imgData = canvas3d.toDataURL('image/png');
                const imgW = contentWidth * 0.9; const imgH = (canvas3d.height * imgW)/canvas3d.width;
                ensureSpace(imgH + 8);
                doc.setFontSize(8); doc.text('3D Massing Snapshot', margin, yPos); yPos += 3;
                doc.addImage(imgData,'PNG', margin + (contentWidth - imgW)/2, yPos, imgW, imgH); yPos += imgH + 6;
            } catch(err){ doc.setFontSize(8); doc.setTextColor(200,30,30); doc.text('Could not embed 3D view.', margin, yPos); yPos += 5; doc.setTextColor(30,41,59);}        
        }
    } else {
        doc.setFontSize(10); doc.text('No conceptual plan data available.', margin, yPos); yPos += 6;
    }

    // 5. Area Statement (derived)
    yPos = addSectionHeader(doc,'5. Area Statement', yPos, pageWidth, margin);
    if (projectData.conceptualPlan?.shapes?.length) {
        const areaByCategory: {[cat:string]: number} = {};
        const toArea = (shape:any): number => {
            if (shape.type === 'rect') return shape.width * shape.height;
            if (shape.type === 'circle') { const r = shape.width/2; return Math.PI * r * r; }
            if (shape.type === 'polygon' && shape.points?.length) {
                // Shoelace
                let area = 0; const pts = shape.points; for (let i=0;i<pts.length;i++){ const j=(i+1)%pts.length; area += pts[i].x*pts[j].y - pts[j].x*pts[i].y; } return Math.abs(area/2);
            }
            return 0;
        };
        for (const s of projectData.conceptualPlan.shapes) {
            const a = toArea(s);
            areaByCategory[s.category] = (areaByCategory[s.category]||0)+a;
        }
        const rows = Object.entries(areaByCategory).map(([cat,val])=>[cat, val.toFixed(2)+' m²']);
        autoTable(doc,{startY:yPos, head:[['Category','Area']], body:rows, theme:'grid', headStyles:{fillColor:[13,148,136]}, styles:{fontSize:8}});
        yPos = (doc as any).lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(10); doc.text('No shapes to compute area statement.', margin, yPos); yPos += 6;
    }

    // 6. Cost Estimation (detailed)
    yPos = addSectionHeader(doc,'6. Cost Estimation', yPos, pageWidth, margin);
    if (projectData.costEstimate) {
        const ce = projectData.costEstimate;
        const summaryRows = [
            ['Subtotal', formatCurrencyUtil(ce.subtotal, reportCurrency)],
            ['Contingency (%)', ce.contingency.toString()],
            ['Total Cost', formatCurrencyUtil(ce.totalCost, reportCurrency)],
            ['Maintenance / Year', formatCurrencyUtil(ce.maintenanceYearlyCost, reportCurrency)],
        ];
        autoTable(doc,{startY:yPos, head:[['Metric','Value']], body:summaryRows, theme:'grid', headStyles:{fillColor:[13,148,136]}, styles:{fontSize:8}});
        yPos = (doc as any).lastAutoTable.finalY + 6;
        ensureSpace(20 + ce.items.length*5);
    autoTable(doc,{startY:yPos, head:[['Category','Item','Qty','Unit','Unit Cost','Total']], body:ce.items.map(it=>[it.category,it.item,it.quantity.toFixed(1),it.unit,formatCurrencyUtil(it.unitCost, reportCurrency),formatCurrencyUtil(it.totalCost, reportCurrency)]), theme:'striped', headStyles:{fillColor:[15,118,110]}, styles:{fontSize:7}});
        yPos = (doc as any).lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(10); doc.text('No cost estimate available.', margin, yPos); yPos += 6;
    }

    // 7. Design Alternatives (summary)
    yPos = addSectionHeader(doc,'7. Design Alternatives', yPos, pageWidth, margin);
    if (projectData.alternatives?.length) {
        for (const alt of projectData.alternatives) {
            ensureSpace(30);
            doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(4,120,87); doc.text(alt.name, margin, yPos); yPos += 5;
            doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59);
            const h = addTextWithWrap(doc, alt.description, margin, yPos, contentWidth, 4); yPos += h + 3;
            if (alt.costEstimate) {
                autoTable(doc,{startY:yPos,head:[[alt.name+' Cost','Value']], body:[['Total', formatCurrencyUtil(alt.costEstimate.totalCost, reportCurrency)], ['Construction', formatCurrencyUtil(alt.costEstimate.constructionCost, reportCurrency)]], theme:'grid', headStyles:{fillColor:[13,148,136]}, styles:{fontSize:7}});
                yPos = (doc as any).lastAutoTable.finalY + 6;
            }
        }
    } else { doc.setFontSize(10); doc.text('No design alternatives generated.', margin, yPos); yPos += 6; }

    // 8. Conclusion (auto-generated)
    yPos = addSectionHeader(doc,'8. Conclusion', yPos, pageWidth, margin);
    const conclusionParts: string[] = [];
    conclusionParts.push(`This report consolidates spatial analysis, quantitative metrics, conceptual planning, and economic evaluation for ${projectName}.`);
    if (projectData.analysisResult.length) conclusionParts.push(`A total of ${projectData.analysisResult.length} analytical sections were reviewed, informing strategic directions.`);
    if (projectData.conceptualPlan?.shapes?.length) conclusionParts.push(`Conceptual planning defined ${projectData.conceptualPlan.shapes.length} spatial elements across ${Object.keys((projectData.conceptualPlan.shapes||[]).reduce((a:any,s:any)=>{a[s.category]=(a[s.category]||0)+1;return a;},{})).length} categories.`);
    if (projectData.costEstimate) conclusionParts.push(`Financial modeling estimates a total implementation cost of ${formatCurrencyUtil(projectData.costEstimate.totalCost, reportCurrency)} with annual maintenance of ${formatCurrencyUtil(projectData.costEstimate.maintenanceYearlyCost, reportCurrency)}.`);
    if (projectData.alternatives?.length) conclusionParts.push(`There are ${projectData.alternatives.length} design alternatives available for further comparison and refinement.`);
    conclusionParts.push('Next steps may include stakeholder review, refinement of massing, phasing strategy, and integration of environmental performance simulations.');
    const conclusionText = conclusionParts.join(' ');
    doc.setFontSize(10); addTextWithWrap(doc, conclusionText, margin, yPos, contentWidth, 4.2);

    // Final footer
    addPageFooter(doc, pageNum, projectName);
    doc.save(`UrbanEyes-Comprehensive-${projectName.replace(/ /g,'_')}.pdf`);
};