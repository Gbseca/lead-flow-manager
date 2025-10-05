
import React, { useState, useEffect } from 'react';
import type { PersistentLead } from '../types';
import { PhoneIcon, StarIcon, WhatsAppIcon } from './icons';

interface PersistentLeadCardProps {
  lead: PersistentLead;
  onUpdate: (wa: string, updates: Partial<PersistentLead>) => void;
  onRemove: (wa: string) => void;
  onOpenWhatsApp: (lead: PersistentLead) => void;
}

export const PersistentLeadCard: React.FC<PersistentLeadCardProps> = ({ lead, onUpdate, onRemove, onOpenWhatsApp }) => {
  const [note, setNote] = useState(lead.note || '');
  const [schedule, setSchedule] = useState(lead.scheduleISO || '');
  const [priority, setPriority] = useState(lead.priority || 3);
  const [countdown, setCountdown] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      if (!lead.scheduleISO) {
        setCountdown('');
        return;
      }
      const then = new Date(lead.scheduleISO).getTime();
      const now = Date.now();
      const diff = then - now;

      if (diff <= 0) {
        setCountdown('Atrasado');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) setCountdown(`${days}d ${hours}h`);
      else if (hours > 0) setCountdown(`${hours}h ${minutes}m`);
      else setCountdown(`${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000); // update every 30 seconds
    return () => clearInterval(interval);
  }, [lead.scheduleISO]);


  const handleSave = () => {
    const updates: Partial<PersistentLead> = { scheduleISO: schedule, priority };
    if (note !== lead.note) {
        updates.note = note;
        const newHistoryEntry = { timestamp: Date.now(), text: lead.note || '' };
        updates.noteHistory = [newHistoryEntry, ...(lead.noteHistory || [])];
    }
    onUpdate(lead.wa, updates);
  };
  
  const handleSnooze = () => {
    const now = new Date();
    const currentSchedule = lead.scheduleISO ? new Date(lead.scheduleISO) : now;
    const newTime = (currentSchedule.getTime() > now.getTime() ? currentSchedule : now).getTime() + 15 * 60 * 1000;
    
    const newScheduleDate = new Date(newTime);
    // Format to YYYY-MM-DDTHH:mm
    const formatted = newScheduleDate.toISOString().slice(0, 16);
    
    setSchedule(formatted);
    onUpdate(lead.wa, { scheduleISO: formatted });
  };
  
  const initials = (lead.name || '--').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const isOverdue = lead.overdue;

  return (
    <div className={`relative rounded-lg p-4 border ${isOverdue ? 'border-[var(--danger)] bg-[var(--danger)]/10' : 'border-[var(--warning)]/50 bg-[var(--warning)]/10'} hover:border-[var(--warning)] transition-colors animate-card-entry`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center font-bold text-xl text-[var(--warning)]">{initials}</div>
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)] truncate">{lead.name}</p>
              <p className="text-sm text-[var(--text-secondary)] font-mono">{lead.display}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
               <a href={lead.tel} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--success)] text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"><PhoneIcon className="w-5 h-5" /></a>
                <button onClick={() => onOpenWhatsApp(lead)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--success)] text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"><WhatsAppIcon /></button>
                <button onClick={() => onRemove(lead.wa)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--warning)] text-[var(--warning)] hover:text-[var(--accent-text)] transition-colors">
                    <StarIcon solid={true} className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Observação</label>
            {lead.noteHistory && lead.noteHistory.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-[var(--accent)] hover:underline">
                    {showHistory ? 'Ocultar Histórico' : 'Ver Histórico'}
                </button>
            )}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleSave}
            placeholder="Adicione uma nota..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--warning)] focus:border-[var(--warning)]"
            rows={2}
          ></textarea>
           {showHistory && (
             <div className="mt-2 p-2 bg-[var(--bg-primary)] rounded-md max-h-32 overflow-y-auto">
                {lead.noteHistory?.map(entry => (
                    <div key={entry.timestamp} className="text-xs text-[var(--text-secondary)] border-b border-[var(--border-primary)] last:border-b-0 py-1">
                        <span className="font-semibold text-[var(--text-tertiary)]">{new Date(entry.timestamp).toLocaleString()}:</span>
                        <p className="whitespace-pre-wrap">{entry.text || 'Nota vazia'}</p>
                    </div>
                ))}
             </div>
           )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Agendamento</label>
            <div className="relative">
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                onBlur={handleSave}
                className="w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--warning)] focus:border-[var(--warning)]"
              />
              {countdown && <span className={`absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-xs font-bold ${countdown === 'Atrasado' ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'} bg-[var(--bg-tertiary)] px-2 py-0.5 rounded`}>{countdown}</span>}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              onBlur={handleSave}
              className="w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--warning)] focus:border-[var(--warning)]"
            >
              <option value="1">1 (Mais alta)</option>
              <option value="2">2</option>
              <option value="3">3 (Normal)</option>
              <option value="4">4</option>
              <option value="5">5 (Mais baixa)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={handleSnooze} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--warning)]/20 hover:bg-[var(--warning)]/40 text-[var(--warning)] transition-colors">Adiar 15min</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] transition-colors">Salvar Alterações</button>
      </div>
    </div>
  );
};
