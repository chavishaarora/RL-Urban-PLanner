// components/InfoModal.tsx
import React from 'react';
import { Spinner } from './Icons';
import { XIcon } from './Icons';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    title: string;
    content: string | null;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, isLoading, title, content }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" 
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-lg m-4 transform transition-all animate-fade-in-up"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-32">
                        <Spinner />
                        <p className="mt-3 text-gray-600 dark:text-gray-400">Analyzing feature...</p>
                    </div>
                ) : (
                    <div className="text-gray-700 dark:text-gray-300 max-h-[60vh] overflow-y-auto">
                        <p>{content || "No information available."}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
