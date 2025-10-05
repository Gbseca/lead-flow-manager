import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  duration?: number;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, duration = 2000, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 bg-[var(--accent)] text-[var(--accent-text)] py-2 px-4 rounded-lg shadow-lg animate-fade-in-up z-50">
      {message}
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
