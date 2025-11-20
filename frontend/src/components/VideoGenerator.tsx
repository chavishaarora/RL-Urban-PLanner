import React, { useState } from 'react';
import { generateParkVideo, VideoGenerationProgress, VideoGenerationOptions } from '@/services/videoService';
import { XIcon, Spinner } from './Icons';

interface VideoGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    designImageUrl: string;
    parkName: string;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ 
    isOpen, 
    onClose, 
    designImageUrl, 
    parkName 
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<VideoGenerationProgress | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    // Configuration state
    const [timeOfDay, setTimeOfDay] = useState<'day' | 'night' | 'day-to-night'>('day-to-night');
    const [activities, setActivities] = useState<string[]>(['walking', 'playing', 'dogs']);
    const [duration, setDuration] = useState(5);

    const activityOptions = [
        { id: 'walking', label: 'Walking' },
        { id: 'playing', label: 'Playing' },
        { id: 'dogs', label: 'Dogs' },
        { id: 'cycling', label: 'Cycling' },
        { id: 'sitting', label: 'Relaxing' },
        { id: 'jogging', label: 'Jogging' },
        { id: 'picnic', label: 'Picnic' },
        { id: 'sports', label: 'Sports' },
    ];

    const toggleActivity = (activityId: string) => {
        setActivities(prev => 
            prev.includes(activityId) 
                ? prev.filter(a => a !== activityId)
                : [...prev, activityId]
        );
    };
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        setVideoUrl(null);
        setProgress(null);
        
        const options: VideoGenerationOptions = {
            designImageUrl,
            parkName,
            timeOfDay,
            activities,
            duration
        };

        try {
            const url = await generateParkVideo(options, (progressUpdate) => {
                setProgress(progressUpdate);
                if (progressUpdate.videoUrl) {
                    setVideoUrl(progressUpdate.videoUrl);
                }
            });
            
            setVideoUrl(url);
        } catch (error: any) {
            console.error('Video generation failed:', error);
            setProgress({
                status: 'failed',
                message: `Error: ${error.message || 'An unknown error occurred.'}`,
                progress: 0,
                error: error.message
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (videoUrl) {
            const link = document.createElement('a');
            link.href = videoUrl;
            link.download = `${parkName.replace(/\s+/g, '_')}_cinematic_video.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const renderContent = () => {
        if (videoUrl) {
            return (
                 <div className="p-6 space-y-4">
                    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <video
                            src={videoUrl}
                            controls
                            autoPlay
                            loop
                            className="w-full aspect-video"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleDownload}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            Download Video
                        </button>
                        <button
                            onClick={() => {
                                setVideoUrl(null);
                                setProgress(null);
                            }}
                            className="w-full py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 rounded-lg font-semibold transition-colors"
                        >
                            Generate Another
                        </button>
                    </div>
                </div>
            )
        }
        
        return (
            <div className="p-6 space-y-6">
                {/* Time of Day */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Time of Day
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { value: 'day', label: 'Day' },
                            { value: 'night', label: 'Night' },
                            { value: 'day-to-night', label: 'Day → Night' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setTimeOfDay(option.value as any)}
                                className={`p-4 rounded-lg border-2 transition-all text-center ${
                                    timeOfDay === option.value
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="text-sm font-medium">{option.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Activities */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Activities to Include
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {activityOptions.map(option => (
                            <button
                                key={option.id}
                                onClick={() => toggleActivity(option.id)}
                                className={`p-3 rounded-lg border-2 transition-all text-center ${
                                    activities.includes(option.id)
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="text-sm font-medium">{option.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Duration */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Video Duration: {duration} seconds
                    </label>
                    <input
                        type="range"
                        min="3"
                        max="10"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>3s</span>
                        <span>10s</span>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
                     <button
                        onClick={handleGenerate}
                        disabled={isGenerating || activities.length === 0}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
                    >
                        {isGenerating ? <Spinner /> : null}
                        {isGenerating ? "Generating Video..." : "Generate Cinematic Video"}
                    </button>
                    
                    {progress && (
                        <div className={`rounded-lg p-4 ${progress.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            {progress.status === 'failed' ? (
                                <p className="text-sm text-center font-semibold text-red-700 dark:text-red-200">{progress.message}</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {progress.message}
                                        </span>
                                        <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
                                            {Math.round(progress.progress)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${progress.progress}%` }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Cinematic Video Generator</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a stunning video showcase of your park design</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};