import React from 'react';
import { ExtractedPdfStats } from '../types';
import { DocumentStatsIcon } from './Icons';

interface ExtractedStatsDisplayProps {
    stats: ExtractedPdfStats;
}

// FIX: Allow 'value' prop to be a number to handle numeric stats.
const StatItem: React.FC<{ label: string; value: string | string[] | number }> = ({ label, value }) => (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
        <dt className="text-sm font-medium leading-6 text-gray-900 dark:text-gray-200">{label}</dt>
        <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-400 sm:col-span-2 sm:mt-0">
            {Array.isArray(value) ? value.join(', ') : value}
        </dd>
    </div>
);

export const ExtractedStatsDisplay: React.FC<ExtractedStatsDisplayProps> = ({ stats }) => {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-6">
            <div className="px-4 sm:px-0">
                <div className="flex items-center gap-3">
                    <DocumentStatsIcon className="w-8 h-8 text-blue-600 dark:text-blue-400"/>
                    <div>
                        <h3 className="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">{stats.park_name}</h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">Extracted Park Details</p>
                    </div>
                </div>
            </div>
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700">
                <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                    <StatItem label="Park Area (Hectares)" value={stats.park_area_hectares} />
                    <StatItem label="Hardscape" value={`${stats.hardscape_percent}%`} />
                    <StatItem label="Softscape" value={`${stats.softscape_percent}%`} />
                    <StatItem label="Tree Canopy" value={`${stats.tree_canopy_percent}%`} />
                    <StatItem label="Surrounding Building Height" value={`${stats.building_height_stories} stories`} />
                    <StatItem label="Main Zones" value={stats.main_zones} />
                    <StatItem label="Dominant Activities" value={stats.dominant_activities} />
                    <StatItem label="Sun Exposure" value={stats.sun_exposure} />
                    <StatItem label="Access Points" value={stats.access_points} />
                    <StatItem label="Environmental Features" value={stats.environmental_features} />
                    <StatItem label="Summary" value={stats.summary} />
                </dl>
            </div>
        </div>
    );
};