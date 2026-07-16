import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', fullWidth, children, style, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded transition-all outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeClasses = {
      sm: 'h-8 px-3 text-label-md',
      md: 'h-10 px-4 text-body-md',
      lg: 'h-12 px-6 text-body-lg',
    };
    
    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-primary/90 border border-transparent',
      secondary: 'bg-white text-on-surface border border-outline-variant hover:bg-surface-container shadow-sm',
      ghost: 'bg-transparent text-secondary hover:bg-surface-container border border-transparent',
      danger: 'bg-error text-white hover:bg-error/90 border border-transparent',
    };
    
    const widthClass = fullWidth ? 'w-full' : '';

    const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`.replace(/\s+/g, ' ').trim();

    return (
      <button
        ref={ref}
        className={combinedClasses}
        style={style}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
