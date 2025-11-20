import React, { useRef, useEffect, useState, useMemo } from 'react';
import { iterateDesign } from '@/services/geminiService-1';
import { XIcon, MagicWandIcon, UndoIcon, TrashIcon, Spinner, TypeIcon } from './Icons';

type Brush = {
    type: 'brush';
    color: string;
    label: string;
};
type TextTool = {
    type: 'text';
    label: 'Text Label';
};
type SelectedTool = Brush | TextTool;

type EditAction = {
    type: 'stroke';
    color: string;
    points: { x: number; y: number }[];
} | {
    type: 'text';
    text: string;
    position: { x: number; y: number };
};


interface DesignEditorProps {
    isOpen: boolean;
    onClose: () => void;
    baseImageUrl: string;
    onDesignGenerated: (newUrl: string) => void;
}

const designBrushes: Brush[] = [
    { type: 'brush', color: '#a16207', label: 'Paths' },
    { type: 'brush', color: '#16a34a', label: 'Trees/Shrubs' },
    { type: 'brush', color: '#64748b', label: 'Benches' },
    { type: 'brush', color: '#f59e0b', label: 'Play Area' },
    { type: 'brush', color: '#db2777', label: 'Kiosk' },
    { type: 'brush', color: '#7c3aed', label: 'Pet Area' },
    { type: 'brush', color: '#2563eb', label: 'Bike Parking' },
];

const textTool: TextTool = { type: 'text', label: 'Text Label' };


export const DesignEditor: React.FC<DesignEditorProps> = ({ isOpen, onClose, baseImageUrl, onDesignGenerated }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<SelectedTool>(designBrushes[0]);
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [edits, setEdits] = useState<EditAction[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Load base image
    useEffect(() => {
        if (isOpen) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = baseImageUrl;
            img.onload = () => {
                setBaseImage(img);
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
            };
            img.onerror = () => setError("Failed to load design image for editing.");
        }
    }, [isOpen, baseImageUrl]);

    // Redraw canvas when base image or edits change
    useEffect(() => {
        if (!isOpen || !baseImage) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        // Clear and draw base image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImage, 0, 0);
        
        // Draw edits
        edits.forEach(edit => {
            if (edit.type === 'stroke') {
                ctx.beginPath();
                ctx.moveTo(edit.points[0].x, edit.points[0].y);
                edit.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = edit.color;
                ctx.lineWidth = 12;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.7;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            } else if (edit.type === 'text') {
                const fontSize = Math.max(16, canvas.width * 0.02);
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;
                ctx.strokeText(edit.text, edit.position.x, edit.position.y);
                ctx.fillText(edit.text, edit.position.x, edit.position.y);
            }
        });

    }, [baseImage, edits, isOpen]);
    
    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoordinates(e);
        if (!coords || !selectedTool) return;
        
        if (selectedTool.type === 'brush') {
            setIsDrawing(true);
            setEdits(prev => [...prev, { type: 'stroke', color: selectedTool.color, points: [coords] }]);
        } else if (selectedTool.type === 'text') {
            const text = window.prompt("Enter a label for this point:");
            if (text) {
                setEdits(prev => [...prev, { type: 'text', text, position: coords }]);
            }
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || selectedTool.type !== 'brush') return;
        const coords = getCanvasCoordinates(e);
        if (!coords) return;
        
        setEdits(prev => {
            const currentStroke = prev[prev.length - 1];
            if (currentStroke.type === 'stroke') {
                const newPoints = [...currentStroke.points, coords];
                return [...prev.slice(0, -1), { ...currentStroke, points: newPoints }];
            }
            return prev;
        });
    };
    
    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const handleUndo = () => {
        setEdits(prev => prev.slice(0, -1));
    };
    
    const handleClear = () => {
        setEdits([]);
    };

    const handleGenerate = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsLoading(true);
        setError(null);
        try {
            const editedImage = canvas.toDataURL('image/jpeg', 0.9);
            const newImageUrl = await iterateDesign(editedImage);
            if (newImageUrl) {
                onDesignGenerated(newImageUrl);
            } else {
                throw new Error("The AI did not return a new image.");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during design iteration.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex flex-col items-center justify-center p-4" aria-modal="true">
            <div className="w-full h-full flex items-center justify-center relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-30">
                        <Spinner className="w-16 h-16" />
                        <p className="mt-4 text-white text-lg font-semibold">AI is iterating on your design...</p>
                    </div>
                )}
                {error && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md z-40 max-w-sm text-center">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline ml-2">{error}</span>
                        <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}
                
                {/* Main Content Area */}
                <div className="w-full h-full flex items-center justify-center p-4 pl-28">
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-white"
                        style={{ cursor: selectedTool.type === 'brush' ? 'crosshair' : 'text' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>

                {/* Vertical Toolbar */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex flex-col gap-1">
                    {designBrushes.map(brush => (
                        <button
                            key={brush.label}
                            onClick={() => setSelectedTool(brush)}
                            className={`w-14 h-12 rounded-md transition-all duration-150 border-4 ${selectedTool.type === 'brush' && selectedTool.color === brush.color ? 'border-teal-500 scale-110' : 'border-transparent hover:border-gray-300'}`}
                            title={brush.label}
                        >
                             <div className="w-full h-full rounded-sm" style={{ backgroundColor: brush.color }}></div>
                        </button>
                    ))}
                     <div className="border-t border-slate-200 my-1"></div>
                    <button onClick={() => setSelectedTool(textTool)} className={`p-3 rounded-md transition-colors ${selectedTool.type === 'text' ? 'bg-teal-500 text-white' : 'hover:bg-slate-100'}`} title="Add Text Label">
                        <TypeIcon className="w-6 h-6"/>
                    </button>
                    <div className="border-t border-slate-200 my-1"></div>
                    <button onClick={handleUndo} className="p-3 rounded-md hover:bg-slate-100 disabled:opacity-50" title="Undo" disabled={edits.length === 0}><UndoIcon className="w-6 h-6"/></button>
                    <button onClick={handleClear} className="p-3 rounded-md hover:bg-slate-100 disabled:opacity-50" title="Clear All" disabled={edits.length === 0}><TrashIcon className="w-6 h-6"/></button>
                </div>

                {/* Top Action Bar */}
                <div className="absolute top-4 right-4 flex gap-4">
                     <button
                        onClick={handleGenerate}
                        disabled={isLoading || edits.length === 0}
                        className="btn btn-primary gap-2"
                    >
                        <MagicWandIcon className="w-6 h-6"/>
                        Iterate with AI
                    </button>
                    <button onClick={onClose} className="p-3 bg-white rounded-full shadow-md hover:bg-gray-200">
                        <XIcon className="w-6 h-6"/>
                    </button>
                </div>

                 {/* Current Tool Indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm">
                    Selected Tool: <span className="font-bold">{selectedTool.label}</span>
                </div>

            </div>
        </div>
    );
};