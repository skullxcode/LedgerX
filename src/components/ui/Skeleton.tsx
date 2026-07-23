import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'circular' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width, 
  height, 
  variant = 'rectangular' 
}) => {
  const baseClasses = "animate-pulse bg-surface-container-high";
  
  let variantClasses = "";
  if (variant === 'circular') {
    variantClasses = "rounded-full";
  } else if (variant === 'text') {
    variantClasses = "rounded mt-1 mb-1";
  } else {
    variantClasses = "rounded-md";
  }

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={style}
    />
  );
};
