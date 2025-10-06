import React, { useMemo, useState } from 'react';
import type { Lead, PersistentLead, Settings, TabKey, CustomStatus } from '../types';
import { useDebounce } from '../hooks/useLocalStorage';
import { AttemptResult } from '../types';
import { LeadCard } from './LeadCard';
import { PersistentLeadCard } from './PersistentLeadCard';
import { ProgressBar } from './ProgressBar';
import { NextUpCard } from './NextUpCard';

interface LeadListProps {
    leads: Lead[];
    persistentLeads: Record<string, PersistentLead>;
    activeTab: TabKey;
    setActiveTab: (tab: TabKey) => void;
    selectedIds: Set<string>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    onUpdatePersistentLead: (wa: string, updates: Partial<PersistentLead>) => void;
    onRemovePersistentLead: (wa: string) => void;
    onOpenWhatsApp: (lead: Lead | PersistentLead) => void;
    settings: Settings;
    onOpenDetails: (id: string) => void;
    onGenerateScript: (lead: Lead) => void;
    onScoreLead: (lead: Lead) => void;
}

type SortMode = 'default' | 'hottest';

const BASE_TABS: { key: TabKey, label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'voicemail', label: 'Voicemail' },
  { key: 'onHold', label: 'Em Aguardo' },
  { key: 'persistent', label: 'Persistent' },
  { key: 'overdue', label: 'Atrasados' },
  { key: 'international', label: 'Internacionais' },
];

const calculateHeat = (lead: Lead): number => {
    // aiScore (weight: 50%)
    const scorePart = (lead.aiScore || 50) * 0.5; // Default to 50 if no score

    // Time since last contact (weight: 30%)
    // The older the contact, the higher the score
    const now = Date.now();
    const lastContact = lead.lastUpdatedAt;
    const hoursSinceContact = (now - lastContact) / (1000 * 60 * 60);
    // Normalize this. Anything over 7 days (168 hours) is max score.
    const timeScore = Math.min(hoursSinceContact / 168, 1) * 100;
    const timePart = timeScore * 0.3;

    // Priority (weight: 20%) - lower is better, so invert it
    const priorityPart = ((6 - (lead.priority || 3)) / 5) * 100 * 0.2; // (6-1)/5 = 1, (6-5)/5 = 0.2

    return scorePart + timePart + priorityPart;
};

