
import React, { useState, useEffect, useRef } from 'react';

interface Command {
  id: string;
  name: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: {
    switchTab: (tab: any) => void;
    toggleTheme: (theme: string) => void;
    openSettings: () => void;
  };
}

const ALL_COMMANDS: Omit<Command, 'action'>[] = [
    { id: 'tab-all', name: 'Ir para a aba: Todos', category: 'Navegação' },
    { id: 'tab-voicemail', name: 'Ir para a aba: Voicemail', category: 'Navegação' },
    { id: 'tab-onHold', name: 'Ir para a aba: Em Aguardo', category: 'Navegação' },
    { id: 'tab-persistent', name: 'Ir para a aba: Persistent', category: 'Navegação' },
    { id: 'tab-overdue', name: 'Ir para a aba: Atrasados', category: 'Navegação' },
    { id: 'settings', name: 'Abrir Configurações', category: 'Ações' },
    { id: 'theme-moonlight', name: 'Mudar tema para: Moonlight', category: 'Tema' },
    { id: 'theme-twilight', name: 'Mudar tema para: Twilight', category: 'Tema' },
    { id: 'theme-aurora', name: 'Mudar tema para: Aurora', category: 'Tema' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = ALL_COMMANDS.map(cmd => ({
    ...cmd,
    action: () => {
        if (cmd.id.startsWith('tab-')) actions.switchTab(cmd.id.replace('tab-', ''));
        if (cmd.id.startsWith('theme-')) actions.toggleTheme(cmd.id.replace('theme-', ''));
        if (cmd.id === 'settings') actions.openSettings();
    }
  }));

  const filteredCommands = searchTerm
    ? commands.filter(cmd => cmd.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : commands;
  
  useEffect(() => {
    if (isOpen) {
        setTimeout(() => inputRef.current?.focus(), 100);
    } else {
        setSearchTerm('');
        setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
      setActiveIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => (i + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const command = filteredCommands[activeIndex];
            if (command) {
                command.action();
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-xl m-4 bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-primary)] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-[var(--border-primary)]">
            <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Digite um comando..."
                className="w-full bg-transparent text-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
            />
        </div>
        <ul className="p-2 max-h-96 overflow-y-auto">
            {filteredCommands.length > 0 ? filteredCommands.map((cmd, index) => (
                <li
                    key={cmd.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => { cmd.action(); onClose(); }}
                    className={`p-3 rounded-md cursor-pointer flex justify-between items-center ${activeIndex === index ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                >
                    <span>{cmd.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeIndex === index ? 'bg-white/20' : 'bg-[var(--bg-primary)]'}`}>{cmd.category}</span>
                </li>
            )) : (
                <li className="p-4 text-center text-[var(--text-tertiary)]">Nenhum comando encontrado.</li>
            )}
        </ul>
        <div className="px-4 py-2 bg-[var(--bg-tertiary)]/50 text-xs text-[var(--text-tertiary)] flex items-center gap-4 rounded-b-lg">
            <span><span className="font-bold">↑↓</span> para navegar</span>
            <span><span className="font-bold">Enter</span> para selecionar</span>
            <span><span className="font-bold">Esc</span> para fechar</span>
        </div>
      </div>
    </div>
  );
};
