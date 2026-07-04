import React from 'react';

export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div 
      className={className}
      style={{
        width: '100%',
        overflowX: 'auto',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        {children}
      </table>
    </div>
  );
};

export const Thead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead style={{ backgroundColor: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-light)' }}>
    {children}
  </thead>
);

export const Th: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <th style={{ 
    padding: 'var(--space-3) var(--space-4)', 
    fontSize: '12px', 
    fontWeight: 600, 
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    ...style 
  }}>
    {children}
  </th>
);

export const Tbody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="table-body">
    {children}
  </tbody>
);

export const Tr: React.FC<{ children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }> = ({ children, onClick, style }) => (
  <tr 
    onClick={onClick}
    style={{ 
      borderBottom: '1px solid var(--border-light)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background-color 0.15s ease',
      ...style
    }}
    onMouseEnter={(e) => onClick && (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
    onMouseLeave={(e) => onClick && (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    {children}
  </tr>
);

export const Td: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <td style={{ 
    padding: 'var(--space-4)', 
    fontSize: '14px',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
    ...style 
  }}>
    {children}
  </td>
);
