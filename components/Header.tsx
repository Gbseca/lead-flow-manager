import React, { useState, useRef } from 'react';
import type { SaveSlot } from '../types';
import { Cog6ToothIcon, ArrowDownOnSquareIcon, CommandLineIcon, ViewfinderCircleIcon, ArrowUpOnSquareIcon, ArrowPathIcon, ChartBarIcon, BoltIcon } from './icons';

interface HeaderProps {
    saves: Record<string, SaveSlot>;
    onSave: (name: string, callback: (msg: string) => void) => void;
    onLoad: (name: string) => void;
    onDelete: (name: string) => void;
    onRecycle: (name: string) => void;
    onExport: () => void;
    onExportXLSX: () => void;
    onOpenSettings: () => void;
    onBackup: () => void;
    onRestore: (file: File) => void;
    isFocusMode: boolean;
    onToggleFocusMode: () => void;
    onStartPowerHour: () => void;
    currentView: 'list' | 'dashboard';
    onToggleView: () => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
    const { saves, onSave, onLoad, onDelete, onRecycle, onExport, onExportXLSX, onOpenSettings, onBackup, onRestore, isFocusMode, onToggleFocusMode, onStartPowerHour, currentView, onToggleView } = props;
    const [isSaving, setIsSaving] = useState(false);
    const [saveName, setSaveName] = useState(`save-${new Date().toISOString().split('T')[0]}`);
    const [selectedSave, setSelectedSave] = useState('');
    const restoreInputRef = useRef<HTMLInputElement>(null);

    const handleConfirmSave = () => {
        onSave(saveName, (message) => {
            setIsSaving(false);
        });
    };

    const handleRestoreClick = () => {
        restoreInputRef.current?.click();
    };

    const handleFileRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onRestore(file);
        }
        if (restoreInputRef.current) restoreInputRef.current.value = "";
    };

    return (
        <header className="bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-40 p-4 border-b border-[var(--border-primary)]">
            <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center font-bold text-xl text-[var(--accent-text)]">LF</div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Lead Flow</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={onToggleView} className={`p-2 rounded-md transition-colors ${currentView === 'dashboard' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]'}`} title="Dashboard"><ChartBarIcon className="w-5 h-5"/></button>
                    <button onClick={onStartPowerHour} className="p-2 rounded-md transition-colors bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] flex items-center gap-1 text-[var(--warning)]" title="Power Hour"><BoltIcon className="w-5 h-5"/> Power Hour</button>
                    <button onClick={onToggleFocusMode} className={`p-2 rounded-md transition-colors ${isFocusMode ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]'}`} title="Modo Foco"><ViewfinderCircleIcon className="w-5 h-5"/></button>
                    <button onClick={onOpenSettings} className="p-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors" title="Configurações"><Cog6ToothIcon className="w-5 h-5"/></button>
                    
                    <div className="w-px h-6 bg-[var(--border-primary)] mx-2"></div>
                    
                    <button onClick={onBackup} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">Backup</button>
                    <input type="file" ref={restoreInputRef} onChange={handleFileRestore} className="hidden" accept=".json"/>
                    <button onClick={handleRestoreClick} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">Restaurar</button>

                    <div className="w-px h-6 bg-[var(--border-primary)] mx-2"></div>
                    
                    {!isSaving && <button onClick={() => setIsSaving(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"><ArrowDownOnSquareIcon className="w-4 h-4" />Salvar Sessão</button>}
                    {isSaving && (
                        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1 rounded-md">
                            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm w-32" placeholder="Nome do save..." />
                            <button onClick={handleConfirmSave} className="px-3 py-1 text-sm font-semibold rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">Salvar</button>
                            <button onClick={() => setIsSaving(false)} className="px-2 py-1 text-sm rounded-md hover:bg-[var(--bg-hover)]">X</button>
                        </div>
                    )}
                    
                    <select value={selectedSave} onChange={e => setSelectedSave(e.target.value)} className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                        <option value="">-- Sessões Salvas --</option>
                        {Object.keys(saves).sort((a,b) => saves[b].createdAt - saves[a].createdAt).map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button onClick={() => onLoad(selectedSave)} disabled={!selectedSave} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">Carregar</button>
                    <button onClick={() => onRecycle(selectedSave)} disabled={!selectedSave} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--success)]/80 text-white hover:bg-[var(--success)] disabled:opacity-50 flex items-center gap-1.5"><ArrowPathIcon className="w-4 h-4" />Reciclar</button>
                    <button onClick={() => onDelete(selectedSave)} disabled={!selectedSave} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--danger)]/80 text-white hover:bg-[var(--danger)] disabled:opacity-50">Deletar</button>
                </div>
            </div>
        </header>
    );
};