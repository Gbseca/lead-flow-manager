

import React from 'react';
import type { Lead, CustomStatus } from '../types';
import { AttemptResult } from '../types';
import { PhoneIcon, WhatsAppIcon, VoicemailIcon, PauseIcon } from './icons';

interface NextUpCardProps {
    lead: Lead;
    onUpdate: (id: string, updates: Partial<Lead>) => void;
    onOpenWhatsApp: (lead: Lead) => void;
    customStatuses: CustomStatus[];
}

export const NextUpCard: React.FC<NextUpCardProps> = ({ lead, onUpdate, onOpenWhatsApp, customStatuses }) => {
    
    const handleAttempt = () => {
        const attemptIndex = lead.currentAttempt;
        if (lead.locked || lead.onHold || attemptIndex >= 3) return;
        
        let attemptToMark = 0;
        if (!lead.attempts[0]) attemptToMark = 0;
        else if (!lead.attempts[1]) attemptToMark = 1;
        else if (!lead.attempts[2]) attemptToMark = 2;
        else return;

        const newAttempts = [...lead.attempts] as [boolean, boolean, boolean];
        newAttempts[attemptToMark] = true;
        
        onUpdate(lead.id, { attempts: newAttempts, currentAttempt: attemptToMark + 1 });
    };

    const handleVoicemail = () => {
        if (lead.currentAttempt > 0) {
            const attemptIndex = lead.currentAttempt - 1;
            const newResults = [...lead.attemptsResults] as [AttemptResult | null, AttemptResult | null, AttemptResult | null];
            newResults[attemptIndex] = AttemptResult.Voicemail;
            onUpdate(lead.id, { attemptsResults: newResults });
        }
    };

    const isActionDisabled = lead.currentAttempt === 0;

    return (
        <div className="bg-gradient-to-r from-[var(--accent)]/10 to-[var(--bg-secondary)] p-6 rounded-lg border-2 border-[var(--accent)] animate-card-entry shadow-2xl shadow-[var(--shadow-color-light)]">
            <h2 className="text-lg font-bold text-[var(--accent)] mb-2">Próximo Lead:</h2>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-grow">
                    <p className="text-3xl font-bold text-[var(--text-primary)]">{lead.name}</p>
                    <p className="text-xl text-[var(--text-secondary)] font-mono mt-1">{lead.display}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={lead.tel} onClick={handleAttempt} className="flex items-center gap-3 px-6 py-3 text-lg font-bold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] transition-colors">
                        <PhoneIcon className="w-6 h-6" /> Ligar
                    </a>
                    <button onClick={() => onOpenWhatsApp(lead)} className="p-4 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">
                        <WhatsAppIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--border-primary)] space-y-3">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Finalizar Lead:</p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleVoicemail} disabled={isActionDisabled} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <VoicemailIcon className="w-4 h-4" /> Voicemail
                    </button>
                    <button onClick={() => onUpdate(lead.id, { onHold: true })} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--warning)]/80 hover:bg-[var(--warning)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <PauseIcon className="w-4 h-4" /> Em Aguardo
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {customStatuses.map(status => (
                        <button 
                            key={status.id} 
                            onClick={() => onUpdate(lead.id, { result: status.id, locked: true })} 
                            disabled={isActionDisabled}
                            style={{ backgroundColor: `${status.color}CC`, color: '#fff' }} 
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}>
                            {status.label}
                        </button>
                    ))}
                </div>
                {isActionDisabled && <p className="text-xs text-[var(--text-tertiary)] italic">Clique em "Ligar" para registrar uma tentativa antes de finalizar.</p>}
            </div>
        </div>
    );
};