import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLeadsManager } from './hooks/useLeadsManager';
import type { Lead, PersistentLead, Settings, TabKey, PowerHourSession, PowerHourGoal, SuccessInsight } from './types';
import { AttemptResult } from './types';
import { Header } from './components/Header';
import { ImportPanel } from './components/ImportPanel';
import { LeadList } from './components/LeadList';
import { Modal } from './components/Modal';
import { Toast } from './components/Toast';
import { BulkActionBar } from './components/BulkActionBar';
import { SettingsModal } from './components/SettingsModal';
import { CommandPalette } from './components/CommandPalette';
import { LeadDetailModal } from './components/LeadDetailModal';
import { Confetti } from './components/Confetti';
import { generateCallScript, scoreLead, summarizeNotes, getMotivationalMessage, decideOnRequeue, generateFollowUpMessage } from './services/geminiService';
import { NextUpCard } from './components/NextUpCard';
import { DashboardPage } from './components/DashboardPage';
import { PowerHourSetupModal } from './components/PowerHourSetupModal';
import { PowerHourView } from './components/PowerHourView';

const SAMPLE_DATA = `Maria Risana,(92)91612115
cristiano sayao,(61)998278954
Leonardo Talarico Marins,(21)997636951
Glauber Godoi,(62)984816390
Ruan,(11)943784664
John Doe,+12025550104`;

interface ToastConfig {
  message: string;
  type?: 'accent' | 'success';
  action?: {
    label: string;
    onAction: () => void;
  };
}

