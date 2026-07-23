import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The visual style variant of the badge */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * A small status indicator component.
 * Used to display statuses, counts, or small tags.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', children, style, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight';

    const variantClasses = {
      default: 'bg-surface-container text-on-surface-variant',
      success: 'bg-emerald-100 text-emerald-800',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-error-container text-on-error-container',
      info: 'bg-blue-100 text-blue-800',
    };

    const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.replace(/\s+/g, ' ').trim();

    return (
      <span ref={ref} className={combinedClasses} style={style} {...props}>
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
