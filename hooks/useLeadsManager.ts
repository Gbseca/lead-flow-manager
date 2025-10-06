import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { importFromText, importFromFile } from '../services/parserService';
import type { Lead, PersistentLead, SaveSlot, Settings, HistoryEvent, CustomStatus, AudioNote, Workflow, SuccessInsight } from '../types';
import { suggestTagsForLead, recycleLeads, analyzeSuccessPatterns } from '../services/geminiService';
import { checkAndApplyWorkflows } from '../services/workflowService';

const INITIAL_SETTINGS: Settings = {
    theme: 'moonlight',
    operatorPrefix: '',
    hideRJ: false,
    defaultWaMessage: 'Olá, {nome}! Tudo bem?',
    persistentOrder: 'priority',
    customStatuses: [
        { id: 'interested', label: 'Interessado', color: 'var(--success)', isPositive: true },
        { id: 'refused', label: 'Recusado', color: 'var(--danger)', isPositive: false },
    ],
    workflows: [],
    dailyGoals: {
        calls: 50,
        positives: 5,
    }
};

const calculateHeat = (lead: Lead): number => {
    const scorePart = (lead.aiScore || 50) * 0.5;
    const now = Date.now();
    const lastContact = lead.lastUpdatedAt;
    const hoursSinceContact = (now - lastContact) / (1000 * 60 * 60);
    const timeScore = Math.min(hoursSinceContact / 168, 1) * 100;
    const timePart = timeScore * 0.3;
    const priorityPart = ((6 - (lead.priority || 3)) / 5) * 100 * 0.2;
    return scorePart + timePart + priorityPart;
};

