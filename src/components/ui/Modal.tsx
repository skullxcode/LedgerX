import React from 'react';

export interface ModalProps {
  /** Determines if the modal is currently visible */
  isOpen: boolean;
  /** Callback fired when the modal requests to be closed */
  onClose: () => void;
  /** Optional title displayed in the modal header */
  title?: string;
  /** The content of the modal */
  children: React.ReactNode;
  /** Custom max-width for the modal */
  width?: string;
}

/**
 * A standardized modal dialog component.
 * Uses a fixed overlay to block interactions with the background.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = '500px' }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog Window */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-xl shadow-md z-[51] w-[90%] max-h-[90vh] flex flex-col overflow-hidden"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface">
            <h3 className="m-0 text-lg font-semibold">{title}</h3>
            <button 
              onClick={onClose}
              aria-label="Close modal"
              className="bg-transparent border-none text-xl cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
};
