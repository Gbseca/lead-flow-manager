
import React, { useRef } from 'react';
import type { Lead } from '../types';
import { AttemptResult, FinalResult } from '../types';
import { CheckIcon, XMarkIcon, VoicemailIcon, PauseIcon, StarIcon, PhoneIcon, WhatsAppIcon, PlayIcon } from './icons';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onUpdate: (id: string, updates: Partial<Lead>) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onToggleSelect: (id: string) => void;
}

const getStatusStyles = (lead: Lead): { bg: string; text: string; label: string; border: string; } => {
  const base = { bg: 'bg-[var(--bg-secondary)]', text: 'text-[var(--text-secondary)]', border: 'border-[var(--border-primary)]', label: '' };
  if (lead.locked) {
    if (lead.result === FinalResult.Interested) return { ...base, bg: 'bg-[var(--success)]/10', text: 'text-[var(--success)]', border: 'border-[var(--success)]/30', label: 'Interessado' };
    if (lead.result === FinalResult.Refused) return { ...base, bg: 'bg-[var(--danger)]/10', text: 'text-[var(--danger)]', border: 'border-[var(--danger)]/30', label: 'Recusado' };
  }
  if (lead.onHold) return { ...base, bg: 'bg-[var(--warning)]/10', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30', label: 'Em Aguardo' };
  if (lead.attemptsResults.every(r => r === AttemptResult.Voicemail)) return { ...base, bg: 'bg-[var(--text-tertiary)]/10', text: 'text-[var(--text-tertiary)]', border: 'border-[var(--text-tertiary)]/30', label: 'Voicemail' };
  return base;
};

const AttemptButton = ({ onClick, disabled, isVoicemail, isActive, children }: { onClick: () => void, disabled: boolean, isVoicemail: boolean, isActive: boolean, children: React.ReactNode }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const createConfetti = (button: HTMLButtonElement) => {
    const confettiColors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)'];
    const count = 15;
    for(let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        const size = Math.random() * 5 + 3;
        const angle = Math.random() * 360;
        const distance = Math.random() * 40 + 30;

        confetti.style.position = 'absolute';
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.left = '50%';
        confetti.style.top = '50%';
        confetti.style.transform = 'translate(-50%, -50%)';
        confetti.style.pointerEvents = 'none';
        
        const animation = confetti.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0)`, opacity: 0 }
        ], {
            duration: 600 + Math.random() * 400,
            easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
        });
        
        animation.onfinish = () => confetti.remove();
        button.appendChild(confetti);
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (buttonRef.current && !disabled && !isActive) {
      createConfetti(buttonRef.current);
    }
    onClick();
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      className={`relative w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold border transition-all overflow-hidden
        ${isVoicemail ? 'bg-[var(--bg-tertiary)] border-[var(--border-secondary)] text-[var(--text-secondary)] cursor-not-allowed' : ''}
        ${isActive && !isVoicemail ? 'bg-[var(--accent)] border-[var(--accent-hover)] text-[var(--accent-text)]' : ''}
        ${!isActive && !isVoicemail ? 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-secondary)]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
};

