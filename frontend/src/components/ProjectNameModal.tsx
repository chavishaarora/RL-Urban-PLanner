import React, { useState } from 'react';
import { XIcon } from './Icons';

interface ProjectNameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (projectName: string) => void;
    defaultName?: string;
}

export const ProjectNameModal: React.FC<ProjectNameModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    defaultName = '' 
}) => {
    const [projectName, setProjectName] = useState(defaultName);
    const [error, setError] = useState('');

    const handleConfirm = () => {
        const trimmedName = projectName.trim();
        if (!trimmedName) {
            setError('Project name is required');
            return;
        }
        onConfirm(trimmedName);
        setProjectName('');
        setError('');
    };

    const handleClose = () => {
        setProjectName('');
        setError('');
        onClose();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-gradient-to-br from-white via-slate-50 to-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-teal-700 bg-clip-text text-transparent">
                        Name Your Project
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                <p className="text-slate-600 mb-4">
                    Give your project a unique name to help you identify it later.
                </p>

                <div className="mb-4">
                    <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 mb-2">
                        Project Name
                    </label>
                    <input
                        id="project-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => {
                            setProjectName(e.target.value);
                            setError('');
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder="e.g., Penguin Memorial Barcelona"
                        className="w-full px-4 py-3 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-300 transition-all duration-300 hover:border-teal-200"
                        autoFocus
                    />
                    {error && (
                        <p className="text-red-500 text-sm mt-2">{error}</p>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={handleClose}
                        className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-all duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-5 py-2.5 rounded-full bg-teal-500 text-white font-semibold hover:bg-teal-600 transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                        Create Project
                    </button>
                </div>
            </div>
        </div>
    );
};
