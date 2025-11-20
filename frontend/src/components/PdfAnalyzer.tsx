
import React, { useState } from 'react';
import { PdfUploader } from './PdfUploader';
import { ImageFile, ExtractedPdfStats } from '../types';
import { extractStatsFromPdf } from '@/services/geminiService-1';
import { Spinner, DocumentStatsIcon } from './Icons';
import { ExtractedStatsDisplay } from './ExtractedStatsDisplay';

interface PdfAnalyzerProps {
    stats: ExtractedPdfStats | null;
    onStatsExtracted: (stats: ExtractedPdfStats) => void;
}

export const PdfAnalyzer: React.FC<PdfAnalyzerProps> = ({ stats, onStatsExtracted }) => {
    const [pdfFile, setPdfFile] = useState<ImageFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!pdfFile) return;
        setIsLoading(true);
        setError(null);
        try {
            const extracted = await extractStatsFromPdf(pdfFile);
            onStatsExtracted(extracted);
        } catch (err) {
            console.error("Failed to extract stats from PDF:", err);
            setError("An error occurred while analyzing the PDF. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">PDF Report Analyzer</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload an existing urban planning PDF report to automatically extract key statistics and summaries.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <PdfUploader id="pdf-report" label="Upload PDF Report" currentFile={pdfFile} onFileSelect={setPdfFile} />
                     <button
                        onClick={handleAnalyze}
                        disabled={!pdfFile || isLoading}
                        className="w-full mt-4 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Spinner /> : <DocumentStatsIcon className="w-6 h-6 mr-2" />}
                        {isLoading ? 'Analyzing...' : 'Extract Statistics'}
                    </button>
                </div>
                <div>
                    {error && <p className="text-red-500 text-center">{error}</p>}
                    {stats && (
                        <div className="animate-fade-in">
                           <ExtractedStatsDisplay stats={stats} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
