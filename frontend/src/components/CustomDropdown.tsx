import React, { useState, useRef, useEffect } from 'react';

interface CustomDropdownProps {
    value: string | number;
    onChange: (value: string | number) => void;
    options: { value: string | number; label: string; isSpecial?: boolean }[];
    className?: string;
    placeholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    value,
    onChange,
    options,
    className = '',
    placeholder = 'Select...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (optionValue: string | number) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 text-sm border-2 border-slate-200 rounded-full bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-300 transition-all duration-300 hover:border-teal-200 hover:shadow-md transform hover:scale-105 flex items-center justify-between gap-2"
            >
                <span className="truncate">{selectedOption?.label || placeholder}</span>
                <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu - Opens Upward */}
            {isOpen && (
                <div className="absolute z-50 w-full bottom-full mb-2 bg-white/95 backdrop-blur-xl border-2 border-teal-300 rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {options.map((option, index) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`w-full px-5 py-3 text-sm transition-all duration-200 flex items-center justify-between group
                                    ${option.value === value 
                                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold' 
                                        : 'text-slate-700 hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 hover:text-teal-700'
                                    }
                                    ${option.isSpecial ? 'border-t-2 border-slate-200 mt-2 font-semibold !text-teal-600' : ''}
                                    ${index === 0 ? 'rounded-t-3xl' : ''}
                                    ${index === options.length - 1 ? 'rounded-b-3xl' : ''}
                                `}
                            >
                                <span>{option.label}</span>
                                {option.value === value && (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

