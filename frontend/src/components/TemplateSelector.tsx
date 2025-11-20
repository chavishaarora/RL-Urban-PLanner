import React, { useState, useEffect } from 'react';
import { DesignTemplate } from '../types';
import { getTemplatesByCategory } from '@/data/designTemplates';
import { XIcon, PlusCircleIcon } from './Icons';

interface TemplateSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: DesignTemplate) => void;
    projectType: string;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ isOpen, onClose, onSelectTemplate, projectType }) => {
    
    const [view, setView] = useState<'grid' | 'custom'>('grid');
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');

    const filteredTemplates = getTemplatesByCategory(projectType);

    useEffect(() => {
        // Reset view when modal is opened
        if (isOpen) {
            setView('grid');
            setCustomName('');
            setCustomDescription('');
        }
    }, [isOpen]);

    const handleCreateCustom = () => {
        if (!customName.trim() || !customDescription.trim()) {
            alert("Please provide a name and description for your custom template.");
            return;
        }

        const customTemplate: DesignTemplate = {
            id: `custom-${Date.now()}`,
            name: `Custom: ${customName}`,
            description: `A custom design based on your instructions.`,
            category: projectType,
            aiPrompt: customDescription,
        };
        
        onSelectTemplate(customTemplate);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{view === 'grid' ? `${projectType} Design Templates` : 'Create Custom Template'}</h2>
                        <p className="text-sm text-slate-500 mt-1">{view === 'grid' ? 'Choose a template or create your own to quick-start your design' : 'Provide your own detailed instructions for the AI'}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {view === 'grid' ? (
                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Custom Template Card */}
                             <div
                                className="border-2 border-dashed border-slate-300 rounded-xl hover:border-teal-400 hover:bg-slate-50 transition-all cursor-pointer group flex flex-col items-center justify-center text-center p-6"
                                onClick={() => setView('custom')}
                            >
                                <PlusCircleIcon className="w-12 h-12 text-slate-400 group-hover:text-teal-500 transition-colors" />
                                <h3 className="font-bold text-lg text-slate-700 mt-4 group-hover:text-teal-600">Create Custom Template</h3>
                                <p className="text-sm text-slate-500 mt-1">Provide your own design instructions for the AI.</p>
                            </div>

                            {/* Pre-defined Templates */}
                            {filteredTemplates.map(template => (
                                <div
                                    key={template.id}
                                    className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-teal-400 transition-all cursor-pointer group flex flex-col"
                                    onClick={() => {
                                        onSelectTemplate(template);
                                        onClose();
                                    }}
                                >
                                    <div className="h-40 bg-slate-50 p-4 flex flex-wrap gap-2 content-start overflow-hidden border-b border-slate-200">
                                        {template.elements && template.elements.slice(0, 8).map((element, index) => (
                                            <span key={index} className="px-3 py-1 text-xs font-semibold text-teal-800 bg-teal-100 rounded-full">
                                                {element}
                                            </span>
                                        ))}
                                        {!template.elements && (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <p className="text-sm text-slate-400">No specific features listed.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 flex flex-col flex-grow">
                                        <h3 className="font-bold text-lg text-slate-800 mb-1">{template.name}</h3>
                                        <p className="text-sm text-slate-600 mb-4 flex-grow">{template.description}</p>
                                        
                                        <button className="w-full btn btn-secondary mt-auto">
                                            Apply Template
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // CUSTOM TEMPLATE FORM VIEW
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <label htmlFor="custom-template-name" className="block text-sm font-medium text-slate-700 mb-1 ml-4">Template Name</label>
                            <input
                                type="text"
                                id="custom-template-name"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="e.g., 'Zen Garden for Meditation'"
                                className="form-input"
                            />
                        </div>
                        <div>
                            <label htmlFor="custom-template-desc" className="block text-sm font-medium text-slate-700 mb-1 ml-4">Design Description / AI Prompt</label>
                            <textarea
                                id="custom-template-desc"
                                rows={10}
                                value={customDescription}
                                onChange={(e) => setCustomDescription(e.target.value)}
                                placeholder="Describe the key features, style, and atmosphere of your desired design. Be as specific as possible. For example: 'Design a minimalist Japanese zen garden. Use raked white gravel to represent water, large mossy stones as islands, and a single cherry blossom tree. Include a small bamboo water feature (shishi-odoshi) and a stone lantern. The perimeter should be a simple bamboo fence.'"
                                className="form-input !rounded-xl w-full p-4"
                            />
                            <p className="text-xs text-slate-500 mt-2 ml-4">This description will be given directly to the AI to guide the design generation.</p>
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                             <button onClick={() => setView('grid')} className="btn btn-secondary">
                                Back to Templates
                            </button>
                            <button 
                                onClick={handleCreateCustom}
                                disabled={!customName.trim() || !customDescription.trim()}
                                className="btn btn-primary"
                            >
                                Save & Apply Custom Template
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};