import React, { useState, useEffect, useRef } from 'react';

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
 * Features keyboard accessibility (Escape to close, focus trap) and smooth transitions.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = '500px' }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Mount/Unmount Animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to allow DOM to render before applying opacity 1
      requestAnimationFrame(() => setIsAnimating(true));
    } else if (shouldRender) {
      setIsAnimating(false);
      // Wait for transition duration (200ms) before unmounting
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  // Handle Keyboard Accessibility (Escape & Focus Trap)
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape to close
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // 2. Focus Trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus first element slightly after mount
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog Window */}
      <div 
        ref={modalRef}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-xl shadow-md z-[51] w-[90%] max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200 ease-out ${
          isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface shrink-0">
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
