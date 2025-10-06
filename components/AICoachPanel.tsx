import React, { useState, useRef, useEffect } from 'react';
import type { Lead } from '../types';
import { MicrophoneIcon, StopCircleIcon, SparklesIcon } from './icons';
import { getLiveCallFeedback } from '../services/geminiService';

// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface AICoachPanelProps {
    lead: Lead | null;
    messages: { id: number, text: string }[];
    onAddCoachMessage: (text: string) => void;
}

export const AICoachPanel: React.FC<AICoachPanelProps> = ({ lead, messages, onAddCoachMessage }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // Stop analysis automatically when lead changes
        if (isAnalyzing) {
            handleStopAnalysis();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead]);


    const handleStartAnalysis = () => {
        if (!SpeechRecognition) {
            onAddCoachMessage("Desculpe, seu navegador não suporta análise de áudio.");
            return;
        }

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

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            onAddCoachMessage(`Erro na análise de áudio: ${event.error}`);
            setIsAnalyzing(false);
        };

        recognition.onend = () => {
            if (isAnalyzing) { // If it stops unexpectedly, handle it
                setIsAnalyzing(false);
            }
        };

        recognitionRef.current = { recognition, getTranscript: () => finalTranscript.trim() };
        recognition.start();
        setIsAnalyzing(true);
        onAddCoachMessage("Análise de chamada iniciada. Estou ouvindo...");
    };

    const handleStopAnalysis = async () => {
        if (recognitionRef.current) {
            recognitionRef.current.recognition.stop();
            const transcript = recognitionRef.current.getTranscript();
            recognitionRef.current = null;
            setIsAnalyzing(false);
            onAddCoachMessage("Análise concluída. Gerando feedback...");

            try {
                const feedback = await getLiveCallFeedback(transcript);
                onAddCoachMessage(`IA Feedback: ${feedback}`);
            } catch (error) {
                console.error("Error getting AI feedback:", error);
                onAddCoachMessage("Erro ao obter feedback da IA.");
            }
        }
    };

    return (
        <div className="flex flex-col flex-grow bg-[var(--bg-primary)] rounded-md p-3">
            <div className="flex-grow space-y-3 overflow-y-auto mb-4">
                {messages.map(msg => (
                    <div key={msg.id} className="p-2 rounded-md bg-[var(--bg-tertiary)]/50 text-sm text-[var(--text-secondary)] animate-fade-in">
                        {msg.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex-shrink-0">
                {!isAnalyzing ? (
                    <button
                        onClick={handleStartAnalysis}
                        disabled={!lead}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MicrophoneIcon className="w-5 h-5" /> Iniciar Análise de Chamada
                    </button>
                ) : (
                    <button
                        onClick={handleStopAnalysis}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80"
                    >
                        <StopCircleIcon className="w-5 h-5" /> Parar Análise & Gerar Feedback
                    </button>
                )}
            </div>
        </div>
    );
};
