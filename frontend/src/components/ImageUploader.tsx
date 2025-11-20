import React, { useState, useCallback, useRef, ChangeEvent } from 'react';
import { processImageForGemini } from '@/utils/fileUtils';
import { ImageFile } from '../types';
import { UploadIcon, XIcon } from './Icons';

interface ImageUploaderProps {
  id: string;
  label: string;
  onFileSelect: (file: ImageFile | null) => void;
  currentFile: ImageFile | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ id, label, onFileSelect, currentFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const { base64, mimeType } = await processImageForGemini(file);
        onFileSelect({
          name: file.name,
          type: mimeType,
          base64,
        });
      } catch (error) {
        console.error("Error converting file to base64:", error);
        onFileSelect(null);
      }
    }
  }, [onFileSelect]);
  
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
  };
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
          try {
              const { base64, mimeType } = await processImageForGemini(file);
              onFileSelect({
                  name: file.name,
                  type: mimeType,
                  base64,
              });
          } catch (error) {
              console.error("Error converting file to base64:", error);
              onFileSelect(null);
          }
      }
  }, [onFileSelect]);


  const handleRemoveImage = (e: React.MouseEvent<HTMLButtonElement>) => {
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
        <div className="relative group w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
          <img src={`data:${currentFile.type};base64,${currentFile.base64}`} alt="Preview" className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center">
            <button
              onClick={handleRemoveImage}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-red-500"
              aria-label="Remove image"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      ) : (
        <label
            htmlFor={id}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex justify-center items-center w-full aspect-video px-6 py-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}`}
        >
          <div className="text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, WEBP</p>
          </div>
          <input id={id} name={id} type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} ref={inputRef}/>
        </label>
      )}
    </div>
  );
};