import React, { useState } from 'react';
import type { PowerHourGoal } from '../types';
import { Modal } from './Modal';

interface PowerHourSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (duration: number, goals: PowerHourGoal) => void;
}

export const PowerHourSetupModal: React.FC<PowerHourSetupModalProps> = ({ isOpen, onClose, onStart }) => {
  const [duration, setDuration] = useState(60);
  const [goals, setGoals] = useState<PowerHourGoal>({ calls: 25, positives: 3 });

  const handleStart = () => {
    onStart(duration, goals);
  };

  const smallInputStyles = "bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-2 py-1 text-sm";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleStart}
      title="Configurar Power Hour"
      confirmText="Iniciar Sprint!"
      iconType="info"
    >
      <div className="space-y-4 my-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Duração da Sessão</label>
          <div className="flex gap-2">
            {[30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${duration === d ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]'}`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-[var(--text-primary)] mb-2">Metas para a Sessão</h4>
          <div className="space-y-3 p-3 bg-[var(--bg-primary)]/50 rounded-md">
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-[var(--text-secondary)]">Meta de chamadas:</label>
                <input type="number" value={goals.calls} onChange={e => setGoals(g => ({ ...g, calls: Number(e.target.value) || 0 }))} className={`w-24 ${smallInputStyles}`} />
            </div>
            <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-[var(--text-secondary)]">Meta de positivos:</label>
                <input type="number" value={goals.positives} onChange={e => setGoals(g => ({ ...g, positives: Number(e.target.value) || 0 }))} className={`w-24 ${smallInputStyles}`} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