export default function App() {
  const {
    leads,
    persistentLeads,
    saves,
    settings,
    successInsights,
    setSettings,
    actions,
  } = useLeadsManager();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; confirmText?: string; iconType?: 'warning' | 'info' }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);
  const [detailModalLeadId, setDetailModalLeadId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scriptModalContent, setScriptModalContent] = useState<string>('');
  const [dailyProgress, setDailyProgress] = useState({ calls: 0, positives: 0 });
  const [goalReached, setGoalReached] = useState<{ calls: boolean; positives: boolean }>({ calls: false, positives: false });
  const [view, setView] = useState<'list' | 'dashboard'>('list');
  const [isPowerHourSetupOpen, setPowerHourSetupOpen] = useState(false);
  const [powerHourSession, setPowerHourSession] = useState<PowerHourSession | null>(null);
  const [isAnalyzingSuccess, setIsAnalyzingSuccess] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const powerHourUpdateQueueRef = useRef(Promise.resolve());


  const showToast = (message: string, type: ToastConfig['type'] = 'accent', action?: ToastConfig['action']) => {
    setToastConfig({ message, type, action });
  };
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Load sample data if the list is empty
  useEffect(() => {
    if (leads.length === 0 && Object.keys(persistentLeads).length === 0) {
      actions.importLeads(SAMPLE_DATA, false, (msg) => showToast(msg, 'success'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setCommandPaletteOpen(isOpen => !isOpen);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Timed workflow checker
  useEffect(() => {
      const intervalId = setInterval(() => {
          actions.checkTimedWorkflows();
      }, 30 * 60 * 1000); // Check every 30 minutes

      return () => clearInterval(intervalId);
  }, [actions]);

  // Power Hour Timer
  useEffect(() => {
    if (powerHourSession?.isActive) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - powerHourSession.startTime) / (1000 * 60);
        if (elapsed >= powerHourSession.duration) {
          showToast(`Power Hour finalizada! Você fez ${powerHourSession.progress.calls} chamadas.`, 'success');
          setPowerHourSession(null);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [powerHourSession]);

  const activeLeads = useMemo(() =>
    leads.filter(l => !l.locked && !l.onHold && !l.favorite && !l.attemptsResults.every(r => r === AttemptResult.Voicemail)),
    [leads]
  );
  
  const nextUpLead = useMemo(() => activeLeads[0] || null, [activeLeads]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const callsTodayEvents = new Set<string>();
    const positivesTodayLeads = new Set<string>();

    leads.forEach(lead => {
        const status = settings.customStatuses.find(s => s.id === lead.result);
        const isPositive = lead.locked && status?.isPositive;
        
        lead.history.forEach(event => {
            if (event.timestamp >= todayTimestamp) {
                if (event.type === 'attempt') {
                    callsTodayEvents.add(event.id);
                }
                if (isPositive && event.type === 'result') {
                    positivesTodayLeads.add(lead.id);
                }
            }
        });
    });

    const newProgress = { calls: callsTodayEvents.size, positives: positivesTodayLeads.size };
    setDailyProgress(newProgress);

    if (settings.dailyGoals.calls > 0 && newProgress.calls >= settings.dailyGoals.calls && !goalReached.calls) {
        showToast('Meta de chamadas diária atingida! 🎉', 'success');
        setGoalReached(prev => ({...prev, calls: true}));
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }
    if (settings.dailyGoals.positives > 0 && newProgress.positives >= settings.dailyGoals.positives && !goalReached.positives) {
        showToast('Meta de positivos diária atingida! 🚀', 'success');
        setGoalReached(prev => ({...prev, positives: true}));
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, settings.dailyGoals, settings.customStatuses]);


  const handleUpdateLead = useCallback((id: string, updates: Partial<Lead>) => {
    const originalLead = leads.find(l => l.id === id);
    actions.updateLead(id, updates);

    // Trigger confetti on positive result
    if (updates.result && originalLead?.result !== updates.result) {
        const status = settings.customStatuses.find(s => s.id === updates.result);
        if (status?.isPositive) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }
  }, [leads, actions, settings.customStatuses]);

  const handleOpenWhatsApp = (lead: Lead | PersistentLead) => {
    const message = prompt('Mensagem para WhatsApp:', settings.defaultWaMessage.replace('{nome}', lead.name));
    if (message) {
      const url = `${lead.wa}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleBulkDelete = () => {
    actions.bulkDelete(selectedIds, (count) => {
        showToast(`${count} lead(s) deletados.`, 'accent', {
            label: 'Desfazer',
            onAction: () => {
                actions.undo();
                showToast('Deleção desfeita.');
            }
        });
        setSelectedIds(new Set());
    });
  }
  
  const performBulkAction = (updateFn: (lead: Lead) => Partial<Lead>, toastMessage: string) => {
    actions.bulkUpdate(selectedIds, updateFn, (count) => {
        showToast(`${count} lead(s): ${toastMessage}`, 'accent', {
            label: 'Desfazer',
            onAction: () => {
                actions.undo();
                showToast('Ação desfeita.');
            }
        });
        setSelectedIds(new Set());
    });
  };

  const handleGenerateScript = async (lead: Lead) => {
    showToast('Gerando roteiro com IA...', 'success');
    try {
        const script = await generateCallScript(lead, successInsights);
        setScriptModalContent(script);
    } catch (error) {
        showToast('Erro ao gerar roteiro.', 'accent');
        console.error(error);
    }
  };

  const handleScoreLead = async (lead: Lead) => {
      showToast('Analisando lead com IA...', 'success');
      try {
          const { score, justification } = await scoreLead(lead);
          handleUpdateLead(lead.id, { aiScore: score, aiJustification: justification });
          showToast(`Lead pontuado: ${score}`, 'success');
      } catch (error) {
          showToast('Erro ao pontuar lead.', 'accent');
          console.error(error);
      }
  };
  
  const startPowerHour = (duration: number, goals: PowerHourGoal) => {
    setPowerHourSession({
        isActive: true,
        startTime: Date.now(),
        duration,
        goals,
        progress: { calls: 0, positives: 0 },
        leadQueue: actions.getHottestLeadsQueue(),
        coachMessages: [{ id: Date.now(), text: `Power Hour iniciada! Meta: ${goals.calls} chamadas e ${goals.positives} positivos. Vamos com tudo!` }]
    });
    setPowerHourSetupOpen(false);
  };
  
  const powerHourNextLead = useMemo(() => {
    if (!powerHourSession) return null;
    const nextId = powerHourSession.leadQueue[0];
    return leads.find(l => l.id === nextId) || null;
  }, [powerHourSession, leads]);

  const handlePowerHourUpdate = (id: string, updates: Partial<Lead>) => {
    const originalLead = leads.find(l => l.id === id);
    handleUpdateLead(id, updates);
  
    powerHourUpdateQueueRef.current = powerHourUpdateQueueRef.current.then(() => 
      new Promise<void>(resolve => {
        setPowerHourSession(currentSession => {
          if (!currentSession) {
            resolve();
            return null;
          }
  
          // --- Synchronous updates ---
          let updatedSession = { ...currentSession };
          if (updates.currentAttempt && updates.currentAttempt > (originalLead?.currentAttempt || 0)) {
            updatedSession.progress.calls++;
          }
          if (updates.result) {
            const status = settings.customStatuses.find(s => s.id === updates.result);
            if (status?.isPositive) {
              updatedSession.progress.positives++;
            }
          }
          updatedSession.leadQueue = updatedSession.leadQueue.slice(1);
  
          // --- Asynchronous logic ---
          (async () => {
            let asyncUpdates: Partial<PowerHourSession> = {};
  
            if (updates.attemptsResults && originalLead) {
              const lastResult = updates.attemptsResults[(updates.currentAttempt || originalLead.currentAttempt) - 1];
              if (lastResult === AttemptResult.Voicemail && (originalLead.aiScore || 0) > 60) {
                const decision = await decideOnRequeue(originalLead);
                if (decision.requeue) {
                  asyncUpdates.leadQueue = [...updatedSession.leadQueue, id];
                  asyncUpdates.coachMessages = [...updatedSession.coachMessages, { id: Date.now(), text: `IA: ${decision.reason} Vou reinserir ${originalLead.name} no final do sprint.` }];
                }
              }
            }
  
            if (updates.currentAttempt && updatedSession.progress.calls > 0 && updatedSession.progress.calls % 5 === 0) {
              const baseSession = { ...updatedSession, ...asyncUpdates };
              const timeLeft = baseSession.duration - ((Date.now() - baseSession.startTime) / (1000 * 60));
              const message = await getMotivationalMessage(baseSession.progress, baseSession.goals, Math.round(timeLeft));
              asyncUpdates.coachMessages = [...(asyncUpdates.coachMessages || updatedSession.coachMessages), { id: Date.now(), text: `IA: ${message}` }];
            }
  
            if (Object.keys(asyncUpdates).length > 0) {
              setPowerHourSession(prev => prev ? { ...prev, ...asyncUpdates } : null);
            }
            
            resolve();
          })();
  
          return updatedSession;
        });
      })
    );
  };

  const detailLead = useMemo(() => {
      if (!detailModalLeadId) return null;
      const lead = leads.find(l => l.id === detailModalLeadId);
      if (lead) return lead;
      const persistentLeadArray = Object.values(persistentLeads);
      return persistentLeadArray.find((l: PersistentLead) => l.wa === detailModalLeadId) || null;
  }, [detailModalLeadId, leads, persistentLeads]);
  
  const runSuccessAnalysis = useCallback(async () => {
      setIsAnalyzingSuccess(true);
      setAnalysisError(null);
      try {
          await actions.runSuccessAnalysis();
          showToast('Análise de sucesso concluída!', 'success');
      } catch (error) {
          setAnalysisError('Falha ao analisar padrões. Tente novamente mais tarde.');
          showToast('Erro na análise de sucesso.', 'accent');
      } finally {
          setIsAnalyzingSuccess(false);
      }
  }, [actions]);

  if (powerHourSession?.isActive) {
    return (
        <PowerHourView
            session={powerHourSession}
            lead={powerHourNextLead}
            onUpdate={handlePowerHourUpdate}
            onOpenWhatsApp={handleOpenWhatsApp}
            customStatuses={settings.customStatuses}
            onAddCoachMessage={(text) => setPowerHourSession(s => s ? {...s, coachMessages: [...s.coachMessages, {id: Date.now(), text}]} : s)}
            onStop={() => setPowerHourSession(null)}
        />
    )
  }

  const renderCurrentView = () => {
    if (view === 'dashboard') {
        return <DashboardPage 
            leads={leads} 
            saves={saves} 
            settings={{ customStatuses: settings.customStatuses }}
            successInsights={successInsights}
            onRunAnalysis={runSuccessAnalysis}
            isAnalyzing={isAnalyzingSuccess}
            analysisError={analysisError}
        />;
    }

    if (isFocusMode) {
      return (
        <main className="container mx-auto p-4 space-y-4">
            {nextUpLead ? (
                <>
                    <NextUpCard
                        key={nextUpLead.id}
                        lead={nextUpLead}
                        onUpdate={handleUpdateLead}
                        onOpenWhatsApp={handleOpenWhatsApp}
                        customStatuses={settings.customStatuses}
                    />
                    <div className="text-center text-sm text-[var(--text-tertiary)]">
                        {activeLeads.length - 1 > 0 ? `${activeLeads.length - 1} leads restantes na fila.` : 'Último lead da fila.'}
                    </div>
                </>
            ) : (
                <div className="text-center py-20 bg-[var(--bg-secondary)] rounded-lg">
                    <h2 className="text-2xl font-bold">Fila Vazia!</h2>
                    <p className="text-[var(--text-secondary)] mt-2">Você processou todos os leads disponíveis.</p>
                    <button onClick={() => setFocusMode(false)} className="mt-6 px-6 py-2 font-bold text-[var(--accent-text)] rounded-md bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)]">Sair do Modo Foco</button>
                </div>
            )}
        </main>
      );
    }

    return (
      <main className="container mx-auto p-4 space-y-6">
        <div>
            <ImportPanel
                onImport={actions.importLeads}
                settings={settings}
                showToast={(msg) => showToast(msg, 'success')}
            />
        </div>
        <LeadList
            leads={leads}
            persistentLeads={persistentLeads}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onUpdateLead={handleUpdateLead}
            onUpdatePersistentLead={actions.updatePersistentLead}
            onRemovePersistentLead={(wa) => {
                const name = persistentLeads[wa]?.name || 'Lead';
                actions.removePersistentLead(wa);
                showToast(`${name} removido de Persistent.`, 'accent', {
                    label: 'Desfazer',
                    onAction: actions.undo
                });
            }}
            onOpenWhatsApp={handleOpenWhatsApp}
            settings={settings}
            onOpenDetails={setDetailModalLeadId}
            onGenerateScript={handleGenerateScript}
            onScoreLead={handleScoreLead}
        />
      </main>
    );
  };


  return (
    <div className={`min-h-screen font-sans ${isFocusMode ? 'focus-mode' : ''}`}>
      {showConfetti && <Confetti />}
      <Toast message={toastConfig?.message || ''} onDismiss={() => setToastConfig(null)} action={toastConfig?.action} type={toastConfig?.type} />
      <Modal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        confirmText={modalState.confirmText}
        iconType={modalState.iconType}
      >
        {modalState.message}
      </Modal>
      <Modal
        isOpen={!!scriptModalContent}
        onClose={() => setScriptModalContent('')}
        onConfirm={() => navigator.clipboard.writeText(scriptModalContent).then(() => showToast('Copiado!', 'success'))}
        title="Roteiro de Chamada (IA)"
        confirmText="Copiar"
        iconType='info'
      >
        <p className='whitespace-pre-wrap'>{scriptModalContent}</p>
      </Modal>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
      <PowerHourSetupModal
        isOpen={isPowerHourSetupOpen}
        onClose={() => setPowerHourSetupOpen(false)}
        onStart={startPowerHour}
      />
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={{
            switchTab: setActiveTab,
            toggleTheme: (theme) => setSettings({...settings, theme}),
            openSettings: () => setIsSettingsOpen(true),
        }}
      />
      {detailLead && (
        <LeadDetailModal
            isOpen={!!detailLead}
            onClose={() => setDetailModalLeadId(null)}
            lead={detailLead}
            onUpdate={'id' in detailLead ? handleUpdateLead : actions.updatePersistentLead}
            onSummarizeNotes={summarizeNotes}
            showToast={showToast}
            successInsights={successInsights}
        />
      )}
      
      <Header 
        saves={saves} 
        onSave={actions.saveSession}
        onLoad={(name) => setModalState({
            isOpen: true,
            title: 'Carregar Sessão',
            message: `Deseja carregar a sessão "${name}"? Os leads atuais não salvos serão perdidos.`,
            onConfirm: () => actions.loadSession(name, showToast),
        })}
        onRecycle={() => setModalState({
            isOpen: true,
            title: 'Reciclar Todas as Listas',
            message: 'Deseja criar uma nova lista com todos os leads não finalizados e de voicemail de TODAS as listas salvas? A lista atual será substituída e um novo save "Reciclagem ♻️" será criado.',
            onConfirm: () => actions.recycleSession(showToast),
            confirmText: 'Reciclar Tudo',
            iconType: 'info'
        })}
        onDelete={(name) => setModalState({
            isOpen: true,
            title: 'Deletar Sessão',
            message: `Tem certeza que deseja deletar o save "${name}"? Esta ação não pode ser desfeita.`,
            onConfirm: () => actions.deleteSession(name, showToast),
            confirmText: 'Deletar'
        })}
        onExport={actions.exportLeads}
        onExportXLSX={actions.exportLeadsXLSX}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onBackup={actions.backupData}
        onRestore={actions.restoreData}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setFocusMode(!isFocusMode)}
        onStartPowerHour={() => setPowerHourSetupOpen(true)}
        currentView={view}
        onToggleView={() => setView(v => v === 'list' ? 'dashboard' : 'list')}
      />

    {renderCurrentView()}
    
      <BulkActionBar
        count={selectedIds.size}
        onAttempt={(attempt) => performBulkAction((lead) => {
            const newAttempts = [...lead.attempts] as [boolean, boolean, boolean];
            newAttempts[attempt-1] = true;
            return { attempts: newAttempts, currentAttempt: Math.max(lead.currentAttempt, attempt) };
        }, `Tentativa ${attempt} marcada.`)}
        onVoicemail={() => performBulkAction((lead) => {
            if (lead.currentAttempt > 0) {
                const newResults = [...lead.attemptsResults] as [AttemptResult | null, AttemptResult | null, AttemptResult | null];
                newResults[lead.currentAttempt-1] = AttemptResult.Voicemail;
                return { attemptsResults: newResults };
            }
            return {};
        }, 'marcado(s) como Voicemail.')}
        onToggleHold={(onHold) => performBulkAction(() => ({ onHold }), onHold ? 'colocado(s) em espera.' : 'retomado(s).')}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
}