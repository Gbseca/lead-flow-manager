
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage, useDebounce } from './hooks/useLocalStorage';
import { importFromText } from './services/parserService';
import type { Lead, PersistentLead, SaveSlot, TabKey } from './types';
import { FinalResult, AttemptResult } from './types';
import { LeadCard } from './components/LeadCard';
import { PersistentLeadCard } from './components/PersistentLeadCard';
import { Modal } from './components/Modal';
import { Toast } from './components/Toast';
import { BulkActionBar } from './components/BulkActionBar';
import { BellIcon, CheckIcon } from './components/icons';

const SAMPLE_DATA = `Maria Risana,(92)91612115
cristiano sayao,(61)998278954
Leonardo Talarico Marins,(21)997636951
Glauber Godoi,(62)984816390
Ruan,(11)943784664
John Doe,+12025550104`;

const TABS: { key: TabKey, label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'voicemail', label: 'Voicemail' },
  { key: 'interested', label: 'Interessados' },
  { key: 'refused', label: 'Recusados' },
  { key: 'onHold', label: 'Em Aguardo' },
  { key: 'persistent', label: 'Persistent' },
  { key: 'overdue', label: 'Atrasados' },
  { key: 'international', label: 'Internacionais' },
];

const THEMES = [
    {id: 'moonlight', name: 'Moonlight'},
    {id: 'twilight', name: 'Twilight'},
    {id: 'ruby', name: 'Ruby'},
    {id: 'aurora', name: 'Aurora'},
    {id: 'grove', name: 'Grove'},
    {id: 'espresso', name: 'Espresso'},
    {id: 'oceanic', name: 'Oceanic'},
    {id: 'amethyst', name: 'Amethyst'},
    {id: 'graphite', name: 'Graphite'},
    {id: 'sakura', name: 'Sakura'},
];

type ActionStatus = 'idle' | 'success' | 'error';

interface ToastConfig {
  message: string;
  action?: {
    label: string;
    onAction: () => void;
  };
}

