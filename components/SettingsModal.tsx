

import React, { useState, useEffect } from 'react';
import type { Settings, CustomStatus, Workflow, Trigger, Action, TriggerType, ActionType } from '../types';
import { TrashIcon, PlusIcon } from './icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (newSettings: Settings) => void;
}

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

const DEFAULT_COLORS = ['#89D185', '#FF6B6B', '#FFD580', '#82AAFF', '#c792ea', '#88C0D0', '#d16969'];

interface CustomStatusManagerProps {
    statuses: CustomStatus[];
    onChange: (statuses: CustomStatus[]) => void;
    workflows: Workflow[];
    onWorkflowChange: (workflows: Workflow[]) => void;
}

const CustomStatusManager: React.FC<CustomStatusManagerProps> = ({ statuses, onChange, workflows, onWorkflowChange }) => {
    
    const handleAdd = () => {
        const newStatus: CustomStatus = {
            id: `status-${Date.now()}`,
            label: 'Novo Status',
            color: DEFAULT_COLORS[statuses.length % DEFAULT_COLORS.length],
            isPositive: false
        };
        onChange([...statuses, newStatus]);
    };

    const handleUpdate = (id: string, updates: Partial<CustomStatus>) => {
        onChange(statuses.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleRemove = (id: string) => {
        if (statuses.length <= 1) return; 

        const isUsed = (workflows || []).some(wf => wf.trigger.type === 'status_change' && wf.trigger.value === id);
        if (isUsed) {
            if (!window.confirm("Este status é usado em uma automação. Deletá-lo irá remover a automação correspondente. Continuar?")) {
                return;
            }
            const newWorkflows = workflows.filter(wf => !(wf.trigger.type === 'status_change' && wf.trigger.value === id));
            onWorkflowChange(newWorkflows);
        }

        onChange(statuses.filter(s => s.id !== id));
    };

    return (
        <div className="space-y-3">
            {statuses.map(status => (
                <div key={status.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-md">
                    <input type="color" value={status.color.startsWith('var(') ? '#89D185' : status.color} onChange={e => handleUpdate(status.id, { color: e.target.value })} className="w-8 h-8 rounded-md border-none cursor-pointer bg-transparent" />
                    <input type="text" value={status.label} onChange={e => handleUpdate(status.id, { label: e.target.value })} className="flex-grow bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm" />
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox" checked={status.isPositive} onChange={e => handleUpdate(status.id, { isPositive: e.target.checked })} className="rounded w-4 h-4" />
                        Positivo
                    </label>
                    <button onClick={() => handleRemove(status.id)} disabled={statuses.length <= 1} className="p-2 text-[var(--danger)] hover:bg-[var(--danger)]/20 rounded-full disabled:opacity-50"><TrashIcon className="w-4 h-4" /></button>
                </div>
            ))}
            <button onClick={handleAdd} className="w-full py-2 text-sm font-semibold rounded-md bg-[var(--bg-hover)] hover:bg-[var(--bg-tertiary)]">Adicionar Status</button>
        </div>
    );
};

const WorkflowManager: React.FC<{ workflows: Workflow[], onChange: (workflows: Workflow[]) => void, customStatuses: CustomStatus[] }> = ({ workflows, onChange, customStatuses }) => {
    
    const TRIGGER_TYPES: { value: TriggerType, label: string, needsValue?: 'status' | 'number' | 'text' }[] = [
        { value: 'status_change', label: 'Status do lead é alterado para...', needsValue: 'status' },
        { value: 'new_attempt', label: 'Tentativa de chamada é registrada', needsValue: 'number' },
        { value: 'tag_added', label: 'Tag é adicionada', needsValue: 'text' },
        { value: 'on_hold_for_days', label: 'Lead em espera por (dias)', needsValue: 'number' },
        { value: 'added_to_persistent', label: 'Lead movido para Persistent' },
        { value: 'lead_imported', label: 'Lead é importado' },
    ];

    const ACTION_TYPES: { value: ActionType, label: string, needsValue?: 'text' | 'schedule' | 'priority' }[] = [
        { value: 'add_tag', label: 'Adicionar Tag', needsValue: 'text' },
        { value: 'remove_tag', label: 'Remover Tag', needsValue: 'text' },
        { value: 'move_to_persistent', label: 'Mover para Persistent' },
        { value: 'set_schedule', label: 'Definir Agendamento', needsValue: 'schedule' },
        { value: 'set_priority', label: 'Definir Prioridade', needsValue: 'priority' },
        { value: 'clear_schedule', label: 'Limpar Agendamento' },
    ];
    
    const SCHEDULE_OPTIONS = [
        { value: 'tomorrow_9am', label: 'Amanhã às 9h' },
        { value: '+1h', label: '+1 Hora' },
        { value: '+1d', label: '+1 Dia' },
        { value: '+7d', label: '+7 Dias' },
    ];
    
    const handleAddWorkflow = () => {
        const newWorkflow: Workflow = {
            id: `wf-${Date.now()}`,
            name: 'Nova Automação',
            trigger: { type: 'status_change', value: customStatuses[0]?.id || '' },
            actions: [],
        };
        onChange([...(workflows || []), newWorkflow]);
    };
    
    const handleUpdateWorkflow = (id: string, updates: Partial<Workflow>) => {
        onChange((workflows || []).map(w => w.id === id ? { ...w, ...updates } : w));
    };

    const handleRemoveWorkflow = (id: string) => {
        onChange((workflows || []).filter(w => w.id !== id));
    };

    const handleAddAction = (workflowId: string) => {
        const newAction: Action = { id: `act-${Date.now()}`, type: 'add_tag', value: 'nova-tag' };
        const updatedWorkflows = (workflows || []).map(w => {
            if (w.id === workflowId) {
                return { ...w, actions: [...w.actions, newAction] };
            }
            return w;
        });
        onChange(updatedWorkflows);
    };

    const handleUpdateAction = (workflowId: string, actionId: string, updates: Partial<Action>) => {
        onChange((workflows || []).map(w => {
            if (w.id === workflowId) {
                return { ...w, actions: w.actions.map(a => a.id === actionId ? { ...a, ...updates } : a) };
            }
            return w;
        }));
    };

    const handleRemoveAction = (workflowId: string, actionId: string) => {
        onChange((workflows || []).map(w => {
            if (w.id === workflowId) {
                return { ...w, actions: w.actions.filter(a => a.id !== actionId) };
            }
            return w;
        }));
    };

    const renderValueInput = (config: any, value: any, onChange: (newValue: any) => void) => {
        switch(config.needsValue) {
            case 'status':
                return <select value={value} onChange={e => onChange(e.target.value)} className="input-sm">{customStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>;
            case 'number':
                return <input type="number" value={value || 1} onChange={e => onChange(Number(e.target.value))} className="input-sm w-20"/>;
            case 'text':
                return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="input-sm" placeholder="valor..."/>;
            case 'schedule':
                return <select value={value} onChange={e => onChange(e.target.value)} className="input-sm">{SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
            case 'priority':
                 return <select value={value} onChange={e => onChange(Number(e.target.value))} className="input-sm">{[1,2,3,4,5].map(p => <option key={p} value={p}>{p}</option>)}</select>;
            default: return null;
        }
    }
    
    return (
        <div className="space-y-4">
            {(workflows || []).map(wf => (
                <div key={wf.id} className="p-3 bg-[var(--bg-primary)]/50 rounded-md border border-[var(--border-primary)] space-y-3">
                    <div className="flex justify-between items-center">
                        <input type="text" value={wf.name} onChange={e => handleUpdateWorkflow(wf.id, { name: e.target.value })} className="font-bold bg-transparent text-lg" />
                        <button onClick={() => handleRemoveWorkflow(wf.id)} className="p-2 text-[var(--danger)] hover:bg-[var(--danger)]/20 rounded-full"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                    
                    {/* Trigger */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-secondary)]">SE (Gatilho)</label>
                        <div className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)]/50 rounded-md">
                            <select value={wf.trigger.type} onChange={e => handleUpdateWorkflow(wf.id, { trigger: { type: e.target.value as TriggerType, value: '' }})} className="input-sm">
                                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            {renderValueInput(TRIGGER_TYPES.find(t => t.value === wf.trigger.type), wf.trigger.value, (val) => handleUpdateWorkflow(wf.id, { trigger: { ...wf.trigger, value: val }}))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-secondary)]">ENTÃO (Ações)</label>
                        {wf.actions.map(action => {
                            const actionConfig = ACTION_TYPES.find(a => a.value === action.type);
                            return (
                                <div key={action.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)]/50 rounded-md">
                                    <select value={action.type} onChange={e => handleUpdateAction(wf.id, action.id, { type: e.target.value as ActionType, value: '' })} className="input-sm">
                                        {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                    {renderValueInput(actionConfig, action.value, (val) => handleUpdateAction(wf.id, action.id, { value: val }))}
                                    <div className="flex-grow"></div>
                                    <button onClick={() => handleRemoveAction(wf.id, action.id)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] rounded-full"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            );
                        })}
                        <button onClick={() => handleAddAction(wf.id)} className="w-full py-1.5 text-xs font-semibold rounded-md bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-tertiary)] flex items-center justify-center gap-1">
                            <PlusIcon className="w-4 h-4" /> Adicionar Ação
                        </button>
                    </div>
                </div>
            ))}
             <button onClick={handleAddWorkflow} className="w-full py-2 text-sm font-semibold rounded-md bg-[var(--bg-hover)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center gap-2">
                <PlusIcon className="w-5 h-5" /> Adicionar Automação
            </button>
        </div>
    );
};


export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [currentSettings, setCurrentSettings] = useState<Settings>(settings);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const validStatusIds = new Set(currentSettings.customStatuses.map(s => s.id));
    const cleanedWorkflows = (currentSettings.workflows || []).filter(workflow => {
        if (workflow.trigger.type === 'status_change') {
            return validStatusIds.has(workflow.trigger.value as string);
        }
        return true;
    });

    onSave({ ...currentSettings, workflows: cleanedWorkflows });
    onClose();
  };
  
  const handleChange = (field: keyof Settings, value: any) => {
    setCurrentSettings(prev => ({ ...prev, [field]: value }));
  };
  
  const commonInputStyles = "w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]";
  const smallInputStyles = "bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-2 py-1 text-sm";


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-2xl m-4 bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-primary)] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[var(--border-primary)]">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Configurações</h3>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Workflows */}
            <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">Automações (Workflows)</h4>
                {/* FIX: Replaced .replaceAll with .replace and a global regex for wider JS environment compatibility. */}
                <style>{`.input-sm { ${smallInputStyles.replace(/"/g, '')} }`}</style>
                <WorkflowManager 
                    workflows={currentSettings.workflows} 
                    onChange={newWorkflows => handleChange('workflows', newWorkflows)} 
                    customStatuses={currentSettings.customStatuses}
                />
            </div>

            {/* Custom Statuses */}
            <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">Status Finais Personalizados</h4>
                <CustomStatusManager 
                    statuses={currentSettings.customStatuses} 
                    onChange={newStatuses => handleChange('customStatuses', newStatuses)} 
                    workflows={currentSettings.workflows}
                    onWorkflowChange={newWorkflows => handleChange('workflows', newWorkflows)}
                />
            </div>

            {/* Theme */}
            <div>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Tema Visual</label>
                <select value={currentSettings.theme} onChange={e => handleChange('theme', e.target.value)} className={commonInputStyles}>
                    {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

             {/* Gamification */}
             <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">Metas Diárias</h4>
                <div className="space-y-4 p-3 bg-[var(--bg-primary)]/50 rounded-md">
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Chamadas por dia:</label>
                        <input type="number" value={currentSettings.dailyGoals?.calls || 0} onChange={e => handleChange('dailyGoals', { ...currentSettings.dailyGoals, calls: Number(e.target.value) || 0 })} className={`w-24 ${smallInputStyles}`} />
                    </div>
                     <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Positivos por dia:</label>
                        <input type="number" value={currentSettings.dailyGoals?.positives || 0} onChange={e => handleChange('dailyGoals', { ...currentSettings.dailyGoals, positives: Number(e.target.value) || 0 })} className={`w-24 ${smallInputStyles}`} />
                    </div>
                </div>
            </div>

            {/* Calling */}
            <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">Opções de Chamada</h4>
                <div className="space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={currentSettings.hideRJ} onChange={e => handleChange('hideRJ', e.target.checked)} className="rounded bg-[var(--bg-tertiary)] border-[var(--border-primary)] focus:ring-[var(--accent)]" />
                        Ocultar DDD do RJ (21, 22, 24)
                    </label>
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Prefixo da operadora:</label>
                        <input type="text" value={currentSettings.operatorPrefix} onChange={e => handleChange('operatorPrefix', e.target.value.replace(/\D/g, ''))} maxLength={3} className={`w-20 ${smallInputStyles}`} placeholder="Ex: 015" />
                    </div>
                </div>
            </div>

            {/* WhatsApp */}
            <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">WhatsApp</h4>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Mensagem Padrão</label>
                <textarea value={currentSettings.defaultWaMessage} onChange={e => handleChange('defaultWaMessage', e.target.value)} rows={3} className={commonInputStyles} placeholder="Use {nome} para o nome do lead." />
            </div>

            {/* Persistent List */}
            <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">Lista Persistent</h4>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Ordenação Padrão</label>
                <select value={currentSettings.persistentOrder} onChange={e => handleChange('persistentOrder', e.target.value)} className={commonInputStyles}>
                    <option value="priority">Prioridade</option>
                    <option value="scheduleISO">Agendamento</option>
                    <option value="name">Nome</option>
                    <option value="createdAt">Data de Criação</option>
                </select>
            </div>
        </div>
        <div className="px-6 py-4 bg-[var(--bg-tertiary)]/50 rounded-b-lg flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] transition-colors">
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};