import React from 'react';
import { XIcon } from './Icons';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    altText: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, altText }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in" 
            aria-modal="true"
            onClick={onClose}
        >
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 bg-gray-900/50 rounded-full p-2"
                aria-label="Close image view"
            >
                <XIcon className="w-8 h-8" />
            </button>
            <div 
                className="relative max-w-4xl max-h-[90vh]"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image
            >
                <img 
                    src={imageUrl} 
                    alt={altText} 
                    className="w-full h-full object-contain rounded-lg shadow-2xl"
                />
            </div>
        </div>
    );
};
