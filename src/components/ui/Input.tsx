import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional label to display above the input */
  label?: string;
  /** Optional error message to display below the input */
  error?: string;
  /** If true, the input spans the full width of its container */
  fullWidth?: boolean;
  /** Optional icon to display on the left side of the input */
  leftIcon?: React.ReactNode;
  /** Optional icon to display on the right side of the input */
  rightIcon?: React.ReactNode;
}

/**
 * Standardized text input component with built-in label and error handling.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, fullWidth, style, leftIcon, rightIcon, ...props }, ref) => {
    const containerClasses = `flex flex-col gap-1 mb-3 ${fullWidth ? 'w-full' : 'w-auto'}`;
    const labelClasses = 'text-label-md font-medium text-on-surface';
    
    // Adjust padding based on icon presence
    const paddingLeft = leftIcon ? 'pl-10' : 'pl-3';
    const paddingRight = rightIcon ? 'pr-10' : 'pr-3';
    
    const inputClasses = `h-10 ${paddingLeft} ${paddingRight} text-body-md border rounded outline-none transition-colors w-full bg-surface-container-lowest text-on-surface focus:ring-1 focus:ring-primary ${error ? 'border-error' : 'border-outline-variant focus:border-primary'} ${className}`.replace(/\s+/g, ' ').trim();
    const errorClasses = 'text-label-md text-error';

    const generatedId = React.useId();
    const inputId = props.id || generatedId;

    return (
      <div className={containerClasses} style={style}>
        {label && <label htmlFor={inputId} className={labelClasses}>{label}</label>}
        <div className="relative w-full">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={inputClasses}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className={errorClasses}>{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
