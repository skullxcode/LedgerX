import React from 'react';

/**
 * A responsive wrapper for data tables.
 */
export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`w-full overflow-x-auto bg-surface rounded-xl border border-outline-variant shadow-sm ${className}`}>
      <table className="w-full border-collapse text-left">
        {children}
      </table>
    </div>
  );
};

/**
 * Table Header container.
 */
export const Thead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-surface-hover border-b border-outline-variant">
    {children}
  </thead>
);

/**
 * Table Header Cell component.
 */
export const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

/**
 * Table Body container.
 */
export const Tbody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="table-body">
    {children}
  </tbody>
);

/**
 * Table Row component. Supports optional click handlers.
 */
export const Tr: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
  <tr 
    onClick={onClick}
    className={`border-b border-outline-variant transition-colors duration-150 ${onClick ? 'cursor-pointer hover:bg-surface-hover' : ''} ${className}`}
  >
    {children}
  </tr>
);

/**
 * Table Data Cell component.
 */
export const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`p-4 text-sm text-text-primary align-middle ${className}`}>
    {children}
  </td>
);
