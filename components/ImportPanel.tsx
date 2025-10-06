
import React, { useState, useRef } from 'react';
import type { Settings } from '../types';

interface ImportPanelProps {
    onImport: (content: string | File, append: boolean, showToast: (msg: string) => void) => void;
    settings: Settings;
    showToast: (msg: string) => void;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ onImport, settings, showToast }) => {
    const [pasteContent, setPasteContent] = useState('');
    const [appendMode, setAppendMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImport(file, appendMode, showToast);
            // Reset file input to allow importing the same file again
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleTextImport = () => {
        if (!pasteContent.trim()) {
            showToast('Área de texto vazia.');
            return;
        }
        onImport(pasteContent, appendMode, showToast);
        setPasteContent('');
    }

    return (
        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
            <textarea
                className="w-full h-28 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-3 text-sm placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                placeholder="Cole os leads aqui (um por linha) ou use o botão para importar um arquivo XLSX/CSV..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={appendMode} onChange={e => setAppendMode(e.target.checked)} className="rounded bg-[var(--bg-tertiary)] border-[var(--border-primary)] focus:ring-[var(--accent)]" />
                        Adicionar à lista atual
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileImport}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 font-semibold text-sm text-[var(--accent-text)] rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
                        Importar Arquivo
                    </button>
                    <button onClick={handleTextImport} className="px-6 py-2 font-bold text-[var(--accent-text)] rounded-md bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:opacity-90 transition-opacity">
                        Importar Texto
                    </button>
                </div>
            </div>
        </div>
    );
};
