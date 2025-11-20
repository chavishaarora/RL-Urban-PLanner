import React, { useContext, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { Spinner, ChevronDownIcon, MenuIcon, XIcon } from './Icons';

interface NavbarProps {
    onSave: () => void;
    onExport?: () => void; // (Now optional & unused visually; kept for backwards compatibility if needed)
    onCloseProject: () => void;
    onLogout: () => void;
    onDownload: () => void;
    onDownloadPPT?: () => void;
    isDownloading: boolean;
    hasProject: boolean;
    hasAnalysis: boolean;
    currentView: 'analysis' | 'dashboard' | 'planner' | 'profile' | 'quantitative' | 'maps';
    onToggleView: () => void;
    onSetView?: (view: 'analysis' | 'dashboard' | 'planner' | 'profile' | 'quantitative' | 'maps') => void;
    onShowProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
    onSave,
    onExport,
    onCloseProject,
    onLogout,
    onDownload,
    onDownloadPPT,
    isDownloading,
    hasProject,
    hasAnalysis,
    currentView,
    onToggleView,
    onSetView,
    onShowProfile,
}) => {
    const { user } = useContext(AuthContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleMobileLinkClick = (action: () => void) => {
        action();
        setIsMobileMenuOpen(false);
    };

    const toggleButtonText = currentView === 'dashboard' ? 'Analysis View' : 'Dashboard';

    return (
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 shadow-sm">
            <div className="container mx-auto px-4 py-2.5 md:px-8 flex items-center justify-between">
                
                <button 
                    onClick={hasProject ? onCloseProject : undefined} 
                    className="flex items-center space-x-2 group"
                    title="Back to project selection"
                >
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-800 group-hover:text-teal-700 transition-colors">
                        Urban<span className="text-teal-500">Eyes</span>
                    </h1>
                </button>

                <div className="flex items-center space-x-4">
                    {user && hasProject && (
                        <div className="hidden md:flex items-center space-x-2">
                            {currentView !== 'profile' && (
                                <div className="hidden lg:flex items-center gap-2">
                                    <div className="relative group">
                                        <button
                                            className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-1"
                                        >
                                            Project Tools
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </button>
                                        <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                                            <button onClick={() => onSetView ? onSetView('analysis') : onToggleView()} className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm ${currentView==='analysis' ? 'text-teal-700 font-semibold' : 'text-slate-800'}`}>Analyze Site</button>
                                            <button onClick={() => onSetView && onSetView('quantitative')} className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm border-t border-slate-100 ${currentView==='quantitative' ? 'text-teal-700 font-semibold' : 'text-slate-800'}`}>Quantitative Analysis</button>

                                            <button onClick={() => onSetView && onSetView('maps')} className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm border-t border-slate-100 ${currentView==='maps' ? 'text-teal-700 font-semibold' : 'text-slate-800'}`}>Context Maps</button>
                                            <button onClick={() => onSetView && onSetView('planner')} className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm border-t border-slate-100 ${currentView==='planner' ? 'text-teal-700 font-semibold' : 'text-slate-800'}`}>Concept Planner</button>
                                            <button onClick={() => onSetView ? onSetView('dashboard') : onToggleView()} className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm border-t border-slate-100 ${currentView==='dashboard' ? 'text-teal-700 font-semibold' : 'text-slate-800'}`}>Dashboard</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={onSave} 
                                className="px-4 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-full shadow-sm transition-colors"
                                title="Save project"
                            >
                                Save Project
                            </button>
                        </div>
                    )}

                    {user && (
                        <div className="relative group">
                            <button className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-100">
                                {user.picture ? (
                                    <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">{user.name.charAt(0).toUpperCase()}</div>
                                )}
                                <span className="font-semibold text-sm text-slate-700 hidden lg:inline">Welcome, {user.name}</span>
                                <ChevronDownIcon className="w-4 h-4 text-slate-500 hidden lg:inline" />
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                                <button onClick={onShowProfile} className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors text-sm text-slate-800">Profile</button>
                                <button onClick={onLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors text-sm text-red-600 border-t border-slate-100">Logout</button>
                            </div>
                        </div>
                    )}
                    <div className="md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md hover:bg-slate-100">
                            {isMobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                        </button>
                    </div>

                </div>
            </div>

            {isMobileMenuOpen && user && (
                 <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 animate-fade-in-down">
                    <div className="container mx-auto px-4 py-4 space-y-3">
                        {hasProject && (
                            <>
                                {currentView !== 'analysis' && (
                                    <button onClick={() => handleMobileLinkClick(() => onSetView ? onSetView('analysis') : onToggleView())} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Analyze Site</button>
                                )}
                                {currentView !== 'quantitative' && (
                                    <button onClick={() => handleMobileLinkClick(() => onSetView && onSetView('quantitative'))} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Quantitative Analysis</button>
                                )}

                                {currentView !== 'maps' && (
                                    <button onClick={() => handleMobileLinkClick(() => onSetView && onSetView('maps'))} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Context Maps</button>
                                )}
                                {currentView !== 'planner' && (
                                    <button onClick={() => handleMobileLinkClick(() => onSetView && onSetView('planner'))} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Concept Planner</button>
                                )}
                                {currentView !== 'dashboard' && (
                                    <button onClick={() => handleMobileLinkClick(() => onSetView ? onSetView('dashboard') : onToggleView())} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Dashboard</button>
                                )}
                                <button onClick={() => handleMobileLinkClick(onSave)} className="block w-full text-left p-2 rounded-md font-medium text-white bg-teal-600 hover:bg-teal-700">Save Project</button>
                            </>
                        )}
                        <div className="border-t border-slate-200 pt-3 space-y-2">
                             <button onClick={() => handleMobileLinkClick(onShowProfile)} className="block w-full text-left p-2 rounded-md font-medium text-slate-700 hover:bg-slate-100">Profile</button>
                             <button onClick={() => handleMobileLinkClick(onLogout)} className="block w-full text-left p-2 rounded-md font-medium text-red-600 hover:bg-red-50">Logout</button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};