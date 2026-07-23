import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding scale for the card content */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** If true, removes the default border */
  noBorder?: boolean;
}

/**
 * A basic container component for grouping related content.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', padding = 'md', noBorder = false, children, style, ...props }, ref) => {
    const paddingClasses = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const baseClasses = 'bg-surface-container-lowest rounded-lg transition-all';
    const borderClasses = noBorder ? '' : 'border border-outline-variant';
    const paddingClass = paddingClasses[padding] || paddingClasses.md;

    return (
      <div 
        ref={ref} 
        className={`${baseClasses} ${borderClasses} ${paddingClass} ${className}`.trim()} 
        style={style} 
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
