

import React, { useState, useEffect, memo } from 'react';
import type { PersistentLead } from '../types';
import { PhoneIcon, StarIcon, WhatsAppIcon, InformationCircleIcon } from './icons';

interface PersistentLeadCardProps {
  lead: PersistentLead;
  onUpdate: (wa: string, updates: Partial<PersistentLead>) => void;
  onRemove: (wa: string) => void;
  onOpenWhatsApp: (lead: PersistentLead) => void;
  onOpenDetails: (wa: string) => void;
}

export const PersistentLeadCard: React.FC<PersistentLeadCardProps> = memo(({ lead, onUpdate, onRemove, onOpenWhatsApp, onOpenDetails }) => {
  const [schedule, setSchedule] = useState(lead.scheduleISO || '');
  const [priority, setPriority] = useState(lead.priority || 3);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    setSchedule(lead.scheduleISO || '');
  }, [lead.scheduleISO]);

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
    onUpdate(lead.wa, updates);
  };
  
  const handleQuickSchedule = (minutes: number) => {
    const now = new Date();
    const currentSchedule = lead.scheduleISO ? new Date(lead.scheduleISO) : now;
    const newTime = (currentSchedule.getTime() > now.getTime() ? currentSchedule : now).getTime() + minutes * 60 * 1000;
    
    const newScheduleDate = new Date(newTime);
    const formatted = newScheduleDate.toISOString().slice(0, 16);
    
    setSchedule(formatted);
    onUpdate(lead.wa, { scheduleISO: formatted });
  };
  
  const handleTomorrow9AM = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const formatted = tomorrow.toISOString().slice(0, 16);
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
                <button onClick={() => onOpenDetails(lead.wa)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--success)] text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"><InformationCircleIcon className="w-5 h-5" /></button>
                <button onClick={() => onRemove(lead.wa)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--warning)] text-[var(--warning)] hover:text-[var(--accent-text)] transition-colors">
                    <StarIcon solid={true} className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 space-y-3">
        {lead.note && (
             <div className="p-2 bg-[var(--bg-primary)]/50 rounded-md text-sm text-[var(--text-secondary)] italic truncate">
                "{lead.note}"
             </div>
        )}
        
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

      <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
            <button onClick={() => handleQuickSchedule(15)} className="px-3 py-1 text-xs font-semibold rounded-md bg-[var(--warning)]/20 hover:bg-[var(--warning)]/40 text-[var(--warning)] transition-colors">15min</button>
            <button onClick={() => handleQuickSchedule(60)} className="px-3 py-1 text-xs font-semibold rounded-md bg-[var(--warning)]/20 hover:bg-[var(--warning)]/40 text-[var(--warning)] transition-colors">+1h</button>
            <button onClick={() => handleQuickSchedule(24 * 60)} className="px-3 py-1 text-xs font-semibold rounded-md bg-[var(--warning)]/20 hover:bg-[var(--warning)]/40 text-[var(--warning)] transition-colors">+1d</button>
            <button onClick={handleTomorrow9AM} className="px-3 py-1 text-xs font-semibold rounded-md bg-[var(--warning)]/20 hover:bg-[var(--warning)]/40 text-[var(--warning)] transition-colors">Amanhã 9h</button>
        </div>
      </div>
    </div>
  );
});