export const LeadCard: React.FC<LeadCardProps> = ({ lead, isSelected, onUpdate, onOpenWhatsApp, onToggleSelect }) => {
  const status = getStatusStyles(lead);

  const handleAttempt = (attemptIndex: 0 | 1 | 2) => {
    if (lead.locked || lead.onHold) return;
    const newAttempts = [...lead.attempts] as [boolean, boolean, boolean];
    if (newAttempts[attemptIndex]) return; // Don't re-trigger for already active attempt
    
    newAttempts[attemptIndex] = true;
    onUpdate(lead.id, { attempts: newAttempts, currentAttempt: attemptIndex + 1 });
  };

  const handleResult = (result: AttemptResult | FinalResult) => {
    if (lead.locked || lead.onHold || lead.currentAttempt === 0) return;
    
    const attemptIndex = lead.currentAttempt - 1;
    if (result === AttemptResult.Voicemail) {
      const newResults = [...lead.attemptsResults] as [AttemptResult | null, AttemptResult | null, AttemptResult | null];
      newResults[attemptIndex] = AttemptResult.Voicemail;
      onUpdate(lead.id, { attemptsResults: newResults });
    } else {
      onUpdate(lead.id, { result, locked: true });
    }
  };

  const handleTogglePersistent = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onUpdate(lead.id, { favorite: !lead.favorite });
  };

  const handleToggleOnHold = () => {
    onUpdate(lead.id, { onHold: !lead.onHold });
  };

  const isAttemptDisabled = (index: number) => {
    if (lead.locked || lead.onHold) return true;
    if (index > 0 && !lead.attemptsResults[index - 1]) return true;
    return false;
  }
  
  const initials = (lead.name || '--').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div 
      onClick={() => onToggleSelect(lead.id)}
      className={`cursor-pointer relative rounded-lg p-4 border transition-all duration-300 hover:border-[var(--accent)] hover:shadow-2xl hover:shadow-[var(--shadow-color-light)] ${status.bg} ${isSelected ? 'border-[var(--accent)] shadow-2xl shadow-[var(--shadow-color-light)]' : status.border} animate-card-entry hover:-translate-y-1 hover:scale-[1.02]`}
    >
      <div className="absolute top-3 left-3 z-10">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded bg-[var(--bg-primary)] border-[var(--border-secondary)] text-[var(--accent)] focus:ring-[var(--accent)]"
        />
      </div>
      {status.label && <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full ${status.bg} ${status.text}`}>{status.label}</div>}
      
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center font-bold text-xl text-[var(--accent)]">{initials}</div>
        <div className="flex-grow min-w-0">
          <p className="text-lg font-bold text-[var(--text-primary)] truncate">{lead.name}</p>
          <p className="text-sm text-[var(--text-secondary)] font-mono">{lead.display}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate italic">"{lead.original}"</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-secondary)] mr-2">Tentativas:</span>
          {[0, 1, 2].map(i => (
            <AttemptButton
              key={i}
              onClick={() => handleAttempt(i as 0 | 1 | 2)}
              disabled={isAttemptDisabled(i)}
              isVoicemail={lead.attemptsResults[i] === AttemptResult.Voicemail}
              isActive={lead.attempts[i]}
            >
              {lead.attemptsResults[i] === AttemptResult.Voicemail ? <VoicemailIcon className="w-4 h-4" /> : i + 1}
            </AttemptButton>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          <a href={lead.tel} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--success)] text-[var(--text-secondary)] hover:text-white transition-colors"><PhoneIcon className="w-5 h-5" /></a>
          <button onClick={() => onOpenWhatsApp(lead)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--success)] text-[var(--text-secondary)] hover:text-white transition-colors"><WhatsAppIcon /></button>
          <button onClick={handleTogglePersistent} className={`p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--warning)] ${lead.favorite ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'} hover:text-white transition-colors`}>
            <StarIcon solid={lead.favorite} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!lead.locked && !lead.onHold && (
        <div className="mt-4 pt-4 border-t border-[var(--border-primary)] flex flex-wrap gap-2 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleResult(AttemptResult.Voicemail)} disabled={lead.currentAttempt === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <VoicemailIcon className="w-4 h-4" /> Voicemail
          </button>
          <button onClick={() => handleResult(FinalResult.Interested)} disabled={lead.currentAttempt === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--success)]/80 hover:bg-[var(--success)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <CheckIcon className="w-4 h-4" /> Interessado
          </button>
          <button onClick={() => handleResult(FinalResult.Refused)} disabled={lead.currentAttempt === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--danger)]/80 hover:bg-[var(--danger)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <XMarkIcon className="w-4 h-4" /> Recusado
          </button>
          <button onClick={handleToggleOnHold} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--warning)]/80 hover:bg-[var(--warning)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <PauseIcon className="w-4 h-4" /> Em Aguardo
          </button>
        </div>
      )}
       {lead.onHold && (
         <div className="mt-4 pt-4 border-t border-[var(--border-primary)] flex justify-end" onClick={e => e.stopPropagation()}>
            <button onClick={handleToggleOnHold} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] transition-colors">
                <PlayIcon className="w-5 h-5" /> Retomar
            </button>
         </div>
       )}
    </div>
  );
};
