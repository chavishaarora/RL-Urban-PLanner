import React from 'react';

interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
    isActive?: boolean;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth,
    isActive,
    className = '',
    children,
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const variantStyles = {
        primary: `bg-teal-500 text-white hover:bg-teal-600 focus:ring-teal-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
        secondary: `bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
        outline: `border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
        ghost: `text-slate-600 hover:bg-slate-100 focus:ring-slate-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`,
    };

    const activeStyles = isActive ? {
        primary: 'bg-teal-600',
        secondary: 'bg-slate-200',
        outline: 'bg-slate-100 border-slate-300',
        ghost: 'bg-slate-100',
    }[variant] : '';

    return (
        <button
            className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${activeStyles} ${fullWidth ? 'w-full' : ''} ${className}`}
            disabled={disabled}
            {...props}
        >
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </button>
    );
};