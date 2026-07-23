import React from 'react';

export interface ConfirmationDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Called when the user clicks Cancel or the backdrop */
  onCancel: () => void;
  /** Called when the user confirms the action */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Message body to display */
  message: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Whether the action is destructive — changes the confirm button to red */
  isDestructive?: boolean;
  /** Whether the confirm button is in a loading/processing state */
  isProcessing?: boolean;
}

/**
 * A reusable, accessible confirmation dialog.
 * Replaces window.confirm() with a styled, non-blocking modal.
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = false,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl z-[61] w-[90%] max-w-sm p-6 flex flex-col gap-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-error/10' : 'bg-primary/10'}`}>
            <span className={`material-symbols-outlined text-[22px] ${isDestructive ? 'text-error' : 'text-primary'}`}>
              {isDestructive ? 'warning' : 'help'}
            </span>
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="font-bold text-on-surface text-base leading-tight">{title}</h3>
            <p id="confirm-dialog-message" className="text-on-surface-variant text-sm mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              isDestructive
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {isProcessing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
};
