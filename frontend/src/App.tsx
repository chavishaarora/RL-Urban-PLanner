import React, { useState, useRef, useContext, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Navbar } from './components/Navbar';
import { SiteSelector } from './components/SiteSelector';
import { ProjectData, Message, LocationData, DesignAlternative, DesignTemplate, HousingOptionsData, AnalysisSectionData, ConceptualPlan, PlanShape, CostEstimate } from './types';
import { analyzeSiteWithMaps, generateAICostEstimate } from './services/geminiService-1';
import { Spinner } from './components/Spinner';
import { AnalysisSection } from './components/AnalysisSection';
import { QuantitativeAnalysis } from './components/QuantitativeAnalysis';
import { QuantitativeSiteAnalysis } from './components/QuantitativeSiteAnalysis';
import { AuthContext } from './contexts/AuthContext';
import { generatePdfReport, generateDashboardPdf, generateComprehensivePdf } from './utils/pdfGenerator';
import { downloadHtmlPresentation } from './utils/pptGenerator';
import { downloadProjectAsJson, importProjectFromFile, validateImportedProject } from './utils/fileUtils';
import { Chatbot } from './components/Chatbot';
import { ProgressBar } from './components/ProgressBar';
import { LoginScreen } from './components/LoginScreen';
import { ProjectDashboard } from './components/ProjectDashboard';
import { TemplateSelector } from './components/TemplateSelector';
import { CostEstimator } from './components/CostEstimator';
import { ComparisonView } from './components/ComparisonView';
import { ChevronDownIcon, LayoutIcon, HomeIcon, MapPinIcon, CubeIcon, DocumentStatsIcon, DashboardIcon, AnalyzeIcon } from './components/Icons';
import PageHeader from './components/PageHeader';
import { HousingOptions } from './components/HousingOptions';
import { getAllCategories } from './data/designTemplates';
import { CustomSelect } from './components/CustomSelect';
import { ConceptualPlanner } from './components/ConceptualPlanner';
import { PlannerDashboardCard } from './components/planner/PlannerDashboardCard';
import { ProfilePage } from './components/ProfilePage';
import { ProjectSelectionModal } from './components/ProjectSelectionModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ProjectNameModal } from './components/ProjectNameModal';
import { ContextMapsView } from './components/ContextMapsView';


declare const google: any;

const languageOptions = [
    { value: 'English', label: 'English' },
    { value: 'Hindi', label: 'Hindi' },
    { value: 'Spanish', label: 'Spanish' },
    { value: 'Dutch', label: 'Dutch' },
];

const projectTypeOptions = getAllCategories().map(cat => ({
    value: cat,
    label: cat.replace(/([A-Z])/g, ' $1').trim()
}));