export const LeadList: React.FC<LeadListProps> = (props) => {
    const { leads, persistentLeads, activeTab, setActiveTab, selectedIds, setSelectedIds, settings, ...leadActions } = props;
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('default');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    const TABS = useMemo(() => {
        const customStatusTabs = settings.customStatuses.map(status => ({
            key: status.id as TabKey, // Cast for simplicity, handle potential collisions if necessary
            label: status.label
        }));
        return [...BASE_TABS.slice(0, 2), ...customStatusTabs, ...BASE_TABS.slice(2)];
    }, [settings.customStatuses]);

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            return newSet;
        });
    };

    const { filteredLeads, sortedPersistentLeads } = useMemo(() => {
        const lowerSearch = debouncedSearchTerm.toLowerCase();
        let tagFilter: string | null = null;
        if (lowerSearch.startsWith('tag:')) {
            tagFilter = lowerSearch.replace('tag:', '').trim();
        }

        const filterLead = (l: Lead | PersistentLead) => {
            if (tagFilter) {
                return l.tags?.some(t => t.toLowerCase().includes(tagFilter!));
            }
            if (lowerSearch) {
                return l.name.toLowerCase().includes(lowerSearch) || 
                       l.display.toLowerCase().includes(lowerSearch) ||
                       l.original.toLowerCase().includes(lowerSearch) ||
                       (l.ddd && `ddd:${l.ddd}` === lowerSearch);
            }
            return true;
        }
        
        const tabFilters: Record<string, (l: Lead) => boolean> = {
            'all': l => !l.locked && !l.onHold && !l.favorite && !l.attemptsResults.every(r => r === AttemptResult.Voicemail),
            'voicemail': l => l.attemptsResults.every(r => r === AttemptResult.Voicemail) && !l.favorite,
            'onHold': l => l.onHold && !l.favorite,
            'international': l => l.international,
            'persistent': () => false, // Handled separately
            'overdue': () => false, // Handled separately
        };

        settings.customStatuses.forEach(status => {
            tabFilters[status.id] = l => l.result === status.id;
        });

        let finalFilteredLeads = leads.filter(filterLead).filter(tabFilters[activeTab] || (() => true));

        if (sortMode === 'hottest' && activeTab === 'all') {
            finalFilteredLeads = [...finalFilteredLeads].sort((a, b) => calculateHeat(b) - calculateHeat(a));
        }

        let persistent = Object.values(persistentLeads).filter(filterLead);
        if (activeTab === 'overdue') {
// FIX: Explicitly type the parameter `l` to avoid it being inferred as `unknown`.
            persistent = persistent.filter((l: PersistentLead) => l.overdue);
        }

        persistent.sort((a: PersistentLead, b: PersistentLead) => {
            switch (settings.persistentOrder) {
                case 'name': return a.name.localeCompare(b.name);
                case 'priority': 
                    const pA = a.overdue ? 0 : (a.priority || 3);
                    const pB = b.overdue ? 0 : (b.priority || 3);
                    if (pA !== pB) return pA - pB;
                    return (a.scheduleISO ? new Date(a.scheduleISO).getTime() : Infinity) - (b.scheduleISO ? new Date(b.scheduleISO).getTime() : Infinity);
                case 'scheduleISO': return (a.scheduleISO ? new Date(a.scheduleISO).getTime() : Infinity) - (b.scheduleISO ? new Date(b.scheduleISO).getTime() : Infinity);
                default: return (b.createdAt || 0) - (a.createdAt || 0);
            }
        });

        return { filteredLeads: finalFilteredLeads, sortedPersistentLeads: persistent };
    }, [leads, persistentLeads, debouncedSearchTerm, activeTab, settings.persistentOrder, settings.customStatuses, sortMode]);
    
    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = {
            all: leads.filter(l => !l.locked && !l.onHold && !l.favorite && !l.attemptsResults.every(r => r === AttemptResult.Voicemail)).length,
            voicemail: leads.filter(l => l.attemptsResults.every(r => r === AttemptResult.Voicemail) && !l.favorite).length,
            onHold: leads.filter(l => l.onHold && !l.favorite).length,
            persistent: Object.keys(persistentLeads).length,
// FIX: Explicitly type the parameter `l` to avoid it being inferred as `unknown`.
            overdue: Object.values(persistentLeads).filter((l: PersistentLead) => l.overdue).length,
            international: leads.filter(l => l.international).length,
        };
        settings.customStatuses.forEach(status => {
            counts[status.id] = leads.filter(l => l.result === status.id).length;
        });
        return counts;
    }, [leads, persistentLeads, settings.customStatuses]);

    const isPersistentView = activeTab === 'persistent' || activeTab === 'overdue';
    
    const processedCount = useMemo(() => settings.customStatuses.reduce((acc, status) => acc + (tabCounts[status.id] || 0), 0), [settings.customStatuses, tabCounts]);

    return (
        <>
            <div className="bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-primary)] space-y-2">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-1">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => { setActiveTab(tab.key as TabKey); setSelectedIds(new Set()); }}
                                className={`relative px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === tab.key ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
                                {tab.label}
                                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-[var(--accent-text)]/20' : 'bg-[var(--bg-primary)]/50'}`}>
                                    {tabCounts[tab.key]}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {activeTab === 'all' && (
                            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                                <option value="default">Padrão</option>
                                <option value="hottest">Mais Quentes</option>
                            </select>
                        )}
                        <input type="text" placeholder="Buscar... (ex: ddd:21, tag:vip)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm placeholder-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]" />
                    </div>
                </div>
                {!isPersistentView && (
                    <div className='pt-2 border-t border-[var(--border-primary)]'>
                        <ProgressBar total={leads.length} processed={processedCount} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
                {isPersistentView ? (
                    sortedPersistentLeads.map(lead => <PersistentLeadCard key={lead.wa} lead={lead} onUpdate={leadActions.onUpdatePersistentLead} onRemove={leadActions.onRemovePersistentLead} onOpenWhatsApp={leadActions.onOpenWhatsApp} onOpenDetails={() => leadActions.onOpenDetails(lead.wa)} />)
                ) : (
                    filteredLeads.map(lead => <LeadCard key={lead.id} lead={lead} isSelected={selectedIds.has(lead.id)} onToggleSelect={handleToggleSelect} onUpdate={leadActions.onUpdateLead} onOpenWhatsApp={leadActions.onOpenWhatsApp} customStatuses={settings.customStatuses} onOpenDetails={leadActions.onOpenDetails} onGenerateScript={leadActions.onGenerateScript} onScoreLead={leadActions.onScoreLead} />)
                )}
            </div>
            
            {(isPersistentView ? sortedPersistentLeads.length === 0 : filteredLeads.length === 0) && (
                <div className="col-span-full text-center py-12 bg-[var(--bg-secondary)]/50 rounded-lg">
                    <p className="text-[var(--text-secondary)]">Nenhum lead encontrado para este filtro.</p>
                </div>
            )}
        </>
    );
};