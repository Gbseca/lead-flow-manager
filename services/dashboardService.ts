import type { Lead, SaveSlot, HistoryEvent, CustomStatus } from '../types';

export type DashboardPeriod = 'today' | 'week' | 'month';

export interface FunnelData {
    totalLeads: number;
    attempts: number;
    successfulContacts: number;
    positiveResults: number;
}

export interface RateData {
    name: string;
    positive: number;
    total: number;
    rate: number;
}

export interface HeatmapData {
    // 7 days (0=Sun) x 24 hours
    [day: number]: { [hour: number]: number };
}

export interface SavedListPerformance {
    name: string;
    conversion: number;
    positive: number;
    totalFinalized: number;
}

export interface DashboardData {
    funnel: FunnelData;
    rateByTag: RateData[];
    rateByDDD: RateData[];
    heatmap: HeatmapData;
    savedListPerformance: SavedListPerformance[];
}

const getPeriodStartTimestamp = (period: DashboardPeriod): number => {
    const now = new Date();
    now.setSeconds(0, 0);

    switch (period) {
        case 'today':
            now.setHours(0, 0, 0, 0);
            return now.getTime();
        case 'week':
            const firstDayOfWeek = now.getDate() - now.getDay();
            now.setDate(firstDayOfWeek);
            now.setHours(0, 0, 0, 0);
            return now.getTime();
        case 'month':
            now.setDate(1);
            now.setHours(0, 0, 0, 0);
            return now.getTime();
    }
};

export const getDashboardData = (
    leads: Lead[],
    saves: Record<string, SaveSlot>,
    customStatuses: CustomStatus[],
    period: DashboardPeriod
): DashboardData => {
    const periodStart = getPeriodStartTimestamp(period);

    const positiveStatusIds = new Set(customStatuses.filter(s => s.isPositive).map(s => s.id));

    // --- Filter history events by period ---
    const eventsInPeriod: HistoryEvent[] = leads.flatMap(l => 
        l.history.filter(h => h.timestamp >= periodStart)
    );

    // --- Funnel Calculation ---
    const attempts = eventsInPeriod.filter(e => e.type === 'attempt').length;
    const resultEventsInPeriod = eventsInPeriod.filter(e => e.type === 'result');
    const successfulContacts = resultEventsInPeriod.length;
    const positiveResults = resultEventsInPeriod.filter(e => positiveStatusIds.has(e.data?.statusId)).length;
    const funnel: FunnelData = {
        totalLeads: leads.filter(l => l.createdAt >= periodStart).length,
        attempts,
        successfulContacts,
        positiveResults
    };

    // --- Rate Calculations ---
    const finalizedLeadsInPeriod = leads.filter(l => {
        const resultEvent = l.history.find(h => h.type === 'result');
        return l.locked && resultEvent && resultEvent.timestamp >= periodStart;
    });

    const rateByTag = calculateRates(finalizedLeadsInPeriod, l => l.tags || [], positiveStatusIds);
    const rateByDDD = calculateRates(finalizedLeadsInPeriod, l => l.ddd ? [l.ddd] : [], positiveStatusIds);
    
    // --- Heatmap Calculation ---
    const heatmap: HeatmapData = {};
    const positiveResultEvents = resultEventsInPeriod.filter(e => positiveStatusIds.has(e.data?.statusId));
    positiveResultEvents.forEach(event => {
        const date = new Date(event.timestamp);
        const day = date.getDay(); // 0 = Sunday
        const hour = date.getHours();
        if (!heatmap[day]) heatmap[day] = {};
        if (!heatmap[day][hour]) heatmap[day][hour] = 0;
        heatmap[day][hour]++;
    });

    // --- Saved List Performance (not time-based) ---
    const savedListPerformance: SavedListPerformance[] = Object.entries(saves).map(([name, data]) => {
        const finalized = data.leads.filter(l => l.locked);
        const positive = finalized.filter(l => positiveStatusIds.has(l.result)).length;
        const totalFinalized = finalized.length;
        const conversion = totalFinalized > 0 ? (positive / totalFinalized) * 100 : 0;
        return { name, conversion, positive, totalFinalized };
    }).sort((a,b) => b.conversion - a.conversion);


    return { funnel, rateByTag, rateByDDD, heatmap, savedListPerformance };
};


function calculateRates(leads: Lead[], keyExtractor: (l: Lead) => string[], positiveStatusIds: Set<string>): RateData[] {
    const stats: Record<string, { positive: number, total: number }> = {};

    leads.forEach(lead => {
        const keys = keyExtractor(lead);
        const isPositive = positiveStatusIds.has(lead.result);
        
        keys.forEach(key => {
            if (!stats[key]) stats[key] = { positive: 0, total: 0 };
            stats[key].total++;
            if (isPositive) stats[key].positive++;
        });
    });

    return Object.entries(stats)
        .map(([name, data]) => ({
            name,
            ...data,
            rate: data.total > 0 ? (data.positive / data.total) * 100 : 0
        }))
        .filter(item => item.total > 2) // Only show tags/DDDs with significant data
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 10); // Limit to top 10
}
