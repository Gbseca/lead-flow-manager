
import React from 'react';

interface ProgressBarProps {
    total: number;
    processed: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ total, processed }) => {
    const percentage = total > 0 ? (processed / total) * 100 : 0;

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1 text-xs font-semibold text-[var(--text-secondary)]">
                <span>Progresso</span>
                <span>{processed} / {total}</span>
            </div>
            <div className="w-full bg-[var(--bg-primary)] rounded-full h-2.5">
                <div 
                    className="bg-[var(--accent)] h-2.5 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};
