import React, { useState, useMemo } from 'react';
import type { DashboardData, DashboardPeriod } from '../services/dashboardService';
import { getDashboardData } from '../services/dashboardService';
import type { Lead, SaveSlot, CustomStatus, SuccessInsight } from '../types';
import { LightBulbIcon } from './icons';

interface DashboardPageProps {
    leads: Lead[];
    saves: Record<string, SaveSlot>;
    settings: { customStatuses: CustomStatus[] };
    successInsights: SuccessInsight | null;
    onRunAnalysis: () => void;
    isAnalyzing: boolean;
    analysisError: string | null;
}

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{title}</h3>
        {children}
    </div>
);

const FunnelChart: React.FC<{ data: DashboardData['funnel'] }> = ({ data }) => {
    const maxVal = data.totalLeads > 0 ? data.totalLeads : 1;
    const stages = [
        { label: 'Leads Totais', value: data.totalLeads, color: 'bg-[var(--accent)]' },
        { label: 'Tentativas', value: data.attempts, color: 'bg-[var(--accent)]/80' },
        { label: 'Contatos Sucedidos', value: data.successfulContacts, color: 'bg-[var(--accent)]/60' },
        { label: 'Resultados Positivos', value: data.positiveResults, color: 'bg-[var(--accent)]/40' },
    ];

    return (
        <div className="space-y-2">
            {stages.map(stage => (
                <div key={stage.label} className="flex items-center gap-4 text-sm">
                    <div className="w-40 text-right font-semibold text-[var(--text-secondary)] truncate">{stage.label}</div>
                    <div className="flex-grow bg-[var(--bg-primary)] rounded-full h-8">
                        <div className={`h-8 rounded-full flex items-center justify-end pr-2 text-white font-bold ${stage.color}`} style={{ width: `${(stage.value / maxVal) * 100}%` }}>
                            {stage.value}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const BarChart: React.FC<{ data: DashboardData['rateByTag'] | DashboardData['rateByDDD']; unit?: string }> = ({ data, unit = '%' }) => {
    if (data.length === 0) return <p className="text-center text-[var(--text-tertiary)]">Dados insuficientes.</p>;
    
    return (
        <div className="space-y-3">
            {data.map(item => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-24 text-right font-semibold text-[var(--text-secondary)] truncate">{item.name}</div>
                    <div className="flex-grow bg-[var(--bg-primary)] rounded h-6">
                        <div className="bg-[var(--success)] h-6 rounded flex items-center justify-between px-2 text-white" style={{ width: `${item.rate}%` }}>
                           <span className="font-bold">{item.rate.toFixed(1)}{unit}</span>
                           <span className="text-xs opacity-80">({item.positive}/{item.total})</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const Heatmap: React.FC<{ data: DashboardData['heatmap'] }> = ({ data }) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const maxVal = Math.max(1, ...Object.values(data).flatMap(h => Object.values(h)));

    return (
        <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[var(--text-secondary)] mb-1">
                {days.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((_, dayIndex) => (
                    <div key={dayIndex} className="space-y-1">
                        {hours.slice(8, 20).map(hour => { // Show business hours
                            const value = data[dayIndex]?.[hour] || 0;
                            const opacity = value / maxVal;
                            return <div key={hour} className="h-4 rounded-sm bg-[var(--success)]" style={{ opacity }} title={`${value} sucesso(s) às ${hour}h`}></div>;
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};


const SavedListTable: React.FC<{ data: DashboardData['savedListPerformance'] }> = ({ data }) => {
    if (data.length === 0) return <p className="text-center text-[var(--text-tertiary)]">Nenhuma lista salva encontrada.</p>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-[var(--text-secondary)] uppercase bg-[var(--bg-primary)]">
                    <tr>
                        <th scope="col" className="px-4 py-2">Nome da Lista</th>
                        <th scope="col" className="px-4 py-2 text-center">Conversão</th>
                        <th scope="col" className="px-4 py-2 text-center">Resultados Positivos</th>
                        <th scope="col" className="px-4 py-2 text-center">Leads Finalizados</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(item => (
                        <tr key={item.name} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-primary)]">
                            <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{item.name}</td>
                            <td className="px-4 py-2 text-center font-bold text-[var(--success)]">{item.conversion.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-center">{item.positive}</td>
                            <td className="px-4 py-2 text-center">{item.totalFinalized}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const SuccessInsightsPanel: React.FC<{ insights: SuccessInsight | null, onRunAnalysis: () => void, isAnalyzing: boolean, error: string | null }> = ({ insights, onRunAnalysis, isAnalyzing, error }) => {
    if (isAnalyzing) {
        return <div className="text-center py-8 text-[var(--text-secondary)]">Analisando... A IA está processando seus dados de sucesso.</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-[var(--danger)]">{error}</div>;
    }
    
    if (insights && insights.strategicSummary) {
        return (
            <div className="space-y-6">
                <div>
                    <h4 className="font-bold text-[var(--accent)]">Resumo Estratégico</h4>
                    <p className="italic text-[var(--text-secondary)]">"{insights.strategicSummary}"</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <h5 className="font-semibold mb-2">Frases Vencedoras</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                            {insights.winningPhrases.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                     <div>
                        <h5 className="font-semibold mb-2">Follow-ups Eficazes</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                            {insights.effectiveFollowups.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                     <div>
                        <h5 className="font-semibold mb-2">Perfis de Leads Ideais</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[var(--text-secondary)]">
                            {insights.topLeadProfiles.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                </div>
                 <div className="text-center mt-4">
                    <button onClick={onRunAnalysis} className="text-sm text-[var(--accent)] hover:underline">Reanalisar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="text-center py-8">
            <LightBulbIcon className="w-12 h-12 mx-auto text-[var(--accent)]" />
            <h4 className="mt-4 text-lg font-bold">Descubra Seus Padrões de Sucesso</h4>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md mx-auto">A IA pode analisar seus leads bem-sucedidos para identificar suas frases mais eficazes, melhores estratégias de follow-up e perfis de clientes ideais.</p>
            <button onClick={onRunAnalysis} className="mt-6 px-6 py-2 font-bold text-[var(--accent-text)] rounded-md bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)]">Analisar Padrões de Sucesso</button>
        </div>
    );
}


export const DashboardPage: React.FC<DashboardPageProps> = ({ leads, saves, settings, successInsights, onRunAnalysis, isAnalyzing, analysisError }) => {
    const [period, setPeriod] = useState<DashboardPeriod>('week');
    
    const dashboardData = useMemo(() => {
        return getDashboardData(leads, saves, settings.customStatuses, period);
    }, [leads, saves, settings.customStatuses, period]);

    return (
        <main className="container mx-auto p-4 space-y-6 animate-card-entry">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Dashboard de Desempenho</h2>
                <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-md">
                    {(['today', 'week', 'month'] as DashboardPeriod[]).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-sm font-semibold rounded ${period === p ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-tertiary)]'}`}>
                            {p === 'today' ? 'Hoje' : p === 'week' ? 'Esta Semana' : 'Este Mês'}
                        </button>
                    ))}
                </div>
            </div>

            <ChartCard title="Análise de Sucesso (IA)">
                <SuccessInsightsPanel 
                    insights={successInsights}
                    onRunAnalysis={onRunAnalysis}
                    isAnalyzing={isAnalyzing}
                    error={analysisError}
                />
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Funil de Contato">
                    <FunnelChart data={dashboardData.funnel} />
                </ChartCard>
                <ChartCard title="Melhor Hora/Dia para Contato (Resultados Positivos)">
                    <Heatmap data={dashboardData.heatmap} />
                </ChartCard>
                <ChartCard title="Taxa de Conversão por Tag">
                    <BarChart data={dashboardData.rateByTag} />
                </ChartCard>
                <ChartCard title="Taxa de Conversão por DDD">
                    <BarChart data={dashboardData.rateByDDD} />
                </ChartCard>
            </div>
            
            <ChartCard title="Comparativo de Listas Salvas">
                <SavedListTable data={dashboardData.savedListPerformance} />
            </ChartCard>
        </main>
    );
};