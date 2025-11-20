import React, { useState, useEffect } from 'react';
import { PlanShape, LocationData } from '../types';
import { generateSmartRecommendations, DesignRecommendation } from '@/services/smartRecommendations';

interface SmartRecommendationsPanelProps {
    shapes: PlanShape[];
    location: LocationData | null;
    isVisible: boolean;
    onClose: () => void;
}

export const SmartRecommendationsPanel: React.FC<SmartRecommendationsPanelProps> = ({
    shapes,
    location,
    isVisible,
    onClose
}) => {
    const [recommendations, setRecommendations] = useState<DesignRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (isVisible && shapes.length > 0) {
            loadRecommendations();
        }
    }, [isVisible, shapes, location]);

    const loadRecommendations = async () => {
        setLoading(true);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
            const recs = await generateSmartRecommendations(shapes, location, apiKey);
            setRecommendations(recs);
        } catch (error) {
            console.error('Failed to load recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryColor = (category: string) => {
        const colors = {
            sustainability: 'bg-green-100 text-green-800 border-green-300',
            compliance: 'bg-red-100 text-red-800 border-red-300',
            solar: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            accessibility: 'bg-blue-100 text-blue-800 border-blue-300',
            safety: 'bg-orange-100 text-orange-800 border-orange-300',
            efficiency: 'bg-purple-100 text-purple-800 border-purple-300',
            community: 'bg-pink-100 text-pink-800 border-pink-300'
        };
        return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
    };

    const getCategoryIcon = (category: string) => {
        const icons = {
            sustainability: '🌱',
            compliance: '📋',
            solar: '☀️',
            accessibility: '♿',
            safety: '🛡️',
            efficiency: '⚡',
            community: '👥'
        };
        return icons[category as keyof typeof icons] || '💡';
    };

    const getPriorityBadge = (priority: string) => {
        const styles = {
            high: 'bg-red-500 text-white',
            medium: 'bg-yellow-500 text-white',
            low: 'bg-green-500 text-white'
        };
        return styles[priority as keyof typeof styles] || 'bg-gray-500 text-white';
    };

    const filteredRecommendations = recommendations.filter(rec => 
        filter === 'all' || rec.priority === filter
    );

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">AI Smart Recommendations</h2>
                            <p className="text-sm text-white/80">Context-aware design insights powered by Gemini AI</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="px-6 py-3 border-b border-gray-200 flex gap-2">
                    {['all', 'high', 'medium', 'low'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                filter === f
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f !== 'all' && (
                                <span className="ml-2 text-xs opacity-75">
                                    ({recommendations.filter(r => r.priority === f).length})
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={loadRecommendations}
                        disabled={loading}
                        className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition disabled:opacity-50"
                    >
                        {loading ? '🔄 Analyzing...' : '🔄 Refresh'}
                    </button>
                </div>

                {/* Recommendations List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-600">Analyzing your design with AI...</p>
                            <p className="text-sm text-gray-400 mt-2">Considering location, bylaws, climate, and best practices</p>
                        </div>
                    ) : filteredRecommendations.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🎉</div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Excellent Design!</h3>
                            <p className="text-gray-500">No recommendations at this time. Your design looks great!</p>
                        </div>
                    ) : (
                        filteredRecommendations.map(rec => (
                            <div
                                key={rec.id}
                                className={`border-2 rounded-lg overflow-hidden transition hover:shadow-lg ${getCategoryColor(rec.category)}`}
                            >
                                <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">{getCategoryIcon(rec.category)}</div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityBadge(rec.priority)}`}>
                                                    {rec.priority.toUpperCase()}
                                                </span>
                                                <span className="text-xs font-semibold opacity-60 uppercase">
                                                    {rec.category}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg mb-1">{rec.title}</h3>
                                            <p className="text-sm opacity-80">{rec.description}</p>
                                        </div>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${expandedId === rec.id ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                {expandedId === rec.id && (
                                    <div className="px-4 pb-4 pt-2 border-t border-current/20">
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="font-semibold text-sm mb-1">📊 Expected Impact:</h4>
                                                <p className="text-sm opacity-90">{rec.impact}</p>
                                            </div>
                                            {rec.suggestedAction && (
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">✅ Suggested Action:</h4>
                                                    <p className="text-sm opacity-90">{rec.suggestedAction}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-600">
                            <span className="font-semibold">{filteredRecommendations.length}</span> recommendation{filteredRecommendations.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-gray-500 text-xs">
                            Powered by Google Gemini AI • Context-aware analysis
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
