import React from 'react';
import { CostEstimate } from '../types';
import { DollarSignIcon } from './Icons';

interface CostEstimatorProps {
    costEstimate: CostEstimate;
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({ costEstimate }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Group items by category
    const groupedItems: { [category: string]: typeof costEstimate.items } = {};
    costEstimate.items.forEach(item => {
        if (!groupedItems[item.category]) {
            groupedItems[item.category] = [];
        }
        groupedItems[item.category].push(item);
    });

    const categoryTotals = Object.entries(groupedItems).map(([category, items]) => ({
        category,
        total: items.reduce((sum, item) => sum + item.totalCost, 0)
    }));

    // Normalize contingency: if the AI returned something absurd (>100%), recompute or clamp.
    const normalizedContingency = (() => {
        if (costEstimate.contingency <= 100) return costEstimate.contingency; // already sane
        // Try to back-calculate from subtotal & totalCost if those are consistent
        if (costEstimate.subtotal > 0 && costEstimate.totalCost > costEstimate.subtotal) {
            const derived = ((costEstimate.totalCost - costEstimate.subtotal) / costEstimate.subtotal) * 100;
            if (derived > 0 && derived <= 100) return Math.round(derived);
        }
        // Fallback clamp to a default reasonable value
        return 15; // default contingency
    })();

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Cost Estimate</h3>
                <p className="text-sm text-slate-500">Detailed project budget breakdown</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
                <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Construction</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(costEstimate.constructionCost)}</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Annual Maintenance</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(costEstimate.maintenanceYearlyCost)}</p>
                </div>
                <div className="p-4 text-center bg-slate-50">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1 font-semibold">Total Project Cost</p>
                    <p className="text-xl font-bold text-teal-800">{formatCurrency(costEstimate.totalCost)}</p>
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="p-4 space-y-3">
                <h4 className="font-semibold text-sm text-slate-800 mb-3">Cost by Category</h4>
                {categoryTotals.map(({ category, total }) => (
                    <div key={category} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{category}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
                    </div>
                ))}
            </div>

            {/* Detailed Items Table */}
            <div className="border-t border-slate-200">
                <details className="group">
                    <summary className="cursor-pointer px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">View Detailed Breakdown</span>
                        <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr className="text-left">
                                    <th className="px-4 py-2 font-semibold text-slate-800">Item</th>
                                    <th className="px-4 py-2 font-semibold text-slate-800 text-right">Quantity</th>
                                    <th className="px-4 py-2 font-semibold text-slate-800 text-right">Unit Cost</th>
                                    <th className="px-4 py-2 font-semibold text-slate-800 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {Object.entries(groupedItems).map(([category, items]) => (
                                    <React.Fragment key={category}>
                                        <tr className="bg-slate-100/50">
                                            <td colSpan={4} className="px-4 py-2 font-semibold text-xs uppercase text-slate-600">
                                                {category}
                                            </td>
                                        </tr>
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-slate-800">{item.item}</td>
                                                <td className="px-4 py-2 text-right text-slate-600">
                                                    {item.quantity.toFixed(1)} {item.unit}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-600">
                                                    {formatCurrency(item.unitCost)}
                                                </td>
                                                <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                                    {formatCurrency(item.totalCost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>

            {/* Footer Notes */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="text-xs text-slate-600 space-y-1">
                    <p><strong>Note:</strong> Costs include {normalizedContingency}% contingency for unforeseen expenses.</p>
                    <p>Estimates are based on typical market rates and may vary by location and material availability.</p>
                </div>
            </div>
        </div>
    );
};