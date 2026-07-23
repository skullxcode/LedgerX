import React from 'react';
import { Modal } from '../ui/Modal';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts & Quick Guide">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        
        {/* POS Shortcuts */}
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            POS / Checkout Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between items-center p-2.5 bg-surface-container rounded-lg border border-outline-variant">
              <span className="text-on-surface font-medium">Focus Item Search</span>
              <kbd className="px-2 py-1 bg-surface border border-outline rounded font-mono text-xs font-bold text-primary">Ctrl + K</kbd>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-surface-container rounded-lg border border-outline-variant">
              <span className="text-on-surface font-medium">Toggle Payment Mode</span>
              <kbd className="px-2 py-1 bg-surface border border-outline rounded font-mono text-xs font-bold text-primary">Ctrl + B</kbd>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-surface-container rounded-lg border border-outline-variant col-span-1 sm:col-span-2">
              <span className="text-on-surface font-medium">Complete Checkout / Save Quote</span>
              <kbd className="px-2 py-1 bg-surface border border-outline rounded font-mono text-xs font-bold text-primary">Ctrl + Enter</kbd>
            </div>
          </div>
        </div>

        {/* Navigation & Help Shortcuts */}
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">navigation</span>
            Global Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between items-center p-2.5 bg-surface-container rounded-lg border border-outline-variant">
              <span className="text-on-surface font-medium">Open Help / Guide</span>
              <kbd className="px-2 py-1 bg-surface border border-outline rounded font-mono text-xs font-bold text-primary">?</kbd>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-surface-container rounded-lg border border-outline-variant">
              <span className="text-on-surface font-medium">Close Overlays / Modals</span>
              <kbd className="px-2 py-1 bg-surface border border-outline rounded font-mono text-xs font-bold text-primary">Esc</kbd>
            </div>
          </div>
        </div>

        {/* Key Features & Tips */}
        <div className="border-t border-outline-variant pt-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            Pro Tips
          </h3>
          <ul className="list-disc list-inside text-xs text-secondary space-y-1.5 leading-relaxed">
            <li>Notifications automatically track low stock, active repairs, and overdue balances in real-time.</li>
            <li>Clicking on any customer or vendor card opens their details and payment options.</li>
            <li>Use the <strong>Export CSV</strong> button on ledger tables to generate financial spreadsheets.</li>
            <li>You can print invoices natively using <kbd className="px-1 bg-surface border rounded font-mono">Ctrl + P</kbd>.</li>
          </ul>
        </div>

        <div className="flex justify-end pt-4 border-t border-outline-variant">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
};
