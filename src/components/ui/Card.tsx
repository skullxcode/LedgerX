import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding scale for the card content */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** If true, removes the default border */
  noBorder?: boolean;
  /** If true, adds hover effects (scale, shadow) and pointer cursor */
  interactive?: boolean;
}

/**
 * A basic container component for grouping related content.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', padding = 'md', noBorder = false, interactive = false, children, style, ...props }, ref) => {
    const paddingClasses = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const baseClasses = 'bg-surface-container-lowest rounded-lg transition-all duration-200';
    const borderClasses = noBorder ? '' : 'border border-outline-variant';
    const interactiveClasses = interactive ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]' : '';
    const paddingClass = paddingClasses[padding] || paddingClasses.md;

    return (
      <div 
        ref={ref} 
        className={`${baseClasses} ${borderClasses} ${interactiveClasses} ${paddingClass} ${className}`.trim().replace(/\s+/g, ' ')} 
        style={style} 
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
