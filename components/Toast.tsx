
import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  duration?: number;
  onDismiss: () => void;
  type?: 'accent' | 'success';
  action?: {
    label: string;
    onAction: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({ message, duration = 5000, onDismiss, type = 'accent', action }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const handleActionClick = () => {
    if (action) {
      action.onAction();
      onDismiss();
    }
  };

  const colors = {
    accent: 'bg-[var(--accent)] text-[var(--accent-text)]',
    success: 'bg-[var(--success)] text-white',
  }

  return (
    <div className={`fixed bottom-5 right-5 py-2 px-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in-up z-50 ${colors[type]}`}>
      <span>{message}</span>
      {action && (
        <button
          onClick={handleActionClick}
          className={`font-bold uppercase text-sm ${type === 'accent' ? 'bg-[var(--accent-text)]/10' : 'bg-white/20'} px-2 py-0.5 rounded hover:bg-white/30`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};


// Add keyframes for animation in a style tag if not using a CSS file
const style = document.createElement('style');
style.innerHTML = `
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.3s ease-out forwards;
  }
`;
document.head.appendChild(style);