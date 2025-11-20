import React from 'react';
import { SaveIcon } from './planner/PlannerIcons';
import { ProjectData } from '../types';
import { AnalysisSection } from './AnalysisSection';

interface AnalysisViewProps {
    projectData: ProjectData;
    onClose: () => void;
    onSave: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
    projectData,
    onClose,
    onSave,
}) => {
    return (
        <div className="w-full h-[calc(100vh-68px)] flex flex-col bg-slate-100 animate-fade-in">
            {/* Top Navbar */}
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-8">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-slate-800">{projectData.location?.name}</h1>
                        </div>
                        <div className="flex items-center space-x-1">
                            <button
                                className="px-4 py-2 text-sm font-medium text-teal-600 border-b-2 border-teal-500 hover:text-teal-700 hover:bg-teal-50/50 rounded-t-lg transition-colors"
                            >
                                Analysis View
                            </button>
                            <button
                                onClick={() => window.location.href = '/planner'}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-t-lg transition-colors"
                            >
                                Concept Planner
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            Back to Dashboard
                        </button>
                        <button 
                            onClick={onSave}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-full transition-colors flex items-center gap-2"
                        >
                            <SaveIcon className="w-4 h-4"/>
                            Save Analysis
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-grow overflow-auto p-6 space-y-6">
                {projectData.analysis?.sections?.map((section, index) => (
                    <AnalysisSection
                        key={index}
                        title={section.title}
                        content={section.content}
                        imageUrls={section.images || { urban: null, site: null, street: null }}
                        defaultOpen={index === 0}
                        onDesignIteration={index === projectData.analysis?.sections.length - 1 ? 
                            (newUrl: string) => console.log('Design iteration:', newUrl) : undefined}
                    />
                ))}
            </div>
        </div>
    );
};