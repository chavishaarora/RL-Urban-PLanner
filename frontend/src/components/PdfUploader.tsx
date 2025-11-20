import React, { useState, useCallback, useRef, ChangeEvent } from 'react';
import { fileToBase64 } from '@/utils/fileUtils';
import { ImageFile } from '../types';
import { UploadIcon, XIcon, DocumentTextIcon } from './Icons';

interface PdfUploaderProps {
  id: string;
  label: string;
  onFileSelect: (file: ImageFile | null) => void;
  currentFile: ImageFile | null;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({ id, label, onFileSelect, currentFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const { base64, mimeType } = await fileToBase64(file);
        onFileSelect({ name: file.name, type: mimeType, base64 });
      } catch (error) {
        console.error("Error converting file to base64:", error);
        onFileSelect(null);
      }
    }
  }, [onFileSelect]);
  
  const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>, dragging: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(dragging);
  };
  
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === 'application/pdf') {
          try {
              const { base64, mimeType } = await fileToBase64(file);
              onFileSelect({ name: file.name, type: mimeType, base64 });
          } catch (error) {
              console.error("Error converting file to base64:", error);
              onFileSelect(null);
          }
      } else {
          alert('Please drop a PDF file.');
      }
  }, [onFileSelect]);


  const handleRemoveFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onFileSelect(null);
    if(inputRef.current) {
        inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      {currentFile ? (
        <div className="relative group w-full p-4 rounded-lg border-2 border-dashed border-green-500 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <DocumentTextIcon className="w-8 h-8 text-green-600"/>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{currentFile.name}</span>
            </div>
            <button
              onClick={handleRemoveFile}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              aria-label="Remove file"
            >
              <XIcon className="w-4 h-4" />
            </button>
        </div>
      ) : (
        <label
            htmlFor={id}
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDrop={handleDrop}
            className={`flex justify-center items-center w-full px-6 py-10 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}
        >
          <div className="text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">PDF Report File</p>
          </div>
          <input id={id} name={id} type="file" className="sr-only" accept="application/pdf" onChange={handleFileChange} ref={inputRef}/>
        </label>
      )}
    </div>
  );
};