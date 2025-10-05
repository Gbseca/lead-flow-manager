
import React from 'react';
import { VoicemailIcon, StarIcon, PauseIcon, XMarkIcon } from './icons';

interface BulkActionBarProps {
  count: number;
  onAttempt: (attempt: 1 | 2 | 3) => void;
  onVoicemail: () => void;
  onToggleFavorite: (favorite: boolean) => void;
  onToggleHold: (onHold: boolean) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  count,
  onAttempt,
  onVoicemail,
  onToggleFavorite,
  onToggleHold,
  onDelete,
  onClearSelection,
}) => {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-secondary)]/90 backdrop-blur-sm border-t border-[var(--border-primary)] shadow-2xl animate-fade-in-up">
      <div className="container mx-auto p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-[var(--text-primary)]">{count} selecionado(s)</span>
          <button onClick={onClearSelection} className="text-sm text-[var(--accent)] hover:underline">Limpar</button>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Marcar Tentativa:</span>
          <button onClick={() => onAttempt(1)} className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">1</button>
          <button onClick={() => onAttempt(2)} className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">2</button>
          <button onClick={() => onAttempt(3)} className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">3</button>
          
          <div className="w-px h-6 bg-[var(--border-primary)] mx-2"></div>
          
          <button onClick={onVoicemail} className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]" title="Marcar como Voicemail"><VoicemailIcon className="w-5 h-5" /></button>
          <button onClick={() => onToggleFavorite(true)} className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]" title="Adicionar a Persistent"><StarIcon solid={false} className="w-5 h-5" /></button>
          <button onClick={() => onToggleFavorite(false)} className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--warning)]" title="Remover de Persistent"><StarIcon solid={true} className="w-5 h-5" /></button>
          <button onClick={() => onToggleHold(true)} className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]" title="Colocar em Espera"><PauseIcon className="w-5 h-5" /></button>
          
          <div className="w-px h-6 bg-[var(--border-primary)] mx-2"></div>

          <button onClick={onDelete} className="p-2 rounded-full bg-[var(--danger)]/80 hover:bg-[var(--danger)] text-white" title="Deletar Selecionados"><XMarkIcon className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};
