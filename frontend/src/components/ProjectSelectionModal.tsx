import React from 'react';
import { ProjectData } from '../types';
import { XIcon, TrashIcon } from './Icons';

interface ProjectSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: ProjectData[];
    onLoadProject: (projectId: string) => void;
    onDeleteProject: (projectId: string) => void;
    onImportFile?: (file: File) => void; // New: import JSON file
}

export const ProjectSelectionModal: React.FC<ProjectSelectionModalProps> = ({ isOpen, onClose, projects, onLoadProject, onDeleteProject, onImportFile }) => {
    if (!isOpen) return null;

    const sortedProjects = [...projects].sort((a, b) => {
        const dateA = a.lastSaved ? new Date(a.lastSaved).getTime() : 0;
        const dateB = b.lastSaved ? new Date(b.lastSaved).getTime() : 0;
        return dateB - dateA;
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Load Project</h2>
                        <p className="text-sm text-slate-500 mt-1">Select a project saved in this browser.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {onImportFile && (
                        <div className="mb-4 p-4 rounded-lg border-2 border-dashed border-teal-300 bg-teal-50/40">
                            <p className="text-sm text-slate-700 mb-2">Import a project file (eg., penguinworld.json) exported from UrbanEyes.</p>
                            <input
                                type="file"
                                accept="application/json,.json,.urbaneyes.json"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onImportFile(file);
                                }}
                                className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                            />
                        </div>
                    )}
                    {sortedProjects.length > 0 ? (
                        <ul className="space-y-3">
                            {sortedProjects.map(project => (
                                <li key={project.id} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all">
                                    <div>
                                        <p className="font-semibold text-slate-800">{project.name}</p>
                                        <p className="text-xs text-slate-500">
                                            Last saved: {project.lastSaved ? new Date(project.lastSaved).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => onDeleteProject(project.id)}
                                            className="p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Project"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => onLoadProject(project.id)}
                                            className="btn btn-secondary"
                                        >
                                            Load
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-16">
                            <h3 className="text-lg font-semibold text-slate-700">No Projects Found</h3>
                            <p className="text-slate-500 mt-2">Create a new project and save it to see it here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};