const App: React.FC = () => {
    const { user, logout } = useContext(AuthContext);
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isProjectNameModalOpen, setIsProjectNameModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplate | null>(null);
    const [analysisLanguage, setAnalysisLanguage] = useState('English');
    const [projectType, setProjectType] = useState(projectTypeOptions[0]?.value || 'Recreation');
    const [currentView, setCurrentView] = useState<'analysis' | 'dashboard' | 'planner' | 'profile' | 'quantitative' | 'maps'>('analysis');
    const [showPois, setShowPois] = useState(false);
    
    const userProjectsKey = user ? `urban-eyes-projects-${user.id}` : null;
    const [userProjects, setUserProjects] = useLocalStorage<ProjectData[]>(userProjectsKey, []);

    const [housingOptions, setHousingOptions] = useState<HousingOptionsData>({
        unitMix: "A mix of 2BHK and 3BHK units",
        incomeGroup: "Middle-Income Group (MIG)",
        maxFloors: 8,
    });

    const quantitativeAnalysisRef = useRef<HTMLDivElement>(null);
    const dashboardRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any | null>(null);

    const analysisResult = projectData?.analysisResult || [];
    const quantitativeData = projectData?.quantitativeData || null;
    const chatHistory = projectData?.chatHistory || [];
    const alternatives = projectData?.alternatives || [];
    const currentAlternativeId = projectData?.currentAlternativeId;
    const costEstimate = projectData?.costEstimate || null;

    const currentAlternative = currentAlternativeId
        ? alternatives.find(a => a.id === currentAlternativeId)
        : null;

    const displayAnalysis = currentAlternative?.analysisResult || analysisResult;
    const displayQuantData = currentAlternative?.quantitativeData || quantitativeData;
    const displayCostEstimate = currentAlternative?.costEstimate || costEstimate;

    const isAnalyzable = !!projectData?.location?.boundary;
    const hasAnalysis = analysisResult.length > 0;
    const hasAnyAnalysis = !!projectData && (hasAnalysis || (chatHistory && chatHistory.length > 1));
    const hasAlternatives = alternatives.length > 0;

    const handleShowProjectNameModal = () => {
        setIsProjectNameModalOpen(true);
    };

    const handleCreateNewProject = (projectName?: string) => {
        setProjectData({
            id: `temp-${Date.now()}`,
            name: projectName || 'Untitled Project',
            location: null,
            analysisResult: [],
            quantitativeData: null,
            chatHistory: [],
            alternatives: [],
            currentAlternativeId: null,
            costEstimate: null,
            conceptualPlan: null,
            conceptualCostEstimate: null,
            siteScreenshotBase64: null,
            dashboardDisplayImage: 'site',
        });
        setCurrentView('analysis');
        setIsProjectNameModalOpen(false);
    };

    const handleCloseProject = () => {
        if (window.confirm("Are you sure? This will close the project and return to the main dashboard.")) {
            setProjectData(null);
            setCurrentView('analysis'); // Reset view
        }
    };

    const handleLoadProject = (projectId: string) => {
        const projectToLoad = userProjects.find(p => p.id === projectId);
        if (projectToLoad) {
            setProjectData(projectToLoad);
            setCurrentView('dashboard');
            setIsProjectModalOpen(false);
        }
    };

    const handleImportProjectFile = async (file: File) => {
        try {
            const { project } = await importProjectFromFile(file);
            const errors = validateImportedProject(project);
            if (errors.length) {
                alert('Could not import project:\n' + errors.join('\n'));
                return;
            }
            const id = project.id && !userProjects.some(p => p.id === project.id)
                ? project.id
                : `proj-${Date.now()}`;
            const imported = { ...project, id, lastSaved: new Date().toISOString() } as ProjectData;
            setUserProjects([...userProjects, imported]);
            setProjectData(imported);
            setIsProjectModalOpen(false);
            setCurrentView('dashboard');
        } catch (e) {
            console.error(e);
            alert('Failed to import project. Please ensure you selected a valid UrbanEyes project file.');
        }
    };

    const handleDeleteProject = (projectId: string) => {
        if (window.confirm("Are you sure you want to permanently delete this project?")) {
            const updatedProjects = userProjects.filter(p => p.id !== projectId);
            setUserProjects(updatedProjects);
        }
    };
    
    const handleToggleView = () => {
        if (currentView === 'planner') {
            setCurrentView('dashboard');
            return;
        }
        if (currentView === 'profile') {
            setCurrentView('dashboard');
            return;
        }
        setCurrentView(v => (v === 'analysis' ? 'dashboard' : 'analysis'));
    };

    const handleOpenPlanner = () => {
        if (projectData && projectData.location) {
            setCurrentView('planner');
        } else {
            alert("Please define a site area on the map before opening the Concept Planner.");
        }
    };

    const handleSavePlan = (plan: ConceptualPlan) => {
        setProjectData(prev => prev ? { ...prev, conceptualPlan: plan } : null);
        alert("Conceptual plan saved!");
    };
    
    const handleUpdatePlan = (shapes: PlanShape[]) => {
        setProjectData(prev => {
            if (!prev) return null;
            const updatedPlan = {
                ...(prev.conceptualPlan || { shapes: [] }),
                shapes: shapes,
            };
            return { ...prev, conceptualPlan: updatedPlan };
        });
    };
    
    const handleConceptualCostUpdate = (estimate: CostEstimate | null) => {
        setProjectData(prev => prev ? { ...prev, conceptualCostEstimate: estimate } : null);
    };


    const handleSaveProject = () => {
        if (!projectData || !user) return;
        
        let projectToSave = { ...projectData };

        if (projectToSave.id.startsWith('temp-') || projectToSave.name === 'Untitled Project') {
            const newName = prompt("Please enter a name for this project:", projectToSave.name);
            if (!newName) return; // User cancelled
            projectToSave.name = newName;
            if(projectToSave.id.startsWith('temp-')) {
                projectToSave.id = `proj-${Date.now()}`;
            }
        }

        projectToSave.lastSaved = new Date().toISOString();
        
        const existingProjectIndex = userProjects.findIndex(p => p.id === projectToSave.id);
        
        if (existingProjectIndex > -1) {
            const updatedProjects = [...userProjects];
            updatedProjects[existingProjectIndex] = projectToSave;
            setUserProjects(updatedProjects);
        } else {
            setUserProjects([...userProjects, projectToSave]);
        }
        
        setProjectData(projectToSave); // Update state with new ID/name if it changed
        // Also download a portable .urbaneyes.json backup immediately
    // If file likely large, default to compression (user can cancel via confirm in util)
    downloadProjectAsJson(projectToSave, projectToSave.name, { compress: true, warnIfLargeMb: 5 });
        alert(`Project \"${projectToSave.name}\" saved locally and downloaded as JSON.`);
    };

    const handleLogout = () => logout();

    const handleLocationSelect = (location: LocationData | null) => {
        setProjectData(prev => ({
            ...prev!,
            location: location,
        }));
    };

    const handleTemplateSelect = (template: DesignTemplate) => {
        setSelectedTemplate(template);
    };

    const handleAnalyze = async (asAlternative: boolean = false) => {
        if (!projectData?.location?.boundary || !mapContainerRef.current || !map) return;

        setIsLoading(true);
        setError(null);
        setProgress(0);
        setCurrentView('analysis');

        const originalCenter = map.getCenter();
        const originalZoom = map.getZoom();

        setLoadingMessage("Capturing urban context view...");
        const urbanCanvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
        const urbanScreenshotBase64 = urbanCanvas.toDataURL('image/jpeg').split(',')[1];
        setProgress(5);

        setLoadingMessage("Capturing site detail view...");
        await new Promise<void>((resolve) => {
            const bounds = new google.maps.LatLngBounds();
            projectData.location!.boundary!.forEach(p => bounds.extend(p));
            map.fitBounds(bounds);
            google.maps.event.addListenerOnce(map, 'idle', () => setTimeout(resolve, 500));
        });
        const siteCanvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
        const siteScreenshotBase64 = siteCanvas.toDataURL('image/jpeg').split(',')[1];
        setProgress(10);
        
        // Save the site screenshot for later use
        setProjectData(prev => prev ? { ...prev, siteScreenshotBase64 } : null);

        map.setCenter(originalCenter);
        map.setZoom(originalZoom);

        setLoadingMessage("Initializing analysis...");

        if (!asAlternative) {
            setProjectData(prev => ({
                ...prev!,
                analysisResult: [],
                quantitativeData: null,
                chatHistory: [],
                costEstimate: null
            }));
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const userCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };

            try {
                const result = await analyzeSiteWithMaps(
                    projectData.location!,
                    urbanScreenshotBase64,
                    siteScreenshotBase64,
                    userCoords,
                    (message, progressPercentage) => {
                        setLoadingMessage(message);
                        // Scale progress to make room for cost estimation step
                        const scaledProgress = 10 + (progressPercentage / 100) * 80;
                        setProgress(scaledProgress);
                    },
                    projectType,
                    selectedTemplate,
                    analysisLanguage,
                    projectType === 'Housing' ? housingOptions : undefined
                );

                setLoadingMessage("Calculating average local cost estimation...");
                setProgress(90);

                const estimatedCost = await generateAICostEstimate(
                    projectData.location!,
                    projectType,
                    projectData.conceptualPlan || null,
                    selectedTemplate || undefined
                );


                setLoadingMessage("Analysis Complete!");
                setProgress(100);

                setTimeout(() => {
                    if (asAlternative) {
                        const alternativeNumber = (projectData.alternatives?.length || 0) + 1;
                        const baseProjectName = projectData.name.replace(/ \d+$/, ''); // Remove trailing numbers if any
                        const newAlternative: DesignAlternative = {
                            id: `alt-${Date.now()}`,
                            name: `${baseProjectName} ${alternativeNumber}`,
                            description: selectedTemplate?.name || 'Custom design',
                            analysisResult: result.analysisResult,
                            quantitativeData: result.quantitativeData,
                            costEstimate: estimatedCost,
                            createdAt: new Date().toISOString()
                        };

                        setProjectData(prev => ({
                            ...prev!,
                            alternatives: [...(prev!.alternatives || []), newAlternative],
                            currentAlternativeId: newAlternative.id
                        }));
                    } else {
                        setProjectData(prev => ({
                            ...prev!,
                            analysisResult: result.analysisResult,
                            quantitativeData: result.quantitativeData,
                            costEstimate: estimatedCost,
                            chatHistory: [{ role: 'model', text: 'Hello! I am the UrbanEyes AI assistant. Ask me anything about this site analysis.' }]
                        }));
                    }
                    setIsLoading(false);
                    setSelectedTemplate(null);
                }, 500);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                setError(`Failed to analyze site. ${errorMessage}`);
                setIsLoading(false);
                setProgress(0);
                setLoadingMessage('');
            }
        }, () => {
            setError("Could not get your location. Please enable location services in your browser.");
            setIsLoading(false);
        });
    };

    const handleChatUpdate = (messages: Message[]) => {
        setProjectData(prev => ({ ...prev!, chatHistory: messages }));
    };

    const handleDesignIteration = (newImageUrl: string) => {
        const updateAnalysisResults = (results: AnalysisSectionData[]): AnalysisSectionData[] => {
            return results.map(section => {
                if (section.title === 'Strategic Generative Recommendations') {
                    return {
                        ...section,
                        imageUrls: {
                            ...section.imageUrls,
                            site: newImageUrl,
                        }
                    };
                }
                return section;
            });
        };
    
        setProjectData(prev => {
            if (!prev) return null;
    
            if (prev.currentAlternativeId) {
                return {
                    ...prev,
                    alternatives: (prev.alternatives || []).map(alt =>
                        alt.id === prev.currentAlternativeId
                            ? { ...alt, analysisResult: updateAnalysisResults(alt.analysisResult) }
                            : alt
                    ),
                };
            }
    
            return {
                ...prev,
                analysisResult: updateAnalysisResults(prev.analysisResult),
            };
        });
    };

    const handleDownloadPDF = async () => {
        if (!projectData) return;
        setIsDownloading(true);
        try {
            if (currentView === 'dashboard' && dashboardRef.current) {
                await generateDashboardPdf(dashboardRef.current, projectData.name);
            } else {
                // Attempt to capture planner 2D / 3D views if in planner mode
                let conceptual3DElement: HTMLElement | null = null;
                if (currentView === 'planner') {
                    // Try to find a Three.js canvas (fallback first canvas)
                    const canvas = document.querySelector('main canvas');
                    if (canvas && canvas.parentElement) conceptual3DElement = canvas.parentElement as HTMLElement;
                }
                await generateComprehensivePdf(projectData, {
                    quantElement: quantitativeAnalysisRef.current,
                    conceptual2DElement: null, // fallback uses previewImage
                    conceptual3DElement: conceptual3DElement
                });
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPPT = () => {
        if (!projectData) return;
        downloadHtmlPresentation(projectData);
    };

    const handleSelectAlternative = (id: string | null) => {
        setProjectData(prev => ({ ...prev!, currentAlternativeId: id }));
    };

    const handleSetDashboardImage = (imageType: 'urban' | 'site' | 'street') => {
        setProjectData(prev => prev ? { ...prev, dashboardDisplayImage: imageType } : null);
    };

    const getAnalysisContext = () => {
        if (!hasAnalysis) return "No analysis has been performed yet.";
        let context = `Project: ${quantitativeData?.location?.name || 'Unnamed Site'}\n`;
        analysisResult.forEach(section => {
            context += `Section: ${section.title}\n${section.content}\n\n`;
        });
        if (costEstimate) {
            context += `\nTotal Project Cost: €${costEstimate.totalCost.toFixed(0)}\n`;
        }
        return context;
    };

    if (!user) return <LoginScreen />;

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800">
            <Navbar
                onSave={handleSaveProject}
                onExport={() => projectData && downloadProjectAsJson(projectData, projectData.name)}
                onCloseProject={handleCloseProject}
                onLogout={handleLogout}
                onDownload={handleDownloadPDF}
                onDownloadPPT={handleDownloadPPT}
                isDownloading={isDownloading}
                hasProject={!!projectData}
                hasAnalysis={hasAnyAnalysis}
                currentView={currentView}
                onToggleView={handleToggleView}
                onSetView={(view) => setCurrentView(view)}
                onShowProfile={() => setCurrentView('profile')}
            />

            <main className="container mx-auto px-4 py-8 md:px-8">
                {!projectData ? (
                    currentView === 'profile' ? (
                        <ProfilePage onBack={() => setCurrentView('analysis')} />
                    ) : (
                        <ProjectDashboard
                            user={user.name}
                            onCreateNew={handleShowProjectNameModal}
                            onLoadProject={() => setIsProjectModalOpen(true)}
                        />
                    )
                ) : (
                    <>
                    {currentView === 'maps' ? (
                        <ContextMapsView location={projectData.location} />
                    ) : currentView === 'planner' ? (
                        <ConceptualPlanner 
                            projectData={projectData}
                            onClose={() => setCurrentView('dashboard')}
                            onSave={handleSavePlan}
                            onUpdateShapes={handleUpdatePlan}
                            onCostUpdate={handleConceptualCostUpdate}
                            showPois={showPois}
                            onTogglePois={() => setShowPois(p => !p)}
                            proximityAnalysis={displayQuantData?.proximityAnalysis}
                        />
                    ) : currentView === 'analysis' ? (
                        <>
                            {/* Centered hero header in pill box */}
                            <PageHeader
                              className="mb-8"
                              title="Analyze Site"
                              subtitle={<span className="text-xs md:text-sm">Demarcate an urban space on the map to generate a comprehensive planning and design analysis.</span>}
                              icon={<AnalyzeIcon className="w-full h-full" />}
                            />

                            <div className="card p-6 space-y-6">
                                <SiteSelector
                                    onLocationSelect={handleLocationSelect}
                                    currentLocation={projectData.location}
                                    mapContainerRef={mapContainerRef}
                                    onMapLoad={setMap}
                                    hasAnalysis={hasAnalysis}
                                    showPois={showPois}
                                    onTogglePois={() => setShowPois(p => !p)}
                                    proximityPois={displayQuantData?.proximityAnalysis ?? null}
                                />

                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-4">Analysis Configuration</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1 ml-4">1. Project Type</label>
                                            <CustomSelect
                                                options={projectTypeOptions}
                                                value={projectType}
                                                onChange={(val) => {
                                                    setProjectType(val);
                                                    setSelectedTemplate(null);
                                                }}
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1 ml-4">2. Design Template</label>
                                            <button
                                                onClick={() => setIsTemplateOpen(true)}
                                                disabled={isLoading}
                                                className="form-input flex justify-between items-center"
                                            >
                                                <span className="truncate">{selectedTemplate ? selectedTemplate.name : 'Select a Template...'}</span>
                                                <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1 ml-4">3. Analysis Language</label>
                                            <CustomSelect
                                                options={languageOptions}
                                                value={analysisLanguage}
                                                onChange={setAnalysisLanguage}
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {projectType === 'Housing' && (
                                    <HousingOptions options={housingOptions} onChange={setHousingOptions} disabled={isLoading} />
                                )}

                                <div className="mt-4 border-t border-slate-200 pt-6">
                                    <button
                                        onClick={() => handleAnalyze(hasAnalysis)}
                                        disabled={!isAnalyzable || isLoading}
                                        className="w-full btn btn-primary btn-large"
                                    >
                                        {isLoading ? <Spinner /> : (hasAnalysis ? "Generate New Alternative" : "Analyze Site")}
                                    </button>
                                </div>

                                {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                            </div>

                            {isLoading && (
                                <div className="my-8 animate-fade-in">
                                    <div className="max-w-2xl mx-auto card p-6">
                                        <h3 className="text-xl font-semibold text-center mb-2">{loadingMessage}</h3>
                                        <ProgressBar progress={progress} />
                                        <p className="text-center text-teal-600 mt-2">{Math.round(progress)}%</p>
                                    </div>
                                </div>
                            )}

                            {hasAnalysis && (
                                <div className="mt-12 animate-fade-in">
                                    <h2 className="text-3xl font-bold mb-6 text-center">Analysis Results for <span className="text-teal-600">{currentAlternative ? currentAlternative.name : 'Main Design'}</span></h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                                        <div className="lg:col-span-2 space-y-6">
                                            {displayAnalysis.map((section, index) => (
                                                <AnalysisSection
                                                    key={`${currentAlternativeId || 'main'}-${index}`}
                                                    title={section.title}
                                                    content={section.content}
                                                    imageUrls={section.imageUrls}
                                                    defaultOpen={index === 0}
                                                    onDesignIteration={handleDesignIteration}
                                                />
                                            ))}
                                        </div>
                                        <div className="space-y-6">
                                            <div className="sticky top-24 space-y-6">
                                                <div ref={quantitativeAnalysisRef}>
                                                        {displayQuantData && <QuantitativeAnalysis data={displayQuantData} location={projectData.location} onViewDetails={() => setCurrentView('quantitative')} />}
                                                </div>
                                                {displayCostEstimate && (
                                                    <CostEstimator costEstimate={displayCostEstimate} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {hasAlternatives && (
                                <div className="mt-12 animate-fade-in">
                                    <div className="card p-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                                            <h3 className="text-2xl font-bold mb-2 sm:mb-0">Design Alternatives</h3>
                                            <button
                                                onClick={() => setIsComparisonOpen(true)}
                                                disabled={alternatives.length < 1}
                                                className="btn btn-secondary"
                                            >
                                                Compare Designs
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <button 
                                                className={`w-full p-4 text-left transition-all duration-200 rounded-xl border ${
                                                    !currentAlternativeId 
                                                    ? 'bg-teal-50 border-teal-400 shadow-sm' 
                                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                                }`}
                                                onClick={() => handleSelectAlternative(null)}
                                            >
                                                <p className={`font-semibold ${!currentAlternativeId ? 'text-teal-900' : 'text-slate-800'}`}>Main Design Proposal</p>
                                                <p className="text-sm text-slate-600">The primary analysis result generated from the initial prompt.</p>
                                            </button>
                                            {alternatives.map(alt => (
                                                <button 
                                                    key={alt.id}
                                                    className={`w-full p-4 text-left transition-all duration-200 rounded-xl border ${
                                                        currentAlternativeId === alt.id 
                                                        ? 'bg-teal-50 border-teal-400 shadow-sm' 
                                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                                    }`}
                                                    onClick={() => handleSelectAlternative(alt.id)}
                                                >
                                                    <p className={`font-semibold ${currentAlternativeId === alt.id ? 'text-teal-900' : 'text-slate-800'}`}>{alt.name}</p>
                                                    <p className="text-sm text-slate-600">{alt.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : currentView === 'profile' ? (
                        <ProfilePage onBack={() => setCurrentView(hasAnyAnalysis ? 'dashboard' : 'analysis')} />
                    ) : currentView === 'quantitative' ? (
                        displayQuantData ? (
                            <QuantitativeSiteAnalysis data={displayQuantData} template={selectedTemplate} />
                        ) : (
                            <div className="card p-8 text-center">
                                <p className="text-slate-600">No quantitative data available. Please analyze the site first.</p>
                                <button 
                                    onClick={() => setCurrentView('analysis')}
                                    className="btn btn-primary mt-4"
                                >
                                    Go to Analysis
                                </button>
                            </div>
                        )
                    ) : (
                        <Dashboard 
                            projectData={projectData} 
                            displayAnalysis={displayAnalysis}
                            quantitativeAnalysisRef={quantitativeAnalysisRef} 
                            dashboardRef={dashboardRef}
                            onEditPlan={() => setCurrentView('planner')}
                            dashboardDisplayImage={projectData.dashboardDisplayImage}
                            onSetDashboardImage={handleSetDashboardImage}
                        />
                    )}

                        {!['planner', 'profile'].includes(currentView) && (
                            <Chatbot
                                analysisContext={getAnalysisContext()}
                                messages={chatHistory}
                                onMessagesChange={handleChatUpdate}
                            />
                        )}

                        <TemplateSelector
                            isOpen={isTemplateOpen}
                            onClose={() => setIsTemplateOpen(false)}
                            onSelectTemplate={handleTemplateSelect}
                            projectType={projectType}
                        />

                        <ComparisonView
                            isOpen={isComparisonOpen}
                            onClose={() => setIsComparisonOpen(false)}
                            alternatives={[
                                {
                                    id: 'main',
                                    name: 'Main Design',
                                    description: 'Primary analysis result',
                                    analysisResult: projectData.analysisResult,
                                    quantitativeData: projectData.quantitativeData,
                                    costEstimate: projectData.costEstimate,
                                    createdAt: new Date().toISOString(),
                                },
                                ...alternatives
                            ]}
                            onSelectAlternative={handleSelectAlternative}
                        />
                    </>
                )}
                
                {/* Global Modals - outside projectData condition */}
                <ProjectSelectionModal
                    isOpen={isProjectModalOpen}
                    onClose={() => setIsProjectModalOpen(false)}
                    projects={userProjects}
                    onLoadProject={handleLoadProject}
                    onDeleteProject={handleDeleteProject}
                    onImportFile={handleImportProjectFile}
                />
                <ProjectNameModal
                    isOpen={isProjectNameModalOpen}
                    onClose={() => setIsProjectNameModalOpen(false)}
                    onConfirm={handleCreateNewProject}
                />
            </main>
        </div>
    );
};


interface DashboardProps {
    projectData: ProjectData;
    displayAnalysis: AnalysisSectionData[];
    quantitativeAnalysisRef: React.RefObject<HTMLDivElement>;
    dashboardRef: React.RefObject<HTMLDivElement>;
    onEditPlan: () => void;
    dashboardDisplayImage?: 'urban' | 'site' | 'street';
    onSetDashboardImage: (imageType: 'urban' | 'site' | 'street') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    projectData, 
    displayAnalysis, 
    quantitativeAnalysisRef, 
    dashboardRef, 
    onEditPlan,
    dashboardDisplayImage,
    onSetDashboardImage
}) => {
    const { location, costEstimate, quantitativeData, alternatives, conceptualPlan, name, conceptualCostEstimate } = projectData;
    const designSection = displayAnalysis.find(s => s.title === 'Strategic Generative Recommendations');
    const displayedImageKey = dashboardDisplayImage || 'site';
    const designImage = designSection?.imageUrls[displayedImageKey];


    return (
        <div ref={dashboardRef} className="animate-fade-in space-y-8">
            <PageHeader
              title={`Project Dashboard: ${name}`}
              subtitle={<span className="text-xs md:text-sm">Overview of strategic visuals, quantitative metrics and cost intelligence.</span>}
              className="mb-8"
              icon={<DashboardIcon className="w-full h-full" />}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    {conceptualPlan && (
                        <PlannerDashboardCard 
                            conceptualPlan={conceptualPlan}
                            onEditPlan={onEditPlan}
                            costEstimate={conceptualCostEstimate}
                        />
                    )}
                    
                    {designSection && (
                        <div className="card p-6">
                             <h3 className="text-xl font-bold text-slate-900 mb-4">Strategic Design Visuals</h3>
            
                            <div className="btn-group mb-4">
                                {designSection.imageUrls.urban && <button className={`btn ${displayedImageKey === 'urban' ? 'active' : ''}`} onClick={() => onSetDashboardImage('urban')}>Urban Context</button>}
                                {designSection.imageUrls.site && <button className={`btn ${displayedImageKey === 'site' ? 'active' : ''}`} onClick={() => onSetDashboardImage('site')}>Site Detail</button>}
                                {designSection.imageUrls.street && <button className={`btn ${displayedImageKey === 'street' ? 'active' : ''}`} onClick={() => onSetDashboardImage('street')}>Street View</button>}
                            </div>

                            {designImage ? (
                                <img src={designImage} alt={`Design Visual: ${displayedImageKey}`} className="w-full rounded-md border border-slate-200" />
                            ) : (
                                <div className="w-full aspect-video bg-slate-100 rounded-md flex items-center justify-center">
                                    <p className="text-slate-500">Image not available for this view.</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div ref={quantitativeAnalysisRef}>
                        {quantitativeData && <QuantitativeAnalysis data={quantitativeData} location={projectData.location} />}
                    </div>

                    {alternatives && alternatives.length > 0 && (
                         <div className="card p-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Alternatives</h3>
                             <div className="space-y-2">
                                {alternatives.map(alt => (
                                    <div key={alt.id} className="p-3 bg-slate-50 rounded-md border border-slate-200">
                                        <p className="font-semibold text-sm text-slate-800">{alt.name}</p>
                                        <p className="text-xs text-slate-600">{alt.description}</p>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-1 space-y-8 sticky top-24">
                    <div className="card p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Project Details</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-slate-800">Location</p>
                                    <p className="text-slate-600">{location?.name}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <HomeIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-slate-800">Site Area</p>
                                    <p className="text-slate-600">{location?.area?.toFixed(1)} m²</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {costEstimate && (
                        <CostEstimator costEstimate={costEstimate} />
                    )}
                </div>
            </div>
        </div>
    );
};


export default App;