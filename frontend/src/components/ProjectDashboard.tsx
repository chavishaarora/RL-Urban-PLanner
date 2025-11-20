import React from 'react';
import { FolderOpenIcon, PlusCircleIcon, DashboardIcon } from './Icons';
import PageHeader from './PageHeader';

interface ProjectDashboardProps {
    user: string;
    onCreateNew: () => void;
    onLoadProject: () => void;
}

const ActionCard: React.FC<{ title: string, description: string, icon: React.ReactNode, onClick: () => void, disabled?: boolean }> = ({ title, description, icon, onClick, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className="w-full p-6 text-left bg-white rounded-full border border-slate-200 hover:border-teal-400 hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none group"
    >
        <div className="flex items-center space-x-4">
            <div className="bg-teal-50 text-teal-600 p-3 rounded-full transition-colors duration-200 group-hover:bg-teal-100">
                {icon}
            </div>
            <div className="flex-grow">
                <h3 className="text-xl font-bold text-slate-800 transition-colors duration-200 group-hover:text-teal-600">{title}</h3>
                <p className="mt-1 text-slate-600">{description}</p>
            </div>
        </div>
    </button>
);


export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ user, onCreateNew, onLoadProject }) => {
    return (
        <div className="animate-fade-in flex items-center justify-center min-h-screen">
            <div className="-mt-80">
                <div className="text-center mb-0">
                    <img src="/urbaneyes-logo.png" alt="UrbanEyes Logo" className="mx-auto mb-0 w-72 h-72 object-contain" style={{marginBottom: '-12px'}} />
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mt-0 mb-10" style={{marginTop: '0'}}>
                        We Analyse, <span className="text-teal-600">You Design.</span>
                    </h1>
                </div>
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 px-4 mt-0">
                    <ActionCard 
                        title="Create New Project"
                        description="Start a fresh analysis from scratch."
                        icon={<PlusCircleIcon className="w-7 h-7"/>}
                        onClick={onCreateNew}
                    />
                    <ActionCard 
                        title="Load Previous Project"
                        description="Open a saved project from this browser."
                        icon={<FolderOpenIcon className="w-7 h-7"/>}
                        onClick={onLoadProject}
                    />
                </div>
            </div>
        </div>
    );
};