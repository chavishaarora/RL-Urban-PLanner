import React, { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import { AuthContext } from '@/contexts/AuthContext';
import { SunIcon, MoonIcon, ParkIcon, SaveIcon, HomeIcon, LogOutIcon, DownloadIcon, Spinner } from './Icons';

interface NavbarProps {
    onSave: () => void;
    onCloseProject: () => void;
    onLogout: () => void;
    onDownload: () => void;
    onDownloadPPT?: () => void;
    isDownloading: boolean;
    hasProject: boolean;
    hasAnalysis: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
    onSave, 
    onCloseProject, 
    onLogout, 
    onDownload, 
    onDownloadPPT,
    isDownloading, 
    hasProject, 
    hasAnalysis 
}) => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
            <div className="container mx-auto px-4 py-3 md:px-8 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
                        <ParkIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight hidden sm:block">
                        UrbanEyes
                    </h1>
                </div>
                
                <div className="flex items-center space-x-2 sm:space-x-4">
                    {user && hasProject && (
                        <>
                            <button 
                                onClick={onCloseProject} 
                                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
                                title="Close Project (Dashboard)"
                            >
                                <HomeIcon className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={onSave} 
                                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
                                title="Save Project" 
                                disabled={!hasAnalysis}
                            >
                                <SaveIcon className="w-6 h-6" />
                            </button>
                            
                            {/* Download Dropdown */}
                            {hasAnalysis && (
                                <div className="relative group">
                                    <button 
                                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1" 
                                        title="Download Report"
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? <Spinner /> : <DownloadIcon className="w-6 h-6" />}
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    
                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <button
                                            onClick={onDownload}
                                            disabled={isDownloading}
                                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                                        >
                                            <span>📄</span>
                                            <span>Download PDF</span>
                                        </button>
                                        {onDownloadPPT && (
                                            <button
                                                onClick={onDownloadPPT}
                                                disabled={isDownloading}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm border-t border-gray-200 dark:border-gray-700"
                                            >
                                                <span>📊</span>
                                                <span>Export Presentation</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <button 
                        onClick={toggleTheme} 
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                    </button>
                    {user && (
                        <div className="flex items-center space-x-3">
                            {/* FIX: Render user.name instead of user object */}
                            <span className="font-semibold text-sm hidden md:inline">Welcome, {user.name}</span>
                            <button 
                                onClick={onLogout} 
                                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
                                title="Logout"
                            >
                                <LogOutIcon className="w-6 h-6 text-red-500 dark:text-red-400" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};