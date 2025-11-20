import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

export interface CustomSelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    options: CustomSelectOption[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    
    const selectedOption = options.find(opt => opt.value === value);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleOptionClick = (newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="form-input flex justify-between items-center disabled:opacity-50"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="truncate">{selectedOption?.label || 'Select...'}</span>
                {isOpen ? <ChevronUpIcon className="w-5 h-5 text-slate-400" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400" />}
            </button>
            
            {isOpen && (
                <ul
                    className="absolute z-10 mt-2 w-full bg-white shadow-lg border border-slate-200 rounded-xl max-h-60 overflow-auto focus:outline-none animate-fade-in custom-scrollbar"
                    tabIndex={-1}
                    role="listbox"
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.05)' }}
                >
                    {options.map((option, index) => (
                        <li
                            key={option.value}
                            onClick={() => handleOptionClick(option.value)}
                            className={`px-4 py-3 text-sm text-slate-800 cursor-pointer transition-all duration-200 ${
                                value === option.value 
                                    ? 'bg-gradient-to-r from-teal-50 to-cyan-50 font-semibold text-teal-700 border-l-2 border-teal-500' 
                                    : 'font-normal hover:bg-slate-50'
                            } ${index === 0 ? 'rounded-t-xl' : ''} ${index === options.length - 1 ? 'rounded-b-xl' : 'border-b border-slate-100'}`}
                            role="option"
                            aria-selected={value === option.value}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};