const ActionButton: React.FC<{
    onClick: () => void;
    status: ActionStatus;
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}> = ({ onClick, status, children, disabled, className }) => {
    return (
        <button onClick={onClick} disabled={disabled} className={`relative px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-300 overflow-hidden ${className}`}>
            <span className={`transition-transform duration-300 flex items-center justify-center gap-2 ${status !== 'idle' ? 'translate-y-full' : 'translate-y-0'}`}>
                {children}
            </span>
            <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${status === 'success' ? 'translate-y-0' : '-translate-y-full'}`}>
                <CheckIcon className="w-5 h-5" />
            </span>
        </button>
    );
};


export default function App() {
  const [leads, setLeads] = useLocalStorage<Lead[]>('leads_v4', []);
  const [persistentLeads, setPersistentLeads] = useLocalStorage<Record<string, PersistentLead>>('persistentLeads_v4', {});
  const [saves, setSaves] = useLocalStorage<Record<string, SaveSlot>>('saves_v4', {});

  const [pasteContent, setPasteContent] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedSave, setSelectedSave] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const undoStateRef = useRef<{ leads: Lead[], persistentLeads: Record<string, PersistentLead> } | null>(null);


  // Save/Load UI State
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState(`save-${new Date().toISOString().split('T')[0]}`);
  const [saveStatus, setSaveStatus] = useState<ActionStatus>('idle');
  const [loadStatus, setLoadStatus] = useState<ActionStatus>('idle');
  const [deleteStatus, setDeleteStatus] = useState<ActionStatus>('idle');
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; confirmText?: string; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });


  // Settings
  const [theme, setTheme] = useLocalStorage('settings_theme_v4', 'moonlight');
  const [appendMode, setAppendMode] = useState(false);
  const [operatorPrefix, setOperatorPrefix] = useLocalStorage('settings_operatorPrefix_v4', '');
  const [hideRJ, setHideRJ] = useLocalStorage('settings_hideRJ_v4', false);
  const [defaultWaMessage, setDefaultWaMessage] = useLocalStorage('settings_waMessage_v4', 'Olá, {nome}! Tudo bem?');
  const [persistentOrder, setPersistentOrder] = useLocalStorage<'createdAt' | 'priority' | 'scheduleISO' | 'name'>('settings_persistentOrder_v4', 'createdAt');
  
  // Notifications
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const notificationTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = (message: string, action?: ToastConfig['action']) => {
    setToastConfig({ message, action });
  };
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Automatic Overdue Lead Processing
  useEffect(() => {
    const processOverdueLeads = () => {
      const now = Date.now();
      const updates: Record<string, Partial<PersistentLead>> = {};
      Object.values(persistentLeads).forEach(lead => {
        if (lead.scheduleISO && !lead.overdue && new Date(lead.scheduleISO).getTime() < now) {
          updates[lead.wa] = {
            overdue: true,
            note: `${lead.note || ''}\n[AGENDAMENTO ATRASADO: ${new Date(lead.scheduleISO).toLocaleString()}]`.trim(),
            scheduleISO: '',
          };
        }
      });

      if (Object.keys(updates).length > 0) {
        setPersistentLeads(prev => {
          const newLeads = { ...prev };
          for (const wa in updates) {
            newLeads[wa] = { ...newLeads[wa], ...updates[wa] };
          }
          return newLeads;
        });
        showToast(`${Object.keys(updates).length} lead(s) marcado(s) como atrasado(s).`);
      }
    };

    const intervalId = setInterval(processOverdueLeads, 60 * 1000); // Check every minute
    processOverdueLeads(); // Check on mount

    return () => clearInterval(intervalId);
  }, [persistentLeads, setPersistentLeads]);

  useEffect(() => {
    const initializeSampleData = async () => {
        if (leads.length === 0 && Object.keys(persistentLeads).length === 0) {
            const initialLeads = await importFromText(SAMPLE_DATA, { hideRJ: false, operatorPrefix: '' });
            setLeads(initialLeads);
            showToast('Dados de exemplo carregados.');
        }
    };
    initializeSampleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notification scheduler effect
  useEffect(() => {
    if (notificationPermission !== 'granted') return;

    const scheduleNotification = (lead: PersistentLead) => {
        if (!lead.scheduleISO) return;

        const scheduledTime = new Date(lead.scheduleISO).getTime();
        const now = Date.now();
        const delay = scheduledTime - now;
        
        const existingTimeout = notificationTimeouts.current.get(lead.wa);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            notificationTimeouts.current.delete(lead.wa);
        }

        if (delay > 0) {
            const timeoutId = setTimeout(() => {
                new Notification('Lembrete de Lead', {
                    body: `Agendamento com ${lead.name} (${lead.display}) agora.`,
                    icon: '/vite.svg',
                });
                notificationTimeouts.current.delete(lead.wa);
            }, delay);
            notificationTimeouts.current.set(lead.wa, timeoutId);
        }
    };
    
    Object.values(persistentLeads).forEach(scheduleNotification);

    return () => {
        notificationTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    };
  }, [persistentLeads, notificationPermission]);

  const requestNotificationPermission = async () => {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
          showToast('Notificações ativadas!');
          new Notification('Lead Flow Manager', { body: 'As notificações estão prontas!' });
      } else {
          showToast('Notificações não foram permitidas.');
      }
  };


  const recomputeLeadDisplay = useCallback((lead: Lead | PersistentLead): Lead | PersistentLead => {
    if (lead.international || !lead.ddd || !lead.local) {
        return lead;
    }

    const newLead = { ...lead };
    const RJs = ['21', '22', '24'];
    const isRJ = RJs.includes(newLead.ddd);
    const fullNumber = `${newLead.ddd}${newLead.local}`;

    newLead.display = (isRJ && hideRJ) ? newLead.local : fullNumber;
    
    let callDigits;
    if (isRJ && hideRJ) {
      callDigits = newLead.local;
    } else {
      callDigits = operatorPrefix ? `0${operatorPrefix}${fullNumber}` : fullNumber;
    }
    newLead.tel = `tel:${callDigits}`;

    return newLead;
  }, [hideRJ, operatorPrefix]);

  const computedLeads = useMemo(() => {
    return leads.map(recomputeLeadDisplay) as Lead[];
  }, [leads, recomputeLeadDisplay]);

  const computedPersistentLeads = useMemo(() => {
    return Object.values(persistentLeads).map(recomputeLeadDisplay) as PersistentLead[];
  }, [persistentLeads, recomputeLeadDisplay]);

  const handleImport = async () => {
    if (!pasteContent.trim()) {
      showToast('Área de texto vazia.');
      return;
    }
    const newLeads = await importFromText(pasteContent, { hideRJ, operatorPrefix });
    const allCurrentLeads = appendMode ? leads : [];
    const waCounts: Record<string, number> = allCurrentLeads.reduce((acc, lead) => {
        acc[lead.wa] = (acc[lead.wa] || 0) + 1;
        return acc;
    }, {});
    
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

    const processedLeads = newLeads.map(lead => {
        const key = lead.wa;
        waCounts[key] = (waCounts[key] || 0) + 1;
        if (waCounts[key] > 1) {
            const suffix = roman[waCounts[key]] ? ` ${roman[waCounts[key]]}` : ` ${waCounts[key]}`;
            return { ...lead, name: lead.name + suffix };
        }
        return lead;
    });

    if (appendMode) {
      setLeads(prev => [...prev, ...processedLeads]);
    } else {
      setLeads(processedLeads);
    }
    showToast(`${processedLeads.length} leads importados.`);
    setPasteContent('');
  };
  
  const handleLeadUpdate = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads(prevLeads => {
        const index = prevLeads.findIndex(l => l.id === id);
        if (index === -1) return prevLeads;

        const updatedLead = { ...prevLeads[index], ...updates };

        if (updates.favorite !== undefined) {
            if (updates.favorite) {
                const { id: leadId, favorite, ...persistentData } = updatedLead;
                setPersistentLeads(prev => ({...prev, [persistentData.wa]: persistentData}));
                showToast(`${updatedLead.name} adicionado a Persistent.`);
            } else {
                setPersistentLeads(prev => {
                    const newPersistent = {...prev};
                    delete newPersistent[updatedLead.wa];
                    return newPersistent;
                });
                showToast(`${updatedLead.name} removido de Persistent.`);
            }
        }

        const newLeads = [...prevLeads];
        newLeads[index] = updatedLead;
        return newLeads;
    });
  }, [setLeads, setPersistentLeads]);
  
  const handlePersistentLeadUpdate = useCallback((wa: string, updates: Partial<PersistentLead>) => {
      setPersistentLeads(prev => {
          if (!prev[wa]) return prev;
          const updatedLead = { ...prev[wa], ...updates };
          showToast(`Lead ${updatedLead.name} atualizado.`);
          return {
              ...prev,
              [wa]: updatedLead
          };
      });
  }, [setPersistentLeads]);

  const handlePersistentLeadRemove = useCallback((wa: string) => {
      undoStateRef.current = { leads, persistentLeads };
      const leadName = persistentLeads[wa]?.name || 'Lead';

      setPersistentLeads(prev => {
          const newPersistent = {...prev};
          delete newPersistent[wa];
          return newPersistent;
      });
      setLeads(prevLeads => prevLeads.map(l => l.wa === wa ? {...l, favorite: false} : l));
      
      showToast(`${leadName} removido de Persistent.`, {
        label: 'Desfazer',
        onAction: () => {
          if (undoStateRef.current) {
            setLeads(undoStateRef.current.leads);
            setPersistentLeads(undoStateRef.current.persistentLeads);
            showToast('Ação desfeita.');
          }
        },
      });
  }, [leads, persistentLeads, setLeads, setPersistentLeads]);
  
  const handleOpenWhatsApp = (lead: Lead | PersistentLead) => {
    const message = prompt('Mensagem para WhatsApp:', defaultWaMessage.replace('{nome}', lead.name));
    if (message) {
      const url = `${lead.wa}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleConfirmSave = () => {
      if (saveName) {
          setSaves(prev => ({ ...prev, [saveName]: { leads: leads, createdAt: Date.now() }}));
          setSaveStatus('success');
          showToast(`Sessão salva como "${saveName}".`);
          setTimeout(() => {
              setSaveStatus('idle');
              setIsSaving(false);
          }, 1500);
      } else {
          showToast('Nome do save não pode ser vazio.');
      }
  };

  const handleLoadState = () => {
      if (selectedSave && saves[selectedSave]) {
          setModalState({
              isOpen: true,
              title: 'Carregar Sessão',
              message: `Deseja carregar a sessão "${selectedSave}"? Os leads atuais não salvos serão perdidos.`,
              onConfirm: confirmLoadState,
          });
      } else {
        showToast("Selecione uma sessão para carregar.");
      }
  };
  
  const confirmLoadState = () => {
      if (selectedSave && saves[selectedSave]) {
          setLeads(saves[selectedSave].leads);
          setLoadStatus('success');
          showToast(`Sessão "${selectedSave}" carregada.`);
          setTimeout(() => {
              setLoadStatus('idle');
              setSelectedSave("");
          }, 1500);
      }
  };

  const handleDeleteState = () => {
    if(selectedSave && saves[selectedSave]) {
        setModalState({
            isOpen: true,
            title: 'Deletar Sessão',
            message: `Tem certeza que deseja deletar o save "${selectedSave}"? Esta ação não pode ser desfeita.`,
            onConfirm: confirmDeleteState,
            confirmText: 'Deletar'
        });
    } else {
        showToast("Selecione um save para deletar.");
    }
  };

  const confirmDeleteState = () => {
      if (selectedSave && saves[selectedSave]) {
          setSaves(prev => {
              const newSaves = {...prev};
              delete newSaves[selectedSave];
              return newSaves;
          });
          setDeleteStatus('success');
          showToast(`Save "${selectedSave}" deletado.`);
          setTimeout(() => {
              setDeleteStatus('idle');
              setSelectedSave("");
          }, 1500);
      }
  };
  
  const handleExport = () => {
    const lines: string[] = [];
    const interested = computedLeads.filter(l => l.result === FinalResult.Interested);
    const refused = computedLeads.filter(l => l.result === FinalResult.Refused);
    const onHold = computedLeads.filter(l => l.onHold);
    const voicemail = computedLeads.filter(l => l.attemptsResults.every(r => r === AttemptResult.Voicemail));
    const pending = computedLeads.filter(l => !l.locked && !l.onHold && !voicemail.includes(l));

    const formatLine = (l: Lead) => `${l.name} (${l.display})`;
    
    lines.push('--- INTERESSADOS ---', ...interested.map(formatLine), '');
    lines.push('--- RECUSADOS ---', ...refused.map(formatLine), '');
    lines.push('--- EM AGUARDO ---', ...onHold.map(formatLine), '');
    lines.push('--- VOICEMAIL ---', ...voicemail.map(formatLine), '');
    lines.push('--- PENDENTES ---', ...pending.map(formatLine), '');

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_export.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportação gerada.');
  };

  const handleExportXLSX = () => {
    // @ts-ignore
    if (typeof XLSX === 'undefined' || typeof saveAs === 'undefined') {
        showToast("A biblioteca de exportação (SheetJS) não foi carregada.");
        return;
    }

    const dataToExport = computedLeads;
    const worksheetData = [
        ['Nome', 'Número', 'Caixa 1', 'Caixa 2', 'Caixa 3'],
        ...dataToExport.map(lead => [
            lead.name,
            lead.display,
            '', '', '',
        ])
    ];
    
    // @ts-ignore
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, 'Leads para Impressão');
    
    // @ts-ignore
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    // @ts-ignore
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'leads_para_impressao.xlsx');
    showToast('Exportação XLSX gerada.');
  };

  const filteredLeads = useMemo(() => {
    let list = computedLeads.filter(l => !l.favorite);

    const lowerSearch = debouncedSearchTerm.toLowerCase();
    if (lowerSearch) {
        list = list.filter(l => 
            l.name.toLowerCase().includes(lowerSearch) || 
            l.display.toLowerCase().includes(lowerSearch) ||
            l.original.toLowerCase().includes(lowerSearch)
        );
    }
    
    switch (activeTab) {
      case 'all':
        return list.filter(l => !l.locked && !l.onHold && !l.attemptsResults.every(r => r === AttemptResult.Voicemail));
      case 'voicemail':
        return list.filter(l => l.attemptsResults.every(r => r === AttemptResult.Voicemail));
      case 'interested':
        return list.filter(l => l.result === FinalResult.Interested);
      case 'refused':
        return list.filter(l => l.result === FinalResult.Refused);
      case 'onHold':
        return list.filter(l => l.onHold);
      case 'international':
        return computedLeads.filter(l => l.international);
      default:
        return list;
    }
  }, [computedLeads, activeTab, debouncedSearchTerm]);

  const sortedPersistentLeads = useMemo(() => {
    let list = computedPersistentLeads;
    
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    if (lowerSearch) {
        list = list.filter(l => 
            l.name.toLowerCase().includes(lowerSearch) || 
            l.display.toLowerCase().includes(lowerSearch) ||
            l.original.toLowerCase().includes(lowerSearch)
        );
    }

    if (activeTab === 'overdue') {
        list = list.filter(l => l.overdue);
    }
    
    list.sort((a, b) => {
        switch (persistentOrder) {
            case 'name': return a.name.localeCompare(b.name);
            case 'priority': 
                const priorityA = a.overdue ? 0 : (a.priority || 3);
                const priorityB = b.overdue ? 0 : (b.priority || 3);
                if (priorityA !== priorityB) return priorityA - priorityB;
                const dateA = a.scheduleISO ? new Date(a.scheduleISO).getTime() : Infinity;
                const dateB = b.scheduleISO ? new Date(b.scheduleISO).getTime() : Infinity;
                return dateA - dateB;
            case 'scheduleISO': 
                const schedA = a.scheduleISO ? new Date(a.scheduleISO).getTime() : Infinity;
                const schedB = b.scheduleISO ? new Date(b.scheduleISO).getTime() : Infinity;
                return schedA - schedB;
            case 'createdAt':
            default: return (b.createdAt || 0) - (a.createdAt || 0);
        }
    });

    return list;
  }, [computedPersistentLeads, debouncedSearchTerm, persistentOrder, activeTab]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  }, []);

  const handleSelectAllVisible = () => {
    const currentVisibleIds = filteredLeads.map(l => l.id);
    const allSelected = currentVisibleIds.length > 0 && currentVisibleIds.every(id => selectedIds.has(id));

    if (allSelected) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(currentVisibleIds));
    }
  };

  const performBulkAction = (updateFn: (lead: Lead) => Partial<Lead>, toastMessage: string) => {
    undoStateRef.current = { leads, persistentLeads };
    
    setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, ...updateFn(l) } : l));
    
    showToast(`${selectedIds.size} lead(s): ${toastMessage}`, {
        label: 'Desfazer',
        onAction: () => {
            if (undoStateRef.current) {
                setLeads(undoStateRef.current.leads);
                showToast('Ação desfeita.');
            }
        }
    });
    setSelectedIds(new Set());
  };
  
  const handleBulkDelete = () => {
    undoStateRef.current = { leads, persistentLeads };
    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    showToast(`${selectedIds.size} lead(s) deletados.`, {
        label: 'Desfazer',
        onAction: () => {
            if (undoStateRef.current) {
                setLeads(undoStateRef.current.leads);
                showToast('Deleção desfeita.');
            }
        }
    });
    setSelectedIds(new Set());
  }

  const handleBulkToggleFavorite = (favorite: boolean) => {
      undoStateRef.current = { leads, persistentLeads };
      const leadMap = new Map(leads.map(l => [l.id, l]));
      const newPersistent = { ...persistentLeads };

      selectedIds.forEach(id => {
        const lead = leadMap.get(id);
        if(lead) {
            if (favorite && !lead.favorite) {
                const { id: leadId, favorite: fav, ...persistentData } = lead;
                newPersistent[persistentData.wa] = persistentData;
            } else if (!favorite && lead.favorite) {
                delete newPersistent[lead.wa];
            }
        }
      });
      
      setPersistentLeads(newPersistent);
      setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, favorite } : l));
      
      showToast(`${selectedIds.size} lead(s) ${favorite ? 'adicionados a' : 'removidos de'} Persistent.`, {
          label: 'Desfazer',
          onAction: () => {
              if (undoStateRef.current) {
                  setLeads(undoStateRef.current.leads);
                  setPersistentLeads(undoStateRef.current.persistentLeads);
                  showToast('Ação desfeita.');
              }
          }
      });
      setSelectedIds(new Set());
  };

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: computedLeads.filter(l => !l.locked && !l.onHold && !l.favorite && !l.attemptsResults.every(r => r === AttemptResult.Voicemail)).length,
      voicemail: computedLeads.filter(l => l.attemptsResults.every(r => r === AttemptResult.Voicemail) && !l.favorite).length,
      interested: computedLeads.filter(l => l.result === FinalResult.Interested).length,
      refused: computedLeads.filter(l => l.result === FinalResult.Refused).length,
      onHold: computedLeads.filter(l => l.onHold && !l.favorite).length,
      persistent: Object.keys(persistentLeads).length,
      overdue: Object.values(persistentLeads).filter(l => l.overdue).length,
      international: computedLeads.filter(l => l.international).length,
    };
    return counts;
  }, [computedLeads, persistentLeads]);

  return (
    <div className="min-h-screen font-sans">
      <Toast message={toastConfig?.message || ''} onDismiss={() => setToastConfig(null)} action={toastConfig?.action} />
      <Modal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        confirmText={modalState.confirmText}
      >
        {modalState.message}
      </Modal>
      
      <header className="bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-40 p-4 border-b border-[var(--border-primary)]">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center font-bold text-xl text-[var(--accent-text)]">LF</div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Lead Flow</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
                id="theme-select"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              >
                {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={handleExport} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">Exportar TXT</button>
            <button onClick={handleExportXLSX} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">Exportar XLSX</button>
            
            {!isSaving && <button onClick={() => setIsSaving(true)} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">Salvar Sessão</button>}
            {isSaving && (
                <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1 rounded-md">
                    <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm w-32" placeholder="Nome do save..." />
                    <ActionButton onClick={handleConfirmSave} status={saveStatus} className="bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">Salvar</ActionButton>
                    <button onClick={() => setIsSaving(false)} className="px-2 py-1 text-sm rounded-md hover:bg-[var(--bg-hover)]">X</button>
                </div>
            )}
            
            <select value={selectedSave} onChange={e => setSelectedSave(e.target.value)} className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                <option value="">-- Saves --</option>
                {Object.keys(saves).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ActionButton onClick={handleLoadState} status={loadStatus} disabled={!selectedSave} className="bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">Carregar</ActionButton>
            <ActionButton onClick={handleDeleteState} status={deleteStatus} disabled={!selectedSave} className="bg-[var(--danger)]/80 text-white hover:bg-[var(--danger)] disabled:opacity-50">Deletar</ActionButton>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
          <textarea
            className="w-full h-28 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-3 text-sm placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
            placeholder="Cole os leads aqui, um por linha..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={appendMode} onChange={e => setAppendMode(e.target.checked)} className="rounded bg-[var(--bg-tertiary)] border-[var(--border-primary)] focus:ring-[var(--accent)]" />
                    Adicionar (Append)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hideRJ} onChange={e => setHideRJ(e.target.checked)} className="rounded bg-[var(--bg-tertiary)] border-[var(--border-primary)] focus:ring-[var(--accent)]" />
                    Ocultar DDD do RJ
                </label>
                <div className="flex items-center gap-2">
                    <label>Operadora:</label>
                    <input type="text" value={operatorPrefix} onChange={e => setOperatorPrefix(e.target.value.replace(/\D/g, ''))} maxLength={3} className="w-16 bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-2 py-1 text-sm" placeholder="015" />
                </div>
            </div>
            <button onClick={handleImport} className="px-6 py-2 font-bold text-[var(--accent-text)] rounded-md bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:opacity-90 transition-opacity">
              Importar Leads
            </button>
          </div>
        </div>
        
        <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-primary)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
                  className={`relative px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-[var(--accent-text)]/20' : 'bg-[var(--bg-primary)]/50'}`}>
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
            <div className="w-full md:w-auto">
                <input
                    type="text"
                    placeholder="Buscar lead..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm placeholder-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                />
            </div>
          </div>
          {(activeTab !== 'persistent' && activeTab !== 'overdue' && filteredLeads.length > 0) && (
            <div className='mt-2 pt-2 border-t border-[var(--border-primary)] flex items-center'>
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-[var(--bg-tertiary)] border-[var(--border-secondary)] text-[var(--accent)] focus:ring-[var(--accent)]"
                checked={filteredLeads.every(l => selectedIds.has(l.id))}
                onChange={handleSelectAllVisible}
              />
              <label className="ml-2 text-sm text-[var(--text-secondary)]">Selecionar todos visíveis</label>
            </div>
          )}
          {(activeTab === 'persistent' || activeTab === 'overdue') && (
             <div className="mt-2 pt-2 border-t border-[var(--border-primary)] flex justify-between items-center gap-2 text-sm">
                 {notificationPermission === 'default' && (
                     <button onClick={requestNotificationPermission} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/40 transition-colors">
                        <BellIcon className="w-4 h-4" /> Ativar Notificações
                     </button>
                 )}
                 {notificationPermission === 'denied' && (
                     <span className="flex items-center gap-2 text-[var(--danger)] text-xs">
                        <BellIcon className="w-4 h-4" /> Notificações bloqueadas
                     </span>
                 )}

                 <div className="flex-grow flex justify-end items-center gap-2">
                    <label>Ordenar por:</label>
                    <select value={persistentOrder} onChange={e => setPersistentOrder(e.target.value as any)} className="bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-2 py-1">
                        <option value="priority">Prioridade</option>
                        <option value="scheduleISO">Agendamento</option>
                        <option value="name">Nome</option>
                        <option value="createdAt">Criação</option>
                    </select>
                 </div>
             </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
          {activeTab === 'persistent' || activeTab === 'overdue' ? (
            sortedPersistentLeads.map(lead => (
              <PersistentLeadCard 
                key={lead.wa} 
                lead={lead}
                onUpdate={handlePersistentLeadUpdate}
                onRemove={handlePersistentLeadRemove}
                onOpenWhatsApp={handleOpenWhatsApp}
              />
            ))
          ) : (
            filteredLeads.map(lead => (
              <LeadCard 
                key={lead.id} 
                lead={lead} 
                isSelected={selectedIds.has(lead.id)}
                onUpdate={handleLeadUpdate} 
                onOpenWhatsApp={handleOpenWhatsApp}
                onToggleSelect={handleToggleSelect}
              />
            ))
          )}
        </div>
        {(activeTab !== 'persistent' && activeTab !== 'overdue' && filteredLeads.length === 0) && (
            <div className="col-span-full text-center py-12 bg-[var(--bg-secondary)]/50 rounded-lg">
                <p className="text-[var(--text-secondary)]">Nenhum lead encontrado para este filtro.</p>
            </div>
        )}
        {((activeTab === 'persistent' || activeTab === 'overdue') && sortedPersistentLeads.length === 0) && (
            <div className="col-span-full text-center py-12 bg-[var(--bg-secondary)]/50 rounded-lg">
                <p className="text-[var(--text-secondary)]">Nenhum lead na lista Persistent.</p>
                <p className="text-sm text-[var(--text-tertiary)]">Clique na estrela ★ em um lead para adicioná-lo aqui.</p>
            </div>
        )}
      </main>
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
        onToggleFavorite={handleBulkToggleFavorite}
        onToggleHold={(onHold) => performBulkAction(() => ({ onHold }), onHold ? 'colocado(s) em espera.' : 'retomado(s).')}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
}