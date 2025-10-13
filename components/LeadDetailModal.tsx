



import React, { useState, useEffect, useRef } from 'react';
import type { Lead, PersistentLead, HistoryEvent, AudioNote, SuccessInsight } from '../types';
import { SparklesIcon, MicrophoneIcon, StopCircleIcon, TrashIcon, ChatBubbleLeftRightIcon } from './icons';
import { generateFollowUpMessage } from '../services/geminiService';
import { Modal } from './Modal';

// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | PersistentLead;
  onUpdate: (id: string, updates: Partial<Lead | PersistentLead>) => void;
  onSummarizeNotes: (history: HistoryEvent[], currentNote: string) => Promise<string>;
  showToast: (message: string, type?: 'accent' | 'success') => void;
  successInsights: SuccessInsight | null;
}

const Timeline: React.FC<{history: HistoryEvent[]}> = ({ history }) => (
    <div className="space-y-4">
        {history.map(event => (
            <div key={event.id} className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
                <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{event.details}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
            </div>
        ))}
    </div>
);

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const AudioNotes: React.FC<{ lead: Lead | PersistentLead, onUpdate: (id: string, updates: Partial<Lead | PersistentLead>) => void }> = ({ lead, onUpdate }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null); // SpeechRecognition instance

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            // --- Speech Recognition Setup ---
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'pt-BR';
                recognition.continuous = true;
                recognition.interimResults = false;
                let finalTranscript = '';
                
                recognition.onresult = (event: any) => {
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript + ' ';
                        }
                    }
                };
                recognitionRef.current = { recognition, getTranscript: () => finalTranscript.trim() };
                recognition.start();
            }
            // --------------------------------

            mediaRecorder.onstop = async () => {
                recognitionRef.current?.recognition.stop();
                const transcript = recognitionRef.current?.getTranscript();
                
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const base64AudioUrl = await blobToBase64(audioBlob);

                const newAudioNote: AudioNote = {
                    id: `audio-${Date.now()}`,
                    url: base64AudioUrl,
                    duration: 0, // Placeholder
                    createdAt: Date.now(),
                    transcript: transcript
                };
                const key = 'id' in lead ? lead.id : lead.wa;
                onUpdate(key, { audioNotes: [...(lead.audioNotes || []), newAudioNote] });
                stream.getTracks().forEach(track => track.stop());
                recognitionRef.current = null;
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error starting recording:", error);
            alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
        }
    };

    const handleStopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleRemoveAudioNote = (id: string) => {
        const key = 'id' in lead ? lead.id : lead.wa;
        onUpdate(key, { audioNotes: lead.audioNotes.filter(a => a.id !== id) });
    };

    return (
        <div>
            <div className="flex justify-end mb-2">
                {!isRecording ? (
                    <button onClick={handleStartRecording} disabled={!SpeechRecognition} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed" title={!SpeechRecognition ? "Seu navegador não suporta transcrição." : "Gravar e Transcrever Áudio"}>
                        <MicrophoneIcon className="w-4 h-4" /> Gravar Áudio
                    </button>
                ) : (
                    <button onClick={handleStopRecording} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80">
                        <StopCircleIcon className="w-4 h-4" /> Parar
                    </button>
                )}
            </div>
            <div className="space-y-2">
                {lead.audioNotes?.map(note => (
                    <div key={note.id} className="p-2 bg-[var(--bg-tertiary)] rounded-md">
                        <div className="flex items-center gap-2">
                            <audio src={note.url} controls className="w-full h-8" />
                            <button onClick={() => handleRemoveAudioNote(note.id)} className="p-2 text-[var(--danger)] hover:bg-[var(--danger)]/20 rounded-full"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                        {note.transcript && (
                             <p className="mt-2 p-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded italic">
                                "{note.transcript}"
                             </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
};

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ isOpen, onClose, lead, onUpdate, onSummarizeNotes, showToast, successInsights }) => {
  const [note, setNote] = useState(lead.note || '');
  const [tags, setTags] = useState(lead.tags?.join(', ') || '');
  const [activeTab, setActiveTab] = useState<'notes' | 'history'>('notes');

  const [isAssistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setNote(lead.note || '');
        setTags(lead.tags?.join(', ') || '');
        setActiveTab('notes');
        setAssistantMessage('');
    }
  }, [isOpen, lead.note, lead.tags]);

  if (!isOpen) return null;

  const handleSave = () => {
    const key = 'id' in lead ? lead.id : lead.wa;
    const newTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    
    const updates: Partial<Lead | PersistentLead> = {};
    if (note !== lead.note) {
        updates.note = note;
    }
    if (JSON.stringify(newTags) !== JSON.stringify(lead.tags || [])) {
        updates.tags = newTags;
    }

    if (Object.keys(updates).length > 0) {
        onUpdate(key, updates);
        showToast('Alterações salvas.', 'success');
    }
  };

  const handleSummarize = async () => {
    const key = 'id' in lead ? lead.id : lead.wa;
    showToast('Resumindo com IA...');
    try {
        const summary = await onSummarizeNotes(lead.history, lead.note);
        onUpdate(key, { historySummary: summary });
        showToast('Resumo gerado com sucesso.', 'success');
    } catch (error) {
        showToast('Erro ao resumir.', 'accent');
    }
  };

  const handleGenerateFollowup = async (objective: string, useSuccessTemplate: boolean = false) => {
    setIsGenerating(true);
    setAssistantMessage('');
    try {
        const message = await generateFollowUpMessage(lead, objective, useSuccessTemplate ? successInsights : null);
        setAssistantMessage(message);
    } catch (e) {
        showToast('Erro ao gerar mensagem.', 'accent');
    } finally {
        setIsGenerating(false);
    }
  };
  
  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-2xl m-4 bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-primary)] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">{lead.name}</h3>
          <p className="text-sm text-[var(--text-secondary)] font-mono">{lead.display}</p>
        </div>
        <div className="p-4">
             <div className="border-b border-[var(--border-primary)] mb-4">
                <nav className="flex gap-4 -mb-px">
                    <button onClick={() => setActiveTab('notes')} className={`px-1 py-2 text-sm font-semibold border-b-2 ${activeTab === 'notes' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'}`}>Notas</button>
                    <button onClick={() => setActiveTab('history')} className={`px-1 py-2 text-sm font-semibold border-b-2 ${activeTab === 'history' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'}`}>Histórico</button>
                </nav>
             </div>
             <div className="max-h-[60vh] overflow-y-auto pr-2">
                {activeTab === 'notes' && (
                    <div className="space-y-4">
                        {lead.historySummary && (
                            <div className="p-3 bg-[var(--bg-primary)] rounded-md border border-[var(--border-primary)]">
                                <h4 className="font-bold text-sm text-[var(--accent)] mb-1">Resumo da IA</h4>
                                <p className="text-sm italic text-[var(--text-secondary)] whitespace-pre-wrap">{lead.historySummary}</p>
                            </div>
                        )}
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Adicione uma nota..."
                            className="w-full h-40 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                        />
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Tags (separadas por vírgula)</label>
                          <input 
                            type="text" 
                            value={tags} 
                            onChange={e => setTags(e.target.value)} 
                            onBlur={handleSave}
                            placeholder="vip, produto_A, retorno..."
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                           />
                        </div>
                        <div className='flex items-center gap-2'>
                          <button onClick={handleSummarize} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">
                              <SparklesIcon className="w-4 h-4"/> Resumir Histórico
                          </button>
                           <button onClick={() => setAssistantOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">
                              <ChatBubbleLeftRightIcon className="w-4 h-4"/> Assistente IA
                          </button>
                        </div>
                        <AudioNotes lead={lead} onUpdate={onUpdate} />
                    </div>
                )}
                {activeTab === 'history' && (
                   <Timeline history={lead.history} />
                )}
             </div>
        </div>
        <div className="px-4 py-3 bg-[var(--bg-tertiary)]/50 rounded-b-lg flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
    <Modal
      isOpen={isAssistantOpen}
      onClose={() => setAssistantOpen(false)}
      onConfirm={() => {
        if (assistantMessage) {
            navigator.clipboard.writeText(assistantMessage).then(() => showToast('Copiado!', 'success'));
        }
        setAssistantOpen(false);
      }}
      title="Assistente de Resposta IA"
      confirmText={assistantMessage ? "Copiar & Fechar" : "Fechar"}
      iconType='info'
    >
      <div className="space-y-3 my-4">
        {isGenerating && <div className="text-center text-[var(--text-secondary)]">Gerando resposta...</div>}
        {!isGenerating && !assistantMessage && (
          <>
            <p className='text-sm text-[var(--text-secondary)] mb-4'>Selecione um objetivo para gerar uma mensagem de follow-up:</p>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleGenerateFollowup("Enviar proposta após a chamada")} className="w-full text-sm p-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">Enviar Proposta</button>
                <button onClick={() => handleGenerateFollowup("Follow-up de um voicemail deixado")} className="w-full text-sm p-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">Follow-up Voicemail</button>
                <button onClick={() => handleGenerateFollowup("Reagendar uma conversa")} className="w-full text-sm p-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">Reagendar Conversa</button>
                <button onClick={() => handleGenerateFollowup("Agradecer pelo tempo")} className="w-full text-sm p-2 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]">Agradecimento</button>
            </div>
            {successInsights && successInsights.winningPhrases.length > 0 && (
              <button onClick={() => handleGenerateFollowup("Follow-up genérico", true)} className="w-full text-sm p-2 rounded-md bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent)] font-bold mt-2">
                  Gerar com meu Estilo de Sucesso
              </button>
            )}
          </>
        )}
        {assistantMessage && (
            <textarea
                readOnly
                value={assistantMessage}
                className="w-full h-32 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-2 text-sm text-[var(--text-primary)]"
            />
        )}
      </div>
    </Modal>
    </>
  );
};