import React, { useState, useEffect } from 'react';
import type { Lead, CustomStatus, PowerHourSession } from '../types';
import { NextUpCard } from './NextUpCard';
import { AICoachPanel } from './AICoachPanel';
import { XMarkIcon } from './icons';

interface PowerHourViewProps {
    session: PowerHourSession;
    lead: Lead | null;
    onUpdate: (id: string, updates: Partial<Lead>) => void;
    onOpenWhatsApp: (lead: Lead) => void;
    customStatuses: CustomStatus[];
    onAddCoachMessage: (text: string) => void;
    onStop: () => void;
}

const Timer: React.FC<{ startTime: number, duration: number }> = ({ startTime, duration }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = duration * 60 - elapsed;
            if (remaining <= 0) {
                setTimeLeft('00:00');
                clearInterval(interval);
                return;
            }
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);
            setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, duration]);

    return <div className="text-5xl font-bold font-mono text-[var(--accent)]">{timeLeft}</div>
};

export const PowerHourView: React.FC<PowerHourViewProps> = (props) => {
    const { session, lead, onUpdate, onOpenWhatsApp, customStatuses, onAddCoachMessage, onStop } = props;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)]">Power Hour</h1>
                    <p className="text-[var(--text-secondary)]">Sessão de Foco Total</p>
                </div>
                <Timer startTime={session.startTime} duration={session.duration} />
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {lead ? (
                        <NextUpCard
                            key={lead.id}
                            lead={lead}
                            onUpdate={onUpdate}
                            onOpenWhatsApp={onOpenWhatsApp}
                            customStatuses={customStatuses}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-[var(--bg-secondary)] rounded-lg p-8 text-center">
                            <h2 className="text-3xl font-bold text-[var(--success)]">Fila Concluída!</h2>
                            <p className="text-[var(--text-secondary)] mt-2">Você processou todos os leads da sua fila de Power Hour.</p>
                        </div>
                    )}
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 flex flex-col border border-[var(--border-primary)]">
                    <h3 className="text-xl font-bold mb-4">Metas & Coach</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-[var(--bg-primary)] p-3 rounded-md text-center">
                            <div className="text-3xl font-bold">{session.progress.calls} / {session.goals.calls}</div>
                            <div className="text-sm text-[var(--text-secondary)]">Chamadas</div>
                        </div>
                         <div className="bg-[var(--bg-primary)] p-3 rounded-md text-center">
                            <div className="text-3xl font-bold text-[var(--success)]">{session.progress.positives} / {session.goals.positives}</div>
                            <div className="text-sm text-[var(--text-secondary)]">Positivos</div>
                        </div>
                    </div>
                    
                    <AICoachPanel
                        lead={lead}
                        messages={session.coachMessages}
                        onAddCoachMessage={onAddCoachMessage}
                    />
                </div>
            </div>

            <footer className="mt-6 text-center">
                <button onClick={onStop} className="flex items-center gap-2 mx-auto px-4 py-2 text-sm font-semibold rounded-md bg-[var(--danger)]/80 hover:bg-[var(--danger)] text-white transition-colors">
                    <XMarkIcon className="w-5 h-5" /> Encerrar Power Hour
                </button>
            </footer>
        </div>
    );
};
