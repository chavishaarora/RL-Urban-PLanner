import React from 'react';
import { HousingOptionsData } from '../types';
import { HomeIcon } from './Icons';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

interface HousingOptionsProps {
    options: HousingOptionsData;
    onChange: (newOptions: HousingOptionsData) => void;
    disabled?: boolean;
}

const unitMixOptions: CustomSelectOption[] = [
    { value: 'A mix of 1BHK and 2BHK units', label: '1 & 2 BHK Mix' },
    { value: 'A mix of 2BHK and 3BHK units', label: '2 & 3 BHK Mix' },
    { value: 'Primarily 3BHK+ units', label: '3BHK+ Apartments' },
    { value: 'Studio and 1BHK apartments', label: 'Studio & 1BHK' },
    { value: 'Detached or semi-detached villas', label: 'Villas' },
    { value: 'Co-living pods or micro-units', label: 'Co-living / Pods' },
];

const incomeGroupOptions: CustomSelectOption[] = [
    { value: 'Affordable / Low-Income Group (LIG)', label: 'Affordable / LIG' },
    { value: 'Middle-Income Group (MIG)', label: 'Middle-Income (MIG)' },
    { value: 'High-Income Group (HIG) / Luxury', label: 'High-Income (HIG)' },
    { value: 'Mixed-Income Community', label: 'Mixed-Income' },
    { value: 'Student or Young Professional Housing', label: 'Student / Co-living' },
];

const maxFloorsOptions: CustomSelectOption[] = [
    { value: '2', label: '1-2 Floors (Villas/Townhouses)' },
    { value: '4', label: '3-4 Floors (Low-rise Apartments)' },
    { value: '8', label: '5-8 Floors (Mid-rise Apartments)' },
    { value: '12', label: '9-12 Floors (Mid-rise Tower)' },
    { value: '20', label: '13+ Floors (High-rise Tower)' },
];

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-sm font-medium text-slate-700 mb-1">
        {children}
    </label>
);

export const HousingOptions: React.FC<HousingOptionsProps> = ({ options, onChange, disabled }) => {

    const handleChange = (field: keyof HousingOptionsData, value: string | number) => {
        onChange({ ...options, [field]: value });
    };

    return (
        <div className="border-t-2 border-dashed border-slate-200 pt-6">
            <div className="flex items-start gap-4 mb-4">
                <div className="bg-teal-100 p-2 rounded-lg mt-1">
                    <HomeIcon className="w-6 h-6 text-teal-600"/>
                </div>
                <div>
                    <h4 className="text-lg font-bold text-slate-900">Housing Project Details</h4>
                    <p className="text-sm text-slate-600">Provide specific requirements for the housing analysis.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label>Unit Mix</Label>
                    <CustomSelect
                        options={unitMixOptions}
                        value={options.unitMix}
                        onChange={(val) => handleChange('unitMix', val)}
                        disabled={disabled}
                    />
                </div>
                <div>
                    <Label>Target Income Group</Label>
                     <CustomSelect
                        options={incomeGroupOptions}
                        value={options.incomeGroup}
                        onChange={(val) => handleChange('incomeGroup', val)}
                        disabled={disabled}
                    />
                </div>
                <div>
                    <Label>Maximum Floors</Label>
                    <CustomSelect
                        options={maxFloorsOptions}
                        value={String(options.maxFloors)}
                        onChange={(val) => handleChange('maxFloors', parseInt(val, 10))}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};