export function useLeadsManager() {
  const [leads, setLeads] = useLocalStorage<Lead[]>('leads_v6', []);
  const [persistentLeads, setPersistentLeads] = useLocalStorage<Record<string, PersistentLead>>('persistentLeads_v6', {});
  const [saves, setSaves] = useLocalStorage<Record<string, SaveSlot>>('saves_v6', {});
  const [settings, setSettings] = useLocalStorage<Settings>('settings_v6', INITIAL_SETTINGS);
  const [successInsights, setSuccessInsights] = useLocalStorage<SuccessInsight | null>('successInsights_v1', null);
  
  const undoStateRef = useRef<{ leads: Lead[], persistentLeads: Record<string, PersistentLead> } | null>(null);

  // FIX: Made addHistoryEvent generic to handle both Lead and PersistentLead types.
  const addHistoryEvent = <T extends Lead | PersistentLead>(lead: T, type: HistoryEvent['type'], details: string, data?: any): T => {
    const newEvent: HistoryEvent = {
        id: `evt-${Date.now()}`,
        type,
        timestamp: Date.now(),
        details,
        data,
    };
    return { ...lead, history: [newEvent, ...(lead.history || [])] };
  };
  
  const recomputeLeadDisplay = useCallback((lead: Lead | PersistentLead): Lead | PersistentLead => {
    if (lead.international || !lead.ddd || !lead.local) return lead;

    const newLead = { ...lead };
    const RJs = ['21', '22', '24'];
    const isRJ = RJs.includes(newLead.ddd);
    const fullNumber = `${newLead.ddd}${newLead.local}`;
    newLead.display = (isRJ && settings.hideRJ) ? newLead.local : fullNumber;
    let callDigits = (isRJ && settings.hideRJ) ? newLead.local : (settings.operatorPrefix ? `0${settings.operatorPrefix}${fullNumber}` : fullNumber);
    newLead.tel = `tel:${callDigits}`;
    return newLead;
  }, [settings.hideRJ, settings.operatorPrefix]);

  const computedLeads = useMemo(() => {
    return leads.map(recomputeLeadDisplay) as Lead[];
  }, [leads, recomputeLeadDisplay]);

  const computedPersistentLeads = useMemo(() => {
    return Object.values(persistentLeads).map(recomputeLeadDisplay) as PersistentLead[];
  }, [persistentLeads, recomputeLeadDisplay]);
  
  const importLeads = async (content: string | File, append: boolean, showToast: (msg: string) => void) => {
    try {
        showToast('Importando leads...');
        const parseOpts = { hideRJ: settings.hideRJ, operatorPrefix: settings.operatorPrefix };
        const newLeads = typeof content === 'string' 
            ? await importFromText(content, parseOpts)
            : await importFromFile(content, parseOpts);

        showToast(`${newLeads.length} leads importados. Analisando com IA para sugerir tags...`);
        
        const enrichedLeads = await Promise.all(newLeads.map(async (lead) => {
            try {
                const suggestedTags = await suggestTagsForLead(lead.original);
                if (suggestedTags && suggestedTags.length > 0) {
                    const updatedLead = { ...lead, tags: [...new Set([...(lead.tags || []), ...suggestedTags])] };
                    return addHistoryEvent(updatedLead, 'import', `Tags sugeridas pela IA: ${suggestedTags.join(', ')}`);
                }
            } catch (e) {
                console.error("Error suggesting tags for lead:", lead.original, e);
            }
            return lead;
        }));

        const workflowProcessedLeads = enrichedLeads.map(lead => {
            const { updatedLead } = checkAndApplyWorkflows(lead, 'lead_imported', settings.workflows);
            return updatedLead;
        });

        workflowProcessedLeads.forEach(lead => {
            if (lead.favorite) {
                const { id: leadId, favorite, ...persistentData } = lead;
                setPersistentLeads(prev => ({...prev, [persistentData.wa]: persistentData}));
            }
        });

        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        const processDuplicates = (leadsToProcess: Lead[], existingLeads: Lead[]): Lead[] => {
            const waCounts: Record<string, number> = existingLeads.reduce((acc, lead) => {
                acc[lead.wa] = (acc[lead.wa] || 0) + 1;
                return acc;
            }, {});
            return leadsToProcess.map(lead => {
                const key = lead.wa;
                waCounts[key] = (waCounts[key] || 0) + 1;
                if (waCounts[key] > 1) {
                    const suffix = roman[waCounts[key]] ? ` ${roman[waCounts[key]]}` : ` ${waCounts[key]}`;
                    return { ...lead, name: lead.name + suffix };
                }
                return lead;
            });
        };

        if (append) {
            setLeads(prev => [...prev, ...processDuplicates(workflowProcessedLeads, prev)]);
        } else {
            setLeads(processDuplicates(workflowProcessedLeads, []));
        }
        showToast(`${newLeads.length} leads importados e analisados com sucesso.`);
    } catch (error: any) {
        showToast(`Erro na importação: ${error.message}`);
    }
  };

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads(prevLeads => {
        const index = prevLeads.findIndex(l => l.id === id);
        if (index === -1) return prevLeads;
        
        const originalLead = prevLeads[index];
        let updatedLead = { ...originalLead, ...updates, lastUpdatedAt: Date.now() };

        // Add history events for specific changes
        if (updates.note && updates.note !== originalLead.note) {
            updatedLead = addHistoryEvent(updatedLead, 'note', 'Nota atualizada.');
        }
        if (updates.result && updates.result !== originalLead.result) {
            const status = settings.customStatuses.find(s => s.id === updates.result);
            updatedLead = addHistoryEvent(updatedLead, 'result', `Resultado alterado para "${status?.label || 'N/A'}"`, { statusId: status?.id });
        }
        if (updates.currentAttempt && updates.currentAttempt > originalLead.currentAttempt) {
            updatedLead = addHistoryEvent(updatedLead, 'attempt', `Tentativa ${updates.currentAttempt} registrada.`);
        }
        if (updates.audioNotes && updates.audioNotes.length > originalLead.audioNotes.length) {
            updatedLead = addHistoryEvent(updatedLead, 'note', `Nota de áudio adicionada.`);
        }
        if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(originalLead.tags)) {
            updatedLead = addHistoryEvent(updatedLead, 'manual_update', `Tags atualizadas: ${updates.tags?.join(', ')}`);
        }

        // On Hold timestamp logic
        if (updates.onHold && !originalLead.onHold) {
            updatedLead.onHoldSince = Date.now();
        } else if (updates.onHold === false && originalLead.onHold) {
            delete updatedLead.onHoldSince;
        }

        // WORKFLOWS
        let finalLead = { ...updatedLead };
        
        // Status change
        if (updates.result && updates.result !== originalLead.result) {
            const res = checkAndApplyWorkflows(finalLead, 'status_change', settings.workflows, updates.result);
            finalLead = res.updatedLead;
        }
        // New attempt
        if (updates.currentAttempt && updates.currentAttempt > originalLead.currentAttempt) {
            const res = checkAndApplyWorkflows(finalLead, 'new_attempt', settings.workflows, updates.currentAttempt);
            finalLead = res.updatedLead;
        }
        // Tag added
        if (updates.tags) {
            const originalTags = new Set(originalLead.tags || []);
            for (const newTag of updates.tags) {
                if (!originalTags.has(newTag)) {
                    const res = checkAndApplyWorkflows(finalLead, 'tag_added', settings.workflows, newTag);
                    finalLead = res.updatedLead;
                }
            }
        }
         // Added to persistent (manually)
        if (updates.favorite && !originalLead.favorite) {
            const res = checkAndApplyWorkflows(finalLead, 'added_to_persistent', settings.workflows);
            finalLead = res.updatedLead;
        }

        // Final state management for persistent list
        const wasFavorite = originalLead.favorite;
        const isFavorite = finalLead.favorite;

        if (isFavorite && !wasFavorite) {
            const { id: leadId, favorite, ...persistentData } = finalLead;
            setPersistentLeads(prev => ({...prev, [persistentData.wa]: persistentData}));
        } else if (!isFavorite && wasFavorite) {
            setPersistentLeads(prev => {
                const newPersistent = {...prev};
                delete newPersistent[finalLead.wa];
                return newPersistent;
            });
        }
        
        const newLeads = [...prevLeads];
        newLeads[index] = finalLead;
        return newLeads;
    });
  }, [setLeads, settings.workflows, settings.customStatuses, setPersistentLeads]);

  const updatePersistentLead = useCallback((wa: string, updates: Partial<PersistentLead>) => {
      setPersistentLeads(prev => {
          if (!prev[wa]) return prev;
          let updatedLead = { ...prev[wa], ...updates, lastUpdatedAt: Date.now() };
          
          if (updates.note && updates.note !== prev[wa].note) {
            updatedLead = addHistoryEvent(updatedLead, 'note', 'Nota atualizada.');
          }
          if (updates.audioNotes && updates.audioNotes.length > prev[wa].audioNotes.length) {
            updatedLead = addHistoryEvent(updatedLead, 'note', `Nota de áudio adicionada.`);
          }
          if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(prev[wa].tags)) {
            updatedLead = addHistoryEvent(updatedLead, 'manual_update', `Tags atualizadas: ${updates.tags?.join(', ')}`);
          }
          return { ...prev, [wa]: updatedLead };
      });
  }, [setPersistentLeads]);

  const removePersistentLead = useCallback((wa: string) => {
      undoStateRef.current = { leads, persistentLeads };
      setPersistentLeads(prev => {
          const newPersistent = {...prev};
          delete newPersistent[wa];
          return newPersistent;
      });
      setLeads(prevLeads => prevLeads.map(l => l.wa === wa ? {...l, favorite: false} : l));
  }, [leads, persistentLeads, setLeads, setPersistentLeads]);
  
  const bulkUpdate = useCallback((ids: Set<string>, updateFn: (lead: Lead) => Partial<Lead>, onComplete: (count: number) => void) => {
    undoStateRef.current = { leads, persistentLeads };
    setLeads(prev => prev.map(l => ids.has(l.id) ? { ...l, ...updateFn(l), lastUpdatedAt: Date.now() } : l));
    onComplete(ids.size);
  }, [leads, persistentLeads, setLeads]);

  const bulkDelete = useCallback((ids: Set<string>, onComplete: (count: number) => void) => {
      undoStateRef.current = { leads, persistentLeads };
      setLeads(prev => prev.filter(l => !ids.has(l.id)));
      onComplete(ids.size);
  }, [leads, persistentLeads, setLeads]);

  const undo = useCallback(() => {
    if (undoStateRef.current) {
      setLeads(undoStateRef.current.leads);
      setPersistentLeads(undoStateRef.current.persistentLeads);
    }
  }, [setLeads, setPersistentLeads]);

  const saveSession = useCallback((name: string, callback: (msg:string) => void) => {
      if (!name) { callback('Nome do save não pode ser vazio.'); return; }
      setSaves(prev => ({ ...prev, [name]: { leads: leads, createdAt: Date.now() }}));
      callback(`Sessão salva como "${name}".`);
  }, [leads, setSaves]);

  const loadSession = useCallback((name: string, showToast: (msg:string) => void) => {
      if (name && saves[name]) {
          setLeads(saves[name].leads);
          showToast(`Sessão "${name}" carregada.`);
      }
  }, [saves, setLeads]);

  const recycleSession = async (name: string, showToast: (msg: string) => void) => {
    if (!name || !saves[name]) {
        showToast("Selecione uma sessão salva para reciclar.");
        return;
    }
    try {
        showToast(`Reciclando a lista "${name}" com IA...`);
        const savedLeads = saves[name].leads;
        const sortedIds = await recycleLeads(savedLeads);

        if (sortedIds.length === 0) {
            showToast("A IA não encontrou leads para reengajamento nesta lista.");
            return;
        }

        const leadsMap = new Map(savedLeads.map(l => [l.id, l]));
        const recycledLeads = sortedIds
            .map(id => leadsMap.get(id))
            .filter((l): l is Lead => !!l)
            .map(l => ({
                ...l,
                // Reset progress for the new session
                attempts: [false, false, false],
                attemptsResults: [null, null, null],
                currentAttempt: 0,
                result: '',
                locked: false,
                onHold: false,
                lastUpdatedAt: Date.now(),
                history: [
                    ...l.history,
                    {
                        id: `evt-${Date.now()}`,
                        type: 'import',
                        timestamp: Date.now(),
                        details: `Reciclado da lista "${name}" pela IA.`
                    }
                ]
            }));

        setLeads(recycledLeads);
        showToast(`${recycledLeads.length} leads foram reciclados e carregados para uma nova rodada!`);
    } catch (error) {
        console.error("Error recycling session:", error);
        showToast("Ocorreu um erro ao reciclar a lista.");
    }
  };
  
  const deleteSession = useCallback((name: string, showToast: (msg:string) => void) => {
      if (name && saves[name]) {
          setSaves(prev => {
              const newSaves = {...prev};
              delete newSaves[name];
              return newSaves;
          });
          showToast(`Save "${name}" deletado.`);
      }
  }, [saves, setSaves]);

  const exportLeads = useCallback(() => {
    const lines: string[] = [];
    const groupedLeads: Record<string, Lead[]> = {};
    settings.customStatuses.forEach(s => groupedLeads[s.id] = []);

    computedLeads.forEach(l => {
      if(l.result && groupedLeads[l.result]) {
        groupedLeads[l.result].push(l);
      }
    });

    const formatLine = (l: Lead) => `${l.name} (${l.display}) - Nota: ${l.note || 'N/A'}`;
    
    settings.customStatuses.forEach(s => {
        lines.push(`--- ${s.label.toUpperCase()} ---`, ...groupedLeads[s.id].map(formatLine), '');
    });
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leads_export.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [computedLeads, settings.customStatuses]);
  
  const exportLeadsXLSX = useCallback(() => {
    // @ts-ignore
    if (typeof XLSX === 'undefined' || typeof saveAs === 'undefined') return;
    const statusMap = new Map(settings.customStatuses.map(s => [s.id, s.label]));
    const data = [['Nome', 'Número', 'Nota', 'Status'], ...computedLeads.map(l => [l.name, l.display, l.note, statusMap.get(l.result) || l.result])];
    // @ts-ignore
    const ws = XLSX.utils.aoa_to_sheet(data);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    // @ts-ignore
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    // @ts-ignore
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'leads.xlsx');
  }, [computedLeads, settings.customStatuses]);

  const backupData = useCallback(() => {
    const dataToBackup = {
        leads,
        persistentLeads,
        settings,
        saves
    };
    const content = JSON.stringify(dataToBackup, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    // @ts-ignore
    saveAs(blob, `leadflow_backup_${new Date().toISOString()}.json`);
  }, [leads, persistentLeads, settings, saves]);

  const restoreData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target?.result as string);
            if (data.leads && data.settings) {
                setLeads(data.leads);
                setPersistentLeads(data.persistentLeads || {});
                setSettings(data.settings);
                setSaves(data.saves || {});
                alert('Backup restaurado com sucesso!');
            } else {
                throw new Error('Arquivo de backup inválido.');
            }
        } catch (error: any) {
            alert(`Erro ao restaurar backup: ${error.message}`);
        }
    };
    reader.readAsText(file);
  }, [setLeads, setPersistentLeads, setSettings, setSaves]);

  const checkTimedWorkflows = useCallback(() => {
      setLeads(prevLeads => {
          let leadsChanged = false;
          const updatedLeads = prevLeads.map(lead => {
              const { updatedLead, appliedWorkflow } = checkAndApplyWorkflows(lead, 'on_hold_for_days', settings.workflows);
              if (appliedWorkflow) {
                  leadsChanged = true;
                  // Handle move to persistent if workflow did that
                  if (updatedLead.favorite && !lead.favorite) {
                      const { id: leadId, favorite, ...persistentData } = updatedLead;
                      setPersistentLeads(prev => ({...prev, [persistentData.wa]: persistentData}));
                  }
                  return updatedLead;
              }
              return lead;
          });
          return leadsChanged ? updatedLeads : prevLeads;
      });
  }, [settings.workflows, setLeads, setPersistentLeads]);

  const getHottestLeadsQueue = useCallback(() => {
      const activeLeads = leads.filter(l => !l.locked && !l.onHold && !l.favorite);
      const sortedLeads = [...activeLeads].sort((a, b) => calculateHeat(b) - calculateHeat(a));
      return sortedLeads.map(l => l.id);
  }, [leads]);

  const runSuccessAnalysis = useCallback(async () => {
    try {
        const positiveStatusIds = new Set(settings.customStatuses.filter(s => s.isPositive).map(s => s.id));
        const successfulLeads = leads.filter(l => l.locked && positiveStatusIds.has(l.result));
        
        const insights = await analyzeSuccessPatterns(successfulLeads);
        setSuccessInsights(insights);
        return insights; // Return for immediate use
    } catch (error) {
        console.error("Error running success analysis:", error);
        throw error; // Rethrow to be caught in UI
    }
  }, [leads, settings.customStatuses, setSuccessInsights]);

  return {
    leads: computedLeads,
    persistentLeads: computedPersistentLeads.reduce((acc, lead) => { acc[lead.wa] = lead; return acc; }, {} as Record<string, PersistentLead>),
    saves,
    settings,
    successInsights,
    setSettings,
    undoStateRef,
    actions: {
        importLeads,
        updateLead,
        updatePersistentLead,
        removePersistentLead,
        bulkUpdate,
        bulkDelete,
        undo,
        saveSession,
        loadSession,
        recycleSession,
        deleteSession,
        exportLeads,
        exportLeadsXLSX,
        backupData,
        restoreData,
        checkTimedWorkflows,
        getHottestLeadsQueue,
        runSuccessAnalysis,
    },
  };
}