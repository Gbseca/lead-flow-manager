import React from 'react';
import { ExclamationTriangleIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'Confirmar', cancelText = 'Cancelar' }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md m-4 bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-primary)]"
        style={{ animation: 'scale-in 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-[var(--warning)]/10">
                <ExclamationTriangleIcon className="w-6 h-6 text-[var(--warning)]" />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{children}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-[var(--bg-tertiary)]/50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--danger)]/80 hover:bg-[var(--danger)] text-white transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
