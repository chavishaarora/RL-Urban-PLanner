import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, EditIcon } from './Icons';
import { ImageModal } from './ImageModal';
import { DesignEditor } from './DesignEditor';

interface AnalysisSectionProps {
  title: string;
  content: string;
  imageUrls: {
      urban: string | null;
      site: string | null;
      street: string | null;
  };
  defaultOpen?: boolean;
  onDesignIteration?: (newImageUrl: string) => void;
}

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({ title, content, imageUrls, defaultOpen = false, onDesignIteration }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const isDesignSection = title === 'Strategic Generative Recommendations';

  const handleImageClick = (url: string | null) => {
    if (url) {
        setModalImageUrl(url);
        setIsModalOpen(true);
    }
  };

  const handleDesignGenerated = (newUrl: string) => {
    if (onDesignIteration) {
        onDesignIteration(newUrl);
    }
    setIsEditorOpen(false);
  };

  const formattedContent = content.split('\n').map((line, index) => {
    line = line.trim();
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={index} className="font-bold text-slate-800 mt-3">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith('* ') || line.startsWith('- ')) {
       const bulletContent = line.slice(2);
       const strongRegex = /\*\*(.*?)\*\*/g;
       const parts = bulletContent.split(strongRegex);

       return (
        <li key={index} className="text-slate-700">
            {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-800">{part}</strong> : part
            )}
        </li>
       );
    }
    if(line) {
        return <p key={index} className="text-slate-700 mt-2">{line}</p>
    }
    return null;
  }).filter(Boolean);

  const hasAllThreeImages = imageUrls.urban && imageUrls.site && imageUrls.street;
  const hasTwoImages = imageUrls.urban && imageUrls.site;
  const gridClass = hasAllThreeImages ? 'md:grid-cols-3' : hasTwoImages ? 'md:grid-cols-2' : '';

  return (
    <>
      <div className="card overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center p-4 text-left bg-slate-50 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-expanded={isOpen}
        >
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {isOpen ? <ChevronUpIcon className="w-6 h-6 text-slate-500" /> : <ChevronDownIcon className="w-6 h-6 text-slate-500" />}
        </button>
        {isOpen && (
          <div className="animate-fade-in">
            <div className="p-4 border-t border-slate-200">
                {imageUrls.urban || imageUrls.site ? (
                    <div className={`mb-4 grid grid-cols-1 ${gridClass} gap-4`}>
                        {imageUrls.urban && (
                            <div>
                                <h4 className="font-semibold text-sm mb-2 text-center text-slate-700">Urban Context</h4>
                                <div 
                                  className="rounded-md overflow-hidden border border-slate-200 cursor-pointer group relative"
                                  onClick={() => handleImageClick(imageUrls.urban)}
                                >
                                    <img src={imageUrls.urban} alt={`Urban context for ${title}`} className="w-full h-auto" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                        <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Larger</p>
                                    </div>
                                </div>
                            </div>
                        )}
                         {imageUrls.site && (
                            <div>
                                <h4 className="font-semibold text-sm mb-2 text-center text-slate-700">Site Detail</h4>
                                <div 
                                  className="rounded-md overflow-hidden border border-slate-200 cursor-pointer group relative"
                                  onClick={() => handleImageClick(imageUrls.site)}
                                >
                                    <img src={imageUrls.site} alt={`Site detail for ${title}`} className="w-full h-auto" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                        <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Larger</p>
                                    </div>
                                </div>
                            </div>
                        )}
                         {imageUrls.street && (
                            <div>
                                <h4 className="font-semibold text-sm mb-2 text-center text-slate-700">Street View</h4>
                                <div 
                                  className="rounded-md overflow-hidden border border-slate-200 cursor-pointer group relative"
                                  onClick={() => handleImageClick(imageUrls.street)}
                                >
                                    <img src={imageUrls.street} alt={`Street view for ${title}`} className="w-full h-auto" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                        <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Larger</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                  <div className="mb-4 p-4 text-center bg-slate-50 rounded-md">
                      <p className="text-sm text-slate-600">Visual analysis could not be generated for this section.</p>
                  </div>
                )}
              <ul className="space-y-2 list-disc list-inside">
                {formattedContent}
              </ul>
            </div>
            {isDesignSection && imageUrls.site && onDesignIteration && (
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                  <button 
                      onClick={() => setIsEditorOpen(true)}
                      className="w-full btn btn-secondary"
                  >
                      <EditIcon className="w-5 h-5 mr-2" />
                      Edit Design Proposal
                  </button>
              </div>
            )}
          </div>
        )}
      </div>
      {modalImageUrl && (
        <ImageModal 
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setModalImageUrl(null); }}
            imageUrl={modalImageUrl}
            altText={`Enlarged visual analysis for ${title}`}
        />
      )}
      {isDesignSection && imageUrls.site && onDesignIteration && (
        <DesignEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            baseImageUrl={imageUrls.site}
            onDesignGenerated={handleDesignGenerated}
        />
      )}
    </>
